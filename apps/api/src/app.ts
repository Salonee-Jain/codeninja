import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isProd } from './env';
import { authRouter } from './routes/auth';
import { trackRouter } from './routes/track';
import { learnRouter } from './routes/learn';
import { errorHandler, notFound } from './middleware';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  if (!isProd) app.use(morgan('dev'));

  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.get('/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

  app.use('/api/auth', authRouter);
  app.use('/api/tracks', trackRouter);
  app.use('/api/learn', learnRouter);

  app.use((_req, _res, next) => next(notFound('No such endpoint')));
  app.use(errorHandler);

  return app;
}
