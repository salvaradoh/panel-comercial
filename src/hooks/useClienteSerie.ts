import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export interface PuntoMes { mes: string; usd: number }
export interface SerieCliente { clave: string; puntos: PuntoMes[] }

interface Respuesta {
  series: SerieCliente[];
  meses?: string[];
}

/**
 * Serie mensual de facturación (12 meses) para los clientes seleccionados.
 *
 * Va contra el backend porque el dato está a nivel transacción en BigQuery
 * (Tabla_Analisis_Clientes, 69.496 filas) y no existe agregado en la hoja. Se
 * pide a demanda: el comparador nunca tiene más de 3 clientes activos.
 *
 * `claves` son strings "pais||panelId" — la misma clave compuesta que usa
 * histKey, porque panelId solo no es único entre países.
 */
export function useClienteSerie(claves: string[]) {
  // Ordenadas para que el mismo trío no genere dos entradas de caché distintas
  // solo por el orden en que se seleccionó.
  const orden = [...claves].sort();

  return useQuery<Respuesta>({
    queryKey: ['cliente-serie', orden],
    queryFn: () => {
      const qs = orden.map(k => `c=${encodeURIComponent(k)}`).join('&');
      return apiFetch<Respuesta>(`/api/cliente-serie?${qs}`);
    },
    enabled: orden.length > 0,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });
}
