import { useMemo, useState } from 'react';
import { useKamsReporte, useKamSerie } from '../hooks/useKamsReporte';
import { useKamsSummary } from '../hooks/useKamsSummary';
import { useReuniones } from '../hooks/useReuniones';
import { useKamPhotos } from '../hooks/useKamPhotos';
import { useRanking } from '../hooks/useRanking';
import { usePaisesSeries } from '../hooks/usePaisesSeries';
import { usePaisesSeriesMes } from '../hooks/usePaisesSeriesMes';
import { useKamsSeriesMes } from '../hooks/useKamsSeriesMes';
import { useMetas, usePaisesAvanceMensual } from '../hooks/useMetas';
import { RegionPanel } from '../components/charts/RegionSparkCard';
import { MonthlyForecastChart } from '../components/charts/MonthlyForecastChart';
import { SegmentacionPage } from './SegmentacionPage';
import { useEjecutivos } from '../hooks/useEquipo';
import { normPais } from '../hooks/useKamsReporte';
import type { UserRoleData } from '../hooks/useUserRole';
import type { KamReporte } from '../hooks/useKamsReporte';

const FLAG_CC: Record<string, string> = {
  Chile: 'cl', Perú: 'pe', Peru: 'pe', Colombia: 'co', México: 'mx', Mexico: 'mx',
};

const MES_NOMBRES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function fmtUSD(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function pctColor(p: number) {
  return p >= 1 ? '#10b981' : p >= 0.8 ? '#f59e0b' : '#ef4444';
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 flex flex-col gap-1 shadow-sm">
      <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold tabular-nums" style={{ color: accent ?? '#0f172a' }}>{value}</span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  );
}

// ── Vista Ejecutivo ───────────────────────────────────────────────────────────

function EjecutivoView({
  userRole,
  email,
  anio,
  mes,
}: {
  userRole: UserRoleData;
  email: string;
  anio: number;
  mes: number;
}) {
  const prevMes  = mes > 1 ? mes - 1 : 12;
  const prevAnio = mes > 1 ? anio : anio - 1;

  // Google Sheets (Cache_Reporte) — fuente de datos KAM
  const { data: kamsData }        = useKamsReporte(anio,     mes,     0);
  const { data: kamsDataPrevMes } = useKamsReporte(prevAnio, prevMes, 0);
  const { data: metasData }       = useMetas(anio, mes, 0);
  const { data: kamSerie }        = useKamSerie(userRole.nombre, anio);

  const { data: summaryData } = useKamsSummary(anio);
  const { data: reuniones }   = useReuniones(anio, mes);
  const ejecutivos            = useEjecutivos();
  const { data: photos }      = useKamPhotos();
  const { data: rankingData } = useRanking(anio);
  const { data: paisesSeries }  = usePaisesSeries(anio, 1);
  const { data: paisesMesAnt }  = usePaisesSeriesMes(anio - 1);
  const { data: kamsMesAnt }    = useKamsSeriesMes(anio - 1);
  const paisesAvanceMensual     = usePaisesAvanceMensual(anio);

  // Fallback a nivel KAM: si este mes no tiene datos para este KAM, usar el mes anterior
  const kamReporte: KamReporte | undefined = useMemo(() => {
    const current = kamsData?.find(k => k.nombre === userRole.nombre);
    if (current && (current.avance > 0 || current.meta > 0)) return current;
    return kamsDataPrevMes?.find(k => k.nombre === userRole.nombre);
  }, [kamsData, kamsDataPrevMes, userRole.nombre]);

  // ¿Se está usando datos del mes anterior por falta de datos en el mes seleccionado?
  const isUsingFallback = useMemo(() => {
    const current = kamsData?.find(k => k.nombre === userRole.nombre);
    return !current || (current.avance === 0 && current.meta === 0);
  }, [kamsData, userRole.nombre]);

  const kamSummary = useMemo(
    () => summaryData?.kams.find(k => k.nombre === userRole.nombre),
    [summaryData, userRole.nombre]
  );

  // Reuniones: busca por email (directo) o por nombre (impersonación admin)
  const misReuniones = useMemo(() => {
    if (!reuniones) return undefined;
    return (
      reuniones.find(r => r.sellerEmail === email.toLowerCase()) ??
      reuniones.find(r => r.nombre === userRole.nombre)
    );
  }, [reuniones, email, userRole.nombre]);

  const avance = kamReporte?.avance ?? 0;
  const meta   = kamReporte?.meta   ?? 0;
  const pct    = meta > 0 ? avance / meta : 0;
  const mFlag  = FLAG_CC[userRole.pais] ?? 'latam';
  const photo  = photos?.[userRole.nombre] ?? photos?.[userRole.kamId];
  const initials = userRole.nombre.split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();

  const [chartView, setChartView] = useState<'pais' | 'yo'>('pais');

  const currentMonthN = new Date().getMonth() + 1;
  const regionRow = useMemo(() => {
    const rankPais = rankingData?.paises.find(p => p.nombre === userRole.pais);
    if (!rankPais) return null;
    const serieAnt = (paisesMesAnt?.[userRole.pais] ?? []).filter(pt => {
      const m = new Date(pt.time + 'T12:00:00').getMonth() + 1;
      return m <= currentMonthN;
    });
    const avanceAnt = serieAnt.reduce((s, pt) => s + pt.value, 0);
    const varYoYPct = avanceAnt > 0
      ? ((rankPais.avanceAnualUSD - avanceAnt) / avanceAnt) * 100
      : null;
    return {
      pais: rankPais.nombre,
      avance: rankPais.avanceAnualUSD,
      meta: rankPais.metaAnualUSD,
      pct: rankPais.cumplimiento,
      varYoYPct,
      serie: paisesSeries?.[userRole.pais] ?? [],
      prevYearSerie: paisesMesAnt?.[userRole.pais] ?? [],
      mesAvances: paisesAvanceMensual[userRole.pais] ?? paisesAvanceMensual[rankPais.nombre],
    };
  }, [rankingData, paisesSeries, paisesMesAnt, paisesAvanceMensual, userRole.pais, currentMonthN]);

  // KPIs del mes por país — fuente autoritativa: useMetas (Tabla_Avance_Total_Pais)
  // incluye ventas no atribuidas a KAMs específicos. Fallback a suma de KAMs si no hay datos.
  const countryKpis = useMemo(() => {
    const normPaisStr = userRole.pais.toLowerCase()
      .replace(/^mexico$/i, 'méxico').replace(/^peru$/i, 'perú');
    const paisMetas = (metasData?.paises ?? []).find(p => p.pais.toLowerCase() === normPaisStr);
    if (paisMetas && (paisMetas.avance > 0 || paisMetas.meta > 0)) {
      return { avance: paisMetas.avance, meta: paisMetas.meta, pct: paisMetas.pct };
    }
    // Fallback a suma de KAMs si useMetas no tiene datos aún
    let countryKams = (kamsData ?? []).filter(k => k.pais.toLowerCase() === normPaisStr);
    if (!countryKams.length || countryKams.every(k => !k.avance && !k.meta)) {
      countryKams = (kamsDataPrevMes ?? []).filter(k => k.pais.toLowerCase() === normPaisStr);
    }
    const totalAvance = countryKams.reduce((s, k) => s + k.avance, 0);
    const totalMeta   = countryKams.reduce((s, k) => s + k.meta,   0);
    return { avance: totalAvance, meta: totalMeta, pct: totalMeta > 0 ? totalAvance / totalMeta : 0 };
  }, [metasData, kamsData, kamsDataPrevMes, userRole.pais]);

  // Reuniones del país según la hoja de ejecutivos (no depende de los KAMs con datos ese mes).
  // La hoja escribe "Peru"/"Mexico" y la lista viene con tilde: se comparan normalizados.
  const countryReuniones = useMemo(() => {
    if (!reuniones) return 0;
    const countryNames = new Set(
      ejecutivos.filter(e => e.pais === normPais(userRole.pais)).map(e => e.nombre)
    );
    return reuniones.filter(r => countryNames.has(r.nombre)).reduce((s, r) => s + r.mes, 0);
  }, [reuniones, userRole.pais, ejecutivos]);

  const execRow = useMemo(() => {
    const varYoYPct = kamReporte && kamReporte.ant > 0
      ? (kamReporte.varYoY / kamReporte.ant) * 100
      : null;
    return {
      pais: userRole.pais,
      label: userRole.nombre,
      avance: kamReporte?.avance ?? 0,
      meta:   kamReporte?.meta   ?? 0,
      pct:    kamReporte?.pct    ?? 0,
      varYoYPct,
      serie: kamSerie ?? [],
      // Mensual (Cache_Series › kams) contra una serie actual semanal: el
      // sparkline detecta la granularidad y reparte el mes en 4 semanas.
      prevYearSerie: kamsMesAnt?.[userRole.nombre] ?? [],
    };
  }, [kamReporte, kamSerie, kamsMesAnt, userRole.pais, userRole.nombre]);

  const toggle = (
    <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5 flex-shrink-0">
      {([['pais', 'Mi País'], ['yo', 'Mis Indicadores']] as const).map(([v, label]) => (
        <button
          key={v}
          onClick={() => setChartView(v)}
          className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all whitespace-nowrap ${
            chartView === v ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        {photo ? (
          <img src={photo} alt={userRole.nombre} className="w-14 h-14 rounded-full object-cover ring-2 ring-white shadow" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-[#0097A7] flex items-center justify-center text-white font-bold text-lg shadow">
            {initials}
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-slate-900">{userRole.nombre}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <img
              src={`https://flagcdn.com/20x15/${mFlag}.png`}
              alt={userRole.pais}
              className="rounded-sm"
            />
            <span className="text-sm text-slate-500">{userRole.pais}</span>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">Ejecutivo</span>
          </div>
        </div>
      </div>

      {/* Venta por Región / Mis Indicadores + Avance Mensual */}
      {regionRow && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'stretch', height: 230 }}>
          <RegionPanel
            rows={[chartView === 'pais' ? regionRow : execRow]}
            semana={1}
            title={chartView === 'yo' ? 'Mis Indicadores' : undefined}
            headerSlot={toggle}
          />
          {/* Avance Mensual — trae su propio selector País/Yo */}
          <div style={{ flex: '1 1 340px', minWidth: 280, height: '100%' }}>
            <MonthlyForecastChart
              anio={anio}
              currentMes={mes}
              ytdReal={regionRow.avance}
              latamSeries={[]}
              latamPrevYearSeries={[]}
              defaultPais={userRole.pais}
              hidePaisSwitcher
              kamNombre={userRole.nombre}
            />
          </div>
        </div>
      )}

      {/* KPIs del mes — cambian según Mi País / Mis Indicadores */}
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Desempeño del mes{chartView === 'pais' ? ` — ${userRole.pais}` : ''}
          {chartView === 'yo' && isUsingFallback && (
            <span className="ml-2 text-[10px] font-normal text-amber-500 normal-case tracking-normal">
              (último disponible: {MES_NOMBRES[prevMes]} {prevAnio})
            </span>
          )}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {chartView === 'pais' ? (
            <>
              <KpiCard label="Avance mes" value={fmtUSD(countryKpis.avance)} />
              <KpiCard label="Meta mes" value={fmtUSD(countryKpis.meta)} />
              <KpiCard
                label="Cumplimiento"
                value={`${(countryKpis.pct * 100).toFixed(0)}%`}
                accent={countryKpis.meta > 0 ? pctColor(countryKpis.pct) : undefined}
              />
              <KpiCard label="Reuniones" value={String(countryReuniones)} sub={`clientes únicos en ${userRole.pais}`} />
            </>
          ) : (
            <>
              <KpiCard label="Avance mes" value={fmtUSD(avance)} />
              <KpiCard label="Meta mes" value={fmtUSD(meta)} />
              <KpiCard
                label="Cumplimiento"
                value={`${(pct * 100).toFixed(0)}%`}
                accent={meta > 0 ? pctColor(pct) : undefined}
              />
              <KpiCard label="Reuniones" value={String(misReuniones?.mes ?? 0)} sub="clientes únicos este mes" />
            </>
          )}
        </div>
      </div>

      {/* Cartera */}
      {kamSummary && (
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Mi cartera</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <KpiCard label="Activos" value={String(kamSummary.activos)} />
            <KpiCard
              label="Recurrentes"
              value={String(kamSummary.recurrentes)}
              sub={`${(kamSummary.pct_recurrencia * 100).toFixed(0)}% de activos`}
              accent="#10b981"
            />
            <KpiCard label="Estacionales" value={String(kamSummary.estacionales)} />
            <KpiCard label="1ra Compra" value={String(kamSummary.primera_compra)} />
            <KpiCard label="Días prom. s/c" value={String(Math.round(kamSummary.dias_sc_prom))} />
          </div>
        </div>
      )}

      {/* Mis clientes — misma vista que el tab Clientes, filtrada por KAM */}
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Mis clientes</h2>
        <SegmentacionPage
          filterKam={userRole.nombre}
          filterPais={userRole.pais}
          embedded
        />
      </div>
    </div>
  );
}

// ── Vista Country Manager ─────────────────────────────────────────────────────

function CountryManagerView({
  userRole,
  anio,
  mes,
}: {
  userRole: UserRoleData;
  anio: number;
  mes: number;
}) {
  const { data: kamsData, isLoading } = useKamsReporte(anio, mes, 0);
  const { data: metasData } = useMetas(anio, mes, 0);
  const { data: summaryData } = useKamsSummary(anio);

  const mFlag = FLAG_CC[userRole.pais] ?? 'latam';

  const kams = useMemo(() => {
    const normPais = userRole.pais.toLowerCase().replace(/^peru$/i, 'perú').replace(/^mexico$/i, 'méxico');
    return (kamsData ?? [])
      .filter(k => k.pais.toLowerCase() === normPais)
      .sort((a, b) => b.pct - a.pct);
  }, [kamsData, userRole.pais]);

  type SummaryKam = NonNullable<typeof summaryData>['kams'][0];
  const summaryByNombre = useMemo(() => {
    const m = new Map<string, SummaryKam>();
    for (const k of summaryData?.kams ?? []) m.set(k.nombre, k);
    return m;
  }, [summaryData]);

  // Total del país desde useMetas (Tabla_Avance_Total_Pais) — incluye ventas no atribuidas a KAMs
  const countryTotals = useMemo(() => {
    const normPais = userRole.pais.toLowerCase().replace(/^peru$/i, 'perú').replace(/^mexico$/i, 'méxico');
    const paisMetas = (metasData?.paises ?? []).find(p => p.pais.toLowerCase() === normPais);
    if (paisMetas && (paisMetas.avance > 0 || paisMetas.meta > 0)) {
      return { avance: paisMetas.avance, meta: paisMetas.meta, pct: paisMetas.pct };
    }
    const totalAvance = kams.reduce((s, k) => s + k.avance, 0);
    const totalMeta   = kams.reduce((s, k) => s + k.meta,   0);
    return { avance: totalAvance, meta: totalMeta, pct: totalMeta > 0 ? totalAvance / totalMeta : 0 };
  }, [metasData, kams, userRole.pais]);

  return (
    <div className="space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <img src={`https://flagcdn.com/32x24/${mFlag}.png`} alt={userRole.pais} className="rounded shadow-sm" />
        <div>
          <h1 className="text-xl font-bold text-slate-900">{userRole.pais}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">Country Manager</span>
            <span className="text-sm text-slate-500">{userRole.nombre}</span>
          </div>
        </div>
      </div>

      {/* KPIs globales del país */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Avance mes" value={fmtUSD(countryTotals.avance)} />
        <KpiCard label="Meta mes" value={fmtUSD(countryTotals.meta)} />
        <KpiCard
          label="Cumplimiento"
          value={`${(countryTotals.pct * 100).toFixed(0)}%`}
          accent={countryTotals.meta > 0 ? pctColor(countryTotals.pct) : undefined}
        />
      </div>

      {/* Leaderboard KAMs del país */}
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Ejecutivos — {userRole.pais}
        </h2>

        {isLoading && (
          <div className="flex justify-center h-24 items-center">
            <span className="animate-spin w-5 h-5 rounded-full border-2 border-[#0097A7] border-t-transparent" />
          </div>
        )}

        {!isLoading && kams.length === 0 && (
          <div className="text-sm text-slate-400 text-center py-8">Sin datos para este período.</div>
        )}

        {!isLoading && kams.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="tabla-scroll">
              <table className="w-full text-sm tabla-apilable">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-8">#</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Ejecutivo</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Avance</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">% Cumpl.</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Activos</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Consistencia</th>
                  </tr>
                </thead>
                <tbody>
                  {kams.map((k, i) => {
                    const summary = summaryByNombre.get(k.nombre);
                    const medalEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                    return (
                      <tr
                        key={k.nombre}
                        className={[
                          'border-b border-slate-50 hover:bg-slate-50 transition-colors',
                          i === kams.length - 1 ? 'border-b-0' : '',
                        ].join(' ')}
                      >
                        <td data-label="#" className="px-4 py-3 text-center">
                          {medalEmoji ? (
                            <span style={{ fontSize: 18 }}>{medalEmoji}</span>
                          ) : (
                            <span className="text-xs text-slate-400 tabular-nums">{i + 1}</span>
                          )}
                        </td>
                        <td data-titular className="px-4 py-3 font-medium text-slate-800">{k.nombre}</td>
                        <td data-label="Avance" className="px-4 py-3 text-right tabular-nums text-slate-700">{fmtUSD(k.avance)}</td>
                        <td data-label="% Cumpl." className="px-4 py-3 text-right tabular-nums">
                          <span className="font-bold" style={{ color: k.meta > 0 ? pctColor(k.pct) : '#94a3b8' }}>
                            {k.meta > 0 ? `${(k.pct * 100).toFixed(0)}%` : '—'}
                          </span>
                        </td>
                        <td data-label="Activos" className="px-4 py-3 text-right tabular-nums text-slate-500 hidden sm:table-cell">
                          {summary ? summary.activos : '—'}
                        </td>
                        <td data-label="Consistencia" className="px-4 py-3 text-right hidden sm:table-cell">
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full tabular-nums">
                            {k.consistencia}/4 sem.
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Export principal ──────────────────────────────────────────────────────────

interface MiVistaPageProps {
  userRole: UserRoleData;
  email: string;
  anio: number;
  mes: number;
}

export function MiVistaPage({ userRole, email, anio, mes }: MiVistaPageProps) {
  if (userRole.rol === 'Ejecutivo') {
    return <EjecutivoView userRole={userRole} email={email} anio={anio} mes={mes} />;
  }
  if (userRole.rol === 'Country Manager') {
    return <CountryManagerView userRole={userRole} anio={anio} mes={mes} />;
  }
  return null;
}
