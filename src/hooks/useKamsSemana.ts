import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export interface KamSemanaData {
  nombre: string;
  avance: number;
  meta: number;
  pct: number;
}

interface KamsSemanaResponse {
  kams: KamSemanaData[];
  periodo: { anio: number; mes: number; semana: number; pais: string };
}

export function useKamsSemana(anio: number, mes: number, semana: number, pais: string) {
  return useQuery<KamsSemanaResponse>({
    queryKey: ['kams-semana', anio, mes, semana, pais],
    queryFn: () =>
      apiFetch<KamsSemanaResponse>(
        `/api/kams-semana?anio=${anio}&mes=${mes}&semana=${semana}&pais=${encodeURIComponent(pais)}`
      ),
    enabled: !!pais,
    staleTime: 0,
    placeholderData: keepPreviousData,
  });
}
