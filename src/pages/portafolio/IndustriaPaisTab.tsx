import { useMemo, useState } from 'react';
import { useTablaClientes } from '../../hooks/useTablaClientes';
import type { ClienteTabla, TipoCliente } from '../../hooks/useTablaClientes';
import { useFacturacionMensual } from '../../hooks/useFacturacionMensual';
import { Card } from '../../components/ui/Card';
import { mismoPais } from '../../lib/paises';
import { DetalleIndustriaPanel } from './DetalleIndustriaPanel';
import type { ClienteConUsd } from './DetalleIndustriaPanel';
import { descargarExcelIndustria } from './exportIndustriaExcel';

const PAIS_ORDER = ['Chile', 'Colombia', 'México', 'Perú', 'Ecuador'];

const TIPOS_DISPONIBLES: { tipo: TipoCliente; label: string }[] = [
  { tipo: 'recurrente', label: 'Recurrente' },
  { tipo: 'estacional', label: 'Estacional' },
  { tipo: 'primera_compra', label: 'Primera compra' },
];

const MESES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function fmtMes(mes: string) {
  const [anio, m] = mes.split('-');
  return `${MESES_ES[Number(m) - 1] ?? m} ${anio}`;
}

function fmtUSD(v: number) {
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000)     return '$' + Math.round(v / 1_000) + 'K';
  return '$' + Math.round(v);
}

function fmtPct(v: number) {
  return v.toFixed(1) + '%';
}

interface Celda { count: number; usd: number; clientes: ClienteConUsd[] }

// Escala secuencial de un solo tono (el acento del dashboard): esto es
// magnitud, no identidad categórica, así que no hace falta paleta.
function bgHeat(valor: number, max: number) {
  if (valor <= 0) return undefined; // el vacío lo marca gapStyle, no el heat
  const t = max > 0 ? valor / max : 0;
  const alpha = 0.12 + t * 0.68;
  return `rgba(0, 151, 167, ${alpha.toFixed(2)})`;
}

export function IndustriaPaisTab({ pais: filterPais }: { pais?: string } = {}) {
  const { data: todos, isLoading, isError, error } = useTablaClientes();
  const facturacion = useFacturacionMensual();

  const [tipos, setTipos] = useState<Set<TipoCliente>>(new Set(['recurrente', 'estacional']));
  const [agruparPor, setAgruparPor] = useState<'pais' | 'tipo'>('pais');
  const [verPor, setVerPor] = useState<'cuentas' | 'usd'>('cuentas');
  const [escala, setEscala] = useState<'abs' | 'pct'>('abs');
  const [paisSel, setPaisSel] = useState(filterPais ?? 'Todos');
  const [soloConHueco, setSoloConHueco] = useState(false);
  const [periodoTipo, setPeriodoTipo] = useState<'12m' | 'anio' | 'mes'>('12m');
  const [periodoAnio, setPeriodoAnio] = useState('');
  const [periodoMes, setPeriodoMes] = useState('');
  const [detalle, setDetalle] = useState<{ titulo: string; subtitulo: string; clientes: ClienteConUsd[] } | null>(null);
  const [descargando, setDescargando] = useState(false);

  // Años/meses disponibles salen de la facturación mensual (últimos 48 meses,
  // ver useFacturacionMensual) — más reciente primero. Sin selección propia
  // todavía, cae al más nuevo apenas carga.
  const aniosDisponibles = [...facturacion.anios].reverse();
  const mesesDisponibles = [...facturacion.meses].reverse();
  const anioSel = periodoAnio || aniosDisponibles[0] || String(new Date().getFullYear());
  const mesSel  = periodoMes  || mesesDisponibles[0] || '';

  const periodoLabel = periodoTipo === '12m' ? 'en 12m' : periodoTipo === 'anio' ? `en ${anioSel}` : `en ${fmtMes(mesSel)}`;

  const toggleTipo = (t: TipoCliente) => {
    setTipos(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  };

  const usdDe = useMemo(() => {
    return (c: ClienteTabla): number => {
      const id = c.panelId || c.idTributario;
      if (periodoTipo === 'anio') return facturacion.usdDelAnio(c.pais, id, anioSel);
      if (periodoTipo === 'mes')  return facturacion.usdDelMes(c.pais, id, mesSel);
      return c.monto6mAct + c.monto6mAnt;
    };
  }, [periodoTipo, anioSel, mesSel, facturacion]);

  const datos = useMemo(() => {
    const activos = (todos ?? []).filter(c => tipos.has(c.tipo) && c.industria);
    const paisesPresentes = [...new Set(activos.map(c => c.pais))];

    const base = (agruparPor === 'tipo' && paisSel !== 'Todos')
      ? activos.filter(c => mismoPais(c.pais, paisSel))
      : activos;

    // Las fuentes escriben el país distinto ("México" vs "Mexico" sin tilde):
    // se ordena por coincidencia parcial sin tildes, o "Mexico" sin tilde cae
    // siempre al final en vez de en su lugar.
    const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

    let columnas: string[];
    let labelDe: (col: string) => string;
    let columnaDe: (c: ClienteTabla) => string;

    if (agruparPor === 'pais') {
      const paisesSet = new Set(base.map(c => c.pais));
      columnas = [...paisesSet].sort((a, b) => {
        const ia = PAIS_ORDER.findIndex(p => sinTildes(a).includes(sinTildes(p)));
        const ib = PAIS_ORDER.findIndex(p => sinTildes(b).includes(sinTildes(p)));
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
      labelDe = (c) => c;
      columnaDe = (c) => c.pais;
    } else {
      columnas = TIPOS_DISPONIBLES.filter(t => tipos.has(t.tipo)).map(t => t.tipo);
      const labelPorTipo = Object.fromEntries(TIPOS_DISPONIBLES.map(t => [t.tipo, t.label]));
      labelDe = (col) => labelPorTipo[col] ?? col;
      columnaDe = (c) => c.tipo;
    }

    const matriz = new Map<string, Map<string, Celda>>();
    const totalIndCount = new Map<string, number>();
    const totalIndUsd = new Map<string, number>();
    const totalColCount = new Map<string, number>();
    const totalColUsd = new Map<string, number>();
    let totalGlobalCount = 0;
    let totalGlobalUsd = 0;

    base.forEach(c => {
      const col = columnaDe(c);
      const usd = usdDe(c);
      if (!matriz.has(c.industria)) matriz.set(c.industria, new Map());
      const fila = matriz.get(c.industria)!;
      const prev = fila.get(col) ?? { count: 0, usd: 0, clientes: [] as ClienteConUsd[] };
      fila.set(col, { count: prev.count + 1, usd: prev.usd + usd, clientes: [...prev.clientes, { c, usd }] });

      totalIndCount.set(c.industria, (totalIndCount.get(c.industria) ?? 0) + 1);
      totalIndUsd.set(c.industria, (totalIndUsd.get(c.industria) ?? 0) + usd);
      totalColCount.set(col, (totalColCount.get(col) ?? 0) + 1);
      totalColUsd.set(col, (totalColUsd.get(col) ?? 0) + usd);
      totalGlobalCount += 1;
      totalGlobalUsd += usd;
    });

    const industrias = [...matriz.keys()].sort((a, b) => {
      const totA = verPor === 'usd' ? (totalIndUsd.get(a) ?? 0) : (totalIndCount.get(a) ?? 0);
      const totB = verPor === 'usd' ? (totalIndUsd.get(b) ?? 0) : (totalIndCount.get(b) ?? 0);
      return totB - totA;
    });

    // Valor mostrado en la celda: crudo en modo absoluto, share de la columna en modo %.
    const valorCelda = (ind: string, col: string) => {
      const cel = matriz.get(ind)?.get(col);
      const raw = verPor === 'usd' ? (cel?.usd ?? 0) : (cel?.count ?? 0);
      if (escala === 'abs') return raw;
      const totalCol = verPor === 'usd' ? (totalColUsd.get(col) ?? 0) : (totalColCount.get(col) ?? 0);
      return totalCol > 0 ? (raw / totalCol) * 100 : 0;
    };

    const valorTotalFila = (ind: string) => {
      const raw = verPor === 'usd' ? (totalIndUsd.get(ind) ?? 0) : (totalIndCount.get(ind) ?? 0);
      if (escala === 'abs') return raw;
      return totalGlobalCount > 0
        ? (raw / (verPor === 'usd' ? totalGlobalUsd : totalGlobalCount)) * 100
        : 0;
    };

    let maxCelda = 0;
    industrias.forEach(ind => columnas.forEach(col => {
      const v = valorCelda(ind, col);
      if (v > maxCelda) maxCelda = v;
    }));

    return {
      industrias, columnas, matriz, labelDe,
      totalColCount, totalColUsd, totalGlobalCount, totalGlobalUsd,
      valorCelda, valorTotalFila, maxCelda,
      paisesPresentes,
    };
  }, [todos, tipos, agruparPor, paisSel, verPor, escala, usdDe]);

  const industriasFiltradas = useMemo(() => {
    if (agruparPor !== 'pais' || !soloConHueco) return datos.industrias;
    return datos.industrias.filter(ind => {
      const fila = datos.matriz.get(ind);
      return datos.columnas.some(col => !fila?.get(col)?.count);
    });
  }, [datos, agruparPor, soloConHueco]);

  if (isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-slate-50" />;
  if (isError) {
    return (
      <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 text-sm text-rose-800">
        No se pudo leer la base de clientes: {(error as Error)?.message ?? 'error desconocido'}
      </div>
    );
  }

  const sinTipos = tipos.size === 0;
  const colombiaIncompleta = tipos.has('primera_compra');

  const contextoTexto = [
    'Tipos: ' + (TIPOS_DISPONIBLES.filter(t => tipos.has(t.tipo)).map(t => t.label).join(', ') || 'ninguno'),
    'Agrupado por ' + (agruparPor === 'pais' ? 'País' : 'Tipo de cliente'),
    agruparPor === 'tipo' ? `País: ${paisSel}` : null,
  ].filter(Boolean).join(' · ');

  async function handleDescargar() {
    setDescargando(true);
    try {
      await descargarExcelIndustria({
        todos: todos ?? [],
        aniosDisponibles: facturacion.anios,
        usdDelAnio: facturacion.usdDelAnio,
        resumen: {
          columnas: datos.columnas,
          labelDe: datos.labelDe,
          matriz: datos.matriz,
          industrias: industriasFiltradas,
          metrica: verPor,
          periodoLabel,
          contexto: contextoTexto,
        },
      });
    } finally {
      setDescargando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Industria por País</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {agruparPor === 'pais'
              ? 'Cuántas cuentas hay de cada industria, por país — para detectar dónde falta presencia en un sector que sí funciona en otro mercado.'
              : 'Cuántas cuentas hay de cada industria, por tipo de cliente — para ver qué sectores retienen y cuáles se quedan en la primera compra.'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDescargar}
          disabled={descargando}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200
                     text-slate-600 hover:border-[#0097A7] hover:text-[#0097A7] transition-colors disabled:opacity-50
                     disabled:cursor-wait flex-shrink-0"
          title="Descarga un Excel con el resumen de esta vista y el detalle completo de la cartera clasificada, sin filtro, para armar tablas dinámicas"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M8 1.5v9M8 10.5 4.5 7M8 10.5 11.5 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2.5 12.5v1.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          {descargando ? 'Generando…' : 'Descargar Excel'}
        </button>
      </div>

      {/* Controles */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Tipo de cliente</span>
          {TIPOS_DISPONIBLES.map(({ tipo, label }) => (
            <button
              key={tipo}
              type="button"
              onClick={() => toggleTipo(tipo)}
              aria-pressed={tipos.has(tipo)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                tipos.has(tipo) ? 'bg-[#0097A7] text-white border-[#0097A7]' : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 flex-wrap text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Agrupar por</span>
            <select
              value={agruparPor}
              onChange={e => setAgruparPor(e.target.value as 'pais' | 'tipo')}
              className="border border-slate-200 rounded-lg px-2 py-1 text-slate-600 bg-white focus:outline-none focus:border-[#0097A7]"
            >
              <option value="pais">País</option>
              <option value="tipo">Tipo de cliente</option>
            </select>
          </div>

          {agruparPor === 'tipo' && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">País</span>
              <select
                value={paisSel}
                onChange={e => setPaisSel(e.target.value)}
                className="border border-slate-200 rounded-lg px-2 py-1 text-slate-600 bg-white focus:outline-none focus:border-[#0097A7]"
              >
                <option value="Todos">Todos</option>
                {datos.paisesPresentes.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Ver</span>
            <select
              value={verPor}
              onChange={e => setVerPor(e.target.value as 'cuentas' | 'usd')}
              className="border border-slate-200 rounded-lg px-2 py-1 text-slate-600 bg-white focus:outline-none focus:border-[#0097A7]"
            >
              <option value="cuentas">Cuentas</option>
              <option value="usd">Facturación</option>
            </select>
          </div>

          {verPor === 'usd' && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Período</span>
              <select
                value={periodoTipo}
                onChange={e => setPeriodoTipo(e.target.value as '12m' | 'anio' | 'mes')}
                className="border border-slate-200 rounded-lg px-2 py-1 text-slate-600 bg-white focus:outline-none focus:border-[#0097A7]"
              >
                <option value="12m">Últimos 12 meses</option>
                <option value="anio">Año</option>
                <option value="mes">Mes</option>
              </select>
              {periodoTipo === 'anio' && (
                <select
                  value={anioSel}
                  onChange={e => setPeriodoAnio(e.target.value)}
                  disabled={facturacion.isLoading}
                  aria-label="Año"
                  className="border border-slate-200 rounded-lg px-2 py-1 text-slate-600 bg-white focus:outline-none focus:border-[#0097A7] disabled:opacity-40"
                >
                  {aniosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              )}
              {periodoTipo === 'mes' && (
                <select
                  value={mesSel}
                  onChange={e => setPeriodoMes(e.target.value)}
                  disabled={facturacion.isLoading}
                  aria-label="Mes"
                  className="border border-slate-200 rounded-lg px-2 py-1 text-slate-600 bg-white focus:outline-none focus:border-[#0097A7] disabled:opacity-40"
                >
                  {mesesDisponibles.map(m => <option key={m} value={m}>{fmtMes(m)}</option>)}
                </select>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Escala</span>
            <select
              value={escala}
              onChange={e => setEscala(e.target.value as 'abs' | 'pct')}
              className="border border-slate-200 rounded-lg px-2 py-1 text-slate-600 bg-white focus:outline-none focus:border-[#0097A7]"
            >
              <option value="abs">Absoluto</option>
              <option value="pct">% de la columna</option>
            </select>
          </div>

          {agruparPor === 'pais' && (
            <label className="flex items-center gap-1.5 text-slate-500 cursor-pointer select-none ml-auto">
              <input
                type="checkbox"
                checked={soloConHueco}
                onChange={e => setSoloConHueco(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#0097A7]"
              />
              Solo industrias con algún país en 0
            </label>
          )}
        </div>
      </div>

      {colombiaIncompleta && (
        <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
          Colombia todavía tiene ~223 cuentas de Primera compra sin clasificar por industria — sus
          números en esta vista están subrepresentados frente a Chile, México y Perú.
        </p>
      )}

      {sinTipos ? (
        <Card className="p-6 text-center text-sm text-slate-400">
          Elegí al menos un tipo de cliente para ver la matriz.
        </Card>
      ) : industriasFiltradas.length === 0 ? (
        <Card className="p-6 text-center text-sm text-slate-400">
          Sin datos para esta combinación de filtros.
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left font-semibold text-slate-500 uppercase tracking-wide text-[10px] pb-2 pr-3 sticky left-0 bg-white">
                  Industria
                </th>
                {datos.columnas.map(col => (
                  <th key={col} className="text-center font-semibold text-slate-500 uppercase tracking-wide text-[10px] pb-2 px-2 min-w-[64px]">
                    {datos.labelDe(col)}
                  </th>
                ))}
                <th className="text-right font-semibold text-slate-500 uppercase tracking-wide text-[10px] pb-2 pl-3">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {industriasFiltradas.map(ind => {
                const fila = datos.matriz.get(ind)!;
                const totalRaw = verPor === 'usd'
                  ? datos.columnas.reduce((s, col) => s + (fila.get(col)?.usd ?? 0), 0)
                  : datos.columnas.reduce((s, col) => s + (fila.get(col)?.count ?? 0), 0);
                const totalClientes = datos.columnas.flatMap(col => fila.get(col)?.clientes ?? []);
                return (
                  <tr key={ind} className="border-t border-slate-50">
                    <td className="py-1.5 pr-3 text-slate-700 font-medium whitespace-nowrap sticky left-0 bg-white">
                      {ind}
                    </td>
                    {datos.columnas.map(col => {
                      const cel = fila.get(col);
                      const count = cel?.count ?? 0;
                      const esHueco = count === 0;
                      const valor = datos.valorCelda(ind, col);
                      const colLabel = agruparPor === 'pais' ? col : datos.labelDe(col);
                      return (
                        <td key={col} className="p-0.5">
                          {esHueco ? (
                            <div
                              title={`${ind} en ${colLabel}: sin cuentas — oportunidad de expansión`}
                              className="h-7 rounded-md flex items-center justify-center tabular-nums font-semibold
                                         border border-dashed border-amber-300 bg-amber-50 text-amber-500"
                            >
                              —
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDetalle({
                                titulo: `${ind} · ${colLabel}`,
                                subtitulo: `${count} cuenta${count === 1 ? '' : 's'} · ${fmtUSD(cel!.usd)} ${periodoLabel}`,
                                clientes: cel!.clientes,
                              })}
                              aria-label={`Ver las ${count} empresas de ${ind} en ${colLabel}`}
                              title={`${ind} en ${colLabel}: ${count} cuenta${count === 1 ? '' : 's'} · ${fmtUSD(cel!.usd)} ${periodoLabel}`}
                              className="w-full h-7 rounded-md flex items-center justify-center tabular-nums font-semibold text-slate-700
                                         hover:ring-2 hover:ring-[#0097A7]/40 focus:outline-none focus:ring-2 focus:ring-[#0097A7] transition-shadow"
                              style={{ background: bgHeat(valor, datos.maxCelda) }}
                            >
                              {escala === 'pct' ? fmtPct(valor) : (verPor === 'usd' ? fmtUSD(valor) : valor)}
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className="pl-3 text-right">
                      <button
                        type="button"
                        disabled={totalClientes.length === 0}
                        onClick={() => setDetalle({
                          titulo: ind,
                          subtitulo: `${totalClientes.length} cuenta${totalClientes.length === 1 ? '' : 's'} · ${fmtUSD(
                            totalClientes.reduce((s, { usd }) => s + usd, 0)
                          )} ${periodoLabel}`,
                          clientes: totalClientes,
                        })}
                        className="font-bold tabular-nums text-slate-800 hover:text-[#0097A7] hover:underline disabled:no-underline disabled:hover:text-slate-800"
                      >
                        {escala === 'pct'
                          ? fmtPct(datos.valorTotalFila(ind))
                          : (verPor === 'usd' ? fmtUSD(totalRaw) : totalRaw)}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200">
                <td className="py-1.5 pr-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide sticky left-0 bg-white">
                  Total
                </td>
                {datos.columnas.map(col => {
                  const totalCol = verPor === 'usd' ? (datos.totalColUsd.get(col) ?? 0) : (datos.totalColCount.get(col) ?? 0);
                  return (
                    <td key={col} className="text-center text-[11px] font-bold text-slate-600 tabular-nums py-1.5">
                      {verPor === 'usd' ? fmtUSD(totalCol) : totalCol.toLocaleString('es-CL')}
                    </td>
                  );
                })}
                <td className="pl-3 text-right text-[11px] font-bold text-slate-800 tabular-nums py-1.5">
                  {verPor === 'usd' ? fmtUSD(datos.totalGlobalUsd) : datos.totalGlobalCount.toLocaleString('es-CL')}
                </td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}

      <p className="text-[10px] text-slate-400">
        Casilla punteada en ámbar = 0 cuentas de esa industria en esa columna. El color de fondo de
        las demás celdas escala con el valor mostrado (más oscuro = más alto), no es una categoría.
        Click en cualquier celda o en el Total de una fila para ver el detalle de empresas.
        {verPor === 'usd' && ' La facturación por año/mes sale de las últimas facturas registradas por transacción (hasta 4 años atrás).'}
      </p>

      {detalle && (
        <DetalleIndustriaPanel
          titulo={detalle.titulo}
          subtitulo={detalle.subtitulo}
          periodoLabel={periodoLabel}
          clientes={detalle.clientes}
          onClose={() => setDetalle(null)}
        />
      )}
    </div>
  );
}
