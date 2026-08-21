import { useMemo } from 'react';
import { useCacheSheet } from './useCacheSheet';
import { histKey } from './useHistorial';

export interface ScoreChurn {
  score: number;
  status: string;
}

/** Map "pais||panelId" → score que muestra Análisis de Clientes */
export type ScoresChurnMap = Map<string, ScoreChurn>;

/**
 * Score por cliente tal como lo muestra Análisis de Clientes, leído de la misma
 * hoja `Cache_Churn`.
 *
 * Existe para que la vista Clientes no muestre un número distinto al de Análisis
 * para el mismo cliente. La hoja "Base detalle clientes" trae `score_churn`
 * (score_ret, calculado en SQL), pero Análisis usa el score del caché, que para
 * estacionales es el VENT calculado en el GAS: para Netquest son 2.20 y 1.90
 * respectivamente. Mientras las dos implementaciones convivan, la fuente que
 * manda en pantalla es esta.
 *
 * Reusa la query key de useCacheSheet('Cache_Churn'), así que no agrega fetch:
 * Salud del Cliente ya la trae en caché.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function leerScore(v: any): number | null {
  // El GAS guarda un número en indiceClientes y, por un bug, el objeto scoreVNT
  // completo en indiceClientesEst. Se toleran las dos formas para que esto
  // funcione antes y después de regenerar el caché.
  if (typeof v === 'number') return v > 0 ? v : null;
  if (v && typeof v === 'object' && typeof v.score === 'number') return v.score > 0 ? v.score : null;
  return null;
}

export function useScoresChurn() {
  const { data: raw, isLoading } = useCacheSheet<unknown>('Cache_Churn');

  const map = useMemo(() => {
    const m: ScoresChurnMap = new Map();
    if (!raw) return m;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = raw as any;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cargar = (paises: any[], campo: string) => {
      for (const p of paises ?? []) {
        for (const c of (p?.[campo] ?? [])) {
          const panelId = String(c?.empresa ?? '').trim();
          if (!panelId) continue;
          const score = leerScore(c?.score);
          if (score == null) continue;
          m.set(histKey(String(c?.pais ?? p?.pais ?? ''), panelId), {
            score,
            status: String(c?.status ?? ''),
          });
        }
      }
    };

    cargar(d?.recurrentes?.paises, 'indiceClientes');
    cargar(d?.estacionales?.paises, 'indiceClientesEst');
    cargar(d?.recurrentes?.paises, 'indiceClientesEst');
    return m;
  }, [raw]);

  return { data: map, isLoading };
}
