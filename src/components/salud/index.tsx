import { useState } from 'react';

// ── Utilidades compartidas ────────────────────────────────────────────────────

export const FLAG_CC: Record<string, string> = {
  Chile: 'cl', Perú: 'pe', Peru: 'pe', Colombia: 'co',
  México: 'mx', Mexico: 'mx', Ecuador: 'ec',
};

export const SEG_COLOR: Record<string, string> = {
  'A+': '#16a34a', A: '#ca8a04', B: '#ea580c', C: '#dc2626',
};

export const SEG_BG: Record<string, string> = {
  'A+': '#f0fdf4', A: '#fefce8', B: '#fff7ed', C: '#fef2f2',
};

export function fmtUSD(v: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(v);
}

export function segOf(score: number): 'A+' | 'A' | 'B' | 'C' {
  return score >= 3.5 ? 'A+' : score >= 3.0 ? 'A' : score >= 2.0 ? 'B' : 'C';
}

// ── ScoreBadge ────────────────────────────────────────────────────────────────

export function ScoreBadge({ score, segmento }: { score: number; segmento: string }) {
  const color = SEG_COLOR[segmento] || '#9ca3af';
  const bg = SEG_BG[segmento] || '#f9fafb';
  return (
    <span
      className="inline-flex items-center justify-center rounded-lg px-2 py-0.5 text-xs font-bold tabular-nums"
      style={{ color, background: bg, border: `1px solid ${color}44`, minWidth: 36 }}
    >
      {score.toFixed(2)}
    </span>
  );
}

// ── SaludKPIRow ───────────────────────────────────────────────────────────────
// 3 metric cards con accent bar de color (% churn, alerta, vol).

export interface KPICard {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}

export function SaludKPIRow({ cards }: { cards: [KPICard, KPICard, KPICard] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((c, i) => {
        const color = c.color || '#dc2626';
        return (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="h-1 w-full" style={{ background: color }} />
            <div className="px-5 py-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{c.label}</p>
              <p className="text-3xl font-bold tabular-nums mt-1" style={{ color }}>{c.value}</p>
              {c.sub && <p className="text-xs text-slate-400 mt-1">{c.sub}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── SaludBucketCards ─────────────────────────────────────────────────────────
// 4 cards clickeables A+/A/B/C (Saludable/Monitorear/En Riesgo/Crítico).
// Idéntico visual a las cards de Segmentación.

export const BUCKET_CFG = {
  'A+': { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'A+', desc: 'Saludable'   },
  'A':  { color: '#ca8a04', bg: '#fefce8', border: '#fde68a', label: 'A',  desc: 'Monitorear'  },
  'B':  { color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', label: 'B',  desc: 'En Riesgo'   },
  'C':  { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'C',  desc: 'Crítico'     },
} as const;

export type BucketKey = 'todos' | 'A+' | 'A' | 'B' | 'C';

export interface BucketCounts { aPlus: number; a: number; b: number; c: number }

export function SaludBucketCards({
  counts, total, active, onSelect,
}: {
  counts: BucketCounts;
  total: number;
  active: BucketKey;
  onSelect: (v: BucketKey) => void;
}) {
  const buckets: { key: 'A+' | 'A' | 'B' | 'C'; count: number }[] = [
    { key: 'A+', count: counts.aPlus },
    { key: 'A',  count: counts.a },
    { key: 'B',  count: counts.b },
    { key: 'C',  count: counts.c },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {buckets.map(({ key, count }) => {
        const cfg = BUCKET_CFG[key];
        const pct = total > 0 ? (count / total * 100).toFixed(1) : '0.0';
        const isActive = active === key;
        return (
          <div
            key={key}
            onClick={() => onSelect(isActive ? 'todos' : key)}
            className="rounded-2xl border p-5 text-center cursor-pointer transition-all hover:scale-[1.02] active:scale-100"
            style={{
              background: cfg.bg,
              borderColor: isActive ? cfg.color : cfg.border,
              boxShadow: isActive ? `0 0 0 2px ${cfg.color}` : undefined,
            }}
          >
            <div className="text-3xl font-black leading-none" style={{ color: cfg.color }}>{cfg.label}</div>
            <div className="text-2xl font-extrabold text-slate-900 tabular-nums mt-2">{count}</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">{pct}% del total</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{cfg.desc}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── SaludToolbar ──────────────────────────────────────────────────────────────
// Fila 1: buscador + botón score.  Fila 2: children = chips de filtro.

interface SaludToolbarProps {
  search: string;
  onSearch: (v: string) => void;
  onScoreInfo: () => void;
  children?: React.ReactNode;
}

export function SaludToolbar({ search, onSearch, onScoreInfo, children }: SaludToolbarProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Buscar empresa..."
            value={search}
            onChange={e => onSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0097A7] focus:border-[#0097A7]"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">🔍</span>
        </div>
        <button
          onClick={onScoreInfo}
          className="text-xs text-slate-500 hover:text-[#0097A7] border border-slate-200 rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap"
        >
          ¿Cómo se calcula el score?
        </button>
      </div>
      {children && (
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          {children}
        </div>
      )}
    </div>
  );
}

// ── FilterChips ───────────────────────────────────────────────────────────────
// Grupo de chips de un filtro (label + opciones).

interface FilterChipsProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  color?: string;
}

export function FilterChips<T extends string>({
  label, options, value, onChange, color = '#0097A7',
}: FilterChipsProps<T>) {
  return (
    <>
      <span className="text-slate-400 font-semibold uppercase tracking-wide mr-0.5">{label}:</span>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1 rounded-lg border transition-all active:scale-95 ${
            value === opt.value
              ? 'text-white font-semibold'
              : 'bg-white border-slate-200 text-slate-600'
          }`}
          style={value === opt.value ? { background: color, borderColor: color } : { borderColor: undefined }}
          onMouseEnter={e => { if (value !== opt.value) (e.currentTarget as HTMLButtonElement).style.borderColor = color; }}
          onMouseLeave={e => { if (value !== opt.value) (e.currentTarget as HTMLButtonElement).style.borderColor = ''; }}
        >
          {opt.label}
        </button>
      ))}
    </>
  );
}

// ── FilterDivider ─────────────────────────────────────────────────────────────

export function FilterDivider() {
  return <div className="w-px h-4 bg-slate-200 mx-1" />;
}

// ── SaludPaisAccordion ────────────────────────────────────────────────────────
// Acordeón de país: header con bandera, nombre, count, score badge.
// children = contenido de la tabla.

interface SaludPaisAccordionProps {
  pais: string;
  count: number;
  score?: number;
  scoreLabel: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function SaludPaisAccordion({
  pais, count, score, scoreLabel, defaultOpen = false, children,
}: SaludPaisAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const cc = FLAG_CC[pais];
  const seg = score ? segOf(score) : undefined;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
        onClick={() => setIsOpen(v => !v)}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          {cc && (
            <img
              src={`https://flagcdn.com/24x18/${cc}.png`}
              width={22} height={16} alt={pais}
              className="rounded-sm"
            />
          )}
          <span className="font-bold text-slate-800 uppercase tracking-wide">{pais}</span>
          <span className="text-xs text-slate-400">{count} clientes</span>
        </div>
        <div className="flex items-center gap-3">
          {score && seg && <ScoreBadge score={score} segmento={seg} />}
          {score && <span className="text-slate-400 text-xs font-medium">{scoreLabel}</span>}
          <span className="text-slate-400">{isOpen ? '▲' : '▼'}</span>
        </div>
      </button>

      {isOpen && (
        <div className="overflow-x-auto border-t border-slate-100">
          {children}
        </div>
      )}
    </div>
  );
}

// ── ScoreInfoModal ────────────────────────────────────────────────────────────

const TH = 'bg-[#1a1a2e] text-white px-3 py-2 text-left font-bold text-[11px]';
const TH_C = 'bg-[#1a1a2e] text-white px-3 py-2 text-center font-bold text-[11px]';
const TD = 'px-3 py-2 border-b border-slate-100 text-[11px]';
const TD_C = 'px-3 py-2 border-b border-slate-100 text-center text-[11px]';
const SEC = 'text-[15px] font-extrabold text-[#146787] mb-3 pl-3 border-l-4 border-[#B2A8E7]';

function Seg({ color, name, range, note }: { color: string; name: string; range: string; note?: string }) {
  const map: Record<string, string> = {
    red:    'bg-red-50 border-red-200 text-red-600',
    orange: 'bg-orange-50 border-orange-200 text-orange-600',
    amber:  'bg-amber-50 border-amber-200 text-amber-600',
    green:  'bg-green-50 border-green-200 text-emerald-700',
  };
  return (
    <div className={`rounded-xl border px-3 py-3 text-center ${map[color]}`}>
      <div className="text-[13px] font-bold">{name}</div>
      <div className="text-[11px] font-semibold text-slate-500 mt-1">{range}</div>
      {note && <div className="text-[10px] text-slate-400 mt-1">{note}</div>}
    </div>
  );
}

function ScoreRentContent() {
  return (
    <>
      <div className="px-7 pb-0 pt-6 border-b-4 border-purple-700 mb-5">
        <button className="sr-only" />
        <span className="inline-block text-[10px] font-bold tracking-widest uppercase text-purple-700 bg-purple-50 px-3 py-1 rounded-full mb-3">Salud del cliente</span>
        <h2 className="text-[22px] font-extrabold text-[#1a1a2e] leading-tight mb-2">Recencia, Engagement y Tendencia</h2>
        <p className="text-[13px] text-slate-600 leading-relaxed mb-4">
          Mide la <strong>salud de la relación comercial</strong> con clientes recurrentes (≥4 compras/año). Escala 1–4 donde <strong>mayor puntaje = cliente más saludable</strong>.
        </p>
      </div>

      <div className="px-7 py-5 space-y-6">
        {/* 1. Variables */}
        <div>
          <h3 className={SEC}>1. Variables utilizadas</h3>
          <div className="tabla-scroll">
            <table className="w-full border-collapse text-[12px] rounded-lg overflow-hidden">
              <thead><tr><th className={TH}>Variable</th><th className={TH_C}>Peso</th><th className={TH}>Descripción</th></tr></thead>
              <tbody>
                <tr><td className={`${TD} font-semibold`}>Recencia (R)</td><td className={`${TD_C} font-bold`}>35%</td><td className={TD + ' text-slate-500'}>Días sin comprar en relación a su ritmo habitual (TBP). Mayor puntaje = compra más reciente.</td></tr>
                <tr className="bg-slate-50"><td className={`${TD} font-semibold`}>Engagement (E)</td><td className={`${TD_C} font-bold`}>25%</td><td className={TD + ' text-slate-500'}>Score del Churn Semanal (0–9, mayor = más saludable). Sin datos→E=4, ≥5→E=3, ≥3→E=2, &lt;3→E=1.</td></tr>
                <tr><td className={`${TD} font-semibold`}>NPS (N)</td><td className={`${TD_C} font-bold`}>15%</td><td className={TD + ' text-slate-500'}>Satisfacción del cliente (NPS 0–10). Sin respuesta: dimensión excluida y pesos R/E/T se redistribuyen a 40/30/30.</td></tr>
                <tr className="bg-slate-50"><td className="px-3 py-2 text-[12px] font-semibold">Tendencia (T)</td><td className="px-3 py-2 text-[12px] text-center font-bold">25%</td><td className="px-3 py-2 text-[12px] text-slate-500">Variación del volumen: últimos 6m vs el mismo semestre del año anterior.</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 2. Criterios */}
        <div>
          <h3 className={SEC}>2. Criterios de puntuación (escala 1–4)</h3>
          <div className="tabla-scroll">
            <table className="w-full border-collapse text-[11.5px] rounded-lg overflow-hidden">
              <thead><tr>
                <th className={TH}>Variable</th>
                <th className="bg-[#1a1a2e] text-emerald-400 px-3 py-2 text-center font-bold text-[11px]">4 — Excelente</th>
                <th className="bg-[#1a1a2e] text-amber-400 px-3 py-2 text-center font-bold text-[11px]">3 — Bueno</th>
                <th className="bg-[#1a1a2e] text-orange-400 px-3 py-2 text-center font-bold text-[11px]">2 — Riesgo</th>
                <th className="bg-[#1a1a2e] text-red-400 px-3 py-2 text-center font-bold text-[11px]">1 — Crítico</th>
              </tr></thead>
              <tbody>
                {[
                  ['Recencia (R)', 'ratio ≤ 0.5\nCompró hace poco', 'ratio ≤ 1.0\nDentro de su ciclo', 'ratio ≤ 2.0\n1–2 ciclos de retraso', 'ratio > 2.0\n2+ ciclos sin comprar'],
                  ['Engagement (E)', 'Sin señales\nAbono y login OK', '1 señal leve\nInactividad 14–30d', '2–3 señales\nAbono + login atrasados', '3+ señales severas\nAlto valor + inactivo'],
                  ['NPS (N)', '9–10\nPromotor', '7–8\nPasivo', '5–6\nDetractor leve', '0–4\nDetractor'],
                  ['Tendencia (T)', '+20% o más\nCreciendo', '±20%\nEstable', '-20% a -50%\nCayendo', '-50% o más\nCaída severa'],
                ].map(([v, c4, c3, c2, c1], i) => {
                  const Cell = ({ val, color }: { val: string; color: string }) => {
                    const [main, sub] = val.split('\n');
                    return <td className={`px-3 py-2 border-b border-slate-100 text-center text-[11.5px] font-bold ${color}`}>{main}{sub && <><br/><span className="font-normal text-slate-400 text-[10px]">{sub}</span></>}</td>;
                  };
                  return (
                    <tr key={v} className={i % 2 === 1 ? 'bg-slate-50' : ''}>
                      <td className="px-3 py-2 border-b border-slate-100 text-[11.5px] font-semibold">{v}</td>
                      <Cell val={c4} color="text-emerald-600" />
                      <Cell val={c3} color="text-amber-500" />
                      <Cell val={c2} color="text-orange-500" />
                      <Cell val={c1} color="text-red-500" />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Intervalos R */}
        <div>
          <h3 className={SEC}>3. Intervalos detallados por variable</h3>
          <p className="text-[12px] font-bold text-slate-700 mb-2">Recencia (R) — ratio = días sin comprar ÷ TBP</p>
          <div className="tabla-scroll">
            <table className="w-full border-collapse text-[11px] rounded-lg overflow-hidden mb-4">
              <thead><tr><th className={TH}>Qué significa</th><th className={TH_C}>ratio</th><th className={TH_C}>R</th><th className={TH}>Ejemplo (TBP = 30d)</th></tr></thead>
              <tbody>
                <tr className="bg-green-50"><td className={TD}>Compra reciente, dentro de su ritmo</td><td className={TD_C}>≤ 0.5</td><td className="px-3 py-2 border-b border-slate-100 text-center font-extrabold text-emerald-600">4</td><td className={TD + ' text-slate-400'}>Lleva 15 días → R=4</td></tr>
                <tr><td className={TD}>Dentro de su ciclo habitual</td><td className={TD_C}>≤ 1.0</td><td className="px-3 py-2 border-b border-slate-100 text-center font-extrabold text-amber-500">3</td><td className={TD + ' text-slate-400'}>Lleva 28 días → R=3</td></tr>
                <tr className="bg-orange-50/40"><td className={TD}>Fuera de ciclo, retraso leve</td><td className={TD_C}>≤ 2.0</td><td className="px-3 py-2 border-b border-slate-100 text-center font-extrabold text-orange-500">2</td><td className={TD + ' text-slate-400'}>Lleva 45 días → R=2</td></tr>
                <tr className="bg-red-50/40"><td className="px-3 py-2 text-[11px]">2+ ciclos sin comprar</td><td className="px-3 py-2 text-center text-[11px]">{'>'}2.0</td><td className="px-3 py-2 text-center font-extrabold text-red-500">1</td><td className="px-3 py-2 text-[11px] text-slate-400">Lleva 90 días → R=1</td></tr>
              </tbody>
            </table>
          </div>

          <p className="text-[12px] font-bold text-slate-700 mb-2">Engagement (E) — abono + actividad digital</p>
          <div className="tabla-scroll">
            <table className="w-full border-collapse text-[11px] rounded-lg overflow-hidden mb-4">
              <thead><tr><th className={TH_C}>Churn Semanal (0–9)</th><th className={TH_C}>E</th><th className={TH}>Interpretación</th></tr></thead>
              <tbody>
                <tr className="bg-green-50"><td className="px-3 py-2 border-b border-slate-100 text-center font-bold text-emerald-600">sin datos</td><td className="px-3 py-2 border-b border-slate-100 text-center font-extrabold text-emerald-600">4</td><td className={TD}>Sin riesgo — abono y login al día</td></tr>
                <tr><td className={TD_C + ' font-bold text-amber-500'}>≥ 5</td><td className={TD_C + ' font-extrabold text-amber-500'}>3</td><td className={TD}>Riesgo leve — señal temprana aislada</td></tr>
                <tr className="bg-orange-50/40"><td className={TD_C + ' font-bold text-orange-500'}>≥ 3</td><td className={TD_C + ' font-extrabold text-orange-500'}>2</td><td className={TD}>Riesgo moderado — señales combinadas</td></tr>
                <tr className="bg-red-50/40"><td className="px-3 py-2 text-center text-[11px] font-bold text-red-500">{'<'} 3</td><td className="px-3 py-2 text-center font-extrabold text-red-500">1</td><td className="px-3 py-2 text-[11px]">Riesgo alto — múltiples señales severas</td></tr>
              </tbody>
            </table>
          </div>

          <p className="text-[12px] font-bold text-slate-700 mb-2">NPS (N) — satisfacción del cliente (0–10)</p>
          <div className="tabla-scroll">
            <table className="w-full border-collapse text-[11px] rounded-lg overflow-hidden mb-4">
              <thead><tr><th className={TH}>Categoría</th><th className={TH_C}>Score</th><th className={TH_C}>N</th></tr></thead>
              <tbody>
                <tr className="bg-green-50"><td className={TD}>Promotor — recomienda activamente</td><td className={TD_C}>9–10</td><td className="px-3 py-2 border-b border-slate-100 text-center font-extrabold text-emerald-600">4</td></tr>
                <tr><td className={TD}>Pasivo — satisfecho pero no comprometido</td><td className={TD_C}>7–8</td><td className={TD_C + ' font-extrabold text-amber-500'}>3</td></tr>
                <tr className="bg-orange-50/40"><td className={TD}>Detractor leve</td><td className={TD_C}>5–6</td><td className={TD_C + ' font-extrabold text-orange-500'}>2</td></tr>
                <tr className="bg-red-50/40"><td className="px-3 py-2 text-[11px]">Detractor — riesgo de fuga</td><td className="px-3 py-2 text-center text-[11px]">0–4</td><td className="px-3 py-2 text-center font-extrabold text-red-500">1</td></tr>
              </tbody>
            </table>
          </div>

          <p className="text-[12px] font-bold text-slate-700 mb-2">Tendencia (T) — últimos 6m vs el mismo semestre del año anterior</p>
          <div className="tabla-scroll">
            <table className="w-full border-collapse text-[11px] rounded-lg overflow-hidden mb-3">
              <thead><tr><th className={TH}>Qué significa</th><th className={TH_C}>Variación</th><th className={TH_C}>T</th></tr></thead>
              <tbody>
                <tr className="bg-green-50"><td className={TD}>Creciendo</td><td className={TD_C}>{'>'}+20%</td><td className="px-3 py-2 border-b border-slate-100 text-center font-extrabold text-emerald-600">4</td></tr>
                <tr><td className={TD}>Estable</td><td className={TD_C}>±20%</td><td className={TD_C + ' font-extrabold text-amber-500'}>3</td></tr>
                <tr className="bg-orange-50/40"><td className={TD}>Cayendo</td><td className={TD_C}>-20% a -50%</td><td className={TD_C + ' font-extrabold text-orange-500'}>2</td></tr>
                <tr className="bg-red-50/40"><td className="px-3 py-2 text-[11px]">Caída severa — posible migración o abandono</td><td className="px-3 py-2 text-center text-[11px]">{'<'}-50%</td><td className="px-3 py-2 text-center font-extrabold text-red-500">1 *</td></tr>
              </tbody>
            </table>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-[11px] text-slate-600 leading-relaxed">
            <strong className="text-blue-700">* Filtro de impacto absoluto:</strong> Un cliente que cayó {'>'}50% pero cuya pérdida real es menor a $1,000 USD recibe T=2 en lugar de T=1, evitando penalizar cuentas pequeñas por fluctuaciones estadísticas (análisis de 794 clientes: cuentas &lt;$5K tienen stddev del 2,674%).
          </div>
        </div>

        {/* Fórmula */}
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-[13px] font-bold text-purple-900 leading-relaxed">
          Score RENT = R × 0.35 + E × 0.25 + N × 0.15 + T × 0.25<br/>
          <span className="font-normal text-[12px] text-slate-500">Sin NPS: R × 0.40 + E × 0.30 + T × 0.30 · Rango resultante: 1.00 – 4.00 · Mayor = más saludable</span>
        </div>

        {/* Estado del cliente */}
        <div>
          <h3 className={SEC}>4. Estado del cliente</h3>
          <div className="grid grid-cols-4 gap-2">
            <Seg color="red"    name="Crítico"    range="Score < 2.0"    note="Recuperación urgente" />
            <Seg color="orange" name="En Riesgo"  range="2.0 – 2.99"    note="Contactar esta semana" />
            <Seg color="amber"  name="Monitorear" range="3.0 – 3.49"    note="Seguimiento mensual" />
            <Seg color="green"  name="Saludable"  range="≥ 3.5"         note="Relación activa" />
          </div>
        </div>

        {/* Glosario */}
        <div>
          <h3 className={SEC}>5. Glosario</h3>
          <div className="grid text-[11.5px] text-slate-500 leading-relaxed gap-y-1" style={{ gridTemplateColumns: '110px 1fr' }}>
            <strong className="text-slate-700">TBP</strong><span>Time Between Purchases — intervalo promedio entre compras. Si tiene ≥3 compras en 12 meses, usa ritmo reciente (365 ÷ compras del año). Mínimo: 30 días.</span>
            <strong className="text-slate-700">R (Recencia)</strong><span>ratio = días sin comprar ÷ TBP. Valores 1–4: ratio ≤0.5→4, ≤1.0→3, ≤2.0→2, {'>'}2.0→1.</span>
            <strong className="text-slate-700">E (Engagement)</strong><span>Actividad de abono y plataforma. Sin datos→E=4, score ≥5→E=3, score ≥3→E=2, score &lt;3→E=1.</span>
            <strong className="text-slate-700">T (Tendencia)</strong><span>Variación del monto: últimos 6m vs el mismo semestre del <strong>año anterior</strong>. {'>'} +20%→4, ±20%→3, -20% a -50%→2, &lt; -50%→1. Se compara año contra año porque el segundo semestre factura 49% más que el primero y comparar semestres consecutivos metía un sesgo estacional.</span>
            <strong className="text-slate-700">Recurrente</strong><span>Cliente con ≥4 compras por año. Solo este tipo es evaluado con el puntaje de salud RENT.</span>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl px-4 py-3 text-[12px] text-slate-500 leading-relaxed mb-2">
          Pasa el cursor sobre cualquier score en la tabla para ver el desglose R/E/N/T de ese cliente.
        </div>
      </div>
    </>
  );
}

function ScoreVentContent() {
  return (
    <>
      <div className="px-7 pb-0 pt-6 border-b-4 border-violet-600 mb-5">
        <span className="inline-block text-[10px] font-bold tracking-widest uppercase text-violet-700 bg-violet-50 px-3 py-1 rounded-full mb-3">Salud del cliente — Estacionales</span>
        <h2 className="text-[22px] font-extrabold text-[#1a1a2e] leading-tight mb-2">Score VENT — Vigencia · Engagement · NPS · Tendencia</h2>
        <p className="text-[13px] text-slate-600 leading-relaxed mb-4">
          Mide la <strong>salud del ciclo de compra</strong> de clientes estacionales. Escala 1–4 donde <strong>mayor puntaje = cliente más saludable</strong>.
        </p>
      </div>

      <div className="px-7 py-5 space-y-6">
        {/* 1. Variables */}
        <div>
          <h3 className="text-[15px] font-extrabold text-[#146787] mb-3 pl-3 border-l-4 border-violet-300">1. Variables y pesos</h3>
          <div className="tabla-scroll">
            <table className="w-full border-collapse text-[12px] rounded-lg overflow-hidden">
              <thead><tr><th className={TH}>Variable</th><th className={TH_C}>Peso base</th><th className={TH}>Descripción</th></tr></thead>
              <tbody>
                <tr><td className={`${TD} font-semibold`}>V — Vigencia</td><td className={`${TD_C} font-bold`}>35%</td><td className={TD + ' text-slate-500'}>¿Está el cliente activo en su ciclo? Mide si compró (o está próximo a comprar) en su ventana estacional.</td></tr>
                <tr className="bg-slate-50"><td className={`${TD} font-semibold`}>E — Engagement</td><td className={`${TD_C} font-bold`}>25%</td><td className={TD + ' text-slate-500'}>Actividad de abono y plataforma digital post-compra. Sin datos → E=4 neutro.</td></tr>
                <tr><td className={`${TD} font-semibold`}>N — NPS</td><td className={`${TD_C} font-bold`}>15%</td><td className={TD + ' text-slate-500'}>Puntaje de satisfacción (Net Promoter Score). Sin respuesta → peso redistribuido entre V, E y T.</td></tr>
                <tr className="bg-slate-50"><td className="px-3 py-2 text-[12px] font-semibold">T — Tendencia YoY</td><td className="px-3 py-2 text-[12px] text-center font-bold">25%</td><td className="px-3 py-2 text-[12px] text-slate-500">Variación del volumen en su ventana de ciclo vs. el año anterior. Nulo si el ciclo está a más de 1 mes.</td></tr>
              </tbody>
            </table>
          </div>
          <div className="text-[11px] text-slate-500 mt-2 bg-violet-50 rounded-lg px-3 py-2">
            <strong>Sin NPS:</strong> V×40% + E×30% + T×30%. <strong>Sin T:</strong> V×47% + E×33% + N×20%. <strong>Sin ambas:</strong> V×57% + E×43%.
          </div>
        </div>

        {/* 2. Criterios */}
        <div>
          <h3 className="text-[15px] font-extrabold text-[#146787] mb-3 pl-3 border-l-4 border-violet-300">2. Criterios de puntuación (1–4)</h3>
          <div className="tabla-scroll">
            <table className="w-full border-collapse text-[11.5px] rounded-lg overflow-hidden">
              <thead><tr>
                <th className={TH}>Variable</th>
                <th className="bg-[#1a1a2e] text-emerald-400 px-3 py-2 text-center font-bold text-[11px]">4</th>
                <th className="bg-[#1a1a2e] text-amber-400 px-3 py-2 text-center font-bold text-[11px]">3</th>
                <th className="bg-[#1a1a2e] text-orange-400 px-3 py-2 text-center font-bold text-[11px]">2</th>
                <th className="bg-[#1a1a2e] text-red-400 px-3 py-2 text-center font-bold text-[11px]">1</th>
              </tr></thead>
              <tbody>
                {[
                  ['V (Vigencia)', 'Compró en ciclo', 'Ciclo próximo\n≥ 2 meses', 'En ciclo / perdió 1', 'Perdió 2+ ciclos'],
                  ['E (Engagement)', 'Sin señales\nAbono y login OK', 'Riesgo leve\nInactividad 14–30d', 'Señales combinadas\nAbono + login atrasados', 'Múltiples severas\nAbono + login + 0 logins'],
                  ['N (NPS)', 'Promotor\n9–10', 'Pasivo\n7–8', 'Detractor\n5–6', 'Det. severo\n< 5'],
                  ['T (Tendencia)', 'Creciendo\n> +20%', 'Estable\n±20%', 'Cayendo\n-20% a -50%', 'Caída severa\n> -50%'],
                ].map(([v, c4, c3, c2, c1], i) => {
                  const Cell = ({ val, color }: { val: string; color: string }) => {
                    const [main, sub] = val.split('\n');
                    return <td className={`px-3 py-2 border-b border-slate-100 text-center text-[11.5px] font-bold ${color}`}>{main}{sub && <><br/><span className="font-normal text-slate-400 text-[10px]">{sub}</span></>}</td>;
                  };
                  return (
                    <tr key={v} className={i % 2 === 1 ? 'bg-slate-50' : ''}>
                      <td className="px-3 py-2 border-b border-slate-100 text-[11.5px] font-semibold">{v}</td>
                      <Cell val={c4} color="text-emerald-600" />
                      <Cell val={c3} color="text-amber-500" />
                      <Cell val={c2} color="text-orange-500" />
                      <Cell val={c1} color="text-red-500" />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Intervalos */}
        <div>
          <h3 className="text-[15px] font-extrabold text-[#146787] mb-3 pl-3 border-l-4 border-violet-300">3. Intervalos detallados</h3>

          <p className="text-[12px] font-bold text-slate-700 mb-2">Vigencia (V) — estado respecto a su ciclo estacional</p>
          <div className="tabla-scroll">
            <table className="w-full border-collapse text-[11px] rounded-lg overflow-hidden mb-4">
              <thead><tr><th className={TH}>Situación</th><th className={TH_C}>V</th></tr></thead>
              <tbody>
                <tr className="bg-green-50"><td className={TD}>Compró en ventana de ciclo (mes_pico ±1 mes) en el año actual</td><td className="px-3 py-2 border-b border-slate-100 text-center font-extrabold text-emerald-600">4</td></tr>
                <tr><td className={TD}>Ciclo próximo (≥ 2 meses hasta mes_pico) y compró en año anterior</td><td className={TD_C + ' font-extrabold text-amber-500'}>3</td></tr>
                <tr className="bg-orange-50/40"><td className={TD}>En ventana de ciclo pero no compró aún, o no compró en ciclo anterior</td><td className={TD_C + ' font-extrabold text-orange-500'}>2</td></tr>
                <tr className="bg-red-50/40"><td className="px-3 py-2 text-[11px]">No compró en ciclo actual ni en el anterior — 2+ ciclos perdidos</td><td className="px-3 py-2 text-center font-extrabold text-red-500">1</td></tr>
              </tbody>
            </table>
          </div>

          <p className="text-[12px] font-bold text-slate-700 mb-2">Engagement (E) — engScore acumulado (0–5+)</p>
          <div className="tabla-scroll">
            <table className="w-full border-collapse text-[11px] rounded-lg overflow-hidden mb-4">
              <thead><tr><th className={TH_C}>engScore</th><th className={TH_C}>E</th><th className={TH}>Interpretación</th></tr></thead>
              <tbody>
                <tr className="bg-green-50"><td className="px-3 py-2 border-b border-slate-100 text-center font-bold text-emerald-600">0 / sin datos</td><td className="px-3 py-2 border-b border-slate-100 text-center font-extrabold text-emerald-600">4</td><td className={TD}>Sin riesgo — abono y login al día</td></tr>
                <tr><td className={TD_C + ' font-bold text-amber-500'}>1–2</td><td className={TD_C + ' font-extrabold text-amber-500'}>3</td><td className={TD}>Riesgo leve — señal temprana aislada</td></tr>
                <tr className="bg-orange-50/40"><td className={TD_C + ' font-bold text-orange-500'}>3–4</td><td className={TD_C + ' font-extrabold text-orange-500'}>2</td><td className={TD}>Riesgo moderado — señales combinadas</td></tr>
                <tr className="bg-red-50/40"><td className="px-3 py-2 text-center text-[11px] font-bold text-red-500">≥ 5</td><td className="px-3 py-2 text-center font-extrabold text-red-500">1</td><td className="px-3 py-2 text-[11px]">Riesgo alto — múltiples señales severas</td></tr>
              </tbody>
            </table>
          </div>

          <p className="text-[12px] font-bold text-slate-700 mb-2">NPS (N) y Tendencia (T)</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="tabla-scroll">
              <table className="border-collapse text-[11px] rounded-lg overflow-hidden">
                <thead><tr><th className={TH}>NPS (0–10)</th><th className={TH_C}>N</th></tr></thead>
                <tbody>
                  <tr className="bg-green-50"><td className={TD}>9–10 Promotor</td><td className="px-3 py-2 border-b border-slate-100 text-center font-extrabold text-emerald-600">4</td></tr>
                  <tr><td className={TD}>7–8 Pasivo</td><td className={TD_C + ' font-extrabold text-amber-500'}>3</td></tr>
                  <tr className="bg-orange-50/40"><td className={TD}>5–6 Detractor</td><td className={TD_C + ' font-extrabold text-orange-500'}>2</td></tr>
                  <tr className="bg-red-50/40"><td className="px-3 py-2 text-[11px]">0–4 Det. severo</td><td className="px-3 py-2 text-center font-extrabold text-red-500">1</td></tr>
                </tbody>
              </table>
            </div>
            <div className="tabla-scroll">
              <table className="border-collapse text-[11px] rounded-lg overflow-hidden">
                <thead><tr><th className={TH}>Variación YoY</th><th className={TH_C}>T</th></tr></thead>
                <tbody>
                  <tr className="bg-green-50"><td className={TD}>{'>'}+20% Creciendo</td><td className="px-3 py-2 border-b border-slate-100 text-center font-extrabold text-emerald-600">4</td></tr>
                  <tr><td className={TD}>±20% Estable</td><td className={TD_C + ' font-extrabold text-amber-500'}>3</td></tr>
                  <tr className="bg-orange-50/40"><td className={TD}>-20% a -50%</td><td className={TD_C + ' font-extrabold text-orange-500'}>2</td></tr>
                  <tr className="bg-red-50/40"><td className="px-3 py-2 text-[11px]">{'<'}-50% Severa</td><td className="px-3 py-2 text-center font-extrabold text-red-500">1</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 4. Ciclo estacional */}
        <div>
          <h3 className="text-[15px] font-extrabold text-[#146787] mb-3 pl-3 border-l-4 border-violet-300">4. El ciclo estacional</h3>
          <p className="text-[12px] text-slate-500 leading-relaxed mb-3">
            El <strong>ciclo</strong> de cada cliente es su mes de mayor compra en 2025 (<em>mes_pico</em>), con una ventana de ±1 mes. Se calcula desde <code className="bg-slate-100 px-1 rounded">Tabla_Analisis_Clientes</code>.
          </p>
          <div className="tabla-scroll">
            <table className="w-full border-collapse text-[11px] rounded-lg overflow-hidden">
              <thead><tr><th className={TH}>Situación del ciclo</th><th className={TH_C}>T incluida</th><th className={TH_C}>Pesos activos</th></tr></thead>
              <tbody>
                <tr className="bg-green-50"><td className={TD}>Ciclo abierto (≤ 1 mes hasta mes_pico)</td><td className={TD_C + ' text-emerald-600 font-bold'}>✓ Sí</td><td className={TD_C}>V×45% + N×20% + T×35%</td></tr>
                <tr><td className="px-3 py-2 text-[11px]">Ciclo lejano ({'>'} 1 mes) o sin ref. 2025</td><td className="px-3 py-2 text-center text-[11px] text-slate-400 font-bold">✗ Nulo</td><td className="px-3 py-2 text-center text-[11px]">V×56% + N×44% (o solo V)</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Fórmula */}
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-[13px] font-bold text-purple-900 leading-relaxed">
          Score VENT = V × 0.35 + E × 0.25 + N × 0.15 + T × 0.25<br/>
          <span className="font-normal text-[12px] text-slate-500">Sin NPS: V × 0.40 + E × 0.30 + T × 0.30 · Rango resultante: 1.00 – 4.00 · Mayor = más saludable</span>
        </div>

        {/* Segmentos */}
        <div>
          <h3 className="text-[15px] font-extrabold text-[#146787] mb-3 pl-3 border-l-4 border-violet-300">5. Segmentos</h3>
          <div className="grid grid-cols-4 gap-2">
            <Seg color="red"    name="Crítico"    range="Score < 2.0"  note="Recuperación urgente" />
            <Seg color="orange" name="En Riesgo"  range="2.0 – 2.99"  note="Contactar esta semana" />
            <Seg color="amber"  name="Monitorear" range="3.0 – 3.49"  note="Seguimiento mensual" />
            <Seg color="green"  name="Saludable"  range="≥ 3.5"       note="Ciclo activo y creciendo" />
          </div>
        </div>

        {/* Glosario */}
        <div>
          <h3 className="text-[15px] font-extrabold text-[#146787] mb-3 pl-3 border-l-4 border-violet-300">6. Glosario</h3>
          <div className="grid text-[11.5px] text-slate-500 leading-relaxed gap-y-1" style={{ gridTemplateColumns: '120px 1fr' }}>
            <strong className="text-slate-700">mes_pico</strong><span>Mes de mayor volumen de compra en 2025. Define el ciclo estacional del cliente.</span>
            <strong className="text-slate-700">Ventana ±1 mes</strong><span>El cliente se considera "en ciclo" si la fecha actual está dentro de 1 mes antes o después de su mes_pico.</span>
            <strong className="text-slate-700">V (Vigencia)</strong><span>¿Compró en su ciclo? 4=compró este año, 3=ciclo próximo, 2=en ventana sin compra o perdió 1 ciclo, 1=perdió 2+ ciclos.</span>
            <strong className="text-slate-700">E (Engagement)</strong><span>engScore acumulado de señales de abono y login. 0/sin datos→4, 1–2→3, 3–4→2, ≥5→1.</span>
            <strong className="text-slate-700">T (Tendencia)</strong><span>Variación YoY del volumen en ventana del ciclo. Solo disponible cuando el ciclo está abierto (≤1 mes).</span>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl px-4 py-3 text-[12px] text-slate-500 leading-relaxed mb-2">
          Pasa el cursor sobre cualquier score para ver el desglose V/E/N/T de ese cliente.
        </div>
      </div>
    </>
  );
}

export function ScoreInfoModal({ tipo, onClose }: { tipo: 'vent' | 'rent'; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-5" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl alto-modal overflow-y-auto relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-5 grid place-items-center w-10 h-10 sm:block sm:w-auto sm:h-auto bg-transparent border-none text-[22px] text-slate-400 hover:text-slate-600 cursor-pointer z-10"
        >✕</button>
        {tipo === 'vent' ? <ScoreVentContent /> : <ScoreRentContent />}
      </div>
    </div>
  );
}

// ── SegInfoModal (Segmentación) ───────────────────────────────────────────────

const STH  = 'bg-slate-100 text-slate-600 px-3 py-2 text-left font-bold text-[11px]';
const STH_C = 'bg-slate-100 text-slate-600 px-3 py-2 text-center font-bold text-[11px]';
const STD  = 'px-3 py-2 border-b border-slate-100 text-[11px] text-slate-600';
const STD_C = 'px-3 py-2 border-b border-slate-100 text-center text-[11px] text-slate-600';
const SSEC = 'text-[13px] font-extrabold text-[#0369a1] mb-2 pl-3 border-l-4 border-[#0369a1]';

function SegCards() {
  return (
    <div className="grid grid-cols-4 gap-2">
      {([['A+','≥ 3.50','#16a34a','#f0fdf4','#bbf7d0'],['A','3.00–3.49','#ca8a04','#fefce8','#fde68a'],['B','2.00–2.99','#ea580c','#fff7ed','#fed7aa'],['C','1.00–1.99','#dc2626','#fef2f2','#fecaca']] as const).map(([seg, rng, color, bg, border]) => (
      <div key={seg} className="rounded-xl p-3 text-center border" style={{ background: bg, borderColor: border }}>
        <div className="text-[22px] font-black" style={{ color }}>{seg}</div>
        <div className="text-[10px] font-semibold text-slate-500 mt-1">{rng}</div>
      </div>
    ))}
    </div>
  );
}

function SegRecContent() {
  return (
    <div className="p-7 space-y-5">
      <div className="pb-4 border-b-4 border-sky-600">
        <span className="inline-block text-[10px] font-bold tracking-widest uppercase text-sky-700 bg-sky-50 px-3 py-1 rounded-full mb-3">Segmentación de cliente</span>
        <h2 className="text-[20px] font-extrabold text-[#1a1a2e] mb-2">Segmentación de cliente</h2>
        <p className="text-[12.5px] text-slate-600 leading-relaxed">
          Clasifica clientes recurrentes según su relevancia económica y constancia de compra durante los últimos 12 meses.
        </p>
      </div>

      <div>
        <h3 className={SSEC}>1. Clasificación: Cliente Recurrente</h3>
        <div className="bg-sky-50 rounded-xl p-3 text-[12px] text-slate-600 leading-relaxed">
          Cliente <strong>recurrente</strong> si cumple alguna de estas condiciones:<br/>
          • Compra en <strong>6 o más meses distintos</strong> en los últimos 12 meses, <em>o</em><br/>
          • Compra en <strong>4 o 5 meses</strong>, pero sus 2 meses de mayor compra concentran <strong>&lt;70%</strong> del volumen anual.
        </div>
      </div>

      <div>
        <h3 className={SSEC}>2. Score (variables activas)</h3>
        <div className="tabla-scroll">
          <table className="w-full border-collapse text-[12px] rounded-lg overflow-hidden mb-2">
            <thead><tr><th className={STH}>Variable</th><th className={STH_C}>Peso</th><th className={STH}>Criterio</th></tr></thead>
            <tbody>
              <tr><td className={STD}>Volumen de compra</td><td className={STD_C + ' font-bold'}>50%</td><td className={STD}>Pareto por contribución acumulada de ventas (últimos 12m)</td></tr>
              <tr className="bg-slate-50"><td className={STD}>Meses con compra</td><td className={STD_C + ' font-bold'}>20%</td><td className={STD}>Meses distintos con compra en 12m</td></tr>
              <tr><td className={STD}>Usuarios incentivados</td><td className={STD_C + ' font-bold'}>20%</td><td className={STD}>Percentil por país (solo entre empresas con usuarios &gt; 0)</td></tr>
              <tr className="bg-slate-50"><td className="px-3 py-2 text-[11px] text-slate-600">Fee / SaaS (12m USD)</td><td className="px-3 py-2 text-center text-[11px] font-bold text-slate-600">10%</td><td className="px-3 py-2 text-[11px] text-slate-600">{'>'}$5k=4 · $1k–$5k=3 · &lt;$1k=2 · sin fee=1</td></tr>
            </tbody>
          </table>
        </div>
        <div className="bg-green-50 rounded-lg px-3 py-2 text-[11px] text-green-800 font-medium">
          Score = (Volumen × 0.50) + (Meses × 0.20) + (Usuarios × 0.20) + (Fee × 0.10) · Máx: 4.0
        </div>
      </div>

      <div>
        <h3 className={SSEC}>3. Puntos por variable (escala 1–4)</h3>
        <div className="tabla-scroll">
          <table className="w-full border-collapse text-[11px] rounded-lg overflow-hidden">
            <thead><tr><th className={STH}>Variable</th><th className={STH_C}>4 pts</th><th className={STH_C}>3 pts</th><th className={STH_C}>2 pts</th><th className={STH_C}>1 pt</th></tr></thead>
            <tbody>
              <tr><td className={STD + ' font-medium'}>Volumen</td><td className={STD_C}>Acumula ≤50% vol.</td><td className={STD_C}>50–75%</td><td className={STD_C}>75–90%</td><td className={STD_C}>{'>'}90%</td></tr>
              <tr className="bg-slate-50"><td className={STD + ' font-medium'}>Meses compra</td><td className={STD_C}>10–12</td><td className={STD_C}>8–9</td><td className={STD_C}>6–7</td><td className={STD_C}>4–5</td></tr>
              <tr><td className={STD + ' font-medium'}>Usuarios incentivados</td><td className={STD_C}>Top 50% país</td><td className={STD_C}>Sig. 25%</td><td className={STD_C}>Sig. 15%</td><td className={STD_C}>Último 10% · 0 usu.</td></tr>
              <tr className="bg-slate-50"><td className="px-3 py-2 text-[11px] text-slate-600 font-medium">Fee / SaaS</td><td className={STD_C}>{'>'}$5,000</td><td className={STD_C}>$1k–$5k</td><td className={STD_C}>&lt;$1,000</td><td className="px-3 py-2 text-center text-[11px] text-slate-600">Sin fee</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className={SSEC}>4. Estado del cliente</h3>
        <SegCards />
      </div>
    </div>
  );
}

function SegEstContent() {
  return (
    <div className="p-7 space-y-5">
      <div className="pb-4 border-b-4 border-sky-600">
        <span className="inline-block text-[10px] font-bold tracking-widest uppercase text-sky-700 bg-sky-50 px-3 py-1 rounded-full mb-3">Clientes Estacionales</span>
        <h2 className="text-[20px] font-extrabold text-[#1a1a2e] mb-2">Score Estacional</h2>
        <p className="text-[12.5px] text-slate-600 leading-relaxed">
          Clasifica clientes estacionales (1–3 meses al año) según su valor estratégico. Escala 1–4 donde <strong>mayor puntaje = cliente más valioso</strong>.
        </p>
      </div>

      <div>
        <h3 className={SSEC}>1. Clasificación: Cliente Estacional</h3>
        <div className="bg-sky-50 rounded-xl p-3 text-[12px] text-slate-600 leading-relaxed mb-2">
          Cliente <strong>estacional</strong> si en los últimos 13 meses:<br/>
          • Compra en <strong>1–3 meses distintos</strong>, <em>o</em><br/>
          • Compra en <strong>4–5 meses</strong> y sus 2 meses de mayor compra concentran <strong>≥70%</strong> del volumen anual.
        </div>
        <div className="text-[11.5px] text-slate-500 leading-relaxed">
          Los filtros de tipo distinguen:<br/>
          • <strong>Estacional</strong> — ≥ 2 compras en historial total<br/>
          • <strong>1ra Compra</strong> — primera transacción en toda la historia del cliente
        </div>
      </div>

      <div>
        <h3 className={SSEC}>2. Variables utilizadas</h3>
        <div className="tabla-scroll">
          <table className="w-full border-collapse text-[12px] rounded-lg overflow-hidden mb-2">
            <thead><tr><th className={STH}>Variable</th><th className={STH_C}>Peso</th><th className={STH}>Criterio</th></tr></thead>
            <tbody>
              <tr><td className={STD}>Volumen (V)</td><td className={STD_C + ' font-bold'}>50%</td><td className={STD}>Percentil de facturación vs. estacionales del mismo país</td></tr>
              <tr className="bg-slate-50"><td className={STD}>Producto (P)</td><td className={STD_C + ' font-bold'}>25%</td><td className={STD}>Categoría dominante por volumen (SaaS = mayor margen)</td></tr>
              <tr><td className={STD}>Meses (M)</td><td className={STD_C + ' font-bold'}>12.5%</td><td className={STD}>Meses distintos con compra en últimos 13m</td></tr>
              <tr className="bg-slate-50"><td className="px-3 py-2 text-[11px] text-slate-600">Margen (Mg)</td><td className="px-3 py-2 text-center text-[11px] font-bold text-slate-600">12.5%</td><td className="px-3 py-2 text-[11px] text-slate-600">Mix de productos ponderado por rentabilidad</td></tr>
            </tbody>
          </table>
        </div>
        <div className="bg-green-50 rounded-lg px-3 py-2 text-[11px] text-green-800 font-medium">
          Score = (V × 0.50) + (P × 0.25) + (M × 0.125) + (Mg × 0.125) · Máx: 4.0
        </div>
      </div>

      <div>
        <h3 className={SSEC}>3. Puntos por variable (escala 1–4)</h3>
        <div className="tabla-scroll">
          <table className="w-full border-collapse text-[11px] rounded-lg overflow-hidden">
            <thead><tr><th className={STH}>Variable</th><th className={STH_C}>4 pts</th><th className={STH_C}>3 pts</th><th className={STH_C}>2 pts</th><th className={STH_C}>1 pt</th></tr></thead>
            <tbody>
              <tr><td className={STD + ' font-medium'}>Volumen</td><td className={STD_C}>Top 50% país</td><td className={STD_C}>Top 25–50%</td><td className={STD_C}>Top 10–25%</td><td className={STD_C}>Bottom 10%</td></tr>
              <tr className="bg-slate-50"><td className={STD + ' font-medium'}>Producto</td><td className={STD_C}>SaaS</td><td className={STD_C}>Puntos</td><td className={STD_C}>SuperCard</td><td className={STD_C}>GiftCard</td></tr>
              <tr><td className={STD + ' font-medium'}>Meses</td><td className={STD_C}>4+ meses</td><td className={STD_C}>3 meses</td><td className={STD_C}>2 meses</td><td className={STD_C}>1 mes</td></tr>
              <tr className="bg-slate-50"><td className="px-3 py-2 text-[11px] text-slate-600 font-medium">Margen</td><td className={STD_C}>≥ 40%</td><td className={STD_C}>20–40%</td><td className={STD_C}>8–20%</td><td className="px-3 py-2 text-center text-[11px] text-slate-600">&lt; 8%</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className={SSEC}>4. Clasificación por score</h3>
        <SegCards />
        <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
          ⚠ El percentil de volumen se calcula por país — el mismo monto puede tener distinto score entre países.
        </p>
      </div>
    </div>
  );
}

export function SegInfoModal({ tipo, onClose }: { tipo: 'estacionales' | 'recurrentes'; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-5" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl alto-modal overflow-y-auto relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-5 grid place-items-center w-10 h-10 sm:block sm:w-auto sm:h-auto bg-transparent border-none text-[22px] text-slate-400 hover:text-slate-600 cursor-pointer z-10"
        >✕</button>
        {tipo === 'estacionales' ? <SegEstContent /> : <SegRecContent />}
      </div>
    </div>
  );
}
