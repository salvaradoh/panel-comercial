import { useState, useMemo } from 'react';
import { useCacheSegmentacion } from '../../hooks/useCacheSegmentacion';
import { useCacheChurn } from '../../hooks/useCacheChurn';
import { useSaludPorPanel, clavePanel } from '../../hooks/useSaludPorPanel';
import type { SaludPorPanel } from '../../hooks/useSaludPorPanel';
import { Card } from '../../components/ui/Card';
import { SaludPaisAccordion, FilterChips, FilterDivider, fmtUSD, FLAG_CC, SegInfoModal } from '../../components/salud';
import type { KamSegmentacion, ClienteSegmentacion, PaisSegmentacion, SegmentacionResponse } from '../../hooks/types';

const SEG_CFG = {
  'A+': { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', desc: 'Relación sólida' },
  'A':  { color: '#ca8a04', bg: '#fefce8', border: '#fde68a', desc: 'Seguimiento mensual' },
  'B':  { color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', desc: 'Atención activa' },
  'C':  { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', desc: 'Riesgo de pérdida' },
} as const;

type Seg = 'A+' | 'A' | 'B' | 'C';
type SegFiltro = 'todos' | Seg;

function CountryBreakdown({ paises, seg, color }: { paises: PaisSegmentacion[]; seg: Seg; color: string }) {
  const rows = paises
    .map(p => ({
      pais: p.pais,
      cnt: seg === 'A+' ? p.aPlus : seg === 'A' ? p.a : seg === 'B' ? p.b : p.c,
    }))
    .filter(r => r.cnt > 0)
    .sort((a, b) => b.cnt - a.cnt);

  if (!rows.length) return null;
  const max = rows[0].cnt;

  return (
    <div className="mt-3 flex flex-col gap-1 text-left w-full">
      {rows.map(({ pais, cnt }) => {
        const cc = FLAG_CC[pais];
        const pct = max > 0 ? (cnt / max) * 100 : 0;
        return (
          <div key={pais} className="flex items-center gap-1.5">
            {cc
              ? <img src={`https://flagcdn.com/16x12/${cc}.png`} width={12} height={9} alt={pais} className="rounded-sm flex-shrink-0" />
              : <span className="text-[9px] text-slate-400 w-3">{pais[0]}</span>
            }
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: `${color}22` }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color, opacity: 0.7 }} />
            </div>
            <span className="text-[10px] tabular-nums font-semibold w-5 text-right" style={{ color }}>{cnt}</span>
          </div>
        );
      })}
    </div>
  );
}

function wColor(v: number, max: number): string {
  const r = v / max;
  return r >= 0.875 ? '#16a34a' : r >= 0.625 ? '#ca8a04' : r >= 0.375 ? '#ea580c' : '#dc2626';
}

/** Mismos cortes que el dashboard GAS (_segFromScore). */
function segFromScore(s: number): Seg {
  return s >= 3.50 ? 'A+' : s >= 3.00 ? 'A' : s >= 2.00 ? 'B' : 'C';
}

/** Píldora de score con los mismos colores que .score-badge del GAS. */
function scoreBadgeStyle(score: number): { background: string; color: string } {
  if (score >= 3.5) return { background: '#16a34a', color: '#fff' };
  if (score >= 3.0) return { background: '#eab308', color: '#333' };
  if (score >= 2.0) return { background: '#f97316', color: '#fff' };
  return { background: '#dc2626', color: '#fff' };
}

interface Factor {
  icon: string;
  pct: string;
  /** Nombre corto del factor. El encabezado de la tabla muestra solo el ícono y
      el peso, que alcanzan cuando se ve la columna entera; apilada en móvil cada
      celda necesita decir de qué factor habla. Va explícito y no derivado del
      `title` para que editar la descripción no rompa la etiqueta en silencio. */
  label: string;
  campo: keyof ClienteSegmentacion;
  peso: number;
  /** Divisor para el color. Se replica el del GAS aunque no siempre sea el máximo real. */
  maxColor: number;
  title: string;
}

// Recurrentes (Cache_Segmentacion18)
const FACTORES_REC: Factor[] = [
  { icon: '💰', pct: '50%', label: 'Volumen', campo: 'ptVol',    peso: 0.50, maxColor: 2, title: 'Volumen — Pareto por país, peso 50%, máx 2.0' },
  { icon: '📅', pct: '20%', label: 'Meses con compra', campo: 'ptMeses',  peso: 0.20, maxColor: 1, title: 'Meses con compra, peso 20%' },
  { icon: '👥', pct: '20%', label: 'Usuarios incorporados', campo: 'ptUsrInc', peso: 0.20, maxColor: 1, title: 'Usuarios incorporados, peso 20%' },
  { icon: '💼', pct: '10%', label: 'Fee/SaaS', campo: 'ptFee',    peso: 0.10, maxColor: 1, title: 'Fee/SaaS, peso 10%' },
];

// Estacionales (Cache_Churn → scoreEstacional). Pesos distintos a recurrentes.
const FACTORES_EST: Factor[] = [
  { icon: '💰',  pct: '50%',   label: 'Volumen', campo: 'fVol',    peso: 0.50,  maxColor: 2, title: 'Volumen — Pareto por país, peso 50%, máx 2.0' },
  { icon: '🛍️', pct: '25%',   label: 'Producto dominante', campo: 'fProd',   peso: 0.25,  maxColor: 1, title: 'Producto dominante — SaaS=4, Puntos=3, SC=2, GC=1, peso 25%, máx 1.0' },
  { icon: '📅',  pct: '12.5%', label: 'Meses con compra', campo: 'fMeses',  peso: 0.125, maxColor: 1, title: 'Meses con compra en últimos 13m — 4+=4, 3→3, 2→2, 1→1, peso 12.5%, máx 0.5' },
  { icon: '📊',  pct: '12.5%', label: 'Margen de mix', campo: 'fMargen', peso: 0.125, maxColor: 1, title: 'Margen de mix — SaaS×75% + Puntos×25% + SC×12% + GC×5% sobre vol. total. ≥40%→4, ≥20%→3, ≥8%→2, <8%→1, peso 12.5%, máx 0.5' },
];

const TIPO_LABEL: Record<string, string> = {
  estacional: 'Estacional',
  primera_compra: '1ra Compra',
};

// ── Fila de cliente expandida ─────────────────────────────────────────────────

function ClienteRow({ c, esEstacional, pais, salud }: {
  c: ClienteSegmentacion; esEstacional: boolean; pais: string; salud: SaludPorPanel;
}) {
  // La columna Score muestra la SALUD (RENT/VENT), no el score de segmentación.
  // El de segmentación ya está representado por la letra de la columna Segmento,
  // así que repetirlo como número no agregaba nada, y confundía: son dos escalas
  // distintas del mismo cliente.
  // Estacionales traen el score en el propio objeto; recurrentes se resuelven
  // por panel_id contra Cache_Churn.
  const saludScore = c.saludScore ?? salud.get(clavePanel(pais, c.panelId))?.score;
  const cfg = SEG_CFG[c.segmento];
  const factores = esEstacional ? FACTORES_EST : FACTORES_REC;
  const tieneFactores = factores.some(f => c[f.campo] != null);
  // El color del badge sigue al score de SALUD, que es el que ahora se muestra.
  // Colorearlo con el de segmentación daría un verde sobre un número rojo.
  const sbSalud = scoreBadgeStyle(saludScore ?? 0);

  // Sin desglose: se muestran guiones, igual que el GAS, en vez de ocultar la fila
  if (!tieneFactores) {
    return (
      <tr className="border-b border-slate-100 text-xs">
        <td data-titular className="px-4 py-1.5 text-slate-700 truncate max-w-[200px]">{c.cliente}</td>
        <td data-label="Segmento" className="px-2 py-1.5 text-center text-slate-300">—</td>
        <td data-label="Score" className="px-2 py-1.5 text-center text-slate-300">—</td>
        <td data-label="Vol." className="px-2 py-1.5 text-right tabular-nums text-slate-600">{fmtUSD(c.vol)}</td>
        {esEstacional && <td data-label="Tipo" className="px-2 py-1.5 text-center text-slate-300">—</td>}
        {factores.map(f => <td key={f.campo} data-label={f.label} className="px-2 py-1.5 text-center text-slate-300">—</td>)}
      </tr>
    );
  }

  return (
    <tr
      className="border-b border-slate-100 hover:brightness-[0.98] transition-all text-xs"
      style={{ borderLeft: `3px solid ${cfg.color}`, background: `${cfg.bg}a6` }}
    >
      <td data-titular className="px-4 py-1.5 font-medium text-slate-700 truncate max-w-[200px]" title={c.cliente}>{c.cliente}</td>
      <td data-label="Segmento" className="px-2 py-1.5 text-center">
        <span className="inline-block px-2 py-0.5 rounded-[10px] text-[10px] font-bold text-white" style={{ background: cfg.color }}>
          {c.segmento}
        </span>
      </td>
      <td data-label="Score" className="px-2 py-1.5 text-center">
        {saludScore != null
          ? <span className="inline-block px-2 py-0.5 rounded-[10px] text-[11px] font-bold tabular-nums min-w-[34px]"
                  style={sbSalud} title={`Salud ${esEstacional ? 'VENT' : 'RENT'}: ${saludScore.toFixed(2)}`}>
              {saludScore.toFixed(2)}
            </span>
          : <span className="text-slate-300 text-[11px]" title="Sin score de salud en Análisis de Clientes">—</span>}
      </td>
      <td data-label="Vol." className="px-2 py-1.5 text-right tabular-nums text-slate-600">{fmtUSD(c.vol)}</td>
      {esEstacional && (
        <td data-label="Tipo" className="px-2 py-1.5 text-center text-[10px] text-slate-500">
          {TIPO_LABEL[c.subSeg ?? ''] ?? '—'}
        </td>
      )}
      {factores.map(f => {
        const v = Number(c[f.campo] ?? 1);
        const w = Math.round(v * f.peso * 100) / 100;
        return (
          <td key={f.campo} data-label={f.label} className="px-2 py-1.5 text-center tabular-nums font-bold whitespace-nowrap"
              style={{ color: wColor(w, f.maxColor) }}>
            {v} <span className="text-[9px] text-slate-400 font-normal">({w})</span>
          </td>
        );
      })}
    </tr>
  );
}

// ── Fila de KAM con detalle expandible ───────────────────────────────────────

function KamSegRow({ k, segFiltro, dotacionFiltro, esEstacional, pais, salud }: { k: KamSegmentacion; segFiltro: SegFiltro; dotacionFiltro: 'todos' | 'con' | 'sin'; esEstacional: boolean; pais: string; salud: SaludPorPanel }) {
  const [open, setOpen] = useState(false);
  const clientes = (segFiltro === 'todos' ? k.clientes : k.clientes.filter(c => c.segmento === segFiltro))
    // Filtro de vista: acota la lista, no toca score ni volumen.
    .filter(c => dotacionFiltro === 'todos'
      || (dotacionFiltro === 'con' ? (c.dot ?? 0) > 0 : (c.dot ?? 0) === 0));
  const factores = esEstacional ? FACTORES_EST : FACTORES_REC;
  // Acá había una columna "Meses" que era un <th> SIN celda en el cuerpo:
  // ClienteRow no la renderiza en ninguna de sus dos ramas, así que nunca mostró
  // nada y corría los cuatro factores un lugar a la izquierda, dejando la última
  // columna vacía. Se elimina en vez de rellenarla porque el dato ya está: la
  // lista de factores incluye "Meses con compra" (📅 20% en recurrentes, 12,5% en
  // estacionales), con su valor y su aporte ponderado.

  return (
    <>
      <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setOpen(v => !v)}>
        <td className="py-2 px-3 font-semibold text-slate-700 text-sm">{k.kam}</td>
        <td className="py-2 px-3 text-right tabular-nums text-slate-600 font-bold text-sm">{k.total}</td>
        <td className="py-2 px-3 text-right tabular-nums font-bold text-sm" style={{ color: SEG_CFG['A+'].color }}>{k.aPlus || <span className="text-slate-300">—</span>}</td>
        <td className="py-2 px-3 text-right tabular-nums font-bold text-sm" style={{ color: SEG_CFG['A'].color }}>{k.a || <span className="text-slate-300">—</span>}</td>
        <td className="py-2 px-3 text-right tabular-nums font-bold text-sm" style={{ color: SEG_CFG['B'].color }}>{k.b || <span className="text-slate-300">—</span>}</td>
        <td className="py-2 px-3 text-right tabular-nums font-bold text-sm" style={{ color: SEG_CFG['C'].color }}>{k.c || <span className="text-slate-300">—</span>}</td>
        <td className="py-2 px-3 text-right tabular-nums text-slate-600 text-sm">{fmtUSD(k.vol)}</td>
        <td className="py-2 px-3 text-center">
          {clientes.length > 0 && (
            <span className="text-xs text-[#0097A7] font-medium">
              {open ? '▲ Ocultar' : '▸ Ver clientes'}
            </span>
          )}
        </td>
      </tr>
      {open && clientes.length > 0 && (
        <tr>
          <td colSpan={8} className="bg-slate-50 border-l-2 border-[#0097A7] px-0 pb-1">
            <div className="max-h-72 overflow-y-auto">
              <div className="tabla-scroll">
                <table className="w-full text-xs tabla-apilable">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-200 bg-white">
                      <th className="text-left px-4 py-1.5 font-medium">Empresa</th>
                      <th className="text-center px-2 py-1.5 font-medium">Segmento</th>
                      <th className="text-center px-2 py-1.5 font-medium">Score</th>
                      <th className="text-right px-2 py-1.5 font-medium">Vol.</th>
                      {esEstacional && <th className="text-center px-2 py-1.5 font-medium">Tipo</th>}
                      {factores.map(f => (
                        <th key={f.campo} className="text-center px-1 py-1.5 font-medium leading-tight whitespace-nowrap" title={f.title}>
                          <span aria-hidden="true">{f.icon}</span><br />
                          <span className="text-[9px] text-slate-400 font-medium">{f.pct}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clientes.map((c, i) => <ClienteRow key={i} c={c} esEstacional={esEstacional} pais={pais} salud={salud} />)}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Tabla por país ────────────────────────────────────────────────────────────

function PaisSegTable({ p, segFiltro, dotacionFiltro, esEstacional, salud }: { p: PaisSegmentacion; segFiltro: SegFiltro; dotacionFiltro: 'todos' | 'con' | 'sin'; esEstacional: boolean; salud: SaludPorPanel }) {
  const kams = segFiltro === 'todos'
    ? p.kams
    : p.kams.filter(k => k.clientes.some(c => c.segmento === segFiltro));

  let tTotal = 0, tAP = 0, tA = 0, tB = 0, tC = 0, tVol = 0;
  kams.forEach(k => { tTotal += k.total; tAP += k.aPlus; tA += k.a; tB += k.b; tC += k.c; tVol += k.vol; });

  if (kams.length === 0) return <p className="text-xs text-slate-400 px-4 py-3">Sin KAMs con el filtro seleccionado.</p>;

  return (
    <div className="tabla-scroll">
      <table className="w-full text-sm tabla-apilable">
        <thead>
          <tr className="text-xs text-slate-400 bg-slate-50 border-b border-slate-100">
            <th className="text-left px-3 py-2 font-medium">Ejecutivo</th>
            <th className="text-right px-3 py-2 font-medium">Total</th>
            <th className="text-right px-3 py-2 font-medium" style={{ color: SEG_CFG['A+'].color }}>A+</th>
            <th className="text-right px-3 py-2 font-medium" style={{ color: SEG_CFG['A'].color }}>A</th>
            <th className="text-right px-3 py-2 font-medium" style={{ color: SEG_CFG['B'].color }}>B</th>
            <th className="text-right px-3 py-2 font-medium" style={{ color: SEG_CFG['C'].color }}>C</th>
            <th className="text-right px-3 py-2 font-medium">Vol.</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {kams.map((k, i) => <KamSegRow key={i} k={k} segFiltro={segFiltro} dotacionFiltro={dotacionFiltro} esEstacional={esEstacional} pais={p.pais} salud={salud} />)}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-sm">
            <td data-titular className="px-3 py-2 text-slate-500">TOTAL</td>
            <td data-label="Total" className="px-3 py-2 text-right tabular-nums text-slate-700">{tTotal}</td>
            <td data-label="A+" className="px-3 py-2 text-right tabular-nums" style={{ color: SEG_CFG['A+'].color }}>{tAP || '—'}</td>
            <td data-label="A" className="px-3 py-2 text-right tabular-nums" style={{ color: SEG_CFG['A'].color }}>{tA || '—'}</td>
            <td data-label="B" className="px-3 py-2 text-right tabular-nums" style={{ color: SEG_CFG['B'].color }}>{tB || '—'}</td>
            <td data-label="C" className="px-3 py-2 text-right tabular-nums" style={{ color: SEG_CFG['C'].color }}>{tC || '—'}</td>
            <td data-label="Vol." className="px-3 py-2 text-right tabular-nums text-slate-600">{fmtUSD(tVol)}</td>
            <td data-sin-etiqueta />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Transformar estacionales (Cache_Churn) → forma SegmentacionResponse ────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
/**
 * Lee el score del `scoreVNT` del caché. El GAS lo guarda como objeto completo en
 * los arrays de estacionales y como número suelto en otros, así que se toleran
 * las dos formas.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function leerVNT(v: any): number | undefined {
  if (typeof v === 'number') return v > 0 ? v : undefined;
  if (v && typeof v === 'object' && typeof v.score === 'number') return v.score > 0 ? v.score : undefined;
  return undefined;
}

function estacionalesAsSeg(churnData: any): SegmentacionResponse {
  const conteos: Record<Seg, number> = { 'A+': 0, A: 0, B: 0, C: 0 };
  const clientes: SegmentacionResponse['clientes'] = [];

  // Acá llega la salida de useCacheChurn, no el JSON crudo del caché: el hook ya
  // resolvió `periodo` y dejó los kams a nivel de país (en el crudo están en
  // paises[].periodo.kams). Por eso se lee p.kams y no p.periodo.kams.
  const paises: PaisSegmentacion[] = ((churnData.estacionales?.paises ?? []) as any[]).map((p: any) => {
    let pAP = 0, pA = 0, pB = 0, pC = 0, pVol = 0;

    const kams: KamSegmentacion[] = ((p.kams ?? []) as any[]).map((k: any) => {
      const todos: ClienteSegmentacion[] = [
        ...((k.clientesChurn ?? []) as any[]),
        ...((k.clientesRetenidos ?? []) as any[]),
      ].map((c: any) => {
        const score = Number(c.score ?? 0);
        const seg   = (score > 0 ? segFromScore(score) : (c.segmento ?? 'C')) as Seg;
        const vol = Number(c.segVol ?? c.volumen ?? 0);
        conteos[seg]++;
        pVol += vol;
        clientes.push({ cliente: c.empresa ?? '', kam: k.kam ?? '', pais: p.pais ?? '', segmento: seg, score, vol });
        return {
          // En estacionales `empresa` es la razón social, NO el panel: este objeto
          // no trae panel_id. Pero no hace falta cruzar nada, porque el score de
          // salud viene acá mismo en `scoreVNT` (objeto con .score en 1.471 de
          // 1.472 clientes).
          cliente: c.empresa ?? '', saludScore: leerVNT(c.scoreVNT), segmento: seg, score, vol,
          subSeg: c.subSeg ?? undefined,
          fVol:    c.segFVol    != null ? Number(c.segFVol)    : undefined,
          fProd:   c.segFProd   != null ? Number(c.segFProd)   : undefined,
          fMeses:  c.segFMeses  != null ? Number(c.segFMeses)  : undefined,
          fMargen: c.segFMargen != null ? Number(c.segFMargen) : undefined,
        };
      });
      let kAP = 0, kA = 0, kB = 0, kC = 0;
      todos.forEach(c => { if (c.segmento === 'A+') kAP++; else if (c.segmento === 'A') kA++; else if (c.segmento === 'B') kB++; else kC++; });
      pAP += kAP; pA += kA; pB += kB; pC += kC;
      // El volumen del KAM suma sus clientes estacionales; k.volumen es el total
      // de recurrentes y no corresponde a esta vista.
      const kVol = todos.reduce((s, c) => s + c.vol, 0);
      return { kam: k.kam ?? '', total: todos.length, aPlus: kAP, a: kA, b: kB, c: kC, vol: kVol, clientes: todos };
    });

    return { pais: p.pais ?? '', total: pAP + pA + pB + pC, aPlus: pAP, a: pA, b: pB, c: pC, vol: pVol, kams };
  });

  const total = paises.reduce((s, p) => s + p.total, 0);
  const vol   = paises.reduce((s, p) => s + p.vol, 0);
  return { clientes, conteos, globales: { total, vol }, paises, fechaCalculo: '' };
}

// ── SegmentacionTab ───────────────────────────────────────────────────────────

export function SegmentacionTab({ tipo = 'recurrentes' }: { tipo?: 'recurrentes' | 'estacionales' }) {
  const esEstacional = tipo === 'estacionales';

  const rec  = useCacheSegmentacion(!esEstacional);
  const churn = useCacheChurn();
  // Score de salud por país+nombre. Reusa la query de Cache_Churn, así que no
  // agrega ningún fetch: esa hoja ya viene en caché.
  const { salud } = useSaludPorPanel();

  const isLoading = esEstacional ? churn.isLoading : rec.isLoading;
  const isError   = esEstacional ? churn.isError   : rec.isError;
  const error     = esEstacional ? churn.error      : rec.error;

  const data: SegmentacionResponse | undefined = useMemo(() => {
    if (esEstacional) return churn.data ? estacionalesAsSeg(churn.data) : undefined;
    return rec.data;
  }, [esEstacional, churn.data, rec.data]);

  const [segFiltro, setSegFiltro] = useState<SegFiltro>('todos');
  // Dotación: productos de Colombia. Filtro de VISTA, no recalcula score ni volumen.
  const [dotacionFiltro, setDotacionFiltro] = useState<'todos' | 'con' | 'sin'>('todos');
  // Solo se dibuja el control si hay algo que filtrar: en el resto de los países
  // sería un botón muerto.
  const hayDotacion = useMemo(
    () => (data?.paises ?? []).some(p => (p.kams ?? []).some(k => (k.clientes ?? []).some(c => (c.dot ?? 0) > 0))),
    [data],
  );
  const [showScoreModal, setShowScoreModal] = useState(false);

  if (isLoading) return <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />;

  if (isError) return (
    <Card>
      <p className="text-red-500 text-sm text-center py-8 break-all">
        Error al cargar datos: {String((error as Error)?.message ?? error)}
      </p>
    </Card>
  );

  if (!data || data.clientes.length === 0) return (
    <Card>
      <div className="py-8 text-center">
        <p className="text-slate-500 text-sm font-medium">Sin datos de segmentación</p>
        <p className="text-slate-400 text-xs mt-2">
          {esEstacional
            ? 'Sin datos estacionales en Cache_Churn.'
            : <>Ejecutar <code className="bg-slate-100 px-1 rounded">generarCacheSegmentacion()</code> en GAS para generarla.</>}
        </p>
      </div>
    </Card>
  );

  const { conteos, globales, paises, fechaCalculo } = data;
  const total = globales.total || data.clientes.length;

  const SEG_OPTIONS: { value: SegFiltro; label: string }[] = [
    { value: 'todos', label: 'Todos' },
    { value: 'A+', label: 'A+' },
    { value: 'A', label: 'A' },
    { value: 'B', label: 'B' },
    { value: 'C', label: 'C' },
  ];

  return (
    <div className="flex flex-col gap-4">

      {/* 4 cards A+ / A / B / C */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(['A+', 'A', 'B', 'C'] as Seg[]).map(seg => {
          const cnt = seg === 'A+' ? conteos['A+'] : seg === 'A' ? conteos.A : seg === 'B' ? conteos.B : conteos.C;
          const cfg = SEG_CFG[seg];
          const pct = total > 0 ? (cnt / total * 100).toFixed(1) : '0.0';
          return (
            <div
              key={seg}
              className="rounded-2xl border px-5 pt-5 pb-3 text-center"
              style={{ background: cfg.bg, borderColor: cfg.border }}
            >
              <div className="text-3xl font-black leading-none" style={{ color: cfg.color }}>{seg}</div>
              <div className="text-2xl font-extrabold text-slate-900 tabular-nums mt-2">{cnt}</div>
              <div className="text-xs text-slate-500 font-semibold mt-1">{pct}% del total</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{cfg.desc}</div>
              <CountryBreakdown paises={paises} seg={seg} color={cfg.color} />
            </div>
          );
        })}
      </div>

      {/* Sub-línea: total + vol + fecha */}
      <p className="text-xs text-slate-400 px-1">
        {total} clientes {esEstacional ? 'estacionales' : 'recurrentes'} · Vol. total: {fmtUSD(globales.vol)}
        {fechaCalculo && ` · Calculado: ${fechaCalculo}`}
      </p>

      {/* Narrativa metodológica */}
      {showScoreModal && <SegInfoModal tipo={esEstacional ? 'estacionales' : 'recurrentes'} onClose={() => setShowScoreModal(false)} />}
      <div className="bg-sky-50 border-l-4 border-sky-400 rounded-r-xl px-4 py-3 text-xs text-slate-600 leading-relaxed flex items-start justify-between gap-4">
        <span>
          {esEstacional ? (
            <>Clientes <strong>estacionales</strong> clasificados por su score de riesgo de pérdida en el período actual.
            Segmentación basada en <strong>score estacional</strong> (comportamiento histórico por temporada). Montos en USD.</>
          ) : (
            <>Clientes <strong>recurrentes</strong> con compras en los <strong>últimos 12 meses</strong> — con 6+ meses de actividad,
            o 4–5 meses cuando sus 2 mayores meses concentran &lt;70% del volumen.
            Clasificación por <strong>Volumen</strong> (Pareto por país, 50%), <strong>Fee/SaaS</strong> (10%) y{' '}
            <strong>Engagement</strong> (abono + digital, 30%). Score máx 4.0. Montos en USD.</>
          )}
        </span>
        <button
          onClick={() => setShowScoreModal(true)}
          className="shrink-0 text-xs text-sky-600 hover:text-sky-800 underline underline-offset-2 whitespace-nowrap"
        >
          ¿Cómo se calcula el score?
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3">
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <FilterChips label="Segmento" value={segFiltro} onChange={setSegFiltro} options={SEG_OPTIONS} />
          {hayDotacion && (
            <>
              <FilterDivider />
              <FilterChips label="Dotación" value={dotacionFiltro} onChange={setDotacionFiltro}
                options={[
                  { value: 'todos', label: 'Todos' },
                  { value: 'con',   label: 'Con' },
                  { value: 'sin',   label: 'Sin' },
                ]} />
            </>
          )}
          <FilterDivider />
          <span className="text-slate-400 text-xs">{
            segFiltro === 'todos'
              ? `Mostrando ${total} clientes`
              : `Mostrando ${conteos[segFiltro as Seg]} clientes en segmento ${segFiltro}`
          }</span>
        </div>
      </div>

      {/* Acordeón por país */}
      {paises.map(p => {
        const filtTotal = segFiltro === 'todos' ? p.total
          : segFiltro === 'A+' ? p.aPlus : segFiltro === 'A' ? p.a : segFiltro === 'B' ? p.b : p.c;
        if (filtTotal === 0 && segFiltro !== 'todos') return null;

        return (
          <SaludPaisAccordion
            key={p.pais}
            pais={p.pais}
            count={p.total}
            scoreLabel=""
            defaultOpen={p.pais === 'Chile'}
          >
            <PaisSegTable p={p} segFiltro={segFiltro} dotacionFiltro={dotacionFiltro} esEstacional={esEstacional} salud={salud} />
          </SaludPaisAccordion>
        );
      })}
    </div>
  );
}
