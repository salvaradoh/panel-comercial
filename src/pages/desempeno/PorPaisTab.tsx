import { useState } from 'react';
import { useSeries } from '../../hooks/useSeries';
import { Card } from '../../components/ui/Card';
import type { MetasResponse } from '../../hooks/types';

const FLAG_CC: Record<string, string> = {
  Chile: 'cl', Perú: 'pe', Peru: 'pe', Colombia: 'co', México: 'mx', Mexico: 'mx', Ecuador: 'ec',
};

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

interface PorPaisTabProps {
  metas: MetasResponse;
  anio: number;
  initialPais?: string;
}

function fmtUSD(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function PorPaisTab({ metas, anio, initialPais }: PorPaisTabProps) {
  const [selectedPais, setSelectedPais] = useState(initialPais ?? metas.paises[0]?.pais ?? 'Chile');
  const { data: seriesMes, isLoading } = useSeries(anio, 'mes', selectedPais);

  const paisData = metas.paises.find(p => p.pais === selectedPais);
  const totalLatam = metas.paises.reduce((s, p) => s + p.avance, 0);
  const contribucion = totalLatam > 0 && paisData ? (paisData.avance / totalLatam) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Selector de país */}
      <div className="flex gap-2 flex-wrap">
        {metas.paises.map((p) => {
          const cc = FLAG_CC[p.pais];
          const isActive = p.pais === selectedPais;
          return (
            <button
              key={p.pais}
              onClick={() => setSelectedPais(p.pais)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all active:scale-95 ${
                isActive
                  ? 'bg-[#0097A7] text-white border-[#0097A7] shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-[#0097A7]'
              }`}
              aria-pressed={isActive}
            >
              {cc && <img src={`https://flagcdn.com/24x18/${cc}.png`} width={20} height={15} alt={p.pais} className="rounded-sm" />}
              {p.pais}
            </button>
          );
        })}
      </div>

      {/* KPIs del país seleccionado */}
      {paisData && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Revenue del Período</p>
            <p className="text-2xl font-bold tabular-nums text-[#0097A7] mt-1">{fmtUSD(paisData.avance)}</p>
            <p className="text-xs text-slate-400 mt-0.5">meta: {fmtUSD(paisData.meta)}</p>
          </Card>
          <Card>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Cumplimiento</p>
            <p className={`text-2xl font-bold tabular-nums mt-1 ${paisData.pct >= 1 ? 'text-emerald-600' : paisData.pct >= 0.8 ? 'text-amber-500' : 'text-red-500'}`}>
              {(paisData.pct * 100).toFixed(1)}%
            </p>
            <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-1.5 rounded-full bg-[#0097A7] transition-all"
                style={{ width: `${Math.min(paisData.pct * 100, 100)}%` }}
              />
            </div>
          </Card>
          <Card>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Contribución LATAM</p>
            <p className="text-2xl font-bold tabular-nums text-slate-700 mt-1">{contribucion.toFixed(1)}%</p>
            <p className="text-xs text-slate-400 mt-0.5">del total regional</p>
          </Card>
        </div>
      )}

      {/* Tabla mensual */}
      <Card>
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Detalle Mensual {anio}</h3>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-100">
                <th className="text-left py-2 font-medium">Mes</th>
                <th className="text-right py-2 font-medium tabular-nums">Revenue</th>
                <th className="text-right py-2 font-medium tabular-nums">Meta</th>
                <th className="text-right py-2 font-medium tabular-nums">Cumpl.</th>
                <th className="w-24 py-2" />
              </tr>
            </thead>
            <tbody>
              {seriesMes?.series.map((row, i) => {
                const mesNum = new Date(row.time).getMonth();
                const pct = row.meta > 0 ? row.value / row.meta : 0;
                const color = pct >= 1 ? '#10b981' : pct >= 0.8 ? '#f59e0b' : '#ef4444';
                return (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 font-medium text-slate-700">{MESES[mesNum]}</td>
                    <td className="py-2.5 text-right tabular-nums text-slate-700 font-semibold">{fmtUSD(row.value)}</td>
                    <td className="py-2.5 text-right tabular-nums text-slate-400">{fmtUSD(row.meta)}</td>
                    <td className="py-2.5 text-right tabular-nums font-semibold" style={{ color }}>
                      {(pct * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 pl-3">
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className="h-1.5 rounded-full" style={{ width: `${Math.min(pct * 100, 100)}%`, background: color }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!seriesMes?.series.length && (
                <tr><td colSpan={5} className="py-6 text-center text-slate-400 text-sm">Sin datos para este país</td></tr>
              )}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
