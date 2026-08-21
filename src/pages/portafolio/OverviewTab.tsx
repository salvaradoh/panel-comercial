import { useMemo } from 'react';
import { useCacheChurn } from '../../hooks/useCacheChurn';
import { useOverview } from '../../hooks/useOverview';
import type { OverviewProbFuga, OverviewProductoMix } from '../../hooks/useOverview';
import { useReuniones } from '../../hooks/useReuniones';
import { EXEC_BY_PAIS } from '../../hooks/useUserRole';
import { Card } from '../../components/ui/Card';

// ── Metas Q3 2026 (fuente: propuesta-objetivos-agente-retencion.md) ───────────
const META_Q3: Record<string, { pctSaludable: number; score: number; pctRetencion: number; probFuga: number }> = {
  global:   { pctSaludable: 41, score: 3.00, pctRetencion: 90, probFuga: 23 },
  Chile:    { pctSaludable: 37, score: 3.22, pctRetencion: 89, probFuga: 23 },
  Colombia: { pctSaludable: 44, score: 3.22, pctRetencion: 113, probFuga: 23 },
  México:   { pctSaludable: 30, score: 3.22, pctRetencion: 65,  probFuga: 23 },
  Perú:     { pctSaludable: 40, score: 3.22, pctRetencion: 80,  probFuga: 23 },
};

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS = [
  { key: 'saludables', label: 'Saludable',  color: '#10b981', bg: '#ecfdf5', text: 'text-emerald-700' },
  { key: 'monitorear', label: 'Monitorear', color: '#3b82f6', bg: '#eff6ff', text: 'text-blue-700'    },
  { key: 'enRiesgo',   label: 'En riesgo',  color: '#f59e0b', bg: '#fffbeb', text: 'text-amber-700'   },
  { key: 'criticos',   label: 'Crítico',    color: '#ef4444', bg: '#fef2f2', text: 'text-red-700'     },
] as const;

// ── Formatters ─────────────────────────────────────────────────────────────────
function fmtPct(v: number)   { return v.toFixed(1) + '%'; }
function fmtScore(v: number) { return v.toFixed(2); }
function fmtUSD(v: number) {
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000)     return '$' + Math.round(v / 1_000) + 'K';
  return '$' + Math.round(v);
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function DeltaBadge({ actual, meta, invert = false }: { actual: number; meta: number; invert?: boolean }) {
  const diff = actual - meta;
  const good = invert ? diff <= 0 : diff >= 0;
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
      good ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
    }`}>
      {diff >= 0 ? '+' : ''}{diff.toFixed(1)} vs meta
    </span>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function StackedBar({ counts, total }: { counts: Record<string, number>; total: number }) {
  if (!total) return <div className="h-3 bg-slate-100 rounded-full" />;
  return (
    <div className="flex h-3 rounded-full overflow-hidden gap-px">
      {STATUS.map(s => {
        const pct = (counts[s.key] / total) * 100;
        if (pct < 0.5) return null;
        return (
          <div
            key={s.key}
            title={`${s.label}: ${fmtPct(pct)} (${counts[s.key]})`}
            style={{ width: `${pct}%`, background: s.color }}
          />
        );
      })}
    </div>
  );
}

interface KpiTileProps {
  label: string;
  value: string;
  sub?: string;
  desc?: string;
  color: string;
  bg: string;
  meta?: number;
  actual?: number;
  invert?: boolean;
}
function KpiTile({ label, value, sub, desc, color, bg, meta, actual, invert }: KpiTileProps) {
  return (
    <div className="rounded-2xl border p-4 flex flex-col gap-2" style={{ background: bg, borderColor: color + '33' }}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <span className="text-3xl font-bold tabular-nums" style={{ color }}>{value}</span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
      {meta !== undefined && actual !== undefined && (
        <DeltaBadge actual={actual} meta={meta} invert={invert} />
      )}
      {desc && <p className="text-[10px] text-slate-400 leading-relaxed border-t border-slate-100 pt-2 mt-0.5">{desc}</p>}
    </div>
  );
}

// ── Salud por país ─────────────────────────────────────────────────────────────
interface PaisStats {
  pais: string;
  total: number;
  saludables: number;
  monitorear: number;
  enRiesgo: number;
  criticos: number;
  scorePromedio: number;
  pctSaludable: number;
}

function PaisCard({ p }: { p: PaisStats }) {
  const meta = META_Q3[p.pais] ?? META_Q3.global;
  const diff = p.pctSaludable - meta.pctSaludable;
  const atMeta = diff >= 0;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{p.pais}</p>
          <p className="text-2xl font-bold tabular-nums text-slate-800 mt-0.5">{fmtPct(p.pctSaludable)}</p>
          <p className="text-[11px] text-slate-500">saludables · {p.total} clientes</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-400 mb-1">Meta Q3</p>
          <p className="text-base font-bold text-slate-600 tabular-nums">{meta.pctSaludable}%</p>
          <span className={`text-[10px] font-semibold ${atMeta ? 'text-emerald-600' : 'text-red-500'}`}>
            {diff >= 0 ? '+' : ''}{diff.toFixed(1)}pp
          </span>
        </div>
      </div>

      <div className="space-y-1">
        <ProgressBar value={p.pctSaludable} max={meta.pctSaludable} color={atMeta ? '#10b981' : '#f59e0b'} />
        <div className="flex justify-between text-[9px] text-slate-400">
          <span>0%</span>
          <span>Meta {meta.pctSaludable}%</span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
        <span className="text-[11px] text-slate-500">Score promedio</span>
        <span className={`text-sm font-bold tabular-nums ${
          p.scorePromedio >= 3.5 ? 'text-emerald-600' :
          p.scorePromedio >= 3.0 ? 'text-blue-600' :
          p.scorePromedio >= 2.0 ? 'text-amber-600' : 'text-red-600'
        }`}>{fmtScore(p.scorePromedio)}</span>
      </div>

      <StackedBar counts={{ saludables: p.saludables, monitorear: p.monitorear, enRiesgo: p.enRiesgo, criticos: p.criticos }} total={p.total} />
      <div className="flex gap-2.5 flex-wrap">
        {STATUS.map(s => {
          const count = { saludables: p.saludables, monitorear: p.monitorear, enRiesgo: p.enRiesgo, criticos: p.criticos }[s.key];
          if (!count) return null;
          return (
            <span key={s.key} className="text-[10px] text-slate-500 flex items-center gap-0.5">
              <span style={{ color: s.color }}>●</span> {count}
            </span>
          );
        })}
      </div>
    </Card>
  );
}

// ── Facturación vs. semestre anterior ───────────────────────────────────────────────────
function RetCard({ pais, pctRetencion, monto6m, monto6mAnt }: {
  pais: string; pctRetencion: number; monto6m: number; monto6mAnt: number;
}) {
  const meta = META_Q3[pais]?.pctRetencion ?? META_Q3.global.pctRetencion;
  const good = pctRetencion >= meta;
  const delta = pctRetencion - meta;
  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-xl border border-slate-100 bg-white">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{pais}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
          good ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
        }`}>
          {delta >= 0 ? '+' : ''}{delta.toFixed(1)}pp
        </span>
      </div>
      <div className="flex items-end gap-2">
        <span className={`text-xl font-bold tabular-nums ${good ? 'text-emerald-600' : 'text-amber-600'}`}>
          {fmtPct(pctRetencion)}
        </span>
        <span className="text-[10px] text-slate-400 mb-0.5" title="Mismo semestre del año anterior">vs 6m año ant.</span>
      </div>
      <ProgressBar value={Math.min(pctRetencion, 130)} max={130} color={good ? '#10b981' : '#f59e0b'} />
      <div className="flex justify-between text-[9px] text-slate-400 tabular-nums">
        <span>{fmtUSD(monto6m)}</span>
        <span>vs {fmtUSD(monto6mAnt)}</span>
      </div>
    </div>
  );
}

// ── Tasa de recuperación ───────────────────────────────────────────────────────
function RecupCard({ pais, recuperados, deteriorados, total, semanaActual, semanaAnt, onVer }: {
  pais: string; recuperados: number; deteriorados: number; total: number;
  semanaActual: string; semanaAnt: string;
  /** Abre el detalle en Clientes con el filtro de cambios ya aplicado */
  onVer?: (dir: 'mejoraron' | 'empeoraron' | 'cualquiera') => void;
}) {
  const pctRec  = total > 0 ? (recuperados  / total) * 100 : 0;
  const pctDet  = total > 0 ? (deteriorados / total) * 100 : 0;
  const netRec  = recuperados - deteriorados;
  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-xl border border-slate-100 bg-white">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{pais}</span>
        <span className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full ${
          netRec >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
        }`}>
          {netRec >= 0 ? '+' : ''}{netRec} neto
        </span>
      </div>
      <div className="flex gap-3">
        {/* Cada flecha abre el detalle de esos clientes en Clientes */}
        <button
          type="button"
          disabled={!onVer || recuperados === 0}
          onClick={() => onVer?.('mejoraron')}
          title={onVer ? `Ver los ${recuperados} clientes que mejoraron` : undefined}
          className="flex items-center gap-1 rounded-md px-1 -mx-1 enabled:hover:bg-emerald-50
                     enabled:active:scale-95 transition-all disabled:cursor-default"
        >
          <span className="text-emerald-500 text-base">↑</span>
          <span className="text-sm font-bold tabular-nums text-emerald-600">{recuperados}</span>
          <span className="text-[10px] text-slate-400">{fmtPct(pctRec)}</span>
        </button>
        <button
          type="button"
          disabled={!onVer || deteriorados === 0}
          onClick={() => onVer?.('empeoraron')}
          title={onVer ? `Ver los ${deteriorados} clientes que empeoraron` : undefined}
          className="flex items-center gap-1 rounded-md px-1 -mx-1 enabled:hover:bg-red-50
                     enabled:active:scale-95 transition-all disabled:cursor-default"
        >
          <span className="text-red-400 text-base">↓</span>
          <span className="text-sm font-bold tabular-nums text-red-500">{deteriorados}</span>
          <span className="text-[10px] text-slate-400">{fmtPct(pctDet)}</span>
        </button>
      </div>
      <p className="text-[9px] text-slate-400">{semanaAnt} → {semanaActual}</p>
    </div>
  );
}

// ── Mix de Productos ───────────────────────────────────────────────────────────
const CAT_COLORS: Record<string, string> = {
  'Puntos':      '#0097A7',
  'Gift Card':   '#8b5cf6',
  'SaaS':        '#3b82f6',
  'SuperCard':   '#f59e0b',
};
function ProductMixPanel({ data }: { data: OverviewProductoMix[] }) {
  if (!data || data.length === 0) return null;

  const ORDER = ['Chile', 'Colombia', 'Mexico', 'Peru', 'Ecuador'];
  const sorted = [...data].sort((a, b) => {
    const ai = ORDER.findIndex(p => a.pais.toLowerCase().includes(p.toLowerCase()));
    const bi = ORDER.findIndex(p => b.pais.toLowerCase().includes(p.toLowerCase()));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const allCats = Array.from(new Set(data.flatMap(d => d.categorias.map(c => c.nombre))));

  return (
    <Card>
      <div className="mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mix de Productos · Últimos 12 Meses</p>
        <p className="text-[10px] text-slate-400 mt-0.5">
          Distribución de revenue por categoría, por país. El monto de la derecha es el
          acumulado de <span className="font-medium text-slate-500">12 meses móviles</span> de ese país —
          no es comparable con el YTD del año en curso. Excluye Marketplace y productos sin categoría.
        </p>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
        {allCats.map(cat => (
          <span key={cat} className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
            <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: CAT_COLORS[cat] ?? '#94a3b8' }} />
            {cat}
          </span>
        ))}
      </div>

      {/* Filas por país.
          Antes el detalle iba en una columna de texto a la derecha con las dos
          primeras categorías y `truncate`: con cuatro categorías se perdían dos,
          y en México quedaba cortado. Ahora el porcentaje va dentro de su propio
          segmento —donde ya está el color que lo identifica— y a la derecha
          queda solo el total, que es corto y no se corta. */}
      <div className="flex flex-col gap-2.5">
        {sorted.map(row => (
          <div key={row.pais} className="flex items-center gap-3">
            <span className="text-[11px] text-slate-600 font-medium w-16 flex-shrink-0 truncate">
              {row.pais}
            </span>
            {/* El tooltip va en la fila completa, no solo en cada segmento: hay
                categorías de 1-2% que ocupan pocos píxeles y no se pueden apuntar
                con el mouse, así que su valor era inalcanzable. */}
            <div
              className="flex-1 flex h-6 rounded-md overflow-hidden gap-px"
              title={`${row.pais} — total 12m ${fmtUSD(row.total)}\n` +
                     row.categorias.map(c => `${c.nombre}: ${c.pct}% (${fmtUSD(c.vol)})`).join('\n')}
            >
              {row.categorias.map(cat => (
                <div
                  key={cat.nombre}
                  // Sin title propio: el del hijo tapa al del contenedor, y con
                  // segmentos de pocos píxeles el desglose completo quedaba
                  // inalcanzable. El tooltip de la fila cubre todas las categorías.
                  className="flex items-center justify-center overflow-hidden"
                  style={{ width: `${cat.pct}%`, background: CAT_COLORS[cat.nombre] ?? '#94a3b8' }}
                >
                  {/* Bajo ~9% no entra el texto sin desbordar; ahí queda el tooltip */}
                  {cat.pct >= 9 && (
                    <span className="text-[10px] font-semibold text-white tabular-nums leading-none">
                      {Math.round(cat.pct)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
            <span className="text-[10px] text-slate-400 w-14 flex-shrink-0 text-right tabular-nums">
              {fmtUSD(row.total)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Probabilidad de fuga (ML) ──────────────────────────────────────────────────
// Umbrales relativos a la meta Q3 (23%):
//   ≤ meta           → en camino (verde)
//   meta+1 a meta+8  → sobre meta, moderado (amarillo)
//   > meta+8         → alejado de meta (rojo)
function ProbFugaCard({ data }: { data: OverviewProbFuga }) {
  const meta  = META_Q3[data.pais]?.probFuga ?? META_Q3.global.probFuga;
  const delta = data.probFugaProm - meta;           // positivo = por encima de la meta (malo)
  const atMeta = delta <= 0;
  const level  = delta > 8 ? 'alto' : delta > 0 ? 'medio' : 'bajo';
  const color  = level === 'alto' ? '#ef4444' : level === 'medio' ? '#f59e0b' : '#10b981';

  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-xl border border-slate-100 bg-white">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{data.pais}</span>
        <span className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full ${
          atMeta ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
        }`}>
          {delta >= 0 ? '+' : ''}{delta.toFixed(1)}pp vs meta
        </span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-xl font-bold tabular-nums" style={{ color }}>{fmtPct(data.probFugaProm)}</span>
        <span className="text-[10px] text-slate-400 mb-0.5">prom.</span>
      </div>
      <ProgressBar value={data.probFugaProm} max={50} color={color} />
      <div className="flex justify-between text-[9px] text-slate-400">
        <span>{data.altaFuga} clientes ≥60%</span>
        <span>Meta Q3: {meta}%</span>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export function OverviewTab({ pais: filterPais, onVerCambios }: {
  pais?: string;
  onVerCambios?: (dir: 'mejoraron' | 'empeoraron' | 'cualquiera') => void;
} = {}) {
  const { data: churnData, isLoading: churnLoading } = useCacheChurn();
  const { data: overview, isLoading: overviewLoading } = useOverview();
  const now = new Date();
  const { data: reuniones } = useReuniones(now.getFullYear(), now.getMonth() + 1);

  // Usa p.resumen (fuente de verdad del GAS) en vez de sumar por KAM,
  // porque el array kams[] excluye "Otros" y causaría discrepancia.
  const allPaises: PaisStats[] = useMemo(() => {
    return (churnData?.recurrentes?.paises ?? []).map(p => {
      const r = p.resumen;
      const t  = r.total        ?? 0;
      const sa = r.saludables   ?? 0;
      const mo = r.monitorear   ?? 0;
      const ri = r.enRiesgo     ?? 0;
      const cr = r.criticos     ?? 0;
      const sc = r.scorePromedio ?? 0;
      return { pais: p.pais, total: t, saludables: sa, monitorear: mo, enRiesgo: ri, criticos: cr, scorePromedio: sc, pctSaludable: t > 0 ? (sa / t) * 100 : 0 };
    });
  }, [churnData]);

  // Cuando hay filtro de país usamos los datos de ese país; si no, los globales
  const paises = useMemo(
    () => filterPais ? allPaises.filter(p => p.pais === filterPais) : allPaises,
    [allPaises, filterPais]
  );

  const stats = useMemo(() => {
    if (!filterPais) {
      const g = churnData?.recurrentes?.globales;
      return {
        total:        g?.total        ?? 0,
        saludables:   g?.saludables   ?? 0,
        monitorear:   g?.monitorear   ?? 0,
        enRiesgo:     g?.enRiesgo     ?? 0,
        criticos:     g?.criticos     ?? 0,
        scorePromedio: g?.scorePromedio ?? 0,
      };
    }
    const p = paises[0];
    return p
      ? { total: p.total, saludables: p.saludables, monitorear: p.monitorear,
          enRiesgo: p.enRiesgo, criticos: p.criticos, scorePromedio: p.scorePromedio }
      : { total: 0, saludables: 0, monitorear: 0, enRiesgo: 0, criticos: 0, scorePromedio: 0 };
  }, [filterPais, paises, churnData]);

  const { total, saludables, monitorear, enRiesgo, criticos, scorePromedio } = stats;
  const pctSaludable = total > 0 ? (saludables / total) * 100 : 0;
  const pctRiesgo    = total > 0 ? ((enRiesgo + criticos) / total) * 100 : 0;

  const metaRef = filterPais ? (META_Q3[filterPais] ?? META_Q3.global) : META_Q3.global;

  // Cobertura de reuniones: clientes únicos con reunión / cartera total.
  // Las reuniones son virtuales, así que no se habla de "visitas".
  // Si hay filtro de país, solo se cuentan los KAMs de ese país
  const cobertura = useMemo(() => {
    if (!reuniones || !total) return null;
    const paisKams = filterPais ? new Set(EXEC_BY_PAIS[filterPais] ?? []) : null;
    const filtered = paisKams ? reuniones.filter(r => paisKams.has(r.nombre)) : reuniones;
    const conReunion = filtered.reduce((s, r) => s + r.mes, 0);
    return { conReunion, pct: total > 0 ? (conReunion / total) * 100 : 0 };
  }, [reuniones, total, filterPais]);

  const isLoading = churnLoading || overviewLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <span className="animate-spin w-5 h-5 rounded-full border-2 border-[#0097A7] border-t-transparent" />
      </div>
    );
  }

  if (!churnData) return null;

  // Datos de overview filtrados por país si aplica
  const facturacion = filterPais
    ? overview?.facturacion.filter(f => f.pais === filterPais) ?? []
    : overview?.facturacion ?? [];
  const recuperacion = filterPais
    ? overview?.recuperacion.filter(r => r.pais === filterPais) ?? []
    : overview?.recuperacion ?? [];
  const probFuga = filterPais
    ? overview?.probFuga.filter(p => p.pais === filterPais) ?? []
    : overview?.probFuga ?? [];
  const productosMix = filterPais
    ? overview?.productosMix?.filter(p => p.pais === filterPais) ?? []
    : overview?.productosMix ?? [];

  const scopeLabel = filterPais ?? 'Global';

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-slate-800">
          Scorecard — Salud de Cartera{filterPais ? ` · ${filterPais}` : ' · Global'}
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">Clientes recurrentes · Actualizado semanalmente · Metas Q3 2026</p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile
          label="% Saludables"
          value={fmtPct(pctSaludable)}
          sub={`${saludables} de ${total} clientes`}
          desc="Clientes recurrentes con score ≥ 3.5: activos, frecuentes y con tendencia positiva. Es el indicador principal de salud de cartera."
          color="#10b981" bg="#ecfdf5"
          actual={pctSaludable} meta={metaRef.pctSaludable}
        />
        <KpiTile
          label="Score promedio"
          value={fmtScore(scorePromedio)}
          sub="Escala 1.0 – 4.0"
          desc="Promedio de salud de todos los clientes, calculado semanalmente con base en frecuencia de compra, engagement en plataforma, satisfacción (NPS) y tendencia de gasto."
          color="#3b82f6" bg="#eff6ff"
          actual={scorePromedio} meta={metaRef.score}
        />
        <KpiTile
          label="En riesgo o crítico"
          value={fmtPct(pctRiesgo)}
          sub={`${enRiesgo + criticos} clientes`}
          desc="Clientes con señales de deterioro activo. Requieren acción inmediata del ejecutivo para evitar pérdida de facturación."
          color="#f59e0b" bg="#fffbeb"
          actual={pctRiesgo} meta={100 - metaRef.pctSaludable - 25} invert
        />
        {cobertura ? (
          <KpiTile
            label="Cobertura reuniones"
            value={fmtPct(cobertura.pct)}
            sub={`${cobertura.conReunion} clientes con reunión este mes`}
            desc="Porcentaje de la cartera con al menos una reunión registrada en el mes actual. Mayor cobertura se correlaciona con menor deterioro."
            color="#8b5cf6" bg="#f5f3ff"
          />
        ) : (
          <KpiTile
            label="Críticos"
            value={String(criticos)}
            sub={`${total > 0 ? ((criticos / total) * 100).toFixed(1) : 0}% de la cartera`}
            desc="Clientes con score < 2.0. Alta probabilidad de pérdida. Requieren intervención inmediata del KAM y seguimiento de dirección."
            color="#ef4444" bg="#fef2f2"
          />
        )}
      </div>

      {/* Distribución por status + Mix de Productos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <div className="mb-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Distribución por status — {scopeLabel}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Cómo está segmentada la cartera recurrente. Cada cliente tiene un status basado en su score semanal.</p>
          </div>
          <StackedBar counts={{ saludables, monitorear, enRiesgo, criticos }} total={total} />
          <div className="flex flex-wrap gap-4 mt-3">
            {STATUS.map(s => {
              const count = { saludables, monitorear, enRiesgo, criticos }[s.key];
              const pct   = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={s.key} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
                  <span className="text-xs text-slate-600">{s.label}</span>
                  <span className="text-xs font-bold tabular-nums text-slate-800">{fmtPct(pct)}</span>
                  <span className="text-[10px] text-slate-400">({count})</span>
                </div>
              );
            })}
          </div>
        </Card>

        <ProductMixPanel data={productosMix} />
      </div>

      {/* Cards por país — Salud (solo si hay más de uno o no hay filtro) */}
      {!filterPais && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Salud por país</p>
          <p className="text-[10px] text-slate-400 mt-0.5 mb-3">Clientes saludables vs meta Q3. El score promedio resume el nivel general de actividad, frecuencia de compra y satisfacción del cliente.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {paises.map(p => <PaisCard key={p.pais} p={p} />)}
          </div>
        </div>
      )}

      {/* Facturación vs. semestre anterior + Movimiento + Prob. fuga ML */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Facturación vs. semestre anterior */}
          <Card>
            <div className="mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Facturación vs. semestre anterior</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Compara lo que factura hoy la cartera contra lo que facturaba hace 6 meses. <span className="font-medium text-slate-500">100% = factura igual</span>; sobre 100% creció por sí sola, bajo 100% se perdió revenue aunque entren clientes nuevos.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {facturacion.map(f => (
                <RetCard
                  key={f.pais}
                  pais={f.pais}
                  pctRetencion={f.pctRetencion}
                  monto6m={f.monto6m}
                  monto6mAnt={f.monto6mAnt}
                />
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Monto de los últimos 6 meses dividido por el de los 6 anteriores{filterPais ? ` — ${filterPais}` : ', por país'}.</p>
          </Card>

          {/* Tasa de recuperación */}
          <Card>
            <div className="mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Movimiento de cartera · última semana</p>
              <p className="text-[10px] text-slate-400 mt-0.5">↑ Clientes que mejoraron de status (ej. en riesgo → monitorear). ↓ Clientes que empeoraron. El neto indica si la cartera avanza o retrocede semana a semana.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {recuperacion.map(r => (
                <RecupCard
                  key={r.pais}
                  pais={r.pais}
                  recuperados={r.recuperados}
                  deteriorados={r.deteriorados}
                  total={r.total}
                  semanaActual={r.semanaActual}
                  semanaAnt={r.semanaAnt}
                  onVer={onVerCambios}
                />
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              ↑ Mejoraron status · ↓ Empeoraron status vs semana anterior.
              {onVerCambios && (
                <>
                  {' '}
                  <button
                    onClick={() => onVerCambios('cualquiera')}
                    className="font-semibold text-[#0097A7] hover:underline active:scale-95 transition-transform"
                  >
                    Ver qué clientes cambiaron →
                  </button>
                </>
              )}
            </p>
          </Card>

          {/* Probabilidad de fuga — ML. Solo se muestra cuando la vista BQML tiene datos */}
          {probFuga.length > 0 && (
            <Card className="md:col-span-2">
              <div className="mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Probabilidad de fuga promedio · modelo ML</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  El modelo predictivo estima la probabilidad (0–100%) de que cada cliente deje de comprar en los próximos meses.
                  Un promedio más bajo es mejor. Baseline jul 2026: 24.3% global. Meta Q3 (sep 2026): reducir a 23%.
                  Los clientes con probabilidad ≥60% reciben alerta inmediata al ejecutivo.
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {probFuga.map(p => <ProbFugaCard key={p.pais} data={p} />)}
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                Predicción BQML sobre {probFuga.reduce((s, p) => s + p.n, 0)} clientes recurrentes{filterPais ? ` — ${filterPais}` : ''}.
              </p>
            </Card>
          )}

        </div>
      )}

    </div>
  );
}
