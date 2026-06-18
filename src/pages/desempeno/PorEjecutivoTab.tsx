import { useState } from 'react';
import { useRanking } from '../../hooks/useRanking';
import { Card } from '../../components/ui/Card';

const FLAG_CC: Record<string, string> = {
  Chile: 'cl', Perú: 'pe', Peru: 'pe', Colombia: 'co', México: 'mx', Mexico: 'mx', Ecuador: 'ec',
};

const EXCLUDED = new Set(['Otros', 'País', 'Pais']);

interface PorEjecutivoTabProps {
  anio: number;
}

function fmtUSD(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

const PAISES = ['Todos', 'Chile', 'Perú', 'Colombia', 'México'];

export function PorEjecutivoTab({ anio }: PorEjecutivoTabProps) {
  const { data, isLoading } = useRanking(anio);
  const [filtroPais, setFiltroPais] = useState('Todos');

  const kams = (data?.kams ?? [])
    .filter(k => !EXCLUDED.has(k.nombre))
    .filter(k => filtroPais === 'Todos' || k.pais === filtroPais)
    .sort((a, b) => b.cumplimiento - a.cumplimiento);

  const top3 = kams.slice(0, 3);
  const resto = kams.slice(3);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        <div className="grid grid-cols-3 gap-4">
          {[0,1,2].map(i => <div key={i} className="h-28 bg-slate-100 rounded-2xl" />)}
        </div>
        <div className="h-64 bg-slate-100 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Filtro por país */}
      <div className="flex gap-2 flex-wrap">
        {PAISES.map(p => (
          <button
            key={p}
            onClick={() => setFiltroPais(p)}
            className={`px-4 py-1.5 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
              filtroPais === p
                ? 'bg-[#0097A7] text-white border-[#0097A7]'
                : 'bg-white border-slate-200 text-slate-600 hover:border-[#0097A7]'
            }`}
            aria-pressed={filtroPais === p}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Top 3 destacadas */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {top3.map((k, i) => {
            const cc = FLAG_CC[k.pais];
            const medals = ['🥇', '🥈', '🥉'];
            const bgColors = ['bg-amber-50 border-amber-200', 'bg-slate-50 border-slate-200', 'bg-orange-50 border-orange-200'];
            return (
              <Card key={k.nombre} className={`border ${bgColors[i]}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl">{medals[i]}</span>
                  {cc && <img src={`https://flagcdn.com/24x18/${cc}.png`} width={20} height={15} alt={k.pais} className="rounded-sm" />}
                </div>
                <p className="text-sm font-bold text-slate-800">{k.nombre}</p>
                <p className="text-xs text-slate-500 mb-2">{k.pais}</p>
                <p className="text-xl font-bold tabular-nums text-[#0097A7]">{fmtUSD(k.avanceAnualUSD)}</p>
                <div className="mt-2 w-full bg-white rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-1.5 rounded-full bg-[#0097A7] transition-all"
                    style={{ width: `${Math.min(k.cumplimiento * 100, 100)}%` }}
                  />
                </div>
                <p className={`text-xs tabular-nums font-semibold mt-1 ${k.cumplimiento >= 1 ? 'text-emerald-600' : 'text-amber-500'}`}>
                  {(k.cumplimiento * 100).toFixed(1)}% de meta
                </p>
              </Card>
            );
          })}
        </div>
      )}

      {/* Tabla resto */}
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-400 border-b border-slate-100">
              <th className="text-left py-2 font-medium w-6">#</th>
              <th className="text-left py-2 font-medium">Ejecutivo</th>
              <th className="text-left py-2 font-medium">País</th>
              <th className="text-right py-2 font-medium tabular-nums">Revenue</th>
              <th className="text-right py-2 font-medium tabular-nums">Meta</th>
              <th className="text-right py-2 font-medium tabular-nums">Cumpl.</th>
              <th className="w-20 py-2" />
            </tr>
          </thead>
          <tbody>
            {resto.map((k, i) => {
              const cc = FLAG_CC[k.pais];
              const pct = k.cumplimiento;
              const color = pct >= 1 ? '#10b981' : pct >= 0.8 ? '#f59e0b' : '#ef4444';
              return (
                <tr key={k.nombre + k.pais} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 text-slate-400 tabular-nums text-xs">{i + 4}</td>
                  <td className="py-2.5 font-medium text-slate-700">{k.nombre}</td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-1.5">
                      {cc && <img src={`https://flagcdn.com/24x18/${cc}.png`} width={16} height={12} alt={k.pais} className="rounded-sm" />}
                      <span className="text-slate-500 text-xs">{k.pais}</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-right tabular-nums font-semibold text-slate-700">{fmtUSD(k.avanceAnualUSD)}</td>
                  <td className="py-2.5 text-right tabular-nums text-slate-400">{fmtUSD(k.metaAnualUSD)}</td>
                  <td className="py-2.5 text-right tabular-nums font-semibold" style={{ color }}>{(pct * 100).toFixed(1)}%</td>
                  <td className="py-2.5 pl-3">
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(pct * 100, 100)}%`, background: color }} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {kams.length === 0 && (
              <tr><td colSpan={7} className="py-6 text-center text-slate-400 text-sm">Sin ejecutivos para este filtro</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
