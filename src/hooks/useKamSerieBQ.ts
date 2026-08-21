import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

interface KamSerieResponse {
  serie: { time: string; value: number }[];
  anio: number;
  kam: string;
  pais: string;
}

export function useKamSerieBQ(kamId: string, pais: string, anio: number) {
  return useQuery<{ time: string; value: number }[]>({
    queryKey: ['kam-serie-bq', kamId, pais, anio],
    queryFn: async () => {
      const res = await apiFetch<KamSerieResponse>(
        `/api/kams-serie?anio=${anio}&kam=${encodeURIComponent(kamId)}&pais=${encodeURIComponent(pais)}`
      );
      return res.serie;
    },
    enabled: !!kamId && !!pais,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
