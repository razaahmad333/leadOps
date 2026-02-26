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

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ ip?: string; headers?: Record<string, string | string[] | undefined> }>();

    const forwarded = request.headers?.['x-forwarded-for'];
    const candidate = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const ip = candidate?.split(',')[0]?.trim() || request.ip || 'unknown';

    const key = `intake:${ip}`;
    const now = Date.now();
    const windowMs = 60_000;
    const maxRequests = 20;

    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }

    existing.count += 1;
    if (existing.count > maxRequests) {
      throw new HttpException(
        'Rate limit exceeded for public intake endpoint',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
