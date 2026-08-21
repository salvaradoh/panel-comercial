import { useCacheSheet } from './useCacheSheet';
import type { SegmentacionResponse } from './types';

// Lee Cache_Segmentacion18 directamente desde Sheets (sin backend Cloud Run).
export function useSegmentacion() {
  return useCacheSheet<SegmentacionResponse>('Cache_Segmentacion18');
}
