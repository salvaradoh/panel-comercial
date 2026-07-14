import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';

const REUNIONES_SPREADSHEET_ID = '1Xpe_rp35H-h0ppN1aPpyPYQOA3ztD4bza82YDtZyJP4';

// Copia de KAM_NOMBRES_DASH del GAS — mapea kamId → nombre completo
const KAM_NOMBRES: Record<string, string> = {
  MS: 'Magda Sernaque',    JG: 'Joao Guerra',       DD: 'Diana Duran',
  CT: 'Colombina Trujillo',GO: 'Giovanny Olvera',   Roberto: 'Roberto Molina',
  RM: 'Roberto Molina',    SC: 'Santiago Cuellar',  Sharon: 'Sharon Hernandez',
  CF: 'Camilo Figueroa',   BC: 'Benjamin Castro',   BG: 'Benjamin González',
  Aura: 'Aura M. Ávila',  LJ: 'Lorenzo Jamasmie',  Felipe: 'Felipe Ospina',
  Ander: 'Anderson León',  JC: 'Johanna Calzada',   PM: 'Paula Montoya',
  AA: 'Alvaro Agliati',    DA: 'Darling Allendes',  LG: 'Laura Galindo',
};

export interface SellerReuniones {
  sellerEmail: string;
  nombre: string;
  rol: string;
  mes: number;
  sem1: number;
  sem2: number;
  sem3: number;
  sem4: number;
}

async function fetchSheet(spreadsheetId: string, range: string, token: string): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Sheets ${res.status}: ${range}`);
  const { values = [] } = await res.json() as { values: string[][] };
  return values;
}

export function useReuniones(anio: number, mes: number) {
  const { token } = useAuth();

  return useQuery<SellerReuniones[]>({
    queryKey: ['reuniones-direct', anio, mes],
    queryFn: async () => {
      // Leer ambas hojas en paralelo
      const [jerarquiasRows, reunionesRows] = await Promise.all([
        fetchSheet(REUNIONES_SPREADSHEET_ID, 'Jerarquias!A:C', token!),
        fetchSheet(REUNIONES_SPREADSHEET_ID, 'Reuniones!A:H', token!),
      ]);

      // email → { kamId, rol }
      const emailMap: Record<string, { kamId: string; rol: string }> = {};
      for (const row of jerarquiasRows.slice(1)) {
        const email = String(row[0] ?? '').toLowerCase().trim();
        const kamId = String(row[1] ?? '').trim();
        const rol   = String(row[2] ?? '').trim() || 'KAM';
        if (email && kamId) emailMap[email] = { kamId, rol };
      }

      // Primera visita única (seller, customer) por mes
      const first: Record<string, { fecha: string; semana: number; seller: string }> = {};
      for (const row of reunionesRows.slice(1)) {
        if (Number(row[2]) !== anio || Number(row[3]) !== mes) continue;
        const seller   = String(row[5] ?? '').toLowerCase().trim();
        const customer = String(row[6] ?? '').toLowerCase().trim();
        const semana   = Number(row[4]);
        const fecha    = String(row[1] ?? '');
        if (!seller || !customer) continue;
        const key = `${seller}||${customer}`;
        if (!first[key] || fecha < first[key].fecha) {
          first[key] = { fecha, semana, seller };
        }
      }

      // Agregar por seller
      const agg: Record<string, { mes: number; s1: number; s2: number; s3: number; s4: number }> = {};
      for (const { seller, semana } of Object.values(first)) {
        if (!agg[seller]) agg[seller] = { mes: 0, s1: 0, s2: 0, s3: 0, s4: 0 };
        agg[seller].mes++;
        if (semana === 1)      agg[seller].s1++;
        else if (semana === 2) agg[seller].s2++;
        else if (semana === 3) agg[seller].s3++;
        else if (semana === 4) agg[seller].s4++;
      }

      return Object.entries(agg).map(([sellerEmail, c]) => {
        const info   = emailMap[sellerEmail];
        const kamId  = info?.kamId ?? '';
        const nombre = KAM_NOMBRES[kamId] ?? (info ? kamId : sellerEmail.split('@')[0]);
        return {
          sellerEmail,
          nombre,
          rol:  info?.rol ?? 'KAM',
          mes:  c.mes,
          sem1: c.s1,
          sem2: c.s2,
          sem3: c.s3,
          sem4: c.s4,
        };
      });
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
    gcTime:    15 * 60 * 1000,
    retry: 1,
  });
}
