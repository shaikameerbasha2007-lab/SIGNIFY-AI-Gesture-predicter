import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Camera,
  CameraOff,
  CheckCircle2,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
  SkipForward,
  XCircle,
} from 'lucide-react';
import { motion } from 'motion/react';
import { ASL_ALPHABET, ASL_BY_LETTER } from '../data/aslAlphabet';
import { useMediaPipeHands } from '../hooks/useMediaPipeHands';
import { ALL_ASL_LETTERS, generateDemoHandLandmarks } from '../ml/demoHandPoses';
import { drawHandOverlay } from '../ml/handCanvasRenderer';
import { GestureTemporalSmoother } from '../ml/temporalSmoother';
import type { ASLLetterInfo, HandDetection, SignMotionType } from '../types';
import { generateQuizQuestions, pickNextPracticeLetter } from '../utils/quizEngine';
import { HumanASLHand, SKIN_TONES, type SkinToneId } from './HumanASLHand';

type LearnTab = 'reference' | 'practice' | 'quiz';

export function LearnASLPage() {
  const [activeTab, setActiveTab] = useState<LearnTab>('reference');
  const [skinTone, setSkinTone] = useState<SkinToneId>('warm');

  // Reference Guide state
  const [searchQuery, setSearchQuery] = useState('');
  const [motionFilter, setMotionFilter] = useState<'All' | SignMotionType>('All');
  const [selectedLetter, setSelectedLetter] = useState<ASLLetterInfo>(ASL_ALPHABET[0]);

  // Practice Mode state (evaluated via REAL classifier!)
  const [practiceTarget, setPracticeTarget] = useState<ASLLetterInfo>(() =>
    pickNextPracticeLetter(null, new Set(), 13),
  );
  const [practiceScore, setPracticeScore] = useState(0);
  const [practiceStreak, setPracticeStreak] = useState(0);
  const [masteredLetters, setMasteredLetters] = useState<Set<string>>(() => new Set());
  const [showPracticeHint, setShowPracticeHint] = useState(true);
  const [practiceInput, setPracticeInput] = useState<'camera' | 'demo'>('demo');
  const [practiceCameraOn, setPracticeCameraOn] = useState(false);
  const [practiceCameraErr, setPracticeCameraErr] = useState<string | null>(null);
  const [practiceDemoPose, setPracticeDemoPose] = useState<string>('A');
  const [practicePredicted, setPracticePredicted] = useState<string | null>(null);
  const [practiceConfidence, setPracticeConfidence] = useState<number>(0);
  const [practiceMatchedBanner, setPracticeMatchedBanner] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const smootherRef = useRef<GestureTemporalSmoother>(
    new GestureTemporalSmoother({ confirmFrames: 7 }),
  );
  const practiceTargetRef = useRef(practiceTarget);
  const practiceDemoPoseRef = useRef(practiceDemoPose);
  const masteredRef = useRef(masteredLetters);
  practiceTargetRef.current = practiceTarget;
  practiceDemoPoseRef.current = practiceDemoPose;
  masteredRef.current = masteredLetters;

  const mediapipe = useMediaPipeHands();

  // Quiz Mode state
  const [quizSeed, setQuizSeed] = useState(101);
  const quizQuestions = useMemo(() => generateQuizQuestions(10, quizSeed), [quizSeed]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizSelected, setQuizSelected] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);

  // Filtered Reference List
  const filteredAlphabet = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ASL_ALPHABET.filter((item) => {
      if (motionFilter !== 'All' && item.motionType !== motionFilter) return false;
      if (!q) return true;
      return (
        item.letter.toLowerCase().includes(q) ||
        item.handShapeSummary.toLowerCase().includes(q) ||
        item.difficulty.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, motionFilter]);

  const stopPracticeCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setPracticeCameraOn(false);
  }, []);

  useEffect(() => {
    if (activeTab !== 'practice') {
      stopPracticeCamera();
    }
    return () => stopPracticeCamera();
  }, [activeTab, stopPracticeCamera]);

  const handlePracticeMatch = useCallback((letter: string) => {
    const targetLetter = practiceTargetRef.current.letter;
    if (letter !== targetLetter) return;

    setPracticeMatchedBanner(`Confirmed "${letter}" — Well done!`);
    setPracticeScore((s) => s + 10);
    setPracticeStreak((st) => st + 1);

    const nextMastered = new Set(masteredRef.current);
    nextMastered.add(letter);
    setMasteredLetters(nextMastered);

    smootherRef.current.reset();
    window.setTimeout(() => {
      setPracticeMatchedBanner(null);
      setPracticeTarget(pickNextPracticeLetter(letter, nextMastered, Date.now()));
    }, 1100);
  }, []);

  const startPracticeCamera = async () => {
    setPracticeCameraErr(null);
    setPracticeInput('camera');
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPracticeCameraErr('Webcam unavailable. Switch to Demo Pose Test to practice with synthetic hand landmarks.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 960 }, height: { ideal: 600 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const lm = await mediapipe.initLandmarker();
      if (!lm) throw new Error('Unable to initialize MediaPipe HandLandmarker.');
      smootherRef.current.reset();
      setPracticeCameraOn(true);
    } catch {
      stopPracticeCamera();
      setPracticeCameraErr('Camera access denied or unavailable. Use Demo Pose Test below to test the model.');
    }
  };

  // Practice Live Camera Loop
  useEffect(() => {
    if (activeTab !== 'practice' || practiceInput !== 'camera' || !practiceCameraOn) return;

    let cancelled = false;
    let lastSync = 0;

    const loop = (now: number) => {
      if (cancelled) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState >= 2) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 420;
        }
        const hands = mediapipe.detectVideoFrame(video, now);
        const res = smootherRef.current.update(hands, now);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          drawHandOverlay(ctx, canvas.width, canvas.height, hands, {
            mirror: true,
            trails: smootherRef.current.getTrails(),
          });
        }
        if (res.committedLetter) {
          handlePracticeMatch(res.committedLetter);
        }
        if (now - lastSync > 70) {
          lastSync = now;
          setPracticePredicted(res.displayLabel);
          setPracticeConfidence(Math.round(res.confidence * 100));
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [activeTab, practiceInput, practiceCameraOn, mediapipe, handlePracticeMatch]);

  // Practice Demo Pose Loop (evaluates chosen synthetic pose through REAL classifier!)
  useEffect(() => {
    if (activeTab !== 'practice' || practiceInput !== 'demo') return;

    let cancelled = false;
    let step = 0;
    smootherRef.current.reset();

    const timer = window.setInterval(() => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (canvas.width !== 560 || canvas.height !== 360) {
        canvas.width = 560;
        canvas.height = 360;
      }

      const token = practiceDemoPoseRef.current;
      const isDyn = token === 'J' || token === 'Z';
      const phase = isDyn ? (step % 22) / 21 : 0;
      if (isDyn) step += 1;

      const hands: HandDetection[] = [
        {
          landmarks: generateDemoHandLandmarks(token, {
            centerX: 0.5,
            centerY: 0.74,
            scale: 0.23,
            phase,
          }),
          handedness: 'Right',
        },
      ];

      const res = smootherRef.current.update(hands, Date.now());
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawHandOverlay(ctx, canvas.width, canvas.height, hands, {
          showGrid: true,
          trails: smootherRef.current.getTrails(),
        });
      }

      setPracticePredicted(res.displayLabel);
      setPracticeConfidence(Math.round(res.confidence * 100));

      if (res.committedLetter) {
        handlePracticeMatch(res.committedLetter);
      }
    }, 60);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeTab, practiceInput, handlePracticeMatch]);

  const currentQuestion = quizQuestions[quizIndex];

  const handleQuizAnswer = (choice: string) => {
    if (quizSelected !== null || !currentQuestion) return;
    setQuizSelected(choice);
    if (choice === currentQuestion.target.letter) {
      setQuizScore((prev) => prev + 1);
    }
  };

  const nextQuizQuestion = () => {
    if (quizIndex + 1 >= quizQuestions.length) {
      setQuizCompleted(true);
    } else {
      setQuizIndex((i) => i + 1);
      setQuizSelected(null);
    }
  };

  const restartQuiz = () => {
    setQuizSeed((s) => s + 17);
    setQuizIndex(0);
    setQuizSelected(null);
    setQuizScore(0);
    setQuizCompleted(false);
  };

  const launchPracticeForLetter = (item: ASLLetterInfo) => {
    setPracticeTarget(item);
    setActiveTab('practice');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
      {/* Header + Mode Switcher */}
      <div className="mb-8 flex flex-col justify-between gap-4 border-b border-white/[0.08] pb-6 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-cyan-400">
            Module 4 · ASL Learning, Practice & Quiz
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white">
            Learn American Sign Language (A–Z)
          </h1>
        </div>

        <div
          role="tablist"
          aria-label="Learn ASL sections"
          className="inline-flex shrink-0 items-center rounded-xl border border-white/10 bg-[#0a1124] p-1"
        >
          {(
            [
              { id: 'reference', label: 'A–Z Reference' },
              { id: 'practice', label: 'Practice Mode' },
              { id: 'quiz', label: 'Quiz Mode' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'bg-cyan-500/20 text-cyan-200'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: SEARCHABLE A-Z REFERENCE GUIDE */}
      {activeTab === 'reference' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left 8 Columns: Search + Grid */}
          <div className="flex flex-col gap-5 lg:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search letter (A–Z) or posture cue (e.g. fist, pinched, crossed)..."
                  aria-label="Search ASL alphabet gestures"
                  className="w-full rounded-xl border border-white/12 bg-[#070d1d] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#070d1d] px-2.5 py-1.5"
                  role="group"
                  aria-label="Hand skin tone"
                >
                  <span className="mr-1 text-[11px] font-medium text-slate-400">Hand tone</span>
                  {SKIN_TONES.map((tone) => (
                    <button
                      key={tone.id}
                      type="button"
                      onClick={() => setSkinTone(tone.id)}
                      aria-label={`Select ${tone.label} hand tone`}
                      aria-pressed={skinTone === tone.id}
                      title={tone.label}
                      className={`h-5 w-5 rounded-full border transition-transform ${
                        skinTone === tone.id
                          ? 'scale-110 border-cyan-300 ring-2 ring-cyan-400/50'
                          : 'border-white/20 hover:scale-105'
                      }`}
                      style={{ backgroundColor: tone.swatch }}
                    />
                  ))}
                </div>

                <div className="inline-flex items-center rounded-xl border border-white/10 bg-[#070d1d] p-1">
                  {(['All', 'Static', 'Dynamic'] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setMotionFilter(filter)}
                      className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        motionFilter === filter
                          ? 'bg-white/12 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {filteredAlphabet.length === 0 ? (
              <div className="glass-panel rounded-2xl p-10 text-center">
                <p className="text-sm text-slate-300">No ASL letters matched "{searchQuery}".</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setMotionFilter('All');
                  }}
                  className="mt-3 text-xs font-semibold text-cyan-300 hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {filteredAlphabet.map((item) => {
                  const isSelected = selectedLetter.letter === item.letter;
                  return (
                    <button
                      key={item.letter}
                      type="button"
                      onClick={() => setSelectedLetter(item)}
                      className={`flex flex-col items-center rounded-2xl border p-4 text-center transition-colors ${
                        isSelected
                          ? 'border-cyan-400/60 bg-cyan-500/12'
                          : 'border-white/[0.08] bg-[#091124]/75 hover:border-cyan-400/30 hover:bg-[#0c162e]'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between text-xs">
                        <span className="font-display text-lg font-bold text-white">
                          {item.letter}
                        </span>
                        <span
                          className={
                            item.motionType === 'Dynamic' ? 'text-violet-300' : 'text-slate-400'
                          }
                        >
                          {item.motionType}
                        </span>
                      </div>
                      <HumanASLHand letter={item.letter} size={102} skinTone={skinTone} className="my-1" />
                      <p className="line-clamp-2 text-[11px] leading-snug text-slate-400">
                        {item.handShapeSummary}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right 4 Columns: Interactive Detail Inspector */}
          <div className="lg:col-span-4">
            <div className="glass-panel sticky top-24 rounded-2xl p-6">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Selected Letter</span>
                <span>
                  {selectedLetter.motionType} · {selectedLetter.difficulty}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-5">
                <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-[#050a18]">
                  <HumanASLHand letter={selectedLetter.letter} size={108} skinTone={skinTone} />
                </div>
                <div>
                  <h2 className="font-display text-5xl font-bold text-white">
                    {selectedLetter.letter}
                  </h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                    {selectedLetter.handShapeSummary}
                  </p>
                </div>
              </div>

              <div className="mt-6 border-t border-white/[0.08] pt-5">
                <h3 className="font-display text-sm font-semibold text-white">
                  How to Form "{selectedLetter.letter}"
                </h3>
                <ol className="mt-3 space-y-2.5 text-xs leading-relaxed text-slate-300">
                  {selectedLetter.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="font-mono text-cyan-400">0{i + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-950/25 p-3.5 text-xs leading-relaxed text-amber-100/90">
                <strong className="font-semibold text-amber-200">Avoid This Pitfall:</strong>{' '}
                {selectedLetter.commonMistake}
              </div>

              <button
                type="button"
                onClick={() => launchPracticeForLetter(selectedLetter)}
                className="btn-primary-gradient mt-5 w-full rounded-xl py-2.5 text-xs font-semibold text-white"
              >
                Practice Signing "{selectedLetter.letter}"
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PRACTICE MODE */}
      {activeTab === 'practice' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left 5 Columns: Target Prompt & Progress */}
          <div className="flex flex-col gap-5 lg:col-span-5">
            <div className="glass-panel rounded-2xl p-6">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Sign This Letter</span>
                <span>
                  {practiceTarget.motionType} · {practiceTarget.difficulty}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-6">
                <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/30 bg-[#050a18]">
                  <span
                    data-testid="practice-target-letter"
                    className="font-display text-6xl font-bold text-white"
                  >
                    {practiceTarget.letter}
                  </span>
                </div>
                {showPracticeHint ? (
                  <div className="flex flex-1 flex-col items-center rounded-xl border border-white/[0.08] bg-[#060c1c] p-2">
                    <HumanASLHand letter={practiceTarget.letter} size={92} skinTone={skinTone} />
                    <span className="text-[11px] text-slate-400">Reference Hand Gesture</span>
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/12 p-4 text-center text-xs text-slate-500">
                    Hint hidden — sign from memory
                  </div>
                )}
              </div>

              <p className="mt-4 text-xs leading-relaxed text-slate-300">
                {practiceTarget.handShapeSummary}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPracticeHint((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.09]"
                >
                  {showPracticeHint ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Hide Hint</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Show Hint</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPracticeStreak(0);
                    setPracticeTarget(
                      pickNextPracticeLetter(practiceTarget.letter, masteredLetters, Date.now()),
                    );
                    smootherRef.current.reset();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.09]"
                >
                  <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Skip Letter</span>
                </button>
              </div>
            </div>

            {/* Practice Progress & Mastery */}
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="font-display text-sm font-semibold text-white">Session Progress</h2>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-slate-400">Score</p>
                  <p
                    data-testid="practice-score"
                    className="mt-1 font-mono text-2xl font-bold tabular-nums text-white"
                  >
                    {practiceScore}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Streak</p>
                  <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-cyan-300">
                    {practiceStreak}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Mastered</p>
                  <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-violet-300">
                    {masteredLetters.size}/26
                  </p>
                </div>
              </div>

              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-violet-500 transition-all duration-300"
                  style={{ width: `${Math.round((masteredLetters.size / 26) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Right 7 Columns: Real Model Evaluator (Webcam OR Demo Pose Test) */}
          <div className="flex flex-col gap-5 lg:col-span-7">
            <div className="glass-panel overflow-hidden rounded-2xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-3.5">
                <div className="inline-flex items-center rounded-lg border border-white/10 bg-[#050a18] p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      stopPracticeCamera();
                      setPracticeInput('demo');
                    }}
                    className={`rounded-md px-3 py-1 text-xs font-semibold ${
                      practiceInput === 'demo'
                        ? 'bg-violet-500/25 text-violet-200'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Demo Pose Test
                  </button>
                  <button
                    type="button"
                    onClick={startPracticeCamera}
                    className={`rounded-md px-3 py-1 text-xs font-semibold ${
                      practiceInput === 'camera'
                        ? 'bg-cyan-500/25 text-cyan-200'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Live Webcam
                  </button>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-400">Model sees:</span>
                  <span className="font-mono text-sm font-bold tabular-nums text-cyan-300">
                    {practicePredicted ?? '—'} ({practiceConfidence}%)
                  </span>
                  {practiceInput === 'camera' && practiceCameraOn && (
                    <button
                      type="button"
                      onClick={stopPracticeCamera}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-500/35 bg-rose-500/15 px-2.5 py-1 text-xs text-rose-200"
                    >
                      <CameraOff className="h-3 w-3" aria-hidden="true" />
                      <span>Stop</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="relative aspect-[16/10] w-full bg-[#050914]">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className={`h-full w-full -scale-x-100 object-cover ${
                    practiceInput === 'camera' && practiceCameraOn ? 'block' : 'hidden'
                  }`}
                />
                <canvas
                  ref={canvasRef}
                  className={`absolute inset-0 h-full w-full ${
                    practiceInput === 'demo' || practiceCameraOn ? 'block' : 'hidden'
                  }`}
                />

                {practiceInput === 'camera' && !practiceCameraOn && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <Camera className="h-8 w-8 text-cyan-400" aria-hidden="true" />
                    <p className="mt-3 text-sm font-medium text-white">
                      Enable your webcam to practice signing "{practiceTarget.letter}"
                    </p>
                    {practiceCameraErr && (
                      <p className="mt-2 max-w-md text-xs text-amber-300">{practiceCameraErr}</p>
                    )}
                    <button
                      type="button"
                      onClick={startPracticeCamera}
                      className="btn-primary-gradient mt-4 rounded-xl px-5 py-2 text-xs font-semibold text-white"
                    >
                      Start Practice Camera
                    </button>
                  </div>
                )}

                {practiceMatchedBanner && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-x-6 bottom-5 flex items-center justify-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-950/90 px-4 py-3 text-sm font-semibold text-emerald-200 backdrop-blur-md"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                    <span>{practiceMatchedBanner}</span>
                  </motion.div>
                )}
              </div>

              {practiceInput === 'demo' && (
                <div className="border-t border-white/[0.08] p-4">
                  <p className="mb-2.5 text-xs text-slate-400">
                    Select a synthetic hand pose to submit into the real ASL classifier (try matching{' '}
                    <strong className="text-cyan-300">{practiceTarget.letter}</strong>):
                  </p>
                  <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-13">
                    {ALL_ASL_LETTERS.map((letter) => (
                      <button
                        key={letter}
                        type="button"
                        onClick={() => {
                          setPracticeDemoPose(letter);
                          smootherRef.current.reset();
                        }}
                        aria-label={`Test practice pose ${letter}`}
                        className={`h-8 rounded-lg font-mono text-xs font-semibold transition-colors ${
                          practiceDemoPose === letter
                            ? 'bg-cyan-400 text-[#040711]'
                            : 'border border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-cyan-400/40 hover:text-white'
                        }`}
                      >
                        {letter}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: QUIZ MODE */}
      {activeTab === 'quiz' && (
        <div className="mx-auto max-w-2xl">
          {quizCompleted ? (
            <div className="glass-panel rounded-2xl p-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
                <Award className="h-7 w-7" aria-hidden="true" />
              </div>
              <h2 className="font-display text-2xl font-bold text-white">Quiz Complete</h2>
              <p className="mt-2 font-mono text-4xl font-bold tabular-nums text-cyan-300">
                {quizScore} / {quizQuestions.length}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                {quizScore >= 8
                  ? 'Strong mastery of ASL fingerspelling handshapes.'
                  : quizScore >= 5
                    ? 'Solid progress — review the A–Z guide for any tricky fist letters.'
                    : 'Keep practicing! Use the A–Z reference cards and Practice Mode to build muscle memory.'}
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={restartQuiz}
                  className="btn-primary-gradient inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold text-white"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Take New Quiz</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('reference')}
                  className="rounded-xl border border-white/14 bg-white/[0.05] px-5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/[0.1]"
                >
                  Review A–Z Guide
                </button>
              </div>
            </div>
          ) : currentQuestion ? (
            <div className="glass-panel rounded-2xl p-6 sm:p-8" data-testid="quiz-card">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono tabular-nums">
                  Question {quizIndex + 1} of {quizQuestions.length}
                </span>
                <span className="font-mono tabular-nums text-cyan-300">
                  Score: {quizScore}
                </span>
              </div>

              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-200"
                  style={{ width: `${((quizIndex + 1) / quizQuestions.length) * 100}%` }}
                />
              </div>

              <h2 className="mt-6 font-display text-xl font-semibold text-white">
                {currentQuestion.promptType === 'visual-sign'
                  ? 'Which ASL letter matches this human hand gesture?'
                  : 'Which ASL letter is described below?'}
              </h2>

              {currentQuestion.promptType === 'visual-sign' ? (
                <div className="my-6 flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#050a18] py-6">
                  <HumanASLHand letter={currentQuestion.target.letter} size={156} skinTone={skinTone} />
                  <span className="mt-2 text-xs text-slate-400">
                    {currentQuestion.target.motionType} sign
                  </span>
                </div>
              ) : (
                <div className="my-6 rounded-2xl border border-white/[0.08] bg-[#050a18] p-5">
                  <p className="text-base leading-relaxed text-slate-200">
                    {currentQuestion.target.handShapeSummary}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    Motion type: {currentQuestion.target.motionType} · Difficulty:{' '}
                    {currentQuestion.target.difficulty}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {currentQuestion.options.map((option) => {
                  const isCorrect = option === currentQuestion.target.letter;
                  const isPicked = quizSelected === option;

                  let styleClass =
                    'border-white/12 bg-white/[0.04] text-white hover:border-cyan-400/50 hover:bg-cyan-500/10';
                  if (quizSelected !== null) {
                    if (isCorrect) {
                      styleClass = 'border-emerald-400/60 bg-emerald-500/18 text-emerald-200';
                    } else if (isPicked && !isCorrect) {
                      styleClass = 'border-rose-400/60 bg-rose-500/18 text-rose-200';
                    } else {
                      styleClass = 'border-white/[0.06] bg-white/[0.02] text-slate-500';
                    }
                  }

                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleQuizAnswer(option)}
                      disabled={quizSelected !== null}
                      className={`flex items-center justify-between rounded-xl border px-5 py-4 font-display text-2xl font-bold transition-colors ${styleClass}`}
                    >
                      <span>{option}</span>
                      {quizSelected !== null && isCorrect && (
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" aria-hidden="true" />
                      )}
                      {quizSelected !== null && isPicked && !isCorrect && (
                        <XCircle className="h-5 w-5 text-rose-400" aria-hidden="true" />
                      )}
                    </button>
                  );
                })}
              </div>

              {quizSelected !== null && (
                <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.08] pt-5">
                  <p className="text-xs leading-relaxed text-slate-300">
                    <strong className="text-white">
                      {quizSelected === currentQuestion.target.letter ? 'Correct!' : 'Incorrect.'}
                    </strong>{' '}
                    {ASL_BY_LETTER[currentQuestion.target.letter]?.handShapeSummary}
                  </p>
                  <button
                    type="button"
                    onClick={nextQuizQuestion}
                    className="btn-primary-gradient whitespace-nowrap rounded-xl px-5 py-2.5 text-xs font-semibold text-white"
                  >
                    {quizIndex + 1 >= quizQuestions.length ? 'See Results' : 'Next Question'}
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
