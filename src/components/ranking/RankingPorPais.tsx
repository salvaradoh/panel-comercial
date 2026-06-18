import { useState } from 'react';
import type { PaisRanking, KamRanking } from '../../hooks/types';
import { Card } from '../ui/Card';

const FLAG_CC: Record<string, string> = {
  Chile: 'cl', Perú: 'pe', Peru: 'pe', Colombia: 'co', México: 'mx', Mexico: 'mx', Ecuador: 'ec',
};

const EXCLUDED = new Set(['Otros', 'País', 'Pais']);

interface RankingPorPaisProps {
  paises: PaisRanking[];
  kams: KamRanking[];
}

function normPais(s: string) {
  if (s === 'Peru') return 'Perú';
  if (s === 'Mexico') return 'México';
  return s;
}

function fmtK(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function RankingPorPais({ paises, kams }: RankingPorPaisProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  // Agrupar kams por país normalizado
  const kamsByPais: Record<string, KamRanking[]> = {};
  kams
    .filter((k) => !EXCLUDED.has(k.nombre))
    .forEach((k) => {
      const p = normPais(k.pais);
      if (!kamsByPais[p]) kamsByPais[p] = [];
      kamsByPais[p].push(k);
    });

  Object.values(kamsByPais).forEach((arr) => arr.sort((a, b) => b.cumplimiento - a.cumplimiento));

  return (
    <Card className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-slate-700">Ranking Anual por País</h3>
      {paises.map((p) => {
        const cc = FLAG_CC[p.nombre];
        const isExpanded = expanded === p.nombre;
        const pct = (p.cumplimiento * 100).toFixed(1);
        const paisKams = kamsByPais[normPais(p.nombre)] ?? [];
        return (
          <div key={p.nombre} className="border border-slate-100 rounded-xl overflow-hidden">
            <button
              className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-all active:scale-[0.99] text-left"
              onClick={() => setExpanded(isExpanded ? null : p.nombre)}
              aria-expanded={isExpanded}
              aria-label={`${p.nombre}: ${(p.cumplimiento * 100).toFixed(1)}% de cumplimiento. ${isExpanded ? 'Contraer' : 'Expandir'} detalle`}
            >
              {cc && (
                <img src={`https://flagcdn.com/24x18/${cc}.png`} width={22} height={16} alt={p.nombre} className="rounded-sm flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-700">{p.nombre}</span>
                  <span className={`text-sm tabular-nums font-bold ${p.cumplimiento >= 1 ? 'text-emerald-600' : p.cumplimiento >= 0.8 ? 'text-amber-500' : 'text-red-500'}`}>
                    {p.cumplimiento >= 1 ? '▲' : p.cumplimiento >= 0.8 ? '◆' : '▼'} {pct}%
                  </span>
                </div>
                <div className="mt-1 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-1.5 rounded-full bg-[#0097A7]"
                    style={{ width: `${Math.min(p.cumplimiento * 100, 100)}%` }}
                    role="progressbar"
                    aria-valuenow={Math.round(p.cumplimiento * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {fmtK(p.avanceAnualUSD)} / meta {fmtK(p.metaAnualUSD)}
                </p>
              </div>
              <span className="text-slate-400 text-sm flex-shrink-0">{isExpanded ? '▲' : '▼'}</span>
            </button>

            {isExpanded && paisKams.length > 0 && (
              <div className="border-t border-slate-100 px-3 pb-3 pt-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400">
                      <th className="text-left py-1 font-medium">KAM</th>
                      <th className="text-right py-1 font-medium tabular-nums">Avance</th>
                      <th className="text-right py-1 font-medium tabular-nums">Cumpl.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paisKams.map((k) => (
                      <tr key={k.nombre} className="border-b border-slate-50">
                        <td className="py-1.5 text-slate-700 font-medium">{k.nombre}</td>
                        <td className="py-1.5 text-right tabular-nums text-slate-600">{fmtK(k.avanceAnualUSD)}</td>
                        <td className={`py-1.5 text-right tabular-nums font-semibold ${
                          k.cumplimiento >= 1 ? 'text-emerald-600' : k.cumplimiento >= 0.8 ? 'text-amber-500' : 'text-red-500'
                        }`}>
                          {k.cumplimiento >= 1 ? '▲' : k.cumplimiento >= 0.8 ? '◆' : '▼'} {(k.cumplimiento * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}
