import { useQuery } from '@tanstack/react-query';
import { useCacheSeries } from './useCacheSeries';
import type { SeriePoint } from './useSeries';

/**
 * Serie mensual por ejecutivo, indexada por nombre resuelto ("Camilo Figueroa").
 *
 * Existe para que "Mis Indicadores" pueda dibujar el año anterior del ejecutivo.
 * Antes no había de dónde: `Cache_Reporte` es una ventana móvil de 3 meses (solo
 * 2026) y `Tabla_Dashboard_Semana` no tiene 2025, así que `prevYearSerie` del
 * ejecutivo quedaba en `[]` y el gráfico solo mostraba el año en curso.
 *
 * La escribe el GAS en `Cache_Series` bajo `series[anio].kams`, desde
 * `Tabla_Analisis_Clientes` (llega a 2019 y trae la columna KAM).
 */
export function useKamsSeriesMes(anio: number) {
  const { data: cache, isLoading, error } = useCacheSeries();

  return useQuery({
    queryKey: ['series-kams-mes', anio],
    queryFn: () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const kams = ((cache as any)?.series?.[String(anio)]?.kams ?? {}) as Record<string, SeriePoint[]>;
      const map: Record<string, SeriePoint[]> = {};
      for (const [nombre, pts] of Object.entries(kams)) {
        map[nombre] = (pts ?? []).map((pt) => ({ ...pt, meta: 0 }));
      }
      return map;
    },
    enabled: !!cache && !isLoading && !error,
    staleTime: 15 * 60 * 1000,
  });
}
