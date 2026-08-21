import { useState } from 'react';
import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import type { CanjesResponse } from '../../hooks/useCanjes';
import { usePaisesMensual } from '../../hooks/useMetas';
import type { MensualPoint } from '../../hooks/useMetas';

const MESES_SHORT = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const PAIS_ORDER = ['Chile', 'Perú', 'Colombia', 'México', 'Peru', 'Mexico'];
const FLAG_CC: Record<string, string> = {
  Chile: 'cl', Perú: 'pe', Peru: 'pe', Colombia: 'co', México: 'mx', Mexico: 'mx',
};
const PAISES_FILTER = [
  { key: 'LATAM', label: 'LATAM' },
  { key: 'Chile',    label: 'CL' },
  { key: 'Perú',    label: 'PE' },
  { key: 'Colombia', label: 'CO' },
  { key: 'México',   label: 'MX' },
  { key: 'Ecuador',  label: 'EC' },
];

interface MonthPoint {
  mes: string;
  avance: number;
  meta: number;
  acumulado: number;
  acumuladoAnt: number | null;
  avanceAnt: number;
  cierreAnt: number;
  cumplimientoPct: number | null;
  growthPct: number | null;
  yoyPct: number | null;
  isCurrent: boolean;
}

interface CumulativeRevenueChartProps {
  series: { time: string; value: number }[];
  anio: number;
  isLoading?: boolean;
  canjes?: CanjesResponse;
  canjesLoading?: boolean;
}

function fmtUSD(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function buildPoints(
  paisesMensual: Record<string, Record<string, MensualPoint>>,
  selectedPais: string,
  anio: number,
  currentMonthN: number,
): MonthPoint[] {
  const data: MonthPoint[] = [];
  let acumulado = 0;

  for (let mes = 1; mes <= 12; mes++) {
    const key = `${anio}-${mes - 1}`;
    let avance = 0;
    let meta = 0;

    let avanceAnt = 0;
    let cierreAnt = 0;
    if (selectedPais === 'LATAM') {
      for (const p of Object.keys(paisesMensual)) {
        avance    += paisesMensual[p][key]?.avance    ?? 0;
        meta      += paisesMensual[p][key]?.meta      ?? 0;
        avanceAnt += paisesMensual[p][key]?.avanceAnt ?? 0;
        cierreAnt += paisesMensual[p][key]?.cierreAnt ?? 0;
      }
    } else {
      avance    = paisesMensual[selectedPais]?.[key]?.avance    ?? 0;
      meta      = paisesMensual[selectedPais]?.[key]?.meta      ?? 0;
      avanceAnt = paisesMensual[selectedPais]?.[key]?.avanceAnt ?? 0;
      cierreAnt = paisesMensual[selectedPais]?.[key]?.cierreAnt ?? 0;
    }

    if (avance === 0 && meta === 0 && avanceAnt === 0) continue;
    const prevAvance = data.length > 0 ? data[data.length - 1].avance : 0;
    const prevAcumAnt = data.length > 0 ? (data[data.length - 1].acumuladoAnt ?? 0) : 0;
    acumulado += avance;
    // Criterio único en todo el panel: MISMO PERÍODO. La línea del año anterior
    // acumula `avanceAnt` (hasta la semana equivalente), igual que el % YoY de la
    // tarjeta de arriba, así los dos números coinciden.
    //
    // En los meses ya cerrados avanceAnt y cierreAnt son idénticos; solo difieren
    // en el mes en curso. Usar el cierre completo ahí comparaba un mes a medio
    // andar contra uno entero, y el resultado cambiaba según el día: el 1° del
    // mes daba el peor YoY del año y el último día el real.
    const acumuladoAnt = avanceAnt > 0 ? prevAcumAnt + avanceAnt : null;
    const cumplimientoPct = meta > 0 ? (avance / meta) * 100 : null;
    const growthPct = prevAvance > 0 ? ((avance - prevAvance) / prevAvance) * 100 : null;
    const yoyPct = avanceAnt > 0 ? ((avance - avanceAnt) / avanceAnt) * 100 : null;
    data.push({
      mes: MESES_SHORT[mes],
      avance, meta, avanceAnt, cierreAnt, acumulado, acumuladoAnt,
      cumplimientoPct, growthPct, yoyPct,
      isCurrent: mes === currentMonthN,
    });
  }
  return data;
}

function toQuarterPoints(monthly: MonthPoint[]): MonthPoint[] {
  const labels = ['Q1', 'Q2', 'Q3', 'Q4'];
  const result: MonthPoint[] = [];
  let acumulado = 0;
  for (let q = 0; q < 4; q++) {
    const slice = monthly.slice(q * 3, q * 3 + 3);
    if (slice.length === 0) break;
    const avance    = slice.reduce((s, m) => s + m.avance,    0);
    const meta      = slice.reduce((s, m) => s + m.meta,      0);
    const avanceAnt = slice.reduce((s, m) => s + m.avanceAnt, 0);
    const cierreAnt = slice.reduce((s, m) => s + m.cierreAnt, 0);
    const prevAvance   = result.length > 0 ? result[result.length - 1].avance : 0;
    const prevAcumAnt  = result.length > 0 ? (result[result.length - 1].acumuladoAnt ?? 0) : 0;
    acumulado += avance;
    // Mismo criterio que la vista mensual: período equivalente, no cierre completo
    const acumuladoAnt    = avanceAnt > 0 ? prevAcumAnt + avanceAnt : null;
    const cumplimientoPct = meta > 0 ? (avance / meta) * 100 : null;
    const growthPct       = prevAvance > 0 ? ((avance - prevAvance) / prevAvance) * 100 : null;
    const yoyPct          = avanceAnt > 0 ? ((avance - avanceAnt) / avanceAnt) * 100 : null;
    result.push({
      mes: labels[q],
      avance, meta, avanceAnt, cierreAnt, acumulado, acumuladoAnt,
      cumplimientoPct, growthPct, yoyPct,
      isCurrent: slice.some(m => m.isCurrent),
    });
  }
  return result;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d: MonthPoint = payload[0]?.payload;
  if (!d) return null;
  const cumplPct = d.cumplimientoPct;
  return (
    <div className="bg-white border border-slate-100 rounded-xl px-3 py-2.5 shadow-md text-xs min-w-[160px]">
      <p className="font-bold text-slate-700 mb-1.5">{label}{d.isCurrent ? ' · en curso' : ''}</p>
      <div className="flex justify-between gap-3">
        <span className="text-slate-400">Real</span>
        <span className="font-semibold tabular-nums text-slate-700">{fmtUSD(d.avance)}</span>
      </div>
      {d.meta > 0 && (
        <div className="flex justify-between gap-3">
          <span className="text-slate-400">Meta</span>
          <span className="font-semibold tabular-nums text-slate-500">{fmtUSD(d.meta)}</span>
        </div>
      )}
      <div className="flex justify-between gap-3">
        <span className="text-slate-400">Acumulado</span>
        <span className="font-semibold tabular-nums text-[#0097A7]">{fmtUSD(d.acumulado)}</span>
      </div>
      {(cumplPct !== null || d.yoyPct !== null) && (
        <div className="mt-1 pt-1 border-t border-slate-100 flex flex-col gap-0.5">
          {cumplPct !== null && (
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">Cumpl.</span>
              <span className={`font-bold tabular-nums ${cumplPct >= 100 ? 'text-emerald-600' : 'text-red-500'}`}>
                {cumplPct.toFixed(1)}%
              </span>
            </div>
          )}
          {d.yoyPct !== null && (
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">YoY</span>
              <span className={`font-bold tabular-nums ${d.yoyPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {d.yoyPct >= 0 ? '+' : ''}{d.yoyPct.toFixed(1)}% <span className="font-normal text-slate-300">({fmtUSD(d.avanceAnt)})</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GrowthLabel({ x, y, width, value }: any) {
  if (value === null || value === undefined) return null;
  const ok = value >= 0;
  return (
    <text x={(x ?? 0) + (width ?? 0) / 2} y={(y ?? 0) - 4} textAnchor="middle" fontSize={9} fontWeight="700"
      fill={ok ? '#10b981' : '#ef4444'}>
      {ok ? '+' : ''}{(value as number).toFixed(0)}%
    </text>
  );
}

function LastValueLabel({ viewBox, value }: any) {
  if (!viewBox || value === undefined) return null;
  return (
    <text x={viewBox.x + 6} y={viewBox.y - 6} fontSize={10} fontWeight="700" fill="#0097A7" textAnchor="start">
      {fmtUSD(value)}
    </text>
  );
}

function CanjesPanel({ canjes, loading }: { canjes?: CanjesResponse; loading?: boolean }) {
  if (loading) {
    return (
      <div className="mt-3 pt-3 border-t border-slate-100 animate-pulse">
        <div className="h-3 w-32 bg-slate-100 rounded mb-2" />
        <div className="flex gap-2">
          {[0, 1, 2, 3].map(i => <div key={i} className="flex-1 h-16 bg-slate-100 rounded-lg" />)}
        </div>
      </div>
    );
  }
  if (!canjes || Object.keys(canjes.byPais).length === 0) return null;
  const paises = PAIS_ORDER.filter(p => canjes.byPais[p]);
  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Top canjes del mes</p>
        <span className="text-[10px] text-slate-300 tabular-nums">{canjes.totalCanjes.toLocaleString()} total</span>
      </div>
      <div className="flex gap-1.5" style={{ height: 64 }}>
        {paises.map(pais => {
          const cc = FLAG_CC[pais];
          const items = canjes.byPais[pais] ?? [];
          if (!items[0]) return null;
          const maxCantidad = items[0].cantidad;
          return (
            <div key={pais} className="flex-1 min-w-0 bg-slate-50 rounded-lg px-2 py-2 flex flex-col">
              <div className="flex items-center gap-1 mb-1">
                {cc && <img src={`https://flagcdn.com/24x18/${cc}.png`} width={12} height={9} alt={pais} className="rounded-sm flex-shrink-0" />}
                <span className="text-[9px] font-semibold text-slate-500 truncate">{pais}</span>
              </div>
              <div className="flex items-end gap-1 flex-1">
                {items.slice(0, 3).map((item, i) => {
                  const pct = maxCantidad > 0 ? (item.cantidad / maxCantidad) * 100 : 0;
                  return (
                    <div key={item.giftcard} className="flex-1 rounded-sm cursor-default"
                      style={{ height: `${Math.max(pct, 8)}%`, backgroundColor: '#0097A7', opacity: 1 - i * 0.3 }}
                      title={`${item.giftcard}: ${item.cantidad} canjes`} />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CumulativeRevenueChart({ series: _fallback, anio, isLoading, canjes, canjesLoading }: CumulativeRevenueChartProps) {
  const [selectedPais, setSelectedPais] = useState('LATAM');
  const [granularity, setGranularity] = useState<'mes' | 'trimestre'>('mes');

  const paisesMensual = usePaisesMensual(anio);

  if (isLoading) {
    return <div className="bg-white rounded-2xl border border-slate-100 shadow-sm animate-pulse" style={{ flex: '1 1 280px', minWidth: 260, height: 300 }} />;
  }

  const currentMonthN = new Date().getMonth() + 1;
  const hasData = Object.keys(paisesMensual).length > 0;

  // Fallback a Cache_Series si Cache_Reporte aún no cargó
  const monthPoints = hasData
    ? buildPoints(paisesMensual, selectedPais, anio, currentMonthN)
    : _fallback.map((pt, i, arr) => {
        const d = new Date(pt.time + 'T12:00:00');
        const acum = arr.slice(0, i + 1).reduce((s, p) => s + p.value, 0);
        const prev = i > 0 ? arr[i - 1].value : 0;
        const growthPct = prev > 0 ? ((pt.value - prev) / prev) * 100 : null;
        return { mes: MESES_SHORT[d.getMonth() + 1], avance: pt.value, meta: 0, avanceAnt: 0, cierreAnt: 0, acumulado: acum, acumuladoAnt: null, cumplimientoPct: null, growthPct, yoyPct: null, isCurrent: d.getMonth() + 1 === currentMonthN };
      });

  const data = granularity === 'trimestre' ? toQuarterPoints(monthPoints) : monthPoints;

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center"
        style={{ flex: '1 1 280px', minWidth: 260, height: 300 }}>
        <p className="text-xs text-slate-300">Sin datos</p>
      </div>
    );
  }

  const maxAcumulado = Math.max(...data.map(d => d.acumulado));
  const maxAvance    = Math.max(...data.map(d => d.avance));
  const lastPoint    = data[data.length - 1];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col"
      style={{ flex: '1 1 280px', minWidth: 260 }}>

      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Avance Acumulativo {anio}</p>
        <div className="text-right">
          <p className="text-base font-bold tabular-nums text-[#0097A7] leading-tight">{fmtUSD(lastPoint.acumulado)}</p>
          <p className="text-[10px] text-slate-400">acumulado</p>
        </div>
      </div>

      {/* Leyenda + controles en una sola fila compacta */}
      <div className="flex items-center justify-between mb-2 gap-1.5">
        {/* Leyenda */}
        <div className="flex items-center gap-3 text-[10px] text-slate-400 flex-shrink-0">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-1.5 rounded-sm bg-[#0097A7] opacity-25 inline-block" />
            {granularity === 'mes' ? 'Mes' : 'Trim'}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-px bg-[#0097A7] inline-block" /> {anio}
          </span>
          <span className="flex items-center gap-1">
            <svg width="14" height="4" viewBox="0 0 14 4"><line x1="0" y1="2" x2="14" y2="2" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 2"/></svg>
            {anio - 1}
          </span>
        </div>

        {/* País pills */}
        <div className="flex items-center gap-0.5">
          {PAISES_FILTER.map(p => (
            <button key={p.key} onClick={() => setSelectedPais(p.key)}
              className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold transition-colors ${
                selectedPais === p.key ? 'bg-[#0097A7] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Toggle mes / trim */}
        <div className="flex items-center bg-slate-100 rounded-md p-0.5 flex-shrink-0">
          {(['mes', 'trimestre'] as const).map(g => (
            <button key={g} onClick={() => setGranularity(g)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors ${
                granularity === g ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}>
              {g === 'mes' ? 'Mes' : 'Trim'}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ minHeight: 160 }}>
        <ResponsiveContainer width="100%" height={160}>
          <ComposedChart data={data} margin={{ top: 22, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradAcum" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0097A7" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#0097A7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="acum" hide domain={[0, maxAcumulado * 1.2]} />
            <YAxis yAxisId="mes"  hide domain={[0, maxAvance * 4]} orientation="right" />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,151,167,0.04)' }} />
            <Area yAxisId="acum" type="monotone" dataKey="acumulado" stroke="none" fill="url(#gradAcum)" isAnimationActive={false} />
            <Bar yAxisId="mes" dataKey="avance" fill="#0097A7" fillOpacity={0.2} radius={[3, 3, 0, 0]} barSize={22} isAnimationActive={false}>
              <LabelList content={<GrowthLabel />} dataKey="growthPct" />
            </Bar>
            <Line
              yAxisId="acum" type="monotone" dataKey="acumuladoAnt"
              stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3"
              dot={false} activeDot={false} isAnimationActive={false}
              connectNulls={false}
            >
              <LabelList dataKey="acumuladoAnt" position="top" content={(props: any) => {
                const { value, viewBox, index } = props;
                if (value === null || value === undefined) return null;
                const isLast = !data.slice(index + 1).some((d: MonthPoint) => d.acumuladoAnt !== null);
                if (!isLast) return null;
                return (
                  <text x={(viewBox?.x ?? 0) + 6} y={(viewBox?.y ?? 0) - 6} fontSize={10} fontWeight="600" fill="#94a3b8" textAnchor="start">
                    {fmtUSD(value)}
                  </text>
                );
              }} />
            </Line>
            <Line
              yAxisId="acum" type="monotone" dataKey="acumulado"
              stroke="#0097A7" strokeWidth={2}
              dot={({ cx, cy, index }: any) =>
                index === data.length - 1
                  ? <circle key="last" cx={cx} cy={cy} r={4} fill="#0097A7" stroke="white" strokeWidth={2} />
                  : <circle key={index} cx={cx} cy={cy} r={2.5} fill="#0097A7" />
              }
              activeDot={{ r: 4, fill: '#0097A7', stroke: 'white', strokeWidth: 2 }}
              isAnimationActive={false}
            >
              <LabelList dataKey="acumulado" position="top" content={(props: any) => {
                if (props.index !== data.length - 1) return null;
                return <LastValueLabel viewBox={props.viewBox} value={props.value} />;
              }} />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Canjes — solo LATAM */}
      {selectedPais === 'LATAM' && (
        <CanjesPanel canjes={canjes} loading={canjesLoading} />
      )}
    </div>
  );
}
