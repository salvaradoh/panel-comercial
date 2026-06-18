import { useState } from 'react';
import { useRanking } from '../hooks/useRanking';
import { KpiStat } from '../components/ui/KpiStat';
import { RankingEjecutivos } from '../components/ranking/RankingEjecutivos';
import { RankingPorPais } from '../components/ranking/RankingPorPais';

function fmtUSD(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

const FLAG_CC: Record<string, string> = {
  Chile: 'cl', Perú: 'pe', Peru: 'pe', Colombia: 'co', México: 'mx', Mexico: 'mx',
};

const EXCLUDED = new Set(['Otros', 'País', 'Pais']);

export function RankingPage() {
  const [anio] = useState(new Date().getFullYear());
  const { data, isLoading, error } = useRanking(anio);

  if (isLoading) {
    return (
      <div className="p-6 animate-pulse">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-slate-100 rounded-2xl h-24" />
          ))}
        </div>
        <div className="bg-slate-100 rounded-2xl h-96" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 text-red-500" role="alert">
        Error cargando datos del ranking.
      </div>
    );
  }

  const kamsFiltrados = data.kams.filter((k) => !EXCLUDED.has(k.nombre));
  const totalRevenue = kamsFiltrados.reduce((s, k) => s + k.avanceAnualUSD, 0);
  const totalMeta    = data.paises.reduce((s, p) => s + p.metaAnualUSD, 0);
  const totalAvance  = data.paises.reduce((s, p) => s + p.avanceAnualUSD, 0);
  const cumplGlobal  = totalMeta > 0 ? totalAvance / totalMeta : 0;
  const sobreMeta    = kamsFiltrados.filter((k) => k.cumplimiento >= 1).length;

  const topKam   = [...kamsFiltrados].sort((a, b) => b.cumplimiento - a.cumplimiento)[0];
  const topPais  = data.paises[0];
  const topFlagKam  = FLAG_CC[topKam?.pais ?? ''];
  const topFlagPais = FLAG_CC[topPais?.nombre ?? ''];

  const cumplColor = cumplGlobal >= 1 ? 'text-emerald-600' : cumplGlobal >= 0.8 ? 'text-amber-500' : 'text-red-500';

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiStat
          label="Revenue Anual"
          value={fmtUSD(totalRevenue)}
          sub={`meta: ${fmtUSD(totalMeta)}`}
        />
        <KpiStat
          label="Cumplimiento Global"
          value={`${cumplGlobal >= 1 ? '▲' : cumplGlobal >= 0.8 ? '◆' : '▼'} ${(cumplGlobal * 100).toFixed(1)}%`}
          colorClass={cumplColor}
          valueAriaLabel={`Cumplimiento global: ${(cumplGlobal * 100).toFixed(1)}%, nivel ${cumplGlobal >= 1 ? 'alto' : cumplGlobal >= 0.8 ? 'medio' : 'bajo'}`}
        />
        <KpiStat
          label="KAMs sobre Meta"
          value={`${sobreMeta} / ${kamsFiltrados.length}`}
          sub="cumplimiento ≥ 100%"
        />
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Líderes del Año</p>
          {topKam && (
            <div className="flex items-center gap-2 mt-2">
              {topFlagKam && (
                <img src={`https://flagcdn.com/24x18/${topFlagKam}.png`} width={20} height={15} alt={topKam.pais} className="rounded-sm" />
              )}
              <p className="text-sm font-semibold text-slate-700 truncate">{topKam.nombre}</p>
              <span className="text-xs text-emerald-600 tabular-nums">{(topKam.cumplimiento * 100).toFixed(0)}%</span>
            </div>
          )}
          {topPais && (
            <div className="flex items-center gap-2 mt-1">
              {topFlagPais && (
                <img src={`https://flagcdn.com/24x18/${topFlagPais}.png`} width={20} height={15} alt={topPais.nombre} className="rounded-sm" />
              )}
              <p className="text-sm font-medium text-slate-600 truncate">{topPais.nombre}</p>
              <span className="text-xs text-emerald-600 tabular-nums">{(topPais.cumplimiento * 100).toFixed(0)}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Grid 2 columnas */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <RankingEjecutivos kams={kamsFiltrados} consistencia={data.consistencia} />
        <RankingPorPais paises={data.paises} kams={data.kams} />
      </div>
    </div>
  );
}
