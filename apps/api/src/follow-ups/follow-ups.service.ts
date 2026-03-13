import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ACTIVE_LEAD_STATUSES,
  AuthUser,
  CreateFollowUpDto,
  DOMAIN_EVENTS,
  ListTodayFollowUpsQueryDto,
  REALTIME_INVALIDATION_EVENTS,
  TodayFollowUp,
  TodayFollowUpListResponse,
} from '@leadops/shared';
import { Prisma } from '@prisma/client';
import { BranchScopeService } from '../access-control/branch-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantContext } from '../tenant/tenant.store';
import { TenantConfigService } from '../tenant/tenant-config.service';
import { QueueService } from '../queue/queue.service';
import { DomainEventsService } from '../events/domain-events.service';
import { RealtimePublisherService } from '../realtime/realtime.publisher.service';
import { buildEmptyPaginatedResponse, buildPaginatedResponse } from '../common/utils/pagination.util';

@Injectable()
export class FollowUpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
    private readonly queue: QueueService,
    private readonly domainEvents: DomainEventsService,
    private readonly branchScope: BranchScopeService,
    private readonly realtimePublisher: RealtimePublisherService,
  ) {}

  async findToday(user: AuthUser, query: ListTodayFollowUpsQueryDto): Promise<TodayFollowUpListResponse> {
    const tenant = getTenantContext();
    const selectedBranchId = tenant?.selectedBranchId;
    const page = query.page;
    const pageSize = query.pageSize;
    const search = query.search?.trim();
    const includeOverdue = query.includeOverdue;

    if (query.branchId) {
      this.branchScope.ensureBranchAccess(user, query.branchId);
    }

    if (selectedBranchId && query.branchId && query.branchId !== selectedBranchId) {
      return buildEmptyPaginatedResponse<TodayFollowUp>(page, pageSize);
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const branchIds = this.branchScope.branchIdsFor(user);
    const leadWhere: Prisma.LeadWhereInput = {};

    if (selectedBranchId) {
      this.branchScope.ensureBranchAccess(user, selectedBranchId);
      leadWhere.branchId = selectedBranchId;
    } else if (query.branchId) {
      leadWhere.branchId = query.branchId;
    } else if (branchIds) {
      leadWhere.branchId = {
        in: branchIds,
      };
    }

    if (search) {
      leadWhere.OR = [
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
      ];
    }

    const where: Prisma.FollowUpWhereInput = {
      tenantId: tenant?.tenantId,
      done: false,
      scheduledAt: includeOverdue ? { lte: end } : { gte: start, lte: end },
    };

    if (Object.keys(leadWhere).length > 0) {
      where.lead = { is: leadWhere };
    }

    const [followUps, total] = await this.prisma.$transaction([
      this.prisma.followUp.findMany({
        where,
        include: {
          lead: {
            select: {
              id: true,
              name: true,
              phone: true,
              status: true,
              branchId: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { scheduledAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.followUp.count({ where }),
    ]);

    return buildPaginatedResponse(
      followUps.map((item) => ({
        ...item,
        assignedUser: item.user,
      })) as TodayFollowUp[],
      page,
      pageSize,
      total,
    );
  }

  async create(dto: CreateFollowUpDto, actor: AuthUser): Promise<{ id: string }> {
    const tenant = getTenantContext();
    const lead = await this.prisma.lead.findFirst({
      where: { id: dto.leadId, tenantId: tenant?.tenantId },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    this.branchScope.ensureLeadAccess(actor, lead);

    const scheduledAt = await this.tenantConfig.normalizeToBusinessWindow(dto.scheduledAt);

    const followUp = await this.prisma.followUp.create({
      data: {
        tenantId: lead.tenantId,
        leadId: lead.id,
        assignedTo: dto.assignedTo,
        kind: 'GENERAL',
        scheduledAt,
        note: dto.note,
      },
    });

    await this.prisma.lead.update({
      where: { id: lead.id },
      data: { nextFollowUpAt: scheduledAt },
    });

    await this.prisma.leadActivity.create({
      data: {
        tenantId: lead.tenantId,
        leadId: lead.id,
        actorId: actor.id,
        type: 'followup.scheduled',
        message: 'Follow-up scheduled',
      },
    });

    await this.queue.scheduleFollowupReminder(
      { tenantId: lead.tenantId, followUpId: followUp.id },
      scheduledAt,
    );

    this.publishFollowupRealtimeInvalidations({
      tenantId: lead.tenantId,
      branchId: lead.branchId,
      leadId: lead.id,
      reason: 'followup.created',
    });

    return { id: followUp.id };
  }

  async markDone(id: string, actor: AuthUser): Promise<{ success: boolean }> {
    const tenant = getTenantContext();

    const followUp = await this.prisma.followUp.findFirst({
      where: { id, tenantId: tenant?.tenantId },
      include: { lead: true },
    });

    if (!followUp) {
      throw new NotFoundException('Follow-up not found');
    }

    this.branchScope.ensureLeadAccess(actor, followUp.lead);

    await this.prisma.followUp.update({
      where: { id },
      data: {
        done: true,
        doneAt: new Date(),
      },
    });

    await this.queue.cancelFollowupReminder(followUp.id);

    await this.prisma.leadActivity.create({
      data: {
        tenantId: followUp.tenantId,
        leadId: followUp.leadId,
        actorId: actor.id,
        type: 'followup.completed',
        message: 'Follow-up marked as done',
      },
    });

    if (ACTIVE_LEAD_STATUSES.includes(followUp.lead.status as unknown as (typeof ACTIVE_LEAD_STATUSES)[number])) {
      const nextPending = await this.prisma.followUp.findFirst({
        where: {
          tenantId: followUp.tenantId,
          leadId: followUp.leadId,
          done: false,
        },
        orderBy: { scheduledAt: 'asc' },
      });

      if (!nextPending) {
        const autoScheduled = await this.tenantConfig.normalizeToBusinessWindow(
          new Date(Date.now() + 24 * 60 * 60 * 1000),
        );

        const generated = await this.prisma.followUp.create({
          data: {
            tenantId: followUp.tenantId,
            leadId: followUp.leadId,
            assignedTo: followUp.assignedTo,
            kind: 'GENERAL',
            scheduledAt: autoScheduled,
            note: 'Auto-generated to keep active lead follow-up continuity',
          },
        });

        await this.prisma.lead.update({
          where: { id: followUp.leadId },
          data: { nextFollowUpAt: autoScheduled },
        });

        await this.queue.scheduleFollowupReminder(
          { tenantId: followUp.tenantId, followUpId: generated.id },
          autoScheduled,
        );
      }
    } else {
      await this.prisma.lead.update({
        where: { id: followUp.leadId },
        data: { nextFollowUpAt: null },
      });
    }

    this.domainEvents.emit(DOMAIN_EVENTS.FOLLOWUP_DUE, {
      tenantId: followUp.tenantId,
      leadId: followUp.leadId,
      followUpId: followUp.id,
    });

    this.publishFollowupRealtimeInvalidations({
      tenantId: followUp.tenantId,
      branchId: followUp.lead.branchId,
      leadId: followUp.leadId,
      reason: 'followup.completed',
    });

    return { success: true };
  }

  private publishFollowupRealtimeInvalidations(input: {
    tenantId: string;
    branchId: string | null | undefined;
    leadId: string;
    reason: string;
  }): void {
    this.realtimePublisher.publishInvalidation({
      event: REALTIME_INVALIDATION_EVENTS.TODAY_INVALIDATE,
      tenantId: input.tenantId,
      branchId: input.branchId ?? undefined,
      leadId: input.leadId,
      reason: input.reason,
      source: 'api',
    });

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
}
