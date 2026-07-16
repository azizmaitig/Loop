/**
 * metrics.ts — Compute task/budget/trigger metrics for the /api/metrics endpoint.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { listTaskHistory } from './history.js';
import { checkBudget } from './budget.js';

// ── Interfaces ─────────────────────────────────────────────────────────────

export interface LoopMetricsResult {
  /** Total number of LOOP FSM transitions (verify → init) observed since daemon start. */
  totalLoopBacks: number;
  /**
   * Average iterations per completed run.
   * A "run" is one bounded execution of the loop (init → run → verify → done).
   * Computed from completed-run sizes tracked in-memory.
   */
  avgIterationsPerRun: number;
  /**
   * Maximum iterations observed in any single completed run.
   */
  maxIterationsPerRun: number;
}

export interface TaskMetricsResult {
  totalRuns: number;
  lastN: number;
  passCount: number;
  failCount: number;
  errorCount: number;
  abortCount: number;
  cancelCount: number;
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
  let abortCount = 0;
  let cancelCount = 0;
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
    } else if (status === 'cancelled') {
      cancelCount++;
    } else if (status === 'aborted') {
      abortCount++;
    } else if (status === 'error') {
      errorCount++;
    }
    // queued, running, unknown → silently ignored (not errors)
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
    abortCount,
    cancelCount,
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

// ── Loop metrics (in-memory, daemon-lifetime) ─────────────────────────────

/** Filename for persisted loop-metrics state. */
const METRICS_FILENAME = 'loop-metrics.json';

/**
 * Tracks loop-back events (the verify → init FSM edge) and iteration counts
 * by intercepting events as they pass through the daemon's broadcast().
 *
 * Loop-backs are counted from fsm_transition events where `event === 'LOOP'`.
 * Avg/max iterations per run are computed by tracking iteration_start events
 * and recording a run's size when a terminal fsm_transition (COMPLETE/FAILED/ABORT) arrives.
 *
 * Counters survive daemon restarts: call setStoragePath(dir) (done by the
 * Daemon on construction) to load from and persist to `loop-metrics.json`
 * under the loop output dir on every run-boundary FSM event.
 */
export class LoopMetricsTracker {
  totalLoopBacks = 0;
  /** Per-planName: highest iteration number seen in the current active run. */
  private _currentRunIterations = new Map<string, number>();
  /** Sizes of completed runs. */
  private _completedRunSizes: number[] = [];
  /** Path to the persisted metrics file; null when storage not configured. */
  private _filePath: string | null = null;

  /**
   * Configure a storage directory and immediately attempt to load persisted state.
   * Best-effort: if the file doesn't exist or is corrupt, keep current in-memory state.
   */
  setStoragePath(dir: string): void {
    this._filePath = resolve(dir, METRICS_FILENAME);
    this.load();
  }

  /**
   * Load persisted metrics from disk. Restores totalLoopBacks, completedRunSizes,
   * and currentRunIterations. Any error (missing/corrupt) → silently keep current state.
   */
  private load(): void {
    if (!this._filePath) return;
    try {
      if (!existsSync(this._filePath)) return;
      const raw = readFileSync(this._filePath, 'utf-8');
      const data = JSON.parse(raw);
      if (typeof data.totalLoopBacks === 'number') this.totalLoopBacks = data.totalLoopBacks;
      if (Array.isArray(data.completedRunSizes)) this._completedRunSizes = data.completedRunSizes;
      if (data.currentRunIterations && typeof data.currentRunIterations === 'object') {
        this._currentRunIterations = new Map(Object.entries(data.currentRunIterations));
      }
    } catch {
      // best-effort: keep current in-memory state
    }
  }

  /**
   * Write current metrics state to disk as JSON. Best-effort — never throws.
   * Creates parent directory if it doesn't exist.
   */
  private persist(): void {
    if (!this._filePath) return;
    try {
      const dir = dirname(this._filePath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const data = {
        totalLoopBacks: this.totalLoopBacks,
        completedRunSizes: this._completedRunSizes,
        currentRunIterations: Object.fromEntries(this._currentRunIterations),
      };
      writeFileSync(this._filePath, JSON.stringify(data), 'utf-8');
    } catch {
      // best-effort: dashboard loop must not crash on fs error
    }
  }

  /** Call from daemon broadcast() on every fsm_transition event. */
  recordFsmTransition(data: { planName?: string; event?: string; iteration?: number }): void {
    if (data.event === 'LOOP') {
      this.totalLoopBacks++;
      this.persist();
    } else if (data.event === 'COMPLETE' || data.event === 'FAILED' || data.event === 'ABORT') {
      const planName = data.planName;
      if (planName) {
        const size = this._currentRunIterations.get(planName);
        if (size && size > 0) {
          this._completedRunSizes.push(size);
        }
        this._currentRunIterations.delete(planName);
      }
      this.persist();
    }
  }

  /** Call from daemon broadcast() on every iteration_start event. */
  recordIterationStart(data: { planName?: string; iteration?: number }): void {
    const planName = data.planName;
    const iteration = data.iteration;
    if (!planName || iteration == null) return;

    if (iteration === 1) {
      // New run detected. Save the previous run's size if one was in-flight
      // (e.g., no terminal transition received before next iteration_start).
      const prev = this._currentRunIterations.get(planName);
      if (prev && prev > 0) {
        this._completedRunSizes.push(prev);
      }
      this._currentRunIterations.set(planName, 1);
    } else {
      const current = this._currentRunIterations.get(planName) ?? 0;
      this._currentRunIterations.set(planName, Math.max(current, iteration));
    }
  }

  compute(): LoopMetricsResult {
    const allSizes = this._completedRunSizes;
    const avg = allSizes.length > 0
      ? allSizes.reduce((s, v) => s + v, 0) / allSizes.length
      : 0;
    const max = allSizes.length > 0
      ? Math.max(...allSizes)
      : 0;
    return {
      totalLoopBacks: this.totalLoopBacks,
      avgIterationsPerRun: avg,
      maxIterationsPerRun: max,
    };
  }
}
