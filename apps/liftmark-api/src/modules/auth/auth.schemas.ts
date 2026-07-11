import { z } from 'zod';

export const sendCodeSchema = z.object({
  phone: z.string(),
  purpose: z.enum(['login', 'register', 'reset_password']),
});

export const registerSchema = z.object({
  phone: z.string(),
  code: z.string().trim().min(1, '请输入验证码。'),
  password: z.string().min(6).optional(),
  campaignCode: z.string().max(64).optional(),
  nickname: z.string().min(1).max(32).optional(),
  registrationSource: z.string().max(64).optional(),
});

export const loginSchema = z.object({
  account: z.string().min(1),
  password: z.string().min(1),
});

export const passwordLoginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

export const codeLoginSchema = z.object({
  phone: z.string(),
  code: z.string().min(1),
  campaignCode: z.string().max(64).optional(),
  registrationSource: z.string().max(64).optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
