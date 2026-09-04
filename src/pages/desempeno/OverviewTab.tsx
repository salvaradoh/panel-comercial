import { useState } from 'react';
import { CumulativeRevenueChart } from '../../components/charts/CumulativeRevenueChart';
import { MonthlyForecastChart } from '../../components/charts/MonthlyForecastChart';
import { KpiStat } from '../../components/ui/KpiStat';
import { PaisResumenTable } from '../../components/charts/PaisResumenTable';
import { RegionPanel } from '../../components/charts/RegionSparkCard';
import { AnnualMetricsPanel } from '../../components/charts/AnnualMetricsPanel';
import { useSeries } from '../../hooks/useSeries';
import { useRanking } from '../../hooks/useRanking';
import { usePaisesSeries } from '../../hooks/usePaisesSeries';
import { usePaisesSeriesMes } from '../../hooks/usePaisesSeriesMes';
import { useCanjes } from '../../hooks/useCanjes';
import { useMetas, usePaisesAvanceMensual, usePaisesMensual } from '../../hooks/useMetas';
import type { MetasResponse, PaisData } from '../../hooks/types';
import { METAS_PAIS_USD } from '../../lib/metas';

// Normaliza nombre de país eliminando tildes para el lookup en METAS_PAIS_USD.
function normPais(p: string): string {
  return p.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

interface OverviewTabProps {
  metas: MetasResponse;
  anio: number;
  mes: number;
  onSelectPais: (pais: string) => void;
}

function fmtUSD(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

// 0 = mes completo, 1-4 = semana puntual, 'anio' = vista anual
type Periodo = 0 | 1 | 2 | 3 | 4 | 'anio';

const PERIODO_OPTS: { value: Periodo; label: string }[] = [
  { value: 1, label: 'S1' },
  { value: 2, label: 'S2' },
  { value: 3, label: 'S3' },
  { value: 4, label: 'S4' },
  { value: 0, label: 'Mes' },
  { value: 'anio', label: 'Año' },
];

function chipCls(active: boolean) {
  return `px-3 py-1 rounded-lg border text-xs font-semibold transition-all active:scale-95 ${
    active
      ? 'bg-[#0097A7] text-white border-[#0097A7] shadow-sm'
      : 'border-slate-200 text-slate-500 hover:border-[#0097A7] hover:text-[#0097A7]'
  }`;
}

export function OverviewTab({ metas, anio, mes, onSelectPais }: OverviewTabProps) {
  const [periodo, setPeriodo] = useState<Periodo>(0);
  const [chartTab, setChartTab] = useState<'acumulativo' | 'mensual'>('acumulativo');

  // semana=0 → backend devuelve mesReal; semana 1-4 → dato semanal; 'anio' reutiliza semana=0
  const semanaParam = periodo === 'anio' ? 0 : Number(periodo);
  const { data: metasTabla, isFetching: tablaLoading } = useMetas(anio, mes, semanaParam);
  // KPI "Cumplimiento del Mes" siempre usa datos mensuales (semana=0), independiente del selector de periodo
  const { data: metasMensual } = useMetas(anio, mes, 0);

  const { data: seriesAnterior } = useSeries(anio - 1, 'mes');
  const { data: seriesMesActual, isLoading: seriesMesLoading } = useSeries(anio, 'mes');
  const { data: rankingData } = useRanking(anio);
  // Region panel siempre muestra datos semanales (granularidad más fina)
  const { data: paisesSeries } = usePaisesSeries(anio, 1);
  // paisesPrevSeries (anio-1 semanal) no disponible en BQ; se usa paisesMesAnt (mensual)

  const { data: paisesMesAnt } = usePaisesSeriesMes(anio - 1); // para cálculos YoY
  const { data: paisesMesActual } = usePaisesSeriesMes(anio);  // serie mensual año actual
  const paisesAvanceMensual = usePaisesAvanceMensual(anio);    // avance mensual real por país (Tabla_Avance_Total_Pais)
  const paisesMensualData   = usePaisesMensual(anio);         // avance + meta + avanceAnt por país/mes (Cache_Reporte)
  const mesActual = new Date().getMonth() + 1;
  const { data: canjesData, isLoading: canjesLoading } = useCanjes(anio, mesActual);

  const metasMensualSrc = metasMensual ?? metas;
  const totalAvance = metasMensualSrc.paises.reduce((s, p) => s + p.avance, 0);
  const totalMeta = metasMensualSrc.paises.reduce((s, p) => s + p.meta, 0);
  const cumpl = totalMeta > 0 ? totalAvance / totalMeta : 0;

  const ytdAnterior = seriesAnterior?.series.reduce((s, p) => s + p.value, 0) ?? 0;

  const cumplColor = cumpl >= 1 ? 'text-emerald-600' : cumpl >= 0.8 ? 'text-amber-500' : 'text-red-500';

  // Lista completa de países para la vista mes (usa rankingData como fallback)
  const PAISES_ESPERADOS = ['Chile', 'Perú', 'Colombia', 'México'];
  const PAISES_SIN_KAMS = ['Ecuador'];
  // La tabla usa metasTabla (semana local); fallback a metas mientras carga
  const tablaSource = metasTabla ?? metas;
  const metasPorPais = new Map(tablaSource.paises.map(p => [p.pais, p]));
  const paisesCompletos: PaisData[] = [
    ...PAISES_ESPERADOS.map(nombre => {
      if (metasPorPais.has(nombre)) return metasPorPais.get(nombre)!;
      const rankPais = rankingData?.paises.find(p => p.nombre === nombre);
      return {
        pais: nombre,
        avance: 0,
        meta: rankPais ? rankPais.metaAnualUSD / 12 : 0,
        pct: 0,
        serie: [],
      };
    }).filter(p => p.meta > 0),
    // Ecuador: sin meta mensual, pero puede tener ventas reales en metas.paises
    ...PAISES_SIN_KAMS.flatMap(nombre => {
      if (metasPorPais.has(nombre)) return [metasPorPais.get(nombre)!];
      const rankPais = rankingData?.paises.find(p => p.nombre === nombre);
      if (!rankPais) return [];
      return [{ pais: nombre, avance: 0, meta: 0, pct: 0, serie: [] }];
    }),
  ];

  // Vista anual: avance y YoY acotados al mes seleccionado.
  // metaAnual viene de METAS_PAIS_USD (frontend), independiente de asignación por ejecutivo.
  // avance se suma desde la serie mensual del año actual hasta el mes seleccionado,
  // para que al filtrar por junio se vea el cumplimiento solo de enero–junio.
  const paisesAnuales: PaisData[] = (rankingData?.paises ?? []).map(p => {
    const filtraMes = (pts: { time: string; value: number }[]) =>
      pts.filter(pt => new Date(pt.time + 'T12:00:00').getMonth() + 1 <= mes);

    // Avance hasta el mes seleccionado: usa serie mensual si está disponible,
    // si no cae al total anual de ranking (que puede incluir meses futuros).
    const serieActual = filtraMes(paisesMesActual?.[p.nombre] ?? []);
    const avance = serieActual.length > 0
      ? serieActual.reduce((s, pt) => s + pt.value, 0)
      : p.avanceAnualUSD;

    const serieAnt = filtraMes(paisesMesAnt?.[p.nombre] ?? []);
    const avanceYoY = serieAnt.reduce((s, pt) => s + pt.value, 0);
    const varYoY = avance - avanceYoY;
    const varYoYPct = avanceYoY > 0 ? (varYoY / avanceYoY) * 100 : undefined;

    const metasArr = METAS_PAIS_USD[normPais(p.nombre)] ?? [];
    const metaYTD = metasArr.length > 0
      ? metasArr.slice(0, mes).reduce((s, v) => s + v, 0)
      : p.metaAnualUSD * mes / 12;

    return {
      pais: p.nombre,
      avance,
      meta: metaYTD,
      pct: metaYTD > 0 ? avance / metaYTD : 0,
      serie: [],
      avanceYoY,
      varYoY,
      varYoYPct,
    };
  });

  // YTD real anual desde ranking (suma todos los países incluyendo Ecuador, excluye filas fantasma)
  const ytdRanking = (rankingData?.paises ?? [])
    .filter(p => !['Otros', 'País', 'Pais'].includes(p.nombre))
    .reduce((s, p) => s + p.avanceAnualUSD, 0);

  // ytdAntSamePeriod desde Cache_Reporte (avanceAnt por país/mes) — misma fuente que el gráfico
  const ytdAntSamePeriod = Object.values(paisesMensualData).reduce((total, mesMap) => {
    for (let m = 1; m <= mes; m++) {
      total += mesMap[`${anio}-${m - 1}`]?.avanceAnt ?? 0;
    }
    return total;
  }, 0);
  // Fallback a Cache_Series si Cache_Reporte aún no tiene datos del año anterior
  const ytdAntFallback = (seriesAnterior?.series ?? [])
    .filter(pt => new Date(pt.time + 'T12:00:00').getMonth() + 1 <= mes)
    .reduce((s, p) => s + p.value, 0);
  const ytdAntEffective = ytdAntSamePeriod > 0 ? ytdAntSamePeriod : ytdAntFallback;

  // Proyección YoY (fórmula del GAS)
  const cierreAnt = ytdAnterior; // serie completa año anterior = cierre anual
  const factorYoY = ytdAntEffective > 0 ? cierreAnt / ytdAntEffective : 0;
  const proyeccionYoY = factorYoY > 0 ? ytdRanking * factorYoY : null;

  // YoY anual correcto: ytdRanking (YTD 2026) vs mismo período 2025
  const yoyAnual = ytdAntEffective > 0
    ? ((ytdRanking - ytdAntEffective) / ytdAntEffective) * 100
    : null;

  return (
    <div className="flex flex-col gap-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiStat
          label="Venta YTD Anual"
          value={fmtUSD(ytdRanking)}
          sub={`meta anual: $70M`}
          colorClass="text-[#0097A7]"
        />
        <KpiStat
          label="Cumplimiento del Mes"
          value={`${cumpl >= 1 ? '▲' : cumpl >= 0.8 ? '◆' : '▼'} ${(cumpl * 100).toFixed(1)}%`}
          sub={`${fmtUSD(totalAvance)} de ${fmtUSD(totalMeta)}`}
          colorClass={cumplColor}
        />
        <KpiStat
          label="Crecimiento YoY Anual"
          value={yoyAnual !== null ? `${yoyAnual >= 0 ? '+' : ''}${yoyAnual.toFixed(1)}%` : '—'}
          sub={`vs ${anio - 1} mismo período: ${fmtUSD(ytdAntEffective)}`}
          colorClass={yoyAnual !== null && yoyAnual >= 0 ? 'text-emerald-600' : 'text-red-500'}
        />
      </div>

      {/* Fila 1: RegionPanel + MetaGlobal & Avance lado a lado */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'stretch' }}>
        {/* Panel izquierdo: RegionPanel */}
        {(() => {
          const regionRows = (rankingData?.paises ?? [])
            .filter(p => p.nombre !== 'Ecuador')
            .map(p => {
              const currentMonth = new Date().getMonth() + 1;
              const serieAnt = (paisesMesAnt?.[p.nombre] ?? []).filter(pt => {
                const m = new Date(pt.time + 'T12:00:00').getMonth() + 1;
                return m <= currentMonth;
              });
              const avanceAnt = serieAnt.reduce((s, pt) => s + pt.value, 0);
              const varYoYPct = avanceAnt > 0
                ? ((p.avanceAnualUSD - avanceAnt) / avanceAnt) * 100
                : null;
              const metasArr = METAS_PAIS_USD[normPais(p.nombre)] ?? [];
              const metaAnual = metasArr.length > 0
                ? metasArr.reduce((s, v) => s + v, 0)
                : p.metaAnualUSD;
              return {
                pais: p.nombre,
                avance: p.avanceAnualUSD,
                meta: metaAnual,
                pct: metaAnual > 0 ? p.avanceAnualUSD / metaAnual : p.cumplimiento,
                varYoYPct,
                serie: paisesSeries?.[p.nombre] ?? [],
                prevYearSerie: paisesMesAnt?.[p.nombre] ?? [],
                mesAvances: paisesAvanceMensual[p.nombre],
              };
            });
          return <RegionPanel rows={regionRows} onSelectPais={onSelectPais} semana={1} />;
        })()}

        {/* Columna derecha: cards + gráfico llenando el espacio restante */}
        <div style={{ flex: '1 1 400px', minWidth: 300, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Cards: Meta Global + Avance lado a lado */}
          <AnnualMetricsPanel
            ytdActual={ytdRanking}
            anio={anio}
            mes={mes}
            proyeccionYoY={proyeccionYoY}
            horizontal
          />
          {/* Gráfico llena el espacio restante */}
          <div style={{ flex: 1, minHeight: 180, display: 'flex', flexDirection: 'column' }}>
            <div className="flex gap-1 mb-2">
              {(['acumulativo', 'mensual'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setChartTab(tab)}
                  className={`px-3 py-1 rounded-lg border text-xs font-semibold transition-all ${
                    chartTab === tab
                      ? 'bg-[#0097A7] text-white border-[#0097A7]'
                      : 'border-slate-200 text-slate-500 hover:border-[#0097A7] hover:text-[#0097A7]'
                  }`}
                >
                  {tab === 'acumulativo' ? 'Acumulativo' : 'Mensual'}
                </button>
              ))}
            </div>
            <div style={{ flex: 1 }}>
              {chartTab === 'acumulativo' ? (
                <CumulativeRevenueChart
                  series={seriesMesActual?.series ?? []}
                  anio={anio}
                  isLoading={seriesMesLoading}
                  canjes={canjesData}
                  canjesLoading={canjesLoading}
                />
              ) : (
                <MonthlyForecastChart
                  anio={anio}
                  currentMes={mes}
                  ytdReal={ytdRanking}
                  latamSeries={seriesMesActual?.series ?? []}
                  latamPrevYearSeries={seriesAnterior?.series ?? []}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabla resumen cross-país con toggle Mes/Año */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Resumen por Región</h3>
            {tablaLoading && <span className="w-3 h-3 rounded-full border-2 border-[#0097A7] border-t-transparent animate-spin flex-shrink-0" />}
          </div>
          <div className="flex gap-1">
            {PERIODO_OPTS.map(({ value, label }) => (
              <button
                key={String(value)}
                onClick={() => setPeriodo(value)}
                aria-pressed={periodo === value}
                className={chipCls(periodo === value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <PaisResumenTable
          // El encabezado decía "Mes A. Ant." y mostraba el año pasado acotado al
          // mismo tramo que lleva el período en curso, no el mes completo. En la
          // vista Mes eso es la semana en la que estamos; en la vista Año, el
          // acumulado hasta el mes elegido. Se nombra por lo que es.
          etiquetaAnterior={`${anio - 1} a la fecha`}
          tituloAnterior={periodo === 'anio'
            ? `Acumulado de ${anio - 1} hasta el mismo mes, para comparar contra el avance del año en curso`
            : `${anio - 1} acumulado hasta el mismo tramo del mes que lleva ${anio}, para que la variación compare períodos iguales`}
          paises={periodo === 'anio' ? paisesAnuales : paisesCompletos}
          onSelectPais={onSelectPais}
          noClickPaises={PAISES_SIN_KAMS}
        />
      </div>
    </div>
  );
}
