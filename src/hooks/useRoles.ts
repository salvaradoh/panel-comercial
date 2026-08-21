import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';

// Hoja Jerarquias: col A=Email, col B=KAM_ID, col C=Rol
const SHEET_ID  = '1Xpe_rp35H-h0ppN1aPpyPYQOA3ztD4bza82YDtZyJP4';
const RANGE     = 'Jerarquias!A2:C200';

// Nombres canónicos por ID — espejo del backend kams.js
const KAM_NOMBRES: Record<string, string> = {
  MS:'Magda Sernaque', JG:'Joao Guerra', DD:'Diana Duran', CT:'Colombina Trujillo',
  GO:'Giovanny Olvera', Roberto:'Roberto Molina', SC:'Santiago Cuellar',
  Sharon:'Sharon Hernandez', CF:'Camilo Figueroa', BC:'Benjamin Castro',
  BG:'Benjamin González', Aura:'Aura M. Ávila', LJ:'Lorenzo Jamasmie',
  Felipe:'Felipe Ospina', Ander:'Anderson León', JC:'Johanna Calzada',
  PM:'Paula Montoya', DA:'Darling Allendes', LG:'Laura Galindo',
};

export function useRoles() {
  const { token } = useAuth();

  return useQuery<Record<string, string>>({
    queryKey: ['roles'],
    queryFn: async () => {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?valueRenderOption=FORMATTED_VALUE`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Jerarquias ${res.status}`);
      const json = await res.json();
      const rows: string[][] = json.values || [];

      const out: Record<string, string> = {};
      for (const row of rows) {
        const id  = String(row[1] || '').trim();
        const rol = String(row[2] || '').trim();
        if (!id || !rol) continue;

        // ID corto: "JC"
        out[id] = rol;
        const nombre = KAM_NOMBRES[id];
        if (nombre) {
          // Nombre completo: "Johanna Calzada"
          out[nombre] = rol;
          // Primer nombre: "Johanna"
          const primer = nombre.split(' ')[0];
          if (primer) out[primer] = rol;
        }
      }
      return out;
    },
    enabled: !!token,
    staleTime: 60 * 60 * 1000,
    gcTime:    60 * 60 * 1000,
    retry: 1,
  });
}
