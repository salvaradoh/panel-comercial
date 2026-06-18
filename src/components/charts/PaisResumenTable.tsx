import type { PaisData } from '../../hooks/types';

const FLAG_CC: Record<string, string> = {
  Chile: 'cl', Perú: 'pe', Peru: 'pe', Colombia: 'co', México: 'mx', Mexico: 'mx', Ecuador: 'ec',
};

interface PaisResumenTableProps {
  paises: PaisData[];
  onSelectPais?: (pais: string) => void;
}

function fmtUSD(v: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

function VarBadge({ value, pct }: { value: number; pct: number | null | undefined }) {
  const positive = value >= 0;
  const color = positive ? 'text-emerald-600' : 'text-red-500';
  return (
    <div className={`text-right ${color}`}>
      <p className="text-sm font-semibold tabular-nums">
        {positive ? '+' : ''}{fmtUSD(value)}
      </p>
      {pct != null && (
        <p className="text-xs tabular-nums opacity-70">
          ({positive ? '+' : ''}{pct.toFixed(1)}%)
        </p>
      )}
    </div>
  );
}

export function PaisResumenTable({ paises, onSelectPais }: PaisResumenTableProps) {
  const totalMeta   = paises.reduce((s, p) => s + p.meta, 0);
  const totalAvance = paises.reduce((s, p) => s + p.avance, 0);
  const totalAnt    = paises.reduce((s, p) => s + (p.mesAnterior ?? 0), 0);
  const totalYoY    = paises.reduce((s, p) => s + (p.avanceYoY ?? 0), 0);
  const totalVar    = totalAvance - totalYoY;
  const totalVarPct = totalYoY > 0 ? (totalVar / totalYoY) * 100 : null;
  const totalPct    = totalMeta > 0 ? totalAvance / totalMeta : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Resumen por Región</h3>
        <span className="text-xs text-slate-400">período seleccionado</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-slate-400 border-b border-slate-100 bg-slate-50">
              <th className="text-left px-5 py-3 font-medium">País</th>
              <th className="text-right px-4 py-3 font-medium tabular-nums">Meta</th>
              <th className="text-right px-4 py-3 font-medium tabular-nums">Avance</th>
              <th className="text-right px-4 py-3 font-medium tabular-nums">Proy. YoY</th>
              <th className="text-right px-4 py-3 font-medium tabular-nums">Mes A. Ant.</th>
              <th className="text-right px-4 py-3 font-medium tabular-nums">Var. YoY</th>
              <th className="text-right px-5 py-3 font-medium tabular-nums">Cumpl.</th>
            </tr>
          </thead>
          <tbody>
            {paises.map((p) => {
              const cc = FLAG_CC[p.pais];
              const pct = p.pct;
              const cumplColor = pct >= 1 ? 'text-emerald-600' : pct >= 0.8 ? 'text-amber-500' : 'text-red-500';
              const isClickable = !!onSelectPais;
              return (
                <tr
                  key={p.pais}
                  className={`border-b border-slate-50 transition-colors ${isClickable ? 'hover:bg-slate-50 cursor-pointer' : ''}`}
                  onClick={() => onSelectPais?.(p.pais)}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      {cc && (
                        <img src={`https://flagcdn.com/24x18/${cc}.png`} width={20} height={15} alt={p.pais} className="rounded-sm shadow-sm flex-shrink-0" />
                      )}
                      <span className="text-sm font-semibold text-slate-700">{p.pais}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-slate-400 text-sm">{fmtUSD(p.meta)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-sm font-semibold text-slate-800">{fmtUSD(p.avance)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-sm text-slate-400">
                    {p.avanceYoY != null && p.avanceYoY > 0 ? fmtUSD(p.avanceYoY) : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-sm text-slate-400">
                    {p.mesAnterior != null ? fmtUSD(p.mesAnterior) : '—'}
                  </td>
                  <td className="px-4 py-3.5">
                    {p.varYoY != null
                      ? <VarBadge value={p.varYoY} pct={p.varYoYPct} />
                      : <p className="text-right text-slate-300 text-sm">—</p>
                    }
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all ${pct >= 1 ? 'bg-emerald-500' : pct >= 0.8 ? 'bg-amber-400' : 'bg-red-400'}`}
                          style={{ width: `${Math.min(pct * 100, 100)}%` }}
                        />
                      </div>
                      <span className={`text-sm font-bold tabular-nums ${cumplColor}`}>
                        {(pct * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Totales */}
          <tfoot>
            <tr className="bg-slate-50 border-t-2 border-slate-200">
              <td className="px-5 py-3.5 text-sm font-bold text-slate-700">Total LATAM</td>
              <td className="px-4 py-3.5 text-right tabular-nums text-sm font-semibold text-slate-500">{fmtUSD(totalMeta)}</td>
              <td className="px-4 py-3.5 text-right tabular-nums text-sm font-bold text-slate-800">{fmtUSD(totalAvance)}</td>
              <td className="px-4 py-3.5 text-right tabular-nums text-sm text-slate-500">{totalYoY > 0 ? fmtUSD(totalYoY) : '—'}</td>
              <td className="px-4 py-3.5 text-right tabular-nums text-sm text-slate-500">{fmtUSD(totalAnt)}</td>
              <td className="px-4 py-3.5">
                <VarBadge value={totalVar} pct={totalVarPct} />
              </td>
              <td className="px-5 py-3.5">
                <div className="flex items-center justify-end gap-2">
                  <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full ${totalPct >= 1 ? 'bg-emerald-500' : totalPct >= 0.8 ? 'bg-amber-400' : 'bg-red-400'}`}
                      style={{ width: `${Math.min(totalPct * 100, 100)}%` }}
                    />
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${totalPct >= 1 ? 'text-emerald-600' : totalPct >= 0.8 ? 'text-amber-500' : 'text-red-500'}`}>
                    {(totalPct * 100).toFixed(1)}%
                  </span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
