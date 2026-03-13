import { createHash } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

interface Bucket {
  count: number;
  resetAt: number;
}

interface RateLimitRule {
  maxRequests: number;
  windowMs: number;
}

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private static readonly buckets = new Map<string, Bucket>();
  private static readonly maxTrackedBuckets = 20_000;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      url?: string;
      route?: { path?: string };
      ip?: string;
      headers?: Record<string, string | string[] | undefined>;
      body?: Record<string, unknown>;
    }>();

    const path = request.route?.path ?? request.url ?? '';
    const rule = this.resolveRule(path);
    if (!rule) {
      return true;
    }

    this.evictExpiredBuckets();

    const ip = this.resolveIp(request);
    const principal = this.resolvePrincipal(path, request.body);
    const key = `${path}:${ip}:${principal}`;
    const now = Date.now();
    const bucket = AuthRateLimitGuard.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      AuthRateLimitGuard.buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
      return true;
    }

    bucket.count += 1;

    if (bucket.count > rule.maxRequests) {
      throw new HttpException(
        'Too many authentication attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private resolveRule(path: string): RateLimitRule | null {
    if (path.endsWith('/auth/login')) {
      return {
        maxRequests: 10,
        windowMs: 60_000,
      };
    }

    if (path.endsWith('/auth/forgot-password/request-otp')) {
      return {
        maxRequests: 5,
        windowMs: 10 * 60_000,
      };
    }

    if (path.endsWith('/auth/forgot-password/verify-otp')) {
      return {
        maxRequests: 12,
        windowMs: 10 * 60_000,
      };
    }

    if (path.endsWith('/auth/select-tenant')) {
      return {
        maxRequests: 30,
        windowMs: 60_000,
      };
    }

    return null;
  }

  private resolveIp(request: {
    ip?: string;
    headers?: Record<string, string | string[] | undefined>;
  }): string {
    const forwarded = request.headers?.['x-forwarded-for'];
    const candidate = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return candidate?.split(',')[0]?.trim() || request.ip || 'unknown';
  }

  private resolvePrincipal(path: string, body: Record<string, unknown> | undefined): string {
    if (!body) {
      return 'anonymous';
    }

    if (path.endsWith('/auth/login') && typeof body.identifier === 'string') {
      return this.hashPrincipal(body.identifier);
    }

    if (
      (path.endsWith('/auth/forgot-password/request-otp') || path.endsWith('/auth/forgot-password/verify-otp'))
      && typeof body.phone === 'string'
    ) {
      return this.hashPrincipal(body.phone);
    }

    if (path.endsWith('/auth/select-tenant') && typeof body.selectionToken === 'string') {
      return this.hashPrincipal(body.selectionToken);
    }

    return 'anonymous';
  }

  private hashPrincipal(value: string): string {
    return createHash('sha256')
      .update(value.trim().toLowerCase())
      .digest('hex')
      .slice(0, 20);
  }

  private evictExpiredBuckets(): void {
    const now = Date.now();
    for (const [key, bucket] of AuthRateLimitGuard.buckets.entries()) {
      if (bucket.resetAt <= now) {
        AuthRateLimitGuard.buckets.delete(key);
      }
    }

    if (AuthRateLimitGuard.buckets.size <= AuthRateLimitGuard.maxTrackedBuckets) {
      return;
    }

    // Keep memory bounded even under abuse.
    const sorted = [...AuthRateLimitGuard.buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    const toDrop = AuthRateLimitGuard.buckets.size - AuthRateLimitGuard.maxTrackedBuckets;
    for (let index = 0; index < toDrop; index += 1) {
      const key = sorted[index]?.[0];
      if (key) {
        AuthRateLimitGuard.buckets.delete(key);
      }
    }
  }
}

