import { useQuery } from '@tanstack/react-query';
import { useCacheSeries } from './useCacheSeries';
import { getMetaMes } from '../lib/metas';

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

export function useSeries(anio: number, _granularidad: Granularidad, pais?: string) {
  const { data: cache, isLoading, error } = useCacheSeries();

  return useQuery<SeriesResponse>({
    queryKey: ['series', anio, pais ?? 'global'],
    queryFn: () => {
      const anioData = cache?.series?.[String(anio)];
      const paisSinAcento = pais?.normalize('NFD').replace(/[̀-ͯ]/g, '');
      const raw = pais
        ? (anioData?.paises?.[pais] ?? anioData?.paises?.[paisSinAcento!] ?? [])
        : (anioData?.global ?? []);
      const series: SeriePoint[] = raw.map(pt => {
        const mes = new Date(pt.time + 'T12:00:00').getMonth() + 1;
        const meta = pais ? getMetaMes(pais, mes) : 0;
        return { time: pt.time, value: pt.value, meta };
      });
      return { series, granularidad: 'mes', anio, pais: pais ?? null };
    },
    enabled: !!cache && !isLoading && !error,
    staleTime: 10 * 60 * 1000,
  });
}
