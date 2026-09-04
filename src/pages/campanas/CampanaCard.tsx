import { motion } from 'motion/react';
import type { Campana, EstadoCampana, AvanceCampana } from '../../hooks/useCampanas';
import { ETIQUETA_ESTADO } from '../../hooks/useCampanas';
import { ESTILO_ESTADO, estiloTipo, numero, usdCorto } from './formato';
import { useEntrada } from './animacion';

interface Props {
  campana: Campana;
  indice: number;
  estado: EstadoCampana;
  avance?: AvanceCampana;
  activa: boolean;
  onAbrir: () => void;
}

/**
 * Una campaña como objeto y no como párrafo: prioridad, tipo, la cifra que la justifica
 * y —si la base es medible— cuántas cuentas se movieron desde que se publicó.
 *
 * La tarjeta es un <article> con un botón que la cubre entera, y no un <button> con el
 * contenido adentro: un botón solo admite contenido de frase, así que meterle el título y
 * la lista de cifras genera HTML inválido y un nombre accesible ilegible (el lector lee
 * todas las cifras de corrido). Así el botón tiene un nombre corto y el contenido queda
 * como texto normal.
 */
export function CampanaCard({ campana, indice, estado, avance, activa, onAbrir }: Props) {
  const tipo = estiloTipo(campana.tipo);
  const est = ESTILO_ESTADO[estado];
  const base = campana.base;

  const entrada = useEntrada(indice);
  const total = avance?.resumen ? avance.total ?? 0 : 0;
  const logrados = avance?.resumen?.logrados ?? 0;
  const pct = total > 0 ? Math.round((logrados / total) * 100) : 0;

  return (
    <motion.article
      {...entrada}
      className={[
        'group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm',
        'transition-[box-shadow,border-color] duration-200',
        'hover:shadow-md focus-within:shadow-md active:scale-[0.96]',
        activa ? 'border-slate-300 shadow-md' : 'border-slate-200',
      ].join(' ')}
    >
      {/* Franja de tipo: el color es el identificador de la campaña en toda la vista. */}
      <span className="h-1 w-full shrink-0" style={{ background: tipo.color }} aria-hidden="true" />

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[12px] font-semibold tabular-nums"
              style={{ background: tipo.fondo, color: tipo.color }}
              aria-hidden="true"
            >
              {campana.prioridad}
            </span>
            <span
              className="rounded-md px-2 py-0.5 text-[11px] font-medium"
              style={{ background: tipo.fondo, color: tipo.color }}
            >
              {tipo.etiqueta}
            </span>
          {campana.rol && (
            <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {campana.rol}
            </span>
          )}
          </div>
          <span
            className="shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium"
            style={{ background: est.fondo, color: est.color, borderColor: est.borde }}
          >
            {ETIQUETA_ESTADO[estado]}
          </span>
        </div>

        <h3 className="mb-2 text-[14.5px] font-semibold leading-snug tracking-tight text-slate-900">
          {/* El enlace cubre toda la tarjeta; el nombre accesible es el de la campaña. */}
          <button
            type="button"
            onClick={onAbrir}
            aria-expanded={activa}
            className="text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-offset-2"
            style={{ ['--tw-ring-color' as string]: tipo.color }}
          >
            {campana.nombre}
          </button>
        </h3>

        {campana.senal && (
          <p className="mb-3 line-clamp-2 text-[12.5px] leading-relaxed text-slate-500 [font-variant-numeric:tabular-nums]">
            {campana.senal}
          </p>
        )}

        {/* Las dos cifras que deciden si la campaña vale la pena. */}
        <dl className="mt-auto grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
          <div>
            <dt className="text-[10.5px] uppercase tracking-wide text-slate-500">Base objetivo</dt>
            <dd className="text-[14px] font-semibold tabular-nums text-slate-900">
              {base?.clientes != null ? `${numero(base.clientes)} cuentas` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[10.5px] uppercase tracking-wide text-slate-500">Facturación 6m</dt>
            <dd className="text-[14px] font-semibold tabular-nums text-slate-900">
              {usdCorto(base?.arr_6m_usd)}
            </dd>
          </div>
        </dl>

        {avance?.medible && total > 0 && (
          <div className="mt-3">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-[10.5px] uppercase tracking-wide text-slate-500">
                {avance?.etiqueta_metrica ?? 'Avance'}
              </span>
              <span className="text-[12px] font-semibold tabular-nums text-slate-700">
                {logrados} de {total}
              </span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${avance?.etiqueta_metrica ?? 'Avance'}: ${logrados} de ${total} cuentas`}
            >
              <motion.span
                className="block h-full rounded-full"
                style={{ background: tipo.color }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
        )}

        {campana.origen === 'markdown' && (
          <p className="mt-3 text-[11px] leading-snug text-slate-500">
            Brief anterior al seguimiento: sin base objetivo guardada, no se puede medir avance.
          </p>
        )}
      </div>
    </motion.article>
  );
}
