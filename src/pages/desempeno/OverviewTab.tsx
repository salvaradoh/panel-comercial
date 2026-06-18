import { useState } from 'react';
import { CumulativeRevenueChart } from '../../components/charts/CumulativeRevenueChart';
import { KpiStat } from '../../components/ui/KpiStat';
import { PaisResumenTable } from '../../components/charts/PaisResumenTable';
import { RegionPanel } from '../../components/charts/RegionSparkCard';
import { AnnualMetricsPanel } from '../../components/charts/AnnualMetricsPanel';
import { useSeries } from '../../hooks/useSeries';
import { useRanking } from '../../hooks/useRanking';
import { usePaisesSeries } from '../../hooks/usePaisesSeries';
import { usePaisesSeriesMes } from '../../hooks/usePaisesSeriesMes';
import { useCanjes } from '../../hooks/useCanjes';
import type { MetasResponse, PaisData } from '../../hooks/types';

interface OverviewTabProps {
  metas: MetasResponse;
  anio: number;
  onSelectPais: (pais: string) => void;
}

function fmtUSD(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function OverviewTab({ metas, anio, onSelectPais }: OverviewTabProps) {
  const [resumenVista, setResumenVista] = useState<'mes' | 'anio'>('mes');

  const { data: seriesAnterior } = useSeries(anio - 1, 'mes');
  const { data: seriesMesActual, isLoading: seriesMesLoading } = useSeries(anio, 'mes');
  const { data: rankingData } = useRanking(anio);
  const { data: paisesSeries } = usePaisesSeries(anio);
  const { data: paisesMesAnt } = usePaisesSeriesMes(anio - 1);
  const mesActual = new Date().getMonth() + 1;
  const { data: canjesData, isLoading: canjesLoading } = useCanjes(anio, mesActual);

  const totalAvance = metas.paises.reduce((s, p) => s + p.avance, 0);
  const totalMeta = metas.paises.reduce((s, p) => s + p.meta, 0);
  const cumpl = totalMeta > 0 ? totalAvance / totalMeta : 0;

  const ytdAnterior = seriesAnterior?.series.reduce((s, p) => s + p.value, 0) ?? 0;

  const cumplColor = cumpl >= 1 ? 'text-emerald-600' : cumpl >= 0.8 ? 'text-amber-500' : 'text-red-500';

  // Lista completa de países para la vista mes (usa rankingData como fallback)
  const PAISES_ESPERADOS = ['Chile', 'Perú', 'Colombia', 'México'];
  const metasPorPais = new Map(metas.paises.map(p => [p.pais, p]));
  const paisesCompletos: PaisData[] = PAISES_ESPERADOS.map(nombre => {
    if (metasPorPais.has(nombre)) return metasPorPais.get(nombre)!;
    const rankPais = rankingData?.paises.find(p => p.nombre === nombre);
    return {
      pais: nombre,
      avance: 0,
      meta: rankPais ? rankPais.metaAnualUSD / 12 : 0,
      pct: 0,
      serie: [],
    };
  }).filter(p => p.meta > 0);

  // Transformar paises del ranking al formato PaisData para la vista anual
  const paisesAnuales: PaisData[] = (rankingData?.paises ?? []).map(p => ({
    pais: p.nombre,
    avance: p.avanceAnualUSD,
    meta: p.metaAnualUSD,
    pct: p.cumplimiento,
    serie: [],
  }));

  // YTD real anual desde ranking (suma todos los países, excluye Ecuador/Otros)
  const ytdRanking = (rankingData?.paises ?? [])
    .filter(p => !['Otros', 'País', 'Pais', 'Ecuador'].includes(p.nombre))
    .reduce((s, p) => s + p.avanceAnualUSD, 0);

  // Proyección YoY (fórmula del GAS)
  const currentMonthN = new Date().getMonth() + 1;
  const cierreAnt = ytdAnterior; // serie completa año anterior = cierre anual
  const ytdAntSamePeriod = (seriesAnterior?.series ?? [])
    .filter(pt => new Date(pt.time + 'T12:00:00').getMonth() + 1 <= currentMonthN)
    .reduce((s, p) => s + p.value, 0);
  const factorYoY = ytdAntSamePeriod > 0 ? cierreAnt / ytdAntSamePeriod : 0;
  const proyeccionYoY = factorYoY > 0 ? ytdRanking * factorYoY : null;

  // YoY anual correcto: ytdRanking (YTD 2026) vs mismo período 2025
  const yoyAnual = ytdAntSamePeriod > 0
    ? ((ytdRanking - ytdAntSamePeriod) / ytdAntSamePeriod) * 100
    : null;

  return (
    <div className="flex flex-col gap-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiStat
          label="Revenue YTD Anual"
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
          sub={`vs ${anio - 1} mismo período: ${fmtUSD(ytdAntSamePeriod)}`}
          colorClass={yoyAnual !== null && yoyAnual >= 0 ? 'text-emerald-600' : 'text-red-500'}
        />
      </div>

      {/* Revenue por Región + Métricas Anuales — lado a lado, responsivo */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'stretch', overflow: 'visible', paddingBottom: 4 }}>
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
              return {
                pais: p.nombre,
                avance: p.avanceAnualUSD,
                meta: p.metaAnualUSD,
                pct: p.cumplimiento,
                varYoYPct,
                serie: paisesSeries?.[p.nombre] ?? [],
                prevYearSerie: paisesMesAnt?.[p.nombre] ?? [],
              };
            });
          return <RegionPanel rows={regionRows} onSelectPais={onSelectPais} />;
        })()}

        {/* Panel derecho: Métricas anuales */}
        <div style={{ flex: '0 1 320px', maxWidth: 340, minWidth: 260, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <AnnualMetricsPanel ytdActual={ytdRanking} anio={anio} proyeccionYoY={proyeccionYoY} />
        </div>

        {/* Gráfico acumulativo */}
        <CumulativeRevenueChart
          series={seriesMesActual?.series ?? []}
          anio={anio}
          isLoading={seriesMesLoading}
          canjes={canjesData}
          canjesLoading={canjesLoading}
        />
      </div>

      {/* Tabla resumen cross-país con toggle Mes/Año */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Resumen por Región</h3>
          <div className="flex gap-1">
            {(['mes', 'anio'] as const).map(v => (
              <button
                key={v}
                onClick={() => setResumenVista(v)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all active:scale-95 ${
                  resumenVista === v
                    ? 'bg-[#0097A7] text-white border-[#0097A7] font-semibold'
                    : 'border-slate-200 text-slate-600 hover:border-[#0097A7] hover:text-[#0097A7]'
                }`}
                aria-pressed={resumenVista === v}
              >
                {v === 'mes' ? 'Mes' : 'Año'}
              </button>
            ))}
          </div>
        </div>
        <PaisResumenTable
          paises={resumenVista === 'mes' ? paisesCompletos : paisesAnuales}
          onSelectPais={onSelectPais}
        />
      </div>
    </div>
  );
}
