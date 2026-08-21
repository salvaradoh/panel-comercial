import { useQuery } from '@tanstack/react-query';
import { useCacheSeries } from './useCacheSeries';

// semana=0 → series mensuales; semana=1-4 → puntos semanales de ese número de semana
export function usePaisesSeries(anio: number, semana: number = 0) {
  const { data: cache, isLoading, error } = useCacheSeries();

  return useQuery({
    queryKey: ['series-paises', anio, semana],
    queryFn: () => {
      const map: Record<string, { time: string; value: number }[]> = {};

      if (semana > 0) {
        // Datos semanales: todos los puntos de todas las semanas del año
        const paises = cache?.semanas?.[String(anio)]?.paises ?? {};
        for (const [pais, pts] of Object.entries(paises)) {
          map[pais] = pts; // cada punto tiene { time, semana, mes, value }
        }
      } else {
        // Datos mensuales (default)
        const paises = cache?.series?.[String(anio)]?.paises ?? {};
        for (const [pais, pts] of Object.entries(paises)) {
          map[pais] = pts;
        }
      }
      return map;
    },
    enabled: !!cache && !isLoading && !error,
    staleTime: 15 * 60 * 1000,
  });
}
