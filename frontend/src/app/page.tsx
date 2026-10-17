'use client';

import React, { useEffect, useState } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { LandingNavbar } from '@/components/landing/navbar';
import { HeroSection } from '@/components/landing/hero-section';
import { ProblemSection } from '@/components/landing/problem-section';
import { WorkflowSection } from '@/components/landing/workflow-section';
import { DignityScoreSection } from '@/components/landing/dignity-score-section';
import { AgentDemoSection } from '@/components/landing/agent-demo-section';
import { SecuritySection } from '@/components/landing/security-section';
import { ProductPreviewSection } from '@/components/landing/product-preview-section';

export default function LandingPage() {
  const [user, setUser] = useState<User | null>(null);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#854D27] p-0 sm:p-3 md:p-5 text-[#23170E] selection:bg-[#DC6E26]/20">
      {/* Main Warm Parchment Sheet inside the Chestnut Frame */}
      <div className="min-h-screen bg-[#FAF7F2] sm:rounded-[28px] overflow-hidden shadow-[0_24px_80px_rgba(20,10,4,0.45)] border border-[#6E3D1B]/30 flex flex-col">
        {/* Sticky Pill Navigation */}
        <LandingNavbar user={user} configured={configured} />

        <main className="flex-1">
          {/* 1. Hero & Tactile Dossier Folder */}
          <HeroSection user={user} />

          {/* 2. Split Schematic & 4 Contextual Delivery Visuals */}
          <ProblemSection />

          {/* Pixel-Dithered Transition Band */}
          <div className="heilth-dither-band mt-6" />

          {/* 3. Human-to-Agent Bridge & 7-Stage Pipeline */}
          <WorkflowSection />

          {/* Pixel-Dithered Transition Band */}
          <div className="heilth-dither-band" />

          {/* 4. Signature USP: The Dignity Score Showcase */}
          <DignityScoreSection />

          {/* 5. Interactive 7-Step Agent Simulator */}
          <AgentDemoSection />

          {/* 6. Scoped Integrations & Security Boundaries */}
          <SecuritySection />

          {/* 7. Workspace Governance, Final CTA & Watermark Footer */}
          <ProductPreviewSection user={user} />
        </main>
      </div>
    </div>
  );
}
