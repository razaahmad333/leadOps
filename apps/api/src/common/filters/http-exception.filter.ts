import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { getTenantContext } from '../../tenant/tenant.store';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<{ status: (code: number) => { send: (body: unknown) => void } }>();
    const request = ctx.getRequest<{
      url: string;
      method: string;
      requestId?: string;
    }>();

    const tenantContext = getTenantContext(false);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'string') {
        message = response;
      } else if (response && typeof response === 'object') {
        const payload = response as Record<string, unknown>;
        message = (payload.message as string | string[]) ?? exception.message;
        details = payload.errors;
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    }

    const body = {
      error: {
        status,
        message,
        details,
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        requestId: request.requestId ?? tenantContext?.requestId,
        tenantId: tenantContext?.tenantId,
      },
    };

    void reply.status(status).send(body);
  }
}
