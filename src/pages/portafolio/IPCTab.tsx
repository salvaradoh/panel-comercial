import { useMemo, useState } from 'react';
import { Card } from '../../components/ui';
import { BanderaPais } from '../../components/ui/BanderaPais';
import { useIPC } from '../../hooks/useIPC';
import type { AlertaIPC, ClienteIPC } from '../../hooks/useIPC';
import { PAISES } from '../../lib/paises';
import { descargarExcelIPC } from './exportIPCExcel';

const POR_PAGINA = 12;

/** Colores de la alerta. Nunca el color solo: siempre va con el texto al lado. */
const ALERTA_ESTILO: Record<AlertaIPC, { punto: string; texto: string; chip: string }> = {
  Verde:    { punto: 'bg-emerald-500', texto: 'text-emerald-700', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  Amarillo: { punto: 'bg-amber-500',   texto: 'text-amber-700',   chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  Rojo:     { punto: 'bg-rose-500',    texto: 'text-rose-700',    chip: 'bg-rose-50 text-rose-700 border-rose-200' },
};

/**
 * Color por tipo de interacción. Fondo -100 con texto -800 y borde -200: los -50 no
 * alcanzaban, celeste y cian quedaban indistinguibles justo en los dos tipos más
 * frecuentes (Virtual 77 filas, Email / WA 25).
 *
 * El par que MÁS tiene que separarse es Virtual vs Email / WA, así que se les dan
 * hues opuestos dentro de la gama fría —azul contra violeta— y no dos azules
 * vecinos. Los tipos raros (Presencial, Llamada, Café) toman lo que queda: aunque
 * índigo se parezca a celeste, casi nunca aparecen juntos en pantalla.
 *
 * A propósito NINGUNO usa verde, ámbar ni rojo: esos tres son el semáforo de la
 * alerta, que va en la columna de al lado, y un chip ámbar acá se leería como
 * "Amarillo".
 */
const TIPO_INTERACCION_COLOR: Record<string, string> = {
  'Virtual':    'bg-sky-100 text-sky-800 border-sky-200',
  'Email / WA': 'bg-violet-100 text-violet-800 border-violet-200',
  'Llamada':    'bg-teal-100 text-teal-800 border-teal-200',
  'Presencial': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'Café':       'bg-stone-200 text-stone-800 border-stone-300',
};

/** Relleno de la barra de participación. Mismo hue que el chip, pero sólido: un
 *  -100 sobre fondo claro no se distingue en una franja de 10px. */
const TIPO_INTERACCION_BARRA: Record<string, string> = {
  'Virtual':    'bg-sky-400',
  'Email / WA': 'bg-violet-400',
  'Llamada':    'bg-teal-400',
  'Presencial': 'bg-indigo-400',
  'Café':       'bg-stone-400',
};

const TIPO_CORTO: Record<string, string> = {
  Recurrente: 'Rec.',
  Estacional: 'Est.',
  'Primera Compra': '1ra C.',
};

type FiltroAlerta = 'Todos' | AlertaIPC | 'sin30';

type SortKey = 'pais' | 'empresa' | 'tipo' | 'ipcScore' | 'pts' | 'tendencia'
             | 'alerta' | 'interacciones' | 'ultima' | 'ultimoTipo' | 'diasSinInteraccion';

/** Orden del semáforo: lo urgente primero. No es alfabético. */
const ORDEN_ALERTA: Record<AlertaIPC, number> = { Rojo: 0, Amarillo: 1, Verde: 2 };

function SortTh({ k, cur, dir, onSort, align = 'right', className, children }: {
  k: SortKey; cur: SortKey; dir: 'asc' | 'desc';
  onSort: (k: SortKey) => void;
  align?: 'left' | 'right';
  className?: string;
  children: React.ReactNode;
}) {
  const active = cur === k;
  return (
    <th
      className={`${className ?? ''} cursor-pointer select-none hover:text-slate-600 transition-colors text-${align}`}
      onClick={() => onSort(k)}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span className="inline-flex items-center gap-0.5">
        {align === 'right' && active && <span className="text-[#0097A7]">{dir === 'asc' ? '↑' : '↓'}</span>}
        <span className={active ? 'text-[#0097A7]' : ''}>{children}</span>
        {align === 'left' && active && <span className="text-[#0097A7]">{dir === 'asc' ? '↑' : '↓'}</span>}
        {!active && <span className="opacity-30">↕</span>}
      </span>
    </th>
  );
}

function fechaCorta(iso: string | null): string {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-').map(Number);
  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${d} ${MESES[m - 1]}${a !== new Date().getFullYear() ? ` ${a}` : ''}`;
}

function Chip({ activo, onClick, children, className = '' }: {
  activo: boolean; onClick: () => void; children: React.ReactNode; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={activo}
      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all active:scale-95 ${
        activo
          ? 'bg-[#0097A7] text-white border-[#0097A7]'
          : `bg-white text-slate-600 border-slate-200 hover:border-slate-300 ${className}`
      }`}
    >
      {children}
    </button>
  );
}

function Kpi({ valor, titulo, sub, acento }: {
  valor: string | number; titulo: string; sub: string; acento: string;
}) {
  return (
    <Card className="!p-4 border-l-4" >
      <div style={{ borderColor: acento }} className="-ml-4 pl-4 border-l-4">
        <div className="text-3xl font-bold tabular-nums" style={{ color: acento }}>{valor}</div>
        <div className="text-sm font-medium text-slate-700 mt-0.5">{titulo}</div>
        <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
      </div>
    </Card>
  );
}

interface Props {
  /** País impuesto por el rol. El backend lo aplica igual; esto solo evita ofrecer el selector. */
  filterPais?: string;
}

export function IPCTab({ filterPais }: Props) {
  const trimestreHoy = `Q${Math.floor(new Date().getMonth() / 3) + 1}-${new Date().getFullYear()}`;
  const [trimestre, setTrimestre] = useState(trimestreHoy);
  const [paisSel, setPaisSel] = useState<string>('');
  const [filtro, setFiltro] = useState<FiltroAlerta>('Todos');
  // Por defecto la vista muestra solo a quien SÍ fue atendido en el trimestre. Los
  // que figuran en la hoja pero no tuvieron interacción en este Q entran con el
  // checkbox: son los que se enfriaron, y verlos es opcional.
  const [verNoAtendidos, setVerNoAtendidos] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [descargando, setDescargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);
  // Por defecto se ordena como venía del backend: alerta más urgente y, dentro de
  // ella, el IPC más bajo. Es lo que hay que atender primero.
  const [sortKey, setSortKey] = useState<SortKey>('alerta');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
    setPagina(0);
  }

  const { data, isLoading, error } = useIPC(trimestre, filterPais || paisSel || undefined);

  // Conjunto sobre el que se calcula TODO —KPIs, barras y tabla—, para que el
  // encabezado no diga "11 clientes" mientras la tabla muestra 5.
  const enAlcance = useMemo(() => {
    const todos = data?.clientes ?? [];
    return verNoAtendidos ? todos : todos.filter((c) => c.interacciones > 0);
  }, [data?.clientes, verNoAtendidos]);

  const noAtendidos = useMemo(
    () => (data?.clientes ?? []).filter((c) => c.interacciones === 0).length,
    [data?.clientes],
  );

  // Los conteos por alerta se recalculan acá y no se leen de `resumen`: el backend
  // los computa sobre todos los clientes y dejarían de cuadrar al filtrar.
  const stats = useMemo(() => ({
    clientes: enAlcance.length,
    ipcPromedio: enAlcance.length
      ? Math.round(enAlcance.reduce((a, c) => a + c.ipcScore, 0) / enAlcance.length)
      : 0,
    verde: enAlcance.filter((c) => c.alerta === 'Verde').length,
    amarillo: enAlcance.filter((c) => c.alerta === 'Amarillo').length,
    rojo: enAlcance.filter((c) => c.alerta === 'Rojo').length,
    sinInteraccion: enAlcance.filter((c) => c.interacciones === 0).length,
  }), [enAlcance]);

  const clientes = useMemo(() => {
    const todos = enAlcance;
    const filtrados =
      filtro === 'Todos' ? todos
      : filtro === 'sin30' ? todos.filter((c) => c.sinInteraccionReciente)
      : todos.filter((c) => c.alerta === filtro);

    // Un cliente sin interacciones no tiene fecha ni tipo. Va SIEMPRE al final, en
    // los dos sentidos del orden: si se colara arriba en descendente, la primera
    // página se llenaría de guiones.
    const alFinal = (v: unknown) => v === null || v === undefined || v === '';
    const dir = sortDir === 'asc' ? 1 : -1;

    return [...filtrados].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'pais':
        case 'empresa':
        case 'tipo':
        case 'ultimoTipo': {
          const va = String(a[sortKey === 'ultimoTipo' ? 'ultimoTipo' : sortKey] ?? '');
          const vb = String(b[sortKey === 'ultimoTipo' ? 'ultimoTipo' : sortKey] ?? '');
          if (alFinal(va) !== alFinal(vb)) return alFinal(va) ? 1 : -1;
          cmp = va.localeCompare(vb, 'es');
          break;
        }
        case 'alerta':
          cmp = ORDEN_ALERTA[a.alerta] - ORDEN_ALERTA[b.alerta] || a.ipcScore - b.ipcScore;
          break;
        case 'ultima': {
          if (alFinal(a.ultimaInteraccion) !== alFinal(b.ultimaInteraccion)) {
            return alFinal(a.ultimaInteraccion) ? 1 : -1;
          }
          cmp = String(a.ultimaInteraccion ?? '').localeCompare(String(b.ultimaInteraccion ?? ''));
          break;
        }
        case 'tendencia':
        case 'diasSinInteraccion': {
          const va = a[sortKey];
          const vb = b[sortKey];
          if (alFinal(va) !== alFinal(vb)) return alFinal(va) ? 1 : -1;
          cmp = Number(va ?? 0) - Number(vb ?? 0);
          break;
        }
        default:
          cmp = Number(a[sortKey] ?? 0) - Number(b[sortKey] ?? 0);
      }
      // Desempate estable por nombre: sin esto, dos filas con el mismo IPC bailan
      // de lugar entre renders.
      return (cmp * dir) || a.empresa.localeCompare(b.empresa, 'es');
    });
  }, [enAlcance, filtro, sortKey, sortDir]);

  const totalPaginas = Math.max(1, Math.ceil(clientes.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas - 1);
  const visibles = clientes.slice(paginaActual * POR_PAGINA, (paginaActual + 1) * POR_PAGINA);

  async function handleDescargar() {
    if (!data) return;
    setDescargando(true);
    setErrorDescarga(null);
    try {
      await descargarExcelIPC(data);
    } catch (e) {
      // Sin esto el botón volvía a "Descargar Excel" como si hubiera funcionado:
      // exceljs se carga por import dinámico y un chunk que no baja falla acá.
      setErrorDescarga(e instanceof Error ? e.message : 'No se pudo generar el archivo');
    } finally {
      setDescargando(false);
    }
  }

  function cambiar<T>(set: (v: T) => void) {
    return (v: T) => { set(v); setPagina(0); };
  }

  // Un error de la query se cachea 10 min: si esto devolviera null, el tab
  // quedaría en blanco sin explicación. Siempre se renderiza algún estado.
  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5">
        <p className="font-semibold text-rose-700 mb-1">No se pudo cargar el IPC</p>
        <p className="text-sm text-rose-600 font-mono break-all">{(error as Error).message}</p>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-48">
        <span className="animate-spin w-5 h-5 rounded-full border-2 border-[#0097A7] border-t-transparent" />
      </div>
    );
  }

  const { resumen, periodo, alcance } = data;
  const deltaInter = resumen.interacciones - resumen.interaccionesPrev;
  const paisActivo = filterPais || paisSel;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Controles ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 flex-wrap text-xs">
        <label className="flex items-center gap-2">
          <span className="uppercase tracking-wide text-slate-400 font-medium">Trimestre</span>
          <select
            value={trimestre}
            onChange={(e) => cambiar(setTrimestre)(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-700"
          >
            {data.trimestresDisponibles.map((t) => (
              <option key={t} value={t}>{t.replace('-', ' ')}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="uppercase tracking-wide text-slate-400 font-medium">Vista</span>
          {alcance.puedeElegirPais ? (
            <select
              value={paisSel}
              onChange={(e) => cambiar(setPaisSel)(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-700"
            >
              <option value="">LATAM · todos los países</option>
              {PAISES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          ) : (
            // El selector no se dibuja porque el rol no puede cambiarlo: el
            // backend ignora el parámetro. Mostrarlo deshabilitado sugeriría que
            // hay algo que desbloquear.
            <span className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-600">
              <BanderaPais pais={alcance.pais ?? ''} />
              {alcance.pais} · {alcance.rol}
            </span>
          )}
        </label>

        <span className="inline-flex items-center gap-2 text-slate-500">
          <span className="uppercase tracking-wide text-slate-400 font-medium">Meta A+</span>
          {Object.entries(data.metaPorTipo).map(([tipo, pts]) => (
            <span key={tipo} className="inline-flex items-baseline gap-1 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1">
              <span>{TIPO_CORTO[tipo] ?? tipo}</span>
              <span className="font-bold tabular-nums text-slate-700">{pts}</span>
              <span className="text-slate-400">pts</span>
            </span>
          ))}
        </span>

        <span className="text-slate-400 ml-auto tabular-nums">
          {periodo.cerrado
            ? `Trimestre cerrado · ${periodo.dias} días`
            : `Día ${periodo.transcurridos} de ${periodo.dias} · ${periodo.restantes} restantes`}
        </span>

        <button
          type="button"
          onClick={handleDescargar}
          disabled={descargando}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                     bg-[#0097A7] text-white hover:bg-[#00838f] transition-colors disabled:opacity-50
                     disabled:cursor-wait flex-shrink-0 shadow-sm"
          title="Excel con tres hojas: Resumen de esta vista, Clientes con todas las columnas e Interacciones fila por fila. El detalle va sin los filtros de pantalla, para armar tablas dinámicas."
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M8 1.5v9M8 10.5 4.5 7M8 10.5 11.5 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2.5 12.5v1.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          {descargando ? 'Generando…' : 'Descargar Excel'}
        </button>

        {errorDescarga && (
          <span role="alert" className="w-full text-rose-600">
            No se pudo generar el Excel: {errorDescarga}
          </span>
        )}
      </div>

      <h2 className="text-xs uppercase tracking-wider text-slate-400 font-semibold -mb-2">
        Clientes A+ con interacciones registradas · IPC {trimestre.replace('-', ' ')}
        {paisActivo ? ` · ${paisActivo}` : ' · LATAM'}
      </h2>

      {/* ── KPIs ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          valor={stats.ipcPromedio}
          titulo="IPC promedio cartera"
          sub="Segmento A+ · escala 0–100"
          acento="#0097A7"
        />
        <Kpi
          valor={resumen.interacciones}
          titulo={`Interacciones ${trimestre.split('-')[0]}`}
          sub={`${deltaInter >= 0 ? '+' : ''}${deltaInter} vs ${data.trimestreAnterior.replace('-', ' ')}`}
          acento="#334155"
        />
        <Kpi
          valor={stats.verde}
          titulo="En alerta verde"
          sub="Al ritmo actual llegan a la meta"
          acento="#10b981"
        />
        <Kpi
          valor={stats.rojo}
          titulo="En alerta roja"
          sub="Proyectado bajo la meta · acción inmediata"
          acento="#f43f5e"
        />
      </div>

      {/* ── Distribución de alertas · Participación por tipo ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="!p-4">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Distribución de alertas
            </span>
            <span className="text-xs text-slate-400 tabular-nums">{stats.clientes} clientes</span>
          </div>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100" role="img"
               aria-label={`Verde ${stats.verde}, Amarillo ${stats.amarillo}, Rojo ${stats.rojo}`}>
            {([['Verde', stats.verde], ['Amarillo', stats.amarillo], ['Rojo', stats.rojo]] as const)
              .filter(([, n]) => n > 0)
              .map(([k, n]) => (
                <div
                  key={k}
                  className={ALERTA_ESTILO[k as AlertaIPC].punto}
                  style={{ width: `${(n / Math.max(1, stats.clientes)) * 100}%` }}
                />
              ))}
          </div>
          <div className="flex gap-4 mt-2.5 text-xs flex-wrap">
            {(['Verde', 'Amarillo', 'Rojo'] as AlertaIPC[]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${ALERTA_ESTILO[k].punto}`} />
                <span className="text-slate-600">{k}</span>
                <span className="tabular-nums font-semibold text-slate-700">
                  {k === 'Verde' ? stats.verde : k === 'Amarillo' ? stats.amarillo : stats.rojo}
                </span>
              </span>
            ))}
            <span className="text-slate-400 ml-auto tabular-nums">
              {resumen.sinInteraccion} sin interacción este trimestre
            </span>
          </div>
        </Card>

        {/* ── Avisos ────────────────────────────────────────────────────────── */}

        <Card className="!p-4">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Participación por tipo
            </span>
            <span className="text-xs text-slate-400 tabular-nums">
              {resumen.interacciones} interacciones
            </span>
          </div>

          {resumen.porTipo.length === 0 ? (
            // Sin interacciones no hay barra que dibujar, pero el bloque tiene que
            // decir algo: si devolviera null, la tarjeta desaparecería y la grilla
            // de dos columnas quedaría coja sin explicación.
            <p className="text-xs text-slate-400 py-3">
              Ninguna interacción registrada en {trimestre.replace('-', ' ')}
              {paisActivo ? ` para ${paisActivo}` : ''}.
            </p>
          ) : (
            <>
              <div
                className="flex h-2.5 rounded-full overflow-hidden bg-slate-100"
                role="img"
                aria-label={resumen.porTipo
                  .map((t) => `${t.tipo} ${Math.round((t.n / resumen.interacciones) * 100)}%`)
                  .join(', ')}
              >
                {resumen.porTipo.map((t) => (
                  <div
                    key={t.tipo}
                    className={TIPO_INTERACCION_BARRA[t.tipo] ?? 'bg-slate-400'}
                    style={{ width: `${(t.n / Math.max(1, resumen.interacciones)) * 100}%` }}
                  />
                ))}
              </div>
              <div className="flex gap-4 mt-2.5 text-xs flex-wrap">
                {resumen.porTipo.map((t) => (
                  <span key={t.tipo} className="inline-flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${TIPO_INTERACCION_BARRA[t.tipo] ?? 'bg-slate-400'}`} />
                    <span className="text-slate-600">{t.tipo}</span>
                    <span className="tabular-nums font-semibold text-slate-700">
                      {Math.round((t.n / resumen.interacciones) * 100)}%
                    </span>
                    <span className="tabular-nums text-slate-400">({t.n})</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ── Tabla ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs uppercase tracking-wide text-slate-400 font-medium mr-1">Alerta IPC</span>
        {(['Todos', 'Verde', 'Amarillo', 'Rojo'] as const).map((f) => (
          <Chip key={f} activo={filtro === f} onClick={() => cambiar(setFiltro)(f)}>
            {f !== 'Todos' && (
              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${ALERTA_ESTILO[f].punto}`} />
            )}
            {f}
          </Chip>
        ))}
        <Chip activo={filtro === 'sin30'} onClick={() => cambiar(setFiltro)('sin30' as FiltroAlerta)}>
          Sin inter. 30D
        </Chip>

        <label
          className="ml-auto inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none"
          title={`Clientes A+ que figuran en Registro Interacciones pero no tuvieron `
            + `ninguna interacción en ${trimestre.replace('-', ' ')}. Su IPC es 0 y su última `
            + `interacción es de un trimestre anterior: son los que se enfriaron. `
            + `Quedan fuera de la vista salvo que marques esta casilla.`}
        >
          <input
            type="checkbox"
            checked={verNoAtendidos}
            onChange={(e) => { setVerNoAtendidos(e.target.checked); setPagina(0); }}
            className="w-3.5 h-3.5 rounded border-slate-300 text-[#0097A7] focus:ring-[#0097A7] cursor-pointer"
          />
          <span className="underline decoration-dotted decoration-slate-300 underline-offset-2">
            Incluir aún no atendidos
          </span>
          {noAtendidos > 0 && <span className="tabular-nums text-slate-400">({noAtendidos})</span>}
        </label>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto tabla-scroll">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <th className="text-left font-semibold px-2.5 py-2 w-8">#</th>
                <SortTh k="pais"     cur={sortKey} dir={sortDir} onSort={toggleSort} align="left"  className="font-semibold px-2.5 py-2">País</SortTh>
                <SortTh k="empresa"  cur={sortKey} dir={sortDir} onSort={toggleSort} align="left"  className="font-semibold px-2.5 py-2">Empresa</SortTh>
                <SortTh k="tipo"     cur={sortKey} dir={sortDir} onSort={toggleSort} align="left"  className="font-semibold px-2.5 py-2">Tipo</SortTh>
                <SortTh k="ipcScore" cur={sortKey} dir={sortDir} onSort={toggleSort} align="left"  className="font-semibold px-2.5 py-2 w-32">IPC (0–100)</SortTh>
                <SortTh k="pts"      cur={sortKey} dir={sortDir} onSort={toggleSort} className="font-semibold px-2.5 py-2">Pts / Meta</SortTh>
                <SortTh k="tendencia" cur={sortKey} dir={sortDir} onSort={toggleSort} className="font-semibold px-2.5 py-2">Tend. Q</SortTh>
                <SortTh k="alerta"   cur={sortKey} dir={sortDir} onSort={toggleSort} align="left"  className="font-semibold px-2.5 py-2">Alerta IPC</SortTh>
                <SortTh k="interacciones" cur={sortKey} dir={sortDir} onSort={toggleSort} className="font-semibold px-2.5 py-2">Inter.</SortTh>
                <SortTh k="ultima"   cur={sortKey} dir={sortDir} onSort={toggleSort} align="left"  className="font-semibold px-2.5 py-2">Última inter.</SortTh>
                <SortTh k="ultimoTipo" cur={sortKey} dir={sortDir} onSort={toggleSort} align="left" className="font-semibold px-2.5 py-2">Tipo</SortTh>
                <SortTh k="diasSinInteraccion" cur={sortKey} dir={sortDir} onSort={toggleSort} className="font-semibold px-2.5 py-2">Días s/i</SortTh>
              </tr>
            </thead>
            <tbody>
              {visibles.map((c, i) => (
                <FilaCliente
                  key={`${c.pais}-${c.empresa}`}
                  c={c}
                  n={paginaActual * POR_PAGINA + i + 1}
                />
              ))}
              {!visibles.length && (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-sm text-slate-400">
                    Ningún cliente A+ con interacciones registradas cumple este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="tabular-nums">
          Mostrando {visibles.length} de {clientes.length} clientes · Pág. {paginaActual + 1}/{totalPaginas}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
            disabled={paginaActual === 0}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium transition-all active:scale-95 disabled:opacity-40 disabled:active:scale-100"
          >
            ← Anterior
          </button>
          <button
            onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
            disabled={paginaActual >= totalPaginas - 1}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium transition-all active:scale-95 disabled:opacity-40 disabled:active:scale-100"
          >
            Siguiente →
          </button>
        </div>
      </div>
    </div>
  );
}

function FilaCliente({ c, n }: { c: ClienteIPC; n: number }) {
  const est = ALERTA_ESTILO[c.alerta];
  const sinActividadEnQ = c.interacciones === 0;

  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50/60">
      <td className="px-2.5 py-2 text-xs text-slate-400 tabular-nums">{n}</td>
      <td className="px-2.5 py-2"><BanderaPais pais={c.pais} /></td>
      <td className={`px-2.5 py-2 font-medium leading-tight ${sinActividadEnQ ? 'text-rose-700' : 'text-slate-800'}`}>
        {c.empresa}
      </td>
      <td className="px-2.5 py-2 text-slate-500 whitespace-nowrap">{TIPO_CORTO[c.tipo] ?? c.tipo}</td>
      <td className="px-2.5 py-2">
        <div className="flex items-center gap-2">
          <span className={`inline-block min-w-9 text-center px-1.5 py-0.5 rounded-md text-xs font-bold tabular-nums border ${est.chip}`}>
            {c.ipcScore}
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden min-w-12">
            <div className={`h-full ${est.punto}`} style={{ width: `${c.ipcScore}%` }} />
          </div>
        </div>
      </td>
      <td className="px-2.5 py-2 text-right tabular-nums whitespace-nowrap">
        <span className={`font-semibold ${c.pts > 0 ? 'text-slate-800' : 'text-rose-600'}`}>{c.pts}</span>
        <span className="text-slate-300 mx-0.5">/</span>
        <span className="text-slate-500">{c.meta}</span>
      </td>
      <td className="px-2.5 py-2 text-right tabular-nums whitespace-nowrap">
        {c.tendencia === null ? (
          <span className="text-slate-300">nuevo</span>
        ) : c.tendencia === 0 ? (
          <span className="text-slate-400">=</span>
        ) : (
          <span className={c.tendencia > 0 ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
            {c.tendencia > 0 ? '+' : ''}{c.tendencia}
          </span>
        )}
      </td>
      <td className="px-2.5 py-2 whitespace-nowrap">
        <span className={`inline-flex items-center gap-1.5 font-medium ${est.texto}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${est.punto}`} />
          {c.alerta}
        </span>
      </td>
      <td className={`px-2.5 py-2 text-right font-semibold tabular-nums whitespace-nowrap ${sinActividadEnQ ? 'text-rose-600' : 'text-slate-700'}`}>
        {c.interacciones}
      </td>
      <td className={`px-2.5 py-2 tabular-nums whitespace-nowrap ${sinActividadEnQ ? 'text-rose-600' : 'text-slate-600'}`}>
        {fechaCorta(c.ultimaInteraccion)}
      </td>
      <td className="px-2.5 py-2 whitespace-nowrap">
        {c.ultimoTipo
          ? (
            <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold whitespace-nowrap ${
              TIPO_INTERACCION_COLOR[c.ultimoTipo] ?? 'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              {c.ultimoTipo}
            </span>
          )
          : <span className="text-slate-300 italic">sin registro</span>}
      </td>
      <td className={`px-2.5 py-2 text-right tabular-nums font-medium whitespace-nowrap ${
        c.diasSinInteraccion === null || c.diasSinInteraccion >= 30 ? 'text-rose-600' : 'text-slate-600'
      }`}>
        {c.diasSinInteraccion === null ? '—' : `${c.diasSinInteraccion}d`}
      </td>
    </tr>
  );
}
