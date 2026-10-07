import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../api/client';

/**
 * Metas mensuales por país en USD (índice 0 = enero), servidas por el backend con login.
 * Antes vivían en `lib/metas.ts` y se publicaban en el JavaScript del sitio (hallazgo 3.2
 * del informe de seguridad del 2026-10-05). Vacío mientras carga.
 */
export function useMetasPais(): Record<string, number[]> {
  const { token } = useAuth();
  const { data } = useQuery<Record<string, number[]>>({
    queryKey: ['metas-anuales'],
    queryFn: async () => (await apiFetch<{ metas: Record<string, number[]> }>('/api/metas/anuales')).metas,
    enabled: !!token,
    staleTime: 60 * 60 * 1000,
    gcTime:    60 * 60 * 1000,
    retry: 1,
  });
  return data ?? {};
}

export function getMetaMes(metas: Record<string, number[]>, pais: string, mes: number): number {
  return metas[pais]?.[mes - 1] ?? 0;
}
