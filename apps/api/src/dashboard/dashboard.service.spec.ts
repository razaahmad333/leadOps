import { IndustryPreset } from '@leadops/shared';
import { DashboardService } from './dashboard.service';

describe('DashboardService pre-aggregation helpers', () => {
  function createService(overrides?: Partial<any>): DashboardService {
    const prisma = {
      dashboardProjectionState: {
        findUnique: jest.fn(),
        count: jest.fn(),
      },
      ...overrides,
    };

    return new DashboardService(prisma as any, {} as any, {} as any);
  }

  it('returns fresh for all-branches scope when tenant aggregate state is recent', async () => {
    const service = createService();
    const now = new Date('2026-03-15T10:00:00.000Z');

    (service as any).prisma.dashboardProjectionState.findUnique.mockResolvedValue({
      refreshedAt: new Date('2026-03-15T09:59:55.000Z'),
    });

    const result = await (service as any).isProjectedScopeFresh({
      tenantId: 'tenant-1',
      branchIds: null,
      now,
    });

    expect(result).toBe(true);
  });

  it('returns false for branch-scoped projection when not all branch states are fresh', async () => {
    const service = createService();
    const now = new Date('2026-03-15T10:00:00.000Z');

    (service as any).prisma.dashboardProjectionState.count.mockResolvedValue(1);

    const result = await (service as any).isProjectedScopeFresh({
      tenantId: 'tenant-1',
      branchIds: ['b1', 'b2'],
      now,
    });

    expect(result).toBe(false);
  });

  it('builds projected analytics with branch comparison and trend maps', () => {
    const service = createService();

    const analytics = (service as any).buildProjectedAnalytics({
      buckets: [
        { date: '2026-03-14', label: 'Mar 14', start: new Date(), end: new Date() },
        { date: '2026-03-15', label: 'Mar 15', start: new Date(), end: new Date() },
      ],
      displayConfig: {
        vocabulary: {
          leadPlural: 'Leads',
          followupLabel: 'Follow-up',
          bookingLabel: 'Booking',
          statusLabels: {
            NEW: 'New',
          },
        },
        pipelineConfig: {
          stages: [
            { key: 'NEW', label: 'New' },
            { key: 'CONTACTED', label: 'Contacted' },
          ],
        },
      },
      industryPreset: IndustryPreset.GENERIC,
      projectedStats: {
        trendPrimaryByDate: new Map([
          ['2026-03-14', 2],
          ['2026-03-15', 4],
        ]),
        trendSecondaryByDate: new Map([
          ['2026-03-14', 1],
          ['2026-03-15', 3],
        ]),
        trendTertiaryByDate: new Map([
          ['2026-03-14', 5],
          ['2026-03-15', 6],
        ]),
        pipelineGroups: [
          { stageKey: 'NEW', status: 'NEW', _count: { _all: 7 } },
        ],
        sourceGroups: [
          { source: 'web', _count: { _all: 10 } },
        ],
        branchMetrics: [
          { branchId: 'b1', activeCount: 9, pendingFollowups: 3 },
          { branchId: 'b2', activeCount: 4, pendingFollowups: 1 },
        ],
      },
      overdueFollowups: 3,
      dueTodayFollowups: 2,
      escalatedFollowups: 1,
      completedTodayFollowups: 6,
      accessibleBranches: [
        { id: 'b1', name: 'Main' },
        { id: 'b2', name: 'Second' },
      ],
      shouldCompareBranches: true,
    });

    expect(analytics.trend.points).toHaveLength(2);
    expect(analytics.trend.points[1].primary).toBe(4);
    expect(analytics.comparison.kind).toBe('branch');
    expect(analytics.comparison.items[0].key).toBe('b1');
    expect(analytics.followupHealth.items.find((item: any) => item.key === 'completed-today')?.value).toBe(6);
  });
});
