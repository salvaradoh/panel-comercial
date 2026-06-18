import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type Granularidad = 'semana' | 'mes' | 'trimestre';

export interface SeriePoint {
  time: string;
  value: number;
  meta: number;
}

export interface SeriesResponse {
  series: SeriePoint[];
  granularidad: Granularidad;
  anio: number;
  pais: string | null;
}

export function useSeries(anio: number, granularidad: Granularidad, pais?: string, mes?: number) {
  return useQuery<SeriesResponse>({
    queryKey: ['series', anio, granularidad, pais ?? 'all', mes ?? 'all'],
    queryFn: () => {
      const params = new URLSearchParams({ anio: String(anio), granularidad });
      if (pais) params.set('pais', pais);
      if (mes && granularidad === 'semana') params.set('mes', String(mes));
      return apiFetch<SeriesResponse>(`/api/series?${params}`);
    },
    staleTime: 10 * 60 * 1000,
  });
}
