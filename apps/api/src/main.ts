import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { isAllowedOrigin, resolveConfiguredOrigins } from './common/security/origin.util';

function buildContentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "connect-src 'self' https: wss: ws:",
  ].join('; ');
}

function isDocsPath(path: string): boolean {
  return path.startsWith('/docs') || path.startsWith('/docs-json');
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: process.env.NODE_ENV !== 'test' }),
  );

  const logger = new Logger('Bootstrap');
  const allowLocalhost = process.env.NODE_ENV !== 'production';
  const configuredOrigins = resolveConfiguredOrigins(process.env.CORS_ORIGIN);

  app.enableCors({
    origin: (origin, callback) => {
      callback(null, isAllowedOrigin(origin, {
        allowLocalhost,
        configuredOrigins,
        allowNoOrigin: process.env.NODE_ENV !== 'production',
      }));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Branch-Id', 'X-Tenant-Id', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 86_400,
  });

  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onSend', (request: { url: string; headers: Record<string, string | string[] | undefined> }, reply: { header: (key: string, value: string) => void }, payload: unknown, done: (error: Error | null, value?: unknown) => void) => {
    const path = request.url.split('?')[0] ?? request.url;

    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    reply.header('Cross-Origin-Resource-Policy', 'same-site');
    reply.header('Cache-Control', 'no-store');

    if (!isDocsPath(path)) {
      reply.header('Content-Security-Policy', buildContentSecurityPolicy());
    }

    const forwardedProto = request.headers['x-forwarded-proto'];
    const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
    const isHttps = proto === 'https';
    if (process.env.NODE_ENV === 'production' && isHttps) {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    done(null, payload);
  });

  app.setGlobalPrefix('v1', {
    exclude: ['health', 'metrics', 'docs', 'docs-json'],
  });

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useWebSocketAdapter(new IoAdapter(app));

  const exposeSwagger = process.env.ENABLE_SWAGGER === 'true' || process.env.NODE_ENV !== 'production';
  if (exposeSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('HikmahOne LeadOps API')
      .setDescription('Production-grade LeadOps API')
      .setVersion('1.0.0')
      .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        in: 'header',
      })
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port, '0.0.0.0');

  logger.log(`API running at http://localhost:${port}`);
  if (exposeSwagger) {
    logger.log(`Swagger docs at http://localhost:${port}/docs`);
  } else {
    logger.log('Swagger docs disabled');
  }
}

bootstrap().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Failed to bootstrap API', error);
  process.exit(1);
});
