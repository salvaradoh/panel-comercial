import { AreaChart, Area, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';

const FLAG_CC: Record<string, string> = {
  Chile: 'cl', Perú: 'pe', Peru: 'pe', Colombia: 'co', México: 'mx', Mexico: 'mx', Ecuador: 'ec',
};

const MESES_SHORT = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function fmtUSD(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function getMes(timeStr: string): string {
  const d = new Date(timeStr + 'T12:00:00');
  return MESES_SHORT[d.getMonth() + 1] || '';
}

function getWeekLabel(timeStr: string): string {
  const d = new Date(timeStr + 'T12:00:00');
  const day = d.getDate();
  const sem = day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : 4;
  const mes = MESES_SHORT[d.getMonth() + 1] || '';
  return `Sem ${sem} · ${mes}`;
}

function getMonthKey(timeStr: string): string {
  const d = new Date(timeStr + 'T12:00:00');
  return `${d.getFullYear()}-${d.getMonth()}`;
}

const COUNTRY_IDS: Record<string, string> = {
  Chile: '152',
  Perú: '604',
  Peru: '604',
  Colombia: '170',
  México: '484',
  Mexico: '484',
  Ecuador: '218',
};

// Centros de proyección para cada país (lon, lat) y escala
const COUNTRY_PROJ: Record<string, { center: [number, number]; scale: number }> = {
  Chile:    { center: [-71, -35],  scale: 380 },
  Perú:     { center: [-76, -10],  scale: 360 },
  Peru:     { center: [-76, -10],  scale: 360 },
  Colombia: { center: [-74,   4],  scale: 420 },
  México:   { center: [-102, 24],  scale: 220 },
  Mexico:   { center: [-102, 24],  scale: 220 },
  Ecuador:  { center: [-78,  -2],  scale: 700 },
};

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

function CountrySilhouette({ pais }: { pais: string }) {
  const id = COUNTRY_IDS[pais];
  const proj = COUNTRY_PROJ[pais];
  if (!id || !proj) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden transition-all duration-500 ease-out group-hover:scale-150 group-hover:-rotate-6 group-hover:opacity-30"
      style={{ opacity: 0.55, transformOrigin: 'center center' }}
    >
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center: proj.center, scale: proj.scale }}
        width={112}
        height={90}
        style={{ width: '100%', height: '100%' }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies
              .filter(geo => String(geo.id) === id)
              .map(geo => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  style={{
                    default: { fill: '#cbd5e1', stroke: 'none', outline: 'none' },
                    hover:   { fill: '#cbd5e1', outline: 'none' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
          }
        </Geographies>
      </ComposableMap>
    </div>
  );
}

export interface RowData {
  pais: string;
  avance: number;
  meta: number;
  pct: number;
  varYoYPct?: number | null;
  serie: { time: string; value: number }[];
  prevYearSerie?: { time: string; value: number }[];  // serie del año anterior (mensual)
}

function getCurrentMonth(): number {
  return new Date().getMonth() + 1; // 1-12
}

function getPointMonth(timeStr: string): number {
  return new Date(timeStr + 'T12:00:00').getMonth() + 1;
}

function getMonthLabels(serie: { time: string }[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const pt of serie) {
    const d = new Date(pt.time + 'T12:00:00');
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!seen.has(key)) {
      seen.add(key);
      labels.push(MESES_SHORT[d.getMonth() + 1] || '');
    }
  }
  return labels;
}

function MiniSparkline({ data, prevYearSerie }: { data: { time: string; value: number }[]; prevYearSerie?: { time: string; value: number }[] }) {
  if (data.length < 2) {
    return (
      <div className="flex-1 h-14 flex items-center justify-center">
        <span className="text-xs text-slate-300">Sin datos</span>
      </div>
    );
  }

  const values = data.map(d => d.value);
  const maxIdx = values.indexOf(Math.max(...values));
  const minIdx = values.indexOf(Math.min(...values));

  // Excluir el mes actual (no cerrado) para calcular min/max
  const currentMonth = getCurrentMonth();
  // Excluir mes actual Y futuros (solo meses cerrados < currentMonth)
  const closedIndices = data.map((d, i) => getPointMonth(d.time) < currentMonth ? i : -1).filter(i => i >= 0);
  const closedValues = closedIndices.map(i => values[i]);

  const maxClosedIdx = closedValues.length > 0 ? closedIndices[closedValues.indexOf(Math.max(...closedValues))] : maxIdx;
  const minClosedIdx = closedValues.length > 0 ? closedIndices[closedValues.indexOf(Math.min(...closedValues))] : minIdx;

  // Pre-calcular totales por mes
  const monthlySums: Record<string, number> = {};
  data.forEach(d => {
    const key = getMonthKey(d.time);
    monthlySums[key] = (monthlySums[key] || 0) + d.value;
  });

  const chartData = data.map((d, i) => ({
    time: d.time,
    mes: getMes(d.time),
    weekLabel: getWeekLabel(d.time),
    mesTotal: monthlySums[getMonthKey(d.time)],
    value: d.value,
    isMax: i === maxClosedIdx,
    isMin: i === minClosedIdx,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      const pt = payload[0].payload;

      // Buscar el mes correspondiente en el año anterior
      const mesNum = new Date(pt.time + 'T12:00:00').getMonth() + 1;
      const prevMonthEntry = prevYearSerie?.find(p => {
        const m = new Date(p.time + 'T12:00:00').getMonth() + 1;
        return m === mesNum;
      });
      const prevMonthTotal = prevMonthEntry?.value ?? null;

      const variacion = prevMonthTotal && prevMonthTotal > 0
        ? ((pt.mesTotal - prevMonthTotal) / prevMonthTotal) * 100
        : null;

      return (
        <div className="bg-white border border-slate-100 rounded-xl px-3 py-2.5 shadow-md text-xs min-w-[160px]">
          {/* Semana + Mes */}
          <p className="font-bold text-slate-700 text-sm">{pt.weekLabel}</p>
          <p className="text-[10px] text-slate-400 mb-1">{pt.mes}</p>

          {/* Variación */}
          {variacion !== null && (
            <p className={`font-bold tabular-nums mb-2 ${variacion >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {variacion >= 0 ? '▲' : '▼'}{Math.abs(variacion).toFixed(2)}%
            </p>
          )}

          {/* Mes actual */}
          <div className="flex justify-between gap-4 mb-0.5">
            <span className="text-slate-500">Mes actual</span>
            <span className="font-semibold tabular-nums text-slate-700">{fmtUSD(pt.mesTotal)}</span>
          </div>

          {/* Año anterior */}
          {prevMonthTotal !== null && (
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Año anterior</span>
              <span className="tabular-nums text-slate-400">{fmtUSD(prevMonthTotal)}</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const renderDot = (props: any) => {
    const { cx, cy, index } = props;
    if (index === maxClosedIdx) return <circle key="max" cx={cx} cy={cy} r={3.5} fill="#0097A7" />;
    if (index === minClosedIdx) return <circle key="min" cx={cx} cy={cy} r={3.5} fill="#94a3b8" />;
    return <g key={index} />;
  };

  return (
    <div className="flex-1" style={{ height: 72 }}>
      <ResponsiveContainer width="100%" height={72}>
        <AreaChart data={chartData} margin={{ top: 6, right: 6, left: 6, bottom: 2 }}>
          <YAxis domain={['dataMin * 0.85', 'dataMax * 1.08']} hide />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }}
            allowEscapeViewBox={{ x: true, y: true }}
            wrapperStyle={{ zIndex: 50 }}
          />
          <Area
            type="linear"
            dataKey="value"
            stroke="none"
            strokeWidth={0}
            fill="rgba(71, 85, 105, 0.35)"
            dot={renderDot}
            activeDot={{ r: 3, fill: '#0097A7' }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function SparkRow({ row, onClick, isLast, stretch }: { row: RowData; onClick?: () => void; isLast: boolean; stretch?: boolean }) {
  const cc = FLAG_CC[row.pais];
  const hasYoY = row.varYoYPct != null && row.varYoYPct !== 0;
  const positive = (row.varYoYPct ?? 0) >= 0;

  return (
    <button
      className={`group flex items-center w-full hover:bg-slate-50 transition-colors text-left ${!isLast ? 'border-b border-slate-100' : ''} ${stretch ? 'flex-1' : ''}`}
      onClick={onClick}
      aria-label={`Ver detalle de ${row.pais}`}
    >
      {/* Col 1: país + valor — con silueta de fondo, overflow-hidden para clip del zoom */}
      <div className="w-28 flex-shrink-0 px-4 py-5 flex flex-col justify-center gap-1 relative overflow-hidden" style={{ minHeight: 88 }}>
        <CountrySilhouette pais={row.pais} />
        <div className="relative z-10 flex items-center gap-1.5">
          {cc && <img src={`https://flagcdn.com/24x18/${cc}.png`} width={16} height={12} alt={row.pais} className="rounded-sm" />}
          <span className="text-xs text-slate-500">{row.pais}</span>
        </div>
        <p className="relative z-10 text-sm font-bold tabular-nums text-slate-800">{fmtUSD(row.avance)}</p>
      </div>

      {/* Col 2: delta% separado */}
      {hasYoY && (
        <div className="w-20 flex-shrink-0 flex flex-col justify-center gap-0">
          <p className={`text-sm font-bold tabular-nums leading-tight ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
            {positive ? '▲' : '▼'}{Math.abs(row.varYoYPct!).toFixed(1)}%
          </p>
          <p className="text-[10px] text-slate-400 leading-tight">vs. año ant.</p>
        </div>
      )}

      {/* Sparkline */}
      <MiniSparkline data={row.serie} prevYearSerie={row.prevYearSerie} />
    </button>
  );
}

interface RegionPanelProps {
  rows: RowData[];
  onSelectPais?: (pais: string) => void;
}

export function RegionPanel({ rows, onSelectPais }: RegionPanelProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm"
      style={{ flex: '1 1 380px', maxWidth: 520, minWidth: 280 }}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Revenue por Región</span>
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-[#0097A7] inline-block" /> Máx mes</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-slate-300 inline-block" /> Mín mes</span>
        </div>
      </div>
      {rows.map((row, i) => (
        <SparkRow key={row.pais} row={row} onClick={() => onSelectPais?.(row.pais)} isLast={i === rows.length - 1} />
      ))}
      {rows.length > 0 && rows[0].serie.length > 0 && (() => {
        const meses = getMonthLabels(rows[0].serie);
        return (
          <div className="flex items-center border-t border-slate-100 px-2 py-1.5">
            <div style={{ width: 112, flexShrink: 0 }} />
            <div style={{ width: 80, flexShrink: 0 }} />
            <div className="flex-1 flex justify-between px-1">
              {meses.map((m, j) => (
                <span key={j} className="text-[9px] text-slate-300 tabular-nums">{m}</span>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export function RegionSparkCard(props: RowData & { onClick?: () => void; isLast?: boolean }) {
  return <SparkRow row={props} onClick={props.onClick} isLast={props.isLast ?? false} />;
}
