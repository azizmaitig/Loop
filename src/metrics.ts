/**
 * metrics.ts — Compute task/budget/trigger metrics for the /api/metrics endpoint.
 */
import { listTaskHistory } from './history.js';
import { checkBudget } from './budget.js';

// ── Interfaces ─────────────────────────────────────────────────────────────

export interface TaskMetricsResult {
  totalRuns: number;
  lastN: number;
  passCount: number;
  failCount: number;
  errorCount: number;
  avgDurationMs: number | null;
  p50DurationMs: number | null;
  p95DurationMs: number | null;
  throughputTasksPerMin: number;
  throughputWindowMinutes: number;
}

export interface BudgetMetricsResult {
  status: 'ok' | 'warning' | 'exceeded';
  runsToday: number;
  cap: number;
  remaining: number;
}

export interface TriggerSummary {
  id: string;
  type: string;
  fireCount: number;
  lastFiredAt?: string;
  running: boolean;
}

// ── Window helpers ────────────────────────────────────────────────────────

const WINDOW_MAP: Record<string, number> = {
  '10m': 10,
  '1h': 60,
  '24h': 1440,
};

function parseWindow(name: string): { minutes: number; name: string } {
  const minutes = WINDOW_MAP[name];
  if (minutes !== undefined) return { minutes, name };
  return { minutes: 60, name: '1h' }; // default
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ── Task metrics ──────────────────────────────────────────────────────────

export async function computeTaskMetrics(
  baseDir: string,
  lastN: number = 100,
  window: string = '1h',
): Promise<TaskMetricsResult> {
  const { minutes: windowMinutes } = parseWindow(window);
  const now = Date.now();

  // Get total count + tasks
  const response = await listTaskHistory(baseDir, 1, lastN);
  const totalRuns = response.total;
  const tasks = response.tasks;

  // Tasks within the time window (completedAt within last windowMinutes)
  let passCount = 0;
  let failCount = 0;
  let errorCount = 0;
  const passDurations: number[] = [];
  let inWindow = 0;

  for (const t of tasks) {
    const completedAt = t.completedAt ? new Date(t.completedAt).getTime() : null;
    const withinWindow = completedAt !== null && (now - completedAt) < windowMinutes * 60_000;
    if (withinWindow) inWindow++;

    const status = (t.status || '').toLowerCase();
    if (status === 'completed' || status === 'success' || status === 'pass') {
      passCount++;
      if (t.durationMs != null) passDurations.push(t.durationMs);
    } else if (status === 'failed' || status === 'fail') {
      failCount++;
    } else {
      // cancelled / queued / running / unknown → error bucket
      errorCount++;
    }
  }

  passDurations.sort((a, b) => a - b);

  const avg =
    passDurations.length > 0
      ? passDurations.reduce((s, v) => s + v, 0) / passDurations.length
      : null;

  return {
    totalRuns,
    lastN,
    passCount,
    failCount,
    errorCount,
    avgDurationMs: avg,
    p50DurationMs: passDurations.length > 0 ? percentile(passDurations, 50) : null,
    p95DurationMs: passDurations.length > 0 ? percentile(passDurations, 95) : null,
    throughputTasksPerMin: windowMinutes > 0 ? inWindow / windowMinutes : 0,
    throughputWindowMinutes: windowMinutes,
  };
}

// ── Budget metrics ────────────────────────────────────────────────────────

export async function computeBudgetMetrics(baseDir: string): Promise<BudgetMetricsResult> {
  const b = await checkBudget(baseDir);
  // Map budget status: 'report_only' → 'warning' for dashboard consistency
  const status: BudgetMetricsResult['status'] =
    b.status === 'report_only' ? 'warning' : b.status;
  return {
    status,
    runsToday: b.runsToday,
    cap: b.cap,
    remaining: b.cap - b.runsToday,
  };
}

// ── Trigger metrics ───────────────────────────────────────────────────────

export function computeTriggerMetrics(
  triggers: { id: string; type: string; running: boolean; fireCount: number; lastFiredAt?: string }[],
): TriggerSummary[] {
  return triggers.map(t => ({
    id: t.id,
    type: t.type,
    fireCount: t.fireCount,
    lastFiredAt: t.lastFiredAt,
    running: t.running,
  }));
}
