import { API_BASE_URL } from '@/config/api';

function getApiOrigin() {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return API_BASE_URL.replace(/\/api\/?$/, '').replace(/\/$/, '');
  }
}

function isNativeUri(value: string) {
  return /^(file|content|data|blob):/i.test(value);
}

export function resolveAvatarUrl(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed) || isNativeUri(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) {
    return `http:${trimmed}`;
  }

  const origin = getApiOrigin();
  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${origin}${normalizedPath}`;
}

export function pickAvatarUri(input: {
  avatarLocalUri?: string | null;
  avatarThumbUrl?: string | null;
  avatarUrl?: string | null;
  uri?: string | null;
}): string | null {
  return (
    resolveAvatarUrl(input.uri) ??
    input.avatarLocalUri ??
    resolveAvatarUrl(input.avatarThumbUrl) ??
    resolveAvatarUrl(input.avatarUrl) ??
    null
  );
}
