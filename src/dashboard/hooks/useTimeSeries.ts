import { useQuery } from '@tanstack/react-query';
import { fetchTimeSeries } from '../lib/api';
import type { TimeSeriesResponse } from '../lib/types';

export function useTimeSeries(metric: string, window: string = '1h') {
  return useQuery<TimeSeriesResponse | null>({
    queryKey: ['timeseries', metric, window],
    queryFn: () => fetchTimeSeries(metric, window),
    refetchInterval: 5000,
  });
}
