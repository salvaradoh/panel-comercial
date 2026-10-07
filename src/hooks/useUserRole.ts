import { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useCodigosVendedores, normalizarRol } from './useEquipo';

export type AccessRole = 'Ejecutivo' | 'Country Manager' | 'C-level' | 'Admin';

export interface UserRoleData {
  nombre: string;
  kamId: string;
  pais: string;
  rol: AccessRole;
}

// Ya no existe una lista de emails excluidos del tracking: se decide por rol
// en useTrack. La lista anterior fallaba abierta — a quien no figuraba en ella
// lo trackeaba igual.

/**
 * Rol de cada persona indexado por la PARTE LOCAL del email (antes de la @).
 *
 * La hoja registra un solo dominio por persona, pero varios entran con el otro
 * (figuran con @apprecio.com y entran con @dcanje.com, o al revés). Para decidir a
 * quién NO trackear hace falta reconocerlo con cualquier dominio: si no, un Admin
 * entrando por su cuenta @dcanje no matchearía ninguna fila y quedaría trackeado.
 */
export function useRolesPorLocal() {
  const q = useCodigosVendedores();
  const data = useMemo<Record<string, string> | undefined>(() => {
    if (!q.data) return undefined;
    const out: Record<string, string> = {};
    for (const f of q.data) {
      const local = f.email.split('@')[0];
      if (local && f.rolHoja) out[local] = f.rolHoja;
    }
    return out;
  }, [q.data]);
  return { ...q, data };
}

/**
 * Rol del usuario conectado, según la hoja `Codigos Vendedores` y nada más: quien no
 * figura ahí devuelve `null` (decisión de Samuel, 2026-10-07; antes había una lista de
 * respaldo en el código, que exponía correos y roles en el JavaScript publicado).
 *
 * Se compara por la PARTE LOCAL del correo, no por el correo completo: apprecio.com y
 * dcanje.com son el mismo Workspace y varios entran con el dominio que no figura en la
 * hoja. Con la comparación exacta no matcheaban (verificado 2026-09-09). Es el mismo
 * criterio que usa el backend en resolverAlcance.
 */
export function useUserRole() {
  const { user } = useAuth();
  const email = user?.email?.toLowerCase() ?? '';
  const q = useCodigosVendedores();

  const data = useMemo<UserRoleData | null | undefined>(() => {
    if (q.isError) return null;
    if (!q.data) return undefined;
    const local = email.split('@')[0];
    const f = local ? q.data.find((r) => r.email.split('@')[0] === local) : undefined;
    if (!f) return null;
    return { nombre: f.nombre, kamId: f.kamId, pais: f.pais, rol: normalizarRol(f.rolHoja) };
  }, [q.data, q.isError, email]);

  return { ...q, data };
}
