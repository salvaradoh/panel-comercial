import { useState, useMemo } from 'react';
import { useCacheChurn } from '../../hooks/useCacheChurn';
import { Card } from '../../components/ui/Card';
import {
  ScoreBadge, ScoreInfoModal, SaludKPIRow, SaludToolbar,
  SaludPaisAccordion, FilterChips, FilterDivider,
  fmtUSD, segOf,
} from '../../components/salud';
import type { KamEstacional, KamRecurrente, ClienteRec } from '../../hooks/types';

type TipoFiltro = 'todos' | 'estacional' | 'puntual' | 'primera_compra';

function fmtDate(d: string): string {
  if (!d) return '—';
  const s = String(d).split('T')[0];
  const parts = s.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`;
  return s;
}

function fmtDelta(v: number): string {
  if (Math.abs(v) < 1) return '—';
  const abs = Math.abs(v);
  const fmt = abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(1)}M`
    : abs >= 1_000 ? `$${(abs / 1_000).toFixed(0)}K`
    : `$${abs.toFixed(0)}`;
  return (v >= 0 ? '+' : '−') + fmt;
}

function TendCell({ caida, monto6m, monto6mAnt }: { caida?: number | null; monto6m?: number | null; monto6mAnt?: number | null }) {
  let delta: number | null = null;
  if (monto6m != null && monto6mAnt != null) {
    delta = monto6m - monto6mAnt;
  } else if (caida != null) {
    delta = caida > 0 ? -caida : null;
  }
  if (delta == null || Math.abs(delta) < 1) return <span className="text-slate-300">—</span>;
  const color = delta >= 0 ? 'text-emerald-600' : 'text-red-500';
  return <span className={`font-semibold tabular-nums text-[10px] ${color}`}>{fmtDelta(delta)}</span>;
}

const ENG_ALIAS: Record<string, string> = {
  'Abono muy atrasado':          'Abono atrasado',
  'Cliente de muy alto valor':   'Alto valor',
  'Cliente de alto valor':       'Alto valor',
  'Inactividad digital > 30 días': '>30d sin login',
  'Inactividad digital > 14 días': '>14d sin login',
  '0 logins en último mes':      'Sin logins',
  '1-2 logins en último mes':    'Pocos logins',
};

function resolveEngLabel(raw: string): string {
  const key = Object.keys(ENG_ALIAS).find(k => raw.includes(k));
  return key ? ENG_ALIAS[key] : raw.trim().substring(0, 20);
}

function EngCell({ fE, señales, ctxE }: { fE?: number | null; señales?: string[]; ctxE?: string }) {
  if (fE == null) return <span className="text-slate-300">—</span>;
  const colors: Record<number, { color: string; bg: string }> = {
    4: { color: '#16a34a', bg: '#f0fdf4' },
    3: { color: '#ca8a04', bg: '#fefce8' },
    2: { color: '#ea580c', bg: '#fff7ed' },
    1: { color: '#dc2626', bg: '#fef2f2' },
  };
  const { color, bg } = colors[fE] ?? { color: '#94a3b8', bg: '#f8fafc' };

  // Build display label from specific signals (same logic as GAS dashboard)
  let label: string;
  if (señales && señales.length > 0) {
    label = señales.slice(0, 2).map(resolveEngLabel).join(' · ');
  } else {
    label = fE === 4 ? 'Sin señales' : fE === 3 ? 'riesgo leve' : fE === 2 ? 'riesgo moderado' : 'riesgo alto';
  }

  return (
    <span
      title={ctxE || label}
      style={{ color, background: bg, border: `1px solid ${color}33` }}
      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap cursor-help max-w-[160px] overflow-hidden text-ellipsis">
      {label}
    </span>
  );
}

function NpsCell({ npsRaw }: { npsRaw?: number | null }) {
  if (npsRaw == null) return <span className="text-slate-300">—</span>;
  const color = npsRaw >= 9 ? 'text-emerald-600' : npsRaw >= 7 ? 'text-amber-500' : npsRaw >= 5 ? 'text-orange-500' : 'text-red-500';
  return <span className={`font-semibold tabular-nums text-[10px] ${color}`}>{npsRaw}/10</span>;
}

// ── KAM row estacionales (VENT) ───────────────────────────────────────────────

interface KamEstVentRowProps {
  k: KamEstacional;
  tipoFiltro: TipoFiltro;
  segFiltro: 'todos' | 'A+' | 'A' | 'B' | 'C';
  riesgoFiltro: 'todos' | 'saludable' | 'monitorear' | 'en_riesgo' | 'critico';
  /** Filtro de vista: acota qué clientes se listan, no toca montos ni score. */
  dotacionFiltro: 'todos' | 'con' | 'sin';
  busqueda: string;
}

function KamEstVentRow({ k, tipoFiltro, segFiltro, riesgoFiltro, dotacionFiltro, busqueda }: KamEstVentRowProps) {
  const [expandido, setExpandido] = useState(false);

  const scoreOf = (c: { scoreVNT?: number }) => Number(c.scoreVNT || 0);
  const hasVNT  = (c: { scoreVNT?: number }) => c.scoreVNT != null && c.scoreVNT > 0;

  const allClients = [
    ...k.clientesChurn.map(c => ({ empresa: c.empresa, volumen: c.volumen, subSeg: c.subSeg, scoreVNT: c.scoreVNT, score: c.score, ultimaCompra: c.ultimaCompra, diasSinCompra: c.diasSinCompra, fE: c.fE, fN: c.fN, fT: c.fT, npsRaw: c.npsRaw, caida: c.caida, señalesEng: c.señalesEng, ctxE: c.ctxE, dot: c.dot ?? 0 })),
    ...k.clientesRetenidos.map(c => ({ empresa: c.empresa, volumen: c.volumen, subSeg: c.subSeg, scoreVNT: c.scoreVNT, score: c.score, ultimaCompra: c.ultimaCompra, diasSinCompra: c.diasSinCompra ?? 0, fE: c.fE, fN: c.fN, fT: c.fT, npsRaw: c.npsRaw, caida: c.caida, señalesEng: c.señalesEng, ctxE: c.ctxE, dot: c.dot ?? 0 })),
  ];

  const porTipo = tipoFiltro === 'todos' ? allClients : allClients.filter(c => c.subSeg === tipoFiltro);
  const saludables = porTipo.filter(c => hasVNT(c) && scoreOf(c) >= 3.5).length;
  const monitorear  = porTipo.filter(c => hasVNT(c) && scoreOf(c) >= 3.0 && scoreOf(c) < 3.5).length;
  const enRiesgo    = porTipo.filter(c => hasVNT(c) && scoreOf(c) >= 2.0 && scoreOf(c) < 3.0).length;
  const criticos    = porTipo.filter(c => hasVNT(c) && scoreOf(c) < 2.0).length;
  const total       = porTipo.length;
  const vntClients  = porTipo.filter(hasVNT);
  const scorePromedio = vntClients.length > 0
    ? vntClients.reduce((s, c) => s + scoreOf(c), 0) / vntClients.length
    : 0;

  const busq = busqueda.trim().toLowerCase();
  // Cortes del score VENT, los mismos que declara la narrativa de arriba:
  // ≥3.50 saludable · ≥3.00 monitorear · ≥2.00 en riesgo · <2.00 crítico.
  // Un cliente sin score VENT no entra en ninguna categoría de riesgo, así que
  // se excluye cuando hay filtro activo en vez de contarlo como crítico.
  const enRiesgoCat = (c: { scoreVNT?: number }) => {
    if (!hasVNT(c)) return null;
    const v = scoreOf(c);
    return v >= 3.5 ? 'saludable' : v >= 3.0 ? 'monitorear' : v >= 2.0 ? 'en_riesgo' : 'critico';
  };
  const clientesFiltrados = porTipo
    .filter(c => segFiltro === 'todos' || (hasVNT(c) && segOf(scoreOf(c)) === segFiltro))
    .filter(c => riesgoFiltro === 'todos' || enRiesgoCat(c) === riesgoFiltro)
    .filter(c => dotacionFiltro === 'todos'
      || (dotacionFiltro === 'con' ? (c.dot ?? 0) > 0 : (c.dot ?? 0) === 0))
    .filter(c => !busq || c.empresa.toLowerCase().includes(busq))
    .sort((a, b) => scoreOf(a) - scoreOf(b));

  // Misma mecánica que KamRecRow: al buscar, la fila se abre sola y las que no
  // tienen coincidencias desaparecen. Sin esto el filtro se aplicaba igual pero
  // la lista solo se renderizaba con `isOpen`, y como todas las filas arrancan
  // colapsadas había que adivinar en qué KAM estaba el cliente — se veía como
  // que el buscador no hacía nada.
  const hayMatch = busq !== '' && clientesFiltrados.length > 0;
  const isOpen = expandido || hayMatch;

  if (busq && !porTipo.some(c => c.empresa.toLowerCase().includes(busq))) return null;

  return (
    <>
      <tr onClick={() => setExpandido(!expandido)} className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer">
        <td className="px-4 py-2.5"><span className="text-sm font-semibold text-slate-700">{k.kam}</span></td>
        <td className="px-3 py-2.5 text-right tabular-nums text-slate-500 text-sm">{total || '—'}</td>
        <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600 font-semibold text-sm">{saludables > 0 ? saludables : <span className="text-slate-300">—</span>}</td>
        <td className="px-3 py-2.5 text-right tabular-nums text-amber-500 text-sm">{monitorear > 0 ? monitorear : <span className="text-slate-300">—</span>}</td>
        <td className="px-3 py-2.5 text-right tabular-nums text-orange-500 text-sm">{enRiesgo > 0 ? enRiesgo : <span className="text-slate-300">—</span>}</td>
        <td className="px-3 py-2.5 text-right tabular-nums text-red-500 font-semibold text-sm">{criticos > 0 ? criticos : <span className="text-slate-300">—</span>}</td>
        <td className="px-4 py-2.5 text-right">
          {scorePromedio > 0
            ? <ScoreBadge score={scorePromedio} segmento={segOf(scorePromedio)} />
            : <span className="text-slate-300 text-xs">—</span>}
          <span className="text-slate-400 text-xs ml-1">{isOpen ? '▲' : '▼'}</span>
        </td>
      </tr>
      {isOpen && clientesFiltrados.length > 0 && (
        <tr>
          <td colSpan={7} className="bg-slate-50 px-0 pb-1 border-l-2 border-[#0097A7]">
            <div className="max-h-56 overflow-y-auto">
              <div className="tabla-scroll">
                <table className="w-full text-xs tabla-apilable">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-200">
                      <th className="text-left px-6 py-1.5 font-medium">Empresa</th>
                      <th className="text-right px-3 py-1.5 font-medium">Tend.</th>
                      <th className="text-right px-3 py-1.5 font-medium">Días s/c</th>
                      <th className="text-right px-3 py-1.5 font-medium">Última compra</th>
                      <th className="text-right px-3 py-1.5 font-medium">Eng.</th>
                      <th className="text-right px-3 py-1.5 font-medium">NPS</th>
                      <th className="text-right px-3 py-1.5 font-medium">Segmentación</th>
                      <th className="text-right px-4 py-1.5 font-medium">Salud (VENT)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientesFiltrados.map((c, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-white transition-colors">
                        <td data-titular className="px-6 py-1.5 text-slate-700 truncate max-w-[160px]">{c.empresa}</td>
                        <td data-label="Tend." className="px-3 py-1.5 text-right"><TendCell caida={c.caida} /></td>
                        <td data-label="Días s/c" className="px-3 py-1.5 text-right tabular-nums">
                          <span className={c.diasSinCompra > 180 ? 'text-red-500 font-semibold' : c.diasSinCompra > 90 ? 'text-amber-500' : 'text-slate-500'}>
                            {c.diasSinCompra > 0 ? `${c.diasSinCompra}d` : '—'}
                          </span>
                        </td>
                        <td data-label="Última compra" className="px-3 py-1.5 text-right text-slate-400 tabular-nums">{c.ultimaCompra ? fmtDate(c.ultimaCompra) : '—'}</td>
                        <td data-label="Eng." className="px-3 py-1.5 text-right"><EngCell fE={c.fE} señales={c.señalesEng} ctxE={c.ctxE} /></td>
                        <td data-label="NPS" className="px-3 py-1.5 text-right"><NpsCell npsRaw={c.npsRaw} /></td>
                        {/* Dos métricas distintas del mismo cliente, juntas a propósito:
                            segmentación (cuánto vale) y salud VENT (qué tan en riesgo está).
                            Verlas en pantallas separadas hacía parecer que un mismo score
                            estaba desincronizado — Netquest mostraba 1.63 acá y 1.90 allá. */}
                        <td data-label="Segmentación" className="px-3 py-1.5 text-right">
                          {c.score > 0
                            ? <span className="text-[11px] font-semibold tabular-nums text-slate-500">{c.score.toFixed(2)}</span>
                            : <span className="text-slate-300 text-[11px]">—</span>}
                        </td>
                        <td data-label="Salud (VENT)" className="px-4 py-1.5 text-right"><ScoreBadge score={scoreOf(c)} segmento={segOf(scoreOf(c))} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── KAM row recurrentes (RENT) ────────────────────────────────────────────────

interface KamRecRowProps {
  k: KamRecurrente;
  busqueda: string;
  riesgoFiltro: string;
  segFiltro: string;
  /** Filtro de vista: acota qué clientes se listan, no toca montos ni score. */
  dotacionFiltro: 'todos' | 'con' | 'sin';
  modoPH: boolean;
}

function KamRecRow({ k, busqueda, riesgoFiltro, segFiltro, dotacionFiltro, modoPH }: KamRecRowProps) {
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
    .filter(c => segFiltro === 'todos' || c.segmento === segFiltro)
    .filter(c => dotacionFiltro === 'todos'
      || (dotacionFiltro === 'con' ? (c.dot ?? 0) > 0 : (c.dot ?? 0) === 0));

  const hayMatch = busq !== '' && listaFiltrada.length > 0;
  const isOpen = expanded || hayMatch;

  if (busq && !listaBase.some(c => c.empresa.toLowerCase().includes(busq))) return null;

  return (
    <>
      <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <td data-titular className="py-2 font-medium text-slate-700 px-3">{k.kam}</td>
        <td data-label="Total" className="py-2 text-right tabular-nums text-slate-500 px-3">{k.base}</td>
        <td data-label="Saludables" className="py-2 text-right tabular-nums text-emerald-600 font-semibold px-3">{k.saludables}</td>
        <td data-label="Monitorear" className="py-2 text-right tabular-nums text-amber-500 font-semibold px-3">{k.monitorear}</td>
        <td data-label="En Riesgo" className="py-2 text-right tabular-nums text-orange-500 font-semibold px-3">{k.enRiesgo}</td>
        <td data-label="Críticos" className="py-2 text-right tabular-nums text-red-600 font-semibold px-3">{k.criticos}</td>
        <td data-label="Caída USD" className="py-2 text-right tabular-nums px-3">
          {(k.caidaUSD ?? k.montoPerdido ?? 0) > 0
            ? <span className="text-red-500 font-semibold">{fmtUSD(k.caidaUSD ?? k.montoPerdido ?? 0)}</span>
            : <span className="text-slate-300">—</span>}
        </td>
        <td data-label="Score Prom." className="py-2 text-right px-3">
          {k.scorePromedio > 0
            ? <ScoreBadge score={k.scorePromedio} segmento={segOf(k.scorePromedio)} />
            : <span className="text-slate-300 text-xs">—</span>}
          <span className="text-slate-400 text-xs ml-1">{isOpen ? '▲' : '▼'}</span>
        </td>
      </tr>
      {isOpen && listaFiltrada.length > 0 && (
        <tr>
          <td colSpan={8} className="bg-slate-50 px-0 pb-1 border-l-2 border-[#1565C0]">
            <div className="max-h-56 overflow-y-auto">
              <div className="tabla-scroll">
                <table className="w-full text-xs tabla-apilable">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-200">
                      <th className="text-left px-6 py-1.5 font-medium">Empresa</th>
                      <th className="text-right px-3 py-1.5 font-medium">Tend.</th>
                      <th className="text-right px-3 py-1.5 font-medium">Días s/c</th>
                      <th className="text-right px-3 py-1.5 font-medium">Última compra</th>
                      <th className="text-right px-3 py-1.5 font-medium">Eng.</th>
                      <th className="text-right px-3 py-1.5 font-medium">NPS</th>
                      <th className="text-right px-4 py-1.5 font-medium">Score RENT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listaFiltrada.map((c, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-white transition-colors">
                        <td data-titular className="px-6 py-1.5 text-slate-700 truncate max-w-[160px]">{c.empresa}</td>
                        <td data-label="Tend." className="px-3 py-1.5 text-right"><TendCell monto6m={c.monto6m} monto6mAnt={c.monto6mAnt} /></td>
                        <td data-label="Días s/c" className="px-3 py-1.5 text-right tabular-nums">
                          <span className={c.diasSinCompra > 180 ? 'text-red-500 font-semibold' : c.diasSinCompra > 90 ? 'text-amber-500' : 'text-slate-500'}>
                            {c.diasSinCompra}d
                          </span>
                        </td>
                        <td data-label="Última compra" className="px-3 py-1.5 text-right text-slate-400 tabular-nums">{c.ultimaCompra ? fmtDate(c.ultimaCompra) : '—'}</td>
                        <td data-label="Eng." className="px-3 py-1.5 text-right">
                          <EngCell fE={c.fE}
                            señales={c.detalleEngagement ? c.detalleEngagement.split(' | ').filter(Boolean) : []}
                            ctxE={c.ctxE} />
                        </td>
                        <td data-label="NPS" className="px-3 py-1.5 text-right"><NpsCell npsRaw={c.npsRaw} /></td>
                        <td data-label="Score RENT" className="px-4 py-1.5 text-right">
                          <ScoreBadge score={c.score} segmento={c.segmento} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Narrativa metodológica ─────────────────────────────────────────────────────

function Narrativa({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border-l-4 border-[#0097A7] bg-[#e0f7fa] px-4 py-3 text-xs text-slate-600 leading-relaxed">
      {children}
    </div>
  );
}

// ── SaludTab ──────────────────────────────────────────────────────────────────

interface SaludTabProps {
  tipo: 'estacionales' | 'recurrentes';
  anio: number;
}

export function SaludTab({ tipo }: SaludTabProps) {
  const { data, isLoading, isError, error } = useCacheChurn();
  const [tipoFiltro, setTipoFiltro]       = useState<TipoFiltro>('todos');
  const [busqueda, setBusqueda]           = useState('');
  const [segFiltro, setSegFiltro]         = useState<'todos' | 'A+' | 'A' | 'B' | 'C'>('todos');
  const [riesgoFiltro, setRiesgoFiltro]   = useState<'todos' | 'saludable' | 'monitorear' | 'en_riesgo' | 'critico'>('todos');
  // Dotación: productos de Colombia. Filtro de VISTA, no recalcula montos ni score.
  const [dotacionFiltro, setDotacionFiltro] = useState<'todos' | 'con' | 'sin'>('todos');
  const [modoPH, setModoPH]               = useState(false);
  const [showScoreModal, setShowScoreModal] = useState(false);

  const SEG_OPTIONS = (['todos', 'A+', 'A', 'B', 'C'] as const).map(v => ({ value: v, label: v === 'todos' ? 'Todos' : v }));

  // El chip de dotación solo se dibuja si hay algo que filtrar: los productos son
  // exclusivos de Colombia y en el resto sería un botón muerto. Se busca en las
  // listas de clientes que ya trae el caché, sin pedir nada más.
  const hayDotacion = useMemo(() => {
    const conDot = (arr?: { dot?: number }[]) => (arr ?? []).some(c => (c.dot ?? 0) > 0);
    for (const p of data?.estacionales?.paises ?? []) {
      for (const k of p.kams ?? []) {
        if (conDot(k.clientesChurn) || conDot(k.clientesRetenidos)) return true;
      }
    }
    for (const p of data?.recurrentes?.paises ?? []) {
      for (const k of p.kams ?? []) {
        if (conDot(k.clientes) || conDot(k.clientesPH)) return true;
      }
    }
    return false;
  }, [data]);

  const DOT_OPTIONS = [
    { value: 'todos' as const, label: 'Todos' },
    { value: 'con'   as const, label: 'Con' },
    { value: 'sin'   as const, label: 'Sin' },
  ];

  if (isLoading) return <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />;

  if (isError) return (
    <Card>
      <p className="text-red-500 text-sm text-center py-8 break-all">
        Error al cargar datos: {String((error as Error)?.message ?? error)}
      </p>
    </Card>
  );

  if (!data) return (
    <Card>
      <p className="text-slate-400 text-sm text-center py-8">Sin datos disponibles.</p>
    </Card>
  );

  // ── ESTACIONALES ────────────────────────────────────────────────────────────
  if (tipo === 'estacionales') {
    const paises = data.estacionales.paises;

    let gTotal = 0, gSaludables = 0, gEnRiesgo = 0, gCriticos = 0;
    let gVolEnRiesgo = 0, gVolCriticos = 0;
    for (const p of paises) {
      for (const k of p.kams) {
        for (const c of [...k.clientesChurn, ...k.clientesRetenidos]) {
          gTotal++;
          if (c.scoreVNT == null) continue;
          const s = c.scoreVNT;
          if (s >= 3.5) gSaludables++;
          else if (s >= 3.0) { /* monitorear */ }
          else if (s >= 2.0) { gEnRiesgo++; gVolEnRiesgo += c.volumen || 0; }
          else { gCriticos++; gVolCriticos += c.volumen || 0; }
        }
      }
    }
    void gSaludables;

    return (
      <div className="flex flex-col gap-4">
        {showScoreModal && <ScoreInfoModal tipo="vent" onClose={() => setShowScoreModal(false)} />}

        <SaludKPIRow cards={[
          {
            label: '% Críticos VENT',
            value: gTotal > 0 ? `${(gCriticos / gTotal * 100).toFixed(1)}%` : '0.0%',
            sub: `${gCriticos} críticos de ${gTotal} · ${gEnRiesgo} en riesgo`,
            color: '#dc2626',
          },
          {
            label: 'Clientes en Alerta',
            value: String(gCriticos + gEnRiesgo),
            sub: `B: ${gEnRiesgo} en riesgo · C: ${gCriticos} críticos`,
            color: '#ef4444',
          },
          {
            label: 'Vol. en Alerta (USD)',
            value: fmtUSD(gVolEnRiesgo + gVolCriticos),
            sub: `${fmtUSD(gVolEnRiesgo)} en riesgo · ${fmtUSD(gVolCriticos)} críticos`,
            color: '#ef4444',
          },
        ]} />

        <Narrativa>
          <span className="font-semibold text-slate-700">Score de salud VENT</span> — Vigencia del ciclo (V) · Engagement en plataforma (E) · NPS del cliente (N) · Tendencia YoY (T).{' '}
          Escala 1–4 por dimensión.{' '}
          <span className="font-semibold text-emerald-600">Saludable</span> ≥3.50 ·{' '}
          <span className="font-semibold text-amber-500">Monitorear</span> ≥3.00 ·{' '}
          <span className="font-semibold text-orange-500">En Riesgo</span> ≥2.00 ·{' '}
          <span className="font-semibold text-red-500">Crítico</span> &lt;2.00
        </Narrativa>

        <SaludToolbar search={busqueda} onSearch={setBusqueda} onScoreInfo={() => setShowScoreModal(true)}>
          <FilterChips
            label="Riesgo"
            value={riesgoFiltro}
            onChange={setRiesgoFiltro}
            options={[
              { value: 'todos', label: 'Todos' },
              { value: 'saludable', label: 'Saludable' },
              { value: 'monitorear', label: 'Monitorear' },
              { value: 'en_riesgo', label: 'En Riesgo' },
              { value: 'critico', label: 'Crítico' },
            ]}
          />
          <FilterDivider />
          <FilterChips
            label="Tipo"
            value={tipoFiltro}
            onChange={setTipoFiltro}
            options={[
              { value: 'todos', label: 'Todos' },
              { value: 'estacional', label: 'Estacional' },
              { value: 'primera_compra', label: '1ra Compra' },
            ]}
          />
          <FilterDivider />
          <FilterChips label="Segmento" value={segFiltro} onChange={setSegFiltro} options={SEG_OPTIONS} />
          {hayDotacion && (
            <>
              <FilterDivider />
              <FilterChips label="Dotación" value={dotacionFiltro} onChange={setDotacionFiltro} options={DOT_OPTIONS} />
            </>
          )}
        </SaludToolbar>

        {paises.map(p => {
          const paisClients = p.kams.flatMap(k => [...k.clientesChurn, ...k.clientesRetenidos]);
          const paisVNT = paisClients.filter(c => c.scoreVNT != null && c.scoreVNT > 0);
          const paisScore = paisVNT.length > 0
            ? paisVNT.reduce((s, c) => s + (c.scoreVNT || 0), 0) / paisVNT.length
            : undefined;

          return (
            <SaludPaisAccordion
              key={p.pais}
              pais={p.pais}
              count={paisClients.length}
              score={paisScore}
              scoreLabel="Score VENT"
              defaultOpen={p.pais === 'Chile'}
            >
              <div className="tabla-scroll">
                <table className="w-full text-sm tabla-apilable">
                  <thead>
                    <tr className="text-xs text-slate-400 bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-2 font-medium">KAM</th>
                      <th className="text-right px-3 py-2 font-medium">Cartera</th>
                      <th className="text-right px-3 py-2 font-medium text-emerald-600">Saludable</th>
                      <th className="text-right px-3 py-2 font-medium text-amber-500">Monitorear</th>
                      <th className="text-right px-3 py-2 font-medium text-orange-500">En Riesgo</th>
                      <th className="text-right px-3 py-2 font-medium text-red-500">Crítico</th>
                      <th className="px-4 py-2 text-right font-medium">Score VENT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.kams.map((k, i) => (
                      <KamEstVentRow key={i} k={k} tipoFiltro={tipoFiltro} segFiltro={segFiltro} riesgoFiltro={riesgoFiltro} dotacionFiltro={dotacionFiltro} busqueda={busqueda} />
                    ))}
                  </tbody>
                  <tfoot>
                    {(() => {
                      const hasVNT2 = (c: { scoreVNT?: number }) => c.scoreVNT != null && c.scoreVNT > 0;
                      const scoreOf2 = (c: { scoreVNT?: number }) => Number(c.scoreVNT || 0);
                      const all = p.kams.flatMap(k => [...k.clientesChurn, ...k.clientesRetenidos])
                        .filter(c => tipoFiltro === 'todos' || (c as { subSeg?: string }).subSeg === tipoFiltro);
                      const tSal = all.filter(c => hasVNT2(c) && scoreOf2(c) >= 3.5).length;
                      const tMon = all.filter(c => hasVNT2(c) && scoreOf2(c) >= 3.0 && scoreOf2(c) < 3.5).length;
                      const tRis = all.filter(c => hasVNT2(c) && scoreOf2(c) >= 2.0 && scoreOf2(c) < 3.0).length;
                      const tCri = all.filter(c => hasVNT2(c) && scoreOf2(c) < 2.0).length;
                      const tWithVNT = all.filter(hasVNT2);
                      const tScore = tWithVNT.length > 0
                        ? tWithVNT.reduce((s, c) => s + scoreOf2(c), 0) / tWithVNT.length
                        : 0;
                      return (
                        <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-sm">
                          <td data-titular className="px-4 py-2 text-slate-500">TOTAL</td>
                          <td data-label="Cartera" className="px-3 py-2 text-right tabular-nums text-slate-700">{all.length}</td>
                          <td data-label="Saludable" className="px-3 py-2 text-right tabular-nums text-emerald-600">{tSal}</td>
                          <td data-label="Monitorear" className="px-3 py-2 text-right tabular-nums text-amber-500">{tMon}</td>
                          <td data-label="En Riesgo" className="px-3 py-2 text-right tabular-nums text-orange-500">{tRis}</td>
                          <td data-label="Crítico" className="px-3 py-2 text-right tabular-nums text-red-500">{tCri}</td>
                          <td data-label="Score VENT" className="px-4 py-2 text-right">
                            {tScore > 0 && <ScoreBadge score={tScore} segmento={segOf(tScore)} />}
                          </td>
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>
            </SaludPaisAccordion>
          );
        })}
      </div>
    );
  }

  // ── RECURRENTES ─────────────────────────────────────────────────────────────
  const g = data.recurrentes.globales;
  const paises = data.recurrentes.paises;

  return (
    <div className="flex flex-col gap-4">
      {showScoreModal && <ScoreInfoModal tipo="rent" onClose={() => setShowScoreModal(false)} />}

      <SaludKPIRow cards={[
        {
          label: '% Críticos RENT',
          value: (g.total || 0) > 0 ? `${((g.criticos || 0) / (g.total || 1) * 100).toFixed(1)}%` : '0.0%',
          sub: `${g.criticos || 0} críticos de ${g.total || 0} · ${g.enRiesgo || 0} en riesgo`,
          color: '#dc2626',
        },
        {
          label: 'Clientes en Alerta',
          value: String((g.criticos || 0) + (g.enRiesgo || 0)),
          sub: `B: ${g.enRiesgo || 0} en riesgo · C: ${g.criticos || 0} críticos`,
          color: '#ef4444',
        },
        {
          label: 'Vol. Crítico (USD)',
          value: fmtUSD(g.montoPerdido || 0),
          sub: 'Volumen de clientes críticos',
          color: '#ef4444',
        },
      ]} />

      <Narrativa>
        <span className="font-semibold text-slate-700">Score RENT</span> — Recencia de compra (R) · Engagement en plataforma (E) · NPS del cliente (N) · Tendencia de volumen (T).{' '}
        Escala 1–4 por dimensión.{' '}
        <span className="font-semibold text-emerald-600">Saludable</span> ≥3.50 ·{' '}
        <span className="font-semibold text-amber-500">Monitorear</span> ≥3.00 ·{' '}
        <span className="font-semibold text-orange-500">En Riesgo</span> ≥2.00 ·{' '}
        <span className="font-semibold text-red-500">Crítico</span> &lt;2.00
      </Narrativa>

      <SaludToolbar search={busqueda} onSearch={setBusqueda} onScoreInfo={() => setShowScoreModal(true)}>
        <FilterChips
          label="Riesgo"
          value={riesgoFiltro}
          onChange={setRiesgoFiltro}
          options={[
            { value: 'todos', label: 'Todos' },
            { value: 'saludable', label: 'Saludable' },
            { value: 'monitorear', label: 'Monitorear' },
            { value: 'en_riesgo', label: 'En Riesgo' },
            { value: 'critico', label: 'Crítico' },
          ]}
        />
        <FilterDivider />
        <FilterChips label="Segmento" value={segFiltro} onChange={setSegFiltro} options={SEG_OPTIONS} />
        {hayDotacion && (
          <>
            <FilterDivider />
            <FilterChips label="Dotación" value={dotacionFiltro} onChange={setDotacionFiltro} options={DOT_OPTIONS} />
          </>
        )}
        <FilterDivider />
        <button
          onClick={() => setModoPH(!modoPH)}
          className={`px-2.5 py-1 rounded-lg border transition-all active:scale-95 text-xs ${
            modoPH ? 'bg-amber-500 text-white border-amber-500 font-semibold' : 'bg-white border-slate-200 text-slate-600 hover:border-amber-400'
          }`}
        >
          {modoPH ? '⚠ Perdidos Históricos' : 'Perdidos Históricos'}
        </button>
      </SaludToolbar>

      {paises.map(p => {
        const totalClientes = p.kams.reduce((s, k) => s + k.base, 0);
        const scoresProm = p.kams.filter(k => k.scorePromedio > 0);
        const paisScore = scoresProm.length > 0
          ? scoresProm.reduce((s, k) => s + k.scorePromedio, 0) / scoresProm.length
          : undefined;

        return (
          <SaludPaisAccordion
            key={p.pais}
            pais={p.pais}
            count={p.resumen?.total || totalClientes}
            score={paisScore}
            scoreLabel="Score RENT"
            defaultOpen={p.pais === 'Chile'}
          >
            <div className="tabla-scroll">
              <table className="w-full text-sm tabla-apilable">
                <thead>
                  <tr className="text-xs text-slate-400 border-b border-slate-100 bg-slate-50">
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
                      key={i} k={k}
                      busqueda={busqueda} riesgoFiltro={riesgoFiltro} dotacionFiltro={dotacionFiltro}
                      segFiltro={segFiltro} modoPH={modoPH}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </SaludPaisAccordion>
        );
      })}
    </div>
  );
}
