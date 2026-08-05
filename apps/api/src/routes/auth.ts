import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { env, isProd } from '../env';
import { prisma } from '../prisma';
import {
  hashPassword,
  issueRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
  verifyPassword,
} from '../lib/auth';
import { levelFor } from '../lib/gamify';
import { asyncHandler, badRequest, requireAuth, unauthorized } from '../middleware';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many attempts, try again shortly.' } },
});

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const registerBody = credentials.extend({
  name: z.string().min(1).max(60),
  timezone: z.string().default('UTC'),
});

const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: isProd,
  path: '/',
};

function publicUser(u: {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  xp: number;
  streak: number;
  longestStreak: number;
  dailyGoalMinutes: number;
}) {
  return { ...u, ...levelFor(u.xp) };
}

authRouter.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password, name, timezone } = registerBody.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) throw badRequest('That email is already registered');

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        timezone,
        passwordHash: await hashPassword(password),
      },
    });

    // Auto-enrol in the flagship track.
    const track = await prisma.track.findUnique({ where: { slug: 'full-stack-30' } });
    if (track) {
      await prisma.enrollment.create({
        data: {
          userId: user.id,
          trackId: track.id,
          targetEndAt: new Date(Date.now() + 30 * 86_400_000),
        },
      });
    }

    const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
    const { token: refreshToken, expiresAt } = await issueRefreshToken(user.id);
    res.cookie('refresh_token', refreshToken, { ...cookieOpts, expires: expiresAt });

    res.status(201).json({ accessToken, refreshToken, user: publicUser(user) });
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = credentials.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw unauthorized('Email or password is incorrect');
    }
    const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
    const { token: refreshToken, expiresAt } = await issueRefreshToken(user.id);
    res.cookie('refresh_token', refreshToken, { ...cookieOpts, expires: expiresAt });
    res.json({ accessToken, refreshToken, user: publicUser(user) });
  }),
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.body?.refreshToken ?? req.cookies?.refresh_token;
    if (!token) throw unauthorized('No refresh token');
    const rotated = await rotateRefreshToken(token);
    if (!rotated) throw unauthorized('Refresh token is invalid or expired');

    const accessToken = signAccessToken({
      sub: rotated.user.id,
      email: rotated.user.email,
      role: rotated.user.role,
    });
    res.cookie('refresh_token', rotated.token, { ...cookieOpts, expires: rotated.expiresAt });
    res.json({ accessToken, refreshToken: rotated.token, user: publicUser(rotated.user) });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = req.body?.refreshToken ?? req.cookies?.refresh_token;
    if (token) await revokeRefreshToken(token);
    res.clearCookie('refresh_token', cookieOpts);
    res.status(204).end();
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.sub } });
    res.json({ user: publicUser(user) });
  }),
);

authRouter.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1).max(60).optional(),
        dailyGoalMinutes: z.number().int().min(15).max(720).optional(),
        timezone: z.string().optional(),
        avatarUrl: z.string().url().nullable().optional(),
      })
      .parse(req.body);
    const user = await prisma.user.update({ where: { id: req.user!.sub }, data: body });
    res.json({ user: publicUser(user) });
  }),
);

// Convenience for local development / demos.
authRouter.post(
  '/demo',
  asyncHandler(async (_req, res) => {
    const user = await prisma.user.findUnique({ where: { email: 'demo@codeninja.dev' } });
    if (!user) throw badRequest('Demo user not seeded. Run `npm run db:seed`.');
    const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
    const { token: refreshToken, expiresAt } = await issueRefreshToken(user.id);
    res.cookie('refresh_token', refreshToken, { ...cookieOpts, expires: expiresAt });
    res.json({ accessToken, refreshToken, user: publicUser(user) });
  }),
);

export const _env = env; // keeps env import used in builds without side effects
