import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  ACTIVE_LEAD_STATUSES,
  ANALYTICS_QUEUE,
  DASHBOARD_ANALYTICS_JOB_KINDS,
  DASHBOARD_ANALYTICS_JOB_NAMES,
  MilestoneKey,
  type DashboardAnalyticsJob,
  type DashboardAnalyticsJobKind,
  type DashboardRebuildTenantJob,
  type DashboardRefreshBranchJob,
} from '@leadops/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ALL_BRANCHES_SCOPE_KEY = '__all_branches__';
const UNASSIGNED_SCOPE_KEY = '__unassigned__';
const NULL_STAGE_KEY = '__no_stage__';
const UNKNOWN_SOURCE_KEY = 'unknown';
const DASHBOARD_TREND_DAYS = 14;

interface DailyCountsByDate {
  leadsCreatedByDate: Map<string, number>;
  bookingsMarkedByDate: Map<string, number>;
  followupsCompletedByDate: Map<string, number>;
}

interface BranchProjectionSnapshot {
  metrics: {
    newCount: number;
    pendingCount: number;
    wonCount: number;
    lostCount: number;
    activeCount: number;
    pendingFollowups: number;
  };
  stageStatusCounts: Array<{
    stageKey: string;
    status: string;
    count: number;
  }>;
  sourceCounts: Array<{
    source: string;
    count: number;
  }>;
  dailyCounts: Array<{
    metricDate: Date;
    leadsCreated: number;
    bookingsMarked: number;
    followupsCompleted: number;
  }>;
}

@Processor(ANALYTICS_QUEUE)
export class DashboardProjectionProcessor extends WorkerHost {
  private readonly logger = new Logger(DashboardProjectionProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<DashboardAnalyticsJob>): Promise<void> {
    const kind = this.resolveJobKind(job);

    if (!kind) {
      this.logger.log(`Skipping unknown dashboard analytics job: ${job.name}`);
      return;
    }

    if (kind === DASHBOARD_ANALYTICS_JOB_KINDS.REFRESH_BRANCH) {
      const payload = job.data as DashboardRefreshBranchJob;
      await this.refreshBranchProjection(payload);
      return;
    }

    const payload = job.data as DashboardRebuildTenantJob;
    await this.rebuildTenantProjection(payload);
  }

  private resolveJobKind(job: Job<DashboardAnalyticsJob>): DashboardAnalyticsJobKind | null {
    if (
      job.data?.kind === DASHBOARD_ANALYTICS_JOB_KINDS.REFRESH_BRANCH
      || job.data?.kind === DASHBOARD_ANALYTICS_JOB_KINDS.REBUILD_TENANT
    ) {
      return job.data.kind;
    }

    if (job.name === DASHBOARD_ANALYTICS_JOB_NAMES.REFRESH_BRANCH) {
      return DASHBOARD_ANALYTICS_JOB_KINDS.REFRESH_BRANCH;
    }

    if (job.name === DASHBOARD_ANALYTICS_JOB_NAMES.REBUILD_TENANT) {
      return DASHBOARD_ANALYTICS_JOB_KINDS.REBUILD_TENANT;
    }

    return null;
  }

  private async refreshBranchProjection(payload: DashboardRefreshBranchJob): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const branchId = payload.branchId ?? null;
      const timezone = await this.resolveTenantTimezone(tx, payload.tenantId);
      const bookingStageKeys = await this.resolveBookingStageKeys(tx, payload.tenantId);

      const snapshot = await this.computeBranchSnapshot({
        tx,
        tenantId: payload.tenantId,
        branchId,
        timezone,
        bookingStageKeys,
      });

      await this.persistBranchSnapshot({
        tx,
        tenantId: payload.tenantId,
        branchId,
        snapshot,
        updateAllBranchesState: true,
      });
    });
  }

  private async rebuildTenantProjection(payload: DashboardRebuildTenantJob): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const tenantId = payload.tenantId;
      const timezone = await this.resolveTenantTimezone(tx, tenantId);
      const bookingStageKeys = await this.resolveBookingStageKeys(tx, tenantId);

      await Promise.all([
        tx.dashboardBranchMetric.deleteMany({ where: { tenantId } }),
        tx.dashboardBranchStageStatusCount.deleteMany({ where: { tenantId } }),
        tx.dashboardBranchSourceCount.deleteMany({ where: { tenantId } }),
        tx.dashboardBranchDailyCount.deleteMany({ where: { tenantId } }),
        tx.dashboardProjectionState.deleteMany({ where: { tenantId } }),
      ]);

      const distinctBranchIds = await tx.lead.findMany({
        where: { tenantId },
        select: { branchId: true },
        distinct: ['branchId'],
      });

      const scopeBranchIds = new Set<string | null>(distinctBranchIds.map((row) => row.branchId ?? null));
      scopeBranchIds.add(null);

      const orderedScopeBranchIds = Array.from(scopeBranchIds.values()).sort((left, right) => {
        if (left === right) {
          return 0;
        }

        if (left === null) {
          return -1;
        }

        if (right === null) {
          return 1;
        }

        return left.localeCompare(right);
      });

      for (const branchId of orderedScopeBranchIds) {
        const snapshot = await this.computeBranchSnapshot({
          tx,
          tenantId,
          branchId,
          timezone,
          bookingStageKeys,
        });

        await this.persistBranchSnapshot({
          tx,
          tenantId,
          branchId,
          snapshot,
          updateAllBranchesState: false,
        });
      }

      await this.upsertProjectionState({
        tx,
        tenantId,
        branchId: null,
        scopeKey: ALL_BRANCHES_SCOPE_KEY,
      });
    });
  }

  private async computeBranchSnapshot(input: {
    tx: Prisma.TransactionClient;
    tenantId: string;
    branchId: string | null;
    timezone: string;
    bookingStageKeys: string[];
  }): Promise<BranchProjectionSnapshot> {
    const { tx, tenantId, branchId, timezone, bookingStageKeys } = input;
    const leadWhere = this.buildLeadWhere(tenantId, branchId);
    const pendingFollowupWhere = this.buildFollowUpWhere(tenantId, branchId, { done: false });

    const [statusGroups, pipelineGroups, sourceGroups, pendingFollowups, metricDateKeys] = await Promise.all([
      tx.lead.groupBy({
        by: ['status'],
        where: leadWhere,
        _count: { _all: true },
      }),
      tx.lead.groupBy({
        by: ['stageKey', 'status'],
        where: leadWhere,
        _count: { _all: true },
      }),
      tx.lead.groupBy({
        by: ['source'],
        where: leadWhere,
        _count: { _all: true },
      }),
      tx.followUp.count({ where: pendingFollowupWhere }),
      this.loadMetricDateKeys(tx, timezone),
    ]);

    const countsByStatus = new Map<string, number>(
      statusGroups.map((group) => [group.status, group._count._all]),
    );

    const activeCount = ACTIVE_LEAD_STATUSES.reduce((sum, status) => sum + (countsByStatus.get(status) ?? 0), 0);

    const stageStatusCounts = pipelineGroups.map((group) => ({
      stageKey: group.stageKey ?? NULL_STAGE_KEY,
      status: group.status,
      count: group._count._all,
    }));

    const sourceCounts = sourceGroups.map((group) => ({
      source: this.normalizeSource(group.source),
      count: group._count._all,
    }));

    const dailyCountsByDate = await this.loadDailyCountsByDate({
      tx,
      tenantId,
      branchId,
      timezone,
      bookingStageKeys,
    });

    const dailyCounts = metricDateKeys.map((metricDate) => ({
      metricDate: new Date(`${metricDate}T00:00:00.000Z`),
      leadsCreated: dailyCountsByDate.leadsCreatedByDate.get(metricDate) ?? 0,
      bookingsMarked: dailyCountsByDate.bookingsMarkedByDate.get(metricDate) ?? 0,
      followupsCompleted: dailyCountsByDate.followupsCompletedByDate.get(metricDate) ?? 0,
    }));

    return {
      metrics: {
        newCount: countsByStatus.get('NEW') ?? 0,
        pendingCount: countsByStatus.get('PENDING') ?? 0,
        wonCount: countsByStatus.get('WON') ?? 0,
        lostCount: countsByStatus.get('LOST') ?? 0,
        activeCount,
        pendingFollowups,
      },
      stageStatusCounts,
      sourceCounts,
      dailyCounts,
    };
  }

  private async persistBranchSnapshot(input: {
    tx: Prisma.TransactionClient;
    tenantId: string;
    branchId: string | null;
    snapshot: BranchProjectionSnapshot;
    updateAllBranchesState: boolean;
  }): Promise<void> {
    const { tx, tenantId, branchId, snapshot, updateAllBranchesState } = input;
    const scopeKey = this.scopeKey(branchId);

    await tx.dashboardBranchMetric.upsert({
      where: {
        tenantId_scopeKey: {
          tenantId,
          scopeKey,
        },
      },
      create: {
        tenantId,
        branchId,
        scopeKey,
        newCount: snapshot.metrics.newCount,
        pendingCount: snapshot.metrics.pendingCount,
        wonCount: snapshot.metrics.wonCount,
        lostCount: snapshot.metrics.lostCount,
        activeCount: snapshot.metrics.activeCount,
        pendingFollowups: snapshot.metrics.pendingFollowups,
      },
      update: {
        branchId,
        newCount: snapshot.metrics.newCount,
        pendingCount: snapshot.metrics.pendingCount,
        wonCount: snapshot.metrics.wonCount,
        lostCount: snapshot.metrics.lostCount,
        activeCount: snapshot.metrics.activeCount,
        pendingFollowups: snapshot.metrics.pendingFollowups,
      },
    });

    await Promise.all([
      tx.dashboardBranchStageStatusCount.deleteMany({
        where: {
          tenantId,
          scopeKey,
        },
      }),
      tx.dashboardBranchSourceCount.deleteMany({
        where: {
          tenantId,
          scopeKey,
        },
      }),
      tx.dashboardBranchDailyCount.deleteMany({
        where: {
          tenantId,
          scopeKey,
        },
      }),
    ]);

    if (snapshot.stageStatusCounts.length > 0) {
      await tx.dashboardBranchStageStatusCount.createMany({
        data: snapshot.stageStatusCounts.map((row) => ({
          tenantId,
          branchId,
          scopeKey,
          stageKey: row.stageKey,
          status: row.status,
          count: row.count,
        })),
      });
    }

    if (snapshot.sourceCounts.length > 0) {
      await tx.dashboardBranchSourceCount.createMany({
        data: snapshot.sourceCounts.map((row) => ({
          tenantId,
          branchId,
          scopeKey,
          source: row.source,
          count: row.count,
        })),
      });
    }

    if (snapshot.dailyCounts.length > 0) {
      await tx.dashboardBranchDailyCount.createMany({
        data: snapshot.dailyCounts.map((row) => ({
          tenantId,
          branchId,
          scopeKey,
          metricDate: row.metricDate,
          leadsCreated: row.leadsCreated,
          bookingsMarked: row.bookingsMarked,
          followupsCompleted: row.followupsCompleted,
        })),
      });
    }

    await this.upsertProjectionState({
      tx,
      tenantId,
      branchId,
      scopeKey,
    });

    if (updateAllBranchesState) {
      await this.upsertProjectionState({
        tx,
        tenantId,
        branchId: null,
        scopeKey: ALL_BRANCHES_SCOPE_KEY,
      });
    }
  }

  private async upsertProjectionState(input: {
    tx: Prisma.TransactionClient;
    tenantId: string;
    branchId: string | null;
    scopeKey: string;
  }): Promise<void> {
    const { tx, tenantId, branchId, scopeKey } = input;

    await tx.dashboardProjectionState.upsert({
      where: {
        tenantId_scopeKey: {
          tenantId,
          scopeKey,
        },
      },
      create: {
        tenantId,
        branchId,
        scopeKey,
        refreshedAt: new Date(),
      },
      update: {
        branchId,
        refreshedAt: new Date(),
      },
    });
  }

  private async loadMetricDateKeys(
    tx: Prisma.TransactionClient,
    timezone: string,
  ): Promise<string[]> {
    const rows = await tx.$queryRaw<Array<{ metric_date: string }>>(Prisma.sql`
      SELECT to_char((timezone(${timezone}, NOW())::date - day_offset.offset), 'YYYY-MM-DD') AS metric_date
      FROM generate_series(${DASHBOARD_TREND_DAYS - 1}, 0, -1) AS day_offset(offset)
    `);

    return rows.map((row) => row.metric_date);
  }

  private async loadDailyCountsByDate(input: {
    tx: Prisma.TransactionClient;
    tenantId: string;
    branchId: string | null;
    timezone: string;
    bookingStageKeys: string[];
  }): Promise<DailyCountsByDate> {
    const { tx, tenantId, branchId, timezone, bookingStageKeys } = input;
    const dayOffset = DASHBOARD_TREND_DAYS - 1;

    const branchLeadFilterSql = branchId === null
      ? Prisma.sql`AND l."branch_id" IS NULL`
      : Prisma.sql`AND l."branch_id" = ${branchId}`;

    const leadsCreatedRows = await tx.$queryRaw<Array<{ metric_date: string; value: number }>>(Prisma.sql`
      SELECT to_char(timezone(${timezone}, l."created_at")::date, 'YYYY-MM-DD') AS metric_date,
             COUNT(*)::int AS value
      FROM "leads" l
      WHERE l."tenant_id" = ${tenantId}
        ${branchLeadFilterSql}
        AND timezone(${timezone}, l."created_at")::date >= (timezone(${timezone}, NOW())::date - ${dayOffset})
        AND timezone(${timezone}, l."created_at")::date <= timezone(${timezone}, NOW())::date
      GROUP BY metric_date
    `);

    const bookingsMarkedRows = await tx.$queryRaw<Array<{ metric_date: string; value: number }>>(Prisma.sql`
      SELECT to_char(timezone(${timezone}, l."updated_at")::date, 'YYYY-MM-DD') AS metric_date,
             COUNT(*)::int AS value
      FROM "leads" l
      WHERE l."tenant_id" = ${tenantId}
        ${branchLeadFilterSql}
        AND l."stage_key" IN (${Prisma.join(bookingStageKeys)})
        AND timezone(${timezone}, l."updated_at")::date >= (timezone(${timezone}, NOW())::date - ${dayOffset})
        AND timezone(${timezone}, l."updated_at")::date <= timezone(${timezone}, NOW())::date
      GROUP BY metric_date
    `);

    const followupsCompletedRows = await tx.$queryRaw<Array<{ metric_date: string; value: number }>>(Prisma.sql`
      SELECT to_char(timezone(${timezone}, fu."done_at")::date, 'YYYY-MM-DD') AS metric_date,
             COUNT(*)::int AS value
      FROM "follow_ups" fu
      JOIN "leads" l ON l."id" = fu."lead_id"
      WHERE fu."tenant_id" = ${tenantId}
        AND fu."done" = true
        AND fu."done_at" IS NOT NULL
        AND l."tenant_id" = ${tenantId}
        ${branchLeadFilterSql}
        AND timezone(${timezone}, fu."done_at")::date >= (timezone(${timezone}, NOW())::date - ${dayOffset})
        AND timezone(${timezone}, fu."done_at")::date <= timezone(${timezone}, NOW())::date
      GROUP BY metric_date
    `);

    return {
      leadsCreatedByDate: new Map(leadsCreatedRows.map((row) => [row.metric_date, row.value])),
      bookingsMarkedByDate: new Map(bookingsMarkedRows.map((row) => [row.metric_date, row.value])),
      followupsCompletedByDate: new Map(followupsCompletedRows.map((row) => [row.metric_date, row.value])),
    };
  }

  private async resolveTenantTimezone(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
    const config = await tx.tenantConfig.findUnique({
      where: { tenantId },
      select: { timezone: true },
    });

    return config?.timezone?.trim() || 'UTC';
  }

  private async resolveBookingStageKeys(tx: Prisma.TransactionClient, tenantId: string): Promise<string[]> {
    const config = await tx.tenantConfig.findUnique({
      where: { tenantId },
      select: {
        industryPreset: true,
        displayConfig: true,
      },
    });

    if (!config) {
      return ['BOOKING_CONFIRMED'];
    }

    const displayConfig = config.displayConfig as {
      pipelineConfig?: {
        stages?: Array<{ key?: string; milestone?: string }>;
      };
    } | null;

    const configuredStageKeys = displayConfig?.pipelineConfig?.stages
      ?.filter((stage) => stage.milestone === MilestoneKey.BOOKING_CONFIRMED)
      .map((stage) => stage.key)
      .filter((key): key is string => typeof key === 'string' && key.trim().length > 0);

    if (configuredStageKeys && configuredStageKeys.length > 0) {
      return configuredStageKeys;
    }

    return ['BOOKING_CONFIRMED'];
  }

  private buildLeadWhere(tenantId: string, branchId: string | null): Prisma.LeadWhereInput {
    if (branchId === null) {
      return {
        tenantId,
        branchId: null,
      };
    }

    return {
      tenantId,
      branchId,
    };
  }

  private buildFollowUpWhere(
    tenantId: string,
    branchId: string | null,
    input: Omit<Prisma.FollowUpWhereInput, 'tenantId' | 'lead'>,
  ): Prisma.FollowUpWhereInput {
    return {
      tenantId,
      ...input,
      lead: {
        is: {
          branchId,
        },
      },
    };
  }

  private normalizeSource(source: string | null): string {
    const normalized = source?.trim();
    return normalized && normalized.length > 0 ? normalized : UNKNOWN_SOURCE_KEY;
  }

  private scopeKey(branchId: string | null): string {
    return branchId ?? UNASSIGNED_SCOPE_KEY;
  }
}
