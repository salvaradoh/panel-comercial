import type { ClienteChurnQ, MovimientoBase } from '../../hooks/useMovimientos';
import type { CasoId } from './ComoSeCalculaChurn';

/**
 * El puente entre "churn del trimestre" y "salieron de la base".
 *
 * Los dos números cuentan empresas distintas y casi siempre diferen. La
 * relación es exacta y no aproximada:
 *
 *   churn − salieron = (siguen en la base) − (ya contadas) − (sin figurar)
 *
 * Vive en su propio módulo porque lo usan el panel y el Excel, y si cada uno
 * tuviera su copia se desincronizarían en el primer cambio: el número que el
 * equipo ve en pantalla y el que descarga tienen que salir del mismo cálculo.
 *
 * El cruce es por (país, panel_id), que es la llave con la que una empresa
 * existe en las dos listas.
 */

export const llaveEmpresa = (pais: string, panelId: string) => `${pais}||${panelId}`;

/** Los índices que hacen falta para clasificar, armados una sola vez. */
export function indexarPuente(clientes: ClienteChurnQ[], movimientos: MovimientoBase[]) {
  const churnPorQ = new Map<string, Set<string>>();
  for (const c of clientes) {
    if (!c.trimestreId) continue;
    let s = churnPorQ.get(c.trimestreId);
    if (!s) { s = new Set(); churnPorQ.set(c.trimestreId, s); }
    s.add(llaveEmpresa(c.pais, c.panelId));
  }
  // Las reclasificaciones no son salidas: la empresa no dejó la cartera, solo
  // pasó de recurrente a estacional o al revés.
  const bajasPorQ = new Map<string, string[]>();
  for (const m of movimientos) {
    if (m.movimiento !== 'baja' || m.motivo === 'reclasificacion') continue;
    const l = bajasPorQ.get(m.trimestreId) ?? [];
    l.push(llaveEmpresa(m.pais, m.panelId));
    bajasPorQ.set(m.trimestreId, l);
  }
  /** ¿Esta empresa ya figuraba en el churn de algún trimestre anterior a `tid`? */
  const contadaAntes = (tid: string, k: string) => {
    for (const [q, s] of churnPorQ) if (q < tid && s.has(k)) return true;
    return false;
  };
  return { churnPorQ, bajasPorQ, contadaAntes };
}

export type Indice = ReturnType<typeof indexarPuente>;

/**
 * En cuál de los tres casos cae una empresa que está en el churn de `tid`.
 * Solo puede ser una de dos: salió de la base, o se quedó.
 */
export function casoDeChurn(ix: Indice, tid: string, k: string): CasoId {
  return (ix.bajasPorQ.get(tid) ?? []).includes(k) ? 'perdidaNueva' : 'sigueEnBase';
}

/**
 * En cuál cae una empresa que salió de la base en `tid`. `null` cuando salió
 * sin figurar nunca en el churn publicado —pasa en el primer trimestre de la
 * serie, donde su pérdida es anterior al histórico.
 */
export function casoDeBaja(ix: Indice, tid: string, k: string): CasoId | null {
  if (ix.churnPorQ.get(tid)?.has(k)) return 'perdidaNueva';
  if (ix.contadaAntes(tid, k)) return 'yaContada';
  return null;
}

/** Los conteos del trimestre. Las dos cuentas cierran contra `churn` y `bajas`. */
export function puenteQ(
  tid: string,
  clientes: ClienteChurnQ[],
  movimientos: MovimientoBase[],
) {
  const ix = indexarPuente(clientes, movimientos);
  return puenteDesdeIndice(ix, tid);
}

export function puenteDesdeIndice(ix: Indice, tid: string) {
  const churn = ix.churnPorQ.get(tid) ?? new Set<string>();
  const bajas = ix.bajasPorQ.get(tid) ?? [];
  const bajasSet = new Set(bajas);

  const churnQueSalio = [...churn].filter(k => bajasSet.has(k)).length;
  const bajaYaContada = bajas
    .filter(k => !churn.has(k) && ix.contadaAntes(tid, k)).length;
  return {
    churn: churn.size,
    churnQueSalio,
    churnQueSigue: churn.size - churnQueSalio,
    bajas: bajas.length,
    bajaYaContada,
    bajaSinChurn: bajas.length - churnQueSalio - bajaYaContada,
  };
}
