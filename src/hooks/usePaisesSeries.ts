import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import type { SeriesResponse } from './useSeries';

const PAISES = ['Chile', 'Perú', 'Colombia', 'México'];

export function usePaisesSeries(anio: number) {
  return useQuery({
    queryKey: ['series-paises-semana', anio],
    queryFn: async () => {
      const results = await Promise.all(
        PAISES.map(pais => {
          const params = new URLSearchParams({ anio: String(anio), granularidad: 'semana', pais });
          return apiFetch<SeriesResponse>(`/api/series?${params}`)
            .then(r => ({ pais, series: r.series }))
            .catch(() => ({ pais, series: [] }));
        })
      );
      const map: Record<string, { time: string; value: number }[]> = {};
      results.forEach(r => { map[r.pais] = r.series.map(s => ({ time: s.time, value: s.value })); });
      return map;
    },
    staleTime: 15 * 60 * 1000,
  });
}
