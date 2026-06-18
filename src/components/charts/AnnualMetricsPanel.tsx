import { Card } from '../ui/Card';
import { useRanking } from '../../hooks/useRanking';

const META_ANUAL_USD = 70_000_000;
const MESES_NOMBRE = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];


const EXCLUDED = new Set(['Otros', 'País', 'Pais', 'Ecuador']);

function fmtUSDFull(v: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
}

function fmtUSDShort(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

interface AnnualMetricsPanelProps {
  ytdActual: number;
  anio: number;
  proyeccionYoY?: number | null;
}

export function AnnualMetricsPanel({ ytdActual, anio, proyeccionYoY }: AnnualMetricsPanelProps) {
  const { data: rankingData } = useRanking(anio);

  const mesActual = new Date().getMonth() + 1;
  const pctHacia70M = Math.min(ytdActual / META_ANUAL_USD, 1);
  const proyLineal = mesActual > 0 ? (ytdActual / mesActual) * 12 : 0;
  const proyeccion = proyeccionYoY ?? proyLineal;
  const tieneYoY = proyeccionYoY != null && proyeccionYoY > 0;
  const pctProyeccion = proyeccion / META_ANUAL_USD;

  // Métricas desde ranking
  const kams = (rankingData?.kams ?? []).filter(k => !EXCLUDED.has(k.nombre));
  const sobreMeta = kams.filter(k => k.cumplimiento >= 1).length;
  const brecha = META_ANUAL_USD - ytdActual;
  const topKam = [...kams].sort((a, b) => b.cumplimiento - a.cumplimiento)[0];
  const topPais = (rankingData?.paises ?? [])[0];
  const avgCumpl = kams.length > 0
    ? kams.reduce((s, k) => s + k.cumplimiento, 0) / kams.length
    : 0;

  return (
    <div className="flex flex-col gap-3">

      {/* Card: Meta $70M — compacta */}
      <Card>
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Meta Global {anio}</p>
          <span className="text-[10px] text-slate-300">$70M</span>
        </div>
        <div className="flex items-baseline gap-1.5 mb-0.5">
          <span className="text-xl font-bold tabular-nums text-[#0097A7]">{fmtUSDFull(ytdActual)}</span>
          <span className="text-xs text-slate-400">/ $70M</span>
        </div>
        <div className="relative w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-1">
          <div className="absolute inset-y-0 left-0 rounded-full bg-[#0097A7] opacity-20"
            style={{ width: `${Math.min(pctProyeccion * 100, 100)}%` }} />
          <div className="absolute inset-y-0 left-0 rounded-full bg-[#0097A7]"
            style={{ width: `${Math.min(pctHacia70M * 100, 100)}%` }} />
        </div>
        <p className="text-[10px] text-slate-400 mb-2">{(pctHacia70M * 100).toFixed(1)}% alcanzado</p>
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400">Proyección al cierre</p>
            <p className={`text-sm font-bold tabular-nums ${proyeccion >= META_ANUAL_USD ? 'text-emerald-600' : 'text-amber-500'}`}>
              {fmtUSDFull(proyeccion)}
            </p>
            <p className={`text-[10px] font-medium ${proyeccion >= META_ANUAL_USD ? 'text-emerald-600' : 'text-red-500'}`}>
              {proyeccion >= META_ANUAL_USD ? `▲ ${fmtUSDShort(proyeccion - META_ANUAL_USD)} sobre` : `▼ ${fmtUSDShort(META_ANUAL_USD - proyeccion)} bajo`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400">{tieneYoY ? 'Factor YoY' : 'Lineal'}</p>
            <p className="text-[10px] text-slate-400">{MESES_NOMBRE[mesActual]}→Dic</p>
          </div>
        </div>
      </Card>

      {/* Card: KPIs compactos */}
      <Card>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Indicadores del Año</p>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { label: 'KAMs sobre meta', value: `${sobreMeta}/${kams.length}`, color: 'text-[#0097A7]' },
            { label: 'Cumpl. promedio', value: `${(avgCumpl * 100).toFixed(0)}%`, color: avgCumpl >= 1 ? 'text-emerald-600' : avgCumpl >= 0.8 ? 'text-amber-500' : 'text-red-500' },
            { label: 'Brecha a $70M', value: fmtUSDShort(Math.abs(brecha)), color: brecha <= 0 ? 'text-emerald-600' : 'text-red-500' },
            { label: 'País líder', value: topPais?.nombre ?? '—', color: 'text-slate-700', sub: topPais ? `${(topPais.cumplimiento * 100).toFixed(1)}%` : '' },
          ].map(item => (
            <div key={item.label} className="bg-slate-50 rounded-lg px-2 py-1.5">
              <p className="text-[9px] text-slate-400 leading-tight">{item.label}</p>
              <p className={`text-sm font-bold tabular-nums leading-tight ${item.color}`}>{item.value}</p>
              {item.sub && <p className="text-[9px] text-amber-500 font-semibold">{item.sub}</p>}
            </div>
          ))}
        </div>
        {topKam && (
          <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center gap-1.5">
            <span className="text-xs">🏆</span>
            <p className="text-xs font-semibold text-slate-700 flex-1 truncate">{topKam.nombre}</p>
            <p className="text-xs font-bold text-emerald-600 tabular-nums flex-shrink-0">{(topKam.cumplimiento * 100).toFixed(0)}% · {fmtUSDShort(topKam.avanceAnualUSD)}</p>
          </div>
        )}
      </Card>

    </div>
  );
}
