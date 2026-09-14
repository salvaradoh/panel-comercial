import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';

const CODIGOS_ID = '1w3lOhP4m-uPX49E-cyaZJgFXFxaT3Hhf4izCfsyFmho';
const RANGE = 'Codigos Vendedores!H2:L100';

export type AccessRole = 'Ejecutivo' | 'Country Manager' | 'C-level' | 'Admin';

/**
 * La hoja escribe roles que el código no conocía. Verificado el 2026-08-19:
 * Paula Montoya, Colombina Trujillo, Giovanny Olvera y Joao Guerra figuran como
 * **"Full Cycle"**, y el cast a AccessRole no valida nada en runtime — el string
 * pasaba tal cual, no matcheaba ninguna comparación de rol y los cuatro caían en
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
  // BDM (Laura Galindo, Darling Allendes): mismo acceso que un ejecutivo —vista
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
function normalizarRol(v: string): AccessRole {
  const k = String(v || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
  if (!k) return 'Ejecutivo';
  return ALIAS_ROL[k] ?? 'Ejecutivo';
}

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
 * (Joao figura como jguerra@apprecio.com y entra como jguerra@dcanje.com). Para
 * decidir a quién NO trackear hace falta reconocerlo con cualquier dominio: si
 * no, un Admin entrando por su cuenta @dcanje no matchearía ninguna fila y
 * quedaría trackeado.
 *
 * Se usa SOLO para esa decisión. El control de acceso sigue resolviéndose por
 * email exacto en useUserRole, sin cambios.
 */
export function useRolesPorLocal() {
  const { token } = useAuth();

  return useQuery<Record<string, string>>({
    queryKey: ['roles-por-local'],
    queryFn: async () => {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${CODIGOS_ID}/values/${encodeURIComponent(RANGE)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Codigos Vendedores ${res.status}`);
      const json = await res.json();
      const out: Record<string, string> = {};
      for (const r of (json.values ?? []) as string[][]) {
        const email = String(r[2] ?? '').toLowerCase().trim();
        const rol   = String(r[4] ?? '').trim();
        const local = email.split('@')[0];
        if (local && rol) out[local] = rol;
      }
      return out;
    },
    enabled: !!token,
    staleTime: 60 * 60 * 1000,
    gcTime:    60 * 60 * 1000,
    retry: 1,
  });
}

// Nombres de ejecutivos por país (para filtrar reuniones y datos)
export const EXEC_BY_PAIS: Record<string, string[]> = {
  Chile:    ['Camilo Figueroa', 'Benjamin Castro', 'Benjamin González', 'Lorenzo Jamasmie', 'Johanna Calzada', 'Darling Allendes'],
  Colombia: ['Roberto Molina', 'Santiago Cuellar', 'Sharon Hernandez', 'Aura M. Ávila', 'Felipe Ospina', 'Anderson León', 'Paula Montoya'],
  México:   ['Colombina Trujillo', 'Giovanny Olvera'],
  Perú:     ['Magda Sernaque', 'Joao Guerra', 'Diana Duran', 'Darling Allendes'],
};

// Lista exportada de ejecutivos para el selector de impersonación
export const EXEC_LIST: UserRoleData[] = [
  { nombre: 'Camilo Figueroa',    kamId: 'CF',      pais: 'Chile',    rol: 'Ejecutivo' },
  { nombre: 'Benjamin Castro',    kamId: 'BC',      pais: 'Chile',    rol: 'Ejecutivo' },
  { nombre: 'Benjamin González',  kamId: 'BG',      pais: 'Chile',    rol: 'Ejecutivo' },
  { nombre: 'Lorenzo Jamasmie',   kamId: 'LJ',      pais: 'Chile',    rol: 'Ejecutivo' },
  { nombre: 'Johanna Calzada',    kamId: 'JC',      pais: 'Chile',    rol: 'Ejecutivo' },
  { nombre: 'Roberto Molina',     kamId: 'Roberto', pais: 'Colombia', rol: 'Ejecutivo' },
  { nombre: 'Santiago Cuellar',   kamId: 'SC',      pais: 'Colombia', rol: 'Ejecutivo' },
  { nombre: 'Sharon Hernandez',   kamId: 'Sharon',  pais: 'Colombia', rol: 'Ejecutivo' },
  { nombre: 'Aura M. Ávila',      kamId: 'Aura',    pais: 'Colombia', rol: 'Ejecutivo' },
  { nombre: 'Felipe Ospina',      kamId: 'Felipe',  pais: 'Colombia', rol: 'Ejecutivo' },
  { nombre: 'Anderson León',      kamId: 'Ander',   pais: 'Colombia', rol: 'Ejecutivo' },
  { nombre: 'Paula Montoya',      kamId: 'PM',      pais: 'Colombia', rol: 'Ejecutivo' },
  { nombre: 'Colombina Trujillo', kamId: 'CT',      pais: 'México',   rol: 'Ejecutivo' },
  { nombre: 'Giovanny Olvera',    kamId: 'GO',      pais: 'México',   rol: 'Ejecutivo' },
  { nombre: 'Magda Sernaque',     kamId: 'MS',      pais: 'Perú',     rol: 'Ejecutivo' },
  { nombre: 'Joao Guerra',        kamId: 'JG',      pais: 'Perú',     rol: 'Ejecutivo' },
  { nombre: 'Diana Duran',        kamId: 'DD',      pais: 'Perú',     rol: 'Ejecutivo' },
  // Country Managers
  { nombre: 'Alvaro Agliati',       kamId: '-', pais: 'Chile',    rol: 'Country Manager' },
  { nombre: 'Daniel Indaburu',      kamId: '-', pais: 'Colombia', rol: 'Country Manager' },
];

const STATIC_ROLES: Record<string, UserRoleData> = {
  // Admins (dashboard completo + selector de impersonación)
  'salvarado@apprecio.com': { nombre: 'Samuel Alvarado',     kamId: '-', pais: '', rol: 'Admin' },
  'ecamus@apprecio.com':    { nombre: 'Erika Camus',         kamId: '-', pais: '', rol: 'Admin' },
  'ecamus@dcanje.com':      { nombre: 'Erika Camus',         kamId: '-', pais: '', rol: 'Admin' },
  // C-level
  'sgajardo@apprecio.com':  { nombre: 'Sebastián Gajardo',  kamId: '-', pais: '', rol: 'C-level' },
  'sgajardo@dcanje.com':    { nombre: 'Sebastián Gajardo',  kamId: '-', pais: '', rol: 'C-level' },
  'srojas@apprecio.com':    { nombre: 'Sebastián Rojas',    kamId: '-', pais: '', rol: 'C-level' },
  'srojas@dcanje.com':      { nombre: 'Sebastián Rojas',    kamId: '-', pais: '', rol: 'C-level' },
  // Country Managers.
  // Katia Li y Juan Camilo Valencia salieron el 2026-09-03: ya no tienen rol
  // comercial. Tampoco están en 'Codigos Vendedores', así que caen al camino de
  // fallo cerrado, que es lo correcto. No reponerlos sin confirmarlo: este
  // fallback es el camino NORMAL, no la excepción — la hoja está compartida con
  // 5 personas, no con el dominio, así que casi nadie logra leerla.
  'dindaburu@apprecio.com':     { nombre: 'Daniel Indaburu',      kamId: '-', pais: 'Colombia', rol: 'Country Manager' },
  'dindaburu@dcanje.com':       { nombre: 'Daniel Indaburu',      kamId: '-', pais: 'Colombia', rol: 'Country Manager' },
  'alvaroagliati@apprecio.com': { nombre: 'Alvaro Agliati',       kamId: '-', pais: 'Chile',    rol: 'Country Manager' },
  'alvaroagliati@dcanje.com':   { nombre: 'Alvaro Agliati',       kamId: '-', pais: 'Chile',    rol: 'Country Manager' },
};

// Ejecutivos con ambas extensiones
const EXECS: [string, UserRoleData][] = [
  ['cfigueroa',  { nombre: 'Camilo Figueroa',    kamId: 'CF',      pais: 'Chile',    rol: 'Ejecutivo' }],
  ['bcastro',    { nombre: 'Benjamin Castro',    kamId: 'BC',      pais: 'Chile',    rol: 'Ejecutivo' }],
  ['bgonzalez',  { nombre: 'Benjamin González',  kamId: 'BG',      pais: 'Chile',    rol: 'Ejecutivo' }],
  ['ljamasmie',  { nombre: 'Lorenzo Jamasmie',   kamId: 'LJ',      pais: 'Chile',    rol: 'Ejecutivo' }],
  ['jcalzada',   { nombre: 'Johanna Calzada',    kamId: 'JC',      pais: 'Chile',    rol: 'Ejecutivo' }],
  ['rmolina',    { nombre: 'Roberto Molina',     kamId: 'Roberto', pais: 'Colombia', rol: 'Ejecutivo' }],
  ['scuellar',   { nombre: 'Santiago Cuellar',   kamId: 'SC',      pais: 'Colombia', rol: 'Ejecutivo' }],
  ['shernandez', { nombre: 'Sharon Hernandez',   kamId: 'Sharon',  pais: 'Colombia', rol: 'Ejecutivo' }],
  ['aavila',     { nombre: 'Aura M. Ávila',      kamId: 'Aura',    pais: 'Colombia', rol: 'Ejecutivo' }],
  ['fospina',    { nombre: 'Felipe Ospina',      kamId: 'Felipe',  pais: 'Colombia', rol: 'Ejecutivo' }],
  ['aleon',      { nombre: 'Anderson León',      kamId: 'Ander',   pais: 'Colombia', rol: 'Ejecutivo' }],
  ['pmontoya',   { nombre: 'Paula Montoya',      kamId: 'PM',      pais: 'Colombia', rol: 'Ejecutivo' }],
  ['ctrujillo',  { nombre: 'Colombina Trujillo', kamId: 'CT',      pais: 'México',   rol: 'Ejecutivo' }],
  ['golvera',    { nombre: 'Giovanny Olvera',    kamId: 'GO',      pais: 'México',   rol: 'Ejecutivo' }],
  ['msernaque',  { nombre: 'Magda Sernaque',     kamId: 'MS',      pais: 'Perú',     rol: 'Ejecutivo' }],
  // BDM en la hoja; acá va ya normalizado a 'Ejecutivo', que es su nivel de acceso.
  ['lgalindo',   { nombre: 'Laura Galindo',      kamId: 'LG',      pais: 'Colombia', rol: 'Ejecutivo' }],
  ['dallendes',  { nombre: 'Darling Allendes',   kamId: 'DA',      pais: 'Chile',    rol: 'Ejecutivo' }],
  ['jguerra',    { nombre: 'Joao Guerra',        kamId: 'JG',      pais: 'Perú',     rol: 'Ejecutivo' }],
  ['dduran',     { nombre: 'Diana Duran',        kamId: 'DD',      pais: 'Perú',     rol: 'Ejecutivo' }],
];
for (const [prefix, data] of EXECS) {
  STATIC_ROLES[`${prefix}@apprecio.com`] = data;
  STATIC_ROLES[`${prefix}@dcanje.com`]   = data;
}

export function useUserRole() {
  const { token, user } = useAuth();
  const email = user?.email?.toLowerCase() ?? '';

  return useQuery<UserRoleData | null>({
    queryKey: ['user-role', email],
    queryFn: async () => {
      try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${CODIGOS_ID}/values/${encodeURIComponent(RANGE)}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const json = await res.json();
          const rows: string[][] = json.values || [];
          // Se compara por la PARTE LOCAL del correo, no por el correo completo.
          //
          // La hoja registra un solo dominio por persona, pero apprecio.com y
          // dcanje.com son el mismo Workspace y varios entran con el otro. Magda
          // Sernaque figura como msernaque@apprecio.com y entra como
          // msernaque@dcanje.com: con la comparación exacta no matcheaba, caía al
          // fallback STATIC_ROLES —que la tiene como Ejecutivo— y el frontend la
          // creía ejecutiva mientras el backend la resolvía como Admin. El síntoma
          // era que el selector de país del IPC se dibujaba pero no cambiaba nada,
          // porque `filterPais` de un rol restringido gana sobre el selector
          // (verificado 2026-09-09).
          //
          // Es el mismo criterio que ya usa `useRolesPorLocal` más abajo, y el
          // mismo que usa el backend en resolverAlcance.
          const local = email.split('@')[0];
          const row = rows.find(
            (r) => String(r[2] ?? '').toLowerCase().trim().split('@')[0] === local,
          );
          if (row) {
            return {
              nombre: String(row[0] ?? '').trim(),
              kamId:  String(row[1] ?? '').trim(),
              pais:   String(row[3] ?? '').trim(),
              rol:    normalizarRol(String(row[4] ?? '')),
            };
          }
        }
      } catch { /* sheet inaccesible → fallback */ }

      return STATIC_ROLES[email] ?? null;
    },
    enabled: !!token && !!email,
    staleTime: 60 * 60 * 1000,
    gcTime:    60 * 60 * 1000,
    retry: 0,
  });
}
