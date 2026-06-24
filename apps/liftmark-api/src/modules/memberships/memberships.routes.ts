import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { db } from '../../db/connection';
import { getAuthUser, requireAuth } from '../../middlewares/auth';
import { badRequest, conflict, notFound } from '../../utils/errors';
import { createId } from '../../utils/ids';
import { hashValue } from '../../utils/security';
import { getOrCreateMembership, grantMembership, toMembershipDto } from './membership.service';

const redeemSchema = z.object({
  code: z.string().min(4),
});

export async function registerMembershipRoutes(app: FastifyInstance) {
  app.get('/membership/me', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const membership = await getOrCreateMembership(authUser.id);
    return { membership: toMembershipDto(membership) };
  });

  app.post('/activation-codes/redeem', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const body = redeemSchema.parse(request.body);
    const normalizedCode = body.code.trim().toUpperCase();
    const codeHash = hashValue(normalizedCode);

    return db.transaction(async (trx) => {
      const activationCode = await trx('activation_codes').where({ code_hash: codeHash }).first();
      if (!activationCode) {
        throw notFound('激活码不存在。');
      }
      if (activationCode.disabled_at) {
        throw badRequest('激活码已停用。');
      }
      if (activationCode.redeemed_count >= activationCode.max_redemptions) {
        throw conflict('激活码已被使用。');
      }
      const redeemed = await trx('activation_code_redemptions')
        .where({ activation_code_id: activationCode.id, user_id: authUser.id })
        .first();
      if (redeemed) {
        throw conflict('该账号已兑换过此激活码。');
      }

      await trx('activation_code_redemptions').insert({
        id: createId('redeem'),
        activation_code_id: activationCode.id,
        user_id: authUser.id,
        redeemed_at: new Date(),
      });
      await trx('activation_codes').where({ id: activationCode.id }).update({
        redeemed_count: activationCode.redeemed_count + 1,
        updated_at: new Date(),
      });

      const membership = await grantMembership(
        authUser.id,
        {
          type: activationCode.membership_type,
          source: 'activation_code',
          durationDays: activationCode.duration_days,
          isLifetime: activationCode.is_lifetime,
          proGroupLimit: activationCode.pro_group_limit,
        },
        trx,
      );

      return {
        ok: true,
        membership: toMembershipDto(membership),
      };
    });
  });
}

