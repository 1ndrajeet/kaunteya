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

import { ThemeProvider } from '@/features/theme/theme-context';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
<<<<<<< HEAD
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
=======
    <html lang="en" className={cn('dark min-h-full', geistSans.variable, geistMono.variable)} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('taskpilot-theme');
                if (theme === 'light') {
                  document.documentElement.classList.remove('dark');
                } else {
                  document.documentElement.classList.add('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="bg-background text-foreground selection:bg-indigo-500/20 min-h-screen font-sans antialiased">
        <ThemeProvider>
          {children}
        </ThemeProvider>
>>>>>>> 7e3ba8dce8d2eb49edf722158a9ae722e4007d9b
      </body>
    </html>
  );
}

