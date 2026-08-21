import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';

const SPREADSHEET_ID = import.meta.env.VITE_DASHBOARD_SPREADSHEET_ID as string;

export function useCacheSheet<T = unknown>(sheetName: string, enabled = true) {
  const { token } = useAuth();

  return useQuery<T>({
    queryKey: ['cache-sheet', sheetName],
    queryFn: async () => {
      // FORMULA render returns the formula TEXT for cells that Sheets
      // re-interpreted as formulas (chunks starting with +, -, =, @).
      // This recovers the original JSON chunk instead of getting #ERROR!.
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}!A:A?valueRenderOption=FORMULA`;
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`Sheets API ${resp.status}: ${body}`);
      }
      const json = await resp.json();
      // With FORMULA render, cells misinterpreted as formulas return their formula
      // text. If Sheets prepended '=', strip it to recover the original JSON chunk.
      // Cells that are entirely Sheets error strings are skipped (fallback safety).
      const CELL_ERR = /^#(?:ERROR|REF|VALUE|N\/A|NAME\?|NUM!|DIV\/0)!/;
      const rows: string[] = (json.values || [])
        .map((r: string[]) => {
          const v = String(r[0] ?? '');
          if (CELL_ERR.test(v)) return '';
          if (v.startsWith('=')) return v.slice(1);
          return v;
        });
      if (!rows.length) throw new Error(`Sheet "${sheetName}" vacía`);
      const firstCell = rows[0];
      const jsonStart = firstCell.indexOf('{');
      if (jsonStart === -1) throw new Error(`No hay JSON en "${sheetName}"`);
      const chunks = [firstCell.substring(jsonStart), ...rows.slice(1)];
      // Secondary: error text embedded inside a JSON string value within a chunk
      // (GAS read an errored cell via getValue() and wrote the "#ERROR!" literal
      // into the JSON). Replace the whole string value with null.
      const joined = chunks.join('')
        .replace(/"[^"]*#(?:ERROR|REF|VALUE|N\/A|NAME\?|NUM!|DIV\/0)![^"]*"/g, 'null');
      try {
        return JSON.parse(joined) as T;
      } catch (e) {
        const err = e as SyntaxError;
        const pos = Number(err.message.match(/position (\d+)/)?.[1] ?? -1);
        const ctx = pos > 0 ? `…${joined.slice(Math.max(0, pos - 30), pos + 30)}…` : '';
        throw new Error(`JSON inválido en "${sheetName}" pos ${pos}: ${ctx}`);
      }
    },
    enabled: !!token && !!SPREADSHEET_ID && enabled,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}
