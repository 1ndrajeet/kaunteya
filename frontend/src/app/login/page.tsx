'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Compass, AlertCircle, CheckCircle2, ArrowRight, LogOut, Terminal, ExternalLink } from 'lucide-react';
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
      const redirectUrl = `${window.location.origin}/auth/callback?next=/onboarding`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: redirectUrl,
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

  const handleSignOut = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setLoading(false);
  };

  return (
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
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center mx-auto text-white shadow-lg shadow-indigo-500/20">
              <Compass className="h-6 w-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
              {user ? 'Authenticated Session' : 'Sign in to TaskPilot'}
            </h1>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto">
              {user
                ? 'You are signed in with GitHub and ready to access your workspace.'
                : 'Authenticate with your GitHub account to access workspaces and projects.'}
            </p>
          </div>

          {/* Error Message */}
          {authError && (
            <div className="p-3 rounded-lg border border-rose-900/50 bg-rose-950/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold">Authentication issue</span>
                <p className="text-rose-300/80">{authError}</p>
              </div>
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

              <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
                By continuing, you authenticate through Supabase Auth using your GitHub OAuth identity.
              </p>
            </div>
          )}
        </div>


      </main>

      {/* Simple Footer */}
      <footer className="text-center text-xs text-zinc-600 py-4">
        TaskPilot &bull; Phase 1 Authentication
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-500 font-mono text-xs">
          Loading authentication...
        </div>
      }
    >
      <LoginContent />
    </React.Suspense>
  );
}
