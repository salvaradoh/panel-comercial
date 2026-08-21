import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';

const SPREADSHEET_ID = import.meta.env.VITE_DASHBOARD_SPREADSHEET_ID as string;
const GAS_ENDPOINT   = import.meta.env.VITE_NOVEDADES_ENDPOINT as string;

/** Plataforma de reconocimiento entre colaboradores — se enlaza desde cada campanazo. */
export const BEAT_URL = 'https://beat.apprecio.cl/';

export type NovedadTipo = 'campanazo' | 'cliente' | 'equipo' | 'pais' | 'cierre' | 'manual';
export type NovedadClase = string;   // nuevo | recuperado | record | meta | cartera | racha | …

export interface Novedad {
  id: string;
  fecha: string;          // ISO
  tipo: NovedadTipo;
  titulo: string;         // resumen corto (ticker, y texto principal de cierre/manual)
  cuerpo: string;
  autor: string;
  pais: string;
  monto: number;
  moneda: string;
  // Solo en campanazos — la narrativa se compone en la UI desde estos campos
  empresa: string;
  producto: string;
  area: string;
  clase: NovedadClase;
  /** 'alta' entra al ticker lateral; 'normal' solo aparece en la página. */
  importancia: 'alta' | 'normal';
  /** Reacciones del mensaje de Chat, ya agregadas por emoji. */
  reacciones: { emoji: string; n: number }[];
}

// Cache_Novedades A:O
const C = {
  id: 0, fecha: 1, tipo: 2, titulo: 3, cuerpo: 4,
  autor: 5, pais: 6, monto: 7, moneda: 8, activo: 9,
  empresa: 10, producto: 11, area: 12, clase: 13, importancia: 14, reacciones: 15,
} as const;

/** FORMATTED_VALUE puede traer separadores de miles ("925,000") → Number() daría NaN. */
function parseMonto(v: string): number {
  const limpio = String(v ?? '').replace(/[^\d.-]/g, '');
  return Number(limpio) || 0;
}

/** El GAS guarda las reacciones compactadas como "👏🏼:3|♥️:1". */
function parseReacciones(v: string): { emoji: string; n: number }[] {
  return String(v ?? '')
    .split('|')
    .map((par) => {
      const i = par.lastIndexOf(':');
      if (i <= 0) return null;
      const n = Number(par.slice(i + 1));
      return n > 0 ? { emoji: par.slice(0, i), n } : null;
    })
    .filter((x): x is { emoji: string; n: number } => x !== null);
}

const SIMBOLO: Record<string, string> = {
  COP: '$', CLP: '$', MXN: '$', PEN: 'S/', USD: 'US$',
};
// COP y CLP se escriben con punto de miles; el resto con coma.
const LOCALE: Record<string, string> = {
  COP: 'es-CO', CLP: 'es-CL', MXN: 'es-MX', PEN: 'es-PE', USD: 'en-US',
};

/** Monto en su moneda local: "COP $925.000" · "S/ 584" · "US$ 300" */
export function formatMontoLocal(monto: number, moneda: string): string {
  if (!monto) return '';
  const cod = (moneda || '').toUpperCase();
  const sim = SIMBOLO[cod] ?? '$';
  const num = monto.toLocaleString(LOCALE[cod] ?? 'es-CO', { maximumFractionDigits: 0 });
  // El código va delante solo cuando el símbolo por sí solo es ambiguo ($ en 3 países)
  const prefijo = sim === '$' && cod ? `${cod} ` : '';
  return `${prefijo}${sim}${sim === '$' ? '' : ' '}${num}`;
}

export function useNovedades() {
  const { token } = useAuth();

  return useQuery<Novedad[]>({
    queryKey: ['cache-novedades'],
    queryFn: async () => {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Cache_Novedades!A2:P3000?valueRenderOption=FORMATTED_VALUE`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      // El tab puede no existir todavía (antes de la primera corrida del GAS)
      if (res.status === 400) return [];
      if (!res.ok) throw new Error(`Cache_Novedades ${res.status}`);
      const json = await res.json();
      const rows = (json.values || []) as string[][];

      return rows
        .filter((r) => r[C.id] && String(r[C.activo]).toUpperCase() !== 'FALSE')
        .map((r) => ({
          id:       String(r[C.id]),
          fecha:    String(r[C.fecha] ?? ''),
          tipo:     (String(r[C.tipo] || 'manual') as NovedadTipo),
          titulo:   String(r[C.titulo] ?? ''),
          cuerpo:   String(r[C.cuerpo] ?? ''),
          autor:    String(r[C.autor] ?? ''),
          pais:     String(r[C.pais] ?? ''),
          monto:    parseMonto(r[C.monto]),
          moneda:   String(r[C.moneda] ?? ''),
          empresa:  String(r[C.empresa] ?? ''),
          producto: String(r[C.producto] ?? ''),
          area:     String(r[C.area] ?? ''),
          clase:    String(r[C.clase] ?? ''),
          importancia: (String(r[C.importancia] ?? 'normal') === 'alta' ? 'alta' : 'normal') as 'alta' | 'normal',
          reacciones: parseReacciones(r[C.reacciones]),
        }))
        .sort((a, b) => b.fecha.localeCompare(a.fecha));
    },
    enabled: !!token && !!SPREADSHEET_ID,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}

interface CrearNovedadInput {
  titulo: string;
  cuerpo: string;
  pais?: string;
}

/**
 * Publica una novedad manual vía el webapp GAS.
 *
 * Va con Content-Type text/plain a propósito: los webapps de GAS no responden
 * OPTIONS, así que un application/json dispararía un preflight que falla.
 * text/plain lo convierte en "simple request" y el navegador no preflightea.
 */
export function useCrearNovedad() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CrearNovedadInput) => {
      if (!GAS_ENDPOINT) throw new Error('Falta VITE_NOVEDADES_ENDPOINT');
      const res = await fetch(GAS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ token, accion: 'crear', ...input }),
      });
      if (!res.ok) throw new Error(`Error ${res.status} al publicar`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'No se pudo publicar');
      return json as { ok: true; id: string; titulo: string };
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cache-novedades'] }); },
  });
}

/** Borrado suave: marca activo = FALSE. */
export function useDesactivarNovedad() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!GAS_ENDPOINT) throw new Error('Falta VITE_NOVEDADES_ENDPOINT');
      const res = await fetch(GAS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ token, accion: 'desactivar', id }),
      });
      if (!res.ok) throw new Error(`Error ${res.status} al eliminar`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'No se pudo eliminar');
      return json as { ok: true; id: string };
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cache-novedades'] }); },
  });
}

/** "hace 3h" / "ayer" / "12 mar" */
export function fechaRelativa(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1)    return 'ahora';
  if (min < 60)   return `hace ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24)     return `hace ${h}h`;
  const dias = Math.floor(h / 24);
  if (dias === 1) return 'ayer';
  if (dias < 7)   return `hace ${dias}d`;
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}
