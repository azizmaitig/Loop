import { PassFailErrorDonut } from './PassFailErrorDonut';
import { DurationCard } from './DurationCard';
import { ThroughputCard } from './ThroughputCard';
import { QueueCard } from './QueueCard';
import { LoopBackCard } from './LoopBackCard';

export function MetricCardGrid() {
  return (
    <div className="grid grid-cards">
      <PassFailErrorDonut />
      <DurationCard />
      <ThroughputCard />
      <QueueCard />
      <LoopBackCard />
    </div>
  );
}
