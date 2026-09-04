import { useState } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

type Segmento = 'A+' | 'A' | 'B' | 'C';

interface Cliente {
  cliente: string;
  kam: string;
  segmento: Segmento;
  score: number;
  vol: number;
}

interface DotMatrixProps {
  clientes: Cliente[];
  kams: string[];
}

const SEG_COLOR: Record<Segmento, { dot: string; badge: 'teal' | 'blue' | 'green' | 'amber' | 'orange' | 'red' | 'gray' }> = {
  'A+': { dot: '#16a34a', badge: 'green' },   // verde — excelente
  A:    { dot: '#ca8a04', badge: 'amber' },   // ámbar — bueno
  B:    { dot: '#ea580c', badge: 'orange' },  // naranja — moderado
  C:    { dot: '#dc2626', badge: 'red' },     // rojo — crítico
};

const SEG_LABEL_COLOR: Record<Segmento, string> = {
  'A+': 'text-[#16a34a]',
  A:    'text-[#ca8a04]',
  B:    'text-[#ea580c]',
  C:    'text-[#dc2626]',
};

export function DotMatrix({ clientes, kams }: DotMatrixProps) {
  const [selectedKam, setSelectedKam] = useState<string | null>(null);

  const conteos: Record<Segmento, number> = { 'A+': 0, A: 0, B: 0, C: 0 };
  clientes.forEach((c) => { conteos[c.segmento]++; });
  const total = clientes.length || 1;

  const filtered = selectedKam ? clientes.filter((c) => c.kam === selectedKam) : clientes;

  return (
    <div className="flex flex-col gap-4">
      {/* Tarjetas A+/A/B/C */}
      <div className="grid grid-cols-4 gap-3">
        {(['A+', 'A', 'B', 'C'] as Segmento[]).map((seg) => (
          <Card key={seg} className="text-center">
            <p className={`text-3xl font-bold tabular-nums ${SEG_LABEL_COLOR[seg]}`}>
              {conteos[seg]}
            </p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Segmento {seg}</p>
            <p className="text-xs text-slate-400">{((conteos[seg] / total) * 100).toFixed(1)}%</p>
          </Card>
        ))}
      </div>

      {/* Filtro por KAM */}
      <div className="flex flex-wrap gap-2">
        <button
          className={`text-xs px-3 py-1 rounded-full border transition-all active:scale-95 ${
            !selectedKam
              ? 'bg-[#0097A7] text-white border-[#0097A7]'
              : 'border-slate-200 text-slate-600 hover:border-slate-400'
          }`}
          onClick={() => setSelectedKam(null)}
          aria-pressed={!selectedKam}
          aria-label="Ver todos los KAMs"
        >
          Todos
        </button>
        {kams.map((k) => (
          <button
            key={k}
            className={`text-xs px-3 py-1 rounded-full border transition-all active:scale-95 ${
              selectedKam === k
                ? 'bg-[#0097A7] text-white border-[#0097A7]'
                : 'border-slate-200 text-slate-600 hover:border-slate-400'
            }`}
            onClick={() => setSelectedKam(k === selectedKam ? null : k)}
            aria-pressed={selectedKam === k}
            aria-label={`Filtrar por KAM ${k}`}
          >
            {k}
          </button>
        ))}
      </div>

      {/* Dot matrix */}
      <Card>
        <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
          {filtered.map((c, i) => (
            <span
              key={i}
              className="w-3 h-3 rounded-full inline-block flex-shrink-0"
              style={{ background: SEG_COLOR[c.segmento].dot }}
              title={`${c.cliente} (${c.segmento})`}
            />
          ))}
        </div>
      </Card>

      {/* Tabla detalle */}
      <Card>
        <div className="tabla-scroll">
          <table className="w-full text-xs tabla-apilable">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="text-left py-1.5 font-medium">Cliente</th>
                <th className="text-left py-1.5 font-medium">KAM</th>
                <th className="text-right py-1.5 font-medium tabular-nums">Vol</th>
                <th className="text-center py-1.5 font-medium">Seg</th>
                <th className="text-right py-1.5 font-medium tabular-nums">Score</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 20).map((c, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                  <td data-titular className="py-1.5 text-slate-700 truncate max-w-[120px]">{c.cliente}</td>
                  <td data-label="KAM" className="py-1.5 text-slate-500">{c.kam}</td>
                  <td data-label="Vol" className="py-1.5 text-right tabular-nums text-slate-600">
                    {c.vol.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                  </td>
                  <td data-label="Seg" className="py-1.5 text-center">
                    <Badge label={c.segmento} color={SEG_COLOR[c.segmento as Segmento]?.badge || 'gray'} />
                  </td>
                  <td data-label="Score" className="py-1.5 text-right tabular-nums text-slate-500 text-xs">{c.score?.toFixed(2) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 20 && (
          <p className="text-xs text-slate-400 mt-2 text-center">
            +{filtered.length - 20} clientes más
          </p>
        )}
      </Card>
    </div>
  );
}
