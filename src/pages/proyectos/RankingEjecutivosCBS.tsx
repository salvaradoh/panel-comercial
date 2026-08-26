import { useState } from 'react';
import { Card } from '../../components/ui';
import type { FilaRanking } from '../../lib/cbs';
import { fmtUSDCorto, fmtUSDExacto } from '../../lib/cbs';

type Orden = 'usd' | 'cuentas' | 'sponsors' | 'avance' | 'sinTocar';

const COLUMNAS: { k: Orden; label: string; ayuda: string }[] = [
  { k: 'cuentas',  label: 'Cuentas',  ayuda: 'Filas asignadas a esta persona' },
  { k: 'usd',      label: 'USD 12m',  ayuda: 'Facturación anual de su cartera dentro del proyecto' },
  { k: 'sponsors', label: 'Sponsors', ayuda: 'Decisores confirmados' },
  { k: 'avance',   label: 'Avance',   ayuda: 'Sponsors sobre cuentas asignadas' },
  { k: 'sinTocar', label: 'Sin tocar', ayuda: 'Cuentas sin ninguna marca de gestión' },
];

/**
 * Avance por ejecutivo — la vista que el tablero de Looker Studio no tenía.
 *
 * Ahí el KAM era solamente un filtro, así que "quién no está avanzando" solo se
 * podía averiguar probando nombre por nombre. Acá es la lectura por defecto:
 * ordenado por plata, con el avance como barra y las cuentas sin tocar marcadas
 * en rojo, porque es lo único de esta tabla sobre lo que se puede actuar hoy.
 */
export function RankingEjecutivosCBS({ filas, titulo, etiquetaVacia }: {
  filas: FilaRanking[];
  titulo: string;
  etiquetaVacia: string;
}) {
  const [orden, setOrden] = useState<Orden>('usd');

  if (!filas.length) {
    return (
      <Card>
        <h3 className="text-sm font-bold text-slate-700 mb-3">{titulo}</h3>
        <p className="py-8 text-center text-sm text-slate-400">{etiquetaVacia}</p>
      </Card>
    );
  }

  const ordenadas = [...filas].sort((a, b) =>
    // 'sinTocar' se ordena de mayor a menor igual que el resto: lo que se quiere
    // ver arriba es el que más cuentas abandonadas tiene, no el que menos.
    b[orden] - a[orden]
  );
  const maxUsd = Math.max(1, ...filas.map((f) => f.usd));

  return (
    <Card>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-700">{titulo}</h3>
        <span className="text-[11px] text-slate-400">Clic en una columna para reordenar</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
              <th className="text-left font-medium pb-2">Ejecutivo</th>
              {COLUMNAS.map((c) => (
                <th
                  key={c.k}
                  onClick={() => setOrden(c.k)}
                  title={c.ayuda}
                  aria-sort={orden === c.k ? 'descending' : 'none'}
                  className="text-right font-medium pb-2 pl-3 cursor-pointer select-none
                             hover:text-slate-600 transition-colors whitespace-nowrap"
                >
                  <span className={orden === c.k ? 'text-[#E11D48]' : ''}>{c.label}</span>
                  <span className={orden === c.k ? 'text-[#E11D48]' : 'opacity-30'}>
                    {orden === c.k ? ' ↓' : ' ↕'}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((f) => {
              // Cero sponsors teniendo cartera es la señal que hay que ver primero.
              const enCero = f.sponsors === 0 && f.cuentas > 0;
              return (
                <tr key={f.nombre} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                  <td className="py-2 pr-3">
                    <div className="text-slate-700 whitespace-nowrap">{f.nombre}</div>
                    {/* Barra de peso: cuánto de la plata del proyecto tiene en la mano */}
                    <div className="h-1 w-24 bg-slate-100 rounded-full mt-1 overflow-hidden">
                      <div className="h-full rounded-full bg-slate-300" style={{ width: `${(f.usd / maxUsd) * 100}%` }} />
                    </div>
                  </td>
                  <td className="py-2 pl-3 text-right tabular-nums text-slate-600">{f.cuentas}</td>
                  <td className="py-2 pl-3 text-right tabular-nums text-slate-700 font-medium whitespace-nowrap"
                      title={fmtUSDExacto(f.usd)}>
                    {fmtUSDCorto(f.usd)}
                  </td>
                  <td className={`py-2 pl-3 text-right tabular-nums font-semibold ${
                    enCero ? 'text-rose-600' : 'text-emerald-600'
                  }`}>
                    {f.sponsors}
                  </td>
                  <td className="py-2 pl-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-14 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, f.avance * 100)}%`,
                            background: enCero ? '#e11d48' : '#16a34a',
                          }}
                        />
                      </div>
                      <span className="tabular-nums text-slate-600 w-9 text-right">
                        {Math.round(f.avance * 100)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-2 pl-3 text-right tabular-nums">
                    {f.sinTocar > 0
                      ? <span className="text-rose-600 font-semibold" title={fmtUSDExacto(f.usdSinTocar)}>{f.sinTocar}</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
