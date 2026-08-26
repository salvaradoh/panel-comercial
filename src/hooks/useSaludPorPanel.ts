import { useMemo } from 'react';
import { useCacheSheet } from './useCacheSheet';
import { clavePais } from '../lib/paises';

/**
 * Score de SALUD (RENT/VENT) por cliente, indexado por país + panel_id.
 *
 * Existe porque la tabla de Segmentación mostraba el score de SEGMENTACIÓN, que
 * ya está representado por la letra A+/A/B/C de la columna Segmento. Son dos
 * números distintos del mismo cliente: uno dice cuánto vale, el otro qué tan en
 * riesgo está.
 *
 * La llave es `empresa`, que en los cachés ES el panel_id. Primero se intentó
 * cruzar por nombre —porque el tipo del frontend solo exponía `cliente`— y daba
 * 39% de match; por panel da **99,9% (785 de 786)**. El único que no cruza es
 * ENTEL Perú, que usa "ENTEL" como panel en vez de un RUC.
 *
 * Reusa la query key de `useCacheSheet('Cache_Churn')`, así que no agrega ningún
 * fetch: Salud del Cliente y la tabla de clientes ya traen esa hoja.
 */
export type SaludPorPanel = Map<string, { score: number; status: string }>;

export function clavePanel(pais: string | undefined, panelId: string | undefined): string {
  return `${clavePais(pais)}||${String(panelId ?? '').trim()}`;
}

export function useSaludPorPanel() {
  const { data: raw, isLoading } = useCacheSheet<unknown>('Cache_Churn');

  const salud = useMemo<SaludPorPanel>(() => {
    const m: SaludPorPanel = new Map();
    if (!raw) return m;

    // Se recorre en profundidad en vez de cablear las rutas del JSON: el GAS
    // agregó arrays de clientes nuevos más de una vez (churn, retenidos,
    // estacionales, perdidos) y cablearlas se rompía en silencio.
    const visto = new Set<unknown>();
    const recorrer = (o: unknown, prof: number) => {
      if (prof > 6 || o == null || typeof o !== 'object' || visto.has(o)) return;
      visto.add(o);
      if (Array.isArray(o)) { o.forEach(x => recorrer(x, prof + 1)); return; }

      const c = o as Record<string, unknown>;
      const empresa = typeof c.empresa === 'string' ? c.empresa : null;
      const pais    = typeof c.pais === 'string' ? c.pais : null;
      const score   = typeof c.score === 'number' ? c.score : null;
      if (empresa && pais && score != null && score > 0) {
        const k = clavePanel(pais, empresa);
        // El primero gana: si un cliente aparece en dos arrays el score es el
        // mismo, y sobrescribir solo gastaría trabajo.
        if (!m.has(k)) m.set(k, { score, status: String(c.status ?? '') });
      }
      Object.values(c).forEach(v => recorrer(v, prof + 1));
    };
    recorrer(raw, 0);
    return m;
  }, [raw]);

  return { salud, isLoading };
}
