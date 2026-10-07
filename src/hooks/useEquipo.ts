import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import type { AccessRole, UserRoleData } from './useUserRole';

/**
 * El equipo comercial, sus códigos de KAM y sus roles salen de UNA sola fuente: la hoja
 * `Codigos Vendedores` (columnas H a L: nombre · código · correo · país · rol). Es la misma
 * que BigQuery expone como `Ventas_Apprecio.Vista_Jerarquias`.
 *
 * Antes había listas fijas en el código (roles con correos, tres copias de código → nombre)
 * que se publicaban en el JavaScript del sitio — hallazgo 3.2 del informe de seguridad del
 * 2026-10-05 —. Ya no hay respaldo: quien no está en la hoja no tiene rol (decisión de
 * Samuel, 2026-10-08).
 */

const CODIGOS_ID = '1w3lOhP4m-uPX49E-cyaZJgFXFxaT3Hhf4izCfsyFmho';
const RANGE = 'Codigos Vendedores!H2:L200';

export interface FilaCodigos {
  nombre: string;
  kamId: string;
  email: string;
  pais: string;
  /** Tal como viene en la hoja ("Full Cycle", "BDM"...). Para el acceso, usar `normalizarRol`. */
  rolHoja: string;
}

export interface PersonaComercial {
  nombre: string;
  email: string;
  pais: string;
  rol: string;
}

/**
 * La hoja escribe roles que el código no conocía. Verificado el 2026-08-19: cuatro
 * ejecutivos figuraban como **"Full Cycle"**, y el cast a AccessRole no valida nada en
 * runtime — el string pasaba tal cual, no matcheaba ninguna comparación de rol y caían en
 * el caso `null` de App.tsx, que es "dashboard completo": todos los países, la
 * cartera de todos y sin Mi Vista.
 *
 * Full Cycle es un ejecutivo que además prospecta: tiene código de KAM y cartera
 * propia, así que su acceso es el de Ejecutivo.
 */
const ALIAS_ROL: Record<string, AccessRole> = {
  'ejecutivo':       'Ejecutivo',
  'full cycle':      'Ejecutivo',
  'fullcycle':       'Ejecutivo',
  'kam':             'Ejecutivo',
  // BDM: mismo acceso que un ejecutivo —vista
  // propia y filtrada, sin Movimientos—. Su venta NO se les atribuye como
  // cartera: en Movimientos van a "Otros" (MOV_NO_EJECUTIVO_IDS en Cache.js del
  // GAS). Son dos cosas distintas: qué puede ver y a quién se le imputa.
  'bdm':             'Ejecutivo',
  'country manager': 'Country Manager',
  'countrymanager':  'Country Manager',
  'c-level':         'C-level',
  'c level':         'C-level',
  'clevel':          'C-level',
  'admin':           'Admin',
};

/**
 * Un rol que no está en la tabla cae en 'Ejecutivo', el MÁS restringido. Antes
 * caía en el dashboard completo: el control de acceso fallaba ABIERTO, así que
 * un typo en la hoja o un rol nuevo regalaba visibilidad de C-level. Preferimos
 * que alguien reclame que ve poco antes que no enterarnos de que ve todo.
 */
export function normalizarRol(v: string): AccessRole {
  const k = String(v || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
  if (!k) return 'Ejecutivo';
  return ALIAS_ROL[k] ?? 'Ejecutivo';
}

/** La hoja escribe "Mexico" y "Peru"; el panel usa los nombres con tilde. */
function paisCanonico(p: string): string {
  return p.trim().replace(/^Mexico$/i, 'México').replace(/^Peru$/i, 'Perú');
}

/** Nombres que la cartera usa como bolsa y que no son personas: nunca son destinatarios. */
const NO_SON_PERSONAS = new Set(['otros', 'pais', 'país', '-', '#n/a', 'dcanje']);

/** "José Pérez" y "Jose Perez" tienen que ser la misma persona. */
export function claveNombre(nombre: string): string {
  return String(nombre || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

export function esPersona(nombre: string): boolean {
  const k = claveNombre(nombre);
  return Boolean(k) && !NO_SON_PERSONAS.has(k);
}

/** Lectura única de la hoja. Todo lo demás de este archivo deriva de acá. */
export function useCodigosVendedores() {
  const { token } = useAuth();

  return useQuery<FilaCodigos[]>({
    queryKey: ['codigos-vendedores'],
    enabled: !!token,
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${CODIGOS_ID}/values/${encodeURIComponent(RANGE)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Codigos Vendedores ${res.status}`);
      const json = await res.json();

      const out: FilaCodigos[] = [];
      for (const r of (json.values ?? []) as string[][]) {
        const nombre = String(r[0] ?? '').trim();
        if (!nombre) continue;
        out.push({
          nombre,
          kamId:   String(r[1] ?? '').trim(),
          email:   String(r[2] ?? '').toLowerCase().trim(),
          pais:    String(r[3] ?? '').trim(),
          rolHoja: String(r[4] ?? '').trim(),
        });
      }
      return out;
    },
  });
}

/** El personal comercial activo, con su correo (destinatarios de Campañas). */
export function useEquipoComercial() {
  const q = useCodigosVendedores();
  const data = useMemo<PersonaComercial[] | undefined>(
    () => q.data
      ?.filter((f) => f.email.includes('@'))
      .map((f) => ({ nombre: f.nombre, email: f.email, pais: f.pais, rol: f.rolHoja })),
    [q.data],
  );
  return { ...q, data };
}

/** Código de KAM → nombre completo, según la hoja. Vacío mientras carga. */
export function useKamNombres(): Record<string, string> {
  const { data } = useCodigosVendedores();
  return useMemo(() => {
    const out: Record<string, string> = {};
    for (const f of data ?? []) {
      if (f.kamId && f.kamId !== '-') out[f.kamId] = f.nombre;
    }
    return out;
  }, [data]);
}

/**
 * Ejecutivos y Country Managers con su país (con tilde) y rol de acceso. Alimenta el
 * selector "ver como" del Admin y los filtros de reuniones por país.
 */
export function useEjecutivos(): UserRoleData[] {
  const { data } = useCodigosVendedores();
  return useMemo(
    () => (data ?? [])
      .map((f) => ({ nombre: f.nombre, kamId: f.kamId || '-', pais: paisCanonico(f.pais), rol: normalizarRol(f.rolHoja) }))
      .filter((p) => p.rol === 'Ejecutivo' || p.rol === 'Country Manager'),
    [data],
  );
}

/** Índice por nombre normalizado, para cruzar contra los ejecutivos de una campaña. */
export function indexarPorNombre(equipo: PersonaComercial[] | undefined) {
  const m = new Map<string, PersonaComercial>();
  (equipo ?? []).forEach((p) => m.set(claveNombre(p.nombre), p));
  return m;
}
