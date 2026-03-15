import { Injectable } from '@nestjs/common';
import {
  ACTIVE_LEAD_STATUSES,
  AuthUser,
  DashboardAnalytics,
  DashboardBreakdownItem,
  DashboardComparisonItem,
  DashboardStats,
  DashboardTrendPoint,
  IndustryPreset,
  MilestoneKey,
} from '@leadops/shared';
import { Prisma } from '@prisma/client';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { BranchScopeService } from '../access-control/branch-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantConfigService } from '../tenant/tenant-config.service';
import { getTenantContext } from '../tenant/tenant.store';

interface DayBucket {
  date: string;
  label: string;
  start: Date;
  end: Date;
}

interface BranchSummary {
  id: string;
  name: string;
}

const PROJECTION_STALE_MS = 10_000;
const ALL_BRANCHES_SCOPE_KEY = '__all_branches__';
const NULL_STAGE_KEY = '__no_stage__';
const UNKNOWN_SOURCE_KEY = 'unknown';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
    private readonly branchScope: BranchScopeService,
  ) {}

  async getStats(user: AuthUser): Promise<DashboardStats> {
    const tenant = getTenantContext();
    const tenantId = tenant?.tenantId;
    const selectedBranchId = tenant?.selectedBranchId;

    const [profile, settings] = await Promise.all([
      this.tenantConfig.getTenantProfile(tenantId),
      this.tenantConfig.getSettings(tenantId),
    ]);

    const now = new Date();
    const timezone = settings.timezone;
    const start = this.startOfDay(now, timezone);
    const end = this.endOfDay(now, timezone);
    const dayBuckets = this.buildDayBuckets(now, timezone, 14);
    const trendStart = dayBuckets[0]?.start ?? start;

    const displayConfig = profile.displayConfig;
    const bookingStageKeys = displayConfig.pipelineConfig.stages
      .filter((stage) => stage.milestone === MilestoneKey.BOOKING_CONFIRMED)
      .map((stage) => stage.key);

    const branchIds = this.resolveBranchIds(user, selectedBranchId);
    const leadScopeWhere = this.buildLeadWhere(tenantId, branchIds);
    const pendingFollowupWhere = this.buildFollowUpWhere(tenantId, branchIds, { done: false });
    const accessibleBranches = await this.loadAccessibleBranches(tenantId, branchIds);
    const shouldCompareBranches = !selectedBranchId && accessibleBranches.length > 1;

    const projectedStats = await this.loadProjectedStatsIfFresh({
      tenantId,
      branchIds,
      now,
      dayBuckets,
      shouldCompareBranches,
    });

    if (projectedStats) {
      const liveOnly = await this.loadLiveOnlyMetrics({
        leadScopeWhere,
        pendingFollowupWhere,
        start,
        end,
        now,
      });

      const analytics = this.buildProjectedAnalytics({
        buckets: dayBuckets,
        displayConfig,
        industryPreset: profile.industryPreset,
        projectedStats,
        overdueFollowups: liveOnly.overdueFollowups,
        dueTodayFollowups: liveOnly.dueTodayFollowups,
        escalatedFollowups: liveOnly.escalatedFollowups,
        completedTodayFollowups: liveOnly.completedTodayFollowups,
        accessibleBranches,
        shouldCompareBranches,
      });

      return {
        new: projectedStats.newCount,
        pending: projectedStats.pendingCount,
        missed: liveOnly.missedFollowups,
        won: projectedStats.wonCount,
        lost: projectedStats.lostCount,
        avgResponseMinutes: liveOnly.avgResponseMinutes,
        enquiriesToday: projectedStats.enquiriesToday,
        bookingsToday: projectedStats.bookingsToday,
        pendingFollowups: projectedStats.pendingFollowups,
        missedFollowups: liveOnly.missedFollowups,
        postReportFollowupsDue: liveOnly.postReportFollowupsDue,
        analytics,
      };
    }

    const [
      newCount,
      pendingCount,
      wonCount,
      lostCount,
      pendingFollowups,
      missedFollowups,
      enquiriesToday,
      bookingsToday,
      postReportFollowupsDue,
      responseSample,
      trendPrimaryRows,
      trendSecondaryRows,
      completedTrendRows,
      pipelineGroups,
      overdueFollowups,
      dueTodayFollowups,
      escalatedFollowups,
      completedTodayFollowups,
      branchLeadGroups,
      branchPendingFollowups,
      sourceGroups,
    ] = await Promise.all([
      this.prisma.lead.count({ where: { ...leadScopeWhere, status: 'NEW' } }),
      this.prisma.lead.count({ where: { ...leadScopeWhere, status: 'PENDING' } }),
      this.prisma.lead.count({ where: { ...leadScopeWhere, status: 'WON' } }),
      this.prisma.lead.count({ where: { ...leadScopeWhere, status: 'LOST' } }),
      this.prisma.followUp.count({ where: pendingFollowupWhere }),
      this.prisma.followUp.count({
        where: {
          ...pendingFollowupWhere,
          scheduledAt: { lt: now },
        },
      }),
      this.prisma.lead.count({
        where: {
          ...leadScopeWhere,
          createdAt: { gte: start, lte: end },
        },
      }),
      this.prisma.lead.count({
        where: {
          ...leadScopeWhere,
          stageKey: { in: bookingStageKeys.length > 0 ? bookingStageKeys : ['BOOKING_CONFIRMED'] },
          updatedAt: { gte: start, lte: end },
        },
      }),
      this.prisma.followUp.count({
        where: {
          ...pendingFollowupWhere,
          kind: 'POST_REPORT',
          scheduledAt: { lte: end },
        },
      }),
      this.prisma.lead.findMany({
        where: leadScopeWhere,
        include: {
          followUps: {
            take: 1,
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
          },
        },
        take: 100,
      }),
      this.prisma.lead.findMany({
        where: {
          ...leadScopeWhere,
          createdAt: { gte: trendStart, lte: end },
        },
        select: { createdAt: true },
      }),
      this.prisma.lead.findMany({
        where: {
          ...leadScopeWhere,
          ...(profile.industryPreset === IndustryPreset.GENERIC
            ? { status: 'WON' }
            : { stageKey: { in: bookingStageKeys.length > 0 ? bookingStageKeys : ['BOOKING_CONFIRMED'] } }),
          updatedAt: { gte: trendStart, lte: end },
        },
        select: { updatedAt: true },
      }),
      this.prisma.followUp.findMany({
        where: this.buildFollowUpWhere(tenantId, branchIds, {
          done: true,
          doneAt: { gte: trendStart, lte: end },
        }),
        select: { doneAt: true },
      }),
      this.prisma.lead.groupBy({
        by: ['stageKey', 'status'],
        where: leadScopeWhere,
        _count: { _all: true },
      }),
      this.prisma.followUp.count({
        where: {
          ...pendingFollowupWhere,
          scheduledAt: { lt: start },
          escalatedAt: null,
          secondEscalatedAt: null,
        },
      }),
      this.prisma.followUp.count({
        where: {
          ...pendingFollowupWhere,
          scheduledAt: { gte: start, lte: end },
          escalatedAt: null,
          secondEscalatedAt: null,
        },
      }),
      this.prisma.followUp.count({
        where: {
          ...pendingFollowupWhere,
          OR: [
            { escalatedAt: { not: null } },
            { secondEscalatedAt: { not: null } },
          ],
        },
      }),
      this.prisma.followUp.count({
        where: this.buildFollowUpWhere(tenantId, branchIds, {
          done: true,
          doneAt: { gte: start, lte: end },
        }),
      }),
      shouldCompareBranches
        ? this.prisma.lead.groupBy({
            by: ['branchId'],
            where: {
              ...leadScopeWhere,
              status: { in: ACTIVE_LEAD_STATUSES },
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      shouldCompareBranches
        ? this.prisma.followUp.findMany({
            where: pendingFollowupWhere,
            select: {
              lead: {
                select: {
                  branchId: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      shouldCompareBranches
        ? Promise.resolve([])
        : this.prisma.lead.groupBy({
            by: ['source'],
            where: leadScopeWhere,
            _count: { _all: true },
          }),
    ]);

    const responseTimes = responseSample
      .filter((lead) => lead.followUps.length > 0)
      .map((lead) => {
        const first = lead.followUps[0];
        return (first.createdAt.getTime() - lead.createdAt.getTime()) / 1000 / 60;
      });

    const avgResponseMinutes =
      responseTimes.length === 0
        ? 0
        : Number(
            (responseTimes.reduce((sum, minutes) => sum + minutes, 0) / responseTimes.length).toFixed(
              1,
            ),
          );

    const analytics = this.buildAnalytics({
      buckets: dayBuckets,
      timezone,
      displayConfig,
      industryPreset: profile.industryPreset,
      trendPrimaryRows,
      trendSecondaryRows,
      completedTrendRows,
      pipelineGroups,
      overdueFollowups,
      dueTodayFollowups,
      escalatedFollowups,
      completedTodayFollowups,
      accessibleBranches,
      shouldCompareBranches,
      branchLeadGroups,
      branchPendingFollowups,
      sourceGroups,
    });

    return {
      new: newCount,
      pending: pendingCount,
      missed: missedFollowups,
      won: wonCount,
      lost: lostCount,
      avgResponseMinutes,
      enquiriesToday,
      bookingsToday,
      pendingFollowups,
      missedFollowups,
      postReportFollowupsDue,
      analytics,
    };
  }

  private resolveBranchIds(user: AuthUser, selectedBranchId?: string): string[] | null {
    if (selectedBranchId) {
      this.branchScope.ensureBranchAccess(user, selectedBranchId);
      return [selectedBranchId];
    }

    return this.branchScope.branchIdsFor(user);
  }

  private buildLeadWhere(tenantId: string | undefined, branchIds: string[] | null): Prisma.LeadWhereInput {
    if (!branchIds) {
      return { tenantId };
    }

    if (branchIds.length === 1) {
      return {
        tenantId,
        branchId: branchIds[0],
      };
    }

    return {
      tenantId,
      branchId: {
        in: branchIds,
      },
    };
  }

  private buildFollowUpWhere(
    tenantId: string | undefined,
    branchIds: string[] | null,
    input: Omit<Prisma.FollowUpWhereInput, 'tenantId' | 'lead'>,
  ): Prisma.FollowUpWhereInput {
    if (!branchIds) {
      return {
        tenantId,
        ...input,
      };
    }

    const branchFilter = branchIds.length === 1 ? branchIds[0] : { in: branchIds };

    return {
      tenantId,
      ...input,
      lead: {
        is: {
          branchId: branchFilter,
        },
      },
    };
  }

  private async loadAccessibleBranches(
    tenantId: string | undefined,
    branchIds: string[] | null,
  ): Promise<BranchSummary[]> {
    const where: Prisma.BranchWhereInput = {
      tenantId,
      isActive: true,
    };

    if (branchIds) {
      where.id = {
        in: branchIds,
      };
    }

    return this.prisma.branch.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
      },
    });
  }

  private async loadProjectedStatsIfFresh(input: {
    tenantId: string | undefined;
    branchIds: string[] | null;
    now: Date;
    dayBuckets: DayBucket[];
    shouldCompareBranches: boolean;
  }): Promise<{
    newCount: number;
    pendingCount: number;
    wonCount: number;
    lostCount: number;
    pendingFollowups: number;
    enquiriesToday: number;
    bookingsToday: number;
    trendPrimaryByDate: Map<string, number>;
    trendSecondaryByDate: Map<string, number>;
    trendTertiaryByDate: Map<string, number>;
    pipelineGroups: Array<{
      stageKey: string | null;
      status: string;
      _count: { _all: number };
    }>;
    sourceGroups: Array<{
      source: string | null;
      _count: { _all: number };
    }>;
    branchMetrics: Array<{
      branchId: string | null;
      activeCount: number;
      pendingFollowups: number;
    }>;
  } | null> {
    const { tenantId, branchIds, now, dayBuckets } = input;
    if (!tenantId) {
      return null;
    }

    const isFresh = await this.isProjectedScopeFresh({
      tenantId,
      branchIds,
      now,
    });

    if (!isFresh) {
      return null;
    }

    const dayStart = dayBuckets[0]?.date;
    const dayEnd = dayBuckets[dayBuckets.length - 1]?.date;
    const metricDateFilter = dayStart && dayEnd
      ? {
          gte: new Date(`${dayStart}T00:00:00.000Z`),
          lte: new Date(`${dayEnd}T00:00:00.000Z`),
        }
      : undefined;

    const scopeFilter = this.buildProjectedScopeFilter(branchIds);

    const [metricRows, stageRows, sourceRows, dailyRows] = await Promise.all([
      this.prisma.dashboardBranchMetric.findMany({
        where: {
          tenantId,
          ...scopeFilter,
        },
        select: {
          branchId: true,
          newCount: true,
          pendingCount: true,
          wonCount: true,
          lostCount: true,
          activeCount: true,
          pendingFollowups: true,
        },
      }),
      this.prisma.dashboardBranchStageStatusCount.findMany({
        where: {
          tenantId,
          ...scopeFilter,
        },
        select: {
          stageKey: true,
          status: true,
          count: true,
        },
      }),
      this.prisma.dashboardBranchSourceCount.findMany({
        where: {
          tenantId,
          ...scopeFilter,
        },
        select: {
          source: true,
          count: true,
        },
      }),
      this.prisma.dashboardBranchDailyCount.findMany({
        where: {
          tenantId,
          ...scopeFilter,
          ...(metricDateFilter ? { metricDate: metricDateFilter } : {}),
        },
        select: {
          metricDate: true,
          leadsCreated: true,
          bookingsMarked: true,
          followupsCompleted: true,
        },
      }),
    ]);

    const dailyPrimary = new Map<string, number>();
    const dailySecondary = new Map<string, number>();
    const dailyTertiary = new Map<string, number>();

    for (const row of dailyRows) {
      const key = this.metricDateKey(row.metricDate);
      dailyPrimary.set(key, (dailyPrimary.get(key) ?? 0) + row.leadsCreated);
      dailySecondary.set(key, (dailySecondary.get(key) ?? 0) + row.bookingsMarked);
      dailyTertiary.set(key, (dailyTertiary.get(key) ?? 0) + row.followupsCompleted);
    }

    const stageMap = new Map<string, number>();
    for (const row of stageRows) {
      const stageKey = row.stageKey === NULL_STAGE_KEY ? null : row.stageKey;
      const groupKey = `${stageKey ?? '__null__'}|${row.status}`;
      stageMap.set(groupKey, (stageMap.get(groupKey) ?? 0) + row.count);
    }

    const pipelineGroups = Array.from(stageMap.entries()).map(([key, count]) => {
      const [stageToken, status] = key.split('|');
      return {
        stageKey: stageToken === '__null__' ? null : stageToken,
        status,
        _count: { _all: count },
      };
    });

    const sourceMap = new Map<string, number>();
    for (const row of sourceRows) {
      const source = row.source === UNKNOWN_SOURCE_KEY ? null : row.source;
      const sourceKey = source ?? '__unknown__';
      sourceMap.set(sourceKey, (sourceMap.get(sourceKey) ?? 0) + row.count);
    }

    const sourceGroups = Array.from(sourceMap.entries()).map(([source, count]) => ({
      source: source === '__unknown__' ? null : source,
      _count: { _all: count },
    }));

    const todayKey = dayBuckets[dayBuckets.length - 1]?.date;

    return {
      newCount: metricRows.reduce((sum, row) => sum + row.newCount, 0),
      pendingCount: metricRows.reduce((sum, row) => sum + row.pendingCount, 0),
      wonCount: metricRows.reduce((sum, row) => sum + row.wonCount, 0),
      lostCount: metricRows.reduce((sum, row) => sum + row.lostCount, 0),
      pendingFollowups: metricRows.reduce((sum, row) => sum + row.pendingFollowups, 0),
      enquiriesToday: todayKey ? (dailyPrimary.get(todayKey) ?? 0) : 0,
      bookingsToday: todayKey ? (dailySecondary.get(todayKey) ?? 0) : 0,
      trendPrimaryByDate: dailyPrimary,
      trendSecondaryByDate: dailySecondary,
      trendTertiaryByDate: dailyTertiary,
      pipelineGroups,
      sourceGroups,
      branchMetrics: metricRows.map((row) => ({
        branchId: row.branchId,
        activeCount: row.activeCount,
        pendingFollowups: row.pendingFollowups,
      })),
    };
  }

  private async isProjectedScopeFresh(input: {
    tenantId: string;
    branchIds: string[] | null;
    now: Date;
  }): Promise<boolean> {
    const { tenantId, branchIds, now } = input;
    const cutoff = new Date(now.getTime() - PROJECTION_STALE_MS);

    if (branchIds === null) {
      const state = await this.prisma.dashboardProjectionState.findUnique({
        where: {
          tenantId_scopeKey: {
            tenantId,
            scopeKey: ALL_BRANCHES_SCOPE_KEY,
          },
        },
        select: {
          refreshedAt: true,
        },
      });

      return Boolean(state && state.refreshedAt >= cutoff);
    }

    if (branchIds.length === 0) {
      return true;
    }

    const distinctScopeKeys = Array.from(new Set(branchIds));
    const freshCount = await this.prisma.dashboardProjectionState.count({
      where: {
        tenantId,
        scopeKey: {
          in: distinctScopeKeys,
        },
        refreshedAt: {
          gte: cutoff,
        },
      },
    });

    return freshCount === distinctScopeKeys.length;
  }

  private buildProjectedScopeFilter(
    branchIds: string[] | null,
  ): {
    scopeKey?: {
      in: string[];
    };
  } {
    if (branchIds === null) {
      return {};
    }

    if (branchIds.length === 0) {
      return {
        scopeKey: {
          in: [],
        },
      };
    }

    return {
      scopeKey: {
        in: branchIds,
      },
    };
  }

  private async loadLiveOnlyMetrics(input: {
    leadScopeWhere: Prisma.LeadWhereInput;
    pendingFollowupWhere: Prisma.FollowUpWhereInput;
    start: Date;
    end: Date;
    now: Date;
  }): Promise<{
    missedFollowups: number;
    postReportFollowupsDue: number;
    avgResponseMinutes: number;
    overdueFollowups: number;
    dueTodayFollowups: number;
    escalatedFollowups: number;
    completedTodayFollowups: number;
  }> {
    const { leadScopeWhere, pendingFollowupWhere, start, end, now } = input;

    const [
      missedFollowups,
      postReportFollowupsDue,
      responseSample,
      overdueFollowups,
      dueTodayFollowups,
      escalatedFollowups,
      completedTodayFollowups,
    ] = await Promise.all([
      this.prisma.followUp.count({
        where: {
          ...pendingFollowupWhere,
          scheduledAt: { lt: now },
        },
      }),
      this.prisma.followUp.count({
        where: {
          ...pendingFollowupWhere,
          kind: 'POST_REPORT',
          scheduledAt: { lte: end },
        },
      }),
      this.prisma.lead.findMany({
        where: leadScopeWhere,
        include: {
          followUps: {
            take: 1,
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
          },
        },
        take: 100,
      }),
      this.prisma.followUp.count({
        where: {
          ...pendingFollowupWhere,
          scheduledAt: { lt: start },
          escalatedAt: null,
          secondEscalatedAt: null,
        },
      }),
      this.prisma.followUp.count({
        where: {
          ...pendingFollowupWhere,
          scheduledAt: { gte: start, lte: end },
          escalatedAt: null,
          secondEscalatedAt: null,
        },
      }),
      this.prisma.followUp.count({
        where: {
          ...pendingFollowupWhere,
          OR: [{ escalatedAt: { not: null } }, { secondEscalatedAt: { not: null } }],
        },
      }),
      this.prisma.followUp.count({
        where: {
          ...pendingFollowupWhere,
          done: true,
          doneAt: { gte: start, lte: end },
        },
      }),
    ]);

    const responseTimes = responseSample
      .filter((lead) => lead.followUps.length > 0)
      .map((lead) => {
        const first = lead.followUps[0];
        return (first.createdAt.getTime() - lead.createdAt.getTime()) / 1000 / 60;
      });

    const avgResponseMinutes =
      responseTimes.length === 0
        ? 0
        : Number(
            (responseTimes.reduce((sum, minutes) => sum + minutes, 0) / responseTimes.length).toFixed(
              1,
            ),
          );

    return {
      missedFollowups,
      postReportFollowupsDue,
      avgResponseMinutes,
      overdueFollowups,
      dueTodayFollowups,
      escalatedFollowups,
      completedTodayFollowups,
    };
  }

  private buildProjectedAnalytics(input: {
    buckets: DayBucket[];
    displayConfig: Awaited<ReturnType<TenantConfigService['getDisplayConfig']>>;
    industryPreset: IndustryPreset;
    projectedStats: {
      trendPrimaryByDate: Map<string, number>;
      trendSecondaryByDate: Map<string, number>;
      trendTertiaryByDate: Map<string, number>;
      pipelineGroups: Array<{
        stageKey: string | null;
        status: string;
        _count: { _all: number };
      }>;
      sourceGroups: Array<{
        source: string | null;
        _count: { _all: number };
      }>;
      branchMetrics: Array<{
        branchId: string | null;
        activeCount: number;
        pendingFollowups: number;
      }>;
    };
    overdueFollowups: number;
    dueTodayFollowups: number;
    escalatedFollowups: number;
    completedTodayFollowups: number;
    accessibleBranches: BranchSummary[];
    shouldCompareBranches: boolean;
  }): DashboardAnalytics {
    const {
      buckets,
      displayConfig,
      industryPreset,
      projectedStats,
      overdueFollowups,
      dueTodayFollowups,
      escalatedFollowups,
      completedTodayFollowups,
      accessibleBranches,
      shouldCompareBranches,
    } = input;

    const trendPrimaryLabel = `New ${displayConfig.vocabulary.leadPlural}`;
    const trendSecondaryLabel =
      industryPreset !== IndustryPreset.GENERIC
        ? this.pluralize(displayConfig.vocabulary.bookingLabel)
        : `Won ${displayConfig.vocabulary.leadPlural}`;
    const trendTertiaryLabel = `Completed ${this.pluralize(displayConfig.vocabulary.followupLabel)}`;

    const trendPoints: DashboardTrendPoint[] = buckets.map((bucket) => ({
      date: bucket.date,
      label: bucket.label,
      primary: projectedStats.trendPrimaryByDate.get(bucket.date) ?? 0,
      secondary: projectedStats.trendSecondaryByDate.get(bucket.date) ?? 0,
      tertiary: projectedStats.trendTertiaryByDate.get(bucket.date) ?? 0,
    }));

    const pipelineStageCounts = new Map<string, number>();
    const extraBuckets = new Map<string, DashboardBreakdownItem>();

    for (const group of projectedStats.pipelineGroups) {
      if (group.stageKey) {
        pipelineStageCounts.set(
          group.stageKey,
          (pipelineStageCounts.get(group.stageKey) ?? 0) + group._count._all,
        );
        continue;
      }

      const extraKey = `status:${group.status}`;
      const existing = extraBuckets.get(extraKey);
      extraBuckets.set(extraKey, {
        key: extraKey,
        label: displayConfig.vocabulary.statusLabels[group.status] ?? group.status,
        value: (existing?.value ?? 0) + group._count._all,
      });
    }

    const pipelineBreakdown: DashboardBreakdownItem[] = displayConfig.pipelineConfig.stages
      .map((stage) => ({
        key: stage.key,
        label: stage.label,
        value: pipelineStageCounts.get(stage.key) ?? 0,
      }))
      .filter((item) => item.value > 0);

    pipelineBreakdown.push(...Array.from(extraBuckets.values()).filter((item) => item.value > 0));

    const followupHealth: DashboardBreakdownItem[] = [
      { key: 'overdue', label: 'Overdue', value: overdueFollowups },
      { key: 'escalated', label: 'Escalated', value: escalatedFollowups },
      { key: 'due-today', label: 'Due Today', value: dueTodayFollowups },
      { key: 'completed-today', label: 'Completed Today', value: completedTodayFollowups },
    ];

    const comparison = shouldCompareBranches
      ? this.buildBranchComparisonFromProjected(
          accessibleBranches,
          projectedStats.branchMetrics,
          displayConfig.vocabulary.leadPlural,
          `Pending ${this.pluralize(displayConfig.vocabulary.followupLabel)}`,
        )
      : this.buildSourceComparison(projectedStats.sourceGroups, displayConfig.vocabulary.leadPlural);

    return {
      trend: {
        primaryLabel: trendPrimaryLabel,
        secondaryLabel: trendSecondaryLabel,
        tertiaryLabel: trendTertiaryLabel,
        points: trendPoints,
      },
      pipelineBreakdown: {
        title: 'Current Stage Snapshot',
        items: pipelineBreakdown,
      },
      followupHealth: {
        items: followupHealth,
      },
      comparison,
    };
  }

  private buildBranchComparisonFromProjected(
    accessibleBranches: BranchSummary[],
    branchMetrics: Array<{
      branchId: string | null;
      activeCount: number;
      pendingFollowups: number;
    }>,
    primaryLabel: string,
    secondaryLabel: string,
  ): DashboardAnalytics['comparison'] {
    const activeCountByBranchId = new Map<string, number>();
    const pendingCountByBranchId = new Map<string, number>();

    for (const row of branchMetrics) {
      if (!row.branchId) {
        continue;
      }

      activeCountByBranchId.set(row.branchId, (activeCountByBranchId.get(row.branchId) ?? 0) + row.activeCount);
      pendingCountByBranchId.set(
        row.branchId,
        (pendingCountByBranchId.get(row.branchId) ?? 0) + row.pendingFollowups,
      );
    }

    const items: DashboardComparisonItem[] = accessibleBranches
      .map((branch) => ({
        key: branch.id,
        label: branch.name,
        value: activeCountByBranchId.get(branch.id) ?? 0,
        secondaryValue: pendingCountByBranchId.get(branch.id) ?? 0,
      }))
      .filter((item) => item.value > 0 || (item.secondaryValue ?? 0) > 0)
      .sort((left, right) => {
        const leftTotal = left.value + (left.secondaryValue ?? 0);
        const rightTotal = right.value + (right.secondaryValue ?? 0);
        return rightTotal - leftTotal;
      });

    return {
      kind: 'branch',
      title: 'Branch Comparison',
      primaryLabel,
      secondaryLabel,
      items,
    };
  }

  private buildAnalytics(input: {
    buckets: DayBucket[];
    timezone: string;
    displayConfig: Awaited<ReturnType<TenantConfigService['getDisplayConfig']>>;
    industryPreset: IndustryPreset;
    trendPrimaryRows: Array<{ createdAt: Date }>;
    trendSecondaryRows: Array<{ updatedAt: Date }>;
    completedTrendRows: Array<{ doneAt: Date | null }>;
    pipelineGroups: Array<{
      stageKey: string | null;
      status: string;
      _count: { _all: number };
    }>;
    overdueFollowups: number;
    dueTodayFollowups: number;
    escalatedFollowups: number;
    completedTodayFollowups: number;
    accessibleBranches: BranchSummary[];
    shouldCompareBranches: boolean;
    branchLeadGroups: Array<{
      branchId: string | null;
      _count: { _all: number };
    }>;
    branchPendingFollowups: Array<{ lead: { branchId: string | null } }>;
    sourceGroups: Array<{
      source: string | null;
      _count: { _all: number };
    }>;
  }): DashboardAnalytics {
    const {
      buckets,
      timezone,
      displayConfig,
      industryPreset,
      trendPrimaryRows,
      trendSecondaryRows,
      completedTrendRows,
      pipelineGroups,
      overdueFollowups,
      dueTodayFollowups,
      escalatedFollowups,
      completedTodayFollowups,
      accessibleBranches,
      shouldCompareBranches,
      branchLeadGroups,
      branchPendingFollowups,
      sourceGroups,
    } = input;

    const trendPrimaryLabel =
      industryPreset === IndustryPreset.DIAGNOSTICS_LAB
        ? `New ${displayConfig.vocabulary.leadPlural}`
        : `New ${displayConfig.vocabulary.leadPlural}`;
    const trendSecondaryLabel =
      industryPreset !== IndustryPreset.GENERIC
        ? this.pluralize(displayConfig.vocabulary.bookingLabel)
        : `Won ${displayConfig.vocabulary.leadPlural}`;
    const trendTertiaryLabel = `Completed ${this.pluralize(displayConfig.vocabulary.followupLabel)}`;

    const trendPrimaryCounts = this.countByBucket(
      buckets,
      timezone,
      trendPrimaryRows.map((row) => row.createdAt),
    );
    const trendSecondaryCounts = this.countByBucket(
      buckets,
      timezone,
      trendSecondaryRows.map((row) => row.updatedAt),
    );
    const trendTertiaryCounts = this.countByBucket(
      buckets,
      timezone,
      completedTrendRows
        .map((row) => row.doneAt)
        .filter((value): value is Date => value instanceof Date),
    );

    const trendPoints: DashboardTrendPoint[] = buckets.map((bucket) => ({
      date: bucket.date,
      label: bucket.label,
      primary: trendPrimaryCounts.get(bucket.date) ?? 0,
      secondary: trendSecondaryCounts.get(bucket.date) ?? 0,
      tertiary: trendTertiaryCounts.get(bucket.date) ?? 0,
    }));

    const pipelineStageCounts = new Map<string, number>();
    const extraBuckets = new Map<string, DashboardBreakdownItem>();

    for (const group of pipelineGroups) {
      if (group.stageKey) {
        pipelineStageCounts.set(
          group.stageKey,
          (pipelineStageCounts.get(group.stageKey) ?? 0) + group._count._all,
        );
        continue;
      }

      const extraKey = `status:${group.status}`;
      const existing = extraBuckets.get(extraKey);
      extraBuckets.set(extraKey, {
        key: extraKey,
        label: displayConfig.vocabulary.statusLabels[group.status] ?? group.status,
        value: (existing?.value ?? 0) + group._count._all,
      });
    }

    const pipelineBreakdown: DashboardBreakdownItem[] = displayConfig.pipelineConfig.stages
      .map((stage) => ({
        key: stage.key,
        label: stage.label,
        value: pipelineStageCounts.get(stage.key) ?? 0,
      }))
      .filter((item) => item.value > 0);

    pipelineBreakdown.push(...Array.from(extraBuckets.values()).filter((item) => item.value > 0));

    const followupHealth: DashboardBreakdownItem[] = [
      { key: 'overdue', label: 'Overdue', value: overdueFollowups },
      { key: 'escalated', label: 'Escalated', value: escalatedFollowups },
      { key: 'due-today', label: 'Due Today', value: dueTodayFollowups },
      { key: 'completed-today', label: 'Completed Today', value: completedTodayFollowups },
    ];

    const comparison = shouldCompareBranches
      ? this.buildBranchComparison(
          accessibleBranches,
          branchLeadGroups,
          branchPendingFollowups,
          displayConfig.vocabulary.leadPlural,
          `Pending ${this.pluralize(displayConfig.vocabulary.followupLabel)}`,
        )
      : this.buildSourceComparison(
          sourceGroups,
          displayConfig.vocabulary.leadPlural,
        );

    return {
      trend: {
        primaryLabel: trendPrimaryLabel,
        secondaryLabel: trendSecondaryLabel,
        tertiaryLabel: trendTertiaryLabel,
        points: trendPoints,
      },
      pipelineBreakdown: {
        title: 'Current Stage Snapshot',
        items: pipelineBreakdown,
      },
      followupHealth: {
        items: followupHealth,
      },
      comparison,
    };
  }

  private buildBranchComparison(
    accessibleBranches: BranchSummary[],
    branchLeadGroups: Array<{
      branchId: string | null;
      _count: { _all: number };
    }>,
    branchPendingFollowups: Array<{ lead: { branchId: string | null } }>,
    primaryLabel: string,
    secondaryLabel: string,
  ): DashboardAnalytics['comparison'] {
    const leadCountByBranchId = new Map<string, number>();
    for (const group of branchLeadGroups) {
      if (!group.branchId) {
        continue;
      }

      leadCountByBranchId.set(group.branchId, group._count._all);
    }

    const followupCountByBranchId = new Map<string, number>();
    for (const row of branchPendingFollowups) {
      const branchId = row.lead.branchId;
      if (!branchId) {
        continue;
      }

      followupCountByBranchId.set(branchId, (followupCountByBranchId.get(branchId) ?? 0) + 1);
    }

    const items: DashboardComparisonItem[] = accessibleBranches
      .map((branch) => ({
        key: branch.id,
        label: branch.name,
        value: leadCountByBranchId.get(branch.id) ?? 0,
        secondaryValue: followupCountByBranchId.get(branch.id) ?? 0,
      }))
      .filter((item) => item.value > 0 || (item.secondaryValue ?? 0) > 0)
      .sort((left, right) => {
        const leftTotal = left.value + (left.secondaryValue ?? 0);
        const rightTotal = right.value + (right.secondaryValue ?? 0);
        return rightTotal - leftTotal;
      });

    return {
      kind: 'branch',
      title: 'Branch Comparison',
      primaryLabel,
      secondaryLabel,
      items,
    };
  }

  private buildSourceComparison(
    sourceGroups: Array<{
      source: string | null;
      _count: { _all: number };
    }>,
    primaryLabel: string,
  ): DashboardAnalytics['comparison'] {
    const items: DashboardComparisonItem[] = sourceGroups
      .map((group) => ({
        key: group.source ?? 'unknown',
        label: this.titleCase(group.source ?? 'Unknown'),
        value: group._count._all,
      }))
      .filter((item) => item.value > 0)
      .sort((left, right) => right.value - left.value);

    return {
      kind: 'source',
      title: 'Source Mix',
      primaryLabel,
      items,
    };
  }

  private buildDayBuckets(now: Date, timezone: string, length: number): DayBucket[] {
    const buckets: DayBucket[] = [];

    for (let offset = length - 1; offset >= 0; offset -= 1) {
      const current = this.shiftDays(now, timezone, -offset);
      const start = this.startOfDay(current, timezone);
      const end = this.endOfDay(current, timezone);
      buckets.push({
        date: this.formatDayKey(current, timezone),
        label: this.formatDayLabel(current, timezone),
        start,
        end,
      });
    }

    return buckets;
  }

  private countByBucket(buckets: DayBucket[], timezone: string, values: Date[]): Map<string, number> {
    const counts = new Map<string, number>();
    const validDates = new Set(buckets.map((bucket) => bucket.date));

    for (const value of values) {
      const key = this.formatDayKey(value, timezone);
      if (!validDates.has(key)) {
        continue;
      }

      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return counts;
  }

  private startOfDay(value: Date, timezone: string): Date {
    const zoned = toZonedTime(value, timezone);
    zoned.setHours(0, 0, 0, 0);
    return fromZonedTime(zoned, timezone);
  }

  private endOfDay(value: Date, timezone: string): Date {
    const zoned = toZonedTime(value, timezone);
    zoned.setHours(23, 59, 59, 999);
    return fromZonedTime(zoned, timezone);
  }

  private shiftDays(value: Date, timezone: string, offset: number): Date {
    const zoned = toZonedTime(value, timezone);
    zoned.setDate(zoned.getDate() + offset);
    return fromZonedTime(zoned, timezone);
  }

  private formatDayKey(value: Date, timezone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value);

    const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
    const month = parts.find((part) => part.type === 'month')?.value ?? '00';
    const day = parts.find((part) => part.type === 'day')?.value ?? '00';

    return `${year}-${month}-${day}`;
  }

  private metricDateKey(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private formatDayLabel(value: Date, timezone: string): string {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      month: 'short',
      day: 'numeric',
    }).format(value);
  }

  private titleCase(value: string): string {
    return value
      .split(/[\s_-]+/)
      .filter((part) => part.length > 0)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private pluralize(value: string): string {
    return value.endsWith('s') ? value : `${value}s`;
  }
}
