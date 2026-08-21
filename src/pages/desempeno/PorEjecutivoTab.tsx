import { useState, useMemo } from 'react';
import { useRanking } from '../../hooks/useRanking';
import { useKamsSummary } from '../../hooks/useKamsSummary';
import { useKamsNuevos } from '../../hooks/useKamsNuevos';
import { useRoles } from '../../hooks/useRoles';
import { ClientesPanel } from './ClientesPanel';
import type { ConsistenciaItem } from '../../hooks/types';
import type { KamSummary } from '../../hooks/useKamsSummary';
import { useTrack } from '../../hooks/useTrack';

const FLAG_CC: Record<string, string> = {
  Chile: 'cl', Perú: 'pe', Peru: 'pe', Colombia: 'co', México: 'mx', Mexico: 'mx', Ecuador: 'ec',
};
const EXCLUDED = new Set(['País', 'Pais']);
const PAISES = ['Todos', 'Chile', 'Perú', 'Colombia', 'México'];
const ROLES  = ['Todos', 'KAM', 'Full Cycle', 'BDM'];

type SubTab = 'desempeno' | 'cartera' | 'ticket';

interface PorEjecutivoTabProps { anio: number; mes: number; filterPais?: string }

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtUSD(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function pctColor(pct: number) {
  return pct >= 1 ? '#10b981' : pct >= 0.8 ? '#f59e0b' : '#ef4444';
}


function MiniBar({ pct, color, h = 5 }: { pct: number; color: string; h?: number }) {
  return (
    <div className="w-full rounded-full overflow-hidden bg-slate-100" style={{ height: h }}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(pct * 100, 100)}%`, background: color }} />
    </div>
  );
}

/**
 * Piso para considerar que hay meta cargada.
 *
 * `Cache_Ranking` trae filas con meta simbólica: "Otros · Perú" tiene meta anual
 * de **1 dólar** contra un avance de 22.124, y el cumplimiento salía
 * 2.067.633,6% — ordenaba la tabla primero y se leía como un récord.
 *
 * El piso es absoluto y no relativo porque la meta más chica real de la cartera
 * son USD 246.024 (Otros · Ecuador) y la más chica de una persona USD 260.225
 * (Felipe Ospina), así que cualquier cosa bajo mil dólares es un placeholder,
 * no un objetivo. Con meta bajo el piso se muestra "—": ni porcentaje ni barra.
 */
const META_MINIMA_USD = 1000;

/**
 * Filas que no son una persona: baldes de lo no atribuido. Llevan la meta
 * residual del país —lo que no está asignado a ningún ejecutivo— y medirles
 * cumplimiento no significa nada: "Otros · Mexico" daba 1945% y encabezaba el
 * ranking por encima de gente con USD 2,8M vendidos.
 */
const BUCKETS = new Set(['Otros', 'País', 'Pais']);

function esPersona(nombre: string): boolean {
  return !BUCKETS.has(String(nombre || '').trim());
}

function tieneMeta(metaYTD: number, nombre: string): boolean {
  return esPersona(nombre) && Number.isFinite(metaYTD) && metaYTD >= META_MINIMA_USD;
}

// ── sub-tab: Desempeño ────────────────────────────────────────────────────────

type SortDesempeno = 'cumpl' | 'revenue' | 'consistencia' | 'runrate';

function TablaDesempeno({
  kams, consMap, mes,
}: {
  kams: { nombre: string; pais: string; avanceAnualUSD: number; metaAnualUSD: number; metaYTDUSD?: number; cumplimiento: number }[];
  consMap: Map<string, ConsistenciaItem>;
  mes: number;
}) {
  const [sort, setSort] = useState<SortDesempeno>('cumpl');

  const sorted = useMemo(() => [...kams].sort((a, b) => {
    const ytdA = a.metaYTDUSD ?? a.metaAnualUSD;
    const ytdB = b.metaYTDUSD ?? b.metaAnualUSD;
    // Sin meta no hay cumplimiento: queda en 0 y ordena al final en vez de
    // encabezar el ranking con un porcentaje inventado.
    const cumplA = tieneMeta(ytdA, a.nombre) ? a.avanceAnualUSD / ytdA : 0;
    const cumplB = tieneMeta(ytdB, b.nombre) ? b.avanceAnualUSD / ytdB : 0;
    if (sort === 'revenue') return b.avanceAnualUSD - a.avanceAnualUSD;
    if (sort === 'consistencia') {
      const ca = consMap.get(`${a.nombre}|${a.pais}`);
      const cb = consMap.get(`${b.nombre}|${b.pais}`);
      return (cb ? cb.mesesCumplidos / Math.min(cb.totalMeses, mes) : 0) - (ca ? ca.mesesCumplidos / Math.min(ca.totalMeses, mes) : 0);
    }
    if (sort === 'runrate') {
      const rr = (k: typeof kams[0]) => mes > 0 ? (k.avanceAnualUSD / mes) * 12 : 0;
      return rr(b) - rr(a);
    }
    return cumplB - cumplA;
  }), [kams, sort, consMap, mes]);

  const SORTS: { v: SortDesempeno; l: string }[] = [
    { v: 'cumpl', l: '% Cumpl.' }, { v: 'revenue', l: 'Venta' },
    { v: 'consistencia', l: 'Consistencia' }, { v: 'runrate', l: 'Proyección' },
  ];

  return (
    <>
      <SortBar opts={SORTS} active={sort} onChange={v => setSort(v as SortDesempeno)} />
      <TableShell headers={[
        '#', 'Ejecutivo', 'Venta YTD', 'Meta YTD', 'Cumpl.',
        { label: 'Consistencia', tooltip: `Meses en que el ejecutivo cumplió su meta mensual (de los ${mes} meses transcurridos). Ej: 4/${mes}m = cumplió 4 de ${mes} meses.` },
        { label: 'Proyección', tooltip: 'Venta anual estimada al ritmo actual: (venta YTD ÷ meses transcurridos) × 12. Indica si el ejecutivo va camino a superar o quedar corto de su meta.' },
      ]}>
        {sorted.map((k, i) => {
          const metaYTD  = k.metaYTDUSD ?? k.metaAnualUSD;
          const conMeta  = tieneMeta(metaYTD, k.nombre);
          const ytdCumpl = conMeta ? k.avanceAnualUSD / metaYTD : 0;
          const color    = conMeta ? pctColor(ytdCumpl) : '#cbd5e1';
          const runRate  = mes > 0 ? (k.avanceAnualUSD / mes) * 12 : 0;
          const cons     = consMap.get(`${k.nombre}|${k.pais}`);
          const totalMesCapped = cons ? Math.min(cons.totalMeses, mes) : mes;
          const consPct  = cons ? cons.mesesCumplidos / Math.max(totalMesCapped, 1) : null;
          return (
            <tr key={k.nombre + k.pais} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
              <RankCell rank={i + 1} color={i < 3 ? color : '#cbd5e1'} />
              <NameCell nombre={k.nombre} pais={k.pais} />
              <td className="px-3 py-3.5 text-right">
                <p className="text-sm font-bold tabular-nums text-[#0097A7]">{fmtUSD(k.avanceAnualUSD)}</p>
                {conMeta && <MiniBar pct={ytdCumpl} color={color} h={3} />}
              </td>
              <td className="px-3 py-3.5 text-right tabular-nums text-sm text-slate-400">
                {conMeta ? fmtUSD(metaYTD) : (
                  <span className="text-slate-300"
                        title={esPersona(k.nombre)
                          ? 'Sin meta cargada'
                          : 'No es un ejecutivo: es la venta no atribuida del país, sin meta propia'}>—</span>
                )}
              </td>
              <td className="px-3 py-3.5 w-36">
                {conMeta ? (
                  <div className="flex items-center gap-2">
                    <MiniBar pct={ytdCumpl} color={color} h={6} />
                    <span className="text-xs font-bold tabular-nums w-11 text-right flex-shrink-0" style={{ color }}>
                      {(ytdCumpl * 100).toFixed(1)}%
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-300"
                        title={esPersona(k.nombre)
                          ? 'Sin meta cargada: no se calcula cumplimiento'
                          : 'Venta no atribuida a un ejecutivo: no se le mide cumplimiento'}>—</span>
                )}
              </td>
              <td className="px-3 py-3.5 w-32">
                {cons ? (
                  <div className="flex items-center gap-2">
                    <MiniBar pct={consPct ?? 0} color={consPct !== null ? pctColor(consPct) : '#cbd5e1'} h={6} />
                    <span className="text-xs tabular-nums text-slate-600 flex-shrink-0">{cons.mesesCumplidos}/{totalMesCapped}m</span>
                  </div>
                ) : <span className="text-slate-300 text-xs">—</span>}
              </td>
              <td className="px-4 py-3.5 text-right">
                <p className="text-xs font-semibold tabular-nums text-slate-600">{fmtUSD(runRate)}</p>
                <p className="text-[9px] text-slate-400">proyec. anual</p>
              </td>
            </tr>
          );
        })}
      </TableShell>
    </>
  );
}

// ── sub-tab: Cartera ──────────────────────────────────────────────────────────

const MESES_NOMBRES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

type SortCartera = 'ejecutivo' | 'activos' | 'nuevos_anio' | 'nuevos_mes' | 'recurrencia' | 'dias_sc' | 'perdidos';

function SortTh({ label, col, active, onSort, title, align = 'right' }: { label: string; col: SortCartera; active: SortCartera; onSort: (c: SortCartera) => void; title?: string; align?: 'left' | 'right' }) {
  const isActive = active === col;
  return (
    <th
      onClick={() => onSort(col)}
      title={title}
      className={`px-3 py-3 text-${align} text-[10px] font-semibold uppercase tracking-wide cursor-pointer select-none transition-colors whitespace-nowrap ${
        isActive ? 'text-[#0097A7]' : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      <span className={`inline-flex items-center justify-${align === 'left' ? 'start' : 'end'} gap-1`}>
        {label}
        {title && <span className="opacity-40 text-[9px] font-normal normal-case tracking-normal">ⓘ</span>}
        <span className={`text-[8px] ${isActive ? 'opacity-100' : 'opacity-0'}`}>▼</span>
      </span>
    </th>
  );
}

function TablaCartera({ kams, filtroPais, anio, mes, onSelectKam, nuevosData, nuevosLoading }: {
  kams: KamSummary[]; filtroPais: string; anio: number; mes: number;
  onSelectKam: (nombre: string, pais: string) => void;
  nuevosData: ReturnType<typeof useKamsNuevos>['data'];
  nuevosLoading: boolean;
}) {
  const mesLabel = `${MESES_NOMBRES[mes - 1]}`;

  const [sort, setSort] = useState<SortCartera>('nuevos_anio');

  // Nuevos mensuales por KAM desde Consolidada (best-effort)
  const nuevosMesMap = useMemo(() => {
    const m = new Map<string, number>();
    (nuevosData?.kams ?? [])
      .filter(k => filtroPais === 'Todos' || k.pais === filtroPais)
      .forEach(k => m.set(`${k.nombre}|${k.pais}`, k.nuevos));
    return m;
  }, [nuevosData, filtroPais]);

  // Nuevos anuales desde kamsCartera (num_anios=1, confiable)
  const kamsConNuevos = useMemo(() =>
    kams.map(k => ({
      ...k,
      nuevos_mes: nuevosMesMap.get(`${k.nombre}|${k.pais}`) ?? 0,
    })),
    [kams, nuevosMesMap]
  );

  const sorted = useMemo(() => [...kamsConNuevos].sort((a, b) => {
    if (sort === 'ejecutivo')   return a.nombre.localeCompare(b.nombre, 'es');
    if (sort === 'nuevos_anio') return b.nuevos_anio - a.nuevos_anio;
    if (sort === 'nuevos_mes')  return b.nuevos_mes - a.nuevos_mes;
    if (sort === 'recurrencia') return b.pct_recurrencia - a.pct_recurrencia;
    if (sort === 'dias_sc')     return a.dias_sc_prom - b.dias_sc_prom;
    if (sort === 'perdidos')    return b.perdidos - a.perdidos;
    return b.activos - a.activos;
  }), [kamsConNuevos, sort]);

  const maxActivos = Math.max(...sorted.map(k => k.activos), 1);

  const totales = useMemo(() => {
    let nuevosMes = 0;
    if (nuevosData) {
      nuevosMes = filtroPais === 'Todos' ? nuevosData.total : (nuevosData.totalPorPais[filtroPais] ?? 0);
    }
    return {
      activos:      kamsConNuevos.reduce((s, k) => s + k.activos, 0),
      nuevosAnio:   kamsConNuevos.reduce((s, k) => s + k.nuevos_anio, 0),
      nuevosMes,
      recurrentes:  kamsConNuevos.reduce((s, k) => s + k.recurrentes, 0),
      estacionales: kamsConNuevos.reduce((s, k) => s + k.estacionales, 0),
      perdidos:     kamsConNuevos.reduce((s, k) => s + k.perdidos, 0),
    };
  }, [kamsConNuevos, nuevosData, filtroPais]);

  return (
    <>
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: 'Activos',       value: totales.activos,     color: '#0097A7', sub: undefined },
          { label: `Nuevos ${anio}`, value: totales.nuevosAnio, color: '#6366f1',
            sub: totales.nuevosMes > 0 ? `${totales.nuevosMes} en ${mesLabel}` : undefined },
          { label: 'Recurrentes',   value: totales.recurrentes,  color: '#10b981', sub: undefined },
          { label: 'Estacionales',  value: totales.estacionales, color: '#f59e0b', sub: undefined },
          { label: 'Sin actividad', value: totales.perdidos,      color: '#ef4444', sub: undefined },
        ].map(card => (
          <div key={card.label}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex flex-col gap-0.5"
            style={{ borderTop: `3px solid ${card.color}` }}
          >
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{card.label}</span>
            <span className="text-2xl font-black tabular-nums leading-tight" style={{ color: card.color }}>
              {card.value.toLocaleString()}
            </span>
            {card.sub && <span className="text-[10px] text-slate-400">{card.sub}</span>}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wide w-8">#</th>
              <SortTh label="Ejecutivo" col="ejecutivo" active={sort} onSort={setSort} align="left" />
              <SortTh label="Activos" col="activos" active={sort} onSort={setSort}
                title="Clientes con al menos una compra en los últimos 12 meses" />
              <SortTh label={`Nuevos ${anio}`} col="nuevos_anio" active={sort} onSort={setSort}
                title={`Clientes en su primer año de vida (num_anios = 1) al ${anio}`} />
              <SortTh label={`Nuevos ${mesLabel}`} col="nuevos_mes" active={sort} onSort={setSort}
                title={`Clientes cuya primera compra histórica fue en ${mesLabel} ${anio}`} />
              <th className="px-3 py-3 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wide"
                title="Clientes que compran con frecuencia consistente (tipo = recurrente)">Recurrentes</th>
              <th className="px-3 py-3 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wide"
                title="Clientes que compran solo en ciertas épocas del año (tipo = estacional)">Estacionales</th>
              <SortTh label="% Recurrencia" col="recurrencia" active={sort} onSort={setSort}
                title="% de clientes activos que son recurrentes (recurrentes / activos)" />
              <SortTh label="Días s/c" col="dias_sc" active={sort} onSort={setSort}
                title="Promedio de días desde la última compra. Más alto = mayor riesgo de fuga" />
              <SortTh label="Sin actividad" col="perdidos" active={sort} onSort={setSort}
                title="Clientes que llevan tanto tiempo sin comprar que el sistema los marca como perdidos históricos" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((k, i) => (
              <tr
                key={k.nombre + k.pais}
                onClick={() => onSelectKam(k.nombre, k.pais)}
                className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors group cursor-pointer"
              >
                <td className="px-4 py-3">
                  <span className="text-xs font-bold text-slate-300 tabular-nums">{i + 1}</span>
                </td>
                <NameCell nombre={k.nombre} pais={k.pais} />
                {/* Activos */}
                <td className="px-3 py-3">
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-sm font-bold tabular-nums ${sort === 'activos' ? 'text-[#0097A7]' : 'text-slate-800'}`}>{k.activos}</span>
                    <div className="w-16 h-1 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-[#0097A7]/50 group-hover:bg-[#0097A7] transition-colors" style={{ width: `${Math.min((k.activos / maxActivos) * 100, 100)}%` }} />
                    </div>
                  </div>
                </td>
                {/* Nuevos año */}
                <td className="px-3 py-3 text-right">
                  <span className={`text-sm font-bold tabular-nums ${sort === 'nuevos_anio' ? 'text-indigo-600' : 'text-slate-700'}`}>
                    {k.nuevos_anio > 0 ? k.nuevos_anio : '—'}
                  </span>
                </td>
                {/* Nuevos mes */}
                <td className="px-3 py-3 text-right">
                  <span className={`text-sm tabular-nums ${sort === 'nuevos_mes' ? 'text-indigo-500 font-semibold' : 'text-slate-400'}`}>
                    {nuevosLoading ? '…' : (k.nuevos_mes > 0 ? k.nuevos_mes : '—')}
                  </span>
                </td>
                {/* Recurrentes */}
                <td className="px-3 py-3 text-right">
                  <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 tabular-nums">
                    {k.recurrentes}
                  </span>
                </td>
                {/* Estacionales */}
                <td className="px-3 py-3 text-right">
                  <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 tabular-nums">
                    {k.estacionales}
                  </span>
                </td>
                {/* % Recurrencia */}
                <td className="px-3 py-3">
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-bold tabular-nums" style={{ color: k.pct_recurrencia >= 0.4 ? '#10b981' : k.pct_recurrencia >= 0.2 ? '#f59e0b' : '#ef4444' }}>
                      {(k.pct_recurrencia * 100).toFixed(0)}%
                    </span>
                    <div className="w-16 h-1 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(k.pct_recurrencia * 100, 100)}%`, background: k.pct_recurrencia >= 0.4 ? '#10b981' : k.pct_recurrencia >= 0.2 ? '#f59e0b' : '#ef4444' }} />
                    </div>
                  </div>
                </td>
                {/* Días s/c */}
                <td className="px-3 py-3 text-right">
                  <span className={`text-sm font-semibold tabular-nums ${k.dias_sc_prom > 180 ? 'text-red-500' : k.dias_sc_prom > 90 ? 'text-amber-500' : 'text-emerald-600'}`}>
                    {k.dias_sc_prom > 0 ? `${k.dias_sc_prom}d` : '—'}
                  </span>
                </td>
                {/* Sin actividad */}
                <td className="px-4 py-3 text-right">
                  {k.perdidos > 0
                    ? <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-500 tabular-nums">{k.perdidos}</span>
                    : <span className="text-slate-300 text-xs">—</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── sub-tab: Ticket & Actividad ───────────────────────────────────────────────

type SortTicket = 'vol_6m' | 'ticket' | 'facturas';

const TICKET_SORTS: { v: SortTicket; l: string; desc: string }[] = [
  {
    v: 'vol_6m',
    l: 'Vol. 6m',
    desc: 'Ranking por volumen de venta promedio por cliente en los últimos 6 meses. Indica el valor monetario que cada ejecutivo genera en su cartera activa.',
  },
  {
    v: 'ticket',
    l: 'Ticket unit.',
    desc: 'Ranking por ticket unitario promedio (volumen 6m ÷ facturas). Refleja cuánto compra un cliente en cada pedido — útil para detectar quién vende productos de mayor valor.',
  },
  {
    v: 'facturas',
    l: 'Facturas',
    desc: 'Ranking por número de facturas promedio por cliente. Más facturas indica mayor frecuencia de compra y relación comercial más activa.',
  },
];

function TablaTicket({ kams, rankMap }: { kams: KamSummary[]; rankMap: Map<string, number> }) {
  const [sort, setSort] = useState<SortTicket>('vol_6m');

  const sorted = useMemo(() => [...kams].sort((a, b) => {
    if (sort === 'ticket')   return b.ticket_unitario - a.ticket_unitario;
    if (sort === 'facturas') return b.facturas_prom - a.facturas_prom;
    return b.vol_6m_prom - a.vol_6m_prom;
  }), [kams, sort]);

  const activeDesc = TICKET_SORTS.find(s => s.v === sort)?.desc ?? '';
  const maxVol     = Math.max(...sorted.map(k => k.vol_6m_prom), 1);
  const maxTicket  = Math.max(...sorted.map(k => k.ticket_unitario), 1);
  const maxFacturas = Math.max(...sorted.map(k => k.facturas_prom), 1);

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mr-1">Ordenar:</span>
          {TICKET_SORTS.map(o => (
            <button
              key={o.v}
              onClick={() => setSort(o.v)}
              aria-pressed={sort === o.v}
              className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition-all active:scale-95 ${
                sort === o.v
                  ? 'bg-[#0097A7] text-white border-[#0097A7]'
                  : 'border-slate-200 text-slate-500 hover:border-[#0097A7] hover:text-[#0097A7]'
              }`}
            >{o.l}</button>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed max-w-2xl">{activeDesc}</p>
      </div>
      <TableShell headers={['#', 'Ejecutivo', 'Vol. 6m prom./cliente', 'Ticket unitario', 'Facturas prom./cliente', 'Venta / cliente activo']}>
        {sorted.map((k, i) => {
          const revPorCliente = rankMap.get(`${k.nombre}|${k.pais}`) && k.activos > 0
            ? (rankMap.get(`${k.nombre}|${k.pais}`) ?? 0) / k.activos
            : 0;
          return (
            <tr key={k.nombre + k.pais} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
              <RankCell rank={i + 1} color='#cbd5e1' />
              <NameCell nombre={k.nombre} pais={k.pais} />
              {/* Vol 6m prom */}
              <td className="px-3 py-3.5">
                <div className="flex items-center gap-2">
                  <MiniBar pct={k.vol_6m_prom / maxVol} color="#0097A7" h={6} />
                  <span className="text-sm font-bold tabular-nums text-slate-700 flex-shrink-0 w-16 text-right">{fmtUSD(k.vol_6m_prom)}</span>
                </div>
              </td>
              {/* Ticket unitario */}
              <td className="px-3 py-3.5">
                {sort === 'ticket' ? (
                  <div className="flex items-center gap-2">
                    <MiniBar pct={k.ticket_unitario / maxTicket} color="#0097A7" h={6} />
                    <span className="text-sm font-bold tabular-nums text-slate-700 flex-shrink-0 w-16 text-right">{k.ticket_unitario > 0 ? fmtUSD(k.ticket_unitario) : '—'}</span>
                  </div>
                ) : (
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums text-slate-700">{k.ticket_unitario > 0 ? fmtUSD(k.ticket_unitario) : '—'}</p>
                    <p className="text-[9px] text-slate-400">por factura</p>
                  </div>
                )}
              </td>
              {/* Facturas prom */}
              <td className="px-3 py-3.5">
                {sort === 'facturas' ? (
                  <div className="flex items-center gap-2">
                    <MiniBar pct={k.facturas_prom / maxFacturas} color="#0097A7" h={6} />
                    <span className="text-sm font-bold tabular-nums text-slate-700 flex-shrink-0 w-16 text-right">{k.facturas_prom.toFixed(1)}</span>
                  </div>
                ) : (
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums text-slate-700">{k.facturas_prom.toFixed(1)}</p>
                    <p className="text-[9px] text-slate-400">facturas / cliente</p>
                  </div>
                )}
              </td>
              {/* Revenue por cliente */}
              <td className="px-4 py-3.5 text-right">
                <p className="text-sm font-semibold tabular-nums text-[#0097A7]">{revPorCliente > 0 ? fmtUSD(revPorCliente) : '—'}</p>
                <p className="text-[9px] text-slate-400">anual / activo</p>
              </td>
            </tr>
          );
        })}
      </TableShell>
    </>
  );
}

// ── componentes compartidos ───────────────────────────────────────────────────

function SortBar<T extends string>({ opts, active, onChange }: { opts: { v: T; l: string }[]; active: T; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mr-1">Ordenar:</span>
      {opts.map(o => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          aria-pressed={active === o.v}
          className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition-all active:scale-95 ${
            active === o.v
              ? 'bg-[#0097A7] text-white border-[#0097A7]'
              : 'border-slate-200 text-slate-500 hover:border-[#0097A7] hover:text-[#0097A7]'
          }`}
        >{o.l}</button>
      ))}
    </div>
  );
}

type TableHeader = string | { label: string; tooltip: string };

function TableShell({ headers, children }: { headers: TableHeader[]; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-slate-100">
            {headers.map((h, i) => {
              const label   = typeof h === 'string' ? h : h.label;
              const tooltip = typeof h === 'string' ? undefined : h.tooltip;
              return (
                <th key={i} title={tooltip}
                  className={`px-${i === 0 || i === headers.length - 1 ? '4' : '3'} py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide ${i > 1 ? 'text-right' : 'text-left'} ${i === 1 ? 'text-left' : ''} ${tooltip ? 'cursor-help' : ''}`}>
                  {label}{tooltip && <span className="ml-0.5 opacity-40 text-[9px] font-normal normal-case tracking-normal">ⓘ</span>}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function RankCell({ rank, color }: { rank: number; color: string }) {
  return (
    <td className="px-4 py-3.5">
      <span className="inline-flex w-5 h-5 rounded-full items-center justify-center text-[9px] font-black text-white" style={{ background: color }}>
        {rank}
      </span>
    </td>
  );
}

function NameCell({ nombre, pais }: { nombre: string; pais: string }) {
  const cc = FLAG_CC[pais];
  return (
    <td className="px-3 py-3.5">
      <div className="flex items-center gap-2">
        {cc && <img src={`https://flagcdn.com/16x12/${cc}.png`} width={14} height={10} alt={pais} className="rounded-sm flex-shrink-0" />}
        <div>
          <p className="text-sm font-semibold text-slate-800 leading-tight whitespace-nowrap">{nombre}</p>
          <p className="text-[10px] text-slate-400">{pais}</p>
        </div>
      </div>
    </td>
  );
}

// ── PorEjecutivoTab ───────────────────────────────────────────────────────────

export function PorEjecutivoTab({ anio, mes, filterPais }: PorEjecutivoTabProps) {
  const { data: rankData, isLoading: rankLoading } = useRanking(anio);
  const { data: rolesData } = useRoles();
  const { data: carteraData, isLoading: carteraLoading } = useKamsSummary(anio, rolesData);
  const { data: nuevosData, isLoading: nuevosLoading } = useKamsNuevos(anio, mes);

  const [subTab, setSubTab] = useState<SubTab>('desempeno');
  const [filtroPais, setFiltroPais] = useState(filterPais ?? 'Todos');
  const [filtroRol, setFiltroRol] = useState('Todos');
  const { track } = useTrack();
  const [panelKam, setPanelKam] = useState<{ nombre: string; pais: string } | null>(null);

  const mesActual = mes || (new Date().getMonth() + 1);

  const consMap = useMemo(
    () => new Map((rankData?.consistencia ?? []).map(c => [`${c.nombre}|${c.pais}`, c])),
    [rankData]
  );

  // KAMs del ranking filtrados — rolesData tiene alias (ID, nombre completo, primer nombre)
  const kamsRanking = useMemo(() =>
    (rankData?.kams ?? [])
      .filter(k => !EXCLUDED.has(k.nombre))
      .filter(k => filtroPais === 'Todos' || k.pais === filtroPais)
      .filter(k => filtroRol === 'Todos' || (rolesData?.[k.nombre] ?? 'KAM') === filtroRol),
    [rankData, filtroPais, filtroRol, rolesData]
  );

  // KAMs de cartera — incluye BDM y Full Cycle aunque no tengan meta en el ranking
  const kamsCartera = useMemo(() =>
    (carteraData?.kams ?? [])
      .filter(k => !EXCLUDED.has(k.nombre))
      .filter(k => filtroPais === 'Todos' || k.pais === filtroPais)
      .filter(k => filtroRol === 'Todos' || k.rol === filtroRol),
    [carteraData, filtroPais, filtroRol]
  );

  const rankMap = useMemo(
    () => new Map((rankData?.kams ?? []).map(k => [`${k.nombre}|${k.pais}`, k.avanceAnualUSD])),
    [rankData]
  );

  const isLoading = rankLoading || (subTab !== 'desempeno' && carteraLoading);

  const SUB_TABS: { v: SubTab; l: string; desc: string }[] = [
    { v: 'desempeno', l: 'Desempeño',       desc: 'Venta, meta, gap, consistencia, run rate' },
    { v: 'cartera',   l: 'Cartera',          desc: 'Clientes activos, recurrencia, días sin compra' },
    { v: 'ticket',    l: 'Ticket & Actividad', desc: 'Volumen por cliente, facturas, score retención' },
  ];

  return (
    <div className="flex flex-col gap-4">

      {/* Filtros */}
      <div className="flex flex-col gap-2">
        {/* País — oculto cuando viene filtrado desde el rol */}
        {!filterPais && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide w-10 flex-shrink-0">País</span>
          {PAISES.map(p => {
            const cc = p !== 'Todos' ? FLAG_CC[p] : null;
            return (
              <button
                key={p}
                onClick={() => setFiltroPais(p)}
                aria-pressed={filtroPais === p}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
                  filtroPais === p
                    ? 'bg-[#0097A7] text-white border-[#0097A7]'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-[#0097A7]'
                }`}
              >
                {cc && <img src={`https://flagcdn.com/16x12/${cc}.png`} width={14} height={10} alt={p} className="rounded-sm" />}
                {p}
              </button>
            );
          })}
        </div>
        )}
        {/* Tipo ejecutivo. BDM se puede seleccionar en los tres sub-tabs; en
            Desempeño la tabla queda vacía y lo explica ahí, en vez de esconder la
            opción — esta fila se dibuja ARRIBA de los sub-tabs, así que parece un
            filtro global y omitir una opción según el sub-tab desconcierta. */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide w-10 flex-shrink-0">Rol</span>
          {ROLES.map(r => (
            <button
              key={r}
              // El detalle importa: es la única forma de saber si el filtro BDM
              // que acabamos de agregar se usa o quedó de adorno.
              onClick={() => { setFiltroRol(r); track('desempeno:ejecutivo:rol', r); }}
              aria-pressed={filtroRol === r}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
                filtroRol === r
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-violet-400'
              }`}
            >{r}</button>
          ))}
        </div>
      </div>

      {/* Sub-menús */}
      <div className="flex gap-0 border-b border-slate-200">
        {SUB_TABS.map(t => (
          <button
            key={t.v}
            onClick={() => { setSubTab(t.v); track(`desempeno:ejecutivo:${t.v}`); }}
            aria-current={subTab === t.v ? 'page' : undefined}
            className={`px-5 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-all whitespace-nowrap ${
              subTab === t.v
                ? 'border-[#0097A7] text-[#0097A7]'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200'
            }`}
          >
            {t.l}
          </button>
        ))}
        <div className="flex-1" />
        {subTab !== 'desempeno' && carteraLoading && (
          <span className="self-center mr-2 w-3 h-3 rounded-full border-2 border-[#0097A7] border-t-transparent animate-spin" />
        )}
      </div>

      {/* Hint de columnas */}
      <p className="text-[10px] text-slate-400 -mt-2">
        {SUB_TABS.find(t => t.v === subTab)?.desc}
      </p>

      {/* Contenido */}
      {isLoading ? (
        <div className="flex flex-col gap-2 animate-pulse">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-14 bg-slate-100 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {subTab === 'desempeno' && (
            kamsRanking.length === 0
              ? <p className="text-center text-slate-400 text-sm py-12">
                  {filtroRol === 'BDM'
                    ? 'Los BDM no tienen meta asignada, así que no entran en venta vs. meta. Su cartera está en Cartera y en Ticket & Actividad.'
                    : 'Sin datos de desempeño'}
                </p>
              : <TablaDesempeno kams={kamsRanking} consMap={consMap} mes={mesActual} />
          )}
          {subTab === 'cartera' && (
            kamsCartera.length === 0
              ? <p className="text-center text-slate-400 text-sm py-12">Sin datos de cartera</p>
              : <TablaCartera kams={kamsCartera} filtroPais={filtroPais} anio={anio} mes={mes}
                  onSelectKam={(nombre, pais) => setPanelKam({ nombre, pais })}
                  nuevosData={nuevosData} nuevosLoading={nuevosLoading} />
          )}
          {subTab === 'ticket' && (
            kamsCartera.length === 0
              ? <p className="text-center text-slate-400 text-sm py-12">Sin datos de ticket</p>
              : <TablaTicket kams={kamsCartera} rankMap={rankMap} />
          )}
        </>
      )}

      {panelKam && (
        <ClientesPanel
          kamNombre={panelKam.nombre}
          kamPais={panelKam.pais}
          onClose={() => setPanelKam(null)}
        />
      )}
    </div>
  );
}
