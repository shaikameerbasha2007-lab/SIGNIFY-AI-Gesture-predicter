import { ArrowRight, BookOpen, Camera, Hand, Volume2 } from 'lucide-react';
import { motion } from 'motion/react';
import { HERO_HAND_VISUAL, SAMPLE_ANIMAL_IMAGES } from '../data/sampleAnimals';
import type { PageId } from '../types';
import { ASLHandDiagram } from './ASLHandDiagram';

interface LandingPageProps {
  onNavigate: (page: PageId) => void;
}

const HOW_IT_WORKS_STEPS = [
  {
    number: '01',
    title: 'Capture 21 Hand Landmarks',
    description:
      'MediaPipe Tasks Vision tracks 3D finger joint coordinates in real time on your device—supporting one-hand ASL fingerspelling and two-hand cues without uploading webcam video.',
  },
  {
    number: '02',
    title: 'Classify & Smooth Predictions',
    description:
      'A 39-feature kinematic classifier evaluates finger flexion, thumb contact, and orientation, while temporal smoothing and motion-trail tracking confirm static and dynamic signs (J, Z).',
  },
  {
    number: '03',
    title: 'Compose Words & Speak Aloud',
    description:
      'Confirmed letters assemble into editable words and sentences. Play them aloud immediately using customizable browser speech voices and playback speeds.',
  },
];

export function LandingPage({ onNavigate }: LandingPageProps) {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-8 lg:pt-14">
      {/* Hero Section */}
      <section className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12 lg:gap-10">
        <div className="flex flex-col justify-center lg:col-span-6">
          <p className="mb-4 text-sm font-medium tracking-wide text-cyan-300/90">
            Assistive Communication · Real-Time Vision & Speech
          </p>

          <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.65rem]">
            Communication Without Barriers
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
            SIGNIFY AI translates American Sign Language fingerspelling into editable text and
            natural spoken audio in real time, alongside Gemini-powered wildlife photograph
            identification and interactive ASL practice.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => onNavigate('gesture')}
              className="btn-primary-gradient inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/15"
            >
              <span>Get Started</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('animal')}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-white/14 bg-white/[0.04] px-5 py-3.5 text-sm font-medium text-slate-200 transition-colors hover:border-cyan-400/40 hover:bg-white/[0.08] hover:text-white"
            >
              <Camera className="h-4 w-4 text-cyan-400" aria-hidden="true" />
              <span>Animal Recognition</span>
            </button>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-6 border-t border-white/[0.08] pt-6">
            <div>
              <p className="font-mono text-xl font-semibold tabular-nums text-white">A–Z</p>
              <p className="mt-1 text-xs text-slate-400">24 static + 2 dynamic signs</p>
            </div>
            <div>
              <p className="font-mono text-xl font-semibold tabular-nums text-white">21 pts</p>
              <p className="mt-1 text-xs text-slate-400">3D MediaPipe hand mesh</p>
            </div>
            <div>
              <p className="font-mono text-xl font-semibold tabular-nums text-white">100%</p>
              <p className="mt-1 text-xs text-slate-400">On-device webcam tracking</p>
            </div>
          </div>
        </div>

        {/* Hero Visual Anchor */}
        <div className="lg:col-span-6">
          <div className="glass-panel relative h-full min-h-[340px] overflow-hidden rounded-2xl">
            <img
              src={HERO_HAND_VISUAL}
              alt="Human hand illuminated with luminous cyan and electric blue optical landmark tracking nodes"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover object-center"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#040711]/90 via-[#040711]/20 to-transparent" />

            {/* Subtle animated tracking scan ring overlay */}
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-[44%] h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/25"
              animate={{ scale: [0.94, 1.06, 0.94], opacity: [0.25, 0.55, 0.25] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
            />

            <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 p-6">
              <div>
                <p className="text-xs font-medium text-cyan-300">
                  Optical Hand Skeleton · Real-Time Inference
                </p>
                <p className="mt-1 font-display text-lg font-semibold text-white">
                  Temporal Smoothing & Confidence Calibration
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('learn')}
                className="whitespace-nowrap rounded-lg border border-white/15 bg-[#070d1d]/80 px-3.5 py-2 text-xs font-medium text-slate-200 backdrop-blur-md transition-colors hover:border-cyan-400/40 hover:text-white"
              >
                View A–Z Guide
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Capabilities (Asymmetric Bento Layout) */}
      <section className="mt-20" aria-labelledby="capabilities-heading">
        <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-cyan-400">Core Modules</p>
            <h2
              id="capabilities-heading"
              className="mt-1 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl"
            >
              Built for Everyday Assistive Communication
            </h2>
          </div>
          <p className="max-w-md text-sm text-slate-400">
            Every workflow runs real inference pipelines with clear uncertainty feedback and a
            built-in synthetic demo mode when a camera is unavailable.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Primary Wide Card: Real-Time Gesture Recognition */}
          <div className="glass-panel flex flex-col justify-between gap-6 rounded-2xl p-6 sm:p-7 lg:col-span-7">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
              <div className="max-w-md">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/12 text-cyan-300">
                  <Hand className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-4 font-display text-xl font-semibold text-white">
                  Real-Time ASL Hand Gesture to Text
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  Tracks 21 hand landmarks from your webcam, classifies A–Z fingerspelling with
                  calibrated confidence scores, flags ambiguous poses honestly, and confirms letters
                  via temporal smoothing.
                </p>
              </div>
              <div className="flex shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-[#060b18]/80 p-3">
                <ASLHandDiagram letter="L" size={108} />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.08] pt-5">
              <span className="text-xs text-slate-400">
                MediaPipe Tasks Vision · 1 & 2 Hand Support · Demo Mode Included
              </span>
              <button
                type="button"
                onClick={() => onNavigate('gesture')}
                className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-cyan-300 transition-colors hover:text-cyan-200"
              >
                <span>Open Gesture Studio</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Secondary Card: Gemini Animal Image Recognition */}
          <div className="glass-panel flex flex-col justify-between gap-6 rounded-2xl p-6 sm:p-7 lg:col-span-5">
            <div>
              <div className="mb-4 h-36 w-full overflow-hidden rounded-xl border border-white/[0.08]">
                <img
                  src={SAMPLE_ANIMAL_IMAGES[0].imageUrl}
                  alt={SAMPLE_ANIMAL_IMAGES[0].alt}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </div>
              <h3 className="font-display text-xl font-semibold text-white">
                AI Animal Image Recognition
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Upload JPG, PNG, or WEBP photos or snap one from your webcam to identify species,
                scientific taxonomy, habitat, diet, lifespan, and ecological facts.
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-white/[0.08] pt-5">
              <span className="text-xs text-slate-400">Gemini Vision · 6 Taxonomic Groups</span>
              <button
                type="button"
                onClick={() => onNavigate('animal')}
                className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-cyan-300 transition-colors hover:text-cyan-200"
              >
                <span>Identify Wildlife</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Bottom Left Card: Text-to-Speech Communication */}
          <div className="glass-panel flex flex-col justify-between gap-5 rounded-2xl p-6 lg:col-span-6">
            <div>
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
                <Volume2 className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold text-white">
                Customizable Voice Output
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Convert recognized fingerspelled words into clear speech with instant Play, Pause,
                and Stop controls, system voice selection, playback speed tuning, and one-click text
                copying.
              </p>
            </div>
            <div className="text-xs text-slate-400">
              Web Speech API · Editable Composer · 0.5× to 2.0× Speed Control
            </div>
          </div>

          {/* Bottom Right Card: Learn ASL & Practice */}
          <div className="glass-panel flex flex-col justify-between gap-5 rounded-2xl p-6 lg:col-span-6">
            <div>
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
                <BookOpen className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold text-white">
                Interactive ASL Reference, Practice & Quiz
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Browse searchable A–Z posture guides, practice signing prompted letters against the
                actual recognition classifier, and test recall with a 10-question adaptive quiz.
              </p>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-slate-400">All 26 Letters · Live Score Tracking</span>
              <button
                type="button"
                onClick={() => onNavigate('learn')}
                className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-violet-300 transition-colors hover:text-violet-200"
              >
                <span>Start Learning</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="mt-20 border-t border-white/[0.08] pt-16" aria-labelledby="how-it-works-heading">
        <div className="mb-10">
          <p className="text-sm font-medium text-cyan-400">How It Works</p>
          <h2
            id="how-it-works-heading"
            className="mt-1 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl"
          >
            From Hand Landmarks to Spoken Sentences in Three Steps
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {HOW_IT_WORKS_STEPS.map((step) => (
            <div key={step.number} className="flex flex-col">
              <span className="font-mono text-2xl font-semibold tabular-nums text-cyan-400">
                {step.number}.
              </span>
              <h3 className="mt-3 font-display text-lg font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
