import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { db } from '../../db/connection';
import { createId } from '../../utils/ids';
import { verifyAccessToken } from '../../utils/tokens';

const feedbackSchema = z.object({
  type: z.string().min(1).max(40).optional(),
  contact: z.string().max(120).optional(),
  content: z.string().min(1).max(2000),
});

function optionalUserId(authorization?: string) {
  if (!authorization?.startsWith('Bearer ')) return null;
  try {
    return verifyAccessToken(authorization.slice('Bearer '.length)).sub;
  } catch {
    return null;
  }
}

export async function registerFeedbackRoutes(app: FastifyInstance) {
  app.post('/feedback', async (request) => {
    const body = feedbackSchema.parse(request.body);
    const now = new Date();
    const id = createId('fb');

    await db('feedback').insert({
      id,
      user_id: optionalUserId(request.headers.authorization),
      contact: body.contact ?? null,
      type: body.type ?? 'feedback',
      content: body.content,
      status: 'open',
      created_at: now,
      updated_at: now,
    });

    return { ok: true, id };
  });
}

