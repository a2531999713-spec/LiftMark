export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code = 'API_ERROR',
  ) {
    super(message);
  }
}

export function badRequest(message: string, code = 'BAD_REQUEST') {
  return new ApiError(400, message, code);
}

export function unauthorized(message = '请先登录。') {
  return new ApiError(401, message, 'UNAUTHORIZED');
}

export function forbidden(message = '没有权限执行该操作。') {
  return new ApiError(403, message, 'FORBIDDEN');
}

export function notFound(message = '资源不存在。') {
  return new ApiError(404, message, 'NOT_FOUND');
}

export function conflict(message: string) {
  return new ApiError(409, message, 'CONFLICT');
}

