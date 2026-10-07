import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCodigosVendedores, useKamNombres } from './useEquipo';
import { useAuth } from '../auth/AuthContext';

const REUNIONES_SPREADSHEET_ID = '1Xpe_rp35H-h0ppN1aPpyPYQOA3ztD4bza82YDtZyJP4';

// Fallback: deriva el prefijo de correo "jperez" desde el nombre "José Pérez".
// Patrón: primera_letra_nombre + apellido.
function nameToPrefix(nombre: string): string {
  const norm = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const parts = norm.split(/\s+/).filter(p => p.length > 2 && !p.endsWith('.'));
  if (parts.length < 2) return '';
  return parts[0][0] + parts[parts.length - 1];
}

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

/** Fila agregada antes de ponerle nombre: el nombre se resuelve con la hoja de códigos. */
type SellerSinNombre = Omit<SellerReuniones, 'nombre'> & { kamId: string };

export function useReuniones(anio: number, mes: number) {
  const { token } = useAuth();
  const { data: codigos } = useCodigosVendedores();
  const nombres = useKamNombres();

  const q = useQuery<SellerSinNombre[]>({
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
        const info = emailMap[sellerEmail];
        return {
          sellerEmail,
          kamId: info?.kamId ?? '',
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

  // Nombre de cada vendedor, en este orden: su correo en la hoja de códigos; su código
  // de Jerarquias; el prefijo del correo derivado de los nombres de la hoja; el prefijo.
  const data = useMemo<SellerReuniones[] | undefined>(() => {
    if (!q.data) return undefined;
    const porLocal: Record<string, string> = {};
    const porPrefijo: Record<string, string> = {};
    for (const f of codigos ?? []) {
      const local = f.email.split('@')[0];
      if (local) porLocal[local] = f.nombre;
      const pref = nameToPrefix(f.nombre);
      if (pref && !porPrefijo[pref]) porPrefijo[pref] = f.nombre;
    }
    return q.data.map(({ kamId, ...r }) => {
      const prefix = r.sellerEmail.split('@')[0];
      const nombre = porLocal[prefix] ?? nombres[kamId] ?? porPrefijo[prefix] ?? (kamId || prefix);
      return { ...r, nombre };
    });
  }, [q.data, codigos, nombres]);

  return { ...q, data };
}
