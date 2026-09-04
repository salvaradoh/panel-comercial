import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useTablaClientes } from '../hooks/useTablaClientes';
import type { ClienteTabla, SegmentoCliente, TipoCliente } from '../hooks/useTablaClientes';
import { useHistorial } from '../hooks/useHistorial';
import type { HistorialMap } from '../hooks/useHistorial';
import { histKey } from '../hooks/useHistorial';
import { useScoresChurn } from '../hooks/useScoresChurn';
import type { ScoresChurnMap } from '../hooks/useScoresChurn';
import { ScoreBadge, fmtUSD, FLAG_CC, SEG_COLOR } from '../components/salud';
import { SparklinePanel } from '../components/Sparkline';
import { mismoPais, clavePais } from '../lib/paises';
import { useTransacciones } from '../hooks/useTransacciones';
import { useTrack } from '../hooks/useTrack';
import { useContactos } from '../hooks/useContactos';
import { useActividad } from '../hooks/useActividad';

const POR_PAGINA = 50;

// ── Helpers ───────────────────────────────────────────────────────────────────

function SegDot({ seg }: { seg: SegmentoCliente }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: SEG_COLOR[seg] || '#9ca3af' }}
    />
  );
}

const TIPO_LABEL: Record<TipoCliente, string> = {
  estacional:        'Est.',
  primera_compra:    '1ra C.',
  recurrente:        'Rec.',
  perdido_historico: 'Perdido',
};

const TIPO_COLOR: Record<TipoCliente, { bg: string; text: string }> = {
  estacional:        { bg: 'bg-violet-50',  text: 'text-violet-600'  },
  primera_compra:    { bg: 'bg-sky-50',     text: 'text-sky-600'     },
  recurrente:        { bg: 'bg-teal-50',    text: 'text-teal-600'    },
  perdido_historico: { bg: 'bg-slate-100',  text: 'text-slate-400'   },
};

function TipoBadge({ tipo }: { tipo: TipoCliente }) {
  const { bg, text } = TIPO_COLOR[tipo] || TIPO_COLOR.estacional;
  return (
    <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${bg} ${text}`}>
      {TIPO_LABEL[tipo]}
    </span>
  );
}

// ── TendenciaCell ─────────────────────────────────────────────────────────────
// Compara monto6mAct vs monto6mAnt: dos mini-barras + flecha + % delta.

function TendenciaCell({ act, ant }: { act: number; ant: number }) {
  if (!act && !ant) return <span className="text-slate-300 text-[11px]">—</span>;

  const max = Math.max(act, ant, 1);
  const pctAct = Math.round((act / max) * 100);
  const pctAnt = Math.round((ant / max) * 100);

  const delta = ant > 0 ? ((act - ant) / ant) * 100 : null;
  const up    = delta != null && delta > 3;
  const down  = delta != null && delta < -3;
  const color = up ? '#16a34a' : down ? '#dc2626' : '#94a3b8';
  const arrow = up ? '↑' : down ? '↓' : '→';
  const pctStr = delta != null ? `${delta > 0 ? '+' : ''}${delta.toFixed(0)}%` : '—';

  const tooltip = `Mismo semestre del año anterior: ${fmtUSD(ant)}\n6m actual: ${fmtUSD(act)}\nCambio: ${pctStr}`;

  return (
    <div title={tooltip} className="flex items-center gap-2 cursor-default">
      <div className="flex flex-col gap-[3px] w-14 flex-shrink-0">
        {/* barra anterior — gris */}
        <div className="h-[3px] w-full bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-slate-300" style={{ width: `${pctAnt}%` }} />
        </div>
        {/* barra actual — coloreada */}
        <div className="h-[4px] w-full bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pctAct}%`, background: color }} />
        </div>
      </div>
      <span className="text-[10px] font-semibold tabular-nums whitespace-nowrap" style={{ color }}>
        {arrow} {pctStr}
      </span>
    </div>
  );
}



/**
 * Score de CHURN del cliente (col 9 de la hoja, `score_churn` en la vista).
 *
 * Sale de `score_ret`, el mismo número del que se deriva `status`, así que el
 * score y el riesgo que se muestran juntos siempre son coherentes. La vista lo
 * anulaba para estacionales y primera compra; ahora lo expone para todos.
 *
 * No confundir con el VENT de Salud del Cliente: ese usa Vigencia en lugar de
 * Recencia y se calcula aparte en el GAS.
 */
function getScoreChurn(c: ClienteTabla, scores?: ScoresChurnMap): number | null {
  // Prioridad al caché: es la fuente que ve Análisis de Clientes, y así el mismo
  // cliente nunca muestra dos números distintos entre las dos pantallas.
  const delCache = scores?.get(histKey(c.pais, c.panelId))?.score;
  if (delCache != null && delCache > 0) return delCache;
  return c.scoreEng > 0 ? c.scoreEng : null;   // respaldo: score_churn de la hoja
}

const RIESGO_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  saludable:  { label: 'Saludable',  color: '#047857', bg: '#ecfdf5' },
  monitorear: { label: 'Monitorear', color: '#b45309', bg: '#fffbeb' },
  en_riesgo:  { label: 'En riesgo',  color: '#b91c1c', bg: '#fef2f2' },
  critico:    { label: 'Crítico',    color: '#991b1b', bg: '#fef2f2' },
};

/** Riesgo de churn: la letra del segmento ya va aparte, acá va el estado. */
function RiesgoPill({ status }: { status: string }) {
  const st = RIESGO_STYLE[status];
  if (!st) return <span className="text-slate-300 text-xs">—</span>;
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ color: st.color, background: st.bg }}>
      {st.label}
    </span>
  );
}

// ── SortTh ────────────────────────────────────────────────────────────────────

type SortKey = 'nombre' | 'score' | 'diasSinCompra' | 'ultimaCompra' | 'tendencia' | 'dotacion';

function fmtFecha(s: string): string {
  if (!s) return '—';
  const str = String(s);
  if (!str.includes('/')) return '—';
  const [d, m, y] = str.split('/');
  if (!d || !m || !y) return str;
  const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${parseInt(d)} ${MESES[parseInt(m)] ?? m} ${y.slice(-2)}`;
}

// La tabla necesita fechas cortas porque compiten con seis columnas más, pero en
// el encabezado de la ficha hay lugar y "11/12/2025" se lee peor que el mes con
// nombre: es el dato que el ejecutivo cita en la llamada.
const MESES_LARGOS = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function fmtFechaLarga(s: string): string {
  const str = String(s ?? '');
  if (!str.includes('/')) return str;
  const [d, m, y] = str.split('/');
  const mes = MESES_LARGOS[parseInt(m)];
  if (!d || !mes || !y) return str;
  return `${parseInt(d)} de ${mes} del ${y}`;
}

// El corte de rojo es 60%, definido por negocio el 2026-08-21. El comparador
// sigue usando 50% para el tono de su hallazgo de texto.
function tonoFuga(pct: number): string {
  if (pct >= 60) return 'text-red-600';
  if (pct >= 25) return 'text-amber-600';
  return 'text-slate-700';
}

function SortTh({ k, cur, dir, onSort, align, className, children }: {
  k: SortKey; cur: SortKey; dir: 'asc' | 'desc';
  onSort: (k: SortKey) => void;
  align: 'left' | 'right';
  className?: string;
  children: React.ReactNode;
}) {
  const active = cur === k;
  return (
    <th
      className={`${className ?? ''} cursor-pointer select-none hover:text-slate-600 transition-colors text-${align}`}
      onClick={() => onSort(k)}
    >
      <span className="inline-flex items-center gap-0.5">
        {align === 'right' && active && <span className="text-[#0097A7]">{dir === 'asc' ? '↑' : '↓'}</span>}
        <span className={active ? 'text-[#0097A7]' : ''}>{children}</span>
        {align === 'left'  && active && <span className="text-[#0097A7]">{dir === 'asc' ? '↑' : '↓'}</span>}
        {!active && <span className="opacity-30">↕</span>}
      </span>
    </th>
  );
}

// ── Panel lateral de detalle ──────────────────────────────────────────────────

/**
 * Últimas ventas del cliente. Se apoya en Cache_Transacciones, que se descarga la
 * primera vez que se abre una ficha y no antes.
 *
 * El producto es la CATEGORÍA (Puntos / Gift Card / SaaS), no el texto crudo de la
 * base: ahí conviven códigos como '4101-003' con nombres y variantes de
 * mayúsculas, y el código no le dice nada a nadie. Es el mismo clasificador que
 * usa el churn.
 */
// Moneda local por país, para poder etiquetar el monto sin ambigüedad. Ecuador
// factura en dólares, así que ahí el local no aporta y no se muestra.
const MONEDA_PAIS: Record<string, string> = {
  chile: 'CLP', colombia: 'COP', peru: 'PEN', mexico: 'MXN', ecuador: 'USD',
};

function Transacciones({ c }: { c: ClienteTabla }) {
  const { trx, generado, tope, isLoading, error } = useTransacciones(c.pais, c.panelId, true);
  const moneda = MONEDA_PAIS[clavePais(c.pais)] ?? '';

  const nfUsd = (v: number) =>
    v >= 1000 ? `$${Math.round(v / 1000)}K` : `$${Math.round(v)}`;

  // El monto local va con todos sus dígitos, sin abreviar: sirve para reconocer
  // la factura, y "22,9M" no se puede cruzar contra un documento.
  const nfLocal = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });

  const fmtFecha = (f: string) => {
    const [a, m, d] = f.split('-');
    const MES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return `${d} ${MES[Number(m) - 1] ?? m} ${a.slice(2)}`;
  };

  return (
    <div className="px-5 pb-5">
      <div className="h-px bg-slate-100 mb-4" />
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">
          Últimas ventas
        </p>
        {trx.length > 0 && (
          <span className="text-[10px] text-slate-300 tabular-nums">
            {trx.length}{tope && trx.length >= tope ? ` de las últimas ${tope}` : ''}
          </span>
        )}
      </div>

      {isLoading && <p className="text-[11px] text-slate-400">Cargando ventas…</p>}

      {/* La hoja puede no existir todavía —el frontend se deploya antes de que el
          GAS la escriba por primera vez— y eso no es una falla que el ejecutivo
          tenga que ver como error rojo. Un rango inexistente da 400 "Unable to
          parse range"; cualquier otra cosa sí se muestra como error. */}
      {error && (
        /400|parse range|vac[íi]a|not found/i.test((error as Error).message)
          ? <div className="rounded-xl bg-slate-50 px-4 py-3 text-[11px] text-slate-500">
              El detalle de ventas se genera en el refresco diario del dashboard y
              todavía no está disponible.
            </div>
          : <p className="text-[11px] text-red-500">
              No se pudieron cargar las ventas: {(error as Error).message}
            </p>
      )}

      {!isLoading && !error && trx.length === 0 && (
        <div className="rounded-xl bg-slate-50 px-4 py-3 text-[11px] text-slate-500">
          Sin ventas registradas.
        </div>
      )}

      {trx.length > 0 && (
        <>
          <div className="max-h-64 overflow-y-auto -mx-1 px-1">
            <div className="tabla-scroll">
              <table className="w-full text-xs tabla-apilable">
                <caption className="sr-only">Últimas ventas del cliente</caption>
                <thead className="sticky top-0 bg-white">
                  <tr className="text-slate-400 text-[10px] border-b border-slate-100">
                    <th scope="col" className="text-left font-medium py-1.5">Fecha</th>
                    <th scope="col" className="text-left font-medium">Producto</th>
                    <th scope="col" className="text-right font-medium">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {trx.map((t, i) => (
                    <tr key={`${t.fecha}-${i}`} className="border-b border-slate-50 last:border-0">
                      <td data-titular className="py-1.5 whitespace-nowrap">
                        <span className="block text-slate-500 tabular-nums">{fmtFecha(t.fecha)}</span>
                        {/* El folio va debajo de la fecha y no en una cuarta columna:
                            el panel es angosto y solo Chile y México lo tienen. */}
                        {t.folio && (
                          <span className="block text-[10px] tabular-nums text-slate-400">#{t.folio}</span>
                        )}
                      </td>
                      <td data-label="Producto" className="text-slate-600">{t.producto}</td>
                      <td data-label="Monto" className="text-right py-1.5">
                        <span className="block tabular-nums font-medium text-slate-700">{nfUsd(t.usd)}</span>
                        {t.local > 0 && moneda !== 'USD' && (
                          <span className="block text-[10px] tabular-nums text-slate-400 whitespace-nowrap">
                            {nfLocal.format(t.local)} {moneda}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {generado && (
            <p className="mt-2 text-[10px] text-slate-300">
              Al {fmtFecha(generado.slice(0, 10))}.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Contactos del cliente en HubSpot. Cruza por ID tributario, la única llave que
 * existe entre las dos bases, y lee la hoja EN VIVO (está compartida con toda la
 * empresa), así que no hay atraso de caché.
 *
 * Un cliente sin contactos es lo normal, no un error: de las 1.277 filas de
 * HubSpot, 650 no traen ID tributario y quedan sin poder cruzarse. La cobertura
 * es del 18% en Chile. Por eso el vacío se comunica en gris y no como falla.
 */
function Contactos({ c }: { c: ClienteTabla }) {
  const { contactos, isLoading, error } = useContactos(c.idTributario, true);

  if (!c.idTributario) return null;

  return (
    <div className="px-5 pb-5">
      <div className="h-px bg-slate-100 mb-4" />
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">
          Contactos
        </p>
        {contactos.length > 1 && (
          <span className="text-[10px] text-slate-300 tabular-nums">{contactos.length}</span>
        )}
      </div>

      {isLoading && <p className="text-[11px] text-slate-400">Cargando contactos…</p>}

      {error && (
        <p className="text-[11px] text-red-500">
          No se pudieron cargar los contactos: {(error as Error).message}
        </p>
      )}

      {!isLoading && contactos.length === 0 && (
        <div className="rounded-xl bg-slate-50 px-4 py-3 text-[11px] text-slate-500">
          Sin contacto cargado en HubSpot para este ID tributario.
        </div>
      )}

      {contactos.length > 0 && (
        <ul className="space-y-2 max-h-56 overflow-y-auto">
          {contactos.map((ct, i) => (
            <li key={`${ct.email}-${i}`} className="text-xs">
              {ct.nombre && <span className="block text-slate-700 font-medium">{ct.nombre}</span>}
              {/* Cargo y área en una línea gris: dicen con quién se está hablando,
                  que es la mitad del valor de tener el contacto. El área va como
                  chip porque es un conjunto corto y repetido (Comercial, Finanzas…)
                  y así se distingue del cargo, que es texto libre y largo. */}
              {(ct.cargo || ct.area) && (
                <span className="flex items-baseline gap-1.5 mt-0.5">
                  {ct.area && (
                    <span className="rounded bg-slate-200 px-1 py-px text-[9px] font-semibold text-slate-600 flex-shrink-0">
                      {ct.area}
                    </span>
                  )}
                  {ct.cargo && (
                    <span className="text-[10px] text-slate-500 truncate" title={ct.cargo}>{ct.cargo}</span>
                  )}
                </span>
              )}
              {ct.email && (
                <a href={`mailto:${ct.email}`}
                   className="block text-[11px] text-[#0097A7] hover:underline truncate mt-0.5"
                   title={ct.email}>
                  {ct.email}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Mezcla de producto del cliente: un chip por producto con su ícono y su
 * porcentaje.
 *
 * Va en el encabezado porque qué compra es identidad del cliente —como su país o
 * su tipo—, no una métrica que se analiza.
 *
 * Sin barra apilada a propósito: en el encabezado el espacio es de una línea y una
 * barra de 6px sumaba una figura más que había que decodificar para leer dos
 * números. El porcentaje dice lo mismo directo. La barra sí tiene sentido abajo,
 * en "Producto por año", donde el largo codifica el monto.
 *
 * El ícono NO es el único portador: cada chip lleva el porcentaje visible y el
 * nombre del producto en el tooltip y en el aria-label.
 *
 * Ojo: el 43% de los clientes tiene el mix en cero y ahí no se dibuja nada. No es
 * un error del componente, es que la hoja no lo trae para todos.
 */
// `corto` es para las leyendas, donde el nombre completo no entra. Solo difiere
// donde hace falta: SuperCard es la única que no cabe.
/**
 * Íconos de producto en SVG y no emoji.
 *
 * El pedido era una tarjeta ROJA para Gift Card y una AZUL para SuperCard, y los
 * emoji no tienen variantes de color: `💳` es la única tarjeta del set y siempre
 * es la misma. Con SVG el ícono se pinta con el color exacto del producto, así
 * que ícono y barra siempre coinciden.
 *
 * Gift Card y SuperCard comparten la tarjeta con banda horizontal y se separan
 * por color.
 */
function IconoProducto({ tipo, color }: { tipo: string; color: string }) {
  const comun = { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none',
                  stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const,
                  strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (tipo) {
    // Las dos tarjetas comparten ícono y se distinguen solo por color. Es seguro
    // acá porque el rojo y el mostaza quedan en ΔE 40 con deuteranopía, y además
    // cada chip lleva su porcentaje y la leyenda su nombre.
    case 'Gift Card':
    case 'SuperCard':
      return (
        <svg {...comun}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
      );
    case 'SaaS':        // monitor
      return (
        <svg {...comun}>
          <rect x="2" y="4" width="20" height="12" rx="2" />
          <path d="M8 20h8M12 16v4" />
        </svg>
      );
    case 'Marketplace': // carrito
      return (
        <svg {...comun}>
          <circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" />
          <path d="M2 3h3l2.5 12h11L21 7H6" />
        </svg>
      );
    default:            // moneda con estrella, para Puntos
      // La estrella va RELLENA y no en trazo: a 12px un contorno de 2px dentro de
      // un círculo se empasta y no se lee como estrella.
      return (
        <svg {...comun}>
          <circle cx="12" cy="12" r="9" />
          <path fill={color} stroke="none"
                d="M12 7.8 13.12 10.46 15.99 10.7 13.81 12.59 14.47 15.4 12 13.9 9.53 15.4 10.19 12.59 8.01 10.7 10.88 10.46Z" />
        </svg>
      );
  }
}

/**
 * Paleta apagada, en el tono del resto del dashboard.
 *
 * SuperCard es morado medio (#9575cd). Se probaron antes azul y mostaza: el
 * mostaza claro no pasaba el contraste contra el blanco (2,0 y 2,4 contra un
 * mínimo de 3) y el azul chocaba con el violeta de SaaS.
 *
 * Por eso SaaS quedó en OCRE y no en violeta: dos morados juntos son el par que se
 * hunde —para un daltónico, apagados, son el mismo color— y el ocre se separa por
 * el eje azul-amarillo, el único que sobrevive a la deuteranopía.
 *
 * Verificada con simulación de deuteranopía: peor par ΔE 14,8 (piso 12), los cinco
 * sobre 3:1 de contraste. Las dos tarjetas, que comparten ícono, quedan en ΔE 59.
 */
const MIX_PRODUCTO = [
  { campo: 'pctPuntos'      as const, label: 'Puntos',      corto: 'Puntos',    color: '#0e9fac' },
  { campo: 'pctGiftcard'    as const, label: 'Gift Card',   corto: 'Gift Card', color: '#d4707f' },
  { campo: 'pctSaas'        as const, label: 'SaaS',        corto: 'SaaS',      color: '#b8873f' },
  { campo: 'pctSupercard'   as const, label: 'SuperCard',   corto: 'SC',        color: '#9575cd' },
  { campo: 'pctMarketplace' as const, label: 'Marketplace', corto: 'Market',    color: '#6b7683' },
];

/** Etiqueta breve del producto; cae al nombre completo si no está mapeado. */
function cortoDe(nombre: string) {
  return MIX_PRODUCTO.find(p => p.label === nombre)?.corto ?? nombre;
}

function MixProducto({ c }: { c: ClienteTabla }) {
  const partes = MIX_PRODUCTO
    .map(p => ({ ...p, pct: (Number(c[p.campo]) || 0) * 100 }))
    .filter(p => p.pct > 0)
    .sort((a, b) => b.pct - a.pct);

  if (partes.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {partes.map(p => (
        <span
          key={p.campo}
          title={`${p.label}: ${p.pct.toFixed(1)}% del monto`}
          aria-label={`${p.label} ${p.pct.toFixed(0)} por ciento`}
          className="inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 border"
          style={{ background: `${p.color}14`, borderColor: `${p.color}33` }}
        >
          <IconoProducto tipo={p.label} color={p.color} />
          <span className="text-[10px] font-semibold tabular-nums" style={{ color: p.color }}>
            {p.pct.toFixed(0)}%
          </span>
        </span>
      ))}
    </div>
  );
}

/** Color de una dimensión del score: 1 es malo y 4 es bueno. */
function wColorDim(v: number) {
  // Mismos cortes que tenía el bloque de tres filas que esto reemplazó, para que
  // un valor no cambie de color solo por haber compactado la vista.
  return v >= 3.5 ? '#16a34a' : v >= 3.0 ? '#ca8a04' : v >= 2.0 ? '#ea580c' : '#dc2626';
}

const MESES_INI = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MESES_NOM = ['enero','febrero','marzo','abril','mayo','junio',
                   'julio','agosto','septiembre','octubre','noviembre','diciembre'];

/**
 * Mezcla de producto por año, en barras horizontales apiladas.
 *
 * Complementa el mapa de calor sin repetirlo: el mapa dice CUÁNDO compra, esto
 * dice QUÉ compra y cómo se movió. La pregunta que responde es "¿está migrando de
 * producto?", que es la señal comercial que no se ve en ningún otro lugar de la
 * ficha.
 *
 * EL LARGO DE LA BARRA ES EL MONTO DEL AÑO, relativo al mejor año del cliente. Si
 * todas las barras fueran del mismo largo, un año de USD 5.000 se vería igual que
 * uno de USD 200.000 y la migración se leería fuera de escala. El año en curso
 * queda naturalmente más corto porque todavía no termina.
 *
 * Los colores son los MISMOS que la barra del encabezado a propósito: es la misma
 * variable, y usar otra paleta obligaría a aprender dos.
 */
function MixPorAnio({ c }: { c: ClienteTabla }) {
  const { anios, productos, isLoading, error } = useActividad(c.pais, c.panelId, true);
  const conProd = anios.filter(a => a.prod.some(v => v > 0));

  // Mismo criterio que el mapa de calor: decir qué pasa en vez de desaparecer.
  if (isLoading || error || conProd.length === 0) {
    return (
      <div className="px-5 py-4 border-b border-slate-200">
        <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1.5">
          Producto por año
        </p>
        <p className="text-[11px] text-slate-400">
          {isLoading ? 'Cargando…'
            : error   ? 'No se pudo cargar el desglose por producto.'
                      : 'Sin desglose de producto disponible.'}
        </p>
      </div>
    );
  }

  // Se mapea por nombre y no por posición para que agregar un producto en el GAS
  // no repinte todo: el color sigue al producto, nunca al índice.
  const colorDe = (nombre: string) =>
    MIX_PRODUCTO.find(p => p.label === nombre)?.color ?? '#94a3b8';

  const maxAnual = Math.max(...conProd.map(a => a.totalUsd), 1);

  return (
    <div className="px-5 py-4 border-b border-slate-200">
      <div className="flex items-baseline justify-between gap-3 mb-2.5">
        <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">
          Producto por año
        </p>
        <span className="text-[10px] text-slate-400">largo = monto del año</span>
      </div>

      <div className="space-y-2">
        {conProd.map(a => {
          const total = a.prod.reduce((s, v) => s + v, 0) || 1;
          const anchoAnio = Math.max(6, (a.totalUsd / maxAnual) * 100);
          return (
            <div key={a.anio} className="flex items-center gap-2">
              <span className="w-8 flex-shrink-0 text-[10px] font-semibold text-slate-600 tabular-nums">
                {a.anio}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex h-4 rounded-md overflow-hidden bg-slate-100"
                     style={{ width: `${anchoAnio}%` }}>
                  {a.prod.map((usd, i) => usd > 0 && (
                    <div key={i}
                         style={{ width: `${(usd / total) * 100}%`, background: colorDe(productos[i] ?? '') }}
                         title={`${productos[i] ?? ''} ${a.anio}: ${fmtUSD(usd)} · ${((usd / total) * 100).toFixed(0)}%`} />
                  ))}
                </div>
              </div>
              {/* El monto vuelve acá: el encabezado dice "largo = monto del año"
                  pero sin el número había que ir al mapa de calor para saber
                  cuánto era. Va el monto y no el producto dominante, que ya está
                  en la leyenda. */}
              <span className="w-14 flex-shrink-0 text-right text-[10px] font-semibold text-slate-600 tabular-nums">
                {fmtUSD(a.totalUsd)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Leyenda con los productos que este cliente realmente tiene. Sin esto el
          color de cada tramo no se puede nombrar: la etiqueta de la derecha dice
          solo el dominante, así que un tramo de SuperCard se veía sin poder
          saber qué era. */}
      <div className="flex items-center gap-2.5 mt-2.5 pl-10 flex-wrap">
        {productos
          .map((nombre, i) => ({
            nombre,
            usd: conProd.reduce((sum, a) => sum + (a.prod[i] ?? 0), 0),
          }))
          .filter(x => x.usd > 0)
          .sort((a, b) => b.usd - a.usd)
          .map(x => (
            <span key={x.nombre} className="flex items-center gap-1" title={x.nombre}>
              <IconoProducto tipo={x.nombre} color={colorDe(x.nombre)} />
              <span className="text-[9px] text-slate-500">{cortoDe(x.nombre)}</span>
            </span>
          ))}
      </div>
    </div>
  );
}

/**
 * Mapa de calor de actividad: una fila por año, doce celdas por mes.
 *
 * DOS VARIABLES EN UNA CELDA, en canales que no compiten:
 *
 *   color   = % del monto del año que cayó en ese mes  → dónde está el peso
 *   número  = transacciones de ese mes                 → cuántas veces compró
 *
 * Se hizo así porque las dos preguntas son distintas y ninguna reemplaza a la
 * otra: un mes con UNA venta puede ser el 40% del año, y un mes con OCHO ventas
 * chicas puede ser el 3%. Con un solo canal había que elegir cuál mentir.
 *
 * El color va por PORCENTAJE y no por monto absoluto para que sea comparable
 * entre clientes: USD 50.000 es un mes enorme para uno y rutina para otro, pero
 * "el 35% de su año" significa lo mismo en las dos fichas.
 *
 * Los cortes están anclados en el reparto parejo: doce meses iguales dan 8,3%
 * cada uno. Entonces por debajo de 5% es un mes flojo, alrededor de 8% es
 * normal, y del 20% para arriba el mes concentra plata de verdad.
 *
 * El número va en TEXTO y no en tamaño de celda ni en otro color: es un dato
 * exacto y chico (la mediana es 1 transacción por mes), y cualquier codificación
 * gráfica lo volvería a hacer ambiguo.
 */
function MapaCalor({ c }: { c: ClienteTabla }) {
  const { anios, isLoading, error } = useActividad(c.pais, c.panelId, true);

  // Nunca devolver null en silencio: si la hoja falla o el cliente no tiene
  // actividad, el bloque desaparecía sin explicación y parecía un bug del panel.
  // Pasó de verdad: con la hoja recién creada, react-query cachea el error 30
  // minutos y el mapa no aparecía sin ningún mensaje.
  if (isLoading || error || anios.length === 0) {
    return (
      <div className="px-5 py-4 border-b border-slate-200">
        <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1.5">
          Actividad por mes
        </p>
        <p className="text-[11px] text-slate-400">
          {isLoading ? 'Cargando actividad…'
            : error   ? 'No se pudo cargar la actividad. Recargá la página.'
                      : 'Sin actividad registrada desde 2024.'}
        </p>
      </div>
    );
  }

  // Escala por share del año. `tinta` es el color del número: sobre los dos tonos
  // oscuros el slate no se lee.
  const ESCALA = [
    { hasta: 0,        color: '#f1f5f9', tinta: '#cbd5e1', label: 'sin compra' },
    { hasta: 5,        color: '#cbf1f6', tinta: '#334155', label: '<5%'   },
    { hasta: 10,       color: '#80deea', tinta: '#334155', label: '5-10%' },
    { hasta: 20,       color: '#26c6da', tinta: '#0f172a', label: '10-20%'},
    { hasta: 35,       color: '#0097A7', tinta: '#ffffff', label: '20-35%'},
    { hasta: Infinity, color: '#00636e', tinta: '#ffffff', label: '35%+'  },
  ];
  const nivel = (pct: number) => ESCALA.find(e => pct <= e.hasta) ?? ESCALA[ESCALA.length - 1];

  return (
    <div className="px-5 py-4 border-b border-slate-200">
      <div className="flex items-baseline justify-between gap-3 mb-2.5">
        <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">
          Actividad por mes
        </p>
        <span className="text-[10px] text-slate-400">color = peso · nº = transacciones</span>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-8 flex-shrink-0" />
          <div className="grid grid-cols-12 gap-1 flex-1">
            {MESES_INI.map((m, i) => (
              <span key={i} className="text-[8px] text-slate-400 text-center leading-none">{m}</span>
            ))}
          </div>
          <span className="w-14 flex-shrink-0" />
        </div>

        {anios.map(a => (
          <div key={a.anio} className="flex items-center gap-2">
            <span className="w-8 flex-shrink-0 text-[10px] font-semibold text-slate-600 tabular-nums">
              {a.anio}
            </span>
            <div className="grid grid-cols-12 gap-1 flex-1">
              {a.trx.map((n, i) => {
                const usd = a.usd[i] ?? 0;
                // Share del monto del año. Si el año no tiene monto pero sí
                // transacciones (ventas en 0), el share es 0 y manda el número.
                const pct = a.totalUsd > 0 ? (usd / a.totalUsd) * 100 : 0;
                const e = n > 0 ? nivel(pct) : ESCALA[0];
                return (
                  <div
                    key={i}
                    className="h-7 rounded-[5px] flex items-center justify-center"
                    style={{ background: e.color }}
                    title={n > 0
                      ? `${MESES_NOM[i]} ${a.anio}: ${n} ${n === 1 ? 'transacción' : 'transacciones'}`
                        + ` · ${fmtUSD(usd)} · ${pct.toFixed(0)}% del año`
                      : `${MESES_NOM[i]} ${a.anio}: sin compras`}
                  >
                    {n > 0 && (
                      <span className="text-[9px] font-bold tabular-nums leading-none"
                            style={{ color: e.tinta }}>{n}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <span className="w-14 flex-shrink-0 text-right text-[10px] font-semibold text-slate-600 tabular-nums">
              {fmtUSD(a.totalUsd)}
            </span>
          </div>
        ))}
      </div>

      {/* Leyenda: sin esto el tono no se traduce a nada y hay que pasar el mouse
          por cada celda. El "% del año" es lo que el color codifica. */}
      <div className="flex items-center gap-1.5 mt-2.5 pl-10 flex-wrap">
        <span className="text-[9px] text-slate-400 mr-0.5">% del año</span>
        {ESCALA.slice(1).map(e => (
          <span key={e.label} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-[3px] inline-block" style={{ background: e.color }} />
            <span className="text-[9px] text-slate-500 tabular-nums">{e.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function DetailPanel({ c, historial, scores, onClose }: { c: ClienteTabla; historial: HistorialMap | undefined; scores?: ScoresChurnMap; onClose: () => void }) {
  const cc = FLAG_CC[c.pais];
  const color = SEG_COLOR[c.segmento] || '#9ca3af';
  // Antes buscaba por idTributario, que solo coincide con la col "Panel ID" de
  // Historial en 753 de 1.706 clientes (Perú y Colombia usan un correlativo
  // distinto del RUC): al 56% restante le salía "Sin historial semanal aún"
  // teniéndolo. La clave real es (pais, panelId).
  const hist = historial?.get(histKey(c.pais, c.panelId)) ?? [];
  const scoreHistory = hist.map(h => h.score);
  const semanaLabels = hist.map(h => h.semana.replace(/^\d{4}-/, ''));

  return (
    <div className="flex flex-col h-full">
      {/* Header. Segmento, estado y ejecutivo pasaron ACÁ, en la misma fila que
          el nombre: antes ocupaban un bloque propio debajo y comían el alto que
          ahora queda libre para el mapa de calor. */}
      <div className="px-5 pt-4 pb-4 border-b border-slate-200 bg-slate-50/80">
        <div className="flex items-start gap-4">
          {/* Identidad */}
          <div className="min-w-0 flex-1">
            {/* Los chips de producto van EN LA MISMA LÍNEA que el nombre: abajo
                sumaban un tercer renglón al encabezado y empujaban el resto. Con
                flex-wrap bajan solos si el nombre es largo. */}
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-slate-800 leading-snug">{c.nombre}</h2>
              <MixProducto c={c} />
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {cc && <img src={`https://flagcdn.com/16x12/${cc}.png`} width={14} height={10} alt={c.pais} className="rounded-sm flex-shrink-0" />}
              <span className="text-xs text-slate-500">{c.pais}</span>
              <span className="text-slate-300 select-none">·</span>
              <TipoBadge tipo={c.tipo} />
              {c.idTributario && (
                <>
                  <span className="text-slate-300 select-none">·</span>
                  <span className="text-[10px] text-slate-400 font-mono">{c.idTributario}</span>
                </>
              )}
              {/* Última compra en el encabezado. Los días sin comprar ya están más
                  abajo, pero son una cuenta relativa: "250d" no dice desde cuándo,
                  y para llamar a un cliente la fecha concreta es lo que se cita. */}
              {c.ultimaCompra && (
                <>
                  <span className="text-slate-300 select-none">·</span>
                  <span className="text-[10px] text-slate-500">
                    últ. compra <span className="font-semibold">{fmtFechaLarga(c.ultimaCompra)}</span>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Bloque derecho: un solo strip de indicadores en vez de tres cajas
              sueltas. Con la prob. de fuga sumada eran cuatro bloques de anchos
              distintos y el encabezado se veía desalineado; ahora cada celda
              comparte la misma estructura (rótulo arriba, valor abajo) y se
              separan con una línea, así el ojo las lee como una fila. */}
          <div className="flex items-start gap-3 flex-shrink-0">
            {/* Segmento */}
            <div
              className="w-11 h-11 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
              style={{ background: `${color}22`, border: `1.5px solid ${color}55` }}
            >
              {/* Solo la letra: el score de segmentación no se muestra fuera de
                  la vista de Segmentación. El número que importa acá es el churn. */}
              <span className="text-lg font-extrabold leading-none" style={{ color }}>{c.segmento}</span>
              <span className="text-[6px] font-bold uppercase tracking-wide leading-none mt-0.5" style={{ color, opacity: 0.75 }}>
                segmento
              </span>
            </div>

            {/* Estado + score de churn */}
            <div className="min-w-0 flex-shrink-0 border-l border-slate-200 pl-3">
              <p className="text-[9px] text-slate-500 uppercase tracking-wide font-semibold whitespace-nowrap">
                Estado · Score {c.tipo === 'estacional' || c.tipo === 'primera_compra' ? 'VENT' : 'RENT'}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <RiesgoPill status={c.status} />
                {getScoreChurn(c, scores) !== null
                  ? <span className="text-sm font-bold tabular-nums text-slate-700">{getScoreChurn(c, scores)!.toFixed(2)}</span>
                  : <span className="text-[10px] text-slate-400">sin score</span>}
              </div>
            </div>

            {/* Prob. de fuga (modelo ML). Solo existe para parte de la cartera, así
                que el caso "sin dato" tiene que ser explícito: en blanco parecería
                riesgo cero, que es lo contrario de no haber sido evaluado. */}
            <div className="min-w-0 flex-shrink-0 border-l border-slate-200 pl-3">
              <p className="text-[9px] text-slate-500 uppercase tracking-wide font-semibold whitespace-nowrap">
                Prob. Fuga
              </p>
              <div className="mt-1.5">
                {c.probRiesgo == null
                  ? <span className="text-[10px] text-slate-400" title="El modelo de fuga no calculó este cliente">sin dato</span>
                  : (() => {
                      const pct = Math.round(c.probRiesgo * 100);
                      return (
                        <span className={`text-sm font-bold tabular-nums ${tonoFuga(pct)}`}
                              title={`Probabilidad de fuga estimada por el modelo ML${c.tipoPrediccion ? ` (${c.tipoPrediccion})` : ''}`}>
                          {pct}%
                        </span>
                      );
                    })()}
              </div>
            </div>

            {/* Ejecutivo */}
            <div className="min-w-0 max-w-[130px] flex-shrink-0 border-l border-slate-200 pl-3">
              <p className="text-[9px] text-slate-500 uppercase tracking-wide font-semibold">Ejecutivo</p>
              <p className="text-sm font-semibold text-slate-700 mt-1.5 truncate leading-tight" title={c.kam}>{c.kam || '—'}</p>
            </div>
          </div>

          <button onClick={onClose}
                  aria-label="Cerrar detalle"
                  className="grid place-items-center w-10 h-10 sm:block sm:w-auto sm:h-auto text-slate-400 hover:text-slate-600 text-lg leading-none flex-shrink-0">✕</button>
        </div>
      </div>

      {/* Dos columnas: el overlay es ancho, así que apilar todo en vertical
          obligaba a scrollear para ver lo de abajo. Izquierda = el estado del
          cliente (score, ejecutivo, volúmenes, dimensiones); derecha = lo que se
          consulta para actuar (evolución, contactos, últimas ventas). */}
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x divide-slate-200
                      min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
      {/* La columna izquierda va con fondo: con todo en blanco el panel se leía
          como una sola mancha y no se distinguían los bloques. */}
      <div className="min-w-0 lg:overflow-y-auto bg-slate-50/60">

      {/* Score + KAM */}
      {/* Métricas */}
      <div className="px-5 py-4 border-b border-slate-200 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">Vol. 6M Actual</p>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <p className="text-sm font-bold text-slate-700 tabular-nums">{fmtUSD(c.monto6mAct)}</p>
            {/* La variación contra el semestre anterior, explícita. Antes había que
                restar dos números de cabeza para ver que el cliente se cayó, y esa
                caída es lo primero que hay que notar en la ficha. */}
            {(() => {
              const ant = c.monto6mAnt, act = c.monto6mAct;
              if (!(ant > 0)) return null;
              const d = ((act - ant) / ant) * 100;
              if (Math.abs(d) < 1) return null;
              return (
                <span className={`text-[10px] font-bold tabular-nums ${d < 0 ? 'text-red-500' : 'text-emerald-600'}`}
                      title={`Contra el mismo semestre del año anterior: ${fmtUSD(ant)}`}>
                  {d > 0 ? '+' : ''}{d.toFixed(0)}%
                </span>
              );
            })()}
          </div>
        </div>
        <div>
          {/* "Año ant." y no "Anterior": desde el 2026-08-20 es el MISMO semestre
              del año pasado, no el semestre inmediatamente previo. Sin cambiar la
              etiqueta, el número diría una cosa y el nombre otra. */}
          <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold" title="Mismo semestre del año anterior">Vol. 6M Año Ant.</p>
          <p className={`text-sm font-bold tabular-nums mt-0.5 ${c.monto6mAct < c.monto6mAnt ? 'text-red-500' : 'text-slate-700'}`}>
            {fmtUSD(c.monto6mAnt)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">Días s/compra</p>
          <p className={`text-sm font-bold tabular-nums mt-0.5 ${
            c.diasSinCompra > 180 ? 'text-red-500' : c.diasSinCompra > 90 ? 'text-amber-500' : 'text-slate-700'
          }`}>{c.diasSinCompra > 0 ? `${c.diasSinCompra}d` : '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">Facturas totales</p>
          <p className="text-sm font-bold text-slate-700 tabular-nums mt-0.5">{c.totalFacturas}</p>
        </div>
      </div>

      <MapaCalor c={c} />
      <MixPorAnio c={c} />

      {/* Dimensiones del score, en una sola línea.
          Antes esto eran tres filas apiladas más un párrafo de tres líneas
          explicando la diferencia entre VENT y el score de churn de arriba, y se
          comía el alto de la columna. La explicación no se borró: quedó en el
          tooltip del título, que es donde se busca cuando surge la duda. */}
      {(() => {
        const est = c.tipo === 'estacional' || c.tipo === 'primera_compra';
        // Cada inicial con su definición en pocas palabras. Van acá y no en un
        // texto fijo porque son cuatro conceptos que se consultan una vez: el
        // tooltip es el lugar donde se busca la duda, no la vista permanente.
        const dims = est
          ? [{ ini: 'V', nombre: 'Vigencia',   que: 'su volumen frente al resto de los estacionales', val: c.fVig },
             { ini: 'E', nombre: 'Engagement', que: 'uso de la plataforma',                           val: c.fEng },
             { ini: 'T', nombre: 'Tendencia',  que: 'sus últimos 6 meses contra los 6 anteriores',    val: c.fTen }]
          : [{ ini: 'R', nombre: 'Recencia',   que: 'hace cuánto compró, medido contra su propio ciclo', val: c.fRec },
             { ini: 'E', nombre: 'Engagement', que: 'uso de la plataforma',                             val: c.fEng },
             { ini: 'T', nombre: 'Tendencia',  que: 'sus últimos 6 meses contra los 6 anteriores',      val: c.fTen }];
        const glosario = dims.map(d => `${d.ini} · ${d.nombre}: ${d.que}`).join('\n');
        // VENT y no VENT: es la forma análoga a RENT —Recencia+ENgagement+Tendencia
        // frente a Vigencia+ENgagement+Tendencia— y es la que ya usa el encabezado
        // de esta misma ficha y la columna RENT/VENT de la tabla. "VENT" se cuela en
        // otras partes del proyecto y deja la E de Engagement fuera de la sigla.
        const modelo = est ? 'VENT' : 'RENT';
        return (
          <div className="px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <span
                className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 cursor-help"
                // El acrónimo lleva N por eNgagement, pero el chip dice E. Sin
                // explicarlo, la sigla y las letras de al lado no se corresponden.
                title={(est
                  ? 'VENT = Vigencia + ENgagement + Tendencia — el score de los estacionales.\n'
                  : 'RENT = REcencia + ENgagement + Tendencia — el score de los recurrentes.\n')
                  + glosario
                  + '\n\nCada una va de 1 (mal) a 4 (bien).'
                  + (est ? '\nUsa Vigencia en lugar de Recencia, así que difiere del score del encabezado.' : '')}
              >
                {modelo} ⓘ
              </span>
              <div className="flex items-center gap-2">
                {/* Las tres SIEMPRE se dibujan. Antes se filtraban las que valían 0
                    y el chip desaparecía: en una fila horizontal quedaba "V T" y
                    parecía que faltaba una dimensión del modelo, no que ese
                    cliente no tuviera el dato. */}
                {dims.map(d => (
                  <span key={d.ini}
                        title={`${d.nombre} — ${d.que}\n${d.val > 0 ? d.val.toFixed(1) + ' de 4' : 'sin dato'}`}
                        className="inline-flex items-baseline gap-1 rounded-md bg-slate-100 px-1.5 py-0.5">
                    <span className="text-[9px] font-bold text-slate-400">{d.ini}</span>
                    {d.val > 0
                      ? <span className="text-[11px] font-bold tabular-nums"
                              style={{ color: wColorDim(d.val) }}>{d.val.toFixed(1)}</span>
                      : <span className="text-[11px] font-bold text-slate-300">—</span>}
                  </span>
                ))}
                {c.scoreEng > 0 && c.scoreEst > 0 && (
                  <span className="text-[10px] text-slate-400 ml-1">
                    = <span className="font-bold text-slate-700 tabular-nums">{c.scoreEng.toFixed(2)}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      </div>{/* fin columna izquierda */}
      <div className="min-w-0 lg:overflow-y-auto">

      {/* Histórico de score */}
      {scoreHistory.length >= 2 && (
        <div className="px-5 pb-5">
          <div className="h-px bg-slate-100 mb-4" />
          <SparklinePanel
            data={scoreHistory}
            labels={semanaLabels}
            color={color}
            title="Evolución del score"
          />
          {hist.length > 0 && (
            <div className="mt-3">
              <div className="tabla-scroll">
                <table className="w-full text-[10px] tabla-apilable">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100">
                      <th className="text-left pb-1 font-semibold">Semana</th>
                      <th className="text-right pb-1 font-semibold">Score</th>
                      <th className="text-right pb-1 font-semibold">Rec</th>
                      <th className="text-right pb-1 font-semibold">Eng</th>
                      <th className="text-right pb-1 font-semibold">Ten</th>
                      <th className="text-right pb-1 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...hist].reverse().map((h, i) => (
                      <tr key={i} className="border-b border-slate-50 last:border-0">
                        <td data-titular className="py-1 text-slate-400">{h.semana.replace(/^\d{4}-/, '')}</td>
                        <td data-label="Score" className="py-1 text-right font-bold tabular-nums" style={{ color }}>{h.score.toFixed(2)}</td>
                        <td data-label="Rec" className="py-1 text-right tabular-nums text-slate-500">{h.fRec.toFixed(1)}</td>
                        <td data-label="Eng" className="py-1 text-right tabular-nums text-slate-500">{h.fEng.toFixed(1)}</td>
                        <td data-label="Ten" className="py-1 text-right tabular-nums text-slate-500">{h.fTen.toFixed(1)}</td>
                        <td data-label="Status" className="py-1 text-right text-slate-400">{h.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
      {scoreHistory.length < 2 && (
        <div className="px-5 pb-5">
          <div className="h-px bg-slate-100 mb-4" />
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-[11px] text-slate-500 space-y-1.5">
            <p className="font-semibold text-slate-600">Sin historial semanal aún</p>
            {c.tipo === 'primera_compra' && (
              <p>Este cliente es de <span className="font-medium">primera compra</span>. El historial semanal se acumula solo para recurrentes y estacionales; aparecerá aquí cuando cambie de categoría.</p>
            )}
            {c.tipo === 'perdido_historico' && (
              <p>Este cliente está en <span className="font-medium">perdido histórico</span>. No compra desde hace más de 12 meses, por lo que no se genera score semanal.</p>
            )}
            {(c.tipo === 'recurrente' || c.tipo === 'estacional') && (
              <p>El seguimiento semanal arrancó en jun 2026 y aún no hay suficientes semanas registradas para este cliente. Se acumulará automáticamente en las próximas semanas.</p>
            )}
          </div>
        </div>
      )}

      <Contactos c={c} />
      <Transacciones c={c} />

      </div>{/* fin columna derecha */}
      </div>{/* fin grilla */}
    </div>
  );
}

// ── SegmentacionPage ──────────────────────────────────────────────────────────

export type CambioStatus = 'todos' | 'mejoraron' | 'empeoraron' | 'cualquiera';

/**
 * Severidad del status, de mejor a peor. Un cliente "mejoró" si su severidad
 * baja entre las dos últimas semanas del Historial, y "empeoró" si sube. Es la
 * misma escala que usa el Movimiento de cartera del Overview.
 */
const SEVERIDAD: Record<string, number> = {
  saludable: 0, monitorear: 1, en_riesgo: 2, critico: 3,
};

interface SegmentacionPageProps {
  filterKam?: string;
  filterPais?: string;
  embedded?: boolean;
  /** Preselección al llegar desde "Movimiento de cartera" del Overview */
  presetCambio?: CambioStatus;
}

/**
 * Dos barras de scroll horizontal sincronizadas para la misma tabla.
 *
 * La tabla es alta: con una sola barra —la del propio contenedor, abajo— hay que
 * bajar hasta el final de la página para mover las columnas y volver a subir.
 * Esto agrega una barra gemela ARRIBA y las mantiene en sincronía.
 *
 * El ancho del espaciador se mide del contenedor real (`scrollWidth`) y no se
 * hardcodea: si un nombre largo estira la tabla más allá del min-w, la barra de
 * arriba tiene que estirarse igual o se desincroniza al final del recorrido.
 */
function useScrollGemelo() {
  const arribaRef = useRef<HTMLDivElement>(null);
  const tablaRef  = useRef<HTMLDivElement>(null);
  const [ancho, setAncho]        = useState(0);
  const [desborda, setDesborda]  = useState(false);
  // Evita el bucle: al fijar scrollLeft en el gemelo se dispara SU evento scroll,
  // que volvería a fijar el del origen.
  const sincronizando = useRef(false);

  // Sin array de deps a propósito, pero con salida temprana barata: el contenedor
  // no existe en los primeros renders (la página devuelve antes por isLoading), y
  // con [] el efecto no volvería a correr cuando por fin aparece. `montado` evita
  // recrear el ResizeObserver en cada render posterior.
  const montado = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = tablaRef.current;
    if (!el || montado.current === el) return;
    montado.current = el;
    const medir = () => {
      setAncho(el.scrollWidth);
      setDesborda(el.scrollWidth > el.clientWidth + 1);
    };
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    const t = el.querySelector('table');
    if (t) ro.observe(t);
    return () => { ro.disconnect(); montado.current = null; };
  });

  const espejar = useCallback((origen: 'arriba' | 'tabla') => {
    if (sincronizando.current) return;
    const a = arribaRef.current, t = tablaRef.current;
    if (!a || !t) return;
    sincronizando.current = true;
    if (origen === 'arriba') t.scrollLeft = a.scrollLeft;
    else                     a.scrollLeft = t.scrollLeft;
    // rAF y no 0ms: el reset tiene que ocurrir después de que el navegador
    // despache el scroll del gemelo, no antes.
    requestAnimationFrame(() => { sincronizando.current = false; });
  }, []);

  return { arribaRef, tablaRef, ancho, desborda, espejar };
}

export function SegmentacionPage({ filterKam, filterPais, embedded, presetCambio }: SegmentacionPageProps = {}) {
  const { data, isLoading, isError, error } = useTablaClientes();
  const { data: historialMap } = useHistorial();
  const { data: scoresChurn } = useScoresChurn();

  const [busquedaNombre, setBusquedaNombre]   = useState('');
  const [busquedaKam, setBusquedaKam]         = useState(filterKam ?? '');
  const [segFiltro, setSegFiltro]             = useState<'todos' | SegmentoCliente>('todos');
  const [tipoFiltro, setTipoFiltro]           = useState<'todos' | TipoCliente>('todos');
  const [paisFiltro, setPaisFiltro]           = useState<string>(filterPais ?? 'todos');
  const [selected, setSelected]               = useState<ClienteTabla | null>(null);
  const { track } = useTrack();
  const [pagina, setPagina]                   = useState(0);
  const [mostrarOtros, setMostrarOtros]       = useState(false);
  const [mostrarPerdidos, setMostrarPerdidos] = useState(false);
  const [cambioFiltro, setCambioFiltro]       = useState<CambioStatus>(presetCambio ?? 'todos');
  // Dotación: productos de Colombia con esa palabra en PRODUCTO. Es un filtro de
  // VISTA — acota qué clientes se listan y no toca montos ni score.
  const [dotacionFiltro, setDotacionFiltro]   = useState<'todos' | 'con' | 'sin'>('todos');
  const { arribaRef, tablaRef, ancho, desborda, espejar } = useScrollGemelo();

  // El chip de dotación solo se dibuja si hay algo que filtrar en el país que se
  // está mirando: hoy los productos son exclusivos de Colombia y en Chile o Perú
  // el control sería un botón muerto.
  const hayDotacion = useMemo(
    () => (data ?? []).some(c => c.usdDotacion > 0 && (paisFiltro === 'todos' || mismoPais(c.pais, paisFiltro))),
    [data, paisFiltro],
  );

  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPagina(0);
  }

  const totalConPerdidos = data?.length ?? 0;
  const totalSinPerdidos = useMemo(() => (data ?? []).filter(c => c.tipo !== 'perdido_historico').length, [data]);

  const kamsUnicos = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.map(c => c.kam).filter(Boolean))].sort();
  }, [data]);

  const paisesUnicos = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.map(c => c.pais))].sort();
  }, [data]);

  /**
   * Cambio de status entre las dos últimas semanas registradas, por cliente.
   * El Historial guarda un snapshot semanal; comparando las dos últimas entradas
   * se sabe quién mejoró y quién empeoró — el mismo dato que resume el
   * "Movimiento de cartera" del Overview, pero cliente por cliente.
   */
  const cambios = useMemo(() => {
    const m = new Map<string, { dir: 'mejoro' | 'empeoro'; de: string; a: string; semana: string }>();
    if (!historialMap) return m;
    historialMap.forEach((entries, key) => {
      if (entries.length < 2) return;
      const act = entries[entries.length - 1];
      const ant = entries[entries.length - 2];
      const sa = SEVERIDAD[act.status], sn = SEVERIDAD[ant.status];
      if (sa == null || sn == null || sa === sn) return;
      m.set(key, { dir: sa < sn ? 'mejoro' : 'empeoro', de: ant.status, a: act.status, semana: act.semana });
    });
    return m;
  }, [historialMap]);

  const ultimaSemana = useMemo(() => {
    let s = '';
    cambios.forEach(c => { if (c.semana > s) s = c.semana; });
    return s;
  }, [cambios]);

  const filtrados = useMemo(() => {
    if (!data) return [];
    const nq = busquedaNombre.trim().toLowerCase();
    const kq = busquedaKam.trim().toLowerCase();
    return data.filter(c => {
      if (!mostrarOtros && /^otros$/i.test(c.kam.trim())) return false;
      if (!mostrarPerdidos && c.tipo === 'perdido_historico') return false;
      if (nq && !c.nombre.toLowerCase().includes(nq)) return false;
      if (kq && !c.kam.toLowerCase().includes(kq)) return false;
      if (segFiltro !== 'todos' && c.segmento !== segFiltro) return false;
      if (tipoFiltro !== 'todos' && c.tipo !== tipoFiltro) return false;
      if (dotacionFiltro === 'con' && !(c.usdDotacion > 0)) return false;
      if (dotacionFiltro === 'sin' &&   c.usdDotacion > 0)  return false;
      if (paisFiltro !== 'todos' && !mismoPais(c.pais, paisFiltro)) return false;
      if (cambioFiltro !== 'todos') {
        const ch = cambios.get(histKey(c.pais, c.panelId));
        if (!ch) return false;
        if (cambioFiltro === 'mejoraron'  && ch.dir !== 'mejoro')  return false;
        if (cambioFiltro === 'empeoraron' && ch.dir !== 'empeoro') return false;
      }
      return true;
    });
  }, [data, busquedaNombre, busquedaKam, segFiltro, tipoFiltro, paisFiltro, mostrarOtros, mostrarPerdidos, cambioFiltro, dotacionFiltro, cambios]);

  const ordenados = useMemo(() => {
    const arr = [...filtrados];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'nombre':       return dir * a.nombre.localeCompare(b.nombre, 'es');
        case 'score':        return dir * ((getScoreChurn(a, scoresChurn) ?? -1) - (getScoreChurn(b, scoresChurn) ?? -1));
        case 'diasSinCompra': return dir * (a.diasSinCompra - b.diasSinCompra);
        case 'ultimaCompra': {
          const toTs = (s: string) => {
            const [d, m, y] = (s || '').split('/');
            return d && m && y ? new Date(+y, +m - 1, +d).getTime() : 0;
          };
          return dir * (toTs(a.ultimaCompra) - toTs(b.ultimaCompra));
        }
        case 'dotacion':     return dir * (a.usdDotacion - b.usdDotacion);
        case 'tendencia': {
          const da = a.monto6mAnt > 0 ? (a.monto6mAct - a.monto6mAnt) / a.monto6mAnt : 0;
          const db = b.monto6mAnt > 0 ? (b.monto6mAct - b.monto6mAnt) / b.monto6mAnt : 0;
          return dir * (da - db);
        }
        default: return 0;
      }
    });
    return arr;
  }, [filtrados, sortKey, sortDir, scoresChurn]);

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas - 1);
  const visibles = ordenados.slice(paginaActual * POR_PAGINA, (paginaActual + 1) * POR_PAGINA);

  function resetPagina() {
    setPagina(0);
    setSelected(null);
  }

  const hasPanel = selected !== null;

  // Escape cierra el detalle. Es lo que espera cualquiera frente a un panel
  // flotante, y acá importa más que en un modal: sin backdrop no hay "afuera"
  // donde hacer clic para salir.
  useEffect(() => {
    if (!hasPanel) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasPanel]);

  const SEG_OPTS: { value: 'todos' | SegmentoCliente; label: string }[] = [
    { value: 'todos', label: 'Todos' },
    { value: 'A+',    label: 'A+' },
    { value: 'A',     label: 'A' },
    { value: 'B',     label: 'B' },
    { value: 'C',     label: 'C' },
  ];

  const TIPO_OPTS: { value: 'todos' | TipoCliente; label: string }[] = [
    { value: 'todos',             label: 'Todos' },
    { value: 'estacional',        label: 'Estacional' },
    { value: 'primera_compra',    label: '1ra Compra' },
    { value: 'recurrente',        label: 'Recurrente' },
    { value: 'perdido_historico', label: 'Perdido' },
  ];

  if (isLoading) return (
    <div className="p-6 flex flex-col gap-3">
      <div className="h-12 bg-slate-100 rounded-2xl animate-pulse" />
      <div className="h-[calc(100vh-160px)] bg-slate-100 rounded-2xl animate-pulse" />
    </div>
  );

  if (isError) return (
    <div className="p-6 text-red-500 text-sm">{String((error as Error)?.message ?? error)}</div>
  );

  if (!data?.length) return (
    <div className="p-6 text-slate-400 text-sm">Sin datos disponibles.</div>
  );

  return (
    <div className={`${embedded ? 'pt-2 pb-4' : 'p-6'} flex flex-col gap-4 ${embedded ? '' : 'h-full'}`}>
      <div className={`flex rounded-2xl border border-slate-100 shadow-sm bg-white overflow-hidden ${embedded ? 'min-h-[520px]' : 'flex-1 min-h-0'}`}>

        {/* ── Lista ──────────────────────────────────────────────────── */}
        {/* La tabla ya no encoge al abrir el detalle: el detalle es un overlay
            flotante. Antes ocupaba el 40% de la fila y además había que esconder
            cinco columnas para que entrara. */}
        <div className="flex flex-col min-w-0 w-full">

          {/* Filtros */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 flex-wrap shrink-0">

            {/* Búsqueda empresa */}
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar empresa..."
                value={busquedaNombre}
                onChange={e => { setBusquedaNombre(e.target.value); resetPagina(); }}
                className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0097A7] w-44"
              />
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none">🔍</span>
            </div>

            {/* Búsqueda ejecutivo — oculta cuando viene pre-filtrado */}
            {!filterKam && (
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar ejecutivo..."
                value={busquedaKam}
                onChange={e => { setBusquedaKam(e.target.value); resetPagina(); }}
                list="kams-datalist"
                className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0097A7] w-40"
              />
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none">👤</span>
              <datalist id="kams-datalist">
                {kamsUnicos.map(k => <option key={k} value={k} />)}
              </datalist>
            </div>
            )}

            {/* País — oculto cuando viene pre-filtrado */}
            {!filterPais && (
            <select
              value={paisFiltro}
              onChange={e => { setPaisFiltro(e.target.value); resetPagina(); }}
              className="py-1.5 px-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0097A7] text-slate-600"
            >
              <option value="todos">Todos los países</option>
              {paisesUnicos.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            )}

            <div className="w-px h-4 bg-slate-200 shrink-0" />

            {/* Segmento chips */}
            <div className="flex gap-1">
              {SEG_OPTS.map(opt => {
                const active = segFiltro === opt.value;
                const color = opt.value === 'todos' ? '#0097A7' : (SEG_COLOR[opt.value] || '#0097A7');
                return (
                  <button
                    key={opt.value}
                    onClick={() => { setSegFiltro(opt.value); resetPagina(); }}
                    className={`px-2.5 py-1 rounded-lg border text-xs transition-all active:scale-95 ${
                      active ? 'text-white font-semibold' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                    style={active ? { background: color, borderColor: color } : {}}
                  >{opt.label}</button>
                );
              })}
            </div>

            <div className="w-px h-4 bg-slate-200 shrink-0" />

            {/* Dotación: solo Colombia tiene estos productos, así que el chip se
                oculta cuando no hay ninguno en la vista actual. */}
            {hayDotacion && (
              <>
                <div className="flex gap-1 items-center">
                  <span className="text-[10px] text-slate-400 mr-0.5 whitespace-nowrap">Dotación</span>
                  {([
                    ['todos', 'Todos'],
                    ['con',   'Con'],
                    ['sin',   'Sin'],
                  ] as ['todos' | 'con' | 'sin', string][]).map(([v, label]) => {
                    const activo = dotacionFiltro === v;
                    return (
                      <button
                        key={v}
                        onClick={() => { setDotacionFiltro(v); resetPagina(); }}
                        className={`px-2.5 py-1 rounded-lg border text-xs transition-all active:scale-95 whitespace-nowrap ${
                          activo ? 'text-white font-semibold' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                        style={activo ? { background: '#0097A7', borderColor: '#0097A7' } : undefined}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="w-px h-4 bg-slate-200 shrink-0" />
              </>
            )}

            {/* Cambios de status de la última semana. Es el detalle cliente por
                cliente de lo que el Overview resume en "Movimiento de cartera";
                desde ahí se llega acá con el filtro ya puesto. */}
            <div className="flex gap-1 items-center">
              <span className="text-[10px] text-slate-400 mr-0.5 whitespace-nowrap">
                Cambios{ultimaSemana ? ` ${ultimaSemana.replace(/^\d{4}-/, '')}` : ''}
              </span>
              {([
                ['todos',      'Todos',      ''],
                ['cualquiera', 'Con cambio', ''],
                ['mejoraron',  'Mejoraron',  '↑'],
                ['empeoraron', 'Empeoraron', '↓'],
              ] as [CambioStatus, string, string][]).map(([v, label, icono]) => {
                const activo = cambioFiltro === v;
                const color = v === 'mejoraron' ? '#059669' : v === 'empeoraron' ? '#dc2626' : '#0097A7';
                return (
                  <button
                    key={v}
                    onClick={() => { setCambioFiltro(v); resetPagina(); }}
                    className={`px-2.5 py-1 rounded-lg border text-xs transition-all active:scale-95 whitespace-nowrap ${
                      activo ? 'text-white font-semibold' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                    style={activo ? { background: color, borderColor: color } : undefined}
                  >
                    {icono && <span className="mr-0.5">{icono}</span>}{label}
                  </button>
                );
              })}
            </div>

            <div className="w-px h-4 bg-slate-200 shrink-0" />

            {/* Tipo chips — "Perdido" activa mostrarPerdidos automáticamente */}
            <div className="flex gap-1">
              {TIPO_OPTS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setTipoFiltro(opt.value);
                    if (opt.value === 'perdido_historico') setMostrarPerdidos(true);
                    resetPagina();
                  }}
                  className={`px-2.5 py-1 rounded-lg border text-xs transition-all active:scale-95 ${
                    tipoFiltro === opt.value
                      ? 'bg-[#0097A7] text-white border-[#0097A7] font-semibold'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >{opt.label}</button>
              ))}
            </div>

            <div className="flex items-center gap-3 ml-auto shrink-0">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={mostrarPerdidos}
                  onChange={e => {
                    setMostrarPerdidos(e.target.checked);
                    if (!e.target.checked && tipoFiltro === 'perdido_historico') setTipoFiltro('todos');
                    resetPagina();
                  }}
                  className="w-3.5 h-3.5 rounded accent-[#0097A7]"
                />
                <span className="text-[11px] text-slate-400 whitespace-nowrap">Mostrar perdidos</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={mostrarOtros}
                  onChange={e => { setMostrarOtros(e.target.checked); resetPagina(); }}
                  className="w-3.5 h-3.5 rounded accent-[#0097A7]"
                />
                <span className="text-[11px] text-slate-400 whitespace-nowrap">Mostrar "Otros"</span>
              </label>
            </div>

            <span
              title={`${totalConPerdidos.toLocaleString()} clientes en total (incluyendo ${(totalConPerdidos - totalSinPerdidos).toLocaleString()} perdidos)`}
              className="text-[11px] text-slate-400 tabular-nums whitespace-nowrap shrink-0 cursor-help border-b border-dashed border-slate-300"
            >
              {filtrados.length.toLocaleString()} de {totalSinPerdidos.toLocaleString()}
            </span>
          </div>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 shrink-0 bg-slate-50/60">
              <button
                onClick={() => setPagina(p => Math.max(0, p - 1))}
                disabled={paginaActual === 0}
                className="px-3 py-1 text-xs rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >← Anterior</button>
              <span className="text-xs text-slate-400 tabular-nums">
                Pág. {paginaActual + 1} / {totalPaginas}
                <span className="text-slate-300 mx-1">·</span>
                {visibles.length} clientes
              </span>
              <button
                onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))}
                disabled={paginaActual >= totalPaginas - 1}
                className="px-3 py-1 text-xs rounded-lg border border-[#0097A7] text-[#0097A7] font-medium hover:bg-[#0097A7] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >Siguiente →</button>
            </div>
          )}

          {/* Tabla */}
          {/* Barra horizontal siempre visible: la tabla desborda a propósito
              (min-w) y en macOS el scrollbar queda oculto hasta que se scrollea,
              así que sin esto no se descubre que hay más columnas a la derecha. */}
          <style>{`
            .tabla-scroll { scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
            .tabla-scroll::-webkit-scrollbar { height: 10px; width: 10px; }
            .tabla-scroll::-webkit-scrollbar-track { background: #f8fafc; }
            .tabla-scroll::-webkit-scrollbar-thumb {
              background: #cbd5e1; border-radius: 5px; border: 2px solid #f8fafc;
            }
            .tabla-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
          `}</style>
          {/* Barra gemela ARRIBA: solo si hay desborde, para no dejar un riel
              muerto cuando la tabla entra completa. */}
          {desborda && (
            <div
              ref={arribaRef}
              onScroll={() => espejar('arriba')}
              /* h explícito: el hijo mide 1px, así que sin altura el div quedaba en
                 2px y el scrollbar no tenía dónde dibujarse — scrolleaba, pero
                 invisible, que es justo lo que se quería evitar. */
              className="tabla-scroll h-[13px] overflow-x-auto overflow-y-hidden shrink-0 border-b border-slate-100"
              aria-hidden="true"
            >
              <div style={{ width: ancho, height: 1 }} />
            </div>
          )}
          <div
            ref={tablaRef}
            onScroll={() => espejar('tabla')}
            className="tabla-scroll overflow-auto flex-1"
          >
            {/* min-w para que la tabla desborde y el contenedor scrollee: con
                w-full a secas las columnas se comprimen y nunca hay barra.
                Con el panel de detalle abierto NO se aplica: ahí la tabla vive en
                ~60% del ancho y varias columnas se ocultan, así que un mínimo fijo
                solo agregaría scroll para nada. */}
            <div className="tabla-scroll">
              <table className="w-full text-sm border-collapse min-w-[1180px] tabla-apilable">
                <thead className="sticky top-0 z-10">
                  <tr className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100 bg-white">
                    <th className="text-right px-4 py-2.5 w-10">#</th>
                    <th className="text-left px-3 py-2.5">País</th>
                    <SortTh k="nombre"       cur={sortKey} dir={sortDir} onSort={toggleSort} align="left"  className="px-3 py-2.5">Empresa</SortTh>
                    <th className="text-left px-3 py-2.5">Ejecutivo</th>
                    <th className="text-center px-3 py-2.5">Tipo</th>
                    <th className="text-center px-3 py-2.5">Seg.</th>
                    <SortTh k="score"        cur={sortKey} dir={sortDir} onSort={toggleSort} align="right" className="px-3 py-2.5">RENT/VENT</SortTh>
                    <SortTh k="tendencia"    cur={sortKey} dir={sortDir} onSort={toggleSort} align="left"  className="px-3 py-2.5">Tendencia</SortTh>
                    <SortTh k="diasSinCompra" cur={sortKey} dir={sortDir} onSort={toggleSort} align="right" className="px-3 py-2.5">Días s/c</SortTh>
                    {hayDotacion && (
                      <SortTh k="dotacion" cur={sortKey} dir={sortDir} onSort={toggleSort} align="right" className="px-3 py-2.5 whitespace-nowrap">Dotación</SortTh>
                    )}
                    <SortTh k="ultimaCompra" cur={sortKey} dir={sortDir} onSort={toggleSort} align="right" className="px-4 py-2.5">Últ. Compra</SortTh>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((c, i) => {
                    const globalIdx = paginaActual * POR_PAGINA + i + 1;
                    const isSelected = selected?.idTributario === c.idTributario && selected?.pais === c.pais;
                    return (
                      <tr
                        key={`${c.pais}-${c.idTributario}-${i}`}
                        // Se registra solo la apertura, no el cierre. El detalle va con
                        // el país y no con el nombre del cliente: alcanza para saber
                        // qué carteras se consultan sin llenar Firestore de razones
                        // sociales.
                        onClick={() => {
                          setSelected(isSelected ? null : c);
                          if (!isSelected) track('clientes:ficha', c.pais);
                        }}
                        className={`border-b border-slate-50 cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#e0f7fa]' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td data-label="#" data-secundario className="text-right px-4 py-2.5 text-slate-300 text-xs tabular-nums select-none">{globalIdx}</td>

                        <td data-label="País" data-secundario className="px-3 py-2.5">
                          {(() => {
                            const cc = FLAG_CC[c.pais];
                            return cc
                              ? <img src={`https://flagcdn.com/16x12/${cc}.png`} width={14} height={10} alt={c.pais} className="rounded-sm" />
                              : <span className="text-xs text-slate-400">{c.pais}</span>;
                          })()}
                        </td>

                        <td data-titular className="px-3 py-1.5 max-w-[220px] w-[220px]">
                          <span
                            title={c.nombre}
                            className={`block truncate text-sm font-medium ${isSelected ? 'text-[#0097A7]' : 'text-slate-700'}`}
                          >
                            {c.nombre}
                          </span>
                        </td>

                        <td data-label="Ejecutivo" data-secundario className="px-3 py-2.5 text-xs text-slate-400">
                          {c.kam || '—'}
                        </td>

                        <td data-label="Tipo" data-secundario className="px-3 py-2.5 text-center">
                          <TipoBadge tipo={c.tipo} />
                        </td>

                        <td data-label="Seg." data-secundario className="px-3 py-2.5">
                          <div className="flex items-center justify-center gap-1.5">
                            <SegDot seg={c.segmento} />
                            <span className="text-xs font-semibold" style={{ color: SEG_COLOR[c.segmento] }}>
                              {c.segmento}
                            </span>
                          </div>
                        </td>

                        <td data-label="RENT/VENT" className="px-3 py-2.5 text-right">
                          {getScoreChurn(c, scoresChurn) !== null
                            ? <ScoreBadge score={getScoreChurn(c, scoresChurn)!} segmento={c.segmento} />
                            : <RiesgoPill status={c.status} />}
                        </td>

                        <td data-label="Tendencia" className="px-3 py-2.5">
                          <TendenciaCell act={c.monto6mAct} ant={c.monto6mAnt} />
                        </td>

                        <td data-label="Días s/c" className={`px-3 py-2.5 text-right tabular-nums text-xs ${
                          c.diasSinCompra > 180 ? 'text-red-500 font-semibold' : c.diasSinCompra > 90 ? 'text-amber-500' : 'text-slate-400'
                        }`}>
                          {c.diasSinCompra > 0 ? `${c.diasSinCompra}d` : '—'}
                        </td>

                        {hayDotacion && (
                          <td data-label="Dotación" data-secundario className="px-3 py-2.5 text-right tabular-nums text-xs whitespace-nowrap">
                            {c.usdDotacion > 0
                              ? <span className="text-slate-700 font-medium">{fmtUSD(c.usdDotacion)}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                        )}

                        <td data-label="Últ. Compra" data-secundario className="px-4 py-2.5 text-right tabular-nums text-xs text-slate-500 whitespace-nowrap">
                          {fmtFecha(c.ultimaCompra)}
                        </td>
                      </tr>
                    );
                  })}

                  {visibles.length === 0 && (
                    <tr>
                      <td colSpan={hayDotacion ? 10 : 9} className="text-center py-20 text-slate-400 text-sm">
                        No hay clientes que coincidan con los filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Detalle: overlay flotante a la derecha ────────────────────────
            NO lleva backdrop a propósito. Un backdrop —aunque sea transparente—
            captura los clics y obligaría a cerrar el detalle para elegir otro
            cliente. Sin él, la tabla sigue viva debajo: se hace clic en otra fila
            y el overlay se actualiza sin cerrarse.
            Por eso tampoco es `aria-modal`: no bloquea el resto de la página, y
            declararlo modal sería mentirle al lector de pantalla. */}
        {hasPanel && (
          <aside
            role="dialog"
            aria-label={`Detalle de ${selected!.nombre}`}
            // Arranca en 520px: la columna EMPRESA termina cerca de ahí, así que
            // el nombre de cada cliente queda visible y clickeable a la izquierda
            // del overlay. Debajo de 1280px pasa a ocupar casi todo el ancho,
            // porque ahí no hay espacio para dejar la tabla asomando.
            className="fixed top-24 bottom-4 right-4 left-4 xl:left-[520px] z-40
                       max-h-[720px] rounded-2xl border border-slate-200 bg-white
                       shadow-[0_10px_40px_-8px_rgba(15,23,42,0.35)]
                       flex flex-col overflow-hidden"
          >
            <DetailPanel c={selected!} historial={historialMap} scores={scoresChurn} onClose={() => setSelected(null)} />
          </aside>
        )}
      </div>
    </div>
  );
}
