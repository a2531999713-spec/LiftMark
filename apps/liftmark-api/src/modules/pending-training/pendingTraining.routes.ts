import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { db } from '../../db/connection';
import { getAuthUser, requireAuth } from '../../middlewares/auth';
import { badRequest, forbidden, notFound } from '../../utils/errors';
import { createId } from '../../utils/ids';

export async function registerPendingTrainingRoutes(app: FastifyInstance) {
  // 获取当前用户的待确认数据
  app.get('/pending-training', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);

    const pendingItems = await db('pending_training_data')
      .join('groups', 'pending_training_data.group_id', 'groups.id')
      .join('users as uploader', 'pending_training_data.uploader_user_id', 'uploader.id')
      .where('pending_training_data.target_user_id', authUser.id)
      .where('pending_training_data.status', 'pending')
      .select(
        'pending_training_data.id',
        'pending_training_data.group_id',
        'groups.name as group_name',
        'pending_training_data.uploader_user_id',
        'uploader.nickname as uploader_nickname',
        'uploader.avatar_url as uploader_avatar_url',
        'pending_training_data.session_data',
        'pending_training_data.sets_data',
        'pending_training_data.uploaded_at'
      )
      .orderBy('pending_training_data.uploaded_at', 'desc');

    return {
      pendingItems: pendingItems.map(item => ({
        id: item.id,
        groupId: item.group_id,
        groupName: item.group_name,
        uploader: {
          userId: item.uploader_user_id,
          nickname: item.uploader_nickname,
          avatarUrl: item.uploader_avatar_url,
        },
        sessionData: item.session_data,
        setsData: item.sets_data,
        uploadedAt: item.uploaded_at,
      })),
    };
  });

  // 上传训练数据到指定用户
  app.post('/pending-training/upload', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const body = z.object({
      groupId: z.string(),
      targetUserId: z.string(),
      sessionData: z.object({
        title: z.string().optional(),
        date: z.string(),
        week: z.number().int().optional(),
        weekday: z.number().int().optional(),
        status: z.string().optional().default('completed'),
      }),
      setsData: z.array(z.object({
        exerciseId: z.string(),
        exerciseClientId: z.string().optional(),
        setNumber: z.number().int(),
        weight: z.number().optional(),
        reps: z.number().int().optional(),
        completed: z.boolean().optional().default(true),
        skipped: z.boolean().optional().default(false),
        rpe: z.number().optional(),
        notes: z.string().optional(),
      })),
    }).parse(request.body);

    // 验证发送者是小组成员
    const senderMember = await db('group_members')
      .where({ group_id: body.groupId, user_id: authUser.id, status: 'active' })
      .whereNull('left_at')
      .first();
    if (!senderMember) throw forbidden('你不在该小组中。');

    // 验证接收者也是小组成员
    const targetMember = await db('group_members')
      .where({ group_id: body.groupId, user_id: body.targetUserId, status: 'active' })
      .whereNull('left_at')
      .first();
    if (!targetMember) throw badRequest('目标用户不是该小组成员。');

    // 不能给自己上传待确认数据
    if (body.targetUserId === authUser.id) {
      throw badRequest('不能给自己上传待确认数据，请直接同步训练记录。');
    }

    const pendingData = {
      id: createId('ptrain'),
      group_id: body.groupId,
      uploader_user_id: authUser.id,
      target_user_id: body.targetUserId,
      session_data: body.sessionData,
      sets_data: body.setsData,
      status: 'pending',
      uploaded_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    };

    await db('pending_training_data').insert(pendingData);

    return {
      ok: true,
      pendingId: pendingData.id,
    };
  });

  // 确认接受数据
  app.post('/pending-training/:id/accept', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const params = z.object({ id: z.string() }).parse(request.params);

    const pendingItem = await db('pending_training_data')
      .where({ id: params.id, target_user_id: authUser.id, status: 'pending' })
      .first();
    if (!pendingItem) throw notFound('待确认数据不存在或已处理。');

    // 创建训练会话
    const sessionId = createId('ws');
    const sessionData = pendingItem.session_data as any;
    const setsData = pendingItem.sets_data as any[];

    await db.transaction(async (trx) => {
      // 插入训练会话
      await trx('workout_sessions').insert({
        id: sessionId,
        user_id: authUser.id,
        group_id: pendingItem.group_id,
        client_id: `pending_${pendingItem.id}`,
        title: sessionData.title || '组员上传的训练',
        status: sessionData.status || 'completed',
        client_updated_at: new Date(),
        sync_version: 1,
        payload: sessionData,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // 插入训练组
      for (const setData of setsData) {
        const exerciseRecordId = createId('wer');
        await trx('workout_exercise_records').insert({
          id: exerciseRecordId,
          session_id: sessionId,
          exercise_id: setData.exerciseId,
          exercise_client_id: setData.exerciseClientId || setData.exerciseId,
          order_index: setData.setNumber,
          planned_rest_seconds: 90,
          created_at: new Date(),
          updated_at: new Date(),
        });

        await trx('workout_sets').insert({
          id: createId('wset'),
          user_id: authUser.id,
          group_id: pendingItem.group_id,
          client_id: `pending_set_${pendingItem.id}_${setData.setNumber}`,
          exercise_record_id: exerciseRecordId,
          set_number: setData.setNumber,
          planned_weight: setData.weight,
          planned_reps: setData.reps,
          actual_weight: setData.completed ? setData.weight : null,
          actual_reps: setData.completed ? setData.reps : null,
          completed: setData.completed ?? true,
          skipped: setData.skipped ?? false,
          rpe: setData.rpe,
          notes: setData.notes,
          sync_version: 1,
          payload: setData,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }

      // 更新状态
      await trx('pending_training_data')
        .where({ id: params.id })
        .update({
          status: 'accepted',
          responded_at: new Date(),
          updated_at: new Date(),
        });
    });

    return { ok: true, sessionId };
  });

  // 拒绝数据
  app.delete('/pending-training/:id', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const params = z.object({ id: z.string() }).parse(request.params);

    const pendingItem = await db('pending_training_data')
      .where({ id: params.id, target_user_id: authUser.id, status: 'pending' })
      .first();
    if (!pendingItem) throw notFound('待确认数据不存在或已处理。');

    await db('pending_training_data')
      .where({ id: params.id })
      .update({
        status: 'rejected',
        responded_at: new Date(),
        updated_at: new Date(),
      });

    return { ok: true };
  });

  // 获取上传者的数据状态
  app.get('/pending-training/uploaded', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);

    const uploadedItems = await db('pending_training_data')
      .join('users as target', 'pending_training_data.target_user_id', 'target.id')
      .where('pending_training_data.uploader_user_id', authUser.id)
      .select(
        'pending_training_data.id',
        'pending_training_data.target_user_id',
        'target.nickname as target_nickname',
        'target.avatar_url as target_avatar_url',
        'pending_training_data.status',
        'pending_training_data.uploaded_at',
        'pending_training_data.responded_at'
      )
      .orderBy('pending_training_data.uploaded_at', 'desc');

    return {
      uploadedItems: uploadedItems.map(item => ({
        id: item.id,
        targetUser: {
          userId: item.target_user_id,
          nickname: item.target_nickname,
          avatarUrl: item.target_avatar_url,
        },
        status: item.status,
        uploadedAt: item.uploaded_at,
        respondedAt: item.responded_at,
      })),
    };
  });
}
