import { Injectable, NestMiddleware, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { tenantStorage } from './tenant.store';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  constructor(private readonly prisma: PrismaService) {}

  use(req: any, _res: any, next: () => void): void {
    // Health check bypasses tenant resolution
    if (req.url === '/health' || req.url === '/v1/health') {
      next();
      return;
    }

    void this.resolve(req, next);
  }

  private async resolve(req: any, next: () => void): Promise<void> {
    try {
      const mode = process.env.DEPLOYMENT_MODE ?? 'single';

      let tenantId: string | undefined;
      let tenantSlug: string | undefined;

      if (mode === 'single') {
        // Single-tenant: always use SINGLE_TENANT_ID env var
        const id = process.env.SINGLE_TENANT_ID;
        if (!id) {
          this.logger.warn('DEPLOYMENT_MODE=single but SINGLE_TENANT_ID is not set');
          // Attempt to fall back to first tenant in DB (dev convenience)
          const first = await this.prisma.tenant.findFirst();
          if (!first) throw new NotFoundException('No tenant found in database');
          tenantId = first.id;
          tenantSlug = first.slug;
        } else {
          const tenant = await this.prisma.tenant.findUnique({ where: { id } });
          if (!tenant) throw new NotFoundException(`Tenant with id ${id} not found`);
          tenantId = tenant.id;
          tenantSlug = tenant.slug;
        }
      } else {
        // Multi-tenant: try subdomain, then x-tenant-id header
        const host = (req.headers['host'] ?? '') as string;
        const subdomain = this.extractSubdomain(host);

        let tenant = null;
        if (subdomain) {
          tenant = await this.prisma.tenant.findUnique({ where: { slug: subdomain } });
        }

        if (!tenant) {
          const headerId = req.headers['x-tenant-id'] as string | undefined;
          if (headerId) {
            tenant = await this.prisma.tenant.findFirst({
              where: { OR: [{ id: headerId }, { slug: headerId }] },
            });
          }
        }

        if (!tenant) throw new NotFoundException('Tenant not found');
        tenantId = tenant.id;
        tenantSlug = tenant.slug;
      }

      tenantStorage.run({ tenantId, tenantSlug }, next);
    } catch (err) {
      this.logger.error('Tenant resolution failed', err);
      // Re-throw so the global exception filter can handle it
      throw err;
    }
  }

  private extractSubdomain(host: string): string | null {
    const withoutPort = host.split(':')[0] ?? '';
    const parts = withoutPort.split('.');
    if (parts.length >= 3 && parts[0] !== 'www') {
      return parts[0] ?? null;
    }
    return null;
  }
}
