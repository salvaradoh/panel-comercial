import { useMemo } from 'react';
import { useCacheSegmentacion } from './useCacheSegmentacion';
import { useCacheChurn } from './useCacheChurn';
import type { SegmentacionResponse } from './types';
import { clavePais } from '../lib/paises';

type ClienteSeg = SegmentacionResponse['clientes'][number];

/** Un factor ya resuelto para pintar un chip, con su peso. */
export interface FactorSegmento {
  campo: 'ptVol' | 'ptMeses' | 'ptUsrInc' | 'ptFee' | 'fVol' | 'fProd' | 'fMeses' | 'fMargen';
  icon: string;
  label: string;
  pct: string;
  peso: number;
  val: number;
  title: string;
}

export interface DesgloseSegmento {
  score: number;
  factores: FactorSegmento[];
}

// Mismos pesos y textos que la tabla de Segmentación (SegmentacionTab.tsx), para
// que el desglose de la ficha diga lo mismo que el de esa vista.
const FACTORES_REC: Omit<FactorSegmento, 'val'>[] = [
  { campo: 'ptVol',    icon: '💰', pct: '50%',   label: 'Volumen',               peso: 0.50,  title: 'Volumen — Pareto por país, peso 50%' },
  { campo: 'ptMeses',  icon: '📅', pct: '20%',   label: 'Meses con compra',      peso: 0.20,  title: 'Meses con compra, peso 20%' },
  { campo: 'ptUsrInc', icon: '👥', pct: '20%',   label: 'Usuarios incorporados', peso: 0.20,  title: 'Usuarios incorporados, peso 20%' },
  { campo: 'ptFee',    icon: '💼', pct: '10%',   label: 'Fee/SaaS',              peso: 0.10,  title: 'Fee/SaaS, peso 10%' },
];
const FACTORES_EST: Omit<FactorSegmento, 'val'>[] = [
  { campo: 'fVol',    icon: '💰',  pct: '50%',   label: 'Volumen',               peso: 0.50,  title: 'Volumen — Pareto por país, peso 50%' },
  { campo: 'fProd',   icon: '🛍️', pct: '25%',   label: 'Producto dominante',    peso: 0.25,  title: 'Producto dominante — SaaS=4, Puntos=3, SC=2, GC=1, peso 25%' },
  { campo: 'fMeses',  icon: '📅',  pct: '12.5%', label: 'Meses con compra',      peso: 0.125, title: 'Meses con compra en últimos 13m, peso 12.5%' },
  { campo: 'fMargen', icon: '📊',  pct: '12.5%', label: 'Margen de mix',         peso: 0.125, title: 'Margen de mix, peso 12.5%' },
];

function claveNombre(pais: string | undefined, nombre: string | undefined): string {
  const n = String(nombre ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
  return `${clavePais(pais)}||${n}`;
}

function clavePanelSeg(pais: string | undefined, panelId: string | undefined): string {
  return `${clavePais(pais)}||${String(panelId ?? '').trim()}`;
}

/**
 * Desglose del score de SEGMENTACIÓN (A+/A/B/C) por cliente — no confundir con
 * el de salud (RENT/VENT) de `useScoresChurn`/`useSaludPorPanel`.
 *
 * Recurrentes (Cache_Segmentacion18) cruzan por panel_id, pero para Chile ese
 * campo es el idSeq que calcula BigQuery, no el RUT que expone "Clientes" (ver
 * docs/plans/2026-09-16-panel-id-real-chile.md y la decisión de no propagar
 * idSeq como clave de cruce del frontend): si el panel_id no matchea, cae a
 * nombre+país, igual que ya hace Cache_Churn con TODOS los estacionales
 * ("empresa" ahí es la razón social, nunca el panel — no tiene de otra).
 */
export function useSegmentoDesglose() {
  const { data: seg, isLoading: loadingSeg } = useCacheSegmentacion();
  const { data: churn, isLoading: loadingChurn } = useCacheChurn();

  const { recPorPanel, recPorNombre, estPorNombre } = useMemo(() => {
    const recPorPanel = new Map<string, ClienteSeg>();
    const recPorNombre = new Map<string, ClienteSeg>();
    (seg?.clientes ?? []).forEach(c => {
      if (c.panelId) recPorPanel.set(clavePanelSeg(c.pais, c.panelId), c);
      if (c.cliente) recPorNombre.set(claveNombre(c.pais, c.cliente), c);
    });

    const estPorNombre = new Map<string, {
      score: number; fVol?: number; fProd?: number; fMeses?: number; fMargen?: number;
    }>();
    (churn?.estacionales.paises ?? []).forEach(p => {
      p.kams.forEach(k => {
        [...k.clientesChurn, ...k.clientesRetenidos].forEach(c => {
          if (!c.empresa) return;
          estPorNombre.set(claveNombre(p.pais, c.empresa), {
            score: c.score, fVol: c.segFVol, fProd: c.segFProd, fMeses: c.segFMeses, fMargen: c.segFMargen,
          });
        });
      });
    });

    return { recPorPanel, recPorNombre, estPorNombre };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seg, churn]);

  function buscar(pais: string, panelId: string | undefined, nombre: string, esEstacional: boolean): DesgloseSegmento | null {
    if (esEstacional) {
      const e = estPorNombre.get(claveNombre(pais, nombre));
      if (!e) return null;
      const factores = FACTORES_EST
        .map(f => ({ ...f, val: Number(e[f.campo as 'fVol' | 'fProd' | 'fMeses' | 'fMargen'] ?? NaN) }))
        .filter(f => !Number.isNaN(f.val));
      if (!factores.length) return null;
      return { score: e.score, factores };
    }

    const r = recPorPanel.get(clavePanelSeg(pais, panelId)) ?? recPorNombre.get(claveNombre(pais, nombre));
    if (!r) return null;
    const factores = FACTORES_REC
      .map(f => ({ ...f, val: Number(r[f.campo as 'ptVol' | 'ptMeses' | 'ptUsrInc' | 'ptFee'] ?? NaN) }))
      .filter(f => !Number.isNaN(f.val));
    if (!factores.length) return null;
    return { score: r.score, factores };
  }

  return { buscar, isLoading: loadingSeg || loadingChurn };
}
