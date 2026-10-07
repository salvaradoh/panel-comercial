import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { useKamNombres } from './useEquipo';

// Hoja Jerarquias: col A=Email, col B=KAM_ID, col C=Rol
const SHEET_ID  = '1Xpe_rp35H-h0ppN1aPpyPYQOA3ztD4bza82YDtZyJP4';
const RANGE     = 'Jerarquias!A2:C200';

/**
 * Rol comercial (KAM, Full Cycle, BDM) indexado por código, nombre completo y primer
 * nombre. Los nombres salen de la hoja de códigos (`useKamNombres`).
 */
export function useRoles() {
  const { token } = useAuth();
  const nombres = useKamNombres();

  const q = useQuery<[string, string][]>({
    queryKey: ['roles'],
    queryFn: async () => {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?valueRenderOption=FORMATTED_VALUE`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Jerarquias ${res.status}`);
      const json = await res.json();
      const rows: string[][] = json.values || [];
      return rows
        .map((row) => [String(row[1] || '').trim(), String(row[2] || '').trim()] as [string, string])
        .filter(([id, rol]) => id && rol);
    },
    enabled: !!token,
    staleTime: 60 * 60 * 1000,
    gcTime:    60 * 60 * 1000,
    retry: 1,
  });

  const data = useMemo<Record<string, string> | undefined>(() => {
    if (!q.data) return undefined;
    const out: Record<string, string> = {};
    for (const [id, rol] of q.data) {
      // ID corto: "JC"
      out[id] = rol;
      const nombre = nombres[id];
      if (nombre) {
        // Nombre completo y primer nombre
        out[nombre] = rol;
        const primer = nombre.split(' ')[0];
        if (primer) out[primer] = rol;
      }
    }
    return out;
  }, [q.data, nombres]);

  return { ...q, data };
}
