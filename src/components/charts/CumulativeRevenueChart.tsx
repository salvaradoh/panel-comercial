import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import type { CanjesResponse } from '../../hooks/useCanjes';

const MESES_SHORT = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const PAIS_ORDER = ['Chile', 'Perú', 'Colombia', 'México', 'Peru', 'Mexico'];
const FLAG_CC: Record<string, string> = {
  Chile: 'cl', Perú: 'pe', Peru: 'pe', Colombia: 'co', México: 'mx', Mexico: 'mx',
};

interface MonthPoint {
  mes: string;
  avance: number;
  acumulado: number;
  variacionPct: number | null;
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

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl px-3 py-2.5 shadow-md text-xs min-w-[150px]">
      <p className="font-bold text-slate-700 mb-1.5">{label}{d.isCurrent ? ' · en curso' : ''}</p>
      <div className="flex justify-between gap-3">
        <span className="text-slate-400">Mes</span>
        <span className="font-semibold tabular-nums text-slate-700">{fmtUSD(d.avance)}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-slate-400">Acumulado</span>
        <span className="font-semibold tabular-nums text-[#0097A7]">{fmtUSD(d.acumulado)}</span>
      </div>
      {d.variacionPct !== null && d.variacionPct !== undefined && (
        <div className="flex justify-between gap-3 mt-1 pt-1 border-t border-slate-100">
          <span className="text-slate-400">vs mes ant.</span>
          <span className={`font-bold tabular-nums ${d.variacionPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {d.variacionPct >= 0 ? '+' : ''}{d.variacionPct.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}

function VariationLabel({ x, y, width, value }: any) {
  if (value === null || value === undefined) return null;
  const positive = value >= 0;
  return (
    <text x={x + width / 2} y={y - 5} textAnchor="middle" fontSize={9} fontWeight="700"
      fill={positive ? '#10b981' : '#ef4444'}>
      {positive ? '+' : ''}{value.toFixed(0)}%
    </text>
  );
}

function LastValueLabel({ viewBox, value }: any) {
  if (!viewBox || value === undefined) return null;
  const { x, y } = viewBox;
  return (
    <text x={x + 6} y={y - 6} fontSize={10} fontWeight="700" fill="#0097A7" textAnchor="start">
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
    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col flex-1">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Top canjes del mes</p>
        <span className="text-[10px] text-slate-300 tabular-nums">{canjes.totalCanjes.toLocaleString()} total</span>
      </div>

      {/* Países en horizontal, crecen para llenar el espacio */}
      <div className="flex gap-1.5 flex-1">
        {paises.map(pais => {
          const cc = FLAG_CC[pais];
          const items = canjes.byPais[pais] ?? [];
          if (!items[0]) return null;
          const maxCantidad = items[0].cantidad;

          return (
            <div key={pais} className="flex-1 min-w-0 bg-slate-50 rounded-lg px-2 py-2 flex flex-col">
              {/* Flag + país */}
              <div className="flex items-center gap-1 mb-1.5">
                {cc && <img src={`https://flagcdn.com/24x18/${cc}.png`} width={12} height={9} alt={pais} className="rounded-sm flex-shrink-0" />}
                <span className="text-[9px] font-semibold text-slate-500 truncate">{pais}</span>
              </div>

              {/* Barras verticales — crecen con el espacio disponible */}
              <div className="flex items-end gap-1 flex-1 min-h-[40px]">
                {items.slice(0, 3).map((item, i) => {
                  const pct = maxCantidad > 0 ? (item.cantidad / maxCantidad) * 100 : 0;
                  return (
                    <div
                      key={item.giftcard}
                      className="flex-1 rounded-sm cursor-default"
                      style={{
                        height: `${Math.max(pct, 8)}%`,
                        backgroundColor: '#0097A7',
                        opacity: 1 - i * 0.3,
                      }}
                      title={`${item.giftcard}: ${item.cantidad} canjes`}
                    />
                  );
                })}
              </div>

              {/* Nombre top 1 */}
              <p className="text-[8px] text-slate-400 truncate mt-1.5 leading-tight">{items[0].giftcard}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CumulativeRevenueChart({ series, anio, isLoading, canjes, canjesLoading }: CumulativeRevenueChartProps) {
  if (isLoading) {
    return <div className="bg-white rounded-2xl border border-slate-100 shadow-sm animate-pulse" style={{ flex: '1 1 280px', minWidth: 260, height: 300 }} />;
  }

  const currentMonthN = new Date().getMonth() + 1;

  const data: MonthPoint[] = [];
  let acumulado = 0;
  let prevAvance: number | null = null;

  for (const pt of series) {
    const d = new Date(pt.time + 'T12:00:00');
    const mesN = d.getMonth() + 1;
    const mes = MESES_SHORT[mesN];
    acumulado += pt.value;
    const variacionPct = prevAvance !== null && prevAvance > 0
      ? ((pt.value - prevAvance) / prevAvance) * 100
      : null;
    data.push({ mes, avance: pt.value, acumulado, variacionPct, isCurrent: mesN === currentMonthN });
    prevAvance = pt.value;
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center"
        style={{ flex: '1 1 280px', minWidth: 260, height: 300 }}>
        <p className="text-xs text-slate-300">Sin datos mensuales</p>
      </div>
    );
  }

  const maxAcumulado = Math.max(...data.map(d => d.acumulado));
  const maxAvance = Math.max(...data.map(d => d.avance));
  const lastPoint = data[data.length - 1];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col"
      style={{ flex: '1 1 280px', minWidth: 260 }}>

      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Avance Acumulativo {anio}</p>
        <div className="text-right">
          <p className="text-base font-bold tabular-nums text-[#0097A7] leading-tight">{fmtUSD(lastPoint.acumulado)}</p>
          <p className="text-[10px] text-slate-400">acumulado</p>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 mb-3 text-[10px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm bg-[#0097A7] opacity-25 inline-block" /> Mes
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[#0097A7] inline-block" /> Acumulado
        </span>
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
            <YAxis yAxisId="mes" hide domain={[0, maxAvance * 4]} orientation="right" />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,151,167,0.04)' }} />
            <Area yAxisId="acum" type="monotone" dataKey="acumulado" stroke="none" fill="url(#gradAcum)" isAnimationActive={false} />
            <Bar yAxisId="mes" dataKey="avance" fill="#0097A7" fillOpacity={0.2} radius={[3, 3, 0, 0]} barSize={22} isAnimationActive={false}>
              <LabelList content={<VariationLabel />} dataKey="variacionPct" />
            </Bar>
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

      {/* Panel canjes por país — ocupa el espacio restante */}
      <div className="flex-1 flex flex-col min-h-0">
        <CanjesPanel canjes={canjes} loading={canjesLoading} />
      </div>
    </div>
  );
}
