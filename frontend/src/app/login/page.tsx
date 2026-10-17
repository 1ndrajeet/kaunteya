'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
<<<<<<< HEAD
import { Compass, AlertCircle, CheckCircle2, ArrowRight, LogOut } from 'lucide-react';
=======
import { Compass, AlertCircle, CheckCircle2, ArrowRight, LogOut, Terminal, ExternalLink } from '@/components/ui/pica-icons';
>>>>>>> 7e3ba8dce8d2eb49edf722158a9ae722e4007d9b
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean>(true);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setAuthError(decodeURIComponent(errorParam));
    }

    const isConf = isSupabaseConfigured();
    setConfigured(isConf);

    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [searchParams]);

  const handleGitHubSignIn = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const supabase = createClient();
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
      const redirectUrl = `${siteUrl}/auth/callback?next=/onboarding`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setAuthError(error.message);
        setLoading(false);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to initialize GitHub sign-in');
      setLoading(false);
    }
  };

  const handleSlackSignIn = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const supabase = createClient();
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const redirectUrl = `${siteUrl}/auth/callback?next=/onboarding`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'slack_oidc',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'openid profile email',
        },
      });
      if (error) {
        setAuthError(error.message);
        setLoading(false);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to initialize Slack sign-in');
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setLoading(false);
  };

  return (
<<<<<<< HEAD
    <div className="min-h-screen bg-[#854D27] p-0 sm:p-3 md:p-5 text-[#23170E] flex flex-col">
      <div className="flex-1 bg-[#FAF7F2] sm:rounded-[28px] border border-[#6E3D1B]/30 shadow-2xl flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden">
        {/* Top Header */}
        <header className="max-w-6xl w-full mx-auto flex items-center justify-between py-2 relative z-10">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-8 w-8 rounded-lg bg-[#EFECE4] border border-[#DFD7C8] flex items-center justify-center text-[#5E9E2E] group-hover:bg-[#5E9E2E] group-hover:text-white transition-colors">
              <Compass className="h-4 w-4" />
=======
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between p-4 sm:p-6">
      {/* Top Header */}
      <header className="max-w-7xl w-full mx-auto flex items-center justify-between py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
            <Compass className="h-4 w-4" />
          </div>
          <span className="font-bold tracking-tight text-base text-zinc-100">TaskPilot</span>
        </Link>
        <Link href="/" className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
          &larr; Back to Home
        </Link>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-md mx-auto my-auto space-y-6">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="h-12 w-12 rounded-xl bg-indigo-600 flex items-center justify-center mx-auto text-white shadow-md">
              <Compass className="h-6 w-6" />
>>>>>>> 7e3ba8dce8d2eb49edf722158a9ae722e4007d9b
            </div>
            <span className="font-serif text-2xl tracking-tight text-[#23170E]">TaskPilot</span>
          </Link>
          <Link
            href="/"
            className="text-xs font-medium px-4 py-1.5 rounded-full bg-[#EFECE6] border border-[#E2DDD2] text-[#59493A] hover:text-[#23170E] transition-colors"
          >
            &larr; Back to Home
          </Link>
        </header>

        {/* Main Container */}
        <main className="w-full max-w-md mx-auto my-auto space-y-6 relative z-10 py-8">
          {/* Decorative Tilted Lime Sticky Note */}
          <div className="hidden sm:block absolute -right-24 -top-2 w-40 p-3 bg-[#D9F99D] text-[#26380F] rounded-xs shadow-md rotate-6 border border-[#BEF264]">
            <p className="font-mono text-[10px] leading-snug font-medium">
              GitHub identity links commits directly to your tasks.
            </p>
          </div>

          <div className="rounded-3xl border border-[#E2DACB] bg-[#F2EFE9] p-6 sm:p-8 shadow-[0_16px_48px_rgba(35,23,14,0.08)] space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-[#C86420]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#DC6E26]" />
                <span>IDENTITY &amp; GOVERNANCE</span>
              </div>
<<<<<<< HEAD
              <h1 className="font-serif text-3xl sm:text-4xl text-[#23170E]">
                {user ? 'Authenticated Session' : 'Sign in to TaskPilot'}
              </h1>
              <p className="text-xs text-[#6E5E4F] max-w-xs mx-auto leading-relaxed">
                {user
                  ? 'You are signed in with GitHub and ready to access your workspace.'
                  : 'Authenticate with your GitHub account to access workspaces and projects.'}
=======
            </div>
          )}

          {/* User state if logged in */}
          {user ? (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-950/70 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Identity:</span>
                  <span className="font-mono text-zinc-200 font-medium">{user.email || user.id.slice(0, 8)}</span>
                </div>
                {user.user_metadata?.user_name && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">GitHub:</span>
                    <span className="font-mono text-indigo-400">@{user.user_metadata.user_name}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-zinc-800/80">
                  <span className="text-emerald-400 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="h-3 w-3" /> Active Session
                  </span>
                  <span className="text-zinc-500 font-mono">Supabase Auth</span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => router.push('/onboarding')}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 text-sm font-medium transition-colors shadow-sm shadow-indigo-600/30"
                >
                  Continue to Workspaces <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 px-4 py-2.5 text-sm font-medium transition-colors"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* GitHub Button */}
              <button
                type="button"
                onClick={handleGitHubSignIn}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-3 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 px-4 py-2.5 text-sm font-semibold transition-all shadow-md hover:scale-[1.01] disabled:opacity-50 disabled:pointer-events-none"
              >
                {/* GitHub Octocat SVG */}
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
                <span>{loading ? 'Connecting...' : 'Sign in with GitHub'}</span>
              </button>

              {/* Slack Button (OIDC Auth Only) */}
              <button
                type="button"
                onClick={handleSlackSignIn}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-700/80 px-4 py-2.5 text-sm font-semibold transition-all shadow-md hover:scale-[1.01] disabled:opacity-50 disabled:pointer-events-none"
              >
                <svg className="h-4 w-4" viewBox="0 0 122.8 122.8">
                  <path d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" fill="#e01e5a" />
                  <path d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" fill="#36c5f0" />
                  <path d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z" fill="#2eb67d" />
                  <path d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" fill="#ecb22e" />
                </svg>
                <span>{loading ? 'Connecting...' : 'Sign in with Slack'}</span>
              </button>

              <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
                By continuing, you authenticate through Supabase Auth using your GitHub or Slack OpenID Connect identity.
>>>>>>> 7e3ba8dce8d2eb49edf722158a9ae722e4007d9b
              </p>
            </div>

            {!configured && (
              <div className="p-3 rounded-xl border border-[#E6CFA6] bg-[#FDF3E1] text-[#6E4409] text-xs">
                Configure <code className="font-mono font-semibold">NEXT_PUBLIC_SUPABASE_URL</code> in{' '}
                <code className="font-mono">.env.local</code> to enable OAuth.
              </div>
            )}

            {/* Error Message */}
            {authError && (
              <div className="p-3.5 rounded-xl border border-[#F4CFC8] bg-[#FCECE9] text-[#882315] text-xs flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-[#B33624] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold">Authentication issue</span>
                  <p className="text-[#882315]/90">{authError}</p>
                </div>
              </div>
            )}

            {/* User state if logged in */}
            {user ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] text-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[#7D6E5D]">Identity:</span>
                    <span className="font-mono text-[#23170E] font-semibold">
                      {user.email || user.id.slice(0, 8)}
                    </span>
                  </div>
                  {user.user_metadata?.user_name && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#7D6E5D]">GitHub:</span>
                      <span className="font-mono text-[#DC6E26] font-semibold">
                        @{user.user_metadata.user_name}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[#E5DEC9]">
                    <span className="text-[#3D751B] flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Active Session
                    </span>
                    <span className="text-[#7D6E5D] font-mono">Supabase Auth</span>
                  </div>
                </div>

                <div className="space-y-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => router.push('/onboarding')}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#DC6E26] hover:bg-[#C45D1B] text-white px-5 py-3 text-xs font-semibold transition-colors shadow-sm"
                  >
                    Continue to Workspaces <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-[#DDD5C7] bg-white hover:bg-[#FAF7F2] text-[#59493A] hover:text-[#23170E] px-5 py-2.5 text-xs font-semibold transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Sign out
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={handleGitHubSignIn}
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-3 rounded-full bg-[#281A11] hover:bg-[#3B281B] text-[#FAF7F2] px-5 py-3 text-xs font-semibold transition-all shadow-sm disabled:opacity-50 disabled:pointer-events-none"
                >
                  {/* GitHub Octocat SVG */}
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    />
                  </svg>
                  <span>{loading ? 'Connecting...' : 'Sign in with GitHub'}</span>
                </button>

                <p className="text-[11px] text-[#7D6E5D] text-center leading-relaxed">
                  By continuing, you authenticate through Supabase Auth using your GitHub OAuth identity.
                </p>
              </div>
            )}
          </div>
        </main>

        {/* Simple Footer */}
        <footer className="text-center text-xs text-[#7D6E5D] py-2 font-mono">
          TaskPilot &bull; Verified Workspace Authentication
        </footer>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center text-[#6E5E4F] font-mono text-xs">
          Loading authentication...
        </div>
      }
    >
      <LoginContent />
    </React.Suspense>
  );
}
