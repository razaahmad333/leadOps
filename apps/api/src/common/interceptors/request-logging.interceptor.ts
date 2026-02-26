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

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method: string;
      url: string;
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
            }),
          );
        },
      }),
    );
  }
}
