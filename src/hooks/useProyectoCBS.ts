import { useMemo } from 'react';
import { useSheetTabla } from './useSheetTabla';
import { CBS_SPREADSHEET_ID, CBS_RANGO, parseFilasCBS } from '../lib/cbs';
import type { DatosCBS } from '../lib/cbs';

/**
 * Lee la hoja del proyecto CBS en vivo y la deja tipada.
 *
 * Toda la lógica —mapeo de columnas y agregados— vive en `lib/cbs.ts`, sin React
 * de por medio, para poder verificarla contra la hoja real desde Node.
 */
export function useProyectoCBS() {
  const q = useSheetTabla(CBS_SPREADSHEET_ID, CBS_RANGO);

  const datos = useMemo<DatosCBS | undefined>(
    () => (q.data ? parseFilasCBS(q.data.headers, q.data.filas) : undefined),
    [q.data],
  );

  return { ...q, datos };
}
