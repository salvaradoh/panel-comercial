import { useMemo } from 'react';
import { useCacheSheet } from './useCacheSheet';
import { clavePais } from '../lib/paises';

/**
 * Actividad mensual del cliente: transacciones y monto USD por mes, por año.
 * Alimenta el mapa de calor de la ficha.
 *
 * No se deriva de Cache_Transacciones porque esa guarda solo las últimas 20
 * ventas — no alcanza para un año completo, menos para tres.
 *
 * En la hoja cada año son DOS arrays de 12 (transacciones y USD) en vez de un
 * objeto por mes: son 20.602 meses de 2.853 clientes y con objetos el JSON se
 * triplica. Los años sin actividad no vienen.
 */
// [transacciones×12, usd×12, usd por producto en el orden de `productos`]
type AnioCrudo = [number[], number[], number[]?];

interface CacheActividad {
  generado: string;
  desdeAnio: number;
  /** Orden fijo del tercer array de cada año: ['Puntos','Gift Card','SaaS']. */
  productos?: string[];
  clientes: Record<string, Record<string, AnioCrudo>>;
}

export interface AnioActividad {
  anio: number;
  /** 12 posiciones, enero a diciembre. */
  trx: number[];
  usd: number[];
  totalTrx: number;
  totalUsd: number;
  /** USD por producto, alineado con `productos`. Vacío si el caché es anterior. */
  prod: number[];
}

export function useActividad(
  pais: string | undefined,
  panelId: string | undefined,
  habilitado: boolean,
) {
  const { data, isLoading, error } = useCacheSheet<CacheActividad>('Cache_Actividad', habilitado);

  const anios = useMemo<AnioActividad[]>(() => {
    if (!data || !pais || !panelId) return [];
    const k = `${clavePais(pais)}|${String(panelId).trim()}`;
    const porAnio = data.clientes?.[k];
    if (!porAnio) return [];

    const suma = (a: number[]) => a.reduce((s, v) => s + (Number(v) || 0), 0);

    return Object.keys(porAnio)
      // Más reciente arriba: es el año que se mira primero.
      .sort((a, b) => Number(b) - Number(a))
      .map(anio => {
        const [trx, usd, prod] = porAnio[anio];
        const t = (trx ?? []).map(v => Number(v) || 0);
        const u = (usd ?? []).map(v => Number(v) || 0);
        return {
          anio: Number(anio), trx: t, usd: u,
          totalTrx: suma(t), totalUsd: suma(u),
          prod: (prod ?? []).map(v => Number(v) || 0),
        };
      });
  }, [data, pais, panelId]);

  return { anios, productos: data?.productos ?? [], isLoading, error };
}
