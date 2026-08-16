import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { TopNav } from '@/components/TopNav';
import { TutorChat } from '@/components/TutorChat';

export const metadata: Metadata = {
  title: 'CodeNinja — Full-Stack in 30 Days',
  description:
    'Learn and practise the entire full-stack roadmap — frontend, backend, databases and DevOps — in a 30-day guided track with lessons, an in-browser IDE, quizzes and spaced repetition.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <TopNav />
            <main className="mx-auto min-h-[calc(100vh-3.5rem)] w-full max-w-[1400px] px-4 pb-16 pt-6 sm:px-6">
              {children}
            </main>
            <TutorChat />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
