import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AboutPage } from './components/AboutPage';
import { AnimalDashboard } from './components/AnimalDashboard';
import { GestureDashboard } from './components/GestureDashboard';
import { LandingPage } from './components/LandingPage';
import { LearnASLPage } from './components/LearnASLPage';
import { Navbar } from './components/Navbar';
import type { PageId } from './types';

function resolveInitialPage(): PageId {
  if (typeof window === 'undefined') return 'home';
  const params = new URLSearchParams(window.location.search);
  if (params.get('autostart') === '1') return 'gesture';
  const page = params.get('page');
  if (page === 'gesture' || page === 'animal' || page === 'learn' || page === 'about') {
    return page;
  }
  return 'home';
}

export default function App() {
  const [activePage, setActivePage] = useState<PageId>(resolveInitialPage);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [activePage]);

  return (
    <div className="ambient-grid flex min-h-screen flex-col bg-[#040711] text-slate-100">
      <Navbar activePage={activePage} onNavigate={setActivePage} />

      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={activePage}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {activePage === 'home' && <LandingPage onNavigate={setActivePage} />}
            {activePage === 'gesture' && <GestureDashboard />}
            {activePage === 'animal' && <AnimalDashboard />}
            {activePage === 'learn' && <LearnASLPage />}
            {activePage === 'about' && <AboutPage onNavigate={setActivePage} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="border-t border-white/[0.08] bg-[#040711]/90 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-xs text-slate-400 sm:flex-row sm:px-6 lg:px-8">
          <p className="font-medium text-slate-300">
            SIGNIFY AI · Breaking Communication Barriers
          </p>
          <div className="flex flex-wrap items-center gap-6">
            <button
              type="button"
              onClick={() => setActivePage('gesture')}
              className="transition-colors hover:text-white"
            >
              Gesture AI
            </button>
            <button
              type="button"
              onClick={() => setActivePage('animal')}
              className="transition-colors hover:text-white"
            >
              Animal AI
            </button>
            <button
              type="button"
              onClick={() => setActivePage('learn')}
              className="transition-colors hover:text-white"
            >
              Learn ASL
            </button>
            <button
              type="button"
              onClick={() => setActivePage('about')}
              className="transition-colors hover:text-white"
            >
              Accessibility
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
