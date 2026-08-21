import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';

const SHEET_ID = '1RaLasiR0jTHNKG6J93k1mku_dtyh9OEbKSY4oW646S8';
const TOP_N = 5;

export interface CanjesItem {
  giftcard: string;
  cantidad: number;
}

export interface CanjesResponse {
  periodo: string;
  totalCanjes: number;
  byPais: Record<string, CanjesItem[]>;
}

export function useCanjes(anio: number, mes: number) {
  const { token } = useAuth();

  return useQuery<CanjesResponse>({
    queryKey: ['canjes', anio, mes],
    queryFn: async () => {
      const mesStr = String(mes).padStart(2, '0');
      const periodoFiltro = `01-${mesStr}-${anio}`;

      const range = encodeURIComponent("'GC compras'!A:G");
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Sheets Canjes API ${res.status}`);
      const json = await res.json();
      const rows: unknown[][] = json.values || [];

      // Skip header row
      const totals: Record<string, number> = {};
      for (const row of rows.slice(1)) {
        const periodo  = String(row[0] || '').trim();
        const giftcard = String(row[6] || row[1] || '').trim();
        const cantidad = Number(row[4]) || 0;
        const pais     = String(row[5] || '').trim();

        if (periodo !== periodoFiltro || !giftcard || !pais) continue;

        const key = `${pais}||${giftcard}`;
        totals[key] = (totals[key] || 0) + cantidad;
      }

      const byPais: Record<string, CanjesItem[]> = {};
      for (const [key, cantidad] of Object.entries(totals)) {
        const [pais, giftcard] = key.split('||');
        if (!byPais[pais]) byPais[pais] = [];
        byPais[pais].push({ giftcard, cantidad });
      }
      for (const pais of Object.keys(byPais)) {
        byPais[pais].sort((a, b) => b.cantidad - a.cantidad);
        byPais[pais] = byPais[pais].slice(0, TOP_N);
      }

      const totalCanjes = Object.values(totals).reduce((s, v) => s + v, 0);
      return { periodo: periodoFiltro, totalCanjes, byPais };
    },
    enabled: !!token,
    staleTime: 15 * 60 * 1000,
  });
}
