import { motion } from 'motion/react';
import type { AvanceCampana } from '../../hooks/useCampanas';
import { numero, usd } from './formato';

/**
 * Avance real de la campaña: las mismas cuentas que quedaron guardadas como base objetivo,
 * comparadas contra su estado de hoy.
 *
 * **Lo que se mide depende de lo que la campaña incentiva.** Una de retención se gana
 * cuando la cuenta mejora su salud; una de cross-sell, cuando contrata el producto; una de
 * activación, cuando vuelve a comprar; una de renovación, cuando crece la facturación.
 * Medir todo con el score decía poco y a veces mentía: una cuenta puede contratar SaaS y
 * bajar de score esa misma semana por otra razón.
 *
 * El movimiento de score se sigue mostrando, pero como contexto secundario — sirve para
 * ver si la cuenta se está deteriorando mientras la campaña corre.
 */
export function AvanceBase({
  avance,
  cargando,
  error,
  acento,
}: {
  avance?: AvanceCampana;
  cargando: boolean;
  error?: Error | null;
  acento: string;
}) {
  if (cargando) {
    return (
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12.5px] text-slate-600">
        Calculando avance de la base objetivo…
      </p>
    );
  }
  if (error) {
    return (
      <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-900">
        No se pudo calcular el avance. {error.message}
      </p>
    );
  }
  if (!avance) return null;

  if (!avance.medible) {
    return (
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-slate-600">
        {avance.motivo ?? 'Esta campaña no tiene una base objetivo medible.'}
      </p>
    );
  }

  const r = avance.resumen!;
  const total = avance.total ?? 0;
  const pct = total > 0 ? Math.round((r.logrados / total) * 100) : 0;
  const esScore = avance.metrica === 'score';
  const logro = avance.etiqueta_logro ?? 'Logrado';
  const pendiente = avance.etiqueta_pendiente ?? 'Pendiente';

  return (
    <div>
      {/* Titular: qué se mide y cuánto se lleva. */}
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[12px] font-medium text-slate-700">{avance.etiqueta_metrica}</span>
        <span className="text-[13px] font-semibold tabular-nums" style={{ color: acento }}>
          {numero(r.logrados)} de {numero(total)}
          <span className="ml-1 text-[11.5px] font-normal text-slate-500">({pct}%)</span>
        </span>
      </div>

      <div
        className="mb-3 h-2 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
        aria-label={`${avance.etiqueta_metrica}: ${r.logrados} de ${total}`}
      >
        <motion.span
          className="block h-full rounded-full"
          style={{ background: acento }}
          initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', duration: 0.5, bounce: 0, delay: 0.1 }}
        />
      </div>

      <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <div>
          <dt className="text-[10.5px] uppercase tracking-wide text-slate-500">{logro}</dt>
          <dd className="text-[16px] font-semibold tabular-nums" style={{ color: acento }}>{numero(r.logrados)}</dd>
        </div>
        <div>
          <dt className="text-[10.5px] uppercase tracking-wide text-slate-500">{pendiente}</dt>
          <dd className="text-[16px] font-semibold tabular-nums text-slate-700">{numero(r.pendientes)}</dd>
        </div>
        {/* Contexto: cómo viene la salud de la base mientras la campaña corre. */}
        <div>
          <dt className="text-[10.5px] uppercase tracking-wide text-slate-500">Salud al alza</dt>
          <dd className="text-[16px] font-semibold tabular-nums text-emerald-700">{numero(r.mejoraron)}</dd>
        </div>
        <div>
          <dt className="text-[10.5px] uppercase tracking-wide text-slate-500">Salud a la baja</dt>
          <dd className="text-[16px] font-semibold tabular-nums text-rose-700">{numero(r.empeoraron)}</dd>
        </div>
      </dl>

      <p className="mb-3 text-[12px] text-slate-600 [font-variant-numeric:tabular-nums]">
        Facturación de los últimos 6 meses: {usd(r.monto_ahora_usd)} hoy contra{' '}
        {usd(r.monto_antes_usd)} cuando se publicó la campaña. Las dos cifras son ventanas de
        6 meses; lo que cambia es desde cuándo se cuentan.
      </p>

      <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
        <div className="tabla-scroll">
          <table className="w-full border-collapse text-[12px] tabla-apilable">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="text-left text-[10.5px] uppercase tracking-wide text-slate-600">
                <th scope="col" className="px-3 py-2 font-medium">Cuenta</th>
                <th scope="col" className="px-3 py-2 font-medium">Ejecutivo</th>
                <th scope="col" className="px-3 py-2 text-right font-medium"
                    title={esScore ? 'Score de salud de hoy' : 'Lo facturado en los últimos 6 meses, contados desde hoy'}>
                  {esScore ? 'Score' : 'Facturación 6m'}
                </th>
                {/* Los días sin comprar son la señal que decide a quién llamar primero en una
                    campaña de recuperación: una cuenta grande y quieta pesa más que una
                    chica y quieta, y eso no se ve mirando solo la facturación. */}
                <th scope="col" className="px-3 py-2 text-right font-medium"
                    title="Días desde la última compra registrada">Sin comprar</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{avance.etiqueta_metrica}</th>
              </tr>
            </thead>
            <tbody>
              {avance.cuentas.map((c, i) => (
                <tr key={`${c.pais}-${c.panel_id}-${i}`} className="border-t border-slate-100 hover:bg-slate-50">
                  <td data-titular className="max-w-[210px] truncate px-3 py-1.5 text-slate-800" title={c.nombre}>
                    {c.nombre}
                    <span className="ml-1.5 text-[10.5px] text-slate-500">{c.pais}</span>
                  </td>
                  <td data-label="Ejecutivo" className="px-3 py-1.5 text-slate-600">{c.kam ?? '—'}</td>
                  <td data-label={esScore ? 'Score' : 'Facturación 6m'} className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                    {!c.encontrada ? '—'
                      : esScore ? `${(c.score_antes ?? 0).toFixed(1)} → ${(c.score_ahora ?? 0).toFixed(1)}`
                      : usd(c.monto_ahora_usd)}
                  </td>
                  <td data-label="Sin comprar" className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                    {c.dias_sin_compra == null ? '—' : `${numero(c.dias_sin_compra)} d`}
                  </td>
                  <td data-label={avance.etiqueta_metrica} className="px-3 py-1.5 text-right">
                    {/* El texto dice el estado; el color solo lo acompaña. */}
                    <span
                      className={`inline-block rounded-md px-1.5 py-0.5 text-[10.5px] font-medium ${
                        !c.encontrada ? 'bg-slate-50 text-slate-500'
                          : c.logrado ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-slate-50 text-slate-600'
                      }`}
                    >
                      {!c.encontrada ? 'Sin dato' : c.logrado ? logro : pendiente}
                    </span>
                    {c.detalle && <span className="ml-1.5 text-[10.5px] text-slate-500">{c.detalle}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
