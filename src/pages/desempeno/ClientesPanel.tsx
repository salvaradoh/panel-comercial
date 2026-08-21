import { useMemo, useState } from 'react';
import { useKamsClientes } from '../../hooks/useKamsClientes';
import type { ClienteKam } from '../../hooks/useKamsClientes';

// `primera_compra` NO es "Nuevo": es un estado (total_facturas = 1), o sea quien
// compró una vez y todavía no volvió. Un cliente ganado en marzo que ya compró
// diez veces hoy es 'recurrente' y no aparece acá. Los clientes nuevos del mes
// salen de vista_eventos_clientes (evento = 'ganado'), que es la única fuente.
// El resto del dashboard ya usa "1ra Compra" para este estado.
const TIPO_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  recurrente:        { label: 'Recurrente',    color: '#10b981', bg: '#ecfdf5' },
  estacional:        { label: 'Estacional',    color: '#f59e0b', bg: '#fffbeb' },
  primera_compra:    { label: '1ra Compra',    color: '#6366f1', bg: '#eef2ff' },
  perdido_historico: { label: 'Sin actividad', color: '#ef4444', bg: '#fef2f2' },
};

type SortPanel = 'dias' | 'nombre' | 'tipo' | 'tendencia';

function TendenciaIcon({ t }: { t: ClienteKam['tendencia'] }) {
  if (t === 'up')   return <span className="text-emerald-500 font-bold text-sm">↑</span>;
  if (t === 'down') return <span className="text-red-400 font-bold text-sm">↓</span>;
  return <span className="text-slate-300 text-sm">→</span>;
}

interface Props {
  kamNombre: string;
  kamPais: string;
  onClose: () => void;
}

export function ClientesPanel({ kamNombre, kamPais, onClose }: Props) {
  const { data, isLoading } = useKamsClientes(kamNombre, kamPais);
  const [sort, setSort]             = useState<SortPanel>('dias');
  const [buscar, setBuscar]         = useState('');
  const [soloActivos, setSoloActivos] = useState(true);

  const totalGeneral = data?.clientes.length ?? 0;
  const totalActivos = data?.clientes.filter(c => c.tipo !== 'perdido_historico').length ?? 0;

  const clientes = useMemo(() => {
    let list = data?.clientes ?? [];
    if (soloActivos) list = list.filter(c => c.tipo !== 'perdido_historico');
    if (buscar.trim()) {
      const q = buscar.toLowerCase();
      list = list.filter(c => c.nombre.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      if (sort === 'nombre')    return a.nombre.localeCompare(b.nombre);
      if (sort === 'tipo')      return a.tipo.localeCompare(b.tipo);
      if (sort === 'tendencia') return a.tendencia.localeCompare(b.tendencia);
      return b.diasSinCompra - a.diasSinCompra;
    });
  }, [data, sort, buscar, soloActivos]);

  const totalesTipo = useMemo(() => {
    const counts: Record<string, number> = {};
    (data?.clientes ?? []).forEach(c => { counts[c.tipo] = (counts[c.tipo] ?? 0) + 1; });
    return counts;
  }, [data]);

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/20 z-40 backdrop-blur-[1px]" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Cartera de clientes</p>
            <h2 className="text-lg font-black text-slate-800 leading-tight">{kamNombre}</h2>
            {kamPais !== 'Todos' && (
              <p className="text-xs text-slate-400">{kamPais}</p>
            )}
            {!isLoading && (
              <div className="flex items-center gap-1 mt-1.5">
                <button
                  onClick={() => setSoloActivos(true)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all ${soloActivos ? 'bg-[#0097A7] text-white border-[#0097A7]' : 'border-slate-200 text-slate-500'}`}
                >
                  Activos ({totalActivos})
                </button>
                <button
                  onClick={() => setSoloActivos(false)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all ${!soloActivos ? 'bg-slate-600 text-white border-slate-600' : 'border-slate-200 text-slate-500'}`}
                >
                  Todos ({totalGeneral})
                </button>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="mt-1 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Cerrar panel"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Pills resumen */}
        {!isLoading && data && (
          <div className="flex gap-2 px-5 py-3 border-b border-slate-50 flex-wrap">
            {Object.entries(TIPO_LABEL).map(([tipo, { label, color, bg }]) => {
              const n = totalesTipo[tipo] ?? 0;
              if (!n) return null;
              return (
                <span key={tipo} className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ color, background: bg }}>
                  {label}: {n}
                </span>
              );
            })}
            <span className="ml-auto text-[10px] text-slate-400">{clientes.length} mostrando</span>
          </div>
        )}

        {/* Buscador + sort */}
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-slate-50">
          <input
            type="search"
            placeholder="Buscar empresa o ID…"
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#0097A7] text-slate-700 placeholder:text-slate-300"
          />
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortPanel)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-500 bg-white focus:outline-none focus:border-[#0097A7]"
          >
            <option value="dias">Días s/c</option>
            <option value="nombre">Nombre</option>
            <option value="tipo">Tipo</option>
            <option value="tendencia">Tendencia</option>
          </select>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-5 animate-pulse">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-14 bg-slate-100 rounded-xl" />
              ))}
            </div>
          ) : clientes.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-16">Sin resultados</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {clientes.map(c => {
                const tipoInfo = TIPO_LABEL[c.tipo] ?? { label: c.tipo, color: '#64748b', bg: '#f8fafc' };
                return (
                  <li key={c.id} className="px-5 py-3 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate leading-tight">{c.nombre}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{c.id}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <TendenciaIcon t={c.tendencia} />
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                          style={{ color: tipoInfo.color, background: tipoInfo.bg }}
                        >
                          {tipoInfo.label}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className={`text-xs font-semibold tabular-nums ${
                        c.diasSinCompra > 180 ? 'text-red-500' : c.diasSinCompra > 90 ? 'text-amber-500' : 'text-emerald-600'
                      }`}>
                        {c.diasSinCompra}d sin compra
                      </span>
                      {c.ultimaCompra && (
                        <span className="text-[10px] text-slate-300">últ. {c.ultimaCompra}</span>
                      )}
                      <span className="text-[10px] text-slate-300">Año {c.numAnios}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
