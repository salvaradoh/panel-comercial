import { useCacheSheet } from './useCacheSheet';
import type { RankingResponse } from './types';

// Lee Cache_Ranking (escrito por GAS escribirCacheRanking) directamente via Sheets API.
// Elimina la dependencia del backend Cloud Run para esta ruta.
export function useRanking(_anio: number) {
  return useCacheSheet<RankingResponse>('Cache_Ranking');
}
