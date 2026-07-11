import { useQuery } from '@tanstack/react-query';
import { fetchHealthScore } from '../lib/api';
import type { HealthScore } from '../lib/types';

export function useHealthScore(window: string = '1h', lastN: number = 100) {
  return useQuery<HealthScore | null>({
    queryKey: ['health', window, lastN],
    queryFn: () => fetchHealthScore(window, lastN),
    refetchInterval: 5000,
  });
}
