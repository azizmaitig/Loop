import { useQuery } from '@tanstack/react-query';
import { fetchMetrics } from '../lib/api';
import type { MetricsResponse } from '../lib/types';

export function useMetrics(window: string = '1h', lastN: number = 100) {
  return useQuery<MetricsResponse>({
    queryKey: ['metrics', window, lastN],
    queryFn: () => fetchMetrics(window, lastN),
    refetchInterval: 5000,
    staleTime: 2000,
  });
}
