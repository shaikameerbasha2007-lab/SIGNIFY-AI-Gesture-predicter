import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { motion } from 'motion/react';
import type { PageId } from '../types';

interface NavbarProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
}

const NAV_ITEMS: { id: PageId; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'gesture', label: 'Gesture AI' },
  { id: 'animal', label: 'Animal AI' },
  { id: 'learn', label: 'Learn ASL' },
  { id: 'about', label: 'About' },
];

export function Navbar({ activePage, onNavigate }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSelect = (page: PageId) => {
    onNavigate(page);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-white/[0.08] bg-[#040711]/82 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleSelect('home')}
          className="group flex shrink-0 items-center gap-2.5 whitespace-nowrap text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-400"
          aria-label="SIGNIFY AI Home"
        >
          <motion.svg
            width="28"
            height="28"
            viewBox="0 0 32 32"
            fill="none"
            className="shrink-0"
            whileHover={{ scale: 1.06 }}
            transition={{ duration: 0.18 }}
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="signify-logo-grad" x1="0" y1="0" x2="32" y2="32">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="55%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
            <rect
              x="1.5"
              y="1.5"
              width="29"
              height="29"
              rx="8"
              stroke="url(#signify-logo-grad)"
              strokeWidth="1.6"
              fill="rgba(14, 23, 46, 0.9)"
            />
            {/* Minimal geometric hand-node landmark motif */}
            <path
              d="M16 24V12M16 18L10.5 13.5M16 17L21.5 11.5M16 24L12.5 21.5"
              stroke="url(#signify-logo-grad)"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
            <circle cx="16" cy="9.5" r="2.1" fill="#38bdf8" />
            <circle cx="9.8" cy="12.8" r="1.8" fill="#60a5fa" />
            <circle cx="22.2" cy="10.8" r="1.8" fill="#a78bfa" />
            <circle cx="16" cy="24" r="2" fill="#e0f2fe" />
          </motion.svg>
          <span className="font-display text-lg font-bold tracking-tight text-white">
            SIGNIFY <span className="text-cyan-400">AI</span>
          </span>
        </button>

        {/* Zone 2: 5 Single-Line Navigation Links */}
        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative whitespace-nowrap shrink-0 py-1 text-sm font-medium transition-colors duration-150 ${
                  isActive ? 'text-white' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {item.label}
                {isActive && (
                  <motion.span
                    layoutId="nav-active-underline"
                    className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-violet-500"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action + Mobile Menu Trigger */}
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => handleSelect('gesture')}
            className="btn-primary-gradient hidden whitespace-nowrap shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-white sm:inline-flex items-center justify-center"
          >
            Start Signing
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] md:hidden"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Panel */}
      {mobileOpen && (
        <nav
          aria-label="Mobile navigation"
          className="border-b border-white/10 bg-[#070d1d]/95 px-4 py-4 backdrop-blur-xl md:hidden"
        >
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex w-full items-center justify-between rounded-lg px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-200'
                      : 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  <span>{item.label}</span>
                  {isActive && <span className="text-xs text-cyan-400">Active</span>}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => handleSelect('gesture')}
              className="btn-primary-gradient mt-2 w-full rounded-lg px-4 py-2.5 text-center text-sm font-semibold text-white"
            >
              Start Signing
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
