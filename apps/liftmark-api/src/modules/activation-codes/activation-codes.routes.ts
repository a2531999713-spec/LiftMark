import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { db } from '../../db/connection';
import { getAuthUser, requireAuth } from '../../middlewares/auth';
import { unauthorized } from '../../utils/errors';
import { createId } from '../../utils/ids';
import { hashValue } from '../../utils/security';

const createCodeSchema = z.object({
  count: z.number().min(1).max(100).default(10),
  durationDays: z.number().min(1).max(3650).optional(),
  isLifetime: z.boolean().default(false),
  membershipType: z.enum(['pro', 'lifetime']).default('pro'),
  proGroupLimit: z.number().min(1).max(10).default(2),
});

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segment = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `LM-${segment()}-${segment()}-${segment()}`;
}

export async function registerActivationCodeRoutes(app: FastifyInstance) {
  // 创建激活码（管理员）
  app.post('/activation-codes', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    if (authUser.role !== 'admin') {
      throw unauthorized('需要管理员权限。');
    }

    const body = createCodeSchema.parse(request.body);
    const codes: Array<{ code: string; id: string }> = [];

    await db.transaction(async (trx) => {
      for (let i = 0; i < body.count; i++) {
        const code = generateCode();
        const codeHash = hashValue(code);
        const id = createId('ac');

        await trx('activation_codes').insert({
          id,
          code_hash: codeHash,
          code_prefix: code.slice(0, 7),
          membership_type: body.membershipType,
          duration_days: body.isLifetime ? null : (body.durationDays ?? 365),
          is_lifetime: body.isLifetime,
          pro_group_limit: body.proGroupLimit,
          max_redemptions: 1,
          redeemed_count: 0,
          created_by_user_id: authUser.id,
          created_at: new Date(),
          updated_at: new Date(),
        });

        codes.push({ code, id });
      }
    });

    return {
      ok: true,
      codes: codes.map((c) => c.code),
      count: codes.length,
    };
  });

  // 查询激活码列表（管理员）
  app.get('/activation-codes', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    if (authUser.role !== 'admin') {
      throw unauthorized('需要管理员权限。');
    }

    const codes = await db('activation_codes')
      .select(
        'id',
        'code_prefix',
        'membership_type',
        'duration_days',
        'is_lifetime',
        'pro_group_limit',
        'max_redemptions',
        'redeemed_count',
        'created_at',
      )
      .orderBy('created_at', 'desc')
      .limit(100);

    return { codes };
  });
}
