import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import type { MetasResponse } from './types';

export function useMetas(anio: number, mes: number, semana: number) {
  return useQuery<MetasResponse>({
    queryKey: ['metas', anio, mes, semana],
    queryFn: () => apiFetch<MetasResponse>(`/api/metas?anio=${anio}&mes=${mes}&semana=${semana}`),
  });
}
