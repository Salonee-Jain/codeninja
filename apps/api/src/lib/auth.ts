import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../env';
import { prisma } from '../prisma';

export interface AccessPayload {
  sub: string;
  email: string;
  role: 'LEARNER' | 'ADMIN';
}

export const hashPassword = (plain: string) => bcrypt.hash(plain, 12);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export function signAccessToken(payload: AccessPayload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
}

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

/** Refresh tokens are opaque random strings; only their hash is stored. */
export async function issueRefreshToken(userId: string) {
  const token = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  await prisma.refreshToken.create({
    data: { userId, tokenHash: sha256(token), expiresAt },
  });
  return { token, expiresAt };
}

/** Rotating consume: the presented token is revoked and a fresh one returned. */
export async function rotateRefreshToken(token: string) {
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!record || record.revokedAt || record.expiresAt < new Date()) return null;

  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });
  const next = await issueRefreshToken(record.userId);
  return { user: record.user, ...next };
}

export async function revokeRefreshToken(token: string) {
  await prisma.refreshToken
    .updateMany({
      where: { tokenHash: sha256(token), revokedAt: null },
      data: { revokedAt: new Date() },
    })
    .catch(() => undefined);
}
