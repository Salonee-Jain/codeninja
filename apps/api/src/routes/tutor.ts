import { Router } from 'express';
import { z } from 'zod';
import { HttpError, asyncHandler, requireAuth } from '../middleware';
import { askTutor, resolveTutor, tutorEnabled } from '../lib/tutor';
import { TutorUnavailableError } from '../lib/tutorProviders';

export const tutorRouter = Router();

const disabled = () =>
  new HttpError(503, 'The AI tutor is not configured on this server', 'tutor_disabled');

/** Lets the web app decide whether to render the launcher at all. */
tutorRouter.get('/status', (_req, res) => {
  const cfg = resolveTutor();
  res.json({
    enabled: cfg !== null,
    provider: cfg?.provider ?? null,
    model: cfg?.model ?? null,
  });
});

const askSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  context: z
    .object({
      dayNumber: z.coerce.number().int().min(1).max(30).optional(),
      lessonSlug: z.string().max(200).optional(),
      problemSlug: z.string().max(200).optional(),
    })
    .optional(),
  code: z.string().max(20_000).optional(),
});

tutorRouter.post(
  '/ask',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!tutorEnabled()) throw disabled();
    const { message, context, code } = askSchema.parse(req.body);
    try {
      const { reply, provider, model } = await askTutor({ message, ref: context ?? {}, code });
      res.json({ reply, provider, model });
    } catch (err) {
      // Never leak a vendor's raw error payload to the learner.
      if (err instanceof TutorUnavailableError) {
        throw new HttpError(503, err.message, 'tutor_unavailable');
      }
      throw err;
    }
  }),
);
