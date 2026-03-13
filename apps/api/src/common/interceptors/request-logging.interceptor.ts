import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from '../metrics/metrics.service';

const REDACTED_KEYS = new Set([
  'password',
  'passwordHash',
  'accessToken',
  'authorization',
  'otpCode',
  'token',
  'selectionToken',
  'identifier',
  'email',
  'phone',
  'verificationId',
  'message',
  'note',
]);

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      body?: unknown;
      query?: unknown;
      params?: unknown;
      requestId?: string;
      tenantId?: string;
    }>();

    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - startedAt;
          this.metrics.increment('http.requests.total');
          this.metrics.observeRequest(durationMs);

          this.logger.log(
            JSON.stringify({
              event: 'http.request',
              method: req.method,
              path: req.url,
              durationMs,
              requestId: req.requestId,
              tenantId: req.tenantId,
              params: this.sanitizeForLog(req.params),
              query: this.sanitizeForLog(req.query),
              body: this.shouldLogBody(req.url) ? this.sanitizeForLog(req.body) : '[REDACTED]',
            }),
          );
        },
      }),
    );
  }

  private shouldLogBody(path: string): boolean {
    const sanitizedPath = path.split('?')[0] ?? path;
    if (process.env.NODE_ENV === 'production') {
      return false;
    }

    if (sanitizedPath.startsWith('/v1/auth') || sanitizedPath.startsWith('/v1/intake')) {
      return false;
    }

    return true;
  }

  private sanitizeForLog(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeForLog(item));
    }

    if (typeof value === 'string') {
      return value.replace(/[\r\n\t]/g, ' ').slice(0, 500);
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    const entries = Object.entries(value as Record<string, unknown>).map(([key, nextValue]) => {
      if (REDACTED_KEYS.has(key)) {
        return [key, '[REDACTED]'];
      }

      return [key, this.sanitizeForLog(nextValue)];
    });

    return Object.fromEntries(entries);
  }
}
