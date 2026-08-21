import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export interface KamCartera {
  pais: string;
  nombre: string;
  rol: string;
  clientes: number;
  activos: number;
  recurrentes: number;
  estacionales: number;
  primera_compra: number;
  perdidos: number;
  nuevos_anio: number;
  pct_recurrencia: number;
  facturas_prom: number;
  vol_6m_prom: number;
  dias_sc_prom: number;
  score_ret_prom: number;
  ticket_unitario: number;
}

interface KamsCarteraResponse { kams: KamCartera[] }

export function useKamsCartera() {
  return useQuery<KamsCarteraResponse>({
    queryKey: ['kams-cartera'],
    queryFn: () => apiFetch<KamsCarteraResponse>('/api/kams-cartera'),
    staleTime: 30 * 60 * 1000,
    gcTime:    60 * 60 * 1000,
  });
}
