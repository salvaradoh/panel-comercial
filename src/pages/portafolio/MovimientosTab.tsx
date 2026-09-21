import { Fragment, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Card } from '../../components/ui/Card';
import { ComoSeCalculaChurn, EtiquetaCaso, CASOS, type CasoId } from './ComoSeCalculaChurn';
import { puenteQ, tipoChurn } from './churnPuente';
import { useMovimientos } from '../../hooks/useMovimientos';
import type {
  MovMes, MovAgregado, MovimientosResponse, ChurnQTrimestre, ClienteChurnQ, ChurnQPais, MovimientoBase,
} from '../../hooks/useMovimientos';
import { useTrack } from '../../hooks/useTrack';
import { descargarExcelChurnQ } from './exportChurnQExcel';

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
const ORDEN_PAISES = ['México', 'Chile', 'Colombia', 'Perú', 'Ecuador'];

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
/**
 * Una mitad del puente. Cada tabla desglosa SU propia columna —la de arriba
 * "Salieron", la de abajo "Churn"— porque mostrar las dos en ambas repetía el
 * mismo bloque dos veces en la misma pantalla. El número que comparten (los que
 * son las dos cosas a la vez) aparece igual en las dos mitades, que es lo que
 * las conecta.
 */
function DesgloseQ({ p, lado }: {
  p: ReturnType<typeof puenteQ>;
  lado: 'salidas' | 'churn';
}) {
  // El número lleva el color del caso y, al lado, su nombre: el color solo
  // sirve a quien ya lo aprendió en el modal y a quien lo distingue. Los dos
  // juntos funcionan para cualquiera.
  const linea = (n: number, caso: CasoId | null, txt: string) => (
    <div className="flex items-baseline gap-2 py-1">
      <span className={`tabular-nums font-semibold w-10 text-right flex-shrink-0 ${
        caso ? CASOS[caso].texto : 'text-slate-400'}`}>
        {nf.format(n)}
      </span>
      <span className="text-slate-500 min-w-0">
        {caso && <EtiquetaCaso caso={caso} className="mr-1.5" />}
        {txt}
      </span>
    </div>
  );
  return (
    <div className="text-[11px] py-2 max-w-xl">
      <p className="font-semibold text-slate-600 mb-1">
        {lado === 'churn'
          ? `Los ${nf.format(p.churn)} en churn`
          : `Los ${nf.format(p.bajas)} que salieron de la base`}
      </p>
      {lado === 'churn' ? (
        <>
          {linea(p.churnQueSalio, 'perdidaNueva', 'son las mismas empresas que salieron de la base: cuentan en las dos cifras')}
          {p.churnQueSigue > 0 &&
            linea(p.churnQueSigue, 'sigueEnBase', 'cambiaron de tipo de cliente al volver a comprar, y con el plazo más largo sus compras anteriores todavía cuentan')}
        </>
      ) : (
        <>
          {linea(p.churnQueSalio, 'perdidaNueva', 'son las mismas empresas que cuentan como churn de este trimestre: cuentan en las dos cifras')}
          {p.bajaYaContada > 0 &&
            linea(p.bajaYaContada, 'yaContada', 'ya se habían contado como perdidas en un trimestre anterior y dejan la base recién ahora. No se cuentan dos veces')}
          {p.bajaSinChurn > 0 &&
            linea(p.bajaSinChurn, null, 'salieron sin figurar en el churn publicado: se perdieron antes del primer trimestre de la serie')}
        </>
      )}
      {/* Desde que el tipo se congela en la última compra, lo normal es que las
          dos cifras coincidan. Decirlo es más útil que dejar el bloque con una
          sola línea y que parezca que falta algo. */}
      {p.churn === p.bajas && p.churnQueSalio === p.churn && (
        <p className="text-slate-400 mt-1">
          Las dos cifras son exactamente las mismas empresas. Coinciden porque un cliente
          solo cambia de tipo cuando compra, así que su pérdida y su salida de la base
          caen en el mismo trimestre.
        </p>
      )}
    </div>
  );
}

function ResumenPorPais({ celdas, serie, enCurso, movimientos, clientes, onElegir, seleccion }: {
  celdas: ChurnQPais[];
  serie: ChurnQTrimestre[];
  enCurso: ChurnQTrimestre | null;
  /** Altas y bajas de la base activa, para explicar por qué se mueve el
   *  denominador. Vacío mientras el GAS no haya corrido con la versión nueva. */
  movimientos: MovimientoBase[];
  /** Clientes contados en churn, de todos los trimestres. Se usa para cruzarlos
   *  contra las bajas y poder decir de qué está hecho cada número. */
  clientes: ClienteChurnQ[];
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
  const [medida, setMedida] = useState<'clientes' | 'pct' | 'delta'>('clientes');
  // Rama sobre la que se lee el movimiento de la base. En 'todas' el cambio de
  // rama es invisible —el cliente no se fue de la cartera, solo de una mitad a
  // la otra—, y es justo lo que el equipo pidió poder ver.
  const [ramaBase, setRamaBase] = useState<'todas' | 'recurrente' | 'estacional'>('todas');
  // Trimestre con el desglose abierto. Es uno solo para las dos tablas: son el
  // mismo trimestre visto de dos lados, y tenerlo abierto en dos lugares a la
  // vez con números iguales es ruido.
  const [desglose, setDesglose] = useState<string | null>(null);
  const [verComoSeCalcula, setVerComoSeCalcula] = useState(false);
  const alternarDesglose = (tid: string) =>
    setDesglose(d => (d === tid ? null : tid));
  const paises = ordenarPaises([...new Set(celdas.map(c => c.pais))]);
  const buscar = (tid: string, pais: string) =>
    celdas.find(c => c.trimestreId === tid && c.pais === pais) ?? null;

  const trimestres = serie.map(d => d.trimestreId);
  const ultimo = trimestres.length ? trimestres[trimestres.length - 1] : null;
  const base = paises.map(p => (ultimo ? (buscar(ultimo, p)?.cartera ?? 0) : 0));
  const baseTotal = base.reduce((a, b) => a + b, 0);

  // Nota de cobertura parcial: se arma sola desde `celdas`, no con una fecha
  // fija. Cuando un país acumule los meses que le faltan (típicamente el que
  // recién arrancó: la ventana estacional pide 15 meses de historia previa),
  // esta franja se corre sin tocar código — deja de haber celdas 'parcial' y
  // el bloque no se renderiza más.
  const trimestresParciales = serie.filter(d => d.coberturaParcial).map(d => d.trimestreId);
  const paisesParciales = [...new Set(
    celdas.filter(c => c.coberturaParcial).map(c => c.pais)
  )].sort();

  // Variación contra el trimestre inmediatamente anterior de la serie. El primero
  // publicado no tiene con qué compararse: el GAS recorta desde 2024 (necesita el
  // histórico completo para la guarda de no-recontar, pero publica menos).
  const anteriorA = (tid: string) => {
    const i = trimestres.indexOf(tid);
    return i > 0 ? trimestres[i - 1] : null;
  };
  const delta = (tid: string, pais: string): number | null => {
    const prev = anteriorA(tid);
    if (!prev) return null;
    const a = buscar(prev, pais), b = buscar(tid, pais);
    // Si alguno de los dos trimestres no es comparable, su diferencia tampoco.
    if (!a || !b || a.coberturaParcial || b.coberturaParcial) return null;
    return b.churn - a.churn;
  };

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
    // Un promedio de variaciones es el neto entre el primer y el último
    // trimestre dividido por los saltos: no dice nada que la serie no diga.
    if (medida === 'delta') return null;
    if (medida === 'pct') return Math.round((100 * ch / ca) * 10) / 10;
    const nQ = new Set(filas.map(f => f.trimestreId)).size;
    return nQ > 0 ? ch / nQ : null;
  };

  const total = (tid: string) => {
    const cs = paises.map(p => buscar(tid, p))
      .filter((c): c is ChurnQPais => c != null && !c.coberturaParcial);
    const ch = cs.reduce((a, b) => a + b.churn, 0);
    const ca = cs.reduce((a, b) => a + b.cartera, 0);
    if (medida === 'delta') {
      const ds = cs.map(c => delta(tid, c.pais));
      // Si a algún país le falta el dato, el total de la fila sería una suma
      // parcial disfrazada de total.
      return ds.some(d => d == null) ? null : ds.reduce<number>((a, b) => a + (b ?? 0), 0);
    }
    return medida === 'pct' ? (ca > 0 ? Math.round((100 * ch / ca) * 10) / 10 : null) : ch;
  };

  const fmt = (v: number | null) =>
    v == null ? '—'
    : medida === 'pct' ? `${v.toFixed(1)}%`
    : medida === 'delta' ? `${v > 0 ? '+' : ''}${nf.format(Math.round(v))}`
    : nf.format(Math.round(v));

  const valor = (c: ChurnQPais | null) => {
    if (!c) return null;
    if (medida === 'delta') return delta(c.trimestreId, c.pais);
    return medida === 'pct' ? c.pctChurn : c.churn;
  };

  const th = 'text-right font-medium text-xs text-[#0097A7] pb-3 px-2';
  const td = 'text-right py-3 px-2 tabular-nums text-slate-700';

  // El ejemplo del modal son los números del último trimestre cerrado, no cifras
  // inventadas: quien lo lee acaba de verlos en la tabla de arriba.
  const ultimoCerrado = serie.length ? serie[serie.length - 1] : null;
  const ejemplo = (() => {
    if (!ultimoCerrado) return null;
    const p = puenteQ(ultimoCerrado.trimestreId, clientes, movimientos);
    if (!p.churn || !p.bajas) return null;
    return {
      etiqueta: etiquetaQ(ultimoCerrado.trimestreId),
      churn: p.churn, salieron: p.bajas, ambas: p.churnQueSalio,
      sigue: p.churnQueSigue, yaContada: p.bajaYaContada,
    };
  })();

  // La misma relación en todos los trimestres publicados. Uno solo se lee como
  // una casualidad del trimestre; la serie muestra que es una identidad.
  const serieModal = serie
    .map(d => {
      const p = puenteQ(d.trimestreId, clientes, movimientos);
      if (!p.churn || !p.bajas) return null;
      return {
        etiqueta: etiquetaQ(d.trimestreId),
        churn: p.churn, salieron: p.bajas, sigue: p.churnQueSigue,
        yaContada: p.bajaYaContada, sinChurn: p.bajaSinChurn,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <Card>
      <AnimatePresence>
        {verComoSeCalcula && (
          <ComoSeCalculaChurn ejemplo={ejemplo} serie={serieModal}
                              onCerrar={() => setVerComoSeCalcula(false)} />
        )}
      </AnimatePresence>
      {/* Detalle por trimestre. Vive en esta card y no en una propia porque es la
          misma tabla vista de otro lado —los mismos trimestres, abiertos por rama
          y con la cartera— y separarlas dejaba media pantalla vacía. */}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="text-sm font-semibold text-slate-700">Detalle por trimestre</h4>
          <button
            onClick={() => setVerComoSeCalcula(true)}
            className="text-[11px] font-semibold text-[#0097A7] hover:underline focus-visible:underline"
          >
            ¿Cómo se calcula?
          </button>
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5 mb-2">
          Toca un trimestre para ver y descargar sus empresas.
        </p>
        <div className="overflow-x-auto -mx-2 tabla-scroll">
          <table className="w-full text-sm min-w-[420px] tabla-apilable">
            <caption className="sr-only">Clientes en churn separados en recurrentes y estacionales, cartera y porcentaje</caption>
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
                <Fragment key={d.trimestreId}>
                <tr className={`border-b border-slate-100 transition-colors ${
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
                    <button
                          onClick={() => alternarDesglose(d.trimestreId)}
                          aria-expanded={desglose === d.trimestreId}
                          aria-label={`Ver de qué está hecho el churn de ${etiquetaQ(d.trimestreId)}`}
                          className="ml-1.5 text-slate-300 hover:text-[#0097A7] transition-colors align-middle"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                               stroke="currentColor" strokeWidth="3" aria-hidden="true"
                               className={`transition-transform ${desglose === d.trimestreId ? 'rotate-180' : ''}`}>
                            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                  </th>
                  <td data-label="Churn" className={`${td} font-semibold text-slate-800`}>{nf.format(d.churn)}</td>
                  <td data-label="Rec." className={`${td} text-slate-500`}>{nf.format(d.churnRec)}</td>
                  <td data-label="Est." className={`${td} text-slate-500`}>{nf.format(d.churnEst)}</td>
                  <td data-label="Cartera" className={`${td} text-slate-500`}>{nf.format(d.cartera)}</td>
                  <td data-label="%" className={`${td} font-medium`}>
                    {d.pctChurn != null ? `${d.pctChurn.toFixed(1)}%` : '—'}
                  </td>
                </tr>
                {desglose === d.trimestreId && (
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <td colSpan={6} className="px-2 pb-2">
                      <DesgloseQ p={puenteQ(d.trimestreId, clientes, movimientos)} lado="churn" />
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {trimestresParciales.length > 0 && (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-3">
            <strong>{etiquetaQ(trimestresParciales[0])} a {etiquetaQ(trimestresParciales[trimestresParciales.length - 1])}
            {' '}vienen marcados "parcial"</strong>: {paisesParciales.join(' y ')} todavía no
            acumula{paisesParciales.length === 1 ? '' : 'n'} los meses de historial que pide la
            ventana de referencia (hasta 15 meses atrás para clientes estacionales). El churn de
            esos trimestres está subestimado para {paisesParciales.length === 1 ? 'ese país' : 'esos países'} y
            no es comparable con el resto de la serie. La franja se acorta sola a medida que pasan
            los trimestres.
          </p>
        )}
      </div>

      <div className="mt-6 pt-5 border-t border-slate-100">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Resumen por país</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Sobre la cartera de cada país congelada al cierre de cada trimestre.
          </p>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1" role="group" aria-label="Medida de la tabla">
          {([['clientes', 'Clientes'], ['pct', '% de la base'], ['delta', 'Variación']] as const).map(([id, etq]) => (
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
            {medida === 'pct' ? 'Porcentaje de churn'
             : medida === 'delta' ? 'Variación de clientes en churn contra el trimestre anterior'
             : 'Clientes en churn'} por trimestre y país
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
              {/* La base es la del último trimestre CERRADO, no la del que está
                  en curso —cuya base todavía se mueve—. Sin decir cuál, la fila
                  queda pegada a la del trimestre en curso y se lee como si fuera
                  su denominador. */}
              <th scope="row" className="text-left font-normal text-[11px] text-slate-400 py-2.5 px-2 whitespace-nowrap">
                Clientes en la base
                {ultimo && <span className="text-slate-300"> · {etiquetaQ(ultimo)}</span>}
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

            {enCurso && (
              <tr className="border-b-2 border-slate-200">
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

            {/* Del más reciente al más viejo, igual que las otras dos tablas de
                la card: leerlas en sentidos distintos hace comparar mal. */}
            {[...trimestres].reverse().map(tid => (
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

            {[...anios].reverse().map(a => (
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

          </tbody>
        </table>
      </div>
      </div>

      {/* Cómo se movió la base, trimestre a trimestre. El % cambia por dos
          motivos y el panel solo mostraba uno: se pierde más o menos gente
          (numerador) o entra y sale gente de la base activa (denominador).
          Esto explica el segundo, que era invisible. */}
      {movimientos.length > 0 && (() => {
        // Una fila por transición: el primer trimestre de la serie no tiene
        // anterior contra qué compararse, así que arranca en el segundo.
        // El payload viejo no traía rama: sin ella el selector mentiría, así que
        // no se ofrece y la tabla se comporta como antes.
        const hayRama = movimientos.some(m => m.rama);
        const rama = hayRama ? ramaBase : 'todas';
        const filas = trimestres.slice(1).map(tid => {
          const prev = anteriorA(tid)!;
          const del = movimientos.filter(m =>
            m.trimestreId === tid && (rama === 'todas' || m.rama === rama));
          const baseDe = (q: string) =>
            paises.reduce((a, p) => {
              const c = buscar(q, p);
              if (!c) return a;
              return a + (rama === 'todas' ? c.cartera
                        : rama === 'recurrente' ? c.carteraRec : c.carteraEst);
            }, 0);
          // Las reclasificaciones se separan de las salidas y entradas reales:
          // mezcladas, "salieron 121" se lee como 121 clientes perdidos cuando
          // ninguno se fue de la cartera. Van en su propia columna, con signo.
          const cuenta = (mov: string, recl: boolean) =>
            del.filter(m => m.movimiento === mov &&
              (m.motivo === 'reclasificacion') === recl).length;
          return {
            tid, prev,
            baseAnt: baseDe(prev),
            bajas:   cuenta('baja', false),
            altas:   cuenta('alta', false),
            cambio:  cuenta('alta', true) - cuenta('baja', true),
            base:    baseDe(tid),
          };
        }).filter(r => r.bajas > 0 || r.altas > 0 || r.cambio !== 0)
          // El cálculo se arma en orden cronológico —cada fila mira el trimestre
          // anterior—, pero se muestra al revés, como las otras dos tablas.
          .reverse();
        if (!filas.length) return null;
        const verCambio = rama !== 'todas';
        return (
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
              <h4 className="text-sm font-semibold text-slate-700">Cómo se movió la base</h4>
              <button
                onClick={() => descargarMovimientosCsv(
                  movimientos, `churn-base-altas-bajas-${hoyISO()}.csv`)}
                className="text-[11px] font-semibold text-slate-500 hover:text-[#0097A7] transition-colors flex-shrink-0"
              >
                Descargar quiénes
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">
              El porcentaje también se mueve cuando cambia la base, no solo cuando se
              pierde más gente. La descarga trae el detalle por empresa y país.
            </p>
            {hayRama && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {([
                  ['todas', 'Toda la base'],
                  ['recurrente', 'Recurrentes'],
                  ['estacional', 'Estacionales'],
                ] as const).map(([id, txt]) => (
                  <button
                    key={id}
                    onClick={() => setRamaBase(id)}
                    aria-pressed={ramaBase === id}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
                      ramaBase === id
                        ? 'bg-[#0097A7] text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    {txt}
                  </button>
                ))}
              </div>
            )}
            {verCambio && (
              <p className="text-[11px] text-slate-400 mb-2">
                «Cambió de tipo» son empresas que no salieron de la cartera: pasaron
                de {rama === 'recurrente' ? 'estacionales a recurrentes, o al revés'
                   : 'recurrentes a estacionales, o al revés'}. Lo que este grupo suma,
                el otro lo resta, y por eso en «Toda la base» no se ve nada.
              </p>
            )}
            <div className="tabla-scroll">
              <table className="w-full text-sm tabla-apilable-vp">
                <thead>
                  <tr className="text-[10px] text-slate-400 border-b border-slate-100 uppercase tracking-wide">
                    <th scope="col" className="text-left font-medium pb-1.5">Trimestre</th>
                    <th scope="col" className="text-right font-medium pb-1.5 px-2">Base anterior</th>
                    <th scope="col" className="text-right font-medium pb-1.5 px-2">Salieron de la base</th>
                    <th scope="col" className="text-right font-medium pb-1.5 px-2">Entraron a la base</th>
                    {verCambio && (
                      <th scope="col" className="text-right font-medium pb-1.5 px-2">Cambió de tipo</th>
                    )}
                    <th scope="col" className="text-right font-medium pb-1.5 pl-2">Base</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map(r => (
                    <Fragment key={r.tid}>
                    <tr className={`border-b border-slate-50 ${
                      r.tid === seleccion ? 'bg-slate-50' : ''}`}>
                      <th scope="row" className="text-left py-2 pr-3 font-normal whitespace-nowrap">
                        {onElegir ? (
                          <button onClick={() => onElegir(r.tid)}
                                  className="text-[#0097A7] hover:underline focus-visible:underline">
                            {etiquetaQ(r.tid)}
                          </button>
                        ) : etiquetaQ(r.tid)}
                        <button
                          onClick={() => alternarDesglose(r.tid)}
                          aria-expanded={desglose === r.tid}
                          aria-label={`Ver de qué están hechas las salidas de ${etiquetaQ(r.tid)}`}
                          className="ml-1.5 text-slate-300 hover:text-[#0097A7] transition-colors align-middle"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                               stroke="currentColor" strokeWidth="3" aria-hidden="true"
                               className={`transition-transform ${desglose === r.tid ? 'rotate-180' : ''}`}>
                            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </th>
                      <td data-label="Base anterior" className="py-2 px-2 text-right tabular-nums text-slate-400">{nf.format(r.baseAnt)}</td>
                      <td data-label="Salieron de la base" className="py-2 px-2 text-right tabular-nums text-red-500 font-medium">−{nf.format(r.bajas)}</td>
                      <td data-label="Entraron a la base" className="py-2 px-2 text-right tabular-nums text-emerald-600 font-medium">+{nf.format(r.altas)}</td>
                      {verCambio && (
                        <td data-label="Cambió de tipo" className={`py-2 px-2 text-right tabular-nums font-medium ${
                          r.cambio > 0 ? 'text-emerald-600' : r.cambio < 0 ? 'text-red-500' : 'text-slate-300'}`}>
                          {r.cambio > 0 ? '+' : r.cambio < 0 ? '−' : ''}{nf.format(Math.abs(r.cambio))}
                        </td>
                      )}
                      <td data-label="Base" className="py-2 pl-2 text-right tabular-nums text-slate-700 font-semibold">{nf.format(r.base)}</td>
                    </tr>
                    {desglose === r.tid && (
                      <tr className="border-b border-slate-50 bg-slate-50/60">
                        <td colSpan={verCambio ? 6 : 5} className="px-2 pb-2">
                          <DesgloseQ p={puenteQ(r.tid, clientes, movimientos)} lado="salidas" />
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

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
 * CSV de quiénes entraron y salieron de la base activa en un trimestre.
 *
 * Es el detalle que el bloque de conciliación resume: una fila por empresa y
 * trimestre, con el movimiento, el país, el ejecutivo y lo que facturaba.
 * Permite contestar "¿y quiénes son esos 143 que entraron en Colombia?" sin
 * volver a la base.
 *
 * Van TODOS los trimestres en un archivo: en pantalla la tabla muestra los
 * totales por trimestre y el país se pierde, así que el corte por país tiene
 * que estar acá o no está en ningún lado.
 */
function descargarMovimientosCsv(movs: MovimientoBase[], archivo: string) {
  const esc = (v: string | number) => {
    const t = String(v ?? '');
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const cols: [string, (m: MovimientoBase) => string | number][] = [
    ['Trimestre',   m => m.trimestreId],
    ['Movimiento',  m => (m.movimiento === 'alta' ? 'Entró' : 'Salió')],
    // Un cambio de rama no es un movimiento de cartera: el cliente sigue ahí.
    // Sin esta columna las dos cosas se leen igual y el total no cierra.
    ['Motivo',      m => (m.motivo === 'reclasificacion'
                          ? 'Cambió de tipo' : 'Movimiento de cartera')],
    ['Tipo para el churn', m => m.rama ?? ''],
    ['País',        m => m.pais],
    ['Ejecutivo',   m => m.kam],
    ['Empresa',     m => m.nombre],
    ['ID panel',    m => m.panelId],
    ['Tipo',        m => tipoChurn(m.rama, m.tipo)],
    ['USD 12m',     m => Math.round(m.usd12m || 0)],
  ];
  const texto = [cols.map(c => c[0]).join(';')]
    .concat(movs
      .slice()
      // Por trimestre y, dentro de cada uno, las bajas primero: es lo que se
      // mira al abrir el archivo.
      .sort((a, b) => a.trimestreId.localeCompare(b.trimestreId)
                      || (a.movimiento === b.movimiento ? 0 : a.movimiento === 'baja' ? -1 : 1)
                      || a.pais.localeCompare(b.pais)
                      || (b.usd12m || 0) - (a.usd12m || 0))
      .map(m => cols.map(([, get]) => esc(get(m))).join(';')))
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
  // Qué lista muestra la tabla de abajo: los perdidos del trimestre, o los
  // que entraron o salieron de la base. Son tres preguntas distintas sobre el
  // mismo trimestre y antes solo se podía ver la primera.
  const [vistaDet, setVistaDet] = useState<'perdidos' | 'bajas' | 'altas'>('perdidos');
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

  // Trimestre de la tabla por ejecutivo. Va aparte del que abre el detalle de
  // clientes: son dos preguntas distintas y el equipo pidió poder moverlas por
  // separado. Del más reciente al más viejo, como el resto de la pantalla.
  const trimestresKam = [...new Set(data.churnQKams.map(k => k.trimestreId))]
    .sort().reverse();
  const [qKams, setQKams] = useState<string | null>(null);
  const qKamsActivo = qKams && trimestresKam.includes(qKams)
    ? qKams
    : (data.ultimoQ ?? trimestresKam[0] ?? '');
  const kamsDelQ = data.churnQKams
    .filter(k => k.trimestreId === qKamsActivo)
    .sort((a, b) => b.churn - a.churn);
  const ant = serie.length > 1 ? serie[serie.length - 2] : null;

  // Trimestre abierto en el detalle. Si el seleccionado ya no existe se cae al último.
  const qAbierto = data.churnQ.find(d => d.trimestreId === qSel) ?? ult;
  const clientes = data.clientesQ.filter(c => c.trimestreId === qAbierto.trimestreId);
  const movsQ = data.movimientosBase.filter(m => m.trimestreId === qAbierto.trimestreId);
  const bajas = movsQ.filter(m => m.movimiento === 'baja');
  const altas = movsQ.filter(m => m.movimiento === 'alta');
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
                            movimientos={data.movimientosBase}
                            clientes={data.clientesQ}
                            onElegir={elegir} seleccion={qAbierto.trimestreId} />
          </div>
        )}

        {!propio && data.churnQKams.length > 1 && (
          <Card>
            <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
              <h3 className="text-sm font-semibold text-slate-700">Por ejecutivo</h3>
              {/* El churn por ejecutivo es de un trimestre, no acumulado: sumar
                  varios mezclaría pérdidas con reactivaciones. Por eso se elige
                  uno en vez de ofrecer un rango. */}
              <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span>Trimestre</span>
                <select
                  value={qKamsActivo}
                  onChange={e => setQKams(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-[#0097A7]"
                >
                  {trimestresKam.map(tid => (
                    <option key={tid} value={tid}>{etiquetaQ(tid)}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              Ordenado por clientes en churn.
              {enCurso?.trimestreId === qKams && ' Este trimestre todavía no cerró: la tasa está inflada.'}
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
                  {kamsDelQ.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-[11px] text-slate-400">
                        Sin datos por ejecutivo en este trimestre.
                      </td>
                    </tr>
                  )}
                  {kamsDelQ.map(k => (
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
              {/* "Descargar todo" es el Excel de tres hojas y no un CSV más: si
                  fueran dos botones distintos, el de al lado del trimestre invita
                  a bajar el CSV y perderse el resumen y las altas/bajas, que es
                  justo lo que se pidió que estuviera. El CSV del trimestre queda
                  para bajar una lista puntual y pegarla en otro lado. */}
              {data.churnQPaises.length > 0 && (
                <button
                  onClick={() => {
                    track('analisis:movimientos:excel', 'churn-trimestral');
                    descargarExcelChurnQ(
                      data.churnQPaises, data.clientesQ, data.movimientosBase,
                      ordenarPaises([...new Set(data.churnQPaises.map(c => c.pais))]),
                      `churn-trimestral-${hoyISO()}.xlsx`);
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[#0097A7] text-white hover:bg-[#00838f] transition-colors active:scale-95 shadow-sm"
                >
                  Descargar todo (Excel)
                </button>
              )}
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Ordenadas por lo que facturaron en su trimestre de referencia. El CSV
            incluye la ventana con la que se declaró la pérdida, para poder verificarla.
          </p>
          {/* Filtro de la tabla. Los tres números del trimestre son accionables:
              se toca el que interesa y la lista de abajo cambia, en vez de tener
              que bajarse un archivo para ver quiénes son. */}
          {verClientes && movsQ.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-3">
              {([['perdidos', 'Se perdieron', clientes.length],
                 ['bajas',    'Salieron de la base', bajas.length],
                 ['altas',    'Entraron a la base', altas.length]] as const).map(([id, etq, n]) => (
                <button
                  key={id}
                  onClick={() => setVistaDet(id)}
                  aria-pressed={vistaDet === id}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all active:scale-95 ${
                    vistaDet === id
                      ? 'bg-[#0097A7] text-white shadow-sm'
                      : 'bg-slate-50 text-slate-500 hover:text-slate-700'}`}
                >
                  {etq} · {nf.format(n)}
                </button>
              ))}
            </div>
          )}

          {verClientes && vistaDet !== 'perdidos' && (
            <div className="mt-3 overflow-x-auto max-h-[420px] overflow-y-auto tabla-scroll">
              <table className="w-full text-sm tabla-apilable-vp">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-slate-400 border-b border-slate-200 text-xs">
                    <th scope="col" className="text-left font-medium py-2">Empresa</th>
                    <th scope="col" className="text-left font-medium">País</th>
                    <th scope="col" className="text-left font-medium">Ejecutivo</th>
                    <th scope="col" className="text-left font-medium">Tipo</th>
                    <th scope="col" className="text-right font-medium">USD 12m</th>
                  </tr>
                </thead>
                <tbody>
                  {(vistaDet === 'bajas' ? bajas : altas)
                    .slice()
                    .sort((a, b) => (b.usd12m || 0) - (a.usd12m || 0))
                    .map(m => (
                      <tr key={`${m.pais}|${m.panelId}`} className="border-b border-slate-100">
                        <td data-titular className="py-2 text-slate-700">
                          <span className="block max-w-[240px] truncate" title={m.nombre}>{m.nombre}</span>
                        </td>
                        <td data-label="País" className="text-slate-500 text-xs">{m.pais}</td>
                        <td data-label="Ejecutivo" className="text-slate-500 text-xs">{m.kam}</td>
                        <td data-label="Tipo" className="text-slate-500 text-xs">
                          {tipoChurn(m.rama, m.tipo)}
                        </td>
                        <td data-label="USD 12m" className="text-right tabular-nums text-slate-600">
                          {nf.format(Math.round(m.usd12m || 0))}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {verClientes && vistaDet === 'perdidos' && (
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
