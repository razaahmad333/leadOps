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
  LeadListResponse,
  LeadDetail,
  LeadStatus,
  ListLeadsQueryDto,
  REALTIME_INVALIDATION_EVENTS,
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
import { RealtimePublisherService } from '../realtime/realtime.publisher.service';
import { buildEmptyPaginatedResponse, buildPaginatedResponse } from '../common/utils/pagination.util';

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
    private readonly realtimePublisher: RealtimePublisherService,
  ) {}

  async findAll(user: AuthUser, query: ListLeadsQueryDto): Promise<LeadListResponse> {
    const tenant = getTenantContext();
    const selectedBranchId = tenant?.selectedBranchId;
    const page = query.page;
    const pageSize = query.pageSize;
    const search = query.search?.trim();

    if (query.branchId) {
      this.branchScope.ensureBranchAccess(user, query.branchId);
    }

    if (selectedBranchId && query.branchId && query.branchId !== selectedBranchId) {
      return buildEmptyPaginatedResponse<Lead>(page, pageSize);
    }

    const where = this.branchScope.applyLeadFilterForSelectedBranch<Prisma.LeadWhereInput>(
      user,
      { tenantId: tenant?.tenantId },
      selectedBranchId,
    );

    if (!selectedBranchId && query.branchId) {
      where.branchId = query.branchId;
    }

    if (query.stageKey) {
      where.stageKey = query.stageKey;
    }

    if (query.createdFrom || query.createdTo) {
      where.createdAt = {
        ...(query.createdFrom ? { gte: query.createdFrom } : {}),
        ...(query.createdTo ? { lte: query.createdTo } : {}),
      };
    }

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          phone: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const [leads, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return buildPaginatedResponse(leads as unknown as Lead[], page, pageSize, total);
  }

  async exportCsv(user: AuthUser, query: ListLeadsQueryDto): Promise<string> {
    const tenant = getTenantContext();
    const selectedBranchId = tenant?.selectedBranchId;
    const search = query.search?.trim();

    if (query.branchId) {
      this.branchScope.ensureBranchAccess(user, query.branchId);
    }

    if (selectedBranchId && query.branchId && query.branchId !== selectedBranchId) {
      return this.toCsv([
        ['Name', 'Phone', 'Email', 'Source', 'Stage', 'Status', 'Branch', 'Next Follow-up', 'Created At'],
      ]);
    }

    const where = this.branchScope.applyLeadFilterForSelectedBranch<Prisma.LeadWhereInput>(
      user,
      { tenantId: tenant?.tenantId },
      selectedBranchId,
    );

    if (!selectedBranchId && query.branchId) {
      where.branchId = query.branchId;
    }

    if (query.stageKey) {
      where.stageKey = query.stageKey;
    }

    if (query.createdFrom || query.createdTo) {
      where.createdAt = {
        ...(query.createdFrom ? { gte: query.createdFrom } : {}),
        ...(query.createdTo ? { lte: query.createdTo } : {}),
      };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const leads = await this.prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        branch: {
          select: {
            name: true,
          },
        },
      },
    });

    const rows = [
      ['Name', 'Phone', 'Email', 'Source', 'Stage', 'Status', 'Branch', 'Next Follow-up', 'Created At'],
      ...leads.map((lead) => [
        lead.name,
        lead.phone ?? '',
        lead.email ?? '',
        lead.source ?? '',
        lead.stageKey ?? '',
        lead.status,
        lead.branch?.name ?? '',
        lead.nextFollowUpAt?.toISOString() ?? '',
        lead.createdAt.toISOString(),
      ]),
    ];

    return this.toCsv(rows);
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
            purposeKey: true,
            purposeLabelSnapshot: true,
            scheduledAt: true,
            done: true,
            note: true,
            escalatedAt: true,
            secondEscalatedAt: true,
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
      followUps: lead.followUps.map((followUp) => ({
        id: followUp.id,
        kind: followUp.kind,
        purposeKey: followUp.purposeKey,
        purposeLabel: followUp.purposeLabelSnapshot,
        scheduledAt: followUp.scheduledAt,
        done: followUp.done,
        note: followUp.note,
        escalatedAt: followUp.escalatedAt,
        secondEscalatedAt: followUp.secondEscalatedAt,
      })),
      activities: lead.activities,
    } as LeadDetail;
  }

  async create(dto: CreateLeadDto, options: CreateLeadOptions = {}): Promise<Lead> {
    const tenant = getTenantContext();
    const actor = options.actor;
    const tenantId = tenant?.tenantId ?? '';

    const defaultStage = await this.tenantConfig.getDefaultStage(tenant?.tenantId);
    const resolvedStage = dto.stageKey
      ? await this.tenantConfig.resolveStage(dto.stageKey, tenant?.tenantId)
      : defaultStage;

    if (!resolvedStage) {
      throw new BadRequestException('Invalid stage key for tenant pipeline');
    }

    this.ensureActiveLeadFollowUp(resolvedStage.internalStatus, dto.nextFollowUpAt);

    const normalizedFollowUp = new Date(dto.nextFollowUpAt);
    const initialPurpose = await this.tenantConfig.resolveFollowupPurpose({
      stageKey: resolvedStage.key,
      purposeKey: dto.followUpPurposeKey,
      tenantId,
    });

    const serializedIntakeData = dto.intakeData
      ? (JSON.parse(JSON.stringify(dto.intakeData)) as Prisma.InputJsonValue)
      : undefined;
    let selectedBranchId = dto.branchId ?? null;
    const tenantSelectedBranchId = tenant?.selectedBranchId;

    if (!selectedBranchId && tenantSelectedBranchId) {
      selectedBranchId = tenantSelectedBranchId;
    }

    if (!selectedBranchId && actor?.branchScope.scopeType === BranchScopeType.SELECTED) {
      selectedBranchId = actor.branchScope.branchIds[0] ?? null;
    }

    if (!selectedBranchId && tenant?.tenantId) {
      const defaultBranch = await this.prisma.branch.findFirst({
        where: { tenantId: tenant.tenantId, isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      selectedBranchId = defaultBranch?.id ?? null;
    }

    if (actor) {
      this.branchScope.ensureBranchAccess(actor, selectedBranchId);
    }

    const effectiveOwnerId = await this.resolveEffectiveOwnerId({
      explicitOwnerId: dto.ownerId ?? null,
      actorId: actor?.id ?? null,
      tenantId,
      branchId: selectedBranchId,
    });

    const lead = await this.prisma.lead.create({
      data: {
        tenantId,
        ownerId: effectiveOwnerId,
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
        assignedTo: effectiveOwnerId,
        scheduledAt: normalizedFollowUp,
        kind: 'GENERAL',
        purposeKey: initialPurpose.key,
        purposeLabelSnapshot: initialPurpose.label,
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

    await this.queue.scheduleFollowupNotifications(
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

    this.publishLeadRealtimeInvalidations({
      tenantId: lead.tenantId,
      branchId: lead.branchId,
      leadId: lead.id,
      reason: 'lead.created',
    });
    this.realtimePublisher.publishInvalidation({
      event: REALTIME_INVALIDATION_EVENTS.TODAY_INVALIDATE,
      tenantId: lead.tenantId,
      branchId: lead.branchId ?? undefined,
      leadId: lead.id,
      reason: 'lead.created',
      source: 'api',
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
    const isActiveLeadStatus = ACTIVE_LEAD_STATUSES.includes(resolvedStatus);
    let nextFollowUpAt = isActiveLeadStatus ? existing.nextFollowUpAt : null;

    if (dto.nextFollowUpAt && isActiveLeadStatus) {
      nextFollowUpAt = await this.tenantConfig.normalizeToBusinessWindow(new Date(dto.nextFollowUpAt));
    }

    if (isActiveLeadStatus && !nextFollowUpAt) {
      throw new BadRequestException('Every active lead must have a next follow-up time');
    }

    const nextFollowUpPurpose = isActiveLeadStatus
      ? await this.tenantConfig.resolveFollowupPurpose({
          stageKey: nextStage.key,
          purposeKey: dto.followUpPurposeKey,
          tenantId: tenant?.tenantId,
        })
      : null;

    const {
      updatedLead: updated,
      followUpToReschedule,
      followUpIdsToCancel,
    } = await this.prisma.$transaction(async (tx) => {
      const pendingFollowUpIdsToCancel: string[] = [];
      let followUpToRescheduleFromStatus: { followUpId: string; runAt: Date } | null = null;

      if (!isActiveLeadStatus) {
        const pendingFollowUps = await tx.followUp.findMany({
          where: {
            tenantId: existing.tenantId,
            leadId: existing.id,
            done: false,
          },
          select: { id: true },
        });

        if (pendingFollowUps.length > 0) {
          const pendingFollowUpIds = pendingFollowUps.map((followUp) => followUp.id);
          pendingFollowUpIdsToCancel.push(...pendingFollowUpIds);

          await tx.followUp.updateMany({
            where: {
              id: { in: pendingFollowUpIds },
            },
            data: {
              done: true,
              doneAt: new Date(),
            },
          });

          await tx.leadActivity.create({
            data: {
              tenantId: existing.tenantId,
              leadId: existing.id,
              actorId: actor?.id ?? null,
              type: 'followup.auto.closed',
              message: `${pendingFollowUpIds.length} pending follow-up task${pendingFollowUpIds.length === 1 ? '' : 's'} auto-closed because lead moved to ${nextStage.label}`,
            },
          });
        }
      } else if (nextFollowUpAt && nextFollowUpPurpose) {
        const pendingGeneralFollowUp = await tx.followUp.findFirst({
          where: {
            tenantId: existing.tenantId,
            leadId: existing.id,
            done: false,
            kind: 'GENERAL',
          },
          orderBy: { scheduledAt: 'asc' },
          select: { id: true, scheduledAt: true },
        });

        if (pendingGeneralFollowUp) {
          await tx.followUp.update({
            where: { id: pendingGeneralFollowUp.id },
            data: {
              scheduledAt: dto.nextFollowUpAt ? nextFollowUpAt : pendingGeneralFollowUp.scheduledAt,
              purposeKey: nextFollowUpPurpose.key,
              purposeLabelSnapshot: nextFollowUpPurpose.label,
            },
          });

          followUpToRescheduleFromStatus = {
            followUpId: pendingGeneralFollowUp.id,
            runAt: dto.nextFollowUpAt ? nextFollowUpAt : pendingGeneralFollowUp.scheduledAt,
          };

          await tx.leadActivity.create({
            data: {
              tenantId: existing.tenantId,
              leadId: existing.id,
              actorId: actor?.id ?? null,
              type: dto.nextFollowUpAt ? 'followup.rescheduled' : 'followup.purpose.updated',
              message: dto.nextFollowUpAt
                ? `Follow-up rescheduled to ${nextFollowUpAt.toISOString()} from status update`
                : `Follow-up purpose updated to ${nextFollowUpPurpose.label} from status update`,
            },
          });
        } else {
          const createdFollowUp = await tx.followUp.create({
            data: {
              tenantId: existing.tenantId,
              leadId: existing.id,
              assignedTo: existing.ownerId,
              kind: 'GENERAL',
              scheduledAt: nextFollowUpAt,
              purposeKey: nextFollowUpPurpose.key,
              purposeLabelSnapshot: nextFollowUpPurpose.label,
              note: 'Auto-created from status update',
            },
          });

          followUpToRescheduleFromStatus = {
            followUpId: createdFollowUp.id,
            runAt: nextFollowUpAt,
          };

          await tx.leadActivity.create({
            data: {
              tenantId: existing.tenantId,
              leadId: existing.id,
              actorId: actor?.id ?? null,
              type: 'followup.scheduled',
              message: `Follow-up auto-created for ${nextFollowUpAt.toISOString()} from status update`,
            },
          });
        }
      }

      const updatedLead = await tx.lead.update({
        where: { id },
        data: {
          status: resolvedStatus,
          stageKey: nextStage.key,
          nextFollowUpAt: isActiveLeadStatus ? nextFollowUpAt : null,
        },
      });

      await tx.leadActivity.create({
        data: {
          tenantId: updatedLead.tenantId,
          leadId: updatedLead.id,
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

      return {
        updatedLead,
        followUpToReschedule: followUpToRescheduleFromStatus,
        followUpIdsToCancel: pendingFollowUpIdsToCancel,
      };
    });

    if (followUpToReschedule) {
      await this.queue.rescheduleFollowupNotifications(
        { tenantId: updated.tenantId, followUpId: followUpToReschedule.followUpId },
        followUpToReschedule.runAt,
      );
    }

    if (followUpIdsToCancel.length > 0) {
      await Promise.all(followUpIdsToCancel.map((followUpId) => this.queue.cancelFollowupNotifications(followUpId)));
    }

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

    this.publishLeadRealtimeInvalidations({
      tenantId: updated.tenantId,
      branchId: updated.branchId,
      leadId: updated.id,
      reason: 'lead.status.updated',
    });
    this.realtimePublisher.publishInvalidation({
      event: REALTIME_INVALIDATION_EVENTS.TODAY_INVALIDATE,
      tenantId: updated.tenantId,
      branchId: updated.branchId ?? undefined,
      leadId: updated.id,
      reason: 'lead.status.updated',
      source: 'api',
    });

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

    this.realtimePublisher.publishInvalidation({
      event: REALTIME_INVALIDATION_EVENTS.LEAD_DETAIL_INVALIDATE,
      tenantId: lead.tenantId,
      branchId: lead.branchId ?? undefined,
      leadId: lead.id,
      reason: 'lead.note.added',
      source: 'api',
    });
  }

  private publishLeadRealtimeInvalidations(input: {
    tenantId: string;
    branchId: string | null | undefined;
    leadId: string;
    reason: string;
  }): void {
    this.realtimePublisher.publishInvalidation({
      event: REALTIME_INVALIDATION_EVENTS.LEADS_INVALIDATE,
      tenantId: input.tenantId,
      branchId: input.branchId ?? undefined,
      leadId: input.leadId,
      reason: input.reason,
      source: 'api',
    });

    this.realtimePublisher.publishInvalidation({
      event: REALTIME_INVALIDATION_EVENTS.LEAD_DETAIL_INVALIDATE,
      tenantId: input.tenantId,
      branchId: input.branchId ?? undefined,
      leadId: input.leadId,
      reason: input.reason,
      source: 'api',
    });
  }

  private ensureActiveLeadFollowUp(status: LeadStatus, nextFollowUpAt?: Date): void {
    if (ACTIVE_LEAD_STATUSES.includes(status) && !nextFollowUpAt) {
      throw new BadRequestException('Every active lead must have a next follow-up time');
    }
  }

  private async resolveEffectiveOwnerId(input: {
    explicitOwnerId: string | null;
    actorId: string | null;
    tenantId: string;
    branchId: string | null;
  }): Promise<string | null> {
    if (input.explicitOwnerId) {
      return input.explicitOwnerId;
    }

    if (input.actorId) {
      return input.actorId;
    }

    if (!input.tenantId) {
      return null;
    }

    if (input.branchId) {
      const branchMatchedLogin = await this.prisma.userLoginSummary.findFirst({
        where: {
          tenantId: input.tenantId,
          user: {
            is: {
              status: 'ACTIVE',
              defaultBranchId: input.branchId,
            },
          },
        },
        orderBy: {
          firstLoggedInAt: 'asc',
        },
        select: {
          userId: true,
        },
      });

      if (branchMatchedLogin) {
        return branchMatchedLogin.userId;
      }
    }

    const tenantLogin = await this.prisma.userLoginSummary.findFirst({
      where: {
        tenantId: input.tenantId,
        user: {
          is: {
            status: 'ACTIVE',
          },
        },
      },
      orderBy: {
        firstLoggedInAt: 'asc',
      },
      select: {
        userId: true,
      },
    });

    if (tenantLogin) {
      return tenantLogin.userId;
    }

    const fallbackUser = await this.prisma.user.findFirst({
      where: {
        tenantId: input.tenantId,
        status: 'ACTIVE',
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
      },
    });

    return fallbackUser?.id ?? null;
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

  private toCsv(rows: string[][]): string {
    return rows
      .map((row) =>
        row
          .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');
  }
}
