const DEFAULT_DEVELOPMENT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:8081',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8081',
];

export function parseCorsAllowedOrigins(value?: string): string[] {
  return [...new Set((value ?? '').split(',').map((origin) => origin.trim()).filter(Boolean))];
}

export function resolveCorsAllowedOrigins(nodeEnv: string, configuredValue?: string): string[] {
  const configured = parseCorsAllowedOrigins(configuredValue);
  if (nodeEnv === 'production') {
    if (configured.length === 0) {
      throw new Error('CORS_ALLOWED_ORIGINS is required in production.');
    }
    return configured;
  }
  return configured.length > 0 ? configured : DEFAULT_DEVELOPMENT_ORIGINS;
}

export function isCorsOriginAllowed(origin: string | undefined, allowedOrigins: readonly string[]): boolean {
  // Native mobile requests do not include a browser Origin header.
  return !origin || allowedOrigins.includes(origin);
}
