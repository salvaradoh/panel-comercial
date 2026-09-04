import { useMemo, useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid, Area, AreaChart,
} from 'recharts';
import { useTablaClientes } from '../../hooks/useTablaClientes';
import type { ClienteTabla } from '../../hooks/useTablaClientes';
import { useHistorial, histKey } from '../../hooks/useHistorial';
import { useClienteSerie } from '../../hooks/useClienteSerie';
import type { HistorialMap } from '../../hooks/useHistorial';
// Misma paleta de segmento que Salud del Cliente y Segmentación, para que un
// A+ se vea igual en todo el panel.
import { SEG_COLOR, SEG_BG } from '../../components/salud';
import { mismoPais } from '../../lib/paises';
import { useTrack } from '../../hooks/useTrack';
import { ChipIndustria } from '../../components/ClienteIndustriaChip';

const MAX_SEL = 3;

/**
 * Ancho máximo de cada columna de cliente en "Detalle comparado".
 *
 * Sin tope, un valor largo —la industria suele traer descripciones de una línea
 * entera, y algunas razones sociales pasan los 40 caracteres— estiraba la columna
 * y empujaba las demás fuera de la tabla. Lo que exceda se recorta con elipsis y
 * el texto completo queda en el `title`, o sea en el tooltip nativo.
 */
const ANCHO_COL_MAX = 260;

/**
 * `title` solo cuando el texto puede no entrar. A 260px y text-xs caben unos 40
 * caracteres, así que el umbral va conservador: mejor un tooltip de más en un
 * valor que sí entraba, que ninguno en uno recortado. Sin esto, "Perú" y "529"
 * también mostraban tooltip, que es puro ruido.
 */
function tooltipSiLargo(v: string): string | undefined {
  return v.length > 24 ? v : undefined;
}

// Color por posición del slot, no por ranking: quitar el cliente del medio no
// debe repintar a los otros dos.
const SLOT_COLOR = ['#0891b2', '#c2410c', '#6d28d9'] as const;
const SLOT_SOFT  = ['#ecfeff', '#fff7ed', '#f5f3ff'] as const;

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  saludable:  { label: 'Saludable',  color: '#047857', bg: '#ecfdf5' },
  monitorear: { label: 'Monitorear', color: '#b45309', bg: '#fffbeb' },
  en_riesgo:  { label: 'En riesgo',  color: '#b91c1c', bg: '#fef2f2' },
  critico:    { label: 'Crítico',    color: '#991b1b', bg: '#fef2f2' },
};

function fmtUSD(v: number) {
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(2) + 'M';
  if (v >= 1_000)     return '$' + Math.round(v / 1_000) + 'K';
  return '$' + Math.round(v);
}

function fmtPct(v: number) {
  return `${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}%`;
}

const monto12m = (c: ClienteTabla) => c.monto6mAct + c.monto6mAnt;

function delta6m(c: ClienteTabla) {
  if (c.monto6mAnt <= 0) return null;
  return (c.monto6mAct - c.monto6mAnt) / c.monto6mAnt;
}

/** Estilo de un status crudo ('monitorear', 'critico'…). */
function estiloStatus(status: string) {
  return STATUS_STYLE[status] ?? { label: status || 'Sin dato', color: '#475569', bg: '#f1f5f9' };
}

function statusDe(c: ClienteTabla) {
  return estiloStatus(c.status);
}

/**
 * Score de SALUD del cliente: siempre la columna 8 ("Score RENT/VENT"), para
 * todos los tipos.
 *
 * Antes hacía `tipo === 'estacional' ? scoreEst : scoreEng`, y la columna 9 no es
 * la salud de los estacionales: es "Score Segmentación" (`score_est` — volumen,
 * producto, meses, margen). Los recurrentes además la tienen en cero (0 de 787),
 * así que el condicional tampoco era simétrico.
 *
 * Se corrigió porque el chip pasó a mostrar la categoría de riesgo junto al
 * número, y esa categoría sale de `status` (calculado sobre la salud real): con el
 * valor viejo, 827 de 1.059 estacionales mostraban un par contradictorio como
 * "3.50 · Crítico". Con la columna 8 el par cierra en toda la cartera.
 *
 * Mueve cifras respecto de lo que se veía antes: 611 estacionales cambian en 0.5
 * o más. Ahora coincide con lo que muestra Análisis de Clientes.
 */
function scoreDe(c: ClienteTabla) {
  return c.scoreEng;
}

/**
 * Score de salud, solo el número.
 *
 * No lleva letra ni categoría al lado. Antes mostraba la letra del SEGMENTO con
 * la paleta de segmento ("3.00 · B"), que mezclaba dos métricas bajo la etiqueta
 * de una sola —y esa letra ya aparece arriba en la píldora "Segmento B"—.
 *
 * Tampoco lleva la categoría de riesgo: `status` se calcula sobre `score_ret`
 * mientras que el número sale de `COALESCE(gs.score, score_ret)`, que para los
 * estacionales es el VENT del caché. Son dos métricas distintas, así que el par
 * quedaba contradictorio en 715 de 1.059 estacionales ("2.00 · Crítico", cuando
 * por los cortes 2.00 es "En riesgo"). El riesgo se lee en la píldora de arriba,
 * que es su lugar.
 */
function ScoreChip({ score }: { score: number }) {
  if (!(score > 0)) return <span className="text-slate-300 text-xs">Sin dato</span>;
  return (
    <span className="inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-bold tabular-nums
                     bg-slate-100 text-slate-700 border border-slate-200">
      {score.toFixed(2)}
    </span>
  );
}

/**
 * `Panel ID` no es único entre países — Perú y Colombia usan enteros
 * correlativos y chocan en 138 casos (el 19 es "TAI LOY S.A." en Perú y
 * "CONTENUR COLOMBIA SAS" en Colombia). La identidad de un cliente es
 * (pais, panelId).
 */
function keyDe(c: ClienteTabla) {
  return histKey(c.pais, c.panelId || c.idTributario);
}

/** Deja solo letras y dígitos: el ID se teclea con o sin guiones y puntos. */
function soloAlnum(s: string) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * El ID panel no tiene una forma única entre países: Chile y México usan el
 * RUT/NIT con guion (`96719620-7`) y Perú y Colombia enteros correlativos
 * (`3`, `19`). Por eso se compara normalizado y por prefijo, así "96719620"
 * encuentra a "96719620-7".
 *
 * Excepción para los correlativos cortos: un término de 1–3 dígitos exige
 * coincidencia EXACTA. Con prefijo, teclear "3" traería todos los IDs que
 * empiezan con 3 y el cliente buscado quedaría sepultado.
 */
function coincideId(c: ClienteTabla, termAlnum: string): boolean {
  if (!termAlnum) return false;
  const esCorto = termAlnum.length <= 3 && /^\d+$/.test(termAlnum);
  for (const id of [c.panelId, c.idTributario]) {
    const n = soloAlnum(id);
    if (!n) continue;
    if (esCorto ? n === termAlnum : n.startsWith(termAlnum)) return true;
  }
  return false;
}

/**
 * Coincide por razón social o por ID (panel / tributario).
 *
 * `nombre` se coacciona aunque el tipo diga `string`: hay una fila en
 * Tabla_Dashboard_Clientes con el nombre en NULL, y hoy no llega así solo porque
 * el hook la rellena con el ID.
 */
function coincide(c: ClienteTabla, term: string, termAlnum: string): boolean {
  return String(c.nombre || '').toLowerCase().includes(term) || coincideId(c, termAlnum);
}

/**
 * Mínimo de caracteres para buscar. Con dos hace falta para los nombres, pero un
 * ID de un dígito es una búsqueda legítima y exacta.
 */
function terminoUtil(term: string, termAlnum: string): boolean {
  return term.length >= 2 || (termAlnum.length >= 1 && /^\d+$/.test(termAlnum));
}

/**
 * Las series de los gráficos se indexan por slot ("s0"/"s1"/"s2"), no por
 * nombre: hay 15 nombres repetidos en la cartera (dos "PREMIUM DATA S.A.C."
 * distintas en Perú, tres "VIVO TECH" en tres países) y usar el nombre como
 * dataKey colapsaba las dos series en una sola.
 */
const slotKey = (i: number) => `s${i}`;

/**
 * "Otros" es la etiqueta acordada para los clientes sin ejecutivo asignado. Se
 * muestra tal cual —no como "Sin asignar"— para usar el mismo término que el
 * resto del panel y los reportes.
 */
function kamLabel(c: ClienteTabla) {
  return (c.kam || '').trim() || 'Otros';
}

/** Colores del segmento; gris si el valor no es uno de los cuatro conocidos. */
function segStyle(seg: string) {
  const color = SEG_COLOR[seg] ?? '#64748b';
  return { color, background: SEG_BG[seg] ?? '#f1f5f9', border: `1px solid ${color}44` };
}

/** Píldora de segmento suelta, para la fila de chips de la tarjeta. */
function SegChip({ segmento }: { segmento: string }) {
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={segStyle(segmento)}>
      Segmento {segmento}
    </span>
  );
}

/**
 * Monta el contenido solo cuando entra en viewport. Sirve para dos cosas: que
 * la animación de las líneas arranque cuando el usuario efectivamente ve el
 * gráfico (si se dibuja fuera de pantalla, se pierde), y no pagar el render de
 * recharts hasta que haga falta. `once` evita que se reanime al hacer scroll
 * arriba y abajo, que resulta molesto.
 */
function useInView<T extends HTMLElement>(margen = '0px 0px -80px 0px') {
  const ref = useRef<T>(null);
  // Sin IntersectionObserver (navegador viejo o entorno de test) arranca
  // visible, para que el gráfico nunca quede en blanco. Va como estado inicial
  // y no como setState en el efecto, que dispararía un render en cascada.
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.15, rootMargin: margen });
    obs.observe(el);
    return () => obs.disconnect();
  }, [margen]);
  return { ref, visible };
}

/** "2026-06-W3" → "jun W3": el año no aporta y no entra a media caja. */
function etiquetaSemana(semana: string) {
  const m = /^(\d{4})-(\d{2})-(W\d)$/.exec(semana);
  if (!m) return semana;
  return `${MES_CORTO[Number(m[2]) - 1] ?? m[2]} ${m[3]}`;
}

/** "2026-08" → "ago 26"; el año solo en enero, para no repetirlo 12 veces. */
const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function etiquetaMes(mes: string) {
  const [a, m] = mes.split('-');
  const i = Number(m) - 1;
  const nombre = MES_CORTO[i] ?? m;
  return i === 0 ? `${nombre} ${a.slice(2)}` : nombre;
}

// ── Lectura rápida ────────────────────────────────────────────────────────
//
// Una comparación sin conclusión obliga al ejecutivo a hacer la lectura él
// mismo. Cada hallazgo lleva una etiqueta y un tono: la categoría se lee del
// texto, no solo del color, así que sigue siendo legible sin distinguir
// colores. Todo sale de datos presentes — si falta la base del período
// anterior no se inventa una tendencia.

type Tono = 'info' | 'bien' | 'ojo' | 'alerta';

interface Hallazgo {
  etiqueta: string;
  tono: Tono;
  texto: ReactNode;
}

const TONO_STYLE: Record<Tono, { color: string; bg: string; punto: string }> = {
  info:   { color: '#475569', bg: '#f8fafc', punto: '#94a3b8' },
  bien:   { color: '#047857', bg: '#f0fdf4', punto: '#10b981' },
  ojo:    { color: '#b45309', bg: '#fffbeb', punto: '#f59e0b' },
  alerta: { color: '#b91c1c', bg: '#fef2f2', punto: '#ef4444' },
};

const Dato = ({ children }: { children: ReactNode }) => (
  <strong className="font-semibold text-slate-900 tabular-nums">{children}</strong>
);

function lecturaRapida(sel: ClienteTabla[]): Hallazgo[] {
  if (sel.length < 2) return [];
  const h: Hallazgo[] = [];

  // ── Tamaño relativo
  const porMonto = [...sel].sort((a, b) => monto12m(b) - monto12m(a));
  const top = porMonto[0];
  const menor = porMonto[porMonto.length - 1];
  if (monto12m(menor) > 0) {
    const ratio = monto12m(top) / monto12m(menor);
    h.push({
      etiqueta: 'Tamaño', tono: 'info',
      texto: ratio >= 1.15
        ? <><Dato>{top.nombre}</Dato> factura <Dato>{ratio.toFixed(1)}×</Dato> lo de <Dato>{menor.nombre}</Dato> en 12 meses ({fmtUSD(monto12m(top))} contra {fmtUSD(monto12m(menor))}).</>
        : <>Los {sel.length} facturan montos comparables, entre <Dato>{fmtUSD(monto12m(menor))}</Dato> y <Dato>{fmtUSD(monto12m(top))}</Dato>: el tamaño no debería decidir a quién atender primero.</>,
    });
  }

  // ── Tendencia semestral
  const conDelta = sel
    .map(c => ({ c, d: delta6m(c) }))
    .filter((x): x is { c: ClienteTabla; d: number } => x.d !== null);
  if (conDelta.length >= 2) {
    const mejor = conDelta.reduce((a, b) => (b.d > a.d ? b : a));
    const peor  = conDelta.reduce((a, b) => (b.d < a.d ? b : a));
    if (keyDe(mejor.c) !== keyDe(peor.c)) {
      h.push({
        etiqueta: 'Tendencia',
        tono: peor.d <= -0.25 ? 'alerta' : peor.d < 0 ? 'ojo' : 'bien',
        texto: <><Dato>{mejor.c.nombre}</Dato> {mejor.d >= 0 ? 'crece' : 'cae'} <Dato>{fmtPct(mejor.d)}</Dato> contra el semestre anterior y <Dato>{peor.c.nombre}</Dato> {peor.d < 0 ? 'cae' : 'crece'} <Dato>{fmtPct(peor.d)}</Dato>{peor.d <= -0.25 ? ' — una caída de ese tamaño no se recupera sola' : ''}.</>,
      });
    } else if (conDelta.every(x => x.d < 0)) {
      h.push({
        etiqueta: 'Tendencia', tono: 'alerta',
        texto: <>Los {conDelta.length} caen contra el semestre anterior. No es un caso puntual: revisá qué cambió en la cuenta o en el producto.</>,
      });
    }
  }

  // ── Riesgo declarado por el estado
  const enRiesgo = sel.filter(c => c.status === 'en_riesgo' || c.status === 'critico');
  if (enRiesgo.length > 0) {
    h.push({
      etiqueta: 'Prioridad', tono: 'alerta',
      texto: <>Atendé primero {enRiesgo.map((c, i) => (
        <span key={keyDe(c)}>{i > 0 ? ', ' : ''}<Dato>{c.nombre}</Dato> ({c.diasSinCompra} días sin comprar)</span>
      ))}.</>,
    });
  } else {
    const dormido = [...sel].sort((a, b) => b.diasSinCompra - a.diasSinCompra)[0];
    if (dormido.diasSinCompra >= 60) {
      h.push({
        etiqueta: 'Prioridad', tono: 'ojo',
        texto: <><Dato>{dormido.nombre}</Dato> lleva <Dato>{dormido.diasSinCompra} días</Dato> sin comprar, el más rezagado del grupo, aunque su estado todavía no marca riesgo.</>,
      });
    } else {
      h.push({
        etiqueta: 'Prioridad', tono: 'bien',
        texto: <>Ninguno está en riesgo y el más rezagado lleva <Dato>{dormido.diasSinCompra} días</Dato> sin comprar: es una comparación para hacer crecer, no para rescatar.</>,
      });
    }
  }

  // ── Tipo de cliente: cambia por completo cómo se lee todo lo demás
  const est = sel.filter(c => c.tipo === 'estacional');
  const rec = sel.filter(c => c.tipo === 'recurrente');
  if (est.length > 0 && rec.length > 0) {
    h.push({
      etiqueta: 'Perfil', tono: 'ojo',
      texto: <>Estás mezclando perfiles: <Dato>{rec.map(c => c.nombre).join(', ')}</Dato> {rec.length === 1 ? 'compra' : 'compran'} de forma recurrente y <Dato>{est.map(c => c.nombre).join(', ')}</Dato> {est.length === 1 ? 'lo hace' : 'lo hacen'} por campañas. Un mes sin factura es una alarma en el primer caso y algo esperable en el segundo, así que los días sin comprar no se comparan directo.</>,
    });
  } else if (est.length === sel.length) {
    h.push({
      etiqueta: 'Perfil', tono: 'info',
      texto: <>Los {sel.length} son <Dato>estacionales</Dato>: compran por campañas. Mirá el mes en que se activan en el gráfico de abajo antes que los días sin comprar.</>,
    });
  } else {
    h.push({
      etiqueta: 'Perfil', tono: 'info',
      texto: <>Los {sel.length} son <Dato>recurrentes</Dato>: se espera factura todos los meses, así que cualquier hueco en la serie mensual es una señal a explicar.</>,
    });
  }

  // ── Consistencia: meses activos de los últimos 12
  const porMeses = [...sel].sort((a, b) => b.meses12m - a.meses12m);
  if (porMeses[0].meses12m - porMeses[porMeses.length - 1].meses12m >= 3) {
    const a = porMeses[0], b = porMeses[porMeses.length - 1];
    h.push({
      etiqueta: 'Consistencia', tono: 'info',
      texto: <><Dato>{a.nombre}</Dato> facturó en <Dato>{a.meses12m}</Dato> de los últimos 12 meses y <Dato>{b.nombre}</Dato> solo en <Dato>{b.meses12m}</Dato>: la diferencia de monto puede ser más de frecuencia que de tamaño de compra.</>,
    });
  }

  // ── Modelo de fuga (solo si hay dato para comparar)
  const conRiesgo = sel.filter(c => c.probRiesgo != null);
  if (conRiesgo.length >= 2) {
    const peor = conRiesgo.reduce((a, b) => ((b.probRiesgo ?? 0) > (a.probRiesgo ?? 0) ? b : a));
    const pct = Math.round((peor.probRiesgo ?? 0) * 100);
    h.push({
      etiqueta: 'Modelo ML', tono: pct >= 50 ? 'alerta' : pct >= 25 ? 'ojo' : 'info',
      texto: <>El modelo de fuga marca a <Dato>{peor.nombre}</Dato> como el de mayor riesgo del grupo, con <Dato>{pct}%</Dato>{pct < 25 ? ' — un valor bajo, ninguno preocupa por esta vía' : ''}.</>,
    });
  } else if (conRiesgo.length === 0) {
    h.push({
      etiqueta: 'Modelo ML', tono: 'info',
      texto: <>Ninguno tiene probabilidad de fuga calculada, así que la lectura de riesgo se apoya solo en el estado y los días sin comprar.</>,
    });
  }

  // ── Antigüedad
  const porAnios = [...sel].sort((a, b) => b.anos - a.anos);
  if (porAnios[0].anos - porAnios[porAnios.length - 1].anos >= 2) {
    h.push({
      etiqueta: 'Antigüedad', tono: 'info',
      texto: <><Dato>{porAnios[0].nombre}</Dato> lleva <Dato>{porAnios[0].anos} años</Dato> como cliente y <Dato>{porAnios[porAnios.length - 1].nombre}</Dato> <Dato>{porAnios[porAnios.length - 1].anos}</Dato>: la cuenta más nueva todavía tiene techo por explorar.</>,
    });
  }

  return h;
}

// ── Buscador ──────────────────────────────────────────────────────────────

const SIN_TEXTO_LIMITE = 20;

function Buscador({
  universo, seleccion, onAdd, hayFueraDeCartera, navegarSinTexto,
}: {
  universo:  ClienteTabla[];
  seleccion: ClienteTabla[];
  onAdd:     (c: ClienteTabla) => void;
  /** true si con "Solo mi cartera" apagado sí habría resultados para la búsqueda */
  hayFueraDeCartera?: (q: string) => boolean;
  /** Con un filtro (ej. industria) ya acotando `universo`, mostrar la lista al
   *  abrir sin necesidad de escribir — el filtro ya hizo el trabajo de acotar. */
  navegarSinTexto?: boolean;
}) {
  const [q, setQ]             = useState('');
  const [abierto, setAbierto] = useState(false);
  const [idx, setIdx]         = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const lleno = seleccion.length >= MAX_SEL;
  const yaSel = new Set(seleccion.map(keyDe));

  const sinTexto = !q.trim();

  const matches = useMemo(() => {
    const term      = q.trim().toLowerCase();
    const termAlnum = soloAlnum(term);
    if (!terminoUtil(term, termAlnum)) {
      // Sin texto: si hay un filtro ya acotando el universo (industria), se
      // navega la lista completa ordenada por monto en vez de pedir escribir.
      if (!navegarSinTexto) return [];
      return universo
        .filter(c => !yaSel.has(keyDe(c)))
        .sort((a, b) => monto12m(b) - monto12m(a))
        .slice(0, SIN_TEXTO_LIMITE);
    }
    return universo
      .filter(c => !yaSel.has(keyDe(c)) && coincide(c, term, termAlnum))
      // El match por ID va primero: si se tecleó un ID es porque se busca ESE
      // cliente, y ordenar solo por monto lo dejaría debajo de homónimos grandes.
      .sort((a, b) => {
        const ia = coincideId(a, termAlnum) ? 1 : 0;
        const ib = coincideId(b, termAlnum) ? 1 : 0;
        return ib - ia || monto12m(b) - monto12m(a);
      })
      .slice(0, 8);
  }, [q, universo, seleccion, navegarSinTexto]); // eslint-disable-line react-hooks/exhaustive-deps

  // idx se resetea en el onChange; se acota acá porque la lista también encoge
  // al seleccionar un cliente.
  const act = Math.min(idx, Math.max(matches.length - 1, 0));

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function elegir(c: ClienteTabla) {
    onAdd(c);
    setQ('');
    setAbierto(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!matches.length) return;
    if (e.key === 'ArrowDown')    { e.preventDefault(); setIdx(Math.min(act + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(Math.max(act - 1, 0)); }
    else if (e.key === 'Enter')   { e.preventDefault(); elegir(matches[act]); }
    else if (e.key === 'Escape')  { setAbierto(false); }
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <input
        type="text"
        value={q}
        disabled={lleno}
        onChange={e => { setQ(e.target.value); setIdx(0); setAbierto(true); }}
        onFocus={() => setAbierto(true)}
        onKeyDown={onKeyDown}
        placeholder={lleno ? `Máximo ${MAX_SEL} clientes — quita uno para agregar otro`
          : navegarSinTexto ? 'Hacé clic para ver la lista, o escribí para buscar…'
          : 'Buscar por razón social o ID panel…'}
        aria-label="Buscar cliente para comparar"
        aria-expanded={abierto && matches.length > 0}
        aria-controls="comparador-resultados"
        role="combobox"
        className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white
                   placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400
                   focus:outline-none focus:ring-2 focus:ring-[#0097A7]/40 focus:border-[#0097A7]"
      />
      {abierto && matches.length > 0 && (
        <ul
          id="comparador-resultados"
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto bg-white border border-slate-200
                     rounded-xl shadow-lg py-1"
        >
          {sinTexto && navegarSinTexto && (
            <li className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-50">
              {universo.length > SIN_TEXTO_LIMITE
                ? `Top ${SIN_TEXTO_LIMITE} por facturación de ${universo.length} — escribí para acotar`
                : `${matches.length} cuenta${matches.length === 1 ? '' : 's'}`}
            </li>
          )}
          {matches.map((c, i) => (
            <li key={keyDe(c)} role="option" aria-selected={i === act}>
              <button
                type="button"
                onMouseEnter={() => setIdx(i)}
                onClick={() => elegir(c)}
                className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 ${i === act ? 'bg-slate-50' : ''}`}
              >
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-slate-700 truncate">{c.nombre}</span>
                  {/* El Panel ID va primero y en monoespaciada: es lo único que
                      distingue a dos homónimos del mismo país y ejecutivo. */}
                  <span className="block text-[10px] text-slate-400">
                    <span className="font-mono text-slate-500">{c.panelId || c.idTributario || '—'}</span>
                    {' · '}{c.pais} · {c.kam || 'Sin ejecutivo'} · {c.tipo === 'estacional' ? 'Estacional' : 'Recurrente'}
                  </span>
                </span>
                <span className="text-xs font-semibold text-slate-500 tabular-nums flex-shrink-0">
                  {fmtUSD(monto12m(c))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {abierto && matches.length === 0 && (q.trim().length >= 2 || (sinTexto && navegarSinTexto)) && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg
                        px-3 py-2.5 text-xs text-slate-400">
          {sinTexto
            ? 'Sin cuentas para este filtro'
            : <>Sin coincidencias para «{q.trim()}»</>}
          {hayFueraDeCartera?.(q) && (
            <span className="block mt-1 text-[11px] text-amber-600">
              Sí existe fuera de tu cartera — destildá «Solo mi cartera» para verlo.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tarjeta ───────────────────────────────────────────────────────────────

/**
 * Chip de industria con edición inline. Muestra el valor EN VIVO de la hoja
 * "Industria — Cartera por País" (no el que quedó guardado en la hoja maestra
 * la última vez que alguien corrió "Actualizar Cartera" — puede estar
 * desactualizado si hubo una corrección o un alta de campanazo después).
 * Si la empresa no tiene fila en esa hoja todavía, no se puede editar acá
 * —no hay dónde escribir la corrección— y se muestra el valor de la cartera
 * tal cual, sin lápiz.
 */
function TarjetaCliente({ c, slot, onRemove }: { c: ClienteTabla; slot: number; onRemove: () => void }) {
  const d  = delta6m(c);
  const st = statusDe(c);

  return (
    <div
      className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col gap-3 border-l-4"
      style={{ borderLeftColor: SLOT_COLOR[slot] }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 leading-snug break-words">{c.nombre}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            <span className="font-mono text-slate-500">{c.panelId || c.idTributario || '—'}</span>
            {' · '}{c.pais} · {c.kam || 'Sin ejecutivo'} · {c.tipo === 'estacional' ? 'Estacional' : 'Recurrente'}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Quitar ${c.nombre} de la comparación`}
          className="flex-shrink-0 w-6 h-6 grid place-items-center rounded-lg text-slate-400
                     hover:text-slate-700 hover:bg-slate-100 transition-colors active:scale-95"
        >
          ✕
        </button>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wide text-slate-400">Facturación 12 meses</p>
        <p className="text-2xl font-bold text-slate-900 tabular-nums leading-tight">{fmtUSD(monto12m(c))}</p>
        {d !== null ? (
          <p className="text-[11px] font-semibold tabular-nums" style={{ color: d >= 0 ? '#047857' : '#b91c1c' }}>
            {d >= 0 ? '▲' : '▼'} {fmtPct(d)} <span className="font-normal text-slate-400">vs semestre anterior</span>
          </p>
        ) : (
          <p className="text-[11px] text-slate-400">Sin base del semestre anterior</p>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: st.color, background: st.bg }}>
          {st.label}
        </span>
        <SegChip segmento={c.segmento} />
        <ChipIndustria c={c} />
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] pt-1 border-t border-slate-100">
        <div><dt className="text-slate-400">Sin comprar</dt><dd className="font-semibold text-slate-700 tabular-nums">{c.diasSinCompra} días</dd></div>
        <div><dt className="text-slate-400">Meses activos 12m</dt><dd className="font-semibold text-slate-700 tabular-nums">{c.meses12m}</dd></div>
        <div><dt className="text-slate-400">Salud del cliente</dt><dd className="mt-0.5"><ScoreChip score={scoreDe(c)} /></dd></div>
        <div>
          <dt className="text-slate-400">Riesgo de fuga</dt>
          <dd className="font-semibold text-slate-700 tabular-nums">
            {c.probRiesgo == null ? 'Sin dato' : `${Math.round(c.probRiesgo * 100)}%`}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function SlotVacio({ slot }: { slot: number }) {
  return (
    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 grid place-items-center min-h-[220px]">
      <p className="text-xs text-slate-400 text-center">
        Cliente {slot + 1}<br />
        <span className="text-[11px]">Búscalo arriba para agregarlo</span>
      </p>
    </div>
  );
}

// ── Evolución de la salud (pestaña Historial) ─────────────────────────────
// El Historial guarda el score del TIPO de cliente —RENT o VENT—, o sea la
// salud. No hay histórico del score de segmentación.

function serieScore(sel: ClienteTabla[], hist: HistorialMap | undefined) {
  if (!hist) return { data: [], semanas: 0 };
  const semanas = new Set<string>();
  const porCliente = sel.map((c, i) => {
    const entries = hist.get(keyDe(c)) ?? [];
    entries.forEach(e => semanas.add(e.semana));
    return { slot: slotKey(i), m: new Map(entries.map(e => [e.semana, e.score])) };
  });
  const ordenadas = [...semanas].sort();
  const data = ordenadas.map(sem => {
    const row: Record<string, string | number | null> = { semana: sem };
    porCliente.forEach(p => { row[p.slot] = p.m.get(sem) ?? null; });
    return row;
  });
  return { data, semanas: ordenadas.length };
}

// ── Evolución mensual de facturación ──────────────────────────────────────

function EvolucionMensual(
  { seleccion, compacto = false }: { seleccion: ClienteTabla[]; compacto?: boolean }
) {
  const claves = seleccion.map(keyDe);
  // Dep estable del useMemo: `claves` es un array nuevo en cada render.
  const clavesId = claves.join('|');
  const { data, isLoading, isError } = useClienteSerie(claves);
  const { ref, visible } = useInView<HTMLDivElement>();

  const filas = useMemo(() => {
    const series = data?.series ?? [];
    if (series.length === 0) return [];
    const meses = series[0].puntos.map(p => p.mes);
    return meses.map((mes, i) => {
      const row: Record<string, string | number> = { mes, etiqueta: etiquetaMes(mes) };
      claves.forEach((k, slot) => {
        const s = series.find(x => x.clave === k);
        row[slotKey(slot)] = s?.puntos[i]?.usd ?? 0;
      });
      return row;
    });
  }, [data, clavesId]); // eslint-disable-line react-hooks/exhaustive-deps

  const hayMovimiento = filas.some(f =>
    seleccion.some((_, i) => Number(f[slotKey(i)]) > 0));

  return (
    <div ref={ref} className="bg-white border border-slate-100 rounded-2xl p-5">
      <div className="flex items-baseline justify-between gap-3 mb-0.5">
        <p className="text-xs font-semibold text-slate-600">Evolución mensual de facturación</p>
        <span className="text-[10px] text-slate-400">12 meses · USD</span>
      </div>
      <p className="text-[10px] text-slate-400 mb-3">
        Un mes en cero es cero facturado, no falta de dato.
      </p>

      {isLoading && <div style={{ height: 240 }} className="animate-pulse rounded-xl bg-slate-50" />}

      {isError && (
        <div style={{ height: 240 }} className="grid place-items-center text-xs text-slate-400 text-center px-6">
          No se pudo cargar la serie mensual.<br />
          <span className="text-[11px]">El resto de la comparación no depende de este gráfico.</span>
        </div>
      )}

      {!isLoading && !isError && !hayMovimiento && (
        <div style={{ height: 240 }} className="grid place-items-center text-xs text-slate-400">
          Sin facturación registrada en los últimos 12 meses
        </div>
      )}

      {!isLoading && !isError && hayMovimiento && (
        visible ? (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={filas} margin={{ top: 6, right: 16, bottom: 4, left: 8 }}>
              <defs>
                {seleccion.map((c, i) => (
                  <linearGradient key={keyDe(c)} id={`grad-${slotKey(i)}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={SLOT_COLOR[i]} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={SLOT_COLOR[i]} stopOpacity={0.01} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="etiqueta" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false}
                // A media caja las 12 etiquetas se pisan: se dejan saltar,
                // conservando siempre el primer y el último mes.
                interval={compacto ? 'preserveStartEnd' : 0} minTickGap={compacto ? 10 : 0}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                tickFormatter={v => fmtUSD(Number(v))} width={compacto ? 44 : 54}
              />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                formatter={(v) => fmtUSD(Number(v))}
                labelFormatter={(l, payload) => {
                  const mes = payload?.[0]?.payload?.mes;
                  return mes ? `${l} (${mes})` : String(l);
                }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
              {seleccion.map((c, i) => (
                <Area
                  key={keyDe(c)}
                  type="monotone"
                  name={c.nombre}
                  dataKey={slotKey(i)}
                  stroke={SLOT_COLOR[i]}
                  strokeWidth={2}
                  fill={`url(#grad-${slotKey(i)})`}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
                  // La animación arranca al entrar en vista (visible), y cada
                  // serie entra escalonada para que se distingan entre sí.
                  isAnimationActive
                  animationBegin={i * 160}
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 240 }} />
        )
      )}
    </div>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────

export function ComparadorTab({ filterPais, filterKam }: { filterPais?: string; filterKam?: string }) {
  const { data: todos, isLoading, isError, error } = useTablaClientes();
  const { data: hist } = useHistorial();
  const [claves, setClaves] = useState<string[]>([]);
  const [soloMiCartera, setSoloMiCartera] = useState(true);
  const [filtroIndustria, setFiltroIndustria] = useState('');
  const { track } = useTrack();

  // Solo clientes con segmento real: fuera primera_compra y perdido_historico.
  // Único criterio: que tenga segmento real. Los clientes con KAM "Otros" SÍ
  // entran — se excluyen del leaderboard, que mide ejecutivos, pero acá se mide
  // al cliente y uno sin dueño sigue siendo un cliente. Filtrarlos escondía 109
  // clientes por USD 2,68M, entre ellos Pluxee Chile (USD 1,17M), que factura
  // más que casi cualquier cliente asignado.
  const conSegmento = useMemo(
    () => (todos ?? []).filter(c =>
      (c.tipo === 'estacional' || c.tipo === 'recurrente') &&
      (!filterPais || mismoPais(c.pais, filterPais))),
    [todos, filterPais]
  );

  // Industrias presentes en el universo con filtro de KAM ya aplicado (no en
  // conSegmento crudo): así el desplegable no ofrece industrias que el
  // ejecutivo no tiene en su cartera cuando "Solo mi cartera" está activo.
  const baseKam = useMemo(
    () => (filterKam && soloMiCartera ? conSegmento.filter(c => c.kam === filterKam) : conSegmento),
    [conSegmento, filterKam, soloMiCartera]
  );
  const industriasDisponibles = useMemo(() => {
    const counts = new Map<string, number>();
    baseKam.forEach(c => { if (c.industria) counts.set(c.industria, (counts.get(c.industria) ?? 0) + 1); });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [baseKam]);

  const universo = useMemo(
    () => (filtroIndustria ? baseKam.filter(c => c.industria === filtroIndustria) : baseKam),
    [baseKam, filtroIndustria]
  );

  const seleccion = useMemo(() => {
    const idx = new Map(conSegmento.map(c => [keyDe(c), c]));
    return claves.map(k => idx.get(k)).filter((c): c is ClienteTabla => !!c);
  }, [claves, conSegmento]);

  function add(c: ClienteTabla) {
    const k = keyDe(c);
    if (claves.includes(k) || claves.length >= MAX_SEL) return;
    // El track va ACÁ y no dentro del updater de setClaves: los updaters tienen
    // que ser puros —React los puede invocar dos veces— y ahí adentro contaría
    // doble. `add` sale de un handler, así que `claves` es el del render actual.
    //
    // El detalle es cuántos clientes quedan comparándose. Entrar al tab ya se
    // registra aparte; esto distingue a quien compara de quien entra y mira.
    track('analisis:cuentas-clave:comparar', String(claves.length + 1));
    setClaves(prev => (prev.includes(k) || prev.length >= MAX_SEL ? prev : [...prev, k]));
  }

  const hallazgos = lecturaRapida(seleccion);

  // Radar: los factores del score, de 1 a 4. Recencia aplica a recurrentes y
  // Vigencia a estacionales, así que al comparar tipos distintos se muestran
  // ambos ejes y cada cliente aporta solo el que su modelo calcula.
  const hayRec = seleccion.some(c => c.tipo === 'recurrente');
  const hayEst = seleccion.some(c => c.tipo === 'estacional');
  const radarData = useMemo(() => {
    const ejes: { get: (c: ClienteTabla) => number | null; label: string }[] = [
      ...(hayRec ? [{ label: 'Recencia',  get: (c: ClienteTabla) => (c.tipo === 'recurrente' ? c.fRec : null) }] : []),
      ...(hayEst ? [{ label: 'Vigencia',  get: (c: ClienteTabla) => (c.tipo === 'estacional' ? c.fVig : null) }] : []),
      { label: 'Engagement', get: (c: ClienteTabla) => c.fEng },
      { label: 'Tendencia',  get: (c: ClienteTabla) => c.fTen },
    ];
    return ejes.map(({ get, label }) => {
      const row: Record<string, string | number | null> = { factor: label };
      seleccion.forEach((c, i) => { row[slotKey(i)] = get(c); });
      return row;
    });
  }, [seleccion, hayRec, hayEst]);

  const mixData = useMemo(() =>
    seleccion.map((c, i) => ({
      // Se desambigua con el slot: dos clientes homónimos colapsarían en una barra.
      empresa:     (c.nombre.length > 20 ? c.nombre.slice(0, 19) + '…' : c.nombre) + (i > 0 && seleccion.slice(0, i).some(o => o.nombre === c.nombre) ? ' (2)' : ''),
      SaaS:        c.pctSaas * 100,
      Puntos:      c.pctPuntos * 100,
      SuperCard:   c.pctSupercard * 100,
      GiftCard:    c.pctGiftcard * 100,
      Marketplace: c.pctMarketplace * 100,
    })), [seleccion]);

  const { data: scoreData, semanas } = useMemo(() => serieScore(seleccion, hist), [seleccion, hist]);

  if (isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-slate-50" />;
  if (isError) {
    return (
      <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 text-sm text-rose-800">
        No se pudo leer la base de clientes: {(error as Error)?.message ?? 'error desconocido'}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold text-slate-800">Comparador de clientes</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Hasta {MAX_SEL} clientes lado a lado · {universo.length.toLocaleString('es')} disponibles
          {filterKam && soloMiCartera ? ' en tu cartera' : ''}
          {filtroIndustria ? ` · industria "${filtroIndustria}"` : ''} · solo estacionales y recurrentes
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Buscador
          universo={universo}
          seleccion={seleccion}
          onAdd={add}
          navegarSinTexto={!!filtroIndustria}
          hayFueraDeCartera={(q) => {
            if (!filterKam || !soloMiCartera) return false;
            const t  = q.trim().toLowerCase();
            const ta = soloAlnum(t);
            return terminoUtil(t, ta) && conSegmento.some(c => coincide(c, t, ta));
          }}
        />
        {industriasDisponibles.length > 0 && (
          <select
            value={filtroIndustria}
            onChange={e => setFiltroIndustria(e.target.value)}
            aria-label="Filtrar por industria"
            title="Acotar la búsqueda a una industria — útil para comparar la misma industria entre países"
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600
                       focus:outline-none focus:ring-2 focus:ring-[#0097A7]/40 focus:border-[#0097A7]"
          >
            <option value="">Todas las industrias</option>
            {industriasDisponibles.map(([nombre, n]) => (
              <option key={nombre} value={nombre}>{nombre} ({n})</option>
            ))}
          </select>
        )}
        {filterKam && (
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={soloMiCartera}
              onChange={e => setSoloMiCartera(e.target.checked)}
              className="w-3.5 h-3.5 accent-[#0097A7]"
            />
            Solo mi cartera
          </label>
        )}
        {seleccion.length > 0 && (
          <button
            type="button"
            onClick={() => setClaves([])}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors active:scale-95"
          >
            Limpiar
          </button>
        )}
      </div>

      {hallazgos.length > 0 && (
        <section
          aria-label="Lectura rápida de la comparación"
          className="relative overflow-hidden rounded-2xl border border-slate-200/80
                     bg-gradient-to-br from-white via-slate-50/80 to-[#0097A7]/[0.06] p-5"
        >
          {/* Filete de acento: ancla el bloque sin competir con las tarjetas */}
          <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-[#0097A7] to-[#0097A7]/20" />

          <div className="flex items-baseline justify-between gap-3 mb-3 pl-1">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">
              Lectura rápida
            </h3>
            <span className="text-[10px] text-slate-400">
              {hallazgos.length} {hallazgos.length === 1 ? 'hallazgo' : 'hallazgos'}
            </span>
          </div>

          <ul className="grid gap-1.5 pl-1">
            {hallazgos.map((f, i) => {
              const t = TONO_STYLE[f.tono];
              return (
                <li
                  key={`${f.etiqueta}-${i}`}
                  className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-white/70 px-3 py-2"
                >
                  <span
                    className="mt-px inline-flex flex-shrink-0 items-center gap-1.5 rounded-md px-1.5 py-0.5
                               text-[9px] font-bold uppercase tracking-wide"
                    style={{ color: t.color, background: t.bg }}
                  >
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: t.punto }} />
                    {f.etiqueta}
                  </span>
                  <p className="text-xs leading-relaxed text-slate-600">{f.texto}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: MAX_SEL }, (_, i) => {
          const c = seleccion[i];
          return c
            ? <TarjetaCliente key={keyDe(c)} c={c} slot={i} onRemove={() => setClaves(prev => prev.filter(x => x !== keyDe(c)))} />
            : <SlotVacio key={`vacio-${i}`} slot={i} />;
        })}
      </div>

      {seleccion.length >= 2 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-100 rounded-2xl p-5">
              <p className="text-xs font-semibold text-slate-600 mb-0.5">Factores de la salud del cliente</p>
              <p className="text-[10px] text-slate-400 mb-3">
                Factores de 1 (débil) a 4 (fuerte).
                {hayRec && hayEst && ' Recencia aplica a recurrentes y Vigencia a estacionales: cada uno aporta el que su modelo calcula.'}
              </p>
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="factor" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <PolarRadiusAxis domain={[0, 4]} tickCount={5} tick={{ fontSize: 9, fill: '#cbd5e1' }} axisLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  {seleccion.map((c, i) => (
                    <Radar key={keyDe(c)} name={c.nombre} dataKey={slotKey(i)}
                      stroke={SLOT_COLOR[i]} strokeWidth={2} fill={SLOT_COLOR[i]} fillOpacity={0.13} />
                  ))}
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-5">
              <p className="text-xs font-semibold text-slate-600 mb-0.5">Mix de producto</p>
              <p className="text-[10px] text-slate-400 mb-3">Participación de cada categoría sobre el total facturado.</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={mixData} margin={{ top: 4, right: 12, bottom: 4, left: 8 }} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="empresa" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} interval={0} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    formatter={(v) => `${Number(v).toFixed(0)}%`}
                  />
                  <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                  {/* Antes eran 5 tonos del mismo cyan (#0e7490..#a5f3fc) — una rampa
                      secuencial usada para identidad categórica, así que las categorías
                      adyacentes eran casi indistinguibles (y para daltonismo, directamente
                      iguales). Paleta categórica de 5 tonos distintos, validada con
                      scripts/validate_palette.js del skill dataviz (CVD ΔE 9.1, normal-vision
                      ΔE 19.6 en el peor par adyacente — todo PASS). */}
                  <Bar dataKey="SaaS"        stackId="m" fill="#2a78d6" />
                  <Bar dataKey="Puntos"      stackId="m" fill="#eb6834" />
                  <Bar dataKey="SuperCard"   stackId="m" fill="#1baf7a" />
                  <Bar dataKey="GiftCard"    stackId="m" fill="#eda100" />
                  <Bar dataKey="Marketplace" stackId="m" fill="#e87ba4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Las dos series temporales van lado a lado. Si no hay historial
              suficiente, la mensual ocupa el ancho completo en vez de quedar a
              media caja con un hueco al lado. */}
          <div className={`grid grid-cols-1 gap-4 ${semanas >= 2 ? 'lg:grid-cols-2' : ''}`}>
            <EvolucionMensual seleccion={seleccion} compacto={semanas >= 2} />

            {semanas >= 2 && (
              <div className="bg-white border border-slate-100 rounded-2xl p-5">
                <div className="flex items-baseline justify-between gap-3 mb-0.5">
                  <p className="text-xs font-semibold text-slate-600">Evolución de la salud del cliente</p>
                  <span className="text-[10px] text-slate-400">{semanas} semanas</span>
                </div>
                <p className="text-[10px] text-slate-400 mb-3">
                  Snapshot semanal de la pestaña Historial.
                </p>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={scoreData} margin={{ top: 6, right: 16, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="semana" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false}
                      // "2026-06-W3" no entra a media caja: se recorta a "jun W3"
                      tickFormatter={etiquetaSemana}
                      interval="preserveStartEnd" minTickGap={8}
                    />
                    <YAxis
                      domain={[0, 4]} ticks={[0, 1, 2, 3, 4]} width={24}
                      tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                      labelFormatter={l => `Semana ${l}`}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                    {seleccion.map((c, i) => (
                      <Line key={keyDe(c)} type="monotone" name={c.nombre} dataKey={slotKey(i)}
                        stroke={SLOT_COLOR[i]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <p className="text-xs font-semibold text-slate-600">Detalle comparado</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/60">
                    <th className="text-left font-medium text-slate-500 px-5 py-2">Métrica</th>
                    {seleccion.map((c, i) => (
                      <th key={keyDe(c)} className="text-right font-semibold text-slate-700 px-5 py-2">
                        {/* El tope va en este span y no en el <th>: con
                            table-layout auto los navegadores ignoran max-width
                            en las celdas. */}
                        <span className="flex items-center justify-end gap-1.5 ml-auto"
                              style={{ maxWidth: ANCHO_COL_MAX }}>
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: SLOT_COLOR[i] }} />
                          <span className="truncate" title={tooltipSiLargo(c.nombre)}>{c.nombre}</span>
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {([
                    ['Panel ID',              (c: ClienteTabla) => c.panelId || c.idTributario || '—'],
                    ['País',                  (c: ClienteTabla) => c.pais],
                    ['Ejecutivo',             (c: ClienteTabla) => kamLabel(c)],
                    ['Industria',             (c: ClienteTabla) => c.industria || 'Sin dato'],
                    ['Tipo',                  (c: ClienteTabla) => (c.tipo === 'estacional' ? 'Estacional' : 'Recurrente')],
                    ['Facturación 12m',       (c: ClienteTabla) => fmtUSD(monto12m(c))],
                    ['Últimos 6m',            (c: ClienteTabla) => fmtUSD(c.monto6mAct)],
                    ['6m año anterior',      (c: ClienteTabla) => fmtUSD(c.monto6mAnt)],
                    ['Variación semestral',   (c: ClienteTabla) => { const d = delta6m(c); return d === null ? '—' : fmtPct(d); }],
                    ['Facturas emitidas',     (c: ClienteTabla) => String(c.totalFacturas)],
                    ['Años como cliente',     (c: ClienteTabla) => String(c.anos)],
                    ['Meses activos (12m)',   (c: ClienteTabla) => String(c.meses12m)],
                    ['Última compra',         (c: ClienteTabla) => c.ultimaCompra || '—'],
                    ['Días sin comprar',      (c: ClienteTabla) => String(c.diasSinCompra)],
                    ['Días entre compras',    (c: ClienteTabla) => (c.tbpDias ? `${Math.round(c.tbpDias)} d` : '—')],
                    ['Salud del cliente',     (c: ClienteTabla) => <ScoreChip score={scoreDe(c)} />],
                    ['Estado',                (c: ClienteTabla) => {
                      const st = statusDe(c);
                      return (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ color: st.color, background: st.bg, border: `1px solid ${st.color}33` }}>
                          {st.label}
                        </span>
                      );
                    }],
                    ['Riesgo de fuga (ML)',   (c: ClienteTabla) => (c.probRiesgo == null ? 'Sin dato' : `${Math.round(c.probRiesgo * 100)}%`)],
                    ['Predicción',            (c: ClienteTabla) => c.tipoPrediccion || 'Sin dato'],
                  ] as [string, (c: ClienteTabla) => ReactNode][]).map(([label, fn]) => (
                    <tr key={label} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                      <td className="px-5 py-1.5 text-slate-500">{label}</td>
                      {seleccion.map((c, i) => {
                        const v = fn(c);
                        // Solo los valores de texto se truncan; los que devuelven
                        // JSX (Score, Estado) son píldoras cortas y truncarlas les
                        // cortaría el fondo redondeado.
                        const esTexto = typeof v === 'string';
                        return (
                          <td key={keyDe(c)}
                            className="px-5 py-1.5 text-right font-medium text-slate-700 tabular-nums"
                            style={{ background: SLOT_SOFT[i] + '80' }}
                          >
                            {esTexto
                              ? <span className="block truncate ml-auto" title={tooltipSiLargo(v)}
                                      style={{ maxWidth: ANCHO_COL_MAX }}>{v}</span>
                              : <span className="whitespace-nowrap">{v}</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {seleccion.length === 1 && (
        <p className="text-xs text-slate-400 text-center py-4">
          Agrega al menos un cliente más para ver la comparación.
        </p>
      )}
    </div>
  );
}
