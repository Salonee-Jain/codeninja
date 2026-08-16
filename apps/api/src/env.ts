import 'dotenv/config';
import { z } from 'zod';

/**
 * An optional setting that treats `FOO=` in a .env file as "not set" rather than as an invalid
 * empty value — otherwise a commented-out line someone half-uncomments kills the process at boot.
 */
const optional = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), inner.optional());

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16).default('dev-access-secret-change-me-please'),
  JWT_REFRESH_SECRET: z.string().min(16).default('dev-refresh-secret-change-me-please'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  /** Optional remote code executor (Piston-compatible). Leave unset to disable. */
  REMOTE_EXECUTOR_URL: z.string().url().optional(),
  JUDGE_TIMEOUT_MS: z.coerce.number().default(5000),
  // ── AI tutor (optional) ───────────────────────────────────────────────
  // Set exactly one provider key and the tutor turns itself on. Set none and every tutor route
  // answers 503 while the rest of the app is unaffected.
  ANTHROPIC_API_KEY: optional(z.string().min(1)),
  GEMINI_API_KEY: optional(z.string().min(1)),
  OPENAI_API_KEY: optional(z.string().min(1)),
  /** Pins the provider when more than one key is present. Unset = auto-detect. */
  TUTOR_PROVIDER: optional(z.enum(['gemini', 'anthropic', 'openai'])),
  /** Unset = the chosen provider's default model. */
  TUTOR_MODEL: optional(z.string().min(1)),
  TUTOR_MAX_TOKENS: z.coerce.number().default(4000),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('✗ Invalid environment:\n', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
