import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export interface KamNuevo {
  pais: string;
  nombre: string;
  nuevos: number;
}

interface KamsNuevosResponse {
  kams: KamNuevo[];
  kamsAnio: KamNuevo[];
  total: number;
  totalPorPais: Record<string, number>;
  totalAnio: number;
  totalAnioPorPais: Record<string, number>;
  periodo: { anio: number; mes: number };
}

export function useKamsNuevos(anio: number, mes: number) {
  return useQuery<KamsNuevosResponse>({
    queryKey: ['kams-nuevos', anio, mes],
    queryFn: () => apiFetch<KamsNuevosResponse>(`/api/kams-nuevos?anio=${anio}&mes=${mes}`),
    staleTime: 30 * 60 * 1000,
    gcTime:    60 * 60 * 1000,
  });
}
