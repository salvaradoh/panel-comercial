import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import type { SeriesResponse, SeriePoint } from './useSeries';

const PAISES = ['Chile', 'Perú', 'Colombia', 'México'];

export function usePaisesSeriesMes(anio: number) {
  return useQuery({
    queryKey: ['series-paises-mes', anio],
    queryFn: async () => {
      const results = await Promise.all(
        PAISES.map(pais => {
          const params = new URLSearchParams({ anio: String(anio), granularidad: 'mes', pais });
          return apiFetch<SeriesResponse>(`/api/series?${params}`)
            .then(r => ({ pais, series: r.series }))
            .catch(() => ({ pais, series: [] as SeriePoint[] }));
        })
      );
      const map: Record<string, SeriePoint[]> = {};
      results.forEach(r => { map[r.pais] = r.series; });
      return map;
    },
    staleTime: 15 * 60 * 1000,
  });
}
