import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';

const SHEET_ID = '1bkYaUeqtm2X-fQFQCOR5b8XgWaIOXKWDSb73X9E9MaM';

export interface HistorialEntry {
  semana: string;
  fecha: number;
  score: number;
  fRec: number;
  fEng: number;
  fTen: number;
  fVig: number;
  status: string;
}

// clave "pais||panelId" → entries ordenadas por fecha asc
export type HistorialMap = Map<string, HistorialEntry[]>;

/**
 * `Panel ID` NO es único entre países: Perú y Colombia usan enteros
 * correlativos y colisionan (el ID 19 es "TAI LOY S.A." en Perú y
 * "CONTENUR COLOMBIA SAS" en Colombia — 138 choques en total). Indexar solo
 * por panelId mezclaba la serie de dos empresas distintas en un mismo gráfico.
 */
export function histKey(pais: string, panelId: string) {
  // La pestaña Historial escribe "Peru"/"Mexico" sin acento y la de Clientes
  // "Perú"/"México": sin normalizar, la clave compuesta perdía 262 clientes.
  const p = pais.trim()
    .replace(/^Peru$/i, 'Perú')
    .replace(/^Mexico$/i, 'México');
  return `${p}||${panelId.trim()}`;
}

function parseNum(v: unknown): number {
  if (v == null || v === '') return 0;
  return parseFloat(String(v).replace(',', '.')) || 0;
}

export function useHistorial() {
  const { token } = useAuth();

  return useQuery<HistorialMap>({
    queryKey: ['historial-clientes'],
    queryFn: async () => {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Historial!A:O?valueRenderOption=UNFORMATTED_VALUE`;
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error(`Sheets API Historial ${resp.status}`);
      const json = await resp.json();
      const rows: unknown[][] = (json.values || []).slice(1);

      const map: HistorialMap = new Map();
      // El GAS reescribe el snapshot varias veces por semana: 2.824 de las
      // 16.212 filas son pares (cliente, semana) repetidos. Se conserva la
      // última ocurrencia de cada semana para no duplicar puntos en la serie.
      const vistos = new Set<string>();
      for (const r of rows) {
        // Col 2 = País, col 3 = Panel ID
        const panelId = String(r[3] || '').trim();
        if (!panelId || panelId === '-') continue;
        const key = histKey(String(r[2] || ''), panelId);
        const entry: HistorialEntry = {
          fecha:  parseNum(r[0]),
          semana: String(r[1] || ''),
          score:  parseNum(r[8]),
          fRec:   parseNum(r[9]),
          fEng:   parseNum(r[10]),
          fTen:   parseNum(r[11]),
          // Status está en la col 14, no en la 12. El header de Historial es
          // 8=Score 9=(R) 10=(E) 11=(T) 12=(V) 13=(N) 14=Status: leer r[12]
          // devolvía el factor de Vigencia ("3") en vez del estado del cliente.
          fVig:   parseNum(r[12]),
          status: String(r[14] || ''),
        };
        const list = map.get(key) ?? [];
        const dedup = `${key}||${entry.semana}`;
        if (vistos.has(dedup)) {
          const i = list.findIndex(e => e.semana === entry.semana);
          if (i >= 0) list[i] = entry;
        } else {
          vistos.add(dedup);
          list.push(entry);
        }
        map.set(key, list);
      }
      // ordenar cada lista por fecha asc
      map.forEach(list => list.sort((a, b) => a.fecha - b.fecha));
      return map;
    },
    enabled: !!token,
    staleTime: 30 * 60 * 1000,
    gcTime:    60 * 60 * 1000,
    retry: 1,
  });
}
