import React from 'react';
import Link from 'next/link';
import { Compass, ArrowLeft, Layers } from '@/components/ui/pica-icons';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center antialiased">
      <div className="w-full max-w-md p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl space-y-6">
        <div className="h-14 w-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-sm">
          <Compass className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <span className="font-mono text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-semibold">
            404 Error
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Page Not Found
          </h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-sm mx-auto">
            The resource, project, or workspace page you requested does not exist or you may not have authorization to view it.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Return Home
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors"
          >
            <Layers className="h-4 w-4" /> Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
