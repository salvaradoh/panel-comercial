import { useState } from 'react';
import { useCartera } from '../../hooks/useCartera';
import { Card } from '../../components/ui/Card';
import type { KamEstacional, ClienteChurn, KamRecurrente, ClienteRec } from '../../hooks/types';

type TipoFiltro = 'todos' | 'estacional' | 'puntual' | 'primera_compra';

const FLAG_CC: Record<string, string> = {
  Chile: 'cl', Perú: 'pe', Peru: 'pe', Colombia: 'co', México: 'mx', Mexico: 'mx', Ecuador: 'ec',
};

const SEG_COLOR: Record<string, string> = {
  'A+': '#16a34a',
  A:    '#ca8a04',
  B:    '#ea580c',
  C:    '#dc2626',
};

function fmtUSD(v: number): string {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
}

function ScoreBadge({ score, segmento }: { score: number; segmento: string }) {
  const SEG_BG: Record<string, string> = {
    'A+': '#f0fdf4', A: '#fefce8', B: '#fff7ed', C: '#fef2f2',
  };
  const color = SEG_COLOR[segmento] || '#9ca3af';
  const bg = SEG_BG[segmento] || '#f9fafb';
  return (
    <span
      className="inline-flex items-center justify-center rounded-lg px-2 py-0.5 text-xs font-bold tabular-nums"
      style={{ color, background: bg, border: `1px solid ${color}44`, minWidth: 36 }}
    >
      {score.toFixed(2)}
    </span>
  );
}

interface KamRowProps {
  k: KamEstacional;
  pais?: string;
  tipo: TipoFiltro;
}

function KamRow({ k, tipo }: KamRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Aplicar filtro de tipo
  const stats = tipo === 'todos' ? k
    : tipo === 'estacional' ? { ...k, ...k.porTipo.estacional, churnPct: k.porTipo.estacional.base > 0 ? k.porTipo.estacional.churn / k.porTipo.estacional.base : 0, retPct: k.porTipo.estacional.base > 0 ? k.porTipo.estacional.ret / k.porTipo.estacional.base : 0, factPerd: k.porTipo.estacional.factPerd || 0, pctVtaPerd: 0 }
    : tipo === 'puntual' ? { ...k, ...k.porTipo.puntual, churnPct: k.porTipo.puntual.base > 0 ? k.porTipo.puntual.churn / k.porTipo.puntual.base : 0, retPct: k.porTipo.puntual.base > 0 ? k.porTipo.puntual.ret / k.porTipo.puntual.base : 0, factPerd: k.porTipo.puntual.factPerd || 0, pctVtaPerd: 0 }
    : { ...k, ...k.porTipo.primera_compra, churnPct: k.porTipo.primera_compra.base > 0 ? k.porTipo.primera_compra.churn / k.porTipo.primera_compra.base : 0, retPct: k.porTipo.primera_compra.base > 0 ? k.porTipo.primera_compra.ret / k.porTipo.primera_compra.base : 0, factPerd: k.porTipo.primera_compra.factPerd || 0, pctVtaPerd: 0 };

  const clientesFiltrados: ClienteChurn[] = tipo === 'todos' ? k.clientesChurn
    : k.clientesChurn.filter(c => c.subSeg === tipo || (tipo === 'primera_compra' && c.subSeg === 'primera_compra'));

  const MAX_VISIBLE = 8;
  const clientesVisibles = showAll ? clientesFiltrados : clientesFiltrados.slice(0, MAX_VISIBLE);
  const hayMas = clientesFiltrados.length > MAX_VISIBLE;

  return (
    <>
      <tr
        className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-2.5">
          <span className="text-sm font-semibold text-slate-700">{k.kam}</span>
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums text-slate-500 text-sm">{stats.base}</td>
        <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600 font-semibold text-sm">{stats.ret}</td>
        <td className="px-3 py-2.5 text-right tabular-nums text-red-500 font-semibold text-sm">{stats.churn}</td>
        <td className="px-3 py-2.5 text-right tabular-nums text-red-500 text-sm">{(stats.churnPct * 100).toFixed(1)}%</td>
        <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600 text-sm">{(stats.retPct * 100).toFixed(1)}%</td>
        <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 text-sm">{fmtUSD(stats.volumen)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums text-red-500 font-semibold text-sm">{fmtUSD(stats.factPerd)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums text-slate-500 text-sm">{(stats.pctVtaPerd * 100).toFixed(1)}%</td>
        <td className="px-3 py-2.5 text-right tabular-nums text-slate-500 text-sm">{k.churn1ra}</td>
        <td className="px-4 py-2.5 text-right">
          {k.scoreEst > 0
            ? <ScoreBadge score={k.scoreEst} segmento={k.scoreEst >= 3.5 ? 'A+' : k.scoreEst >= 3.0 ? 'A' : k.scoreEst >= 2.0 ? 'B' : 'C'} />
            : <span className="text-slate-300 text-xs">—</span>
          }
          <span className="text-slate-400 text-xs ml-1">{expanded ? '▲' : '▼'} Ver</span>
        </td>
      </tr>
      {expanded && clientesFiltrados.length > 0 && (
        <tr>
          <td colSpan={11} className="bg-slate-50 px-0 pb-2 border-l-2 border-[#0097A7]">
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-200">
                    <th className="text-left px-8 py-1.5 font-medium">Empresa</th>
                    <th className="text-right px-3 py-1.5 font-medium">Volumen</th>
                    <th className="text-right px-3 py-1.5 font-medium">Fact. Perdida</th>
                    <th className="text-right px-3 py-1.5 font-medium">Última Compra</th>
                    <th className="text-right px-3 py-1.5 font-medium">Días sin comprar</th>
                    <th className="text-right px-4 py-1.5 font-medium">Score Est.</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesVisibles.map((c, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-white transition-colors">
                      <td className="px-8 py-1.5 text-slate-700 font-medium truncate max-w-xs">{c.empresa}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{fmtUSD(c.volumen)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-red-500 font-semibold">{fmtUSD(c.factPerd)}</td>
                      <td className="px-3 py-1.5 text-right text-slate-500">{c.ultimaCompra}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        <span className={c.diasSinCompra > 180 ? 'text-red-500 font-semibold' : c.diasSinCompra > 90 ? 'text-amber-500' : 'text-slate-500'}>
                          {c.diasSinCompra}d
                        </span>
                      </td>
                      <td className="px-4 py-1.5 text-right">
                        <ScoreBadge score={c.score} segmento={c.segmento} />
                      </td>
                    </tr>
                  ))}
                  {hayMas && !showAll && (
                    <tr>
                      <td colSpan={6} className="px-8 py-2 text-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowAll(true); }}
                          className="text-xs text-[#0097A7] hover:underline"
                        >
                          Ver {clientesFiltrados.length - MAX_VISIBLE} clientes más
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ScoreRentModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 text-base">Score RENT — Fórmula</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Con NPS: <code className="bg-slate-100 px-1 rounded">R×35% + E×25% + N×15% + T×25%</code>
          <br />Sin NPS (sin respuesta): <code className="bg-slate-100 px-1 rounded">R×40% + E×30% + T×30%</code>
        </p>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500">
              <th className="text-left px-3 py-2 font-semibold">Dim.</th>
              <th className="text-left px-3 py-2 font-semibold">Qué mide</th>
              <th className="text-right px-3 py-2 font-semibold">4</th>
              <th className="text-right px-3 py-2 font-semibold">3</th>
              <th className="text-right px-3 py-2 font-semibold">2</th>
              <th className="text-right px-3 py-2 font-semibold">1</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="px-3 py-2 font-bold text-[#0097A7]">R</td>
              <td className="px-3 py-2 text-slate-600">Recencia (días s/c / TBP)</td>
              <td className="px-3 py-2 text-right text-emerald-600">≤1.0×</td>
              <td className="px-3 py-2 text-right text-amber-500">≤1.5×</td>
              <td className="px-3 py-2 text-right text-orange-500">≤2.0×</td>
              <td className="px-3 py-2 text-right text-red-500">&gt;2.0×</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-bold text-[#0097A7]">E</td>
              <td className="px-3 py-2 text-slate-600">Engagement (Churn Semanal 0–9)</td>
              <td className="px-3 py-2 text-right text-emerald-600">sin datos</td>
              <td className="px-3 py-2 text-right text-amber-500">≥5</td>
              <td className="px-3 py-2 text-right text-orange-500">≥3</td>
              <td className="px-3 py-2 text-right text-red-500">&lt;3</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-bold text-[#0097A7]">N</td>
              <td className="px-3 py-2 text-slate-600">NPS (encuesta periódica 0–10)</td>
              <td className="px-3 py-2 text-right text-emerald-600">9–10</td>
              <td className="px-3 py-2 text-right text-amber-500">7–8</td>
              <td className="px-3 py-2 text-right text-orange-500">5–6</td>
              <td className="px-3 py-2 text-right text-red-500">0–4</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-bold text-[#0097A7]">T</td>
              <td className="px-3 py-2 text-slate-600">Tendencia (vol 6m vs 6m ant.)</td>
              <td className="px-3 py-2 text-right text-emerald-600">&gt;+20%</td>
              <td className="px-3 py-2 text-right text-amber-500">estable</td>
              <td className="px-3 py-2 text-right text-orange-500">cayendo</td>
              <td className="px-3 py-2 text-right text-red-500">severa</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-4 bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-500">
          Segmentos: <span className="font-semibold text-emerald-600">A+</span> ≥3.50 · <span className="font-semibold text-amber-500">A</span> ≥3.00 · <span className="font-semibold text-orange-500">B</span> ≥2.00 · <span className="font-semibold text-red-500">C</span> &lt;2.00
        </div>
      </div>
    </div>
  );
}

interface KamRecRowProps {
  k: KamRecurrente;
  busqueda: string;
  riesgoFiltro: string;
  segFiltro: string;
  modoPH: boolean;
}

function KamRecRow({ k, busqueda, riesgoFiltro, segFiltro, modoPH }: KamRecRowProps) {
  const [expanded, setExpanded] = useState(false);

  const listaBase: ClienteRec[] = modoPH ? (k.clientesPH || []) : (k.clientes || []);

  const busq = busqueda.trim().toLowerCase();
  const listaFiltrada = listaBase
    .filter(c => !busq || c.empresa.toLowerCase().includes(busq))
    .filter(c => {
      if (riesgoFiltro === 'todos') return true;
      if (riesgoFiltro === 'saludable') return c.score >= 3.5;
      if (riesgoFiltro === 'monitorear') return c.score >= 3.0 && c.score < 3.5;
      if (riesgoFiltro === 'en_riesgo') return c.score >= 2.0 && c.score < 3.0;
      if (riesgoFiltro === 'critico') return c.score < 2.0;
      return true;
    })
    .filter(c => segFiltro === 'todos' || c.segmento === segFiltro);

  const hayMatch = busq !== '' && listaFiltrada.length > 0;
  const isOpen = expanded || hayMatch;

  // Ocultar fila completa si hay búsqueda pero no hay matches en este KAM
  if (busq && !listaBase.some(c => c.empresa.toLowerCase().includes(busq))) return null;

  return (
    <>
      <tr
        className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="py-2 font-medium text-slate-700 px-3">{k.kam}</td>
        <td className="py-2 text-right tabular-nums text-slate-500 px-3">{k.base}</td>
        <td className="py-2 text-right tabular-nums text-emerald-600 font-semibold px-3">{k.saludables}</td>
        <td className="py-2 text-right tabular-nums text-amber-500 font-semibold px-3">{k.monitorear}</td>
        <td className="py-2 text-right tabular-nums text-orange-500 font-semibold px-3">{k.enRiesgo}</td>
        <td className="py-2 text-right tabular-nums text-red-600 font-semibold px-3">{k.criticos}</td>
        <td className="py-2 text-right tabular-nums px-3">
          {(k.caidaUSD ?? k.montoPerdido ?? 0) > 0
            ? <span className="text-red-500 font-semibold">{fmtUSD(k.caidaUSD ?? k.montoPerdido ?? 0)}</span>
            : <span className="text-slate-300">—</span>
          }
        </td>
        <td className="py-2 text-right px-3">
          {k.scorePromedio > 0
            ? <ScoreBadge score={k.scorePromedio} segmento={k.scorePromedio >= 3.5 ? 'A+' : k.scorePromedio >= 3.0 ? 'A' : k.scorePromedio >= 2.0 ? 'B' : 'C'} />
            : <span className="text-slate-300 text-xs">—</span>
          }
          <span className="text-slate-400 text-xs ml-1">{isOpen ? '▲' : '▼'}</span>
        </td>
      </tr>
      {isOpen && listaFiltrada.length > 0 && (
        <tr>
          <td colSpan={8} className="bg-slate-50 px-0 pb-1 border-l-2 border-[#1565C0]">
            <div className="max-h-56 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-200">
                    <th className="text-left px-6 py-1.5 font-medium">Empresa</th>
                    <th className="text-right px-3 py-1.5 font-medium">Volumen</th>
                    <th className="text-right px-3 py-1.5 font-medium">Días s/c</th>
                    <th className="text-right px-4 py-1.5 font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {listaFiltrada.map((c, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-white transition-colors">
                      <td className="px-6 py-1.5 text-slate-700 truncate max-w-[200px]">{c.empresa}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{fmtUSD(c.volumen)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        <span className={c.diasSinCompra > 180 ? 'text-red-500 font-semibold' : c.diasSinCompra > 90 ? 'text-amber-500' : 'text-slate-500'}>
                          {c.diasSinCompra}d
                        </span>
                      </td>
                      <td className="px-4 py-1.5 text-right">
                        <ScoreBadge score={c.score} segmento={c.segmento} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

interface SaludTabProps {
  tipo: 'estacionales' | 'recurrentes';
  anio: number;
}

export function SaludTab({ tipo, anio }: SaludTabProps) {
  const { data, isLoading } = useCartera(anio);
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todos');
  const [expandedPaises, setExpandedPaises] = useState<Set<string>>(new Set(['Chile']));
  // Recurrentes filters
  const [busqueda, setBusqueda] = useState('');
  const [riesgoFiltro, setRiesgoFiltro] = useState<'todos'|'saludable'|'monitorear'|'en_riesgo'|'critico'>('todos');
  const [segFiltro, setSegFiltro] = useState<'todos'|'A+'|'A'|'B'|'C'>('todos');
  const [modoPH, setModoPH] = useState(false);
  const [showScoreModal, setShowScoreModal] = useState(false);

  if (isLoading) return <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />;

  if (data?._placeholder || !data) {
    return (
      <Card>
        <p className="text-slate-400 text-sm text-center py-8">
          Cache_Churn no disponible. Ejecutar <code className="bg-slate-100 px-1 rounded">generarCacheChurn()</code> en GAS.
        </p>
      </Card>
    );
  }

  // ── ESTACIONALES ──
  if (tipo === 'estacionales') {
    const g = data.estacionales.globales;
    const paises = data.estacionales.paises;

    return (
      <div className="flex flex-col gap-4">
        {/* Cards globales */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Churn Global (13M)</p>
            <p className="text-3xl font-bold text-red-500 tabular-nums mt-1">{((g.churn_pct || 0) * 100).toFixed(1)}%</p>
            <p className="text-xs text-slate-400 mt-1">{g.churn} en Churn de {g.base} clientes base</p>
          </Card>
          <Card>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Facturación Perdida</p>
            <p className="text-3xl font-bold text-red-500 tabular-nums mt-1">{fmtUSD(g.fact_perd || 0)}</p>
            <p className="text-xs text-slate-400 mt-1">% sobre volumen total: {((g.pct_vta_perd || 0) * 100).toFixed(1)}%</p>
          </Card>
          <Card>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Churn 1ra Compra</p>
            <p className="text-3xl font-bold text-slate-700 tabular-nums mt-1">{g.churn1ra || 0}</p>
            <p className="text-xs text-slate-400 mt-1">Clientes con 1 sola compra en toda su historia</p>
          </Card>
        </div>

        {/* Filtro TIPO — solo para estacionales */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo:</span>
          {([['todos', 'Todos'], ['estacional', 'Estacional'], ['puntual', 'Puntual'], ['primera_compra', '1ra Compra']] as [TipoFiltro, string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setTipoFiltro(val)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all active:scale-95 ${
                tipoFiltro === val
                  ? 'bg-[#0097A7] text-white border-[#0097A7] font-semibold'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-[#0097A7]'
              }`}
              aria-pressed={tipoFiltro === val}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Acordeón por país */}
        {paises.map(p => {
          const cc = FLAG_CC[p.pais];
          const isOpen = expandedPaises.has(p.pais);
          return (
            <div key={p.pais} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
                onClick={() => {
                  const next = new Set(expandedPaises);
                  if (isOpen) next.delete(p.pais); else next.add(p.pais);
                  setExpandedPaises(next);
                }}
                aria-expanded={isOpen}
              >
                <div className="flex items-center gap-3">
                  {cc && <img src={`https://flagcdn.com/24x18/${cc}.png`} width={22} height={16} alt={p.pais} className="rounded-sm" />}
                  <span className="font-bold text-slate-800 uppercase tracking-wide">{p.pais}</span>
                  <span className="text-xs text-slate-400">Últimos 13 meses</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-red-500 font-bold">Churn {((p.churnPct || 0) * 100).toFixed(1)}%</span>
                  <span className="text-slate-400">{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>

              {isOpen && (
                <div className="overflow-x-auto border-t border-slate-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-400 bg-slate-50 border-b border-slate-100">
                        <th className="text-left px-4 py-2 font-medium">KAM</th>
                        <th className="text-right px-3 py-2 font-medium">Base</th>
                        <th className="text-right px-3 py-2 font-medium text-emerald-600">Retenidos</th>
                        <th className="text-right px-3 py-2 font-medium text-red-500">Churn</th>
                        <th className="text-right px-3 py-2 font-medium">Churn%</th>
                        <th className="text-right px-3 py-2 font-medium">Ret%</th>
                        <th className="text-right px-3 py-2 font-medium">Volumen</th>
                        <th className="text-right px-3 py-2 font-medium text-red-400">Fact. Perdida</th>
                        <th className="text-right px-3 py-2 font-medium">%Vta Perd</th>
                        <th className="text-right px-3 py-2 font-medium">1ra Compra</th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {p.kams.map((k, i) => (
                        <KamRow key={i} k={k} pais={p.pais} tipo={tipoFiltro} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── RECURRENTES ──
  const g = data.recurrentes.globales;
  const paises = data.recurrentes.paises;

  return (
    <div className="flex flex-col gap-4">
      {showScoreModal && <ScoreRentModal onClose={() => setShowScoreModal(false)} />}

      {/* Cards globales recurrentes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Recurrentes</p>
          <p className="text-3xl font-bold text-slate-700 tabular-nums mt-1">{g.total || 0}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Saludables</p>
          <p className="text-3xl font-bold text-emerald-600 tabular-nums mt-1">{g.saludables || 0}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">En Riesgo</p>
          <p className="text-3xl font-bold text-amber-500 tabular-nums mt-1">{(g.enRiesgo || 0) + (g.monitorear || 0)}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Críticos</p>
          <p className="text-3xl font-bold text-red-500 tabular-nums mt-1">{g.criticos || 0}</p>
        </Card>
      </div>

      {/* Toolbar unificado */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex flex-col gap-2">
        {/* Fila 1: Buscador + Score button */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Buscar empresa..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0097A7] focus:border-[#0097A7]"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">🔍</span>
          </div>
          <button
            onClick={() => setShowScoreModal(true)}
            className="text-xs text-slate-500 hover:text-[#0097A7] border border-slate-200 rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap"
          >
            ¿Cómo se calcula el score?
          </button>
        </div>
        {/* Fila 2: Riesgo | Segmento | PH */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="text-slate-400 font-semibold uppercase tracking-wide mr-0.5">Riesgo:</span>
          {([['todos','Todos'],['saludable','Saludable'],['monitorear','Monitorear'],['en_riesgo','En Riesgo'],['critico','Crítico']] as [typeof riesgoFiltro, string][]).map(([v, label]) => (
            <button key={v} onClick={() => setRiesgoFiltro(v)}
              className={`px-2.5 py-1 rounded-lg border transition-all active:scale-95 ${
                riesgoFiltro === v ? 'bg-[#0097A7] text-white border-[#0097A7] font-semibold' : 'bg-white border-slate-200 text-slate-600 hover:border-[#0097A7]'
              }`}>
              {label}
            </button>
          ))}
          <div className="w-px h-4 bg-slate-200 mx-1" />
          <span className="text-slate-400 font-semibold uppercase tracking-wide mr-0.5">Segmento:</span>
          {(['todos','A+','A','B','C'] as const).map(v => (
            <button key={v} onClick={() => setSegFiltro(v)}
              className={`px-2.5 py-1 rounded-lg border transition-all active:scale-95 ${
                segFiltro === v ? 'bg-[#0097A7] text-white border-[#0097A7] font-semibold' : 'bg-white border-slate-200 text-slate-600 hover:border-[#0097A7]'
              }`}>
              {v === 'todos' ? 'Todos' : v}
            </button>
          ))}
          <div className="w-px h-4 bg-slate-200 mx-1" />
          <button
            onClick={() => setModoPH(!modoPH)}
            className={`px-2.5 py-1 rounded-lg border transition-all active:scale-95 ${
              modoPH ? 'bg-amber-500 text-white border-amber-500 font-semibold' : 'bg-white border-slate-200 text-slate-600 hover:border-amber-400'
            }`}>
            {modoPH ? '⚠ Perdidos Históricos' : 'Perdidos Históricos'}
          </button>
        </div>
      </div>

      {/* Países */}
      {paises.map(p => {
        const cc = FLAG_CC[p.pais];
        return (
          <Card key={p.pais}>
            <div className="flex items-center gap-2 mb-3">
              {cc && <img src={`https://flagcdn.com/24x18/${cc}.png`} width={22} height={16} alt={p.pais} className="rounded-sm" />}
              <span className="font-bold text-slate-800">{p.pais}</span>
              {p.resumen?.total && <span className="text-xs text-slate-400">· {p.resumen.total} clientes</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 border-b border-slate-100">
                    <th className="text-left py-1.5 px-3 font-medium">KAM</th>
                    <th className="text-right py-1.5 px-3 font-medium">Total</th>
                    <th className="text-right py-1.5 px-3 font-medium text-emerald-600">Saludables</th>
                    <th className="text-right py-1.5 px-3 font-medium text-amber-500">Monitorear</th>
                    <th className="text-right py-1.5 px-3 font-medium text-orange-500">En Riesgo</th>
                    <th className="text-right py-1.5 px-3 font-medium text-red-600">Críticos</th>
                    <th className="text-right py-1.5 px-3 font-medium text-red-400">Caída USD</th>
                    <th className="text-right py-1.5 px-3 font-medium">Score Prom.</th>
                  </tr>
                </thead>
                <tbody>
                  {p.kams.map((k, i) => (
                    <KamRecRow
                      key={i}
                      k={k}
                      busqueda={busqueda}
                      riesgoFiltro={riesgoFiltro}
                      segFiltro={segFiltro}
                      modoPH={modoPH}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
