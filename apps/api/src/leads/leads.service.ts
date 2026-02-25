import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantContext } from '../tenant/tenant.store';
import { CreateLeadDto, UpdateLeadStatusDto, Lead } from '@leadops/shared';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Lead[]> {
    const { tenantId } = getTenantContext();
    const leads = await this.prisma.lead.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return leads as Lead[];
  }

  async findOne(id: string): Promise<Lead> {
    const { tenantId } = getTenantContext();
    const lead = await this.prisma.lead.findFirst({ where: { id, tenantId } });
    if (!lead) throw new NotFoundException(`Lead ${id} not found`);
    return lead as Lead;
  }

  async create(dto: CreateLeadDto): Promise<Lead> {
    const { tenantId } = getTenantContext();
    const lead = await this.prisma.lead.create({
      data: { ...dto, tenantId, status: 'NEW' },
    });
    return lead as Lead;
  }

  async updateStatus(id: string, dto: UpdateLeadStatusDto): Promise<Lead> {
    const { tenantId } = getTenantContext();
    const existing = await this.prisma.lead.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException(`Lead ${id} not found`);

    const updated = await this.prisma.lead.update({
      where: { id },
      data: { status: dto.status },
    });
    return updated as Lead;
  }
}
