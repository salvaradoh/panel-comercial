import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { clavePais } from '../lib/paises';

interface FilaFacturacion { pais: string; panelId: string; mes: string; usd: number }
interface Respuesta { filas: FilaFacturacion[] }

const clave = (pais: string, panelId: string) => clavePais(pais) + '|' + panelId.trim();

/**
 * Facturación mensual de TODOS los clientes (últimos 48 meses), para el
 * selector "Ver por año / por mes" de Industria por País.
 *
 * Se pide una sola vez y se cachea largo (es un solo scan agregado en BQ, no
 * cambia dato a dato durante el día) — a diferencia de useClienteSerie, que
 * es a demanda para máximo 3 clientes puntuales del Comparador.
 */
export function useFacturacionMensual() {
  const { data, isLoading } = useQuery<Respuesta>({
    queryKey: ['facturacion-mensual'],
    queryFn: () => apiFetch<Respuesta>('/api/facturacion-mensual'),
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    retry: 1,
  });

  return useMemo(() => {
    const mapa = new Map<string, Map<string, number>>();
    const mesesSet = new Set<string>();
    (data?.filas ?? []).forEach(f => {
      const k = clave(f.pais, f.panelId);
      if (!mapa.has(k)) mapa.set(k, new Map());
      mapa.get(k)!.set(f.mes, f.usd);
      mesesSet.add(f.mes);
    });
    const meses = [...mesesSet].sort();
    const anios = [...new Set(meses.map(m => m.slice(0, 4)))].sort();

    return {
      isLoading,
      meses,
      anios,
      /** Suma USD de un cliente en un mes puntual ("YYYY-MM"). 0 si no facturó. */
      usdDelMes: (pais: string, panelId: string, mes: string) =>
        mapa.get(clave(pais, panelId))?.get(mes) ?? 0,
      /** Suma USD de un cliente en todos los meses de un año calendario. */
      usdDelAnio: (pais: string, panelId: string, anio: string) => {
        const porMes = mapa.get(clave(pais, panelId));
        if (!porMes) return 0;
        let total = 0;
        porMes.forEach((usd, mes) => { if (mes.startsWith(anio)) total += usd; });
        return total;
      },
    };
  }, [data, isLoading]);
}
