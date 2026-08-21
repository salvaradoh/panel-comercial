import { useCacheSheet } from './useCacheSheet';

export interface SeriesAnio {
  global: { time: string; value: number }[];
  paises: Record<string, { time: string; value: number }[]>;
}

export interface WeekPoint {
  time: string;   // sintético: YYYY-MM-{01|08|15|22}
  semana: number; // 1–4
  mes: number;
  value: number;
}

export interface SemanasAnio {
  global: { time: string; value: number }[];
  paises: Record<string, WeekPoint[]>;
}

export interface CacheSeriesData {
  updated: string;
  series:  Record<string, SeriesAnio>;  // key = año como string
  semanas?: Record<string, SemanasAnio>; // key = año como string
}

// Lee Cache_Series (escrito por GAS escribirCacheSeries) una sola vez.
// Cubre año actual + año anterior en un solo fetch.
export function useCacheSeries() {
  return useCacheSheet<CacheSeriesData>('Cache_Series');
}
