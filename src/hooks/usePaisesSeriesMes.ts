import { useQuery } from '@tanstack/react-query';
import { useCacheSeries } from './useCacheSeries';
import type { SeriePoint } from './useSeries';

export function usePaisesSeriesMes(anio: number) {
  const { data: cache, isLoading, error } = useCacheSeries();

  return useQuery({
    queryKey: ['series-paises-mes', anio],
    queryFn: () => {
      const paises = cache?.series?.[String(anio)]?.paises ?? {};
      const map: Record<string, SeriePoint[]> = {};
      for (const [pais, pts] of Object.entries(paises)) {
        map[pais] = pts.map(pt => ({ ...pt, meta: 0 }));
      }
      return map;
    },
    enabled: !!cache && !isLoading && !error,
    staleTime: 15 * 60 * 1000,
  });
}
