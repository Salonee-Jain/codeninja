'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { Markdown } from './Markdown';
import { askTutor, refFromPathname, tutorStatus } from '@/lib/tutor';

type Turn = { role: 'user' | 'sensei'; text: string };

/**
 * The floating "Ask Sensei" panel. Renders nothing at all when the learner is signed out or the
 * API reports the tutor is disabled — the feature is optional and must never break the app.
 */
export function TutorChat() {
  const { user } = useAuth();
  const pathname = usePathname();

  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      setEnabled(false);
      return;
    }
    let live = true;
    tutorStatus()
      .then((s) => live && setEnabled(s.enabled))
      .catch(() => live && setEnabled(false));
    return () => {
      live = false;
    };
  }, [user]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, open]);

  if (!user || !enabled) return null;

  async function send() {
    const message = draft.trim();
    if (!message || busy) return;
    setDraft('');
    setError(null);
    setTurns((t) => [...t, { role: 'user', text: message }]);
    setBusy(true);
    try {
      const { reply } = await askTutor({ message, context: refFromPathname(pathname) });
      setTurns((t) => [...t, { role: 'sensei', text: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary fixed bottom-5 right-5 z-40 rounded-full shadow-lg"
        aria-label="Ask Sensei"
      >
        Ask Sensei
      </button>
    );
  }

  return (
    <div className="card fixed bottom-5 right-5 z-40 flex h-[min(32rem,calc(100vh-6rem))] w-[min(24rem,calc(100vw-2.5rem))] animate-fade-up flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 dark:border-ink-700">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Ask Sensei</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Hints and explanations — never the full answer
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white"
          aria-label="Close"
        >
          ✕
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {turns.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Stuck on something? Ask about the lesson or exercise you have open.
          </p>
        )}
        {turns.map((turn, i) =>
          turn.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] rounded-lg bg-blade px-3 py-2 text-sm text-white">{turn.text}</p>
            </div>
          ) : (
            <div key={i} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-ink-850">
              <Markdown className="text-sm">{turn.text}</Markdown>
            </div>
          ),
        )}
        {busy && <p className="text-sm text-slate-500 dark:text-slate-400">Sensei is thinking…</p>}
        {error && <p className="text-sm text-rose-500">{error}</p>}
        <div ref={endRef} />
      </div>

      <div className="flex items-end gap-2 border-t border-slate-200 p-3 dark:border-ink-700">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          placeholder="Ask a question…"
          className="input resize-none"
        />
        <button type="button" onClick={() => void send()} disabled={busy || !draft.trim()} className="btn-primary">
          Send
        </button>
      </div>
    </div>
  );
}
