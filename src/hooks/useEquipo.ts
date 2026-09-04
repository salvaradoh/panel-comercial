import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';

/**
 * El personal comercial activo, con su correo. Sale de la misma hoja y el mismo rango que
 * `useUserRole` — `Codigos Vendedores!H2:L100`, donde las columnas son
 * nombre · código · correo · país · rol — así que no hay una segunda fuente que se
 * desincronice. Se lee con el token del usuario, sin backend en el medio.
 */

const CODIGOS_ID = '1w3lOhP4m-uPX49E-cyaZJgFXFxaT3Hhf4izCfsyFmho';
const RANGE = 'Codigos Vendedores!H2:L100';

export interface PersonaComercial {
  nombre: string;
  email: string;
  pais: string;
  rol: string;
}

/** Nombres que la cartera usa como bolsa y que no son personas: nunca son destinatarios. */
const NO_SON_PERSONAS = new Set(['otros', 'pais', 'país', '-', '#n/a', 'dcanje']);

/** "Benjamin González" y "Benjamin Gonzalez" tienen que ser la misma persona. */
export function claveNombre(nombre: string): string {
  return String(nombre || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

export function esPersona(nombre: string): boolean {
  const k = claveNombre(nombre);
  return Boolean(k) && !NO_SON_PERSONAS.has(k);
}

export function useEquipoComercial() {
  const { token } = useAuth();

  return useQuery<PersonaComercial[]>({
    queryKey: ['equipo-comercial'],
    enabled: !!token,
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${CODIGOS_ID}/values/${encodeURIComponent(RANGE)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`No se pudo leer el equipo comercial (${res.status})`);
      const json = await res.json();

      const out: PersonaComercial[] = [];
      for (const r of (json.values ?? []) as string[][]) {
        const nombre = String(r[0] ?? '').trim();
        const email = String(r[2] ?? '').toLowerCase().trim();
        if (!nombre || !email.includes('@')) continue;
        out.push({ nombre, email, pais: String(r[3] ?? '').trim(), rol: String(r[4] ?? '').trim() });
      }
      return out;
    },
  });
}

/** Índice por nombre normalizado, para cruzar contra los ejecutivos de una campaña. */
export function indexarPorNombre(equipo: PersonaComercial[] | undefined) {
  const m = new Map<string, PersonaComercial>();
  (equipo ?? []).forEach((p) => m.set(claveNombre(p.nombre), p));
  return m;
}
