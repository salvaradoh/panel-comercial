import { useMemo } from 'react';
import { useKamsReporte } from '../hooks/useKamsReporte';
import { useKamsSummary } from '../hooks/useKamsSummary';
import { useReuniones } from '../hooks/useReuniones';
import { useTablaClientes } from '../hooks/useTablaClientes';
import { useKamPhotos } from '../hooks/useKamPhotos';
import type { UserRoleData } from '../hooks/useUserRole';
import type { ClienteTabla } from '../hooks/useTablaClientes';
import type { KamReporte } from '../hooks/useKamsReporte';

const FLAG_CC: Record<string, string> = {
  Chile: 'cl', Perú: 'pe', Peru: 'pe', Colombia: 'co', México: 'mx', Mexico: 'mx',
};

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
  const { data: kamsData } = useKamsReporte(anio, mes, 0);
  const { data: summaryData } = useKamsSummary(anio);
  const { data: reuniones } = useReuniones(anio, mes);
  const { data: clientes } = useTablaClientes();
  const { data: photos } = useKamPhotos();

  const kamReporte: KamReporte | undefined = useMemo(
    () => kamsData?.find(k => k.nombre === userRole.nombre),
    [kamsData, userRole.nombre]
  );

  const kamSummary = useMemo(
    () => summaryData?.kams.find(k => k.nombre === userRole.nombre),
    [summaryData, userRole.nombre]
  );

  const misReuniones = useMemo(
    () => reuniones?.find(r => r.sellerEmail === email.toLowerCase()),
    [reuniones, email]
  );

  const misClientes: ClienteTabla[] = useMemo(() => {
    if (!clientes) return [];
    return clientes.filter(c => c.kam === userRole.nombre && c.tipo !== 'perdido_historico');
  }, [clientes, userRole.nombre]);

  const clientesEnRiesgo = useMemo(
    () =>
      [...misClientes]
        .filter(c => {
          const score = c.tipo === 'estacional' || c.tipo === 'primera_compra' ? c.scoreEst : c.scoreEng;
          return score < 2.5;
        })
        .sort((a, b) => {
          const sa = a.tipo === 'estacional' || a.tipo === 'primera_compra' ? a.scoreEst : a.scoreEng;
          const sb = b.tipo === 'estacional' || b.tipo === 'primera_compra' ? b.scoreEst : b.scoreEng;
          return sa - sb;
        })
        .slice(0, 20),
    [misClientes]
  );

  const avance = kamReporte?.avance ?? 0;
  const meta   = kamReporte?.meta   ?? 0;
  const pct    = meta > 0 ? avance / meta : 0;
  const mFlag  = FLAG_CC[userRole.pais] ?? 'latam';
  const photo  = photos?.[userRole.nombre] ?? photos?.[userRole.kamId];
  const initials = userRole.nombre.split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();

  const TIPO_LABEL: Record<string, string> = {
    recurrente: 'Recurrente', estacional: 'Estacional',
    primera_compra: '1ra Compra', perdido_historico: 'Perdido',
  };
  const TIPO_COLOR: Record<string, string> = {
    recurrente: 'bg-emerald-100 text-emerald-700',
    estacional: 'bg-blue-100 text-blue-700',
    primera_compra: 'bg-violet-100 text-violet-700',
    perdido_historico: 'bg-slate-100 text-slate-500',
  };

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

      {/* KPIs del mes */}
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Desempeño del mes</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Avance mes" value={fmtUSD(avance)} />
          <KpiCard label="Meta mes" value={fmtUSD(meta)} />
          <KpiCard
            label="Cumplimiento"
            value={`${(pct * 100).toFixed(0)}%`}
            accent={meta > 0 ? pctColor(pct) : undefined}
          />
          <KpiCard label="Reuniones" value={String(misReuniones?.mes ?? 0)} sub="clientes únicos este mes" />
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

      {/* Clientes en riesgo */}
      {clientesEnRiesgo.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Clientes en riesgo ({clientesEnRiesgo.length})
          </h2>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Empresa</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Score</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Días s/c</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Última compra</th>
                </tr>
              </thead>
              <tbody>
                {clientesEnRiesgo.map((c, i) => {
                  const score = c.tipo === 'estacional' || c.tipo === 'primera_compra' ? c.scoreEst : c.scoreEng;
                  const scoreColor = score < 1.5 ? '#ef4444' : score < 2 ? '#f59e0b' : '#94a3b8';
                  return (
                    <tr
                      key={c.panelId}
                      className={[
                        'border-b border-slate-50 hover:bg-slate-50 transition-colors',
                        i === clientesEnRiesgo.length - 1 ? 'border-b-0' : '',
                      ].join(' ')}
                    >
                      <td className="px-4 py-2.5 font-medium text-slate-800">{c.nombre}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_COLOR[c.tipo]}`}>
                          {TIPO_LABEL[c.tipo]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-bold" style={{ color: scoreColor }}>
                        {score.toFixed(1)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">
                        {c.diasSinCompra}d
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-400 hidden sm:table-cell">
                        {c.ultimaCompra || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {clientesEnRiesgo.length === 0 && misClientes.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 text-sm text-emerald-700 font-medium">
          Todos tus clientes activos tienen score ≥ 2.5 — sin alertas de riesgo.
        </div>
      )}
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

  const totalAvance = kams.reduce((s, k) => s + k.avance, 0);
  const totalMeta   = kams.reduce((s, k) => s + k.meta,   0);
  const globalPct   = totalMeta > 0 ? totalAvance / totalMeta : 0;

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
        <KpiCard label="Avance mes" value={fmtUSD(totalAvance)} />
        <KpiCard label="Meta mes" value={fmtUSD(totalMeta)} />
        <KpiCard
          label="Cumplimiento"
          value={`${(globalPct * 100).toFixed(0)}%`}
          accent={totalMeta > 0 ? pctColor(globalPct) : undefined}
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
            <table className="w-full text-sm">
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
                      <td className="px-4 py-3 text-center">
                        {medalEmoji ? (
                          <span style={{ fontSize: 18 }}>{medalEmoji}</span>
                        ) : (
                          <span className="text-xs text-slate-400 tabular-nums">{i + 1}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{k.nombre}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">{fmtUSD(k.avance)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className="font-bold" style={{ color: k.meta > 0 ? pctColor(k.pct) : '#94a3b8' }}>
                          {k.meta > 0 ? `${(k.pct * 100).toFixed(0)}%` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-500 hidden sm:table-cell">
                        {summary ? summary.activos : '—'}
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
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
