import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';

const CODIGOS_ID = '1w3lOhP4m-uPX49E-cyaZJgFXFxaT3Hhf4izCfsyFmho';
const RANGE = 'Codigos Vendedores!H2:L100';

export type AccessRole = 'Ejecutivo' | 'Country Manager' | 'C-level';

export interface UserRoleData {
  nombre: string;
  kamId: string;
  pais: string;
  rol: AccessRole;
}

export function useUserRole() {
  const { token, user } = useAuth();
  const email = user?.email?.toLowerCase() ?? '';

  return useQuery<UserRoleData | null>({
    queryKey: ['user-role', email],
    queryFn: async () => {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${CODIGOS_ID}/values/${encodeURIComponent(RANGE)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Codigos Vendedores ${res.status}`);
      const json = await res.json();
      const rows: string[][] = json.values || [];

      // cols relativas: H=0 Nombre, I=1 KamId, J=2 Correo, K=3 País, L=4 Rol
      const row = rows.find(r => String(r[2] ?? '').toLowerCase().trim() === email);
      if (!row) return null; // no encontrado → acceso completo (C-level)

      return {
        nombre: String(row[0] ?? '').trim(),
        kamId:  String(row[1] ?? '').trim(),
        pais:   String(row[3] ?? '').trim(),
        rol:    (String(row[4] ?? '').trim() as AccessRole) || 'Ejecutivo',
      };
    },
    enabled: !!token && !!email,
    staleTime: 60 * 60 * 1000,
    gcTime:    60 * 60 * 1000,
    retry: 1,
  });
}
