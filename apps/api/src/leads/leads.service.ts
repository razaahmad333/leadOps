import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuthUser,
  ACTIVE_LEAD_STATUSES,
  BranchScopeType,
  CreateLeadDto,
  DOMAIN_EVENTS,
  Lead,
  LeadDetail,
  LeadStatus,
  UpdateLeadStatusDto,
} from '@leadops/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantContext } from '../tenant/tenant.store';
import { TenantConfigService } from '../tenant/tenant-config.service';
import { QueueService } from '../queue/queue.service';
import { DomainEventsService } from '../events/domain-events.service';
import { BranchScopeService } from '../access-control/branch-scope.service';
import { MilestoneRulesService } from './milestone-rules.service';

interface CreateLeadOptions {
  actor?: AuthUser;
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
    private readonly branchScope: BranchScopeService,
    private readonly milestoneRules: MilestoneRulesService,
  ) {}

  async findAll(user: AuthUser): Promise<Lead[]> {
    const tenant = getTenantContext();

    const leads = await this.prisma.lead.findMany({
      where: this.branchScope.applyLeadFilter(user, { tenantId: tenant?.tenantId }),
      orderBy: { createdAt: 'desc' },
    });

    return leads as unknown as Lead[];
  }

  async findOne(id: string, user: AuthUser): Promise<LeadDetail> {
    const tenant = getTenantContext();

    const lead = await this.prisma.lead.findFirst({
      where: this.branchScope.applyLeadFilter(user, { id, tenantId: tenant?.tenantId }),
      include: {
        followUps: {
          orderBy: { scheduledAt: 'asc' },
          select: {
            id: true,
            kind: true,
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
    const actor = options.actor;

    const defaultStage = await this.tenantConfig.getDefaultStage(tenant?.tenantId);
    const resolvedStage = dto.stageKey
      ? await this.tenantConfig.resolveStage(dto.stageKey, tenant?.tenantId)
      : defaultStage;

    if (!resolvedStage) {
      throw new BadRequestException('Invalid stage key for tenant pipeline');
    }

    this.ensureActiveLeadFollowUp(resolvedStage.internalStatus, dto.nextFollowUpAt);

    const normalizedFollowUp = await this.tenantConfig.normalizeToBusinessWindow(
      dto.nextFollowUpAt,
      tenant?.tenantId,
    );

    const serializedIntakeData = dto.intakeData
      ? (JSON.parse(JSON.stringify(dto.intakeData)) as Prisma.InputJsonValue)
      : undefined;
    let selectedBranchId = dto.branchId ?? null;

    if (!selectedBranchId && actor?.branchScope.scopeType === BranchScopeType.SELECTED) {
      selectedBranchId = actor.branchScope.branchIds[0] ?? null;
    }

    if (!selectedBranchId && tenant?.tenantId) {
      const defaultBranch = await this.prisma.branch.findFirst({
        where: { tenantId: tenant.tenantId },
        orderBy: { createdAt: 'asc' },
      });
      selectedBranchId = defaultBranch?.id ?? null;
    }

    if (actor) {
      this.branchScope.ensureBranchAccess(actor, selectedBranchId);
    }

    const lead = await this.prisma.lead.create({
      data: {
        tenantId: tenant?.tenantId ?? '',
        ownerId: dto.ownerId,
        branchId: selectedBranchId,
        stageKey: resolvedStage.key,
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        source: dto.source,
        intakeData: serializedIntakeData,
        status: resolvedStage.internalStatus,
        nextFollowUpAt: normalizedFollowUp,
      },
    });

    const initialFollowUp = await this.prisma.followUp.create({
      data: {
        tenantId: lead.tenantId,
        leadId: lead.id,
        assignedTo: lead.ownerId,
        scheduledAt: normalizedFollowUp,
        kind: 'GENERAL',
        note: dto.note ?? 'Initial follow-up',
      },
    });

    await this.prisma.leadActivity.create({
      data: {
        tenantId: lead.tenantId,
        leadId: lead.id,
        actorId: actor?.id ?? null,
        type: options.activityType ?? 'lead.created',
        message: options.activityMessage ?? 'Lead created',
      },
    });

    await this.queue.scheduleFollowupReminder(
      {
        tenantId: lead.tenantId,
        followUpId: initialFollowUp.id,
      },
      normalizedFollowUp,
    );

    this.domainEvents.emit(DOMAIN_EVENTS.LEAD_CREATED, {
      tenantId: lead.tenantId,
      leadId: lead.id,
    });

    return lead as unknown as Lead;
  }

  async updateStatus(id: string, dto: UpdateLeadStatusDto, actor: AuthUser): Promise<Lead> {
    const tenant = getTenantContext();

    const existing = await this.prisma.lead.findFirst({
      where: this.branchScope.applyLeadFilter(actor, { id, tenantId: tenant?.tenantId }),
    });

    if (!existing) {
      throw new NotFoundException(`Lead ${id} not found`);
    }

    if (!dto.status && !dto.stageKey) {
      throw new BadRequestException('Either status or stageKey is required');
    }

    const nextStageKey = await this.resolveTargetStageKey(existing.stageKey, dto, tenant?.tenantId);
    const nextStage = nextStageKey
      ? await this.tenantConfig.resolveStage(nextStageKey, tenant?.tenantId)
      : null;

    if (!nextStage) {
      throw new BadRequestException('Invalid stage key for tenant pipeline');
    }

    const allowedTransition = await this.tenantConfig.canTransition(
      existing.stageKey,
      nextStage.key,
      tenant?.tenantId,
    );

    if (!allowedTransition) {
      throw new BadRequestException(`Transition from ${existing.stageKey ?? 'N/A'} to ${nextStage.key} is not allowed`);
    }

    const resolvedStatus = dto.status ?? nextStage.internalStatus;
    const nextFollowUpAt =
      dto.nextFollowUpAt && ACTIVE_LEAD_STATUSES.includes(resolvedStatus)
        ? await this.tenantConfig.normalizeToBusinessWindow(dto.nextFollowUpAt, tenant?.tenantId)
        : existing.nextFollowUpAt;

    if (ACTIVE_LEAD_STATUSES.includes(resolvedStatus) && !nextFollowUpAt) {
      throw new BadRequestException('Every active lead must have a next follow-up time');
    }

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        status: resolvedStatus,
        stageKey: nextStage.key,
        nextFollowUpAt: ACTIVE_LEAD_STATUSES.includes(resolvedStatus) ? nextFollowUpAt : existing.nextFollowUpAt,
      },
    });

    await this.prisma.leadActivity.create({
      data: {
        tenantId: updated.tenantId,
        leadId: updated.id,
        actorId: actor?.id ?? null,
        type: 'lead.status.changed',
        message: `Status updated to ${nextStage.label}`,
        metadata: {
          fromStatus: existing.status,
          toStatus: resolvedStatus,
          fromStageKey: existing.stageKey,
          toStageKey: nextStage.key,
        },
      },
    });

    const milestone = await this.tenantConfig.getStageMilestone(nextStage.key, tenant?.tenantId);

    this.domainEvents.emit(DOMAIN_EVENTS.STATUS_CHANGED, {
      tenantId: updated.tenantId,
      leadId: updated.id,
      from: existing.status,
      to: resolvedStatus,
      fromStageKey: existing.stageKey,
      toStageKey: nextStage.key,
      milestone: milestone ?? undefined,
    });

    if (milestone && existing.stageKey !== nextStage.key) {
      await this.milestoneRules.handleMilestone({
        tenantId: updated.tenantId,
        leadId: updated.id,
        actorId: actor?.id,
        milestone,
      });
    }

    return updated as unknown as Lead;
  }

  async addNote(id: string, note: string, actor: AuthUser): Promise<void> {
    const tenant = getTenantContext();

    const lead = await this.prisma.lead.findFirst({
      where: this.branchScope.applyLeadFilter(actor, { id, tenantId: tenant?.tenantId }),
    });
    if (!lead) {
      throw new NotFoundException(`Lead ${id} not found`);
    }

    await this.prisma.leadActivity.create({
      data: {
        tenantId: lead.tenantId,
        leadId: lead.id,
        actorId: actor?.id ?? null,
        type: 'lead.note.added',
        message: note,
      },
    });
  }

  private ensureActiveLeadFollowUp(status: LeadStatus, nextFollowUpAt?: Date): void {
    if (ACTIVE_LEAD_STATUSES.includes(status) && !nextFollowUpAt) {
      throw new BadRequestException('Every active lead must have a next follow-up time');
    }
  }

  private async resolveTargetStageKey(
    existingStageKey: string | null,
    dto: UpdateLeadStatusDto,
    tenantId?: string,
  ): Promise<string> {
    if (dto.stageKey) {
      return dto.stageKey;
    }

    if (dto.status) {
      const config = await this.tenantConfig.getDisplayConfig(tenantId);
      const mapped =
        config.pipelineConfig.stages.find((stage) => stage.internalStatus === dto.status && stage.key === dto.status)
        ?? config.pipelineConfig.stages.find((stage) => stage.internalStatus === dto.status);

      if (mapped) {
        return mapped.key;
      }
    }

    if (existingStageKey) {
      return existingStageKey;
    }

    const fallback = await this.tenantConfig.getDefaultStage(tenantId);
    return fallback.key;
  }
}
