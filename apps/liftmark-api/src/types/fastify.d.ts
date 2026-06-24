import type { TokenUser } from '../utils/tokens';

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: TokenUser;
  }
}

