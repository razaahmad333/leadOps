const LOCALHOST_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

export interface OriginValidationOptions {
  allowLocalhost: boolean;
  configuredOrigins: string[];
  allowNoOrigin?: boolean;
}

export function resolveConfiguredOrigins(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function isAllowedOrigin(
  origin: string | undefined,
  options: OriginValidationOptions,
): boolean {
  if (!origin) {
    return options.allowNoOrigin ?? true;
  }

  if (options.configuredOrigins.includes(origin)) {
    return true;
  }

  if (options.allowLocalhost && LOCALHOST_ORIGIN_PATTERN.test(origin)) {
    return true;
  }

  return false;
}

