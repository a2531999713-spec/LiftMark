import type { Knex } from 'knex';

import { env, isProduction } from '../../config/env';
import { db } from '../../db/connection';
import { badRequest, conflict } from '../../utils/errors';
import { createId, createMockCode } from '../../utils/ids';
import { hashValue } from '../../utils/security';

export type SmsPurpose = 'login' | 'register' | 'reset_password';

type SendCodeResult = {
  bizId?: string;
  debugCode?: string;
  outId?: string;
  provider: string;
};

function assertPurpose(purpose: string): asserts purpose is SmsPurpose {
  if (!['login', 'register', 'reset_password'].includes(purpose)) {
    throw badRequest('验证码用途不正确。');
  }
}

function normalizePhone(phone: string) {
  const normalized = phone.trim();
  if (!/^1\d{10}$/.test(normalized)) {
    throw badRequest('手机号格式不正确。');
  }
  return normalized;
}

async function checkRateLimit(phone: string, ipAddress?: string) {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);

  const recent = await db('sms_verification_logs')
    .where({ phone })
    .where('sent_at', '>=', oneMinuteAgo)
    .first();
  if (recent) {
    throw conflict('同一手机号 60 秒内不能重复发送验证码。');
  }

  const phoneDaily = await db('sms_verification_logs')
    .where({ phone })
    .where('created_at', '>=', dayStart)
    .count<{ count: string }[]>({ count: '*' });
  if (Number(phoneDaily[0]?.count ?? 0) >= 10) {
    throw conflict('同一手机号今天发送验证码次数已达上限。');
  }

  if (ipAddress) {
    const ipDaily = await db('sms_verification_logs')
      .where({ ip_address: ipAddress })
      .where('created_at', '>=', dayStart)
      .count<{ count: string }[]>({ count: '*' });
    if (Number(ipDaily[0]?.count ?? 0) >= 100) {
      throw conflict('当前网络今天发送验证码次数已达上限。');
    }
  }
}

async function createDypnsClient() {
  if (!env.aliyunAccessKeyId || !env.aliyunAccessKeySecret || !env.aliyunDypnsSignName || !env.aliyunDypnsTemplateCode) {
    throw badRequest('阿里云短信环境变量未配置完整。');
  }

  const Dypns = (await import('@alicloud/dypnsapi20170525')) as any;
  const OpenApi = (await import('@alicloud/openapi-client')) as any;
  const ClientCtor = Dypns.default ?? Dypns;
  const config = new OpenApi.Config({
    accessKeyId: env.aliyunAccessKeyId,
    accessKeySecret: env.aliyunAccessKeySecret,
  });
  config.endpoint = env.aliyunDypnsEndpoint;
  return { client: new ClientCtor(config), Dypns };
}

async function sendWithAliyun(phone: string): Promise<SendCodeResult> {
  const Util = (await import('@alicloud/tea-util')) as any;
  const { client, Dypns } = await createDypnsClient();
  const request = new Dypns.SendSmsVerifyCodeRequest({
    countryCode: '86',
    phoneNumber: phone,
    signName: env.aliyunDypnsSignName,
    templateCode: env.aliyunDypnsTemplateCode,
    templateParam: JSON.stringify({ code: '##code##', min: '5' }),
  });
  const runtime = new Util.RuntimeOptions({});
  const resp = await client.sendSmsVerifyCodeWithOptions(request, runtime);
  return {
    provider: 'dypns',
    outId: resp?.body?.requestId,
    bizId: resp?.body?.model?.bizId,
  };
}

async function verifyWithAliyun(phone: string, code: string) {
  const Util = (await import('@alicloud/tea-util')) as any;
  const { client, Dypns } = await createDypnsClient();
  const request = new Dypns.CheckSmsVerifyCodeRequest({
    countryCode: '86',
    phoneNumber: phone,
    verifyCode: code,
  });
  const runtime = new Util.RuntimeOptions({});
  const resp = await client.checkSmsVerifyCodeWithOptions(request, runtime);
  return resp?.body?.model?.verifyResult === 'PASS';
}

export async function sendSmsCode(input: {
  ipAddress?: string;
  phone: string;
  purpose: string;
}) {
  assertPurpose(input.purpose);
  const phone = normalizePhone(input.phone);
  await checkRateLimit(phone, input.ipAddress);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
  let result: SendCodeResult;
  let debugCodeHash: string | undefined;

  if (env.smsProvider === 'mock') {
    const debugCode = createMockCode();
    debugCodeHash = hashValue(debugCode);
    result = {
      provider: 'mock',
      debugCode: isProduction() ? undefined : debugCode,
    };
  } else if (env.smsProvider === 'dypns') {
    result = await sendWithAliyun(phone);
  } else {
    throw badRequest('短信 provider 配置不正确。');
  }

  await db('sms_verification_logs').insert({
    id: createId('sms'),
    phone,
    purpose: input.purpose,
    provider: result.provider,
    out_id: result.outId ?? null,
    biz_id: result.bizId ?? null,
    sent_at: now,
    status: 'sent',
    ip_address: input.ipAddress ?? null,
    debug_code_hash: debugCodeHash ?? null,
    expires_at: expiresAt,
    created_at: now,
  });

  return {
    ok: true,
    provider: result.provider,
    debugCode: result.debugCode,
  };
}

export async function verifySmsCode(input: {
  phone: string;
  purpose: SmsPurpose;
  code: string;
  trx?: Knex.Transaction;
}) {
  const database = input.trx ?? db;
  const phone = normalizePhone(input.phone);
  const code = input.code.trim();
  if (!code) throw badRequest('请输入验证码。');

  const log = await database('sms_verification_logs')
    .where({ phone, purpose: input.purpose })
    .whereNull('verified_at')
    .whereIn('status', ['sent', 'failed'])
    .orderBy('sent_at', 'desc')
    .first();

  if (!log) {
    throw badRequest('请先获取验证码。');
  }

  let passed = false;
  if (log.provider === 'mock') {
    passed = Boolean(log.debug_code_hash) && hashValue(code) === log.debug_code_hash && (!log.expires_at || new Date(log.expires_at) > new Date());
  } else if (log.provider === 'dypns') {
    passed = await verifyWithAliyun(phone, code);
  }

  await database('sms_verification_logs')
    .where({ id: log.id })
    .update({
      status: passed ? 'verified' : 'failed',
      verified_at: passed ? new Date() : null,
    });

  if (!passed) {
    throw badRequest('验证码校验失败。');
  }

  return true;
}

