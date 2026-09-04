import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClienteTabla } from '../../hooks/useTablaClientes';
import { useTrampaDeFoco } from '../../hooks/useTrampaDeFoco';
import { ChipIndustria } from '../../components/ClienteIndustriaChip';

// Misma paleta que pages/desempeno/ClientesPanel.tsx — un cliente '1ra Compra'
// se ve igual en todo el dashboard, no solo en el leaderboard de KAMs.
const TIPO_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  recurrente:        { label: 'Recurrente',    color: '#10b981', bg: '#ecfdf5' },
  estacional:        { label: 'Estacional',    color: '#f59e0b', bg: '#fffbeb' },
  primera_compra:    { label: '1ra Compra',    color: '#6366f1', bg: '#eef2ff' },
  perdido_historico: { label: 'Sin actividad', color: '#ef4444', bg: '#fef2f2' },
};

function fmtUSD(v: number) {
  return v.toLocaleString('es-CL', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

type SortDetalle = 'usd' | 'nombre' | 'dias' | 'segmento';

export interface ClienteConUsd { c: ClienteTabla; usd: number }

export interface DetalleIndustriaProps {
  titulo: string;
  subtitulo?: string;
  /** Etiqueta del período que representa `usd` en cada fila y en el pie ("en 12m", "en 2025", "en 2026-03"). */
  periodoLabel: string;
  clientes: ClienteConUsd[];
  onClose: () => void;
}

/**
 * Panel derecho con el detalle de empresas detrás de una celda de la matriz
 * Industria por País — mismo patrón visual que ClientesPanel (leaderboard de
 * KAMs), pero sin fetch propio: recibe la lista ya filtrada y con el USD del
 * período activo ya resuelto por prop (el tab decide 12m/año/mes, este panel
 * solo muestra el número que le pasan).
 */
export function DetalleIndustriaPanel({ titulo, subtitulo, periodoLabel, clientes, onClose }: DetalleIndustriaProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useTrampaDeFoco(panelRef, true);

  const [sort, setSort] = useState<SortDetalle>('usd');
  const [buscar, setBuscar] = useState('');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const lista = useMemo(() => {
    let list = clientes;
    if (buscar.trim()) {
      const q = buscar.toLowerCase();
      list = list.filter(({ c }) =>
        c.nombre.toLowerCase().includes(q) ||
        (c.panelId || '').toLowerCase().includes(q) ||
        (c.idTributario || '').toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (sort === 'nombre')    return a.c.nombre.localeCompare(b.c.nombre);
      if (sort === 'dias')      return b.c.diasSinCompra - a.c.diasSinCompra;
      if (sort === 'segmento')  return a.c.segmento.localeCompare(b.c.segmento);
      return b.usd - a.usd;
    });
  }, [clientes, buscar, sort]);

  const totalUsd = clientes.reduce((s, { usd }) => s + usd, 0);

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40 backdrop-blur-[1px]" onClick={onClose} />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200"
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Detalle de empresas</p>
            <h2 className="text-lg font-black text-slate-800 leading-tight">{titulo}</h2>
            {subtitulo && <p className="text-xs text-slate-400 mt-0.5">{subtitulo}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar panel"
            className="mt-1 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-slate-50">
          <input
            type="search"
            placeholder="Buscar empresa o ID…"
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            aria-label="Buscar empresa o ID"
            className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#0097A7] text-slate-700 placeholder:text-slate-300"
          />
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortDetalle)}
            aria-label="Ordenar por"
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-500 bg-white focus:outline-none focus:border-[#0097A7]"
          >
            <option value="usd">USD {periodoLabel}</option>
            <option value="nombre">Nombre</option>
            <option value="dias">Días s/c</option>
            <option value="segmento">Segmento</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {lista.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-16">Sin resultados</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {lista.map(({ c, usd }) => {
                const tipoInfo = TIPO_LABEL[c.tipo] ?? { label: c.tipo, color: '#64748b', bg: '#f8fafc' };
                return (
                  <li key={`${c.pais}-${c.panelId || c.idTributario}`} className="px-5 py-3 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate leading-tight">{c.nombre}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {c.panelId || c.idTributario || '—'} · {c.pais}
                          {c.kam && <> · {c.kam}</>}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                          style={{ color: tipoInfo.color, background: tipoInfo.bg }}
                        >
                          {tipoInfo.label}
                        </span>
                        <span className="text-xs font-bold text-slate-800 tabular-nums" title={`USD ${periodoLabel}`}>{fmtUSD(usd)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className={`text-[11px] font-semibold tabular-nums ${
                        c.diasSinCompra > 180 ? 'text-red-500' : c.diasSinCompra > 90 ? 'text-amber-500' : 'text-emerald-600'
                      }`}>
                        {c.diasSinCompra}d sin compra
                      </span>
                      <span className="text-[10px] text-slate-300">Segmento {c.segmento}</span>
                      <ChipIndustria c={c} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-400">{clientes.length} empresa{clientes.length === 1 ? '' : 's'}</span>
          <span className="font-bold text-slate-700 tabular-nums">{fmtUSD(totalUsd)} {periodoLabel}</span>
        </div>
      </div>
    </>
  );
}
