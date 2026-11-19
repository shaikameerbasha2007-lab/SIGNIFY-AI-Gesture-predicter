import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Camera,
  CameraOff,
  Check,
  Copy,
  Delete,
  Pause,
  Play,
  RotateCcw,
  Space,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ASL_ALPHABET, ASL_BY_LETTER } from '../data/aslAlphabet';
import { useMediaPipeHands } from '../hooks/useMediaPipeHands';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';
import { ALL_ASL_LETTERS, generateDemoHandLandmarks } from '../ml/demoHandPoses';
import { drawHandOverlay } from '../ml/handCanvasRenderer';
import { GestureTemporalSmoother } from '../ml/temporalSmoother';
import type { HandDetection, SmoothedResult } from '../types';
import { ASLHandDiagram } from './ASLHandDiagram';

type InputMode = 'camera' | 'demo';

const INITIAL_SMOOTHED: SmoothedResult = {
  stableLabel: null,
  displayLabel: null,
  confidence: 0,
  status: 'no-hand',
  reason: 'Start the camera or switch to Demo Mode to test the real-time classifier.',
  stabilityProgress: 0,
  committedLetter: null,
  committedAction: null,
  topCandidates: [],
  isDynamic: false,
  handCount: 0,
};

const DEMO_SEQUENCES: { label: string; tokens: string[] }[] = [
  { label: 'Spell "HELLO"', tokens: ['H', 'E', 'L', 'PAUSE', 'L', 'O'] },
  { label: 'Spell "HELP"', tokens: ['H', 'E', 'L', 'P'] },
  { label: 'Spell "HI AI"', tokens: ['H', 'I', 'TWO_HAND_SPACE', 'A', 'I'] },
  { label: 'Dynamic "J"', tokens: ['J'] },
  { label: 'Dynamic "Z"', tokens: ['Z'] },
];

export function GestureDashboard() {
  const [inputMode, setInputMode] = useState<InputMode>('camera');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStarting, setCameraStarting] = useState(false);

  // Demo mode controls (feeds synthetic 21-point 3D skeletons through the REAL classifier!)
  const [demoPose, setDemoPose] = useState<string>('H');
  const [demoTwoHands, setDemoTwoHands] = useState(false);
  const [sequenceQueue, setSequenceQueue] = useState<string[]>([]);
  const [sequenceLabel, setSequenceLabel] = useState<string | null>(null);

  // Temporal confirmation sensitivity (frames required)
  const [confirmFrames, setConfirmFrames] = useState<number>(10);

  // Recognition & composed sentence state
  const [prediction, setPrediction] = useState<SmoothedResult>(INITIAL_SMOOTHED);
  const [composedText, setComposedText] = useState<string>('');
  const [lastCommitFlash, setLastCommitFlash] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showGuideDrawer, setShowGuideDrawer] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const smootherRef = useRef<GestureTemporalSmoother>(new GestureTemporalSmoother({ confirmFrames: 10 }));
  const lastUiSyncRef = useRef<number>(0);

  // Refs to avoid restarting animation loop when demo pose updates
  const demoPoseRef = useRef(demoPose);
  const demoTwoHandsRef = useRef(demoTwoHands);
  const sequenceQueueRef = useRef<string[]>(sequenceQueue);
  demoPoseRef.current = demoPose;
  demoTwoHandsRef.current = demoTwoHands;
  sequenceQueueRef.current = sequenceQueue;

  const mediapipe = useMediaPipeHands();
  const speech = useSpeechSynthesis();

  useEffect(() => {
    smootherRef.current.setConfirmFrames(confirmFrames);
  }, [confirmFrames]);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraStarting(false);
    smootherRef.current.reset();
    setPrediction(INITIAL_SMOOTHED);
  }, []);

  const handleCommit = useCallback((result: SmoothedResult) => {
    if (result.committedAction === 'letter' && result.committedLetter) {
      const char = result.committedLetter;
      setComposedText((prev) => prev + char);
      setLastCommitFlash(`Added "${char}"`);
      setTimeout(() => setLastCommitFlash(null), 1400);
    } else if (result.committedAction === 'space') {
      setComposedText((prev) => (prev.endsWith(' ') || prev.length === 0 ? prev : `${prev} `));
      setLastCommitFlash('Added Space');
      setTimeout(() => setLastCommitFlash(null), 1400);
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraStarting(true);
    setInputMode('camera');

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraStarting(false);
      setCameraError(
        'Webcam access is not supported in this browser environment. Switch to Demo Mode to test the full ML classifier pipeline.',
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const landmarker = await mediapipe.initLandmarker();
      if (!landmarker) {
        throw new Error(
          mediapipe.error ||
            'Could not load the MediaPipe HandLandmarker model. Check network access or try Demo Mode.',
        );
      }

      smootherRef.current.reset();
      setCameraActive(true);
      setCameraStarting(false);
    } catch (err) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setCameraStarting(false);
      setCameraActive(false);

      const errName = (err as DOMException)?.name;
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setCameraError(
          'Camera permission was denied. Allow camera access in your browser address bar, or switch to Demo Mode below.',
        );
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setCameraError(
          'No webcam was detected on this device. Switch to Demo Mode to explore live hand landmark classification.',
        );
      } else {
        setCameraError(
          err instanceof Error
            ? err.message
            : 'Unable to start webcam tracking. Switch to Demo Mode to test gesture classification.',
        );
      }
    }
  }, [mediapipe]);

  // Live Camera inference loop
  useEffect(() => {
    if (inputMode !== 'camera' || !cameraActive) return;

    let cancelled = false;
    const loop = (now: number) => {
      if (cancelled) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState >= 2) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
        }

        const hands = mediapipe.detectVideoFrame(video, now);
        const result = smootherRef.current.update(hands, now);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          drawHandOverlay(ctx, canvas.width, canvas.height, hands, {
            mirror: true,
            trails: smootherRef.current.getTrails(),
          });
        }

        if (result.committedAction) {
          handleCommit(result);
        }

        if (now - lastUiSyncRef.current > 60 || result.committedAction) {
          lastUiSyncRef.current = now;
          setPrediction(result);
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [inputMode, cameraActive, mediapipe, handleCommit]);

  // Interactive Demo Mode loop (runs synthetic 21-point landmarks through the REAL classifier!)
  useEffect(() => {
    if (inputMode !== 'demo') return;

    let cancelled = false;
    let frameTick = 0;
    let dynamicStep = 0;
    let seqStepTicks = 0;

    smootherRef.current.reset();

    const interval = window.setInterval(() => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (canvas.width !== 640 || canvas.height !== 420) {
        canvas.width = 640;
        canvas.height = 420;
      }

      frameTick += 1;

      // Advance automated demo word sequence if active
      const activeSeq = sequenceQueueRef.current;
      let currentToken = demoPoseRef.current;
      let isDualPalm = demoTwoHandsRef.current;

      if (activeSeq.length > 0) {
        currentToken = activeSeq[0];
        isDualPalm = currentToken === 'TWO_HAND_SPACE';
      }

      const hands: HandDetection[] = [];

      if (currentToken !== 'PAUSE') {
        const isDynamicToken = currentToken === 'J' || currentToken === 'Z';
        const phase = isDynamicToken ? (dynamicStep % 24) / 23 : 0;
        if (isDynamicToken) dynamicStep += 1;

        // Subtle organic breathing drift so canvas looks alive without altering pose geometry
        const driftX = Math.sin(frameTick * 0.08) * 0.004;
        const driftY = Math.cos(frameTick * 0.06) * 0.004;

        if (isDualPalm) {
          hands.push({
            landmarks: generateDemoHandLandmarks('OPEN_PALM', {
              centerX: 0.68 + driftX,
              centerY: 0.76 + driftY,
              scale: 0.21,
            }),
            handedness: 'Right',
          });
          hands.push({
            landmarks: generateDemoHandLandmarks('OPEN_PALM', {
              centerX: 0.32 - driftX,
              centerY: 0.76 + driftY,
              scale: 0.21,
              mirror: true,
            }),
            handedness: 'Left',
          });
        } else {
          hands.push({
            landmarks: generateDemoHandLandmarks(currentToken, {
              centerX: 0.5 + driftX,
              centerY: 0.74 + driftY,
              scale: 0.23,
              phase,
            }),
            handedness: 'Right',
          });
        }
      }

      const result = smootherRef.current.update(hands, Date.now());
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawHandOverlay(ctx, canvas.width, canvas.height, hands, {
          mirror: false,
          showGrid: true,
          trails: smootherRef.current.getTrails(),
        });
      }

      setPrediction(result);

      if (result.committedAction) {
        handleCommit(result);
        if (activeSeq.length > 0) {
          dynamicStep = 0;
          seqStepTicks = 0;
          const remaining = activeSeq.slice(1);
          setSequenceQueue(remaining);
          if (remaining.length === 0) {
            setSequenceLabel(null);
          }
        }
      } else if (activeSeq.length > 0 && currentToken === 'PAUSE') {
        seqStepTicks += 1;
        if (seqStepTicks >= 6) {
          seqStepTicks = 0;
          const remaining = activeSeq.slice(1);
          setSequenceQueue(remaining);
          if (remaining.length === 0) setSequenceLabel(null);
        }
      }
    }, 55);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [inputMode, handleCommit]);

  // Clean up webcam stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const switchMode = (nextMode: InputMode) => {
    if (nextMode === inputMode) return;
    if (nextMode === 'demo') {
      stopCamera();
      setSequenceQueue([]);
      setSequenceLabel(null);
      setInputMode('demo');
    } else {
      setSequenceQueue([]);
      setSequenceLabel(null);
      setInputMode('camera');
      smootherRef.current.reset();
      setPrediction(INITIAL_SMOOTHED);
    }
  };

  const triggerDemoPose = (pose: string, dual = false) => {
    setSequenceQueue([]);
    setSequenceLabel(null);
    setDemoTwoHands(dual);
    setDemoPose(pose);
    smootherRef.current.reset();
  };

  const runDemoSequence = (seq: { label: string; tokens: string[] }) => {
    smootherRef.current.reset();
    setDemoTwoHands(false);
    setSequenceLabel(seq.label);
    setSequenceQueue([...seq.tokens]);
  };

  const handleCopyText = async () => {
    if (!composedText.trim()) return;
    try {
      await navigator.clipboard.writeText(composedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback if clipboard API blocked in iframe
      setCopied(false);
    }
  };

  const confidencePercent = Math.round(prediction.confidence * 100);
  const statusDisplay =
    prediction.status === 'recognized'
      ? { label: prediction.isDynamic ? 'Dynamic Sign Match' : 'Recognized', color: 'text-cyan-300' }
      : prediction.status === 'two-hand-space'
        ? { label: 'Two-Hand Space Cue', color: 'text-violet-300' }
        : prediction.status === 'uncertain'
          ? { label: 'Uncertain Gesture', color: 'text-amber-300' }
          : prediction.status === 'unsupported'
            ? { label: 'Unsupported Handshape', color: 'text-amber-300' }
            : { label: 'Waiting for Hand', color: 'text-slate-400' };

  const currentLetterMeta =
    prediction.displayLabel && ASL_BY_LETTER[prediction.displayLabel]
      ? ASL_BY_LETTER[prediction.displayLabel]
      : null;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
      {/* Header & Input Mode Selector */}
      <div className="mb-6 flex flex-col justify-between gap-4 border-b border-white/[0.08] pb-6 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-cyan-400">
            Module 1 & 3 · Real-Time Gesture Recognition & Speech
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white">
            ASL Gesture Recognition Dashboard
          </h1>
        </div>

        {/* Clean segmented control strictly separating Live Camera vs Demo Mode */}
        <div
          className="inline-flex shrink-0 items-center rounded-xl border border-white/10 bg-[#0a1124] p-1"
          role="tablist"
          aria-label="Recognition input source"
        >
          <button
            type="button"
            role="tab"
            aria-selected={inputMode === 'camera'}
            onClick={() => switchMode('camera')}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              inputMode === 'camera'
                ? 'bg-cyan-500/20 text-cyan-200'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Live Webcam AI
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={inputMode === 'demo'}
            onClick={() => switchMode('demo')}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              inputMode === 'demo'
                ? 'bg-violet-500/25 text-violet-200'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Demo Mode (Synthetic Landmarks)
          </button>
        </div>
      </div>

      {/* Explicit Mode Banner when in Demo Mode */}
      {inputMode === 'demo' && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-400/25 bg-violet-950/35 px-4 py-3 text-sm text-violet-100">
          <p>
            <strong className="font-semibold text-violet-200">Demo Mode Active:</strong> Synthetic
            21-point 3D hand skeletons are streamed into the real trained ASL classifier and
            temporal smoother so you can test every letter without a physical webcam.
          </p>
          <button
            type="button"
            onClick={() => switchMode('camera')}
            className="whitespace-nowrap text-xs font-semibold text-cyan-300 underline-offset-4 hover:underline"
          >
            Switch to Live Webcam
          </button>
        </div>
      )}

      {/* Main 12-Column Dashboard Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left 7 Columns: Webcam / Landmark Viewport + Controls */}
        <div className="flex flex-col gap-5 lg:col-span-7">
          <div className="glass-panel overflow-hidden rounded-2xl">
            {/* Viewport Top Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-3.5">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span className="font-semibold text-white">
                  {inputMode === 'camera' ? 'Webcam Landmark Feed' : 'Synthetic Landmark Stage'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-slate-400">
                  {prediction.handCount === 0
                    ? '0 hands'
                    : prediction.handCount === 1
                      ? '1 hand tracked'
                      : `${prediction.handCount} hands tracked`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {inputMode === 'camera' ? (
                  cameraActive ? (
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-rose-500/35 bg-rose-500/15 px-3.5 py-1.5 text-xs font-semibold text-rose-200 transition-colors hover:bg-rose-500/25"
                    >
                      <CameraOff className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Stop Camera</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startCamera}
                      disabled={cameraStarting}
                      className="btn-primary-gradient inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{cameraStarting ? 'Initializing Model...' : 'Start Camera'}</span>
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      smootherRef.current.reset();
                      setSequenceQueue([]);
                      setSequenceLabel(null);
                    }}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/12 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/[0.1]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Reset Tracker</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowGuideDrawer((v) => !v)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/12 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/[0.1]"
                >
                  <BookOpen className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
                  <span>{showGuideDrawer ? 'Hide Guide' : 'A–Z Guide'}</span>
                </button>
              </div>
            </div>

            {/* Video + Canvas Overlay Stage */}
            <div className="relative aspect-[16/10] w-full bg-[#050914]">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`h-full w-full -scale-x-100 object-cover ${
                  inputMode === 'camera' && cameraActive ? 'block' : 'hidden'
                }`}
              />
              <canvas
                ref={canvasRef}
                data-testid="gesture-landmark-canvas"
                className={`absolute inset-0 h-full w-full ${
                  inputMode === 'demo' || cameraActive ? 'block' : 'hidden'
                }`}
              />

              {/* Idle / Camera Permission State */}
              {inputMode === 'camera' && !cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
                    <Camera className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <h2 className="font-display text-lg font-semibold text-white">
                    {cameraStarting
                      ? 'Loading MediaPipe HandLandmarker...'
                      : 'Ready for Live Hand Tracking'}
                  </h2>
                  <p className="mt-2 max-w-md text-sm text-slate-400">
                    Grant webcam permission to detect 21 hand landmarks in real time. All video
                    frames stay strictly on your device.
                  </p>

                  {cameraError && (
                    <div
                      role="alert"
                      className="mt-4 flex max-w-md items-start gap-2.5 rounded-xl border border-amber-400/30 bg-amber-950/40 px-4 py-3 text-left text-xs text-amber-200"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
                      <span>{cameraError}</span>
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={startCamera}
                      disabled={cameraStarting}
                      className="btn-primary-gradient inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      <Camera className="h-4 w-4" aria-hidden="true" />
                      <span>{cameraStarting ? 'Starting Camera...' : 'Start Camera'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode('demo')}
                      className="whitespace-nowrap rounded-xl border border-white/14 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/[0.1]"
                    >
                      Try Demo Mode Instead
                    </button>
                  </div>
                </div>
              )}

              {/* Subtle Commit Toast Overlay inside stage */}
              <AnimatePresence>
                {lastCommitFlash && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-cyan-400/35 bg-[#061126]/90 px-3.5 py-1.5 text-xs font-semibold text-cyan-200 backdrop-blur-md"
                  >
                    {lastCommitFlash}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Sequence indicator when running automated demo word */}
              {inputMode === 'demo' && sequenceLabel && (
                <div className="pointer-events-none absolute right-4 top-4 rounded-lg border border-violet-400/30 bg-[#0b1024]/85 px-3 py-1.5 text-xs font-medium text-violet-200 backdrop-blur-md">
                  Running {sequenceLabel}
                </div>
              )}
            </div>

            {/* Viewport Footer: Temporal Smoothing Sensitivity */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.08] px-5 py-3.5 text-xs text-slate-400">
              <div className="flex items-center gap-3">
                <label htmlFor="confirm-frames-slider" className="whitespace-nowrap font-medium text-slate-300">
                  Hold-to-confirm frames
                </label>
                <input
                  id="confirm-frames-slider"
                  type="range"
                  min={5}
                  max={20}
                  step={1}
                  value={confirmFrames}
                  onChange={(e) => setConfirmFrames(Number(e.target.value))}
                  className="h-1.5 w-28 accent-cyan-400"
                />
                <span className="font-mono tabular-nums text-cyan-300">{confirmFrames} frames</span>
              </div>
              <span className="text-slate-400">
                Two-hand shortcut: hold both open palms to insert a space
              </span>
            </div>
          </div>

          {/* Demo Mode Pose & Word Controls (only visible in Demo Mode) */}
          {inputMode === 'demo' && (
            <div className="glass-panel rounded-2xl p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-sm font-semibold text-white">
                  Sample Gesture Sequences & Pose Simulator
                </h2>
                <span className="text-xs text-slate-400">
                  Evaluated by the live 39D classifier + temporal smoother
                </span>
              </div>

              {/* Quick Sequence Buttons */}
              <div className="mb-4 flex flex-wrap gap-2">
                {DEMO_SEQUENCES.map((seq) => (
                  <button
                    key={seq.label}
                    type="button"
                    onClick={() => runDemoSequence(seq)}
                    className="whitespace-nowrap rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/20"
                  >
                    {seq.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => triggerDemoPose('NEUTRAL_REST', false)}
                  className="whitespace-nowrap rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-500/20"
                >
                  Test Uncertain Pose
                </button>
                <button
                  type="button"
                  onClick={() => triggerDemoPose('OPEN_PALM', true)}
                  className="whitespace-nowrap rounded-lg border border-violet-400/25 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-500/20"
                >
                  Test 2-Hand Space
                </button>
              </div>

              {/* A–Z Direct Pose Selector */}
              <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-13">
                {ALL_ASL_LETTERS.map((letter) => {
                  const active = !demoTwoHands && sequenceQueue.length === 0 && demoPose === letter;
                  return (
                    <button
                      key={letter}
                      type="button"
                      onClick={() => triggerDemoPose(letter, false)}
                      aria-label={`Simulate ASL letter ${letter}`}
                      className={`h-9 rounded-lg font-mono text-xs font-semibold transition-colors ${
                        active
                          ? 'bg-cyan-400 text-[#040711]'
                          : 'border border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-cyan-400/40 hover:text-white'
                      }`}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right 5 Columns: Large Predicted Letter Card + Composer + TTS */}
        <div className="flex flex-col gap-5 lg:col-span-5">
          {/* Large Animated Predicted Alphabet Card */}
          <div className="glass-panel rounded-2xl p-6" data-testid="prediction-card">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-slate-400">Live Model Prediction</span>
              <span className={`font-semibold ${statusDisplay.color}`}>{statusDisplay.label}</span>
            </div>

            <div className="mt-4 flex items-center gap-6">
              <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/25 bg-[#060d1f] shadow-inner">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={prediction.displayLabel ?? prediction.status}
                    initial={{ scale: 0.78, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.86, opacity: 0 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    data-testid="predicted-letter"
                    className={`font-display font-bold ${
                      prediction.displayLabel === 'SPACE'
                        ? 'text-xl text-violet-300'
                        : prediction.displayLabel
                          ? 'text-6xl text-white'
                          : 'text-3xl text-slate-500'
                    }`}
                  >
                    {prediction.displayLabel ?? '—'}
                  </motion.span>
                </AnimatePresence>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-medium text-slate-400">Confidence</span>
                  <span
                    data-testid="prediction-confidence"
                    className="font-mono text-lg font-semibold tabular-nums text-white"
                  >
                    {confidencePercent}%
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-150 ${
                      prediction.status === 'recognized'
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-400'
                        : prediction.status === 'two-hand-space'
                          ? 'bg-violet-400'
                          : 'bg-amber-400'
                    }`}
                    style={{ width: `${confidencePercent}%` }}
                  />
                </div>

                {/* Temporal confirmation bar */}
                <div className="mt-4 flex items-baseline justify-between">
                  <span className="text-xs font-medium text-slate-400">
                    Temporal Confirmation
                  </span>
                  <span className="font-mono text-xs tabular-nums text-cyan-300">
                    {Math.round(prediction.stabilityProgress * 100)}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-cyan-400 transition-all duration-100"
                    style={{ width: `${Math.round(prediction.stabilityProgress * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-slate-300">{prediction.reason}</p>

            {/* Top-3 Candidates + Motion Type metadata */}
            {prediction.topCandidates.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] pt-3 text-xs text-slate-400">
                <div className="flex items-center gap-2 font-mono tabular-nums">
                  <span className="font-sans text-slate-500">Top matches:</span>
                  {prediction.topCandidates.map((cand, idx) => (
                    <span key={cand.letter} className={idx === 0 ? 'text-cyan-300' : 'text-slate-400'}>
                      {cand.letter} {Math.round(cand.confidence * 100)}%
                      {idx < prediction.topCandidates.length - 1 ? ' ·' : ''}
                    </span>
                  ))}
                </div>
                {currentLetterMeta && (
                  <span className="text-slate-400">{currentLetterMeta.motionType} sign</span>
                )}
              </div>
            )}
          </div>

          {/* Composed Sentence & Text-to-Speech Module */}
          <div className="glass-panel flex flex-col gap-4 rounded-2xl p-6">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="composed-sentence" className="font-display text-base font-semibold text-white">
                Generated Text & Speech Composer
              </label>
              <span className="font-mono text-xs tabular-nums text-slate-400">
                {composedText.length} chars
              </span>
            </div>

            <textarea
              id="composed-sentence"
              value={composedText}
              onChange={(e) => setComposedText(e.target.value)}
              rows={3}
              placeholder="Recognized letters appear here automatically—or type and edit your sentence directly..."
              className="w-full resize-none rounded-xl border border-white/12 bg-[#050a18] px-4 py-3 font-sans text-base text-white placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none"
            />

            {/* Editing Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setComposedText((prev) => `${prev} `)}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-white/[0.09]"
              >
                <Space className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
                <span>Add Space</span>
              </button>

              <button
                type="button"
                onClick={() => setComposedText((prev) => prev.slice(0, -1))}
                disabled={composedText.length === 0}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-white/[0.09] disabled:opacity-40"
              >
                <Delete className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
                <span>Delete Last Letter</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setComposedText('');
                  speech.stop();
                }}
                disabled={composedText.length === 0}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-white/[0.09] disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-300" aria-hidden="true" />
                <span>Clear Text</span>
              </button>

              <button
                type="button"
                onClick={handleCopyText}
                disabled={composedText.trim().length === 0}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-white/[0.09] disabled:opacity-40"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                    <span className="text-emerald-300">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>
            </div>

            {/* Speech Synthesis Controls */}
            <div className="border-t border-white/[0.08] pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => speech.speak(composedText)}
                  disabled={!speech.supported || composedText.trim().length === 0}
                  className="btn-primary-gradient inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-45"
                >
                  <Volume2 className="h-4 w-4" aria-hidden="true" />
                  <span>Speak Text</span>
                </button>

                {speech.isSpeaking && !speech.isPaused ? (
                  <button
                    type="button"
                    onClick={speech.pause}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/14 bg-white/[0.05] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.1]"
                  >
                    <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Pause</span>
                  </button>
                ) : speech.isPaused ? (
                  <button
                    type="button"
                    onClick={speech.resume}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-cyan-400/35 bg-cyan-500/15 px-3 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-500/25"
                  >
                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Resume</span>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={speech.stop}
                  disabled={!speech.isSpeaking && !speech.isPaused}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.09] disabled:opacity-40"
                >
                  <Square className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Stop</span>
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="tts-voice-select" className="block text-xs font-medium text-slate-400">
                    Voice
                  </label>
                  <select
                    id="tts-voice-select"
                    value={speech.selectedVoiceURI}
                    onChange={(e) => speech.setSelectedVoiceURI(e.target.value)}
                    disabled={!speech.supported || speech.voices.length === 0}
                    className="mt-1 w-full rounded-lg border border-white/12 bg-[#050a18] px-3 py-2 text-xs text-slate-200 focus:border-cyan-400/60 focus:outline-none disabled:opacity-50"
                  >
                    {speech.voices.length === 0 ? (
                      <option value="">System Default Voice</option>
                    ) : (
                      speech.voices.map((v) => (
                        <option key={v.voiceURI} value={v.voiceURI}>
                          {v.name} ({v.lang})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="tts-speed-slider" className="font-medium text-slate-400">
                      Speech Speed
                    </label>
                    <span className="font-mono tabular-nums text-cyan-300">
                      {speech.rate.toFixed(1)}×
                    </span>
                  </div>
                  <input
                    id="tts-speed-slider"
                    type="range"
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    value={speech.rate}
                    onChange={(e) => speech.setRate(Number(e.target.value))}
                    className="mt-2.5 h-1.5 w-full accent-cyan-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Static vs Dynamic Recognition Transparency Note */}
          <div className="glass-panel-subtle rounded-2xl p-4 text-xs leading-relaxed text-slate-400">
            <strong className="font-semibold text-slate-200">
              Static vs. Dynamic ASL Recognition:
            </strong>{' '}
            24 ASL letters (A–I, K–Y) are static handshapes classified from 39 normalized 3D
            kinematic joint features. Letters <strong className="text-cyan-300">J</strong> and{' '}
            <strong className="text-cyan-300">Z</strong> are dynamic motion signs detected by
            tracking fingertip trajectories across consecutive frames.
          </div>
        </div>
      </div>

      {/* Collapsible On-Dashboard Quick Reference Guide for All 26 Letters */}
      <AnimatePresence>
        {showGuideDrawer && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            aria-label="Quick A to Z ASL Reference Guide"
            className="glass-panel mt-6 rounded-2xl p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-white">
                Quick A–Z Fingerspelling Reference
              </h2>
              <button
                type="button"
                onClick={() => setShowGuideDrawer(false)}
                className="text-xs font-medium text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9">
              {ASL_ALPHABET.map((item) => (
                <button
                  key={item.letter}
                  type="button"
                  onClick={() => {
                    if (inputMode === 'demo') {
                      triggerDemoPose(item.letter, false);
                    }
                  }}
                  className="flex flex-col items-center rounded-xl border border-white/[0.08] bg-[#060c1c] p-3 text-center transition-colors hover:border-cyan-400/40"
                >
                  <ASLHandDiagram letter={item.letter} size={74} />
                  <span className="mt-1 font-display text-base font-bold text-white">
                    {item.letter}
                  </span>
                  <span className="text-[11px] text-slate-400">{item.motionType}</span>
                </button>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
