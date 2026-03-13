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
  key: string;
  maxRequests: number;
  windowMs: number;
  message: string;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private readonly maxTrackedBuckets = 50_000;

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ ip?: string; headers?: Record<string, string | string[] | undefined>; url?: string; route?: { path?: string } }>();

    const path = this.resolvePath(request);
    const rule = this.resolveRule(path);
    if (!rule) {
      return true;
    }

    const forwarded = request.headers?.['x-forwarded-for'];
    const candidate = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const ip = candidate?.split(',')[0]?.trim() || request.ip || 'unknown';

    const key = `${rule.key}:${ip}`;
    const now = Date.now();

    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
      this.evictExpiredBuckets(now);
      return true;
    }

    existing.count += 1;
    if (existing.count > rule.maxRequests) {
      throw new HttpException(
        rule.message,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.evictExpiredBuckets(now);
    return true;
  }

  private resolvePath(request: { url?: string; route?: { path?: string } }): string {
    const source = request.url ?? request.route?.path ?? '';
    return source.split('?')[0] ?? source;
  }

  private resolveRule(path: string): RateLimitRule | null {
    if (path.endsWith('/intake/website')) {
      return {
        key: 'public-intake',
        maxRequests: 20,
        windowMs: 60_000,
        message: 'Rate limit exceeded for intake endpoint',
      };
    }

    if (path.endsWith('/public/tenant-branding')) {
      return {
        key: 'public-branding',
        maxRequests: 60,
        windowMs: 60_000,
        message: 'Rate limit exceeded for public branding endpoint',
      };
    }

    return null;
  }

  private evictExpiredBuckets(now: number): void {
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }

    if (this.buckets.size <= this.maxTrackedBuckets) {
      return;
    }

    const sorted = [...this.buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    const toDrop = this.buckets.size - this.maxTrackedBuckets;
    for (let index = 0; index < toDrop; index += 1) {
      const key = sorted[index]?.[0];
      if (key) {
        this.buckets.delete(key);
      }
    }
  }
}
