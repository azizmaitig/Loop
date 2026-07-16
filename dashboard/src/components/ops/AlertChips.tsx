import { useMetrics } from '../../hooks/useMetrics';
import { useDaemonState } from '../../hooks/useDaemonState';
import { Pill, Skeleton } from '../ui';

interface Alert {
  tone: 'warn' | 'crit';
  label: string;
}

/** Latency spike: p95 > 2x avg when avg is known and non-zero. */
function latencyAlert(
  p95: number | null,
  avg: number | null,
): Alert | null {
  if (p95 == null || avg == null || avg <= 0) return null;
  if (p95 > 2 * avg) return { tone: 'crit', label: 'latency spike' };
  return null;
}

/** Fail-rate high: failCount / total > 0.20 when total > 0. */
function failRateAlert(
  failCount: number,
  passCount: number,
  errorCount: number,
): Alert | null {
  const total = passCount + failCount + errorCount;
  if (total <= 0) return null;
  const rate = failCount / total;
  if (rate > 0.2) return { tone: 'crit', label: 'fail-rate high' };
  return null;
}

/** Budget warning/exceeded from budget status. */
function budgetAlert(
  status: string | undefined,
): Alert | null {
  if (status === 'warning') return { tone: 'warn', label: 'budget 80%' };
  if (status === 'exceeded') return { tone: 'crit', label: 'budget exceeded' };
  return null;
}

/** Queue backlog: length > 3. */
function queueAlert(queueLength: number | undefined): Alert | null {
  if (queueLength == null) return null;
  if (queueLength > 3) return { tone: 'warn', label: `queue backlog (${queueLength})` };
  return null;
}

export function AlertChips() {
  const { data: metrics, isPending: metricsPending } = useMetrics();
  const { data: daemon, isPending: daemonPending } = useDaemonState();

  if (metricsPending || daemonPending || !metrics || !daemon) {
    return (
      <div className="row">
        <Skeleton height={22} />
      </div>
    );
  }

  const { taskMetrics, budget } = metrics;
  const alerts: Alert[] = [];

  const lat = latencyAlert(taskMetrics.p95DurationMs, taskMetrics.avgDurationMs);
  if (lat) alerts.push(lat);

  const fail = failRateAlert(
    taskMetrics.failCount,
    taskMetrics.passCount,
    taskMetrics.errorCount,
  );
  if (fail) alerts.push(fail);

  const bud = budgetAlert(budget.status);
  if (bud) alerts.push(bud);

  const queue = queueAlert(daemon.queueLength);
  if (queue) alerts.push(queue);

  return (
    <div className="row" style={{ flexWrap: 'wrap', minHeight: 22 }}>
      {alerts.length === 0 ? (
        <Pill tone="ok">all nominal</Pill>
      ) : (
        alerts.map((a, i) => (
          <Pill key={i} tone={a.tone}>{a.label}</Pill>
        ))
      )}
    </div>
  );
}
