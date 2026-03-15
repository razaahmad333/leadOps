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
