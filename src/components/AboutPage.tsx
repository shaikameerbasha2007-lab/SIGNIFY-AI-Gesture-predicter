import { Accessibility, Cpu, Eye, ShieldCheck, Volume2 } from 'lucide-react';
import type { PageId } from '../types';

interface AboutPageProps {
  onNavigate: (page: PageId) => void;
}

export function AboutPage({ onNavigate }: AboutPageProps) {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="border-b border-white/[0.08] pb-8">
        <p className="text-sm font-medium text-cyan-400">About & Accessibility</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Breaking Communication Barriers Through Transparent AI
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-300">
          SIGNIFY AI is an assistive communication web application built to help people with speech
          or hearing difficulties express words and sentences through American Sign Language
          fingerspelling, hear their composed text spoken aloud, and identify animals in everyday
          photographs.
        </p>
      </div>

      {/* Technical Architecture Transparency */}
      <section className="mt-12" aria-labelledby="architecture-heading">
        <h2 id="architecture-heading" className="font-display text-2xl font-bold text-white">
          How the Recognition Pipeline Works
        </h2>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="glass-panel rounded-2xl p-6">
            <Cpu className="h-5 w-5 text-cyan-400" aria-hidden="true" />
            <h3 className="mt-3 font-display text-lg font-semibold text-white">
              Two-Stage Hand Gesture Recognition
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Raw hand landmarks alone do not classify ASL letters. SIGNIFY AI separates tracking
              from classification: MediaPipe Tasks Vision first extracts 21 3D hand joints per hand
              on-device, and a dedicated 39-feature kinematic classifier then evaluates normalized
              joint flexion angles, thumb-to-knuckle contacts, finger crossing, and wrist
              orientation.
            </p>
          </div>

          <div className="glass-panel rounded-2xl p-6">
            <Eye className="h-5 w-5 text-violet-400" aria-hidden="true" />
            <h3 className="mt-3 font-display text-lg font-semibold text-white">
              Static Handshapes vs. Dynamic Motion Signs
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Twenty-four ASL letters (A–I and K–Y) are static postures confirmed via sliding-window
              temporal smoothing and repeated-frame hold checks. Letters <strong>J</strong> and{' '}
              <strong>Z</strong> involve motion, so SIGNIFY AI tracks multi-frame pinky and index
              fingertip trajectories to detect them without false static triggers.
            </p>
          </div>

          <div className="glass-panel rounded-2xl p-6">
            <ShieldCheck className="h-5 w-5 text-blue-400" aria-hidden="true" />
            <h3 className="mt-3 font-display text-lg font-semibold text-white">
              Honest Uncertainty & Privacy
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              When a handshape falls outside known ASL clusters or appears ambiguous, the classifier
              explicitly reports an uncertain or unsupported state instead of guessing. All webcam
              gesture tracking runs locally inside your browser—no webcam video is uploaded.
            </p>
          </div>

          <div className="glass-panel rounded-2xl p-6">
            <Volume2 className="h-5 w-5 text-cyan-400" aria-hidden="true" />
            <h3 className="mt-3 font-display text-lg font-semibold text-white">
              Animal Recognition & Spoken Output
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Uploaded or captured animal photographs are analyzed server-side using Gemini Vision
              with structured taxonomic output (Mammal, Bird, Reptile, Amphibian, Fish, or
              Invertebrate). Every composed message and animal summary can be spoken aloud via the
              Web Speech Synthesis API.
            </p>
          </div>
        </div>
      </section>

      {/* Accessibility Instructions */}
      <section className="mt-14 border-t border-white/[0.08] pt-12" aria-labelledby="accessibility-heading">
        <div className="flex items-center gap-2.5 text-cyan-400">
          <Accessibility className="h-5 w-5" aria-hidden="true" />
          <span className="text-sm font-medium">Accessibility Guide</span>
        </div>
        <h2 id="accessibility-heading" className="mt-2 font-display text-2xl font-bold text-white">
          Tips for Best Recognition & Accessible Navigation
        </h2>

        <div className="mt-6 space-y-5 text-sm leading-relaxed text-slate-300">
          <div className="glass-panel-subtle rounded-2xl p-5">
            <h3 className="font-display text-base font-semibold text-white">
              01. Lighting & Camera Framing
            </h3>
            <p className="mt-1.5 text-slate-400">
              Position a soft light source in front of your hand against a clean, contrasting
              background. Keep your entire wrist and fingertips inside the frame at arm's length so
              all 21 landmarks track steadily.
            </p>
          </div>

          <div className="glass-panel-subtle rounded-2xl p-5">
            <h3 className="font-display text-base font-semibold text-white">
              02. Adjustable Hold-to-Confirm Timing
            </h3>
            <p className="mt-1.5 text-slate-400">
              Use the <em>Hold-to-confirm frames</em> slider below the webcam viewport to slow down
              or speed up letter confirmation based on your preferred signing pace. Raise both open
              palms together to insert a space hands-free.
            </p>
          </div>

          <div className="glass-panel-subtle rounded-2xl p-5">
            <h3 className="font-display text-base font-semibold text-white">
              03. Keyboard, Screen Reader & Reduced Motion Support
            </h3>
            <p className="mt-1.5 text-slate-400">
              All navigation links, mode tabs, sliders, and speech buttons support full keyboard
              focus navigation (Tab / Shift+Tab / Enter / Space), semantic ARIA labels, WCAG AA
              contrast ratios, and system <code>prefers-reduced-motion</code> settings.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onNavigate('gesture')}
            className="btn-primary-gradient rounded-xl px-5 py-3 text-sm font-semibold text-white"
          >
            Open Gesture Recognition
          </button>
          <button
            type="button"
            onClick={() => onNavigate('learn')}
            className="rounded-xl border border-white/14 bg-white/[0.05] px-5 py-3 text-sm font-medium text-slate-200 hover:bg-white/[0.1]"
          >
            Explore A–Z Reference
          </button>
        </div>
      </section>
    </div>
  );
}
