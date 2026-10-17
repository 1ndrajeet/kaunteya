import React from 'react';
import Link from 'next/link';
import { Compass, ArrowLeft, Layers } from '@/components/ui/pica-icons';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#23170E] flex flex-col items-center justify-center p-6 text-center antialiased">
      <div className="w-full max-w-md p-8 rounded-2xl border border-[#E3DAC8] bg-[#FAF7F2] shadow-sm space-y-6">
        <div className="h-14 w-14 rounded-2xl bg-[#FCF3E3] border border-[#F1DCBA] text-[#DC6E26] flex items-center justify-center mx-auto shadow-xs">
          <Compass className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <span className="font-mono text-xs uppercase tracking-wider text-[#DC6E26] font-semibold">
            404 Error
          </span>
          <h1 className="text-2xl font-serif font-bold tracking-tight text-[#23170E]">
            Page Not Found
          </h1>
          <p className="text-xs text-[#6E5D4E] leading-relaxed max-w-sm mx-auto">
            The resource, project, or workspace page you requested does not exist or you may not have authorization to view it.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#DC6E26] hover:bg-[#C05617] text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Return Home
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full border border-[#E3DAC8] bg-[#F2ECE1] hover:bg-[#EFE9DF] text-[#23170E] text-xs font-medium transition-colors"
          >
            <Layers className="h-4 w-4" /> Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
