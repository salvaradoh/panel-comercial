import { useCacheSheet } from './useCacheSheet';

export interface OverviewFact {
  pais: string;
  n: number;
  monto6m: number;
  monto6mAnt: number;
  pctRetencion: number;
}

export interface OverviewRecup {
  pais: string;
  total: number;
  recuperados: number;
  deteriorados: number;
  semanaActual: string;
  semanaAnt: string;
}

export interface OverviewProbFuga {
  pais: string;
  n: number;
  probFugaProm: number;
  probFugaMax: number;
  altaFuga: number;
}

export interface OverviewProductoCat {
  nombre: string;
  vol: number;
  pct: number;
}

export interface OverviewProductoMix {
  pais: string;
  total: number;
  categorias: OverviewProductoCat[];
}

export interface OverviewData {
  computedAt: string;
  facturacion: OverviewFact[];
  recuperacion: OverviewRecup[];
  probFuga: OverviewProbFuga[];
  productosMix?: OverviewProductoMix[];
}

export function useOverview() {
  return useCacheSheet<OverviewData>('Cache_Overview');
}
