import { memo } from 'react';
import { useMetrics } from '../../hooks/useMetrics';
import { formatNumber } from '../../lib/format';
import { Card, Skeleton } from '../ui';

export const LoopBackCard = memo(function LoopBackCard() {
  const { data, isPending } = useMetrics();

  if (isPending || !data) {
    return (
      <Card title="Loop Backs">
        <Skeleton height={60} />
      </Card>
    );
  }

  const lm = data.loopMetrics;

  if (!lm) {
    return (
      <Card title="Loop Backs">
        <div className="muted">no loop data</div>
      </Card>
    );
  }

  return (
    <Card title="Loop Backs">
      <div className="value">{formatNumber(lm.totalLoopBacks)}</div>
      <div className="sub">
        avg {lm.avgIterationsPerRun.toFixed(1)}/run · max {formatNumber(lm.maxIterationsPerRun)}
      </div>
    </Card>
  );
});
