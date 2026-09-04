import { motion } from 'motion/react';
import { inline } from './Markdown';
import { partirVinieta } from './formato';
import { useEntrada } from './animacion';

/**
 * "Qué cambió en la cartera" dejó de ser una lista corrida. Cada viñeta del brief trae
 * un titular en negrita y un cuerpo con las cifras, así que se muestra como tarjeta con
 * esa jerarquía: el titular se lee de un vistazo y el detalle queda debajo.
 *
 * Si el brief no respeta ese formato, partirVinieta devuelve el texto completo como
 * cuerpo y la tarjeta sigue siendo legible.
 */
function Tarjeta({ vinieta, indice }: { vinieta: string; indice: number }) {
  const entrada = useEntrada(indice);
  const { titular, cuerpo } = partirVinieta(vinieta);
  return (
    <motion.article
      {...entrada}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <span
        className="mb-2 block h-1 w-8 rounded-full"
        style={{ background: 'linear-gradient(90deg,#7C3AED,#0097A7)' }}
        aria-hidden="true"
      />
      {titular && (
        <h3 className="mb-1 text-[13.5px] font-semibold leading-snug tracking-tight text-slate-900">
          {titular}
        </h3>
      )}
      <p className="text-[12.5px] leading-relaxed text-slate-600 [font-variant-numeric:tabular-nums]">
        {inline(cuerpo, `cambio-${indice}`)}
      </p>
    </motion.article>
  );
}

export function CambiosCartera({ vinietas }: { vinietas: string[] }) {
  if (!vinietas.length) return null;

  return (
    <section aria-labelledby="titulo-cambios" className="mb-6">
      <h2 id="titulo-cambios" className="mb-2.5 text-[12px] font-semibold uppercase tracking-wider text-slate-500">
        Qué cambió en la cartera
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {vinietas.map((v, i) => (
          <Tarjeta key={i} vinieta={v} indice={i} />
        ))}
      </div>
    </section>
  );
}
