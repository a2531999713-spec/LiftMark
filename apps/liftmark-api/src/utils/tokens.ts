import jwt, { type SignOptions } from 'jsonwebtoken';

import { env } from '../config/env';
import { createId } from './ids';

export type TokenUser = {
  id: string;
  role: 'user' | 'admin';
  status: 'normal' | 'disabled';
};

type AccessPayload = {
  role: TokenUser['role'];
  status: TokenUser['status'];
  sub: string;
  typ: 'access';
};

type RefreshPayload = {
  jti: string;
  sub: string;
  typ: 'refresh';
};

function signJwt(payload: object, secret: string, expiresIn: string) {
  return jwt.sign(payload, secret, { expiresIn } as SignOptions);
}

export function signAccessToken(user: TokenUser) {
  return signJwt(
    {
      sub: user.id,
      role: user.role,
      status: user.status,
      typ: 'access',
    } satisfies AccessPayload,
    env.jwtSecret,
    env.jwtExpiresIn,
  );
}

export function signRefreshToken(userId: string) {
  const jti = createId('rt');
  const token = signJwt({ sub: userId, jti, typ: 'refresh' } satisfies RefreshPayload, env.jwtRefreshSecret, env.jwtRefreshExpiresIn);
  return { jti, token };
}

export function verifyAccessToken(token: string) {
  const payload = jwt.verify(token, env.jwtSecret) as AccessPayload;
  if (payload.typ !== 'access') throw new Error('Invalid access token type.');
  return payload;
}

export function verifyRefreshToken(token: string) {
  const payload = jwt.verify(token, env.jwtRefreshSecret) as RefreshPayload;
  if (payload.typ !== 'refresh') throw new Error('Invalid refresh token type.');
  return payload;
}

