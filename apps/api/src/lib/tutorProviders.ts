// CodeNinja — the tutor's model layer.
//
// This is the only file that talks to an LLM vendor. Everything else about the tutor — context
// assembly, redaction, the route, the UI — is provider-agnostic, so adding a fourth provider means
// adding a branch here and nothing else.
//
// Which provider runs is decided by which key is present in the environment. TUTOR_PROVIDER pins
// the choice when several keys are set.

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { env } from '../env';

export type TutorProvider = 'gemini' | 'anthropic' | 'openai';

export type TutorConfig = {
  provider: TutorProvider;
  apiKey: string;
  model: string;
};

/**
 * Used when TUTOR_MODEL is unset.
 *
 * Gemini uses the `-latest` alias on purpose: Google retires pinned Flash versions for new API
 * keys (gemini-2.5-flash started returning 404 "no longer available to new users"), and a rolling
 * alias keeps a fresh checkout working. Pin an exact version via TUTOR_MODEL if you need one.
 */
const DEFAULT_MODEL: Record<TutorProvider, string> = {
  gemini: 'gemini-flash-latest',
  anthropic: 'claude-opus-5',
  openai: 'gpt-4o-mini',
};

const KEY: Record<TutorProvider, string | undefined> = {
  gemini: env.GEMINI_API_KEY,
  anthropic: env.ANTHROPIC_API_KEY,
  openai: env.OPENAI_API_KEY,
};

/** Auto-detect order — first key present wins. */
const ORDER: TutorProvider[] = ['gemini', 'anthropic', 'openai'];

/** Returns null when no usable provider is configured, which is what makes the tutor optional. */
export function resolveTutor(): TutorConfig | null {
  const provider = env.TUTOR_PROVIDER ?? ORDER.find((p) => KEY[p]);
  if (!provider) return null;

  const apiKey = KEY[provider];
  if (!apiKey) {
    console.warn(`✗ TUTOR_PROVIDER is "${provider}" but its API key is unset — tutor disabled`);
    return null;
  }

  return { provider, apiKey, model: env.TUTOR_MODEL ?? DEFAULT_MODEL[provider] };
}

export type ModelReply = { text: string; model: string; refused: boolean };

const REFUSAL_TEXT = "I can't help with that one. Try rephrasing, or ask about the lesson you're on.";
const EMPTY_TEXT = 'I did not manage to put an answer together. Try asking again.';

type Prompt = {
  /** Stable instructions — identical for every learner. */
  persona: string;
  /** The page the learner is on, already redacted by lib/tutor.ts. */
  context: string;
  message: string;
};

/** Raised when the provider is reachable but unhappy — the route turns this into a 503. */
export class TutorUnavailableError extends Error {}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

/** Vendors report status differently: a field on the error, or buried in a JSON message. */
function statusOf(err: unknown): number | null {
  const e = err as { status?: unknown; code?: unknown; message?: unknown };
  if (typeof e?.status === 'number') return e.status;
  if (typeof e?.code === 'number') return e.code;
  const match = String(e?.message ?? '').match(/"code":\s*(\d{3})/);
  return match ? Number(match[1]) : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Free tiers rate-limit and Flash models occasionally report "high demand", both of which clear
 * on their own. Retry those twice before giving up.
 */
async function withRetry(fn: () => Promise<ModelReply>): Promise<ModelReply> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      const status = statusOf(err);
      if (status === null || !RETRYABLE.has(status)) break;
      if (attempt < 2) await sleep(400 * 2 ** attempt);
    }
  }
  const status = statusOf(last);
  console.error('✗ tutor provider call failed', status ?? '', (last as Error)?.message);
  throw new TutorUnavailableError(
    status === 429
      ? 'The tutor has hit its rate limit for now. Give it a minute and try again.'
      : 'The tutor is temporarily unavailable. Try again in a moment.',
  );
}

/** Dispatches one question to whichever provider is configured. */
export function callModel(cfg: TutorConfig, prompt: Prompt): Promise<ModelReply> {
  switch (cfg.provider) {
    case 'gemini':
      return withRetry(() => callGemini(cfg, prompt));
    case 'anthropic':
      return withRetry(() => callAnthropic(cfg, prompt));
    case 'openai':
      return withRetry(() => callOpenAI(cfg, prompt));
  }
}

// ── Google Gemini ────────────────────────────────────────────────────────
// Free tier via aistudio.google.com. System instruction is a separate field, not a message.

let gemini: GoogleGenAI | null = null;

async function callGemini(cfg: TutorConfig, prompt: Prompt): Promise<ModelReply> {
  gemini ??= new GoogleGenAI({ apiKey: cfg.apiKey });

  const response = await gemini.models.generateContent({
    model: cfg.model,
    contents: prompt.message,
    config: {
      systemInstruction: `${prompt.persona}\n\n${prompt.context}`,
      maxOutputTokens: env.TUTOR_MAX_TOKENS,
    },
  });

  // A blocked prompt comes back as a normal response with no candidate text.
  const blocked = Boolean(response.promptFeedback?.blockReason);
  const text = response.text?.trim() ?? '';

  if (blocked) return { text: REFUSAL_TEXT, model: cfg.model, refused: true };
  return { text: text || EMPTY_TEXT, model: cfg.model, refused: false };
}

// ── Anthropic ────────────────────────────────────────────────────────────

let anthropic: Anthropic | null = null;

async function callAnthropic(cfg: TutorConfig, prompt: Prompt): Promise<ModelReply> {
  anthropic ??= new Anthropic({ apiKey: cfg.apiKey });

  const response = await anthropic.beta.messages.create({
    model: cfg.model,
    max_tokens: env.TUTOR_MAX_TOKENS,
    // Low effort keeps "what does this error mean" fast; adaptive thinking is on by default on
    // Opus 5, so harder questions still get real reasoning.
    output_config: { effort: 'low' },
    // Re-run a refused request on Anthropic's recommended fallback rather than erroring.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [
      { type: 'text', text: prompt.persona },
      { type: 'text', text: prompt.context },
    ],
    messages: [{ role: 'user', content: prompt.message }],
  });

  // A refusal is a successful HTTP 200 with empty or partial content — check before reading it.
  if (response.stop_reason === 'refusal') {
    return { text: REFUSAL_TEXT, model: response.model, refused: true };
  }

  const text = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  return { text: text || EMPTY_TEXT, model: response.model, refused: false };
}

// ── OpenAI ───────────────────────────────────────────────────────────────

let openai: OpenAI | null = null;

async function callOpenAI(cfg: TutorConfig, prompt: Prompt): Promise<ModelReply> {
  openai ??= new OpenAI({ apiKey: cfg.apiKey });

  const response = await openai.chat.completions.create({
    model: cfg.model,
    max_completion_tokens: env.TUTOR_MAX_TOKENS,
    messages: [
      { role: 'system', content: `${prompt.persona}\n\n${prompt.context}` },
      { role: 'user', content: prompt.message },
    ],
  });

  const choice = response.choices[0];
  if (choice?.finish_reason === 'content_filter') {
    return { text: REFUSAL_TEXT, model: cfg.model, refused: true };
  }

  return { text: choice?.message?.content?.trim() || EMPTY_TEXT, model: cfg.model, refused: false };
}
