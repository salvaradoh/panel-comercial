import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import type { CarteraRichResponse } from './types';

export function useCartera(anio: number) {
  return useQuery<CarteraRichResponse>({
    queryKey: ['cartera-rich-v2', anio],
    queryFn: () => apiFetch<CarteraRichResponse>(`/api/cartera?anio=${anio}`),
    staleTime: 10 * 60 * 1000,
  });
}
