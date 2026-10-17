'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Compass,
  ArrowRight,
  Menu,
  X,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface LandingNavbarProps {
  user: User | null;
  configured: boolean;
}

const NAV_LINKS = [
  { href: '#workflow', label: 'How It Works' },
  { href: '#dignity-score', label: 'Dignity Score' },
  { href: '#agent-demo', label: 'Agent Demo' },
  { href: '#security', label: 'Integrations & Trust' },
  { href: '#product', label: 'Workspace' },
];

export function LandingNavbar({ user, configured }: LandingNavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <>
      {!configured && (
        <div className="bg-[#FDF3E1] border-b border-[#E6CFA6] px-4 py-2 text-xs text-[#6E4409]">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-[#C87D12]" />
              <span>
                <strong>Setup needed:</strong> Add{' '}
                <code className="bg-[#F3E2C3] px-1.5 py-0.5 rounded font-mono text-[#523104]">
                  NEXT_PUBLIC_SUPABASE_URL
                </code>{' '}
                in <code className="font-mono">.env.local</code> for live auth.
              </span>
            </div>
            <Link
              href="/login"
              className="underline hover:text-[#23170E] font-semibold shrink-0 flex items-center gap-1"
            >
              Setup <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#FAF7F2]/90 border-b border-[#EAE3D5]/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between gap-4">
          {/* Brand Mark */}
          <Link
            href="/"
            className="flex items-center gap-2.5 group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DC6E26] rounded-lg"
          >
            <div className="h-8 w-8 rounded-lg bg-[#EFECE4] border border-[#DFD7C8] flex items-center justify-center text-[#5E9E2E] shadow-xs group-hover:bg-[#5E9E2E] group-hover:text-white transition-colors">
              <Compass className="h-4 w-4" />
            </div>
            <span className="font-serif text-2xl tracking-tight text-[#23170E]">
              TaskPilot
            </span>
          </Link>

          {/* Desktop Centered Rounded-Full Stone Pill Nav */}
          <nav
            aria-label="Primary landing page navigation"
            className="hidden md:flex items-center gap-1 px-2 py-1.5 rounded-full bg-[#EFECE6] border border-[#E2DDD2] text-xs font-medium text-[#57483B] shadow-2xs"
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-3.5 py-1.5 rounded-full hover:bg-[#FAF7F2] hover:text-[#23170E] transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right CTA & Mobile Menu Button */}
          <div className="flex items-center gap-2.5">
            {user ? (
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#5E9E2E] hover:bg-[#4E8724] text-white px-5 py-2 text-xs font-semibold transition-all shadow-sm"
              >
                Workspace <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden sm:inline-block text-xs font-medium text-[#59493A] hover:text-[#23170E] px-3 py-1.5 transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#5E9E2E] hover:bg-[#4E8724] text-white px-5 py-2 text-xs font-semibold transition-all shadow-sm"
                >
                  Get started
                </Link>
              </>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-landing-nav"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="md:hidden inline-flex items-center justify-center h-9 w-9 rounded-full bg-[#EFECE6] border border-[#DFD7C8] text-[#23170E]"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Responsive Mobile Drawer */}
        {mobileMenuOpen && (
          <div
            id="mobile-landing-nav"
            className="md:hidden border-t border-[#EAE3D5] bg-[#FAF7F2] px-4 pt-3 pb-5 space-y-2 shadow-lg"
          >
            <div className="grid grid-cols-2 gap-1.5">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3.5 py-2.5 rounded-xl bg-[#F2EFE9] text-xs font-medium text-[#23170E]"
                >
                  {link.label}
                </a>
              ))}
            </div>
            <div className="pt-2 flex items-center gap-2 border-t border-[#EAE3D5]">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 text-center py-2 rounded-full bg-[#EFECE6] text-xs font-semibold text-[#23170E]"
              >
                Sign in
              </Link>
              <Link
                href={user ? '/onboarding' : '/login'}
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 text-center py-2 rounded-full bg-[#DC6E26] text-white text-xs font-semibold"
              >
                {user ? 'Workspace' : 'Get started'}
              </Link>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
