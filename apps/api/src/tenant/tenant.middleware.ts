import { randomUUID } from 'node:crypto';
import { Injectable, Logger, NestMiddleware, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { tenantStorage } from './tenant.store';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  constructor(private readonly prisma: PrismaService) {}

  use(req: any, res: any, next: () => void): void {
    const requestId = this.resolveRequestId(req.headers['x-request-id'] as string | undefined);

    req.requestId = requestId;
    if (typeof res.setHeader === 'function') {
      res.setHeader('x-request-id', requestId);
    }

    if (this.isBypassPath(req.url) || this.isGlobalAuthPath(req.url)) {
      tenantStorage.run({ tenantId: 'system', tenantSlug: 'system', requestId }, next);
      return;
    }

    void this.resolveTenant(req, requestId, next);
  }

  private resolveRequestId(headerValue: string | undefined): string {
    const normalized = headerValue?.trim();
    if (!normalized) {
      return randomUUID();
    }

    // Keep request ids log-safe and bounded.
    if (normalized.length > 120 || !/^[a-zA-Z0-9._:-]+$/.test(normalized)) {
      return randomUUID();
    }

    return normalized;
  }

  private isBypassPath(url: string): boolean {
    return url.startsWith('/health') || url.startsWith('/metrics') || url.startsWith('/docs');
  }

  private isGlobalAuthPath(url: string): boolean {
    const path = url.split('?')[0] ?? url;

    return path === '/v1/auth/login'
      || path === '/v1/auth/forgot-password/request-otp'
      || path === '/v1/auth/forgot-password/verify-otp'
      || path === '/v1/auth/select-tenant';
  }

  private async resolveTenant(req: any, requestId: string, next: () => void): Promise<void> {
    const mode = process.env.DEPLOYMENT_MODE ?? 'single';

    let tenant = null;

    if (mode === 'single') {
      const configuredTenantId = process.env.SINGLE_TENANT_ID;
      if (configuredTenantId) {
        tenant = await this.prisma.tenant.findUnique({ where: { id: configuredTenantId } });
      }

      if (!tenant) {
        tenant = await this.prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
      }
    } else {
      let explicitTenantSignal = false;
      const host = (req.headers['host'] ?? '') as string;
      const subdomain = this.extractSubdomain(host);

      if (subdomain) {
        explicitTenantSignal = true;
        tenant = await this.prisma.tenant.findUnique({ where: { slug: subdomain } });
      }

      if (!tenant) {
        const headerTenant = req.headers['x-tenant-id'] as string | undefined;

        if (headerTenant) {
          explicitTenantSignal = true;
          tenant = await this.prisma.tenant.findFirst({
            where: {
              OR: [{ id: headerTenant }, { slug: headerTenant }],
            },
          });
        }
      }

      if (!tenant) {
        const tokenTenantId = this.extractTenantIdFromBearer(req.headers['authorization'] as string | undefined);

        if (tokenTenantId) {
          explicitTenantSignal = true;
          tenant = await this.prisma.tenant.findUnique({ where: { id: tokenTenantId } });
        }
      }

      if (!tenant && !explicitTenantSignal) {
        tenantStorage.run({ tenantId: 'system', tenantSlug: 'system', requestId }, next);
        return;
      }
    }

    if (!tenant) {
      throw new NotFoundException('Tenant not found for incoming request');
    }

    req.tenantId = tenant.id;
    const branchHeader = req.headers['x-branch-id'];
    const selectedBranchId = typeof branchHeader === 'string' && branchHeader.trim().length > 0
      ? branchHeader.trim()
      : undefined;

    tenantStorage.run(
      {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        requestId,
        selectedBranchId,
      },
      () => {
        this.logger.debug(`Tenant resolved: ${tenant.slug} (${requestId})`);
        next();
      },
    );
  }

  private extractSubdomain(host: string): string | null {
    const withoutPort = host.split(':')[0] ?? '';
    const parts = withoutPort.split('.');

    if (parts.length >= 3 && parts[0] && parts[0] !== 'www') {
      return parts[0];
    }

    return null;
  }

  private extractTenantIdFromBearer(authorization: string | undefined): string | null {
    if (!authorization?.startsWith('Bearer ')) {
      return null;
    }

    const token = authorization.slice('Bearer '.length).trim();
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) {
      return null;
    }

    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
        tenantId?: string;
      };

      return typeof payload.tenantId === 'string' && payload.tenantId.length > 0
        ? payload.tenantId
        : null;
    } catch {
      return null;
    }
  }
}
