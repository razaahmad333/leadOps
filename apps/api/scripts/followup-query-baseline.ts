import { PrismaClient } from '@prisma/client';

type ExplainRow = {
  'QUERY PLAN': unknown;
};

type PlanNode = {
  'Node Type'?: string;
  'Actual Rows'?: number;
  'Actual Loops'?: number;
  Plans?: PlanNode[];
};

type ExplainSummary = {
  planningTimeMs: number;
  executionTimeMs: number;
  rootNodeType: string;
  actualRowsVisited: number;
};

type QueryDefinition = {
  key: string;
  description: string;
  sql: string;
  params: readonly unknown[];
};

const prisma = new PrismaClient();

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0));
}

function endOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999));
}

function resolveRange(): { start: Date; end: Date; now: Date } {
  const start = process.env.PERF_START_AT ? new Date(process.env.PERF_START_AT) : startOfUtcDay(new Date());
  const end = process.env.PERF_END_AT ? new Date(process.env.PERF_END_AT) : endOfUtcDay(new Date());
  const now = process.env.PERF_NOW_AT ? new Date(process.env.PERF_NOW_AT) : new Date();

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || Number.isNaN(now.getTime())) {
    throw new Error('PERF_START_AT, PERF_END_AT, and PERF_NOW_AT must be valid ISO date strings');
  }

  return { start, end, now };
}

function parseExplainResult(rows: ExplainRow[]): ExplainSummary {
  const first = rows[0]?.['QUERY PLAN'];
  const root = Array.isArray(first) ? first[0] : first;
  if (!root || typeof root !== 'object') {
    throw new Error('Unexpected EXPLAIN output shape');
  }

  const planRoot = root as Record<string, unknown>;
  const plan = planRoot.Plan as PlanNode | undefined;
  if (!plan) {
    throw new Error('EXPLAIN result missing plan node');
  }

  return {
    planningTimeMs: Number(planRoot['Planning Time'] ?? 0),
    executionTimeMs: Number(planRoot['Execution Time'] ?? 0),
    rootNodeType: String(plan['Node Type'] ?? 'unknown'),
    actualRowsVisited: sumActualRows(plan),
  };
}

function sumActualRows(plan: PlanNode): number {
  const ownRows = Number(plan['Actual Rows'] ?? 0) * Number(plan['Actual Loops'] ?? 1);
  const childRows = (plan.Plans ?? []).reduce((sum, child) => sum + sumActualRows(child), 0);
  return ownRows + childRows;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(index, 0)] ?? 0;
}

async function explainQuery(definition: QueryDefinition, iterations: number): Promise<void> {
  const executionTimes: number[] = [];
  const rowsVisited: number[] = [];
  let planningTimeMs = 0;
  let rootNodeType = 'unknown';

  for (let index = 0; index < iterations; index += 1) {
    const rows = await prisma.$queryRawUnsafe<ExplainRow[]>(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${definition.sql}`,
      ...definition.params,
    );

    const summary = parseExplainResult(rows);
    executionTimes.push(summary.executionTimeMs);
    rowsVisited.push(summary.actualRowsVisited);
    planningTimeMs = summary.planningTimeMs;
    rootNodeType = summary.rootNodeType;
  }

  const avgExecution = executionTimes.reduce((sum, value) => sum + value, 0) / executionTimes.length;
  const avgRows = rowsVisited.reduce((sum, value) => sum + value, 0) / rowsVisited.length;

  // eslint-disable-next-line no-console
  console.log(`\n[${definition.key}] ${definition.description}`);
  // eslint-disable-next-line no-console
  console.log(`root=${rootNodeType} planning=${planningTimeMs.toFixed(2)}ms avg=${avgExecution.toFixed(2)}ms p95=${percentile(executionTimes, 95).toFixed(2)}ms avgRowsVisited=${avgRows.toFixed(0)}`);
  // eslint-disable-next-line no-console
  console.log(`params=${JSON.stringify(definition.params)}`);
}

function buildQueries(): QueryDefinition[] {
  const tenantId = requiredEnv('PERF_TENANT_ID');
  const branchId = requiredEnv('PERF_BRANCH_ID');
  const repeat = optionalInt('PERF_REPEAT', 5);
  const limit = optionalInt('PERF_LIMIT', 20);
  const offset = optionalInt('PERF_OFFSET', 0);
  const { start, end, now } = resolveRange();

  const definitions: QueryDefinition[] = [
    {
      key: 'due-list-branch',
      description: 'Due queue list for a branch-scoped request',
      sql: `
SELECT fu.id, fu.scheduled_at
FROM "follow_ups" fu
JOIN "leads" l ON l.id = fu.lead_id
WHERE fu.tenant_id = $1
  AND fu.done = false
  AND fu.scheduled_at <= $2
  AND l.tenant_id = $1
  AND l.branch_id = $3
ORDER BY fu.scheduled_at ASC
LIMIT $4 OFFSET $5
      `,
      params: [tenantId, end, branchId, limit, offset],
    },
    {
      key: 'pending-count-branch',
      description: 'Pending follow-up count for a branch',
      sql: `
SELECT COUNT(*)
FROM "follow_ups" fu
JOIN "leads" l ON l.id = fu.lead_id
WHERE fu.tenant_id = $1
  AND fu.done = false
  AND l.tenant_id = $1
  AND l.branch_id = $2
      `,
      params: [tenantId, branchId],
    },
    {
      key: 'missed-count-branch',
      description: 'Overdue follow-up count for a branch',
      sql: `
SELECT COUNT(*)
FROM "follow_ups" fu
JOIN "leads" l ON l.id = fu.lead_id
WHERE fu.tenant_id = $1
  AND fu.done = false
  AND fu.scheduled_at < $2
  AND l.tenant_id = $1
  AND l.branch_id = $3
      `,
      params: [tenantId, now, branchId],
    },
    {
      key: 'followup-health-branch',
      description: 'Dashboard follow-up health buckets for a branch',
      sql: `
SELECT
  COUNT(*) FILTER (WHERE fu.done = false AND fu.scheduled_at < $3) AS overdue_count,
  COUNT(*) FILTER (WHERE fu.done = false AND fu.scheduled_at >= $3 AND fu.scheduled_at <= $4) AS due_today_count,
  COUNT(*) FILTER (WHERE fu.done = false AND fu.scheduled_at > $4) AS future_count,
  COUNT(*) FILTER (WHERE fu.done = true AND fu.done_at >= $3 AND fu.done_at <= $4) AS completed_today_count
FROM "follow_ups" fu
JOIN "leads" l ON l.id = fu.lead_id
WHERE fu.tenant_id = $1
  AND l.tenant_id = $1
  AND l.branch_id = $2
      `,
      params: [tenantId, branchId, start, end],
    },
  ];

  process.env.PERF_REPEAT = String(repeat);
  return definitions;
}

async function main(): Promise<void> {
  const iterations = optionalInt('PERF_REPEAT', 5);
  const queries = buildQueries();

  // eslint-disable-next-line no-console
  console.log(`Running ${queries.length} follow-up query baselines with repeat=${iterations}`);

  for (const query of queries) {
    await explainQuery(query, iterations);
  }
}

main()
  .catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
