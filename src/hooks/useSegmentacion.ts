import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import type { SegmentacionResponse } from './types';

export function useSegmentacion() {
  return useQuery<SegmentacionResponse>({
    queryKey: ['segmentacion'],
    queryFn: () => apiFetch<SegmentacionResponse>('/api/segmentacion'),
  });
}
