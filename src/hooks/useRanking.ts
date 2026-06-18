import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import type { RankingResponse } from './types';

export function useRanking(anio: number) {
  return useQuery<RankingResponse>({
    queryKey: ['ranking', anio],
    queryFn: () => apiFetch<RankingResponse>(`/api/ranking?anio=${anio}`),
    staleTime: 10 * 60 * 1000,
  });
}
