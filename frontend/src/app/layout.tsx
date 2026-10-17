import type { Metadata } from 'next';
import './globals.css';
import { Instrument_Serif, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import { cn } from '@/lib/utils';

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  weight: ['400', '500', '600', '700'],
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-editorial-serif',
  weight: '400',
  style: ['normal', 'italic'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'TaskPilot — AI-Assisted Project Management & Contribution Intelligence',
  description:
    'TaskPilot connects Slack updates, project tasks, verifiable GitHub evidence, and human oversight into one explainable workflow powered by the Dignity Score.',
  openGraph: {
    title: 'TaskPilot — Evidence-Backed Project Management & Dignity Score',
    description:
      'Every contribution deserves evidence. Every evaluation deserves context. Connect Slack coordination, task state, GitHub commits, and human review.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        'min-h-full',
        jakartaSans.variable,
        instrumentSerif.variable,
        jetbrainsMono.variable
      )}
    >
      <body className="bg-[#FAF7F2] text-[#281A11] selection:bg-[#E07A2E]/20 selection:text-[#281A11] min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  );
}

