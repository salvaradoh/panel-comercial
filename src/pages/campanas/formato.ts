import type { EstadoCampana } from '../../hooks/useCampanas';

/**
 * Tipos de incentivo y sus etiquetas. Viven acá y no en el hook porque `correo.ts` los
 * necesita y tiene que poder ejecutarse fuera de React —igual que `lib/cbs.ts`— para
 * poder verificar el correo desde Node sin montar la app.
 */
/**
 * `ninguno` no es lo mismo que `''`. Vacío significa "todavía no se definió"; `ninguno`
 * es una decisión tomada: esta campaña se comunica sin premio. Hay campañas que se
 * sostienen solas —recuperar una cuenta grande, abrir un país— y obligarlas a inventar
 * un incentivo para poder enviarse era pedir presupuesto que nadie pidió.
 */
export const TIPOS_INCENTIVO = ['puntos', 'viaje', 'bono', 'otro', 'ninguno'] as const;
export type TipoIncentivo = (typeof TIPOS_INCENTIVO)[number] | '';

export const ETIQUETA_INCENTIVO: Record<string, string> = {
  '': 'Sin definir',
  puntos: 'Puntos Apprecio',
  viaje: 'Viaje',
  bono: 'Bono en efectivo',
  otro: 'Otro',
  ninguno: 'Sin incentivo',
};

/**
 * La unidad del monto depende del tipo de incentivo: 5.000 puntos Apprecio no son 5.000
 * dólares. Un viaje se dimensiona en USD, un bono también, y "otro" queda en USD porque es
 * la unidad con la que se le pide presupuesto al área.
 */
export const UNIDAD_INCENTIVO: Record<string, { corta: string; larga: string; paso: number }> = {
  '':       { corta: 'USD',    larga: 'dólares',        paso: 100 },
  puntos:   { corta: 'puntos', larga: 'puntos Apprecio', paso: 1000 },
  viaje:    { corta: 'USD',    larga: 'dólares',        paso: 100 },
  bono:     { corta: 'USD',    larga: 'dólares',        paso: 100 },
  otro:     { corta: 'USD',    larga: 'dólares',        paso: 100 },
  ninguno:  { corta: 'USD',    larga: 'dólares',        paso: 100 },
};

/** El monto ya formateado con su unidad: "5.000 puntos" o "USD 3.000". */
export function montoIncentivo(tipo: string, monto: number | null | undefined): string {
  // Sin incentivo no hay monto que mostrar, aunque haya quedado un número viejo cargado.
  if (tipo === 'ninguno' || !monto) return '';
  const u = UNIDAD_INCENTIVO[tipo] ?? UNIDAD_INCENTIVO[''];
  const n = Math.round(monto).toLocaleString('es-CL');
  return u.corta === 'USD' ? `USD ${n}` : `${n} ${u.corta}`;
}

export const ACENTO = '#7C3AED';

/**
 * El tipo de campaña llega como texto libre del brief ("retención / rescate",
 * "upsell / renovación"), así que se clasifica por lo que contiene y no por igualdad.
 */
export interface EstiloTipo { clave: string; etiqueta: string; color: string; fondo: string }

const TIPOS: EstiloTipo[] = [
  { clave: 'retencion',  etiqueta: 'Retención',  color: '#BE123C', fondo: '#FFF1F2' },
  { clave: 'cross-sell', etiqueta: 'Cross-sell', color: '#6D28D9', fondo: '#F5F3FF' },
  { clave: 'upsell',     etiqueta: 'Upsell',     color: '#4338CA', fondo: '#EEF2FF' },
  { clave: 'activacion', etiqueta: 'Activación', color: '#047857', fondo: '#ECFDF5' },
  { clave: 'crossborder', etiqueta: 'Crossborder', color: '#B45309', fondo: '#FFFBEB' },
];
const TIPO_DEFECTO: EstiloTipo = { clave: 'otro', etiqueta: 'Campaña', color: '#0E7490', fondo: '#ECFEFF' };

export function estiloTipo(tipo: string): EstiloTipo {
  const t = (tipo || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  if (t.includes('retenc') || t.includes('rescate')) return TIPOS[0];
  // Crossborder va ANTES que cross-sell: "crossborder" contiene "cross" y si no, quedaría
  // etiquetado como venta cruzada de producto, que es otra cosa. Acá el mismo grupo
  // económico compra en un país y no en otro; el producto puede ser el mismo.
  if (t.includes('crossborder') || t.includes('cross border') || t.includes('cross-border')) return TIPOS[4];
  if (t.includes('cross')) return TIPOS[1];
  if (t.includes('upsell') || t.includes('renovac')) return TIPOS[2];
  if (t.includes('activac')) return TIPOS[3];
  return TIPO_DEFECTO;
}

export const ESTILO_ESTADO: Record<EstadoCampana, { color: string; fondo: string; borde: string }> = {
  propuesta:            { color: '#475569', fondo: '#F8FAFC', borde: '#E2E8F0' },
  incentivo_solicitado: { color: '#B45309', fondo: '#FFFBEB', borde: '#FDE68A' },
  aprobada:             { color: '#4338CA', fondo: '#EEF2FF', borde: '#C7D2FE' },
  en_curso:             { color: '#0E7490', fondo: '#ECFEFF', borde: '#A5F3FC' },
  cerrada:              { color: '#047857', fondo: '#ECFDF5', borde: '#A7F3D0' },
};

/** USD sin decimales. Toda cifra que se alinee en columna va con tabular-nums. */
export function usd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return 'USD ' + Math.round(n).toLocaleString('es-CL');
}

/** Compacta para las tarjetas: USD 7,8 M / USD 185 K. */
export function usdCorto(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  const v = Math.abs(n);
  if (v >= 1_000_000) return `USD ${(n / 1_000_000).toFixed(1).replace('.', ',')} M`;
  if (v >= 1_000) return `USD ${Math.round(n / 1_000)} K`;
  return `USD ${Math.round(n)}`;
}

export function numero(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString('es-CL');
}

/**
 * Cada viñeta del bloque "qué cambió" viene como `**titular.** cuerpo`. Partirla deja
 * armar una tarjeta con jerarquía en vez de una lista corrida.
 */
export function partirVinieta(texto: string): { titular: string; cuerpo: string } {
  const m = texto.match(/^\*\*(.+?)\*\*\s*(.*)$/s);
  if (!m) return { titular: '', cuerpo: texto };
  return { titular: m[1].replace(/[:.]$/, ''), cuerpo: m[2].trim() };
}

/** Extrae las viñetas de la sección "Qué cambió en la cartera" del brief. */
export function vinietasDeCambios(markdown: string): string[] {
  const texto = String(markdown || '');
  const inicio = texto.search(/^#{1,3}\s+Qué cambió en la cartera\s*$/im);
  if (inicio === -1) return [];
  const resto = texto.slice(inicio).split('\n').slice(1);

  const out: string[] = [];
  for (const linea of resto) {
    const l = linea.trim();
    if (/^#{1,3}\s+/.test(l)) break;          // llegó la sección siguiente
    const item = l.match(/^[-*]\s+(.*)$/);
    if (item) out.push(item[1]);
  }
  return out;
}

export const ESTADO_MOVIMIENTO: Record<string, { etiqueta: string; color: string; fondo: string }> = {
  mejoro:   { etiqueta: 'Mejoró',    color: '#047857', fondo: '#ECFDF5' },
  igual:    { etiqueta: 'Sin mover', color: '#475569', fondo: '#F8FAFC' },
  empeoro:  { etiqueta: 'Empeoró',   color: '#BE123C', fondo: '#FFF1F2' },
  sin_dato: { etiqueta: 'Sin dato',  color: '#94A3B8', fondo: '#F8FAFC' },
};

/**
 * Qué cuenta como avance en cada campaña, para poder nombrarlo en el correo.
 *
 * Es un espejo de METRICAS en `backend/src/routes/campanas.js`, que sigue siendo la fuente
 * de verdad: la vista lo recibe resuelto en `avance.etiqueta_metrica`, pero el correo se
 * arma sin llamar a la API y necesita la etiqueta acá. Si allá se agrega una métrica, hay
 * que agregarla también en este mapa.
 */
export const ETIQUETA_METRICA: Record<string, string> = {
  score: 'Mejorar la salud de la cuenta',
  recompra: 'Que la cuenta vuelva a comprar',
  facturacion: 'Hacer crecer la facturación',
  producto_saas: 'Que la cuenta contrate SaaS',
  producto_puntos: 'Que la cuenta active Puntos',
  producto_gift_card: 'Que la cuenta active Gift Card',
  manual: 'Seguimiento manual',
};

/** Misma regla de respaldo que usa el backend cuando el brief no declara la métrica. */
export function metricaDeCampana(metrica: string, tipo: string): string {
  if (ETIQUETA_METRICA[metrica]) return ETIQUETA_METRICA[metrica];
  const t = String(tipo || '').toLowerCase();
  if (t.includes('activac')) return ETIQUETA_METRICA.recompra;
  if (t.includes('upsell') || t.includes('renovac')) return ETIQUETA_METRICA.facturacion;
  if (t.includes('cross')) return ETIQUETA_METRICA.producto_saas;
  return ETIQUETA_METRICA.score;
}
