import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export interface ClienteKam {
  id: string;
  nombre: string;
  pais: string;
  tipo: string;
  diasSinCompra: number;
  ultimaCompra: string;
  monto6m: number;
  monto6mAnt: number;
  tendencia: 'up' | 'down' | 'flat';
  numAnios: number;
}

interface KamsClientesResponse {
  clientes: ClienteKam[];
  total: number;
}

export function useKamsClientes(kam: string | null, pais: string) {
  return useQuery<KamsClientesResponse>({
    queryKey: ['kams-clientes', kam, pais],
    queryFn: () => apiFetch<KamsClientesResponse>(
      `/api/kams-clientes?kam=${encodeURIComponent(kam!)}&pais=${encodeURIComponent(pais)}`
    ),
    enabled: !!kam,
    staleTime: 10 * 60 * 1000,
  });
}
