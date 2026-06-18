import { useState } from 'react';
import type { KamRanking, ConsistenciaItem } from '../../hooks/types';
import { Card } from '../ui/Card';

type Mode = 'cumpl' | 'revenue' | 'consistencia';

const FLAG_CC: Record<string, string> = {
  Chile: 'cl', Perú: 'pe', Peru: 'pe', Colombia: 'co', México: 'mx', Mexico: 'mx', Ecuador: 'ec',
};

const MEDAL_COLORS = ['#F9A825', '#90A4AE', '#A1887F'];
const MEDAL_HEIGHTS = [150, 128, 118];
const MEDAL_LABELS = ['🥇', '🥈', '🥉'];

interface RankingEjecutivosProps {
  kams: KamRanking[];
  consistencia: ConsistenciaItem[];
}

function fmtK(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function RankingEjecutivos({ kams, consistencia }: RankingEjecutivosProps) {
  const [mode, setMode] = useState<Mode>('cumpl');

  function getSorted(): (KamRanking & { displayValue: string })[] {
    if (mode === 'cumpl') {
      return [...kams]
        .sort((a, b) => b.cumplimiento - a.cumplimiento)
        .map((k) => ({ ...k, displayValue: `${(k.cumplimiento * 100).toFixed(1)}%` }));
    }
    if (mode === 'revenue') {
      return [...kams]
        .sort((a, b) => b.avanceAnualUSD - a.avanceAnualUSD)
        .map((k) => ({ ...k, displayValue: fmtK(k.avanceAnualUSD) }));
    }
    // consistencia — join con data.consistencia
    const consMap = new Map(consistencia.map((c) => [c.nombre, c]));
    return [...kams]
      .map((k) => {
        const c = consMap.get(k.nombre);
        const displayValue = c
          ? `${c.mesesCumplidos}/${c.totalMeses}m · ${c.semanasCumplidas}/${c.totalSemanas}s`
          : '-';
        const sortVal = c ? c.mesesCumplidos / Math.max(c.totalMeses, 1) : 0;
        return { ...k, displayValue, _sortVal: sortVal };
      })
      .sort((a, b) => (b as typeof b & { _sortVal: number })._sortVal - (a as typeof a & { _sortVal: number })._sortVal);
  }

  const sorted = getSorted();
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Ranking Ejecutivos</h3>
        <div className="flex gap-1">
          {([['cumpl', '% Cumpl.'], ['revenue', 'Revenue'], ['consistencia', 'Consistencia']] as [Mode, string][]).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`text-xs px-3 py-1 rounded-full border transition-all active:scale-95 ${
                mode === m
                  ? 'bg-[#0097A7] text-white border-[#0097A7]'
                  : 'border-slate-200 text-slate-600 hover:border-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Podio top-3 */}
      {top3.length >= 1 && (
        <div className="flex items-end justify-center gap-3 py-2">
          {[top3[1], top3[0], top3[2]].map((k, i) => {
            if (!k) return <div key={i} className="w-20" />;
            const origIdx = i === 0 ? 1 : i === 1 ? 0 : 2;
            const h = MEDAL_HEIGHTS[origIdx];
            const color = MEDAL_COLORS[origIdx];
            const cc = FLAG_CC[k.pais];
            return (
              <div
                key={k.nombre}
                className="flex flex-col items-center gap-1 flex-shrink-0"
                style={{ width: 72 }}
              >
                <span className="text-lg">{MEDAL_LABELS[origIdx]}</span>
                <p className="text-xs font-semibold text-slate-700 text-center leading-tight truncate w-full">
                  {k.nombre.split(' ')[0]}
                </p>
                {cc && (
                  <img src={`https://flagcdn.com/24x18/${cc}.png`} width={18} height={13} alt={k.pais} className="rounded-sm" />
                )}
                <div
                  className="w-full rounded-t-lg flex items-end justify-center pb-2 transition-all cursor-default hover:opacity-100"
                  style={{ height: h, background: color, opacity: 0.85 }}
                >
                  <span className="text-white text-xs font-bold tabular-nums">{k.displayValue}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabla posiciones 4-N */}
      <div className="overflow-y-auto max-h-52">
        <table className="w-full text-xs">
          <tbody>
            {rest.map((k, i) => {
              const cc = FLAG_CC[k.pais];
              return (
                <tr key={k.nombre + k.pais} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-1.5 w-6 text-slate-400 tabular-nums font-medium">{i + 4}</td>
                  <td className="py-1.5">
                    <div className="flex items-center gap-1.5">
                      {cc && (
                        <img src={`https://flagcdn.com/24x18/${cc}.png`} width={16} height={12} alt={k.pais} className="rounded-sm flex-shrink-0" />
                      )}
                      <span className="text-slate-700 font-medium truncate">{k.nombre}</span>
                    </div>
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-slate-600 font-medium">{k.displayValue}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
