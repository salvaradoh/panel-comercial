import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { useAuth } from '../auth/AuthContext';

/**
 * Brief de campañas. La ruta es para Admin y C-level (el backend responde 403 al resto).
 *
 * El brief no se genera acá ni en el backend: lo genera el comando /campanas y lo publica
 * en la hoja Cache_Campanas. Esta vista solo muestra la última publicación, así que no
 * hay nada que esperar ni tokens que gastar al abrir el tab.
 *
 * El seguimiento sí se escribe desde acá, pero va directo a Firestore con el token del
 * usuario — el mismo camino que usa la analítica de uso, sin pasar por el backend.
 */

const PROJECT = 'gen-lang-client-0399006381';
const COLECCION = 'campanas_seguimiento';
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${COLECCION}`;

/* ---------------------------------------------------------------------- tipos */

export interface PreguntaCampanas {
  pregunta: string;
  respuesta: string;
}

export interface CuentaBase {
  pais: string;
  panel_id?: string | number | null;
  nombre: string;
  kam?: string;
  monto_6m_usd?: number | null;
  score?: number | null;
  status?: string | null;
  prob_fuga?: number | null;
  dias_sin_compra?: number | null;
}

export interface BaseObjetivo {
  clientes?: number;
  arr_6m_usd?: number;
  paises?: string[];
  kams?: { nombre: string; cuentas: number }[];
}

export interface Campana {
  id: string;
  slug: string;
  nombre: string;
  tipo: string;
  /** Quién la ejecuta: Ejecutivo (KAM), Full Cycle, BDM o Proyecto. */
  rol: string;
  /** Qué se está incentivando, y por lo tanto qué cuenta como avance. */
  metrica: string;
  prioridad: number;
  senal: string;
  producto: string;
  pitch: string;
  base: BaseObjetivo | null;
  base_texto?: string;
  cuentas: CuentaBase[];
  /**
   * La campaña se agregó a pedido y no salió del análisis semanal de /campanas.
   * Se marca en la vista para que se revise aparte: el resto se regenera cada semana y
   * estas se mantienen a mano, así que conviene saber cuáles son antes de aprobarlas.
   */
  a_pedido?: boolean;
  origen: 'estructurado' | 'markdown';
}

export interface BriefCampanas {
  sin_publicar: boolean;
  motivo?: string;
  generado_en?: string;
  huella?: string;
  semana_id?: string;
  markdown?: string;
  preguntas?: PreguntaCampanas[];
  campanas?: Campana[];
  versiones_publicadas?: number;
  puede_editar?: boolean;
}

/**
 * Qué hacer con esta cuenta en particular. La calcula el backend con los datos de hoy
 * (`backend/src/campanas/acciones.js`), no con el snapshot de la campaña.
 * Es `null` cuando no hay dato suficiente: se prefiere no decir nada antes que rellenar.
 */
export interface AccionCuenta {
  /** Por dónde se agarra la cuenta: f_r, f_v, f_e, f_t, recencia, cross_sell… */
  palanca: string;
  texto: string;
}

export interface CuentaAvance {
  pais: string;
  panel_id?: string | number | null;
  nombre: string;
  kam?: string;
  encontrada: boolean;
  /** Si esta cuenta ya cumplió el objetivo de la campaña (según su métrica). */
  logrado: boolean;
  detalle?: string;
  score_antes?: number;
  score_ahora?: number;
  delta_score?: number;
  status_antes?: string | null;
  status_ahora?: string | null;
  monto_antes_usd?: number | null;
  monto_ahora_usd?: number | null;
  dias_sin_compra?: number | null;
  compro_desde_inicio?: boolean;
  movimiento: 'mejoro' | 'igual' | 'empeoro' | 'sin_dato';
  accion?: AccionCuenta | null;
}

export interface AvanceCampana {
  slug: string;
  medible: boolean;
  motivo?: string;
  /** Qué mide esta campaña: score, recompra, facturación o contratación de un producto. */
  metrica?: string;
  etiqueta_metrica?: string;
  etiqueta_logro?: string;
  etiqueta_pendiente?: string;
  /** Recomendación de la campaña entera, para encabezar la lista. */
  accion_general?: string;
  publicado_en?: string;
  semana_id?: string;
  total?: number;
  resumen?: {
    logrados: number;
    pendientes: number;
    sin_dato: number;
    mejoraron: number;
    empeoraron: number;
    compraron: number;
    monto_antes_usd: number;
    monto_ahora_usd: number;
  };
  cuentas: CuentaAvance[];
}

export const ESTADOS = [
  'propuesta',
  'incentivo_solicitado',
  'aprobada',
  'en_curso',
  'cerrada',
] as const;
export type EstadoCampana = (typeof ESTADOS)[number];

export const ETIQUETA_ESTADO: Record<EstadoCampana, string> = {
  propuesta: 'Propuesta',
  incentivo_solicitado: 'Incentivo solicitado',
  aprobada: 'Aprobada',
  en_curso: 'En curso',
  cerrada: 'Cerrada',
};

export interface Hito { texto: string; hecho: boolean }
export interface Nota { texto: string; autor: string; ts: number }

/** Un destinatario del correo de la campaña. La lista es editable antes de enviar. */
export interface Destinatario { email: string; nombre: string; rol: string }

/** Queda registro de cada envío: a quién y cuándo. El correo no se puede des-enviar. */
export interface Envio { ts: number; por: string; para: string[]; asunto: string }

// Definidos en pages/campanas/formato.ts, que no depende de React: así el armado del
// correo se puede verificar desde Node. Se importan y se re-exportan para no cambiar los
// imports de quien ya los tomaba de acá (un `export ... from` no los trae al ámbito local
// y este módulo los necesita para validar el valor guardado).
import { TIPOS_INCENTIVO, ETIQUETA_INCENTIVO, type TipoIncentivo } from '../pages/campanas/formato';
export { TIPOS_INCENTIVO, ETIQUETA_INCENTIVO };
export type { TipoIncentivo };

/**
 * Ediciones del Admin sobre la campaña publicada. El brief lo genera /campanas y es
 * inmutable; esto se superpone encima. Así se puede afinar el texto antes de mandarlo
 * sin tener que regenerar el brief entero.
 */
export interface OverridesCampana {
  nombre?: string;
  senal?: string;
  producto?: string;
  pitch?: string;
  objetivo?: string;
  /**
   * Base objetivo editada a mano. Las **cuentas son la fuente de verdad**: los ejecutivos
   * de la campaña se derivan de ellas, así que quitar a un ejecutivo es quitar sus
   * cuentas, y una vez que no le queda ninguna deja de figurar. Guardar la lista completa
   * (y no un diff) hace que el avance se siga midiendo igual: son las mismas columnas que
   * trae el snapshot del brief.
   */
  cuentas?: CuentaBase[];
}

/** Ejecutivos de una campaña, derivados de sus cuentas y ordenados por peso. */
export function kamsDeCuentas(cuentas: CuentaBase[]): { nombre: string; cuentas: number }[] {
  const m = new Map<string, number>();
  for (const c of cuentas) {
    const k = (c.kam ?? '').trim();
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([nombre, n]) => ({ nombre, cuentas: n }));
}

/** Países presentes en la base, sin repetir. */
export function paisesDeCuentas(cuentas: CuentaBase[]): string[] {
  return [...new Set(cuentas.map((c) => c.pais).filter(Boolean))];
}

export interface Seguimiento {
  estado: EstadoCampana;
  // No hay "responsable": el incentivo es para un grupo y la campaña la define el Admin
  // que la crea. Poner un nombre ahí no significaba nada y confundía sobre a quién le toca.
  fecha_objetivo: string;
  incentivo_area: string;
  incentivo_contacto: string;
  incentivo_tipo: TipoIncentivo;
  incentivo_descripcion: string;
  incentivo_monto: number;
  hitos: Hito[];
  notas: Nota[];
  overrides: OverridesCampana;
  destinatarios: Destinatario[];
  envios: Envio[];
  actualizado_por: string;
  actualizado_en: number;
}

export const SEGUIMIENTO_VACIO: Seguimiento = {
  estado: 'propuesta',
  fecha_objetivo: '',
  incentivo_area: '',
  incentivo_contacto: '',
  incentivo_tipo: '',
  incentivo_descripcion: '',
  incentivo_monto: 0,
  hitos: [],
  notas: [],
  overrides: {},
  destinatarios: [],
  envios: [],
  actualizado_por: '',
  actualizado_en: 0,
};

/** La campaña que se muestra y se envía = la publicada + lo que el Admin editó encima. */
export function aplicarOverrides(campana: Campana, o: OverridesCampana | undefined): Campana {
  if (!o || !Object.keys(o).length) return campana;

  const base = { ...campana, 
    nombre: o.nombre?.trim() || campana.nombre,
    senal: o.senal?.trim() || campana.senal,
    producto: o.producto?.trim() || campana.producto,
    pitch: o.pitch?.trim() || campana.pitch,
  };
  if (!o.cuentas) return base;

  // Con la base editada, el recuento, los países y los ejecutivos se recalculan desde las
  // cuentas: no puede quedar un ejecutivo listado sin cuentas, ni un total que no cierre.
  const cuentas = o.cuentas;
  return {
    ...base,
    cuentas,
    base: {
      ...(base.base ?? {}),
      clientes: cuentas.length,
      arr_6m_usd: cuentas.reduce((a, c) => a + (c.monto_6m_usd ?? 0), 0),
      paises: paisesDeCuentas(cuentas),
      kams: kamsDeCuentas(cuentas),
    },
  };
}

/* ----------------------------------------------------------------------- brief */

export function useBriefCampanas() {
  return useQuery<BriefCampanas>({
    queryKey: ['campanas-brief'],
    queryFn: () => apiFetch<BriefCampanas>('/api/campanas/brief'),
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 0,
  });
}

/**
 * Avance de una campaña: cómo se movieron las cuentas de su base objetivo desde que se
 * publicó. `enabled` evita pedirlo hasta que la campaña esté abierta en el panel.
 */
export interface MiCuenta {
  pais: string;
  panel_id?: string | number | null;
  nombre: string;
  monto_6m_usd?: number | null;
  status?: string | null;
  accion?: AccionCuenta | null;
}

export interface MisCuentas {
  slug: string;
  metrica: string | null;
  etiqueta_metrica?: string;
  accion_general?: string;
  /** Cuántas cuentas tiene la campaña en total, para poder decir "4 de 25 son tuyas". */
  total_campana: number;
  cuentas: MiCuenta[];
}

/**
 * Las cuentas de una campaña que le tocan a quien está en sesión, con qué hacer con cada
 * una. El filtro por ejecutivo lo hace el backend contra `Codigos Vendedores`; acá no se
 * puede elegir de quién se piden.
 *
 * `activo` existe para no disparar una consulta a BigQuery por cada tarjeta al abrir el
 * tab: se pide recién cuando el ejecutivo despliega esa campaña.
 */
export function useMisCuentas(slug: string | null, activo: boolean) {
  return useQuery({
    queryKey: ['campanas-mis-cuentas', slug],
    queryFn: () => apiFetch<MisCuentas>(
      `/api/campanas-publicas/mis-cuentas?slug=${encodeURIComponent(slug!)}`,
    ),
    enabled: Boolean(slug) && activo,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAvanceCampana(slug: string | null) {
  return useQuery<AvanceCampana>({
    queryKey: ['campanas-avance', slug],
    queryFn: () => apiFetch<AvanceCampana>(`/api/campanas/avance?slug=${encodeURIComponent(slug!)}`),
    enabled: Boolean(slug),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 0,
  });
}

/* ----------------------------------------------------------------- seguimiento

   Firestore REST con el token del usuario. Los escalares van tipados; hitos y notas
   viajan como JSON en un string: son listas de objetos y codificarlas campo por campo en
   el formato de Firestore no aporta nada, porque nadie las consulta desde el servidor. */

interface FsDoc { fields?: Record<string, Record<string, unknown>> }

function decodificar(doc: FsDoc | null): Seguimiento {
  const f = doc?.fields;
  if (!f) return { ...SEGUIMIENTO_VACIO };

  const str = (k: string) => String(f[k]?.stringValue ?? '');
  const num = (k: string) => Number(f[k]?.integerValue ?? f[k]?.doubleValue ?? 0);
  const json = <T,>(k: string, fallback: T): T => {
    try { return f[k]?.stringValue ? (JSON.parse(String(f[k].stringValue)) as T) : fallback; }
    catch { return fallback; }
  };

  const estado = str('estado') as EstadoCampana;
  const tipo = str('incentivo_tipo') as TipoIncentivo;
  return {
    estado: ESTADOS.includes(estado) ? estado : 'propuesta',
    fecha_objetivo: str('fecha_objetivo'),
    incentivo_area: str('incentivo_area'),
    incentivo_contacto: str('incentivo_contacto'),
    incentivo_tipo: (TIPOS_INCENTIVO as readonly string[]).includes(tipo) ? tipo : '',
    incentivo_descripcion: str('incentivo_descripcion'),
    incentivo_monto: num('incentivo_monto'),
    hitos: json<Hito[]>('hitos_json', []),
    notas: json<Nota[]>('notas_json', []),
    overrides: json<OverridesCampana>('overrides_json', {}),
    destinatarios: json<Destinatario[]>('destinatarios_json', []),
    envios: json<Envio[]>('envios_json', []),
    actualizado_por: str('actualizado_por'),
    actualizado_en: num('actualizado_en'),
  };
}

function codificar(s: Seguimiento) {
  return {
    fields: {
      estado: { stringValue: s.estado },
      fecha_objetivo: { stringValue: s.fecha_objetivo },
      incentivo_area: { stringValue: s.incentivo_area },
      incentivo_contacto: { stringValue: s.incentivo_contacto },
      incentivo_tipo: { stringValue: s.incentivo_tipo },
      incentivo_descripcion: { stringValue: s.incentivo_descripcion },
      incentivo_monto: { integerValue: String(Math.round(s.incentivo_monto || 0)) },
      hitos_json: { stringValue: JSON.stringify(s.hitos ?? []) },
      notas_json: { stringValue: JSON.stringify(s.notas ?? []) },
      overrides_json: { stringValue: JSON.stringify(s.overrides ?? {}) },
      destinatarios_json: { stringValue: JSON.stringify(s.destinatarios ?? []) },
      envios_json: { stringValue: JSON.stringify(s.envios ?? []) },
      actualizado_por: { stringValue: s.actualizado_por },
      actualizado_en: { integerValue: String(s.actualizado_en || Date.now()) },
    },
  };
}

export function useSeguimiento(slug: string | null) {
  const { token } = useAuth();

  return useQuery<Seguimiento>({
    queryKey: ['campanas-seguimiento', slug],
    enabled: Boolean(slug && token),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 0,
    queryFn: async () => {
      const res = await fetch(`${FS_BASE}/${encodeURIComponent(slug!)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // 404 = todavía nadie tocó esta campaña. Es el estado inicial, no un error.
      if (res.status === 404) return { ...SEGUIMIENTO_VACIO };
      if (!res.ok) throw new Error(`Firestore ${res.status}: ${await res.text()}`);
      return decodificar(await res.json());
    },
  });
}

export function useGuardarSeguimiento(slug: string | null) {
  const { token, user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (seguimiento: Seguimiento) => {
      if (!slug || !token) throw new Error('Sin sesión válida para guardar.');
      const cuerpo: Seguimiento = {
        ...seguimiento,
        actualizado_por: user?.email ?? '',
        actualizado_en: Date.now(),
      };
      const res = await fetch(`${FS_BASE}/${encodeURIComponent(slug)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(codificar(cuerpo)),
      });
      if (!res.ok) throw new Error(`No se pudo guardar (${res.status}): ${await res.text()}`);
      return cuerpo;
    },
    onSuccess: (cuerpo) => {
      qc.setQueryData(['campanas-seguimiento', slug], cuerpo);
    },
  });
}

/* --------------------------------------------------------- vista del equipo

   Catálogo de campañas para todo el equipo, sin el análisis de cartera ni los nombres de
   clientes (eso lo recorta el backend). El estado de cada una vive en Firestore, así que
   la vista cruza las dos cosas. */

export interface CampanaPublica {
  id: string;
  slug: string;
  nombre: string;
  tipo: string;
  rol: string;
  prioridad: number;
  senal: string;
  producto: string;
  pitch: string;
  metrica: string;
  base: { clientes: number | null; paises: string[]; kams: { nombre: string; cuentas: number }[] } | null;
  semana_id: string | null;
}

/** Los estados que hacen que una campaña exista para el resto del equipo. */
export const ESTADOS_ACTIVOS: EstadoCampana[] = ['aprobada', 'en_curso'];
export const ESTADOS_PASADOS: EstadoCampana[] = ['cerrada'];

export function useCampanasPublicas() {
  return useQuery<{ campanas: CampanaPublica[] }>({
    queryKey: ['campanas-publicas'],
    queryFn: () => apiFetch<{ campanas: CampanaPublica[] }>('/api/campanas-publicas/'),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 0,
  });
}

/**
 * Todos los seguimientos de una sola lectura. La vista del equipo necesita el estado de
 * cada campaña para decidir cuáles muestra, y pedirlos de a uno serían N llamadas al
 * abrir el tab.
 */
export function useSeguimientos() {
  const { token } = useAuth();

  return useQuery<Record<string, Seguimiento>>({
    queryKey: ['campanas-seguimientos'],
    enabled: !!token,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 0,
    queryFn: async () => {
      const res = await fetch(`${FS_BASE}?pageSize=300`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Colección vacía: Firestore devuelve 200 sin `documents`. No es un error.
      if (res.status === 404) return {};
      if (!res.ok) throw new Error(`Firestore ${res.status}: ${await res.text()}`);
      const json = await res.json();

      const out: Record<string, Seguimiento> = {};
      for (const doc of (json.documents ?? []) as { name: string; fields?: FsDoc['fields'] }[]) {
        const slug = decodeURIComponent(String(doc.name).split('/').pop() ?? '');
        if (slug) out[slug] = decodificar(doc);
      }
      return out;
    },
  });
}

/**
 * Busca cuentas en la cartera para sumarlas a la base objetivo de una campaña. Devuelve
 * las mismas columnas que el snapshot, así una cuenta agregada a mano se mide igual que
 * una que vino del brief.
 *
 * `enabled` solo cuando hay filtro: el backend rechaza la consulta sin ninguno, porque
 * traer la cartera entera no le sirve a nadie.
 */
export function useBuscarCuentas(filtro: { kam?: string; pais?: string; q?: string } | null) {
  const params = new URLSearchParams();
  if (filtro?.kam) params.set('kam', filtro.kam);
  if (filtro?.pais) params.set('pais', filtro.pais);
  if (filtro?.q) params.set('q', filtro.q);
  const qs = params.toString();

  return useQuery<{ cuentas: CuentaBase[]; truncado: boolean }>({
    queryKey: ['campanas-cuentas', qs],
    queryFn: () => apiFetch<{ cuentas: CuentaBase[]; truncado: boolean }>(`/api/campanas/cuentas?${qs}`),
    enabled: Boolean(qs),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 0,
  });
}
