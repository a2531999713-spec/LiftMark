import dotenv from 'dotenv';

dotenv.config();

function readEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function readSecret(name: string, devFallback: string) {
  if (process.env.NODE_ENV === 'production') {
    return readEnv(name);
  }
  return process.env[name] ?? devFallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  host: process.env.HOST ?? '127.0.0.1',
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: readEnv('DATABASE_URL'),
  jwtSecret: readSecret('JWT_SECRET', 'dev-only-liftmark-access-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  jwtRefreshSecret: readSecret('JWT_REFRESH_SECRET', 'dev-only-liftmark-refresh-secret-change-me'),
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  smsProvider: process.env.SMS_PROVIDER ?? 'mock',
  aliyunAccessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
  aliyunAccessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
  aliyunDypnsEndpoint: process.env.ALIYUN_DYPNS_ENDPOINT ?? 'dypnsapi.aliyuncs.com',
  aliyunDypnsSignName: process.env.ALIYUN_DYPNS_SIGN_NAME,
  aliyunDypnsTemplateCode: process.env.ALIYUN_DYPNS_TEMPLATE_CODE,
  adminPhone: process.env.ADMIN_PHONE,
  adminEmail: process.env.ADMIN_EMAIL,
  adminInitialPassword: process.env.ADMIN_INITIAL_PASSWORD,
};

export function isProduction() {
  return env.nodeEnv === 'production';
}

