import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export interface CanjesItem {
  giftcard: string;
  cantidad: number;
}

export interface CanjesResponse {
  periodo: string;
  totalCanjes: number;
  byPais: Record<string, CanjesItem[]>;
}

export function useCanjes(anio: number, mes: number) {
  return useQuery<CanjesResponse>({
    queryKey: ['canjes', anio, mes],
    queryFn: () => apiFetch<CanjesResponse>(`/api/canjes?anio=${anio}&mes=${mes}`),
    staleTime: 15 * 60 * 1000,
  });
}
