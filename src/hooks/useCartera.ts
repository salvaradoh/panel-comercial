import { useCacheSheet } from './useCacheSheet';
import type { CarteraRichResponse } from './types';

// Lee Cache_Churn directamente desde Sheets (sin backend Cloud Run).
export function useCartera(_anio: number) {
  return useCacheSheet<CarteraRichResponse>('Cache_Churn');
}
