import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Card } from '../../components/ui/Card';
import { useMovimientos } from '../../hooks/useMovimientos';
import type {
  MovMes, MovAgregado, MovimientosResponse, ChurnQTrimestre, ClienteChurnQ, ChurnQPais} from '../../hooks/useMovimientos';
import { useTrack } from '../../hooks/useTrack';

/**
 * Movimientos de cartera. Dos vistas que responden preguntas distintas y NO son
 * el mismo número medido de dos formas:
 *
 *   Semáforo         días sin comprar (≤60 / 61-90 / >90), mes a mes. Es para
 *                    actuar hoy: a quién llamar esta semana.
 *   Churn trimestral definición del PDF de negocio: ventana de silencio de 4
 *                    meses para recurrentes y 13 para estacionales, evaluada al
 *                    cierre de cada trimestre. Es para reportar.
 *
 * Un cliente puede estar en >90 días del semáforo y todavía no ser churn
 * trimestral (si es estacional, faltan meses de silencio). Cada vista lleva al
 * pie qué criterio está mostrando, porque si no el que compara los dos números
 * concluye que uno está mal.
 *
 * SEMÁFORO: cuántos clientes llevan ≤60, 61-90 y más de 90 días
 * sin comprar, y quiénes se movieron de tramo respecto al mes anterior.
 *
 * El universo son los clientes con segmento real (estacional/recurrente), el
 * mismo del Comparador.
 *
 * Paleta de estado validada con el script de dataviz. Rojo↔verde queda en ΔE 8.1
 * (deutan), justo en el piso, así que cada tramo lleva SIEMPRE su etiqueta en días
 * y su número: el color nunca es el único portador de la información.
 */
const C_60    = '#10b981';
const C_90    = '#f59e0b';
const C_90MAS = '#ef4444';

// `subirEsMalo` existe porque el signo del delta no significa lo mismo en los
// tres tramos: que crezca ≤60 es bueno y que crezca >90 es malo. Sin esto, un
// "+13 al día" se pintaba de rojo.
const TRAMOS = [
  { key: 't60'    as const, label: '≤ 60 días',    color: C_60,    nota: 'al día',     subirEsMalo: false },
  { key: 't90'    as const, label: '61 - 90 días', color: C_90,    nota: 'a vigilar',  subirEsMalo: true },
  { key: 't90mas' as const, label: '> 90 días',    color: C_90MAS, nota: 'inactivos',  subirEsMalo: true },
];

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function etiquetaMes(mes: string) {
  return MESES_CORTOS[Number(mes.slice(5, 7)) - 1] ?? mes;
}

const nf = new Intl.NumberFormat('es-CL');

function fmtUsd(v: number) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000)     return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v)}`;
}

/** Tarjeta de tramo: color + etiqueta en días + conteo + % de la cartera. */
function TramoCard({ label, nota, color, n, pct, delta, subirEsMalo }: {
  label: string; nota: string; color: string;
  n: number; pct: number | null; delta: number | null; subirEsMalo: boolean;
}) {
  const malo = delta != null && (subirEsMalo ? delta > 0 : delta < 0);
  return (
    <div className="flex-1 min-w-[150px] rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
        <span className="text-[11px] font-semibold text-slate-600">{label}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums text-slate-800">{nf.format(n)}</span>
        {pct != null && <span className="text-xs text-slate-400 tabular-nums">{pct.toFixed(1)}%</span>}
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-[11px]">
        <span className="text-slate-400">{nota}</span>
        {delta != null && delta !== 0 && (
          <span className={`tabular-nums font-medium ${malo ? 'text-red-500' : 'text-emerald-600'}`}>
            {delta > 0 ? '+' : ''}{nf.format(delta)} vs. mes ant.
          </span>
        )}
      </div>
    </div>
  );
}

type FilaChart = MovMes & { total: number };

function TooltipTramos({ active, payload }: { active?: boolean; payload?: { payload: FilaChart }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg text-xs">
      <div className="font-semibold text-slate-700 mb-1.5">
        {etiquetaMes(d.mes)} {d.mes.slice(0, 4)}
        {d.esParcial && <span className="ml-1.5 font-normal text-amber-600">· mes en curso</span>}
      </div>
      {TRAMOS.map(t => (
        <div key={t.key} className="flex items-center gap-2 py-0.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: t.color }} />
          <span className="text-slate-500 flex-1">{t.label}</span>
          <span className="font-medium text-slate-700 tabular-nums">{nf.format(d[t.key])}</span>
        </div>
      ))}
      <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex justify-between gap-4">
        <span className="text-slate-500">Cartera</span>
        <span className="font-semibold text-slate-700 tabular-nums">{nf.format(d.cartera)}</span>
      </div>
    </div>
  );
}

interface Props {
  pais?: string;
  /** Nombre del ejecutivo. Presente = vista propia: solo su cartera. */
  kam?: string;
}

function VistaSemaforo({ data, kam }: { data: MovimientosResponse; kam?: string }) {
  const [verTabla, setVerTabla] = useState(false);

  const serie = useMemo<FilaChart[]>(
    () => (data?.meses ?? []).map(m => ({ ...m, total: m.cartera })),
    [data],
  );

  // Delta del semáforo: cuánto cambió el stock de cada tramo contra el mes previo.
  const delta = useMemo(() => {
    if (serie.length < 2) return null;
    const hoy = serie[serie.length - 1], ant = serie[serie.length - 2];
    return { t60: hoy.t60 - ant.t60, t90: hoy.t90 - ant.t90, t90mas: hoy.t90mas - ant.t90mas };
  }, [serie]);

  if (serie.length === 0) {
    return <div className="py-16 text-center text-sm text-slate-400">Sin datos mensuales.</div>;
  }

  const t: MovAgregado = data.total;
  const propio = Boolean(kam);
  const ultimo = serie[serie.length - 1];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-slate-800">
            {propio ? 'Mi cartera' : 'Semáforo de inactividad'} · {etiquetaMes(ultimo.mes)} {ultimo.mes.slice(0, 4)}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Días sin comprar sobre {nf.format(t.cartera)} clientes con segmento.
            {ultimo.esParcial && <span className="text-amber-600"> El mes está en curso.</span>}
          </p>
        </div>
        <button
          onClick={() => setVerTabla(v => !v)}
          className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-[#0097A7] hover:text-[#0097A7] transition-colors"
          aria-pressed={verTabla}
        >
          {verTabla ? 'Ocultar tabla' : 'Ver tabla'}
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        {TRAMOS.map(tr => (
          <TramoCard key={tr.key} label={tr.label} nota={tr.nota} color={tr.color}
                     n={t[tr.key]}
                     pct={tr.key === 't60' ? t.pct60 : tr.key === 't90' ? t.pct90 : t.pct90mas}
                     delta={delta ? delta[tr.key] : null} subirEsMalo={tr.subirEsMalo} />
        ))}
        <div className="flex-1 min-w-[150px] rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-[11px] font-semibold text-slate-600">Facturación en riesgo</div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums text-slate-800">
            {fmtUsd(t.usdT90mas)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            12m de los inactivos · {t.usdCartera > 0 ? `${Math.round(100 * t.usdT90mas / t.usdCartera)}% de la cartera` : '—'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-slate-700">Cómo evolucionó mes a mes</h3>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              {TRAMOS.map(tr => (
                <span key={tr.key} className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: tr.color }} />
                  {tr.label}
                </span>
              ))}
            </div>
          </div>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="mes" tickFormatter={etiquetaMes} tick={{ fontSize: 11, fill: '#94a3b8' }}
                       axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                       width={40} tickFormatter={(v: number) => nf.format(v)} />
                <Tooltip content={<TooltipTramos />} cursor={{ fill: '#f8fafc' }} />
                {TRAMOS.map((tr, i) => (
                  <Bar key={tr.key} dataKey={tr.key} stackId="a" fill={tr.color}
                       radius={i === TRAMOS.length - 1 ? [3, 3, 0, 0] : undefined}
                       isAnimationActive={false}>
                    {serie.map((m, j) => <Cell key={j} fillOpacity={m.esParcial ? 0.45 : 1} />)}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Cartera completa apilada. La barra translúcida es el mes en curso: aún no termina.
          </p>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Movimientos del mes</h3>
          <p className="text-[11px] text-slate-400 mb-3">Cambios de tramo respecto al mes anterior.</p>

          <div className="flex gap-3 mb-3">
            <div className="flex-1 rounded-lg bg-red-50 border border-red-100 px-3 py-2">
              <div className="text-[11px] text-red-700 font-semibold">Empeoraron</div>
              <div className="text-xl font-semibold tabular-nums text-red-600">{nf.format(t.empeoraron)}</div>
              <div className="text-[10px] text-red-400">{fmtUsd(t.usdEmpeoraron)} en juego</div>
            </div>
            <div className="flex-1 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
              <div className="text-[11px] text-emerald-700 font-semibold">Mejoraron</div>
              <div className="text-xl font-semibold tabular-nums text-emerald-600">{nf.format(t.mejoraron)}</div>
              <div className="text-[10px] text-emerald-500">volvieron a comprar</div>
            </div>
          </div>

          <dl className="space-y-1 text-xs">
            {([
              ['≤60 → 61-90',   t.de60a90,    'malo'],
              ['61-90 → >90',   t.de90a90mas, 'malo'],
              ['≤60 → >90',     t.de60a90mas, 'malo'],
              ['61-90 → ≤60',   t.de90a60,    'bueno'],
              ['>90 → ≤60',     t.de90masa60, 'bueno'],
              ['>90 → 61-90',   t.de90masa90, 'bueno'],
            ] as const).filter(([, v]) => v > 0).map(([label, v, tono]) => (
              <div key={label} className="flex items-center justify-between gap-2 py-0.5">
                <dt className="text-slate-500 tabular-nums">{label}</dt>
                <dd className={`tabular-nums font-medium ${tono === 'malo' ? 'text-red-500' : 'text-emerald-600'}`}>
                  {nf.format(v)}
                </dd>
              </div>
            ))}
          </dl>

          {(t.entraron > 0 || t.salieron > 0) && (
            <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-400 space-y-0.5">
              <div className="flex justify-between">
                <span>Entraron a la cartera</span>
                <span className="tabular-nums">{nf.format(t.entraron)}</span>
              </div>
              <div className="flex justify-between">
                <span>Salieron (cambio de tipo)</span>
                <span className="tabular-nums">{nf.format(t.salieron)}</span>
              </div>
              <p className="pt-1">No cuentan como cambio de tramo: son otra cosa.</p>
            </div>
          )}
        </Card>
      </div>

      {verTabla && (
        <Card>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Detalle mensual</h3>
          <div className="overflow-x-auto tabla-scroll">
            <table className="w-full text-sm tabla-apilable-vp">
              <caption className="sr-only">
                Clientes por tramo de días sin comprar y movimientos entre tramos, por mes
              </caption>
              <thead>
                <tr className="text-slate-400 border-b border-slate-200 text-xs">
                  <th scope="col" className="text-left font-medium py-2">Mes</th>
                  <th scope="col" className="text-right font-medium">≤60</th>
                  <th scope="col" className="text-right font-medium">61-90</th>
                  <th scope="col" className="text-right font-medium">&gt;90</th>
                  <th scope="col" className="text-right font-medium">Cartera</th>
                  <th scope="col" className="text-right font-medium">Empeoraron</th>
                  <th scope="col" className="text-right font-medium">Mejoraron</th>
                </tr>
              </thead>
              <tbody>
                {serie.map(m => (
                  <tr key={m.mes} className="border-b border-slate-100">
                    <td data-titular className="py-2 text-slate-700">
                      {etiquetaMes(m.mes)}
                      {m.esParcial && <span className="ml-1.5 text-[11px] text-amber-600">en curso</span>}
                    </td>
                    <td data-label="≤60" className="text-right tabular-nums text-slate-700">{nf.format(m.t60)}</td>
                    <td data-label="61-90" className="text-right tabular-nums text-slate-700">{nf.format(m.t90)}</td>
                    <td data-label=">90" className="text-right tabular-nums text-slate-700">{nf.format(m.t90mas)}</td>
                    <td data-label="Cartera" className="text-right tabular-nums text-slate-500">{nf.format(m.cartera)}</td>
                    <td data-label="Empeoraron" className="text-right tabular-nums text-red-500">{nf.format(m.empeoraron)}</td>
                    <td data-label="Mejoraron" className="text-right tabular-nums text-emerald-600">{nf.format(m.mejoraron)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!propio && data.kams.length > 1 && (
        <Card>
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Por ejecutivo</h3>
          <p className="text-[11px] text-slate-400 mb-3">
            Foto de {etiquetaMes(ultimo.mes)}, ordenada por inactivos.
          </p>
          <div className="overflow-x-auto tabla-scroll">
            <table className="w-full text-sm tabla-apilable-vp">
              <thead>
                <tr className="text-slate-400 border-b border-slate-200 text-xs">
                  <th scope="col" className="text-left font-medium py-2">Ejecutivo</th>
                  <th scope="col" className="text-left font-medium">País</th>
                  <th scope="col" className="text-right font-medium">≤60</th>
                  <th scope="col" className="text-right font-medium">61-90</th>
                  <th scope="col" className="text-right font-medium">&gt;90</th>
                  <th scope="col" className="text-right font-medium">% &gt;90</th>
                  <th scope="col" className="text-right font-medium">Empeoraron</th>
                </tr>
              </thead>
              <tbody>
                {data.kams.map(k => (
                  <tr key={`${k.pais}|${k.nombre}`} className="border-b border-slate-100">
                    <td data-titular className="py-2 text-slate-700">{k.nombre}</td>
                    <td data-label="País" className="text-slate-500 text-xs">{k.pais}</td>
                    <td data-label="≤60" className="text-right tabular-nums text-slate-700">{nf.format(k.t60)}</td>
                    <td data-label="61-90" className="text-right tabular-nums text-slate-700">{nf.format(k.t90)}</td>
                    <td data-label=">90" className="text-right tabular-nums text-slate-700">{nf.format(k.t90mas)}</td>
                    <td data-label="% >90" className="text-right tabular-nums font-medium text-slate-700">
                      {k.pct90mas != null ? `${k.pct90mas.toFixed(0)}%` : '—'}
                    </td>
                    <td data-label="Empeoraron" className="text-right tabular-nums text-red-500">{nf.format(k.empeoraron)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="text-[11px] text-slate-400">
        Criterio: <span className="font-medium text-slate-500">días sin comprar</span>, umbral
        igual para todos. No es el mismo número que el churn trimestral, que espera
        4 meses de silencio a un recurrente y 13 a un estacional.
      </p>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// VISTA TRIMESTRAL — definición del PDF "Cómo se calcula el churn"
// ─────────────────────────────────────────────────────────────────────────────

// Rec y est son partes del MISMO total, así que van en dos pasos de un solo hue
// en vez de dos colores categóricos: el stack se lee como un todo y no como dos
// series que compiten. Igual los dos llevan etiqueta en la leyenda y en la tabla.
const C_REC = '#b91c1c';
const C_EST = '#f87171';

/** '2026-Q2' → 'Q2 26'. El eje no tiene ancho para el año completo. */
function etiquetaQ(id: string) {
  const [anio, q] = id.split('-Q');
  return `${q ? 'Q' + q : id} ${anio.slice(2)}`;
}

/**
 * Descarga el detalle como CSV. Dos decisiones que no son cosméticas:
 *
 *  - Separador `;` y BOM al inicio. Excel en español interpreta la coma como
 *    separador decimal, así que con `,` mete todo en una columna; y sin BOM
 *    muestra "PerÃº" en vez de "Perú".
 *  - Se incluye la ventana (compró de/hasta, sin comprar desde) para que el
 *    ejecutivo pueda verificar el caso sin volver a pedir la base.
 */
const COLS_CSV: [string, (c: ClienteChurnQ) => string | number][] = [
  ['Trimestre',         c => c.trimestreId ?? ''],
  ['País',              c => c.pais],
  ['Ejecutivo',         c => c.kam],
  ['ID Tributario',     c => c.idTributario ?? c.panelId],
  ['Cliente',           c => c.nombre],
  ['Tipo',              c => (c.rama === 'recurrente' ? 'Recurrente' : 'Estacional')],
  ['Una sola compra',   c => (c.tipoRef === 'primera_compra' ? 'Sí' : 'No')],
  ['Compró de',         c => c.refDe ?? ''],
  ['Compró hasta',      c => c.refA ?? ''],
  ['Sin comprar desde', c => c.silDe ?? ''],
  ['USD referencia',    c => Math.round(c.usdReferencia)],
  // Meses con compra en la referencia: 1 es una compra aislada, 3 es cadencia
  // cortada. Es la diferencia entre una activación que no prendió y un cliente
  // que se perdió, y no se puede deducir del monto.
  ['Meses con compra',  c => c.mesesRef ?? ''],
  ['USD 12m al cierre', c => (c.usd12m != null ? Math.round(c.usd12m) : '')],
  ['Trimestre cerrado', c => (c.abierta ? 'No · ventana sin cerrar' : 'Sí')],
];

/**
 * YYYY-MM-DD del día de la descarga, para que los archivos se ordenen solos en
 * la carpeta. Se arma con las partes locales y no con toISOString(), que devuelve
 * UTC: a las 21:00 en Chile eso ya escribiría la fecha de mañana.
 */
function hoyISO() {
  const d = new Date();
  const dd = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`;
}

function descargarCsv(filas: ClienteChurnQ[], archivo: string) {
  const esc = (v: string | number) => {
    const t = String(v ?? '');
    return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const texto = [COLS_CSV.map(c => c[0]).join(';')]
    .concat(filas.map(f => COLS_CSV.map(([, get]) => esc(get(f))).join(';')))
    .join('\r\n');

  const url = URL.createObjectURL(
    new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = archivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function BotonCsv({ filas, base, children }: {
  filas: ClienteChurnQ[]; base: string; children: React.ReactNode;
}) {
  const { track } = useTrack();
  return (
    <button
      onClick={() => {
        // Interesa saber quién exporta y qué: es la señal de que el dato se está
        // usando fuera del dashboard.
        track('analisis:movimientos:csv', base);
        descargarCsv(filas, `${base}-${hoyISO()}.csv`);
      }}
      disabled={filas.length === 0}
      className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600
                 hover:border-[#0097A7] hover:text-[#0097A7] transition-colors
                 disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-600"
    >
      {children}
    </button>
  );
}

/**
 * Orden de países del resumen. Fijo y no por volumen para que las columnas no se
 * muevan entre semanas: la tabla se lee comparando con la de la semana anterior.
 * Cualquier país que aparezca y no esté acá se agrega al final.
 */
const ORDEN_PAISES = ['México', 'Chile', 'Colombia', 'Perú'];

function ordenarPaises(ps: string[]): string[] {
  const conocidos = ORDEN_PAISES.filter(p => ps.includes(p));
  return [...conocidos, ...ps.filter(p => !ORDEN_PAISES.includes(p)).sort()];
}

/**
 * Resumen trimestre × país: el conteo de churn y su porcentaje sobre la cartera
 * congelada al cierre de cada trimestre.
 *
 * Tres decisiones que no son cosméticas:
 *
 *  - Donde no hay cobertura va "n/d", no 0. México arranca en 2024-01 y su rama
 *    estacional necesita 15 meses previos, así que en los trimestres viejos el 0
 *    no significa "no perdimos a nadie" sino "no se puede calcular".
 *  - El trimestre en curso va en su propia fila, en gris y fuera de los promedios.
 *    Su ventana de silencio no cerró: cuenta como perdidos a clientes que todavía
 *    pueden comprar antes del cierre, así que da una tasa mucho más alta que no es
 *    comparable con el resto de la serie.
 *  - El promedio anual se calcula sobre el total de churn y el total de cartera del
 *    año, no promediando las tasas trimestrales. Promediar tasas de bases distintas
 *    da un número que no corresponde a ninguna población.
 */
function ResumenPorPais({ celdas, serie, enCurso, onElegir, seleccion }: {
  celdas: ChurnQPais[];
  serie: ChurnQTrimestre[];
  enCurso: ChurnQTrimestre | null;
  /** Abre el detalle de clientes de ese trimestre. Sin esto la etiqueta iría con
   *  color de enlace sin serlo, que es prometer una interacción que no existe. */
  onElegir?: (trimestreId: string) => void;
  /** Trimestre abierto en el detalle de clientes, para resaltar su fila. */
  seleccion?: string;
}) {
  // Una medida por celda, no las dos apiladas. Con conteo y porcentaje juntos la
  // celda tiene dos números y hay que elegir cuál mirar en cada una; con el
  // selector se compara una sola magnitud entre países de un barrido de ojo, que
  // es para lo que sirve una matriz.
  const [medida, setMedida] = useState<'clientes' | 'pct'>('clientes');
  const paises = ordenarPaises([...new Set(celdas.map(c => c.pais))]);
  const buscar = (tid: string, pais: string) =>
    celdas.find(c => c.trimestreId === tid && c.pais === pais) ?? null;

  const trimestres = serie.map(d => d.trimestreId);
  const ultimo = trimestres.length ? trimestres[trimestres.length - 1] : null;
  const base = paises.map(p => (ultimo ? (buscar(ultimo, p)?.cartera ?? 0) : 0));
  const baseTotal = base.reduce((a, b) => a + b, 0);

  const anios = [...new Set(serie.map(d => d.anio))].sort();
  const promedio = (anio: number, pais?: string) => {
    const filas = celdas.filter(c =>
      !c.ventanaAbierta && Number(c.trimestreId.slice(0, 4)) === anio &&
      !c.coberturaParcial && (!pais || c.pais === pais));
    const ch = filas.reduce((a, b) => a + b.churn, 0);
    const ca = filas.reduce((a, b) => a + b.cartera, 0);
    if (ca === 0) return null;
    // En porcentaje: sobre los totales del año, nunca promediando las tasas
    // trimestrales — son tasas de bases distintas y su promedio no corresponde a
    // ninguna población. En clientes: por trimestre, contando los trimestres
    // distintos y no las filas, que en la columna Total son país × trimestre.
    if (medida === 'pct') return Math.round((100 * ch / ca) * 10) / 10;
    const nQ = new Set(filas.map(f => f.trimestreId)).size;
    return nQ > 0 ? ch / nQ : null;
  };

  const total = (tid: string) => {
    const cs = paises.map(p => buscar(tid, p))
      .filter((c): c is ChurnQPais => c != null && !c.coberturaParcial);
    const ch = cs.reduce((a, b) => a + b.churn, 0);
    const ca = cs.reduce((a, b) => a + b.cartera, 0);
    return medida === 'pct' ? (ca > 0 ? Math.round((100 * ch / ca) * 10) / 10 : null) : ch;
  };

  const fmt = (v: number | null) =>
    v == null ? '—' : medida === 'pct' ? `${v.toFixed(1)}%` : nf.format(Math.round(v));

  const valor = (c: ChurnQPais | null) => {
    if (!c) return null;
    return medida === 'pct' ? c.pctChurn : c.churn;
  };

  const th = 'text-right font-medium text-xs text-[#0097A7] pb-3 px-2';
  const td = 'text-right py-3 px-2 tabular-nums text-slate-700';

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Resumen por país</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Sobre la cartera de cada país congelada al cierre de cada trimestre.
          </p>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1" role="group" aria-label="Medida de la tabla">
          {([['clientes', 'Clientes'], ['pct', '% de la base']] as const).map(([id, etq]) => (
            <button
              key={id}
              onClick={() => setMedida(id)}
              aria-pressed={medida === id}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all active:scale-95 ${
                medida === id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {etq}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto -mx-2 tabla-scroll">
        <table className="w-full text-sm min-w-[440px] tabla-apilable">
          <caption className="sr-only">
            {medida === 'pct' ? 'Porcentaje de churn' : 'Clientes en churn'} por trimestre y país
          </caption>
          <thead>
            <tr className="border-b border-slate-200">
              <th scope="col" className="text-left font-medium text-xs text-[#0097A7] pb-3 px-2">Trimestre</th>
              {paises.map(p => <th key={p} scope="col" className={th}>{p}</th>)}
              <th scope="col" className={`${th} text-slate-500`}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <th scope="row" className="text-left font-normal text-[11px] text-slate-400 py-2.5 px-2">
                Clientes en la base
              </th>
              {base.map((n, i) => (
                <td key={paises[i]} data-label={paises[i]} className="text-right py-2.5 px-2 tabular-nums text-[11px] text-slate-400">
                  {nf.format(n)}
                </td>
              ))}
              <td data-label="Total" className="text-right py-2.5 px-2 tabular-nums text-[11px] text-slate-500 font-semibold">
                {nf.format(baseTotal)}
              </td>
            </tr>

            {trimestres.map(tid => (
              <tr key={tid} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                <th scope="row" className="text-left py-3 px-2 whitespace-nowrap">
                  {onElegir ? (
                    <button
                      onClick={() => onElegir(tid)}
                      className="font-medium text-[#0097A7] hover:underline focus-visible:underline"
                      title={`Ver las empresas de ${etiquetaQ(tid)}`}
                    >
                      {etiquetaQ(tid)}
                    </button>
                  ) : (
                    <span className="font-medium text-slate-600">{etiquetaQ(tid)}</span>
                  )}
                </th>
                {paises.map(p => {
                  const c = buscar(tid, p);
                  if (!c || c.coberturaParcial) {
                    return (
                      <td key={p} data-label={p} className="text-right py-3 px-2 text-slate-300 text-xs"
                          title="Sin cobertura: la historia del país no alcanza para armar la referencia">
                        n/d
                      </td>
                    );
                  }
                  return <td key={p} data-label={p} className={td}>{fmt(valor(c))}</td>;
                })}
                <td data-label="Total" className={`${td} font-semibold text-slate-800`}>{fmt(total(tid))}</td>
              </tr>
            ))}

            {anios.map(a => (
              <tr key={`prom-${a}`} className="border-b border-slate-100 bg-slate-50/50">
                <th scope="row" className="text-left font-normal text-xs text-slate-500 py-2.5 px-2 whitespace-nowrap">
                  Promedio {a}
                </th>
                {paises.map(p => (
                  <td key={p} data-label={p} className="text-right py-2.5 px-2 tabular-nums text-xs text-slate-500">
                    {(() => { const v = promedio(a, p); return v != null ? fmt(v) : 'n/d'; })()}
                  </td>
                ))}
                <td data-label="Total" className="text-right py-2.5 px-2 tabular-nums text-xs text-slate-600 font-semibold">
                  {(() => { const v = promedio(a); return v != null ? fmt(v) : 'n/d'; })()}
                </td>
              </tr>
            ))}

            {enCurso && (
              <tr className="border-t-2 border-slate-200">
                <th scope="row" className="text-left font-normal text-xs text-slate-400 py-3 px-2 whitespace-nowrap">
                  {etiquetaQ(enCurso.trimestreId)}
                  <span className="block text-[10px]">en curso</span>
                </th>
                {paises.map(p => (
                  <td key={p} data-label={p} className="text-right py-3 px-2 tabular-nums text-slate-400">
                    {fmt(valor(buscar(enCurso.trimestreId, p)))}
                  </td>
                ))}
                <td data-label="Total" className="text-right py-3 px-2 tabular-nums text-slate-500 font-semibold">
                  {fmt(total(enCurso.trimestreId))}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detalle por trimestre. Vive en esta card y no en una propia porque es la
          misma tabla vista de otro lado —los mismos trimestres, abiertos por rama
          y con la cartera— y separarlas dejaba media pantalla vacía. */}
      <div className="mt-6 pt-5 border-t border-slate-100">
        <h4 className="text-sm font-semibold text-slate-700">Detalle por trimestre</h4>
        <p className="text-[11px] text-slate-400 mt-0.5 mb-2">
          Tocá un trimestre para ver y descargar sus empresas.
        </p>
        <div className="overflow-x-auto -mx-2 tabla-scroll">
          <table className="w-full text-sm min-w-[420px] tabla-apilable">
            <caption className="sr-only">Clientes en churn por rama, cartera y porcentaje</caption>
            <thead>
              <tr className="border-b border-slate-200">
                <th scope="col" className="text-left font-medium text-xs text-[#0097A7] pb-3 px-2">Trimestre</th>
                <th scope="col" className={th}>Churn</th>
                <th scope="col" className={th}>Rec.</th>
                <th scope="col" className={th}>Est.</th>
                <th scope="col" className={th}>Cartera</th>
                <th scope="col" className={`${th} text-slate-500`}>%</th>
              </tr>
            </thead>
            <tbody>
              {[...serie].reverse().map(d => (
                <tr key={d.trimestreId}
                    className={`border-b border-slate-100 transition-colors ${
                      d.trimestreId === seleccion ? 'bg-slate-50' : 'hover:bg-slate-50/70'}`}>
                  <th scope="row" className="text-left py-3 px-2 whitespace-nowrap">
                    {onElegir ? (
                      <button
                        onClick={() => onElegir(d.trimestreId)}
                        aria-pressed={d.trimestreId === seleccion}
                        className={`text-[#0097A7] hover:underline focus-visible:underline ${
                          d.trimestreId === seleccion ? 'font-semibold' : 'font-medium'}`}
                      >
                        {etiquetaQ(d.trimestreId)}
                      </button>
                    ) : (
                      <span className="font-medium text-slate-600">{etiquetaQ(d.trimestreId)}</span>
                    )}
                    {d.coberturaParcial && (
                      <span className="ml-1.5 text-[10px] text-amber-600">parcial</span>
                    )}
                  </th>
                  <td data-label="Churn" className={`${td} font-semibold text-slate-800`}>{nf.format(d.churn)}</td>
                  <td data-label="Rec." className={`${td} text-slate-500`}>{nf.format(d.churnRec)}</td>
                  <td data-label="Est." className={`${td} text-slate-500`}>{nf.format(d.churnEst)}</td>
                  <td data-label="Cartera" className={`${td} text-slate-500`}>{nf.format(d.cartera)}</td>
                  <td data-label="%" className={`${td} font-medium`}>
                    {d.pctChurn != null ? `${d.pctChurn.toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {enCurso && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-3">
          <strong>{etiquetaQ(enCurso.trimestreId)} todavía no cerró.</strong> Su ventana
          de silencio sigue abierta, así que cuenta como perdidos a clientes que aún
          pueden comprar antes del cierre y da una tasa más alta de lo que va a quedar.
          No entra en los promedios ni es comparable con los trimestres cerrados.
        </p>
      )}
    </Card>
  );
}

/**
 * CSV del resumen, en formato largo (una fila por trimestre y país) y no como la
 * matriz que se ve en pantalla: en largo se pivotea en Excel en dos clics y se
 * puede filtrar, mientras que la matriz solo sirve para mirarla.
 */
function descargarResumenCsv(celdas: ChurnQPais[], archivo: string) {
  const cols: [string, (c: ChurnQPais) => string | number][] = [
    ['Trimestre',        c => c.trimestreId],
    ['País',             c => c.pais],
    ['Clientes perdidos', c => c.churn],
    ['Clientes en la base', c => c.cartera],
    ['% de churn',       c => (c.pctChurn != null ? String(c.pctChurn).replace('.', ',') : '')],
    ['Comparable',       c => (c.coberturaParcial ? 'No · sin cobertura'
                              : c.ventanaAbierta ? 'No · ventana sin cerrar' : 'Sí')],
  ];
  const esc = (v: string | number) => {
    const t = String(v ?? '');
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const texto = [cols.map(c => c[0]).join(';')]
    .concat(celdas
      .slice()
      .sort((a, b) => a.trimestreId.localeCompare(b.trimestreId) || a.pais.localeCompare(b.pais))
      .map(f => cols.map(([, get]) => esc(get(f))).join(';')))
    .join('\r\n');
  const url = URL.createObjectURL(
    new Blob(['\ufeff' + texto], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url; a.download = archivo;
  a.click();
  URL.revokeObjectURL(url);
}

function TooltipQ({ active, payload }: { active?: boolean; payload?: { payload: ChurnQTrimestre }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg text-xs">
      <div className="font-semibold text-slate-700 mb-1.5">
        Q{d.trimestre} {d.anio}
        {d.coberturaParcial && <span className="ml-1.5 font-normal text-amber-600">· cobertura parcial</span>}
      </div>
      <div className="flex items-center gap-2 py-0.5">
        <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: C_REC }} />
        <span className="text-slate-500 flex-1">Recurrentes (4 meses)</span>
        <span className="font-medium text-slate-700 tabular-nums">{nf.format(d.churnRec)}</span>
      </div>
      <div className="flex items-center gap-2 py-0.5">
        <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: C_EST }} />
        <span className="text-slate-500 flex-1">Estacionales (13 meses)</span>
        <span className="font-medium text-slate-700 tabular-nums">{nf.format(d.churnEst)}</span>
      </div>
      <div className="mt-1.5 pt-1.5 border-t border-slate-100 space-y-0.5">
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">% de la cartera</span>
          <span className="font-semibold text-slate-700 tabular-nums">
            {d.pctChurn != null ? `${d.pctChurn.toFixed(1)}%` : '—'}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Cartera del trimestre</span>
          <span className="text-slate-600 tabular-nums">{nf.format(d.cartera)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Facturó en la referencia</span>
          <span className="text-slate-600 tabular-nums">{fmtUsd(d.usdChurn)}</span>
        </div>
      </div>
    </div>
  );
}

function VistaChurnQ({ data, kam }: { data: MovimientosResponse; kam?: string }) {
  const [verClientes, setVerClientes] = useState(false);
  // null = el último cerrado. Se guarda el id y no el índice para que no se
  // desalinee cuando entra un trimestre nuevo y el arreglo se corre.
  const [qSel, setQSel] = useState<string | null>(null);
  const { track } = useTrack();
  // El trimestre en curso se separa de la serie: su ventana de silencio no cerró,
  // así que cuenta como perdidos a clientes que todavía pueden comprar. Si entrara
  // a `serie` se convertiría en "el" trimestre de las tarjetas y del delta, y el
  // número que se compara sería el provisional.
  const serie = data.churnQ.filter(d => !d.ventanaAbierta);
  const enCurso = data.churnQ.find(d => d.ventanaAbierta) ?? null;
  const propio = Boolean(kam);

  if (serie.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-slate-400">
        Todavía no hay churn trimestral publicado.
        <span className="block mt-1 text-[11px]">
          Se genera con Cache_Movimientos; corré el refresco del dashboard.
        </span>
      </div>
    );
  }

  const ult = serie[serie.length - 1];
  const ant = serie.length > 1 ? serie[serie.length - 2] : null;

  // Trimestre abierto en el detalle. Si el seleccionado ya no existe se cae al último.
  const qAbierto = data.churnQ.find(d => d.trimestreId === qSel) ?? ult;
  const clientes = data.clientesQ.filter(c => c.trimestreId === qAbierto.trimestreId);
  const elegir = (id: string) => {
    setQSel(id);
    setVerClientes(true);
    track('analisis:movimientos:trimestre', id);
  };
  const deltaPct = ant?.pctChurn != null && ult.pctChurn != null
    ? Math.round((ult.pctChurn - ant.pctChurn) * 10) / 10 : null;
  const hayParcial = serie.some(d => d.coberturaParcial);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-800">
          {propio ? 'Mi churn trimestral' : 'Churn trimestral'} · Q{ult.trimestre} {ult.anio}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Compró en el trimestre de referencia y después no volvió a comprar en ningún
          mes de la ventana de silencio: 4 meses si es recurrente, 13 si es estacional.
        </p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[150px] rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-[11px] font-semibold text-slate-600">Clientes en churn</div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums text-slate-800">
            {nf.format(ult.churn)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            {nf.format(ult.churnRec)} recurrentes · {nf.format(ult.churnEst)} estacionales
          </div>
        </div>

        <div className="flex-1 min-w-[150px] rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-[11px] font-semibold text-slate-600">% de churn</div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums text-slate-800">
              {ult.pctChurn != null ? `${ult.pctChurn.toFixed(1)}%` : '—'}
            </span>
            {deltaPct != null && deltaPct !== 0 && (
              <span className={`text-xs tabular-nums font-medium ${deltaPct > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                {deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(1)} pp
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            sobre {nf.format(ult.cartera)} con historial al cierre
          </div>
        </div>

        <div className="flex-1 min-w-[150px] rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-[11px] font-semibold text-slate-600">Facturación que se fue</div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums text-slate-800">
            {fmtUsd(ult.usdChurn)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            lo que compraron en su trimestre de referencia
          </div>
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-slate-700">Churn por trimestre</h3>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: C_REC }} />
              Recurrentes
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: C_EST }} />
              Estacionales
            </span>
          </div>
        </div>
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="trimestreId" tickFormatter={etiquetaQ}
                     tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                     width={40} tickFormatter={(v: number) => nf.format(v)} />
              <Tooltip content={<TooltipQ />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="churnRec" stackId="q" fill={C_REC} isAnimationActive={false}>
                {serie.map((d, j) => <Cell key={j} fillOpacity={d.coberturaParcial ? 0.4 : 1} />)}
              </Bar>
              <Bar dataKey="churnEst" stackId="q" fill={C_EST} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {serie.map((d, j) => <Cell key={j} fillOpacity={d.coberturaParcial ? 0.4 : 1} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Clientes, no porcentaje: el % está en el tooltip y en la tabla, porque la
          cartera cambia de trimestre a trimestre y las dos escalas juntas engañan.
          {hayParcial && ' Las barras translúcidas no son comparables: la historia del país no alcanza para armar la referencia.'}
        </p>
      </Card>

      {/* Resumen (2/3) + Por ejecutivo (1/3). El detalle por trimestre pasó adentro
          del resumen: eran dos cards con la misma tabla vista distinto y la de la
          izquierda quedaba con media pantalla en blanco. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {data.churnQPaises.length > 0 && (
          <div className="lg:col-span-2">
            <ResumenPorPais celdas={data.churnQPaises} serie={serie} enCurso={enCurso}
                            onElegir={elegir} seleccion={qAbierto.trimestreId} />
          </div>
        )}

        {!propio && data.churnQKams.length > 1 && (
          <Card>
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Por ejecutivo</h3>
            <p className="text-[11px] text-slate-400 mb-3">
              Q{ult.trimestre} {ult.anio}, ordenado por clientes en churn.
            </p>
            <div className="overflow-x-auto tabla-scroll">
              <table className="w-full text-sm tabla-apilable-vp">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-200 text-xs">
                    <th scope="col" className="text-left font-medium py-2">Ejecutivo</th>
                    <th scope="col" className="text-left font-medium">País</th>
                    <th scope="col" className="text-right font-medium">Churn</th>
                    <th scope="col" className="text-right font-medium">Cartera</th>
                    <th scope="col" className="text-right font-medium">%</th>
                    <th scope="col" className="text-right font-medium">USD</th>
                  </tr>
                </thead>
                <tbody>
                  {data.churnQKams.map(k => (
                    <tr key={`${k.pais}|${k.nombre}`} className="border-b border-slate-100">
                      <td data-titular className="py-2 text-slate-700">{k.nombre}</td>
                      <td data-label="País" className="text-slate-500 text-xs">{k.pais}</td>
                      <td data-label="Churn" className="text-right tabular-nums font-medium text-slate-800">{nf.format(k.churn)}</td>
                      <td data-label="Cartera" className="text-right tabular-nums text-slate-500">{nf.format(k.cartera)}</td>
                      <td data-label="%" className="text-right tabular-nums font-medium text-slate-700">
                        {k.pctChurn != null ? `${k.pctChurn.toFixed(1)}%` : '—'}
                      </td>
                      <td data-label="USD" className="text-right tabular-nums text-slate-500">{fmtUsd(k.usdChurn)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {data.clientesQ.length > 0 && (
        <Card>
          <div className="flex items-center justify-between gap-4 flex-wrap mb-1">
            <h3 className="text-sm font-semibold text-slate-700">
              Quiénes entraron en churn en Q{qAbierto.trimestre} {qAbierto.anio}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setVerClientes(v => !v)}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-[#0097A7] hover:text-[#0097A7] transition-colors"
                aria-pressed={verClientes}
              >
                {verClientes ? 'Ocultar' : `Ver las ${nf.format(clientes.length)}`}
              </button>
              <BotonCsv filas={clientes} base={`churn-${qAbierto.trimestreId}`}>
                Descargar {qAbierto.trimestreId}
              </BotonCsv>
              {serie.length > 1 && (
                <BotonCsv filas={data.clientesQ} base="churn-trimestral">
                  Descargar todo
                </BotonCsv>
              )}
              {data.churnQPaises.length > 0 && (
                <button
                  onClick={() => {
                    track('analisis:movimientos:csv', 'resumen-pais');
                    descargarResumenCsv(data.churnQPaises, `churn-resumen-pais-${hoyISO()}.csv`);
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-[#0097A7] hover:text-[#0097A7] transition-colors active:scale-95"
                >
                  Descargar resumen por país
                </button>
              )}
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Ordenadas por lo que facturaron en su trimestre de referencia. El CSV
            incluye la ventana con la que se declaró la pérdida, para poder verificarla.
          </p>
          {verClientes && (
            <div className="mt-3 overflow-x-auto max-h-[420px] overflow-y-auto tabla-scroll">
              <table className="w-full text-sm tabla-apilable-vp">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-slate-400 border-b border-slate-200 text-xs">
                    <th scope="col" className="text-left font-medium py-2">Cliente</th>
                    <th scope="col" className="text-left font-medium">ID tributario</th>
                    <th scope="col" className="text-left font-medium">País</th>
                    <th scope="col" className="text-left font-medium">Ejecutivo</th>
                    <th scope="col" className="text-left font-medium">Tipo</th>
                    <th scope="col" className="text-left font-medium">Sin comprar desde</th>
                    <th scope="col" className="text-right font-medium">USD referencia</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map(c => (
                    <tr key={`${c.pais}|${c.panelId}`} className="border-b border-slate-100">
                      <td data-titular className="py-2 text-slate-700">
                        <span className="block max-w-[240px] truncate" title={c.nombre}>{c.nombre}</span>
                      </td>
                      <td data-label="ID tributario" className="text-slate-400 text-xs tabular-nums">{c.idTributario ?? c.panelId}</td>
                      <td data-label="País" className="text-slate-500 text-xs">{c.pais}</td>
                      <td data-label="Ejecutivo" className="text-slate-500 text-xs">{c.kam}</td>
                      <td data-label="Tipo" className="text-xs">
                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                          <span className="w-2 h-2 rounded-sm shrink-0"
                                style={{ background: c.rama === 'recurrente' ? C_REC : C_EST }} />
                          {c.rama === 'recurrente' ? 'Recurrente' : 'Estacional'}
                          {c.tipoRef === 'primera_compra' && (
                            <span className="text-slate-400">· 1 sola compra</span>
                          )}
                        </span>
                      </td>
                      <td data-label="Sin comprar desde" className="text-slate-500 text-xs tabular-nums">{c.silDe ?? '—'}</td>
                      <td data-label="USD referencia" className="text-right tabular-nums text-slate-700">{fmtUsd(c.usdReferencia)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <p className="text-[11px] text-slate-400">
        Criterio: <span className="font-medium text-slate-500">ventana de silencio</span> por
        tipo de cliente (4 meses recurrente · 13 estacional), evaluada al cierre del
        trimestre. Un cliente cuenta una sola vez por desaparición: para volver a
        contar tiene que reactivarse y dejar de comprar de nuevo. El denominador son
        los clientes del país con historial <em>al cierre de ese trimestre</em>, no la
        cartera de hoy. Los estacionales de un trimestre dejaron de comprar hace más
        de un año: es un indicador rezagado a propósito.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

// Churn trimestral va primero y es la vista por defecto: es la definición de
// negocio del PDF y la que se reporta al C-level. El semáforo es la lectura
// operativa del día a día y queda segundo.
const VISTAS = [
  { id: 'churnq'   as const, label: 'Churn trimestral' },
  { id: 'semaforo' as const, label: 'Semáforo' },
];

export function MovimientosTab({ pais, kam }: Props) {
  const anio = new Date().getFullYear();
  const { data, isLoading, error } = useMovimientos(anio, pais, kam);
  const [vista, setVista] = useState<'semaforo' | 'churnq'>('churnq');
  const { track } = useTrack();

  if (isLoading) {
    return <div className="py-16 text-center text-sm text-slate-400">Cargando movimientos…</div>;
  }
  if (error) {
    return (
      <div className="py-12 text-center text-sm text-red-500">
        No se pudieron cargar los movimientos: {(error as Error).message}
      </div>
    );
  }
  if (!data) {
    return <div className="py-16 text-center text-sm text-slate-400">Sin datos para {anio}.</div>;
  }

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Vista de movimientos"
           className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
        {VISTAS.map(v => (
          <button key={v.id} role="tab" aria-selected={vista === v.id}
                  onClick={() => {
                    setVista(v.id);
                    track(v.id === 'churnq'
                      ? 'analisis:movimientos:churn-trimestral'
                      : 'analisis:movimientos:semaforo');
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    vista === v.id
                      ? 'bg-white text-[#0097A7] shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}>
            {v.label}
          </button>
        ))}
      </div>

      {vista === 'semaforo'
        ? <VistaSemaforo data={data} kam={kam} />
        : <VistaChurnQ  data={data} kam={kam} />}
    </div>
  );
}
