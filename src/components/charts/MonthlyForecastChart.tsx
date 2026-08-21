import { useState } from 'react';
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList, Line,
} from 'recharts';
import { useSeries } from '../../hooks/useSeries';
import { useForecastAnual } from '../../hooks/useForecastAnual';
import { useForecastKam } from '../../hooks/useForecastKam';
import { useKamMensual } from '../../hooks/useKamMensual';

const MESES_SHORT = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const PAISES = ['LATAM', 'Chile', 'Perú', 'Colombia', 'México', 'Ecuador'];
const HS_ORANGE = '#FF7A59';
const TEAL = '#0097A7';

type Granularity = 'mensual' | 'trimestral';

const QUARTERS = [
  { label: 'Q1', meses: [1, 2, 3] },
  { label: 'Q2', meses: [4, 5, 6] },
  { label: 'Q3', meses: [7, 8, 9] },
  { label: 'Q4', meses: [10, 11, 12] },
];

function fmtUSD(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtPct(v: number) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

// HubSpot sprocket SVG (marca oficial simplificada)
function HubSpotIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={HS_ORANGE} aria-label="HubSpot">
      <path d="M18.164 7.931V5.085a2.198 2.198 0 0 0 1.268-1.978V3.06A2.203 2.203 0 0 0 17.228.857h-.047a2.203 2.203 0 0 0-2.204 2.204v.047a2.198 2.198 0 0 0 1.268 1.978v2.846a6.232 6.232 0 0 0-2.932 1.29L5.483 3.013a2.45 2.45 0 0 0 .07-.56A2.46 2.46 0 1 0 3.094 4.91a2.437 2.437 0 0 0 1.313-.384l7.694 5.345a6.232 6.232 0 0 0-.927 3.267 6.24 6.24 0 0 0 1.112 3.58l-2.318 2.318a1.895 1.895 0 0 0-.55-.086 1.928 1.928 0 1 0 1.928 1.928 1.895 1.895 0 0 0-.086-.55l2.292-2.292a6.264 6.264 0 1 0 5.612-9.105zm-.983 9.05a3.188 3.188 0 1 1 0-6.376 3.188 3.188 0 0 1 0 6.376z" />
    </svg>
  );
}

interface MonthData {
  mes: string;
  mesN: number;
  avance: number;
  forecast: number;       // valor raw de HubSpot
  forecastRemaining: number; // max(0, forecast - avance) para mes actual; forecast para futuros
  prevYear: number;
  isCurrent: boolean;
  isFuture: boolean;
  isBest: boolean;
  forecastLabel?: number;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as MonthData;
  if (!d) return null;
  const yoyDiff = d.avance > 0 && d.prevYear > 0
    ? ((d.avance - d.prevYear) / d.prevYear) * 100
    : null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl px-3 py-2.5 shadow-lg text-xs min-w-[165px]">
      <p className="font-bold text-slate-700 mb-2">
        {d.mes}{d.isCurrent ? ' · en curso' : d.isBest ? ' · mejor mes' : ''}
      </p>
      {d.avance > 0 && (
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: TEAL }} />Avance
          </span>
          <span className="font-semibold tabular-nums text-slate-700">{fmtUSD(d.avance)}</span>
        </div>
      )}
      {d.forecastRemaining > 0 && (
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: HS_ORANGE }} />Falta por cerrar
          </span>
          <span className="font-semibold tabular-nums" style={{ color: HS_ORANGE }}>{fmtUSD(d.forecastRemaining)}</span>
        </div>
      )}
      {/* El total va al pie y no arriba: es la suma de los dos de arriba, que es
          justo lo que se leía mal cuando el naranja decía "Forecast HS". */}
      {d.forecast > 0 && (
        <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-slate-100">
          <span className="flex items-center gap-1.5 text-slate-400">Forecast HS</span>
          <span className="font-bold tabular-nums" style={{ color: HS_ORANGE }}>{fmtUSD(d.forecast)}</span>
        </div>
      )}
      {d.prevYear > 0 && (
        <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-slate-100">
          <span className="flex items-center gap-1.5 text-slate-400">
            <svg width="14" height="3" viewBox="0 0 14 3"><line x1="0" y1="1.5" x2="14" y2="1.5" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"/></svg>
            Año ant.
          </span>
          <span className="tabular-nums text-slate-500">{fmtUSD(d.prevYear)}</span>
        </div>
      )}
      {yoyDiff !== null && (
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">vs a.ant.</span>
          <span className={`font-bold tabular-nums ${yoyDiff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {fmtPct(yoyDiff)}
          </span>
        </div>
      )}
    </div>
  );
}

// Label sobre barra forecast del mes actual
function ForecastTopLabel(props: any) {
  const { x, y, width, value } = props;
  if (!value) return null;
  return (
    <text x={x + width / 2} y={y - 5} textAnchor="middle" fontSize={10} fontWeight="700" fill={HS_ORANGE}>
      {fmtUSD(value)}
    </text>
  );
}

// Tick horizontal para el año anterior
function PrevYearDot(props: any) {
  const { cx, cy, payload } = props;
  if (!payload?.prevYear) return null;
  const hw = 10;
  return (
    <line
      x1={cx - hw} x2={cx + hw}
      y1={cy} y2={cy}
      stroke="#94a3b8"
      strokeWidth={2.5}
      strokeLinecap="round"
    />
  );
}

interface Props {
  anio: number;
  currentMes: number;
  ytdReal: number;
  latamSeries: { time: string; value: number }[];
  latamPrevYearSeries: { time: string; value: number }[];
  defaultPais?: string;
  hidePaisSwitcher?: boolean;
  /**
   * Nombre del ejecutivo. Si viene, aparece el selector País/Yo y se puede ver
   * el avance y el forecast de esa persona en vez de los del país.
   */
  kamNombre?: string;
}

export function MonthlyForecastChart({ anio, currentMes, ytdReal, latamSeries, latamPrevYearSeries, defaultPais, hidePaisSwitcher, kamNombre }: Props) {
  const [selectedPais, setSelectedPais] = useState(defaultPais ?? 'LATAM');
  const [granularity, setGranularity] = useState<Granularity>('mensual');
  // 'yo' solo existe cuando se pasó kamNombre
  const [scope, setScope] = useState<'pais' | 'yo'>('pais');
  const verYo = !!kamNombre && scope === 'yo';
  const isLatam = !verYo && selectedPais === 'LATAM';

  const { data: paisSeries, isFetching: paisFetching } = useSeries(
    anio, 'mes', isLatam ? undefined : selectedPais
  );
  const { data: paisPrevYear, isFetching: prevFetching } = useSeries(
    anio - 1, 'mes', isLatam ? undefined : selectedPais
  );
  const { data: forecastAnual } = useForecastAnual(anio);

  // Datos del ejecutivo. Los hooks se llaman siempre (regla de hooks) pero solo
  // se habilitan cuando hay nombre; su resultado se usa únicamente si verYo.
  const { data: kamMensual, isFetching: kamFetching } = useKamMensual(kamNombre, anio);
  const { data: forecastKam, isFetching: fcKamFetching } = useForecastKam(anio, kamNombre);

  const activeSeries = isLatam ? latamSeries : (paisSeries?.series ?? []);
  const activePrevYear = isLatam ? latamPrevYearSeries : (paisPrevYear?.series ?? []);

  const avanceByMes: Record<number, number> = {};
  const prevByMes: Record<number, number> = {};
  const forecastByMes: Record<number, number> = {};

  if (verYo) {
    // Avance y año anterior del ejecutivo salen de Cache_Reporte; el forecast,
    // de la columna Ejecutivo de la hoja de HubSpot.
    Object.assign(avanceByMes, kamMensual?.avanceByMes ?? {});
    Object.assign(prevByMes,   kamMensual?.prevByMes   ?? {});
    Object.assign(forecastByMes, forecastKam ?? {});
  } else {
    for (const pt of activeSeries) {
      const m = new Date(pt.time + 'T12:00:00').getMonth() + 1;
      avanceByMes[m] = pt.value;
    }
    for (const pt of activePrevYear) {
      const m = new Date(pt.time + 'T12:00:00').getMonth() + 1;
      prevByMes[m] = pt.value;
    }
    if (forecastAnual) {
      for (const f of forecastAnual.meses) {
        forecastByMes[f.mes] = isLatam ? f.forecast_usd : (f.por_pais[selectedPais] ?? 0);
      }
    }
  }

  // Mes con mayor avance (excluyendo el actual e incompletos)
  const pastAvances = Array.from({ length: currentMes - 1 }, (_, i) => avanceByMes[i + 1] ?? 0);
  const maxPastAvance = pastAvances.length > 0 ? Math.max(...pastAvances) : 0;

  // Datos mensuales base
  const monthlyData: MonthData[] = Array.from({ length: 12 }, (_, i) => {
    const mesN = i + 1;
    const isFuture = mesN > currentMes;
    const isCurrent = mesN === currentMes;
    const avance = isFuture ? 0 : (avanceByMes[mesN] ?? 0);
    const forecast = mesN >= currentMes ? (forecastByMes[mesN] ?? 0) : 0;
    // Para el mes actual: el forecast ya incluye el avance, solo mostramos el delta restante
    const forecastRemaining = isCurrent ? Math.max(0, forecast - avance) : forecast;
    const isBest = !isCurrent && !isFuture && avance === maxPastAvance && maxPastAvance > 0;
    return {
      mes: MESES_SHORT[mesN],
      mesN,
      avance,
      forecast,
      forecastRemaining,
      prevYear: prevByMes[mesN] ?? 0,
      isCurrent,
      isFuture,
      isBest,
      forecastLabel: isCurrent && forecast > 0 ? Math.max(avance, forecast) : undefined,
    };
  });

  // Agregación trimestral
  const quarterData: MonthData[] = QUARTERS.map(q => {
    const months = monthlyData.filter(d => q.meses.includes(d.mesN));
    const avance = months.reduce((s, d) => s + d.avance, 0);
    const forecast = months.reduce((s, d) => s + d.forecast, 0);
    const forecastRemaining = months.reduce((s, d) => s + d.forecastRemaining, 0);
    const prevYear = months.reduce((s, d) => s + d.prevYear, 0);
    const isCurrent = q.meses.includes(currentMes);
    const isFuture = months.every(d => d.isFuture);
    const isBest = !isCurrent && !isFuture && avance === Math.max(
      ...QUARTERS.filter(qq => !qq.meses.includes(currentMes)).map(qq =>
        monthlyData.filter(d => qq.meses.includes(d.mesN)).reduce((s, d) => s + d.avance, 0)
      )
    ) && avance > 0;
    return {
      mes: q.label,
      mesN: q.meses[0],
      avance, forecast, forecastRemaining, prevYear,
      isCurrent, isFuture, isBest,
      forecastLabel: isCurrent && forecast > 0 ? avance + forecastRemaining : undefined,
    };
  });

  const displayData = granularity === 'trimestral' ? quarterData : monthlyData;

  const maxVal = Math.max(...displayData.map(d => d.avance + d.forecastRemaining + d.prevYear), 1) * 1.18;

  // YTD: para LATAM usa el dato del ranking (fuente de verdad); para país usa suma de series
  const ytdDisplay = isLatam && !verYo
    ? ytdReal
    : monthlyData.filter(d => !d.isFuture).reduce((s, d) => s + d.avance, 0);

  // Dos cifras distintas que antes se mostraban con el mismo nombre:
  //   forecastRaw       ganado + abierto tal como viene de HubSpot
  //   forecastPorCerrar el resto sobre el avance ya facturado (raw - avance)
  // El stat decía "ganado + abierto" pero mostraba el resto, así que la etiqueta
  // sobre la barra ($5.6M) y el stat ($3.9M) se contradecían para el mismo mes.
  const forecastRaw = monthlyData
    .filter(d => d.mesN >= currentMes)
    .reduce((s, d) => s + d.forecast, 0);

  const forecastPorCerrar = monthlyData
    .filter(d => d.mesN >= currentMes)
    .reduce((s, d) => s + d.forecastRemaining, 0);

  // Hasta qué mes llega el pipeline cargado. Hoy HubSpot no tiene ningún deal
  // fechado después de agosto, así que "Proyectado" no es un cierre de año y el
  // subtítulo tiene que decirlo.
  const mesesConFc = monthlyData.filter(d => d.forecast > 0).map(d => d.mesN);
  const horizonteFc = mesesConFc.length ? Math.max(...mesesConFc) : currentMes;

  const projected = ytdDisplay + forecastPorCerrar;
  const ytdPrevYear = monthlyData
    .filter(d => !d.isFuture)
    .reduce((s, d) => s + d.prevYear, 0);
  const yoyPct = ytdPrevYear > 0 ? ((ytdDisplay - ytdPrevYear) / ytdPrevYear) * 100 : null;

  // Aura María Ávila no tiene ninguna fila en Cache_Reporte (no existe su
  // abreviatura), así que su vista "Yo" daría $0 sin poder distinguir "no
  // vendió" de "no hay dato cargado". Se marca explícitamente.
  const sinAvanceYo = verYo && !kamFetching &&
    monthlyData.filter(d => !d.isFuture).every(d => d.avance === 0);

  const isFetching = verYo ? (kamFetching || fcKamFetching) : (!isLatam && (paisFetching || prevFetching));
  const barSize = granularity === 'trimestral' ? 36 : 20;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-xs font-bold text-slate-700 whitespace-nowrap">Avance Mensual {anio}</p>
          {/* El subtítulo cede su lugar al selector País/Yo cuando existe, así la
              tarjeta conserva exactamente la misma altura. Lo que dice el
              subtítulo ya está en la leyenda y en el panel de la derecha. */}
          {kamNombre ? (
            <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5 flex-shrink-0">
              {([['pais', 'País'], ['yo', 'Yo']] as const).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setScope(v)}
                  title={v === 'yo' ? `Avance y forecast de ${kamNombre}` : `Avance y forecast de ${defaultPais ?? 'LATAM'}`}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                    scope === v ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-slate-400">Real + Forecast HubSpot</p>
          )}
          {isFetching && (
            <span className="w-2.5 h-2.5 rounded-full border-2 border-[#FF7A59] border-t-transparent animate-spin" />
          )}
        </div>
        {/* Granularity toggle */}
        <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5 flex-shrink-0">
          {(['mensual', 'trimestral'] as Granularity[]).map(g => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                granularity === g ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {g === 'mensual' ? 'Mes' : 'Trim.'}
            </button>
          ))}
        </div>
      </div>

      {/* Country tabs */}
      {!hidePaisSwitcher && (
        <div className="flex gap-1 flex-wrap mb-1">
          {PAISES.map(p => (
            <button
              key={p}
              onClick={() => setSelectedPais(p)}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all active:scale-95 ${
                selectedPais === p
                  ? 'bg-[#0097A7] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Chart + Stats en la misma fila */}
      <div className="flex gap-3 flex-1 min-h-0">
      <div className="flex-1 min-w-0">
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={displayData} margin={{ top: 20, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="mes"
            tick={({ x, y, payload, index }: any) => {
              const d = displayData[index];
              return (
                <text
                  x={x} y={y + 10}
                  textAnchor="middle"
                  fontSize={10}
                  fill={d?.isCurrent ? TEAL : d?.isFuture ? '#cbd5e1' : '#94a3b8'}
                  fontWeight={d?.isCurrent ? '700' : '400'}
                >
                  {payload.value}
                </text>
              );
            }}
            axisLine={false}
            tickLine={false}
          />
          {/* Un solo eje Y para que la comparación PY sea proporcional */}
          <YAxis hide domain={[0, maxVal]} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,151,167,0.04)' }} />

          {/* Avance real — base apilada */}
          <Bar dataKey="avance" stackId="m" barSize={barSize} isAnimationActive={false} radius={[0, 0, 2, 2]}>
            {displayData.map((d) => (
              <Cell
                key={d.mesN}
                fill={d.isBest ? '#005F6B' : TEAL}
                fillOpacity={d.isBest ? 1 : d.isCurrent ? 0.85 : d.isFuture ? 0 : 0.28}
              />
            ))}
          </Bar>

          {/* Forecast HubSpot — solo el delta restante, apilado sobre avance */}
          <Bar dataKey="forecastRemaining" stackId="m" barSize={barSize} isAnimationActive={false} radius={[3, 3, 0, 0]}>
            {displayData.map((d) => (
              <Cell key={d.mesN} fill={HS_ORANGE} fillOpacity={d.forecastRemaining > 0 ? 0.8 : 0} />
            ))}
            <LabelList dataKey="forecastLabel" content={<ForecastTopLabel />} />
          </Bar>

          {/* Año anterior — ticks horizontales */}
          <Line
            type="linear"
            dataKey="prevYear"
            stroke="transparent"
            dot={<PrevYearDot />}
            activeDot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-0.5 text-[9px] text-slate-400 flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-2 h-1.5 rounded-sm inline-block" style={{ background: '#005F6B' }} /> Mejor mes
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-1.5 rounded-sm opacity-30 inline-block" style={{ background: TEAL }} /> Avance real
        </span>
        <span className="flex items-center gap-1">
          <HubSpotIcon size={9} />
          <span className="w-2 h-1.5 rounded-sm inline-block ml-0.5" style={{ background: HS_ORANGE, opacity: 0.8 }} /> Falta por cerrar
        </span>
        <span className="flex items-center gap-1">
          <svg width="12" height="3" viewBox="0 0 12 3"><line x1="0" y1="1.5" x2="12" y2="1.5" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"/></svg>
          Año ant.
        </span>
      </div>
      </div>{/* fin flex-1 chart */}

      {/* Stats — columna derecha */}
      <div className="flex flex-col justify-center gap-2 border-l border-slate-100 pl-3 min-w-[90px]">
        <div>
          <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider">YTD Real</span>
          <p className="text-xs font-bold tabular-nums text-slate-800 leading-tight">{fmtUSD(ytdDisplay)}</p>
          {sinAvanceYo ? (
            <p className="text-[9px] font-semibold text-amber-500 leading-tight">sin dato cargado</p>
          ) : yoyPct !== null && (
            <p className={`text-[9px] font-semibold tabular-nums ${yoyPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {fmtPct(yoyPct)} vs {anio - 1}
            </p>
          )}
        </div>
        <div>
          <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider">Forecast HS</span>
          <p className="text-xs font-bold tabular-nums leading-tight" style={{ color: forecastRaw > 0 ? HS_ORANGE : undefined }}>
            {forecastRaw > 0 ? fmtUSD(forecastRaw) : <span className="text-slate-300">—</span>}
          </p>
          <p className="text-[8px] text-slate-400">ganado + abierto</p>
          {forecastPorCerrar > 0 && forecastPorCerrar < forecastRaw && (
            <p className="text-[8px] text-slate-400">
              falta por cerrar {fmtUSD(forecastPorCerrar)}
            </p>
          )}
        </div>
        <div>
          <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider">Proyectado</span>
          <p className="text-xs font-bold tabular-nums text-[#0097A7] leading-tight">
            {forecastRaw > 0 ? fmtUSD(projected) : <span className="text-slate-300">—</span>}
          </p>
          <p className="text-[8px] text-slate-400">real + pipeline a {MESES_SHORT[horizonteFc]}</p>
        </div>
      </div>
      </div>{/* fin flex row chart+stats */}
    </div>
  );
}
