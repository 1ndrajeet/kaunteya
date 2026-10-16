import type { Metadata } from 'next';
import './globals.css';
import { Geist, Geist_Mono } from 'next/font/google';
import { cn } from '@/lib/utils';

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'TaskPilot — AI-Assisted Project Management & Contribution Intelligence',
  description:
    'Coordinate work between administrators, team leads, members, and autonomous agents with high-fidelity task routing and verified accountability.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn('dark min-h-full', geistSans.variable, geistMono.variable)}>
      <body className="bg-background text-foreground selection:bg-indigo-500/20 min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
