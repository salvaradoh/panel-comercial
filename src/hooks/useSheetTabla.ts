import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';

/**
 * Lee un rango CRUDO de cualquier spreadsheet con el token OAuth del usuario.
 *
 * No confundir con `useCacheSheet`: ese lee las hojas `Cache_*` que escribe el
 * Apps Script, donde el contenido es un JSON partido en chunks de 49.000
 * caracteres en la columna A. Acá la hoja es una tabla normal —cabecera en la
 * primera fila, un registro por fila— que edita gente a mano.
 *
 * El scope `spreadsheets.readonly` que pide LoginPage sirve para CUALQUIER hoja
 * que el usuario pueda abrir, no solo para la del dashboard, así que no hace
 * falta ni ETL ni endpoint en el backend: el navegador la lee directo y siempre
 * ve lo último que guardó el equipo comercial.
 *
 * Se usa `FORMATTED_VALUE` (el default de la API) a propósito: devuelve las
 * fechas como el texto que se ve en la hoja ("1/04/2026") en vez del número de
 * serie que devolvería `UNFORMATTED_VALUE`.
 */
export interface TablaSheet {
  headers: string[];
  /** Filas de datos, sin la cabecera. Las celdas vacías del final vienen ausentes. */
  filas: string[][];
}

export function useSheetTabla(spreadsheetId: string, rango: string, enabled = true) {
  const { token } = useAuth();

  return useQuery<TablaSheet>({
    queryKey: ['sheet-tabla', spreadsheetId, rango],
    queryFn: async () => {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(rango)}`;
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`Sheets API ${resp.status}: ${body.slice(0, 300)}`);
      }
      const json = await resp.json();
      const values: string[][] = json.values ?? [];
      if (!values.length) throw new Error(`El rango "${rango}" vino vacío`);
      const [cabecera, ...filas] = values;
      return {
        headers: cabecera.map((h) => String(h ?? '').trim()),
        filas,
      };
    },
    enabled: !!token && !!spreadsheetId && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}
