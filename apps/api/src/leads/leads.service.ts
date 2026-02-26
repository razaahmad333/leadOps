import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ACTIVE_LEAD_STATUSES,
  CreateLeadDto,
  DOMAIN_EVENTS,
  Lead,
  LeadDetail,
  LeadStatus,
  UpdateLeadStatusDto,
} from '@leadops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantContext } from '../tenant/tenant.store';
import { TenantConfigService } from '../tenant/tenant-config.service';
import { QueueService } from '../queue/queue.service';
import { DomainEventsService } from '../events/domain-events.service';

interface CreateLeadOptions {
  actorId?: string | null;
  activityType?: string;
  activityMessage?: string;
}

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
    private readonly queue: QueueService,
    private readonly domainEvents: DomainEventsService,
  ) {}

  async findAll(): Promise<Lead[]> {
    const tenant = getTenantContext();

    const leads = await this.prisma.lead.findMany({
      where: { tenantId: tenant?.tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return leads as Lead[];
  }

  async findOne(id: string): Promise<LeadDetail> {
    const tenant = getTenantContext();

    const lead = await this.prisma.lead.findFirst({
      where: { id, tenantId: tenant?.tenantId },
      include: {
        followUps: {
          orderBy: { scheduledAt: 'asc' },
          select: {
            id: true,
            scheduledAt: true,
            done: true,
            note: true,
            escalatedAt: true,
          },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          include: {
            actor: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead ${id} not found`);
    }

    return {
      lead: lead as unknown as Lead,
      followUps: lead.followUps,
      activities: lead.activities,
    } as LeadDetail;
  }

  async create(dto: CreateLeadDto, options: CreateLeadOptions = {}): Promise<Lead> {
    const tenant = getTenantContext();
    this.ensureActiveLeadFollowUp(dto.nextFollowUpAt);

    const normalizedFollowUp = await this.tenantConfig.normalizeToBusinessWindow(dto.nextFollowUpAt);

    const lead = await this.prisma.lead.create({
      data: {
        tenantId: tenant?.tenantId ?? '',
        ownerId: dto.ownerId,
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        source: dto.source,
        status: LeadStatus.NEW,
        nextFollowUpAt: normalizedFollowUp,
      },
    });

    await this.prisma.followUp.create({
      data: {
        tenantId: lead.tenantId,
        leadId: lead.id,
        assignedTo: lead.ownerId,
        scheduledAt: normalizedFollowUp,
        note: dto.note ?? 'Initial follow-up',
      },
    });

    await this.prisma.leadActivity.create({
      data: {
        tenantId: lead.tenantId,
        leadId: lead.id,
        actorId: options.actorId ?? null,
        type: options.activityType ?? 'lead.created',
        message: options.activityMessage ?? 'Lead created',
      },
    });

    await this.queue.scheduleFollowupReminder(
      {
        tenantId: lead.tenantId,
        followUpId: (
          await this.prisma.followUp.findFirstOrThrow({
            where: { tenantId: lead.tenantId, leadId: lead.id },
            orderBy: { createdAt: 'desc' },
          })
        ).id,
      },
      normalizedFollowUp,
    );

    this.domainEvents.emit(DOMAIN_EVENTS.LEAD_CREATED, {
      tenantId: lead.tenantId,
      leadId: lead.id,
    });

    return lead as Lead;
  }

  async updateStatus(id: string, dto: UpdateLeadStatusDto, actorId?: string): Promise<Lead> {
    const tenant = getTenantContext();

    const existing = await this.prisma.lead.findFirst({
      where: { id, tenantId: tenant?.tenantId },
    });

    if (!existing) {
      throw new NotFoundException(`Lead ${id} not found`);
    }

    const nextFollowUpAt =
      dto.nextFollowUpAt && ACTIVE_LEAD_STATUSES.includes(dto.status)
        ? await this.tenantConfig.normalizeToBusinessWindow(dto.nextFollowUpAt)
        : existing.nextFollowUpAt;

    if (ACTIVE_LEAD_STATUSES.includes(dto.status) && !nextFollowUpAt) {
      throw new BadRequestException('Every active lead must have a next follow-up time');
    }

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        status: dto.status,
        nextFollowUpAt: ACTIVE_LEAD_STATUSES.includes(dto.status) ? nextFollowUpAt : null,
      },
    });

    await this.prisma.leadActivity.create({
      data: {
        tenantId: updated.tenantId,
        leadId: updated.id,
        actorId: actorId ?? null,
        type: 'lead.status.changed',
        message: `Status updated to ${dto.status}`,
        metadata: {
          from: existing.status,
          to: dto.status,
        },
      },
    });

    this.domainEvents.emit(DOMAIN_EVENTS.STATUS_CHANGED, {
      tenantId: updated.tenantId,
      leadId: updated.id,
      from: existing.status,
      to: dto.status,
    });

    return updated as Lead;
  }

  async addNote(id: string, note: string, actorId?: string): Promise<void> {
    const tenant = getTenantContext();

    const lead = await this.prisma.lead.findFirst({ where: { id, tenantId: tenant?.tenantId } });
    if (!lead) {
      throw new NotFoundException(`Lead ${id} not found`);
    }

    await this.prisma.leadActivity.create({
      data: {
        tenantId: lead.tenantId,
        leadId: lead.id,
        actorId: actorId ?? null,
        type: 'lead.note.added',
        message: note,
      },
    });
  }

  private ensureActiveLeadFollowUp(nextFollowUpAt?: Date): void {
    if (!nextFollowUpAt) {
      throw new BadRequestException('Every active lead must have a next follow-up time');
    }
  }
}
