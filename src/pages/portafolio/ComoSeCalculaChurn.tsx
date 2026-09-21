import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { useTrampaDeFoco } from '../../hooks/useTrampaDeFoco';

/**
 * Los tres casos que explican por qué "churn" y "salieron de la base" nunca dan
 * el mismo número.
 *
 * Viven acá y no sueltos en cada tabla para que el color signifique siempre lo
 * mismo: si alguien aprende en el modal que el ámbar es "sigue en la base", ese
 * ámbar tiene que querer decir eso en todas partes. Cada caso lleva además su
 * nombre escrito —el color solo no alcanza para quien no lo distingue, y a
 * nadie le sirve un color que hay que memorizar.
 */
export const CASOS = {
  perdidaNueva: {
    nombre: 'Pérdida nueva',
    texto: 'text-rose-700',
    punto: 'bg-rose-500',
    chip: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  sigueEnBase: {
    nombre: 'Sigue en la base',
    texto: 'text-amber-700',
    punto: 'bg-amber-600',
    chip: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  yaContada: {
    nombre: 'Pérdida ya contada',
    texto: 'text-sky-700',
    punto: 'bg-sky-600',
    chip: 'bg-sky-50 text-sky-800 border-sky-200',
  },
} as const;
// Los tonos no son decorativos: cada `texto` supera 4.5:1 sobre blanco y sobre
// el gris de las filas abiertas, y cada `punto` supera 3:1. Medido, no a ojo.

export type CasoId = keyof typeof CASOS;

/** La etiqueta de un caso: punto de color + nombre. Nunca el color a secas. */
export function EtiquetaCaso({ caso, className = '' }: { caso: CasoId; className?: string }) {
  const c = CASOS[caso];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${className}`}>
      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${c.punto}`} aria-hidden="true" />
      <span className={`font-semibold ${c.texto}`}>{c.nombre}</span>
    </span>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="pt-4 first:pt-0">
      <h3 className="text-[13px] font-semibold text-slate-800 mb-1.5">{titulo}</h3>
      <div className="text-[12.5px] leading-relaxed text-slate-600 space-y-2">{children}</div>
    </section>
  );
}

/**
 * El modal "Cómo se calcula".
 *
 * Está escrito para alguien que entra al panel sin saber nada del cálculo, no
 * para quien lo programó: sin jerga, con los números del último trimestre como
 * ejemplo y explicando el malentendido más común —restar los que salieron del
 * churn— antes de que lo cometa.
 */
export function ComoSeCalculaChurn({ onCerrar, ejemplo, serie = [] }: {
  onCerrar: () => void;
  /** Números reales del último trimestre cerrado, para que el ejemplo no sea
   *  inventado. Si no hay, el texto se explica igual sin cifras. */
  ejemplo?: { etiqueta: string; churn: number; salieron: number;
              ambas: number; sigue: number; yaContada: number } | null;
  /** Todos los trimestres, para mostrar que la relación no es de uno solo.
   *  Vacío en el payload viejo: la sección simplemente no se dibuja. */
  serie?: { etiqueta: string; churn: number; salieron: number;
            sigue: number; yaContada: number; sinChurn: number }[];
}) {
  const caja = useRef<HTMLDivElement>(null);
  const cerrar = useRef<HTMLButtonElement>(null);
  useTrampaDeFoco(caja, true);

  useEffect(() => { cerrar.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCerrar]);

  const nf = new Intl.NumberFormat('es-CL');
  const n = (v: number) => nf.format(v);

  return (
    <>
      <motion.div
        className="fixed inset-0 z-50 bg-slate-900/40"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onCerrar}
        aria-hidden="true"
      />
      <motion.div
        ref={caja}
        role="dialog" aria-modal="true" aria-labelledby="titulo-como-se-calcula"
        initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -12, filter: 'blur(4px)' }}
        transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
        className="fixed left-1/2 top-1/2 z-50 flex alto-modal w-[min(94vw,680px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3.5 flex-shrink-0">
          <div className="min-w-0">
            <h2 id="titulo-como-se-calcula"
                className="text-[15px] font-semibold tracking-tight text-slate-900">
              Cómo se calcula el churn trimestral
            </h2>
            <p className="mt-0.5 text-[12.5px] text-slate-600">
              Qué cuenta como pérdida, contra qué se compara y por qué hay dos números
              que parecen el mismo.
            </p>
          </div>
          <button
            ref={cerrar}
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.5" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-4 divide-y divide-slate-100">
          <Seccion titulo="1. Cuándo damos a un cliente por perdido">
            <p>
              Un cliente entra en churn cuando compraba y dejó de hacerlo. Lo difícil es
              que «dejó de comprar» no significa lo mismo para todos: hay empresas que
              nos compran todos los meses y empresas que nos compran una o dos veces al
              año. Esperar lo mismo de las dos daría por perdido a quien solo está en su
              temporada baja.
            </p>
            <p>Por eso cada cliente tiene su propio reloj:</p>
            <ul className="space-y-1.5 pl-0.5">
              <li className="flex gap-2">
                <span className="font-semibold text-slate-700 flex-shrink-0">Recurrente</span>
                <span>— compra seguido. Con <strong>4 meses</strong> sin comprar, lo damos por perdido.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-slate-700 flex-shrink-0">Estacional</span>
                <span>— compra de vez en cuando. Le damos <strong>13 meses</strong>, para que alcance a repetir su temporada.</span>
              </li>
            </ul>
            <p className="text-[11.5px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              Esta separación en dos relojes existe <strong>solo para este cálculo</strong>.
              No cambia nada de Salud del cliente, ni de segmento, ni de la clasificación
              que se ve en el resto del panel.
            </p>
          </Seccion>

          <Seccion titulo="2. Contra qué se compara">
            <p>
              El porcentaje necesita un «de cuántos». Ese «de cuántos» es la{' '}
              <strong>base</strong>: las empresas que al cierre del trimestre{' '}
              <em>todavía estaban comprando</em>, cada una medida con su propio reloj.
            </p>
            <p>
              Cada trimestre arma su base de cero. No arrastra empresas que se perdieron
              hace años: si estuvieran ahí, la base crecería para siempre y el porcentaje
              bajaría solo, sin que nadie hubiera hecho nada mejor.
            </p>
          </Seccion>

          <Seccion titulo="3. Por qué el churn y «los que salieron de la base» no dan igual">
            <p>
              Son dos preguntas distintas, no dos versiones de la misma:
            </p>
            <ul className="space-y-1 pl-0.5">
              <li>· <strong>Churn</strong>: ¿quién dejó de comprar, según su reloj?</li>
              <li>· <strong>Salieron de la base</strong>: ¿quién ya no aparece en la base de este trimestre, comparada con la del anterior?</li>
            </ul>
            <p>
              Casi todas las empresas contestan que sí a las dos. Pero hay dos grupos que
              contestan a una sola, y son los que hacen que los números no coincidan:
            </p>

            <div className="space-y-2 pt-1">
              <div className={`rounded-lg border px-3 py-2.5 ${CASOS.perdidaNueva.chip}`}>
                <EtiquetaCaso caso="perdidaNueva" />
                <p className="text-[12px] mt-1 text-slate-600">
                  Dejó de comprar <em>y</em> salió de la base, en el mismo trimestre. Es
                  el caso normal, y es la mayoría. <strong>Cuenta en los dos números.</strong>
                </p>
              </div>
              <div className={`rounded-lg border px-3 py-2.5 ${CASOS.sigueEnBase.chip}`}>
                <EtiquetaCaso caso="sigueEnBase" />
                <p className="text-[12px] mt-1 text-slate-600">
                  Entró en churn, pero <strong>no salió de la base</strong>. Pasó de
                  recurrente a estacional, y a un estacional se le mide con el reloj
                  largo: sus compras anteriores todavía cuentan. Está perdido según su
                  reloj nuevo, y sigue en el «de cuántos».
                </p>
              </div>
              <div className={`rounded-lg border px-3 py-2.5 ${CASOS.yaContada.chip}`}>
                <EtiquetaCaso caso="yaContada" />
                <p className="text-[12px] mt-1 text-slate-600">
                  Salió de la base ahora, pero <strong>ya lo contamos como perdido en
                  un trimestre anterior</strong>. Es el mismo cambio de tipo del caso
                  anterior, corrido en el tiempo: se declaró perdido siendo recurrente, a
                  los 4 meses de silencio, y después pasó a estacional. Con el plazo de 13
                  meses siguió contando en la base dos o tres trimestres más, y recién
                  ahora queda fuera. No se cuenta dos veces.
                </p>
              </div>
            </div>
          </Seccion>

          <Seccion titulo="4. Por eso no se resta uno del otro">
            {ejemplo ? (
              <>
                <p>
                  En {ejemplo.etiqueta} el churn fue de <strong>{n(ejemplo.churn)}</strong>{' '}
                  y salieron de la base <strong>{n(ejemplo.salieron)}</strong>. La resta da{' '}
                  {n(Math.abs(ejemplo.churn - ejemplo.salieron))}, y ese número no
                  significa nada: no son {n(Math.abs(ejemplo.churn - ejemplo.salieron))}{' '}
                  empresas. Lo que hay detrás es esto:
                </p>
                <ul className="space-y-1 pl-0.5 tabular-nums">
                  <li className="flex gap-2">
                    <span className={`font-semibold w-10 text-right flex-shrink-0 ${CASOS.perdidaNueva.texto}`}>{n(ejemplo.ambas)}</span>
                    <span>las mismas empresas, contadas en los dos números</span>
                  </li>
                  <li className="flex gap-2">
                    <span className={`font-semibold w-10 text-right flex-shrink-0 ${CASOS.sigueEnBase.texto}`}>{n(ejemplo.sigue)}</span>
                    <span>en churn, pero siguen en la base</span>
                  </li>
                  <li className="flex gap-2">
                    <span className={`font-semibold w-10 text-right flex-shrink-0 ${CASOS.yaContada.texto}`}>{n(ejemplo.yaContada)}</span>
                    <span>salieron, pero ya se habían contado antes</span>
                  </li>
                </ul>
                <p>
                  O sea dos grupos de tamaño parecido moviéndose en direcciones
                  opuestas, que casi se cancelan. La resta los esconde a los dos y deja
                  una diferencia chica que parece un detalle y no lo es.
                </p>
              </>
            ) : (
              <p>
                La diferencia entre los dos números no es un puñado de empresas: son dos
                grupos —los que están en churn sin salir de la base, y los que salen sin
                volver a contar— moviéndose en direcciones opuestas y casi cancelándose.
                Restar uno del otro los esconde a los dos.
              </p>
            )}
            <p className="text-[11.5px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              En cada tabla puedes abrir el trimestre con la flecha{' '}
              <span className="inline-block align-middle">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="3" aria-hidden="true" className="inline">
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>{' '}
              para ver estos mismos tres grupos con sus números.
            </p>
          </Seccion>

          {serie.length > 0 && (
            <Seccion titulo="5. La relación entre los dos números, trimestre a trimestre">
              <p>
                Los dos números nunca coinciden por casualidad: su diferencia es
                exactamente la de los dos grupos que no se superponen.
              </p>
              <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-[12px] text-slate-700">
                churn − salieron ={' '}
                <span className={CASOS.sigueEnBase.texto}>siguen en la base</span> −{' '}
                <span className={CASOS.yaContada.texto}>ya contadas</span> − salieron sin
                figurar en churn
              </p>
              <div className="tabla-scroll -mx-1">
                <table className="w-full text-[12px] tabla-apilable-vp">
                  <caption className="sr-only">
                    Diferencia entre churn y salidas, y los grupos que la explican, por trimestre
                  </caption>
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                      <th scope="col" className="text-left font-medium pb-1.5 px-1">Trimestre</th>
                      <th scope="col" className="text-right font-medium pb-1.5 px-1">Churn − salieron</th>
                      <th scope="col" className="text-right font-medium pb-1.5 px-1">Siguen en la base</th>
                      <th scope="col" className="text-right font-medium pb-1.5 px-1">Ya contadas</th>
                      <th scope="col" className="text-right font-medium pb-1.5 px-1">Sin figurar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serie.map(q => (
                      <tr key={q.etiqueta} className="border-b border-slate-50 last:border-0">
                        <th scope="row" className="text-left py-1.5 px-1 font-normal whitespace-nowrap text-slate-600">
                          {q.etiqueta}
                        </th>
                        <td data-label="Churn − salieron" className="py-1.5 px-1 text-right tabular-nums font-semibold text-slate-800">
                          {q.churn - q.salieron > 0 ? '+' : ''}{n(q.churn - q.salieron)}
                        </td>
                        <td data-label="Siguen en la base" className={`py-1.5 px-1 text-right tabular-nums ${CASOS.sigueEnBase.texto}`}>{n(q.sigue)}</td>
                        <td data-label="Ya contadas" className={`py-1.5 px-1 text-right tabular-nums ${CASOS.yaContada.texto}`}>{n(q.yaContada)}</td>
                        <td data-label="Sin figurar" className="py-1.5 px-1 text-right tabular-nums text-slate-400">{n(q.sinChurn)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                La última columna casi siempre es cero. Deja de serlo en el primer
                trimestre de la serie, donde hay empresas que salieron de la base pero
                se habían perdido antes de donde arranca el histórico, así que su churn
                nunca se publicó. Por eso ahí la diferencia puede ser negativa: salieron
                más de las que entraron en churn.
              </p>
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-slate-700">
                <strong className="text-amber-800">Cuidado con la diferencia en cero.</strong>{' '}
                Que los dos números den igual no significa que sean las mismas empresas.
                Puede haber un grupo en churn que sigue en la base y otro, distinto y del
                mismo tamaño, que salió sin volver a contarse: se cancelan y la resta da
                cero. Por eso la resta no sirve para comprobar nada.
              </p>
            </Seccion>
          )}
        </div>
      </motion.div>
    </>
  );
}
