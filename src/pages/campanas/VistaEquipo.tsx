import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ESTADOS_ACTIVOS, ESTADOS_PASADOS, ETIQUETA_ESTADO,
  useCampanasPublicas, useMisCuentas, useSeguimientos,
  type CampanaPublica, type Seguimiento,
} from '../../hooks/useCampanas';
import { ESTILO_ESTADO, ETIQUETA_INCENTIVO, estiloTipo, numero, usdCorto } from './formato';
import { useEntrada } from './animacion';
import { useUserRole } from '../../hooks/useUserRole';
import { mismoPais } from '../../lib/paises';

/**
 * Lo que ve el equipo comercial: las campañas que **ya se aprobaron** (activas) y las que
 * terminaron (pasadas). Las propuestas del brief no aparecen acá — mientras la campaña no
 * esté aprobada, para el equipo no existe.
 *
 * No trae el análisis de cartera ni la lista de clientes: el backend no los manda. Lo que
 * sí se muestra es el mismo texto que va en el correo de la campaña, que el Admin edita
 * antes de aprobarla.
 */

interface Fila { campana: CampanaPublica; seg: Seguimiento }

function Tarjeta({ campana, seg, indice }: Fila & { indice: number }) {
  const tipo = estiloTipo(campana.tipo);
  const est = ESTILO_ESTADO[seg.estado];
  const entrada = useEntrada(indice);
  const [abierta, setAbierta] = useState(false);

  const incentivo = [
    seg.incentivo_tipo ? ETIQUETA_INCENTIVO[seg.incentivo_tipo] : '',
    seg.incentivo_descripcion,
  ].filter(Boolean).join(' — ');

  const fecha = seg.fecha_objetivo
    ? new Date(`${seg.fecha_objetivo}T00:00:00`).toLocaleDateString('es-CL', { day: '2-digit', month: 'long' })
    : null;

  return (
    <motion.article
      {...entrada}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md"
    >
      <span className="block h-1 w-full" style={{ background: tipo.color }} aria-hidden="true" />
      <div className="p-4">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded-md px-2 py-0.5 text-[11px] font-medium"
                style={{ background: tipo.fondo, color: tipo.color }}>
            {tipo.etiqueta}
          </span>
          {campana.rol && (
            <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {campana.rol}
            </span>
          )}
          <span className="rounded-md border px-2 py-0.5 text-[11px] font-medium"
                style={{ background: est.fondo, color: est.color, borderColor: est.borde }}>
            {ETIQUETA_ESTADO[seg.estado]}
          </span>
        </div>

        <h3 className="mb-2 text-[15px] font-semibold leading-snug tracking-tight text-slate-900">
          <button
            type="button"
            onClick={() => setAbierta((v) => !v)}
            aria-expanded={abierta}
            className="text-left transition-colors duration-150 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400 rounded"
          >
            {campana.nombre}
          </button>
        </h3>

        {incentivo && (
          <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="mb-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-emerald-800">
              Incentivo
            </p>
            <p className="text-[12.5px] leading-relaxed text-emerald-900">{incentivo}</p>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
          <div>
            <dt className="text-[10.5px] uppercase tracking-wide text-slate-600">Cuentas objetivo</dt>
            <dd className="text-[14px] font-semibold tabular-nums text-slate-900">
              {campana.base?.clientes != null ? numero(campana.base.clientes) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[10.5px] uppercase tracking-wide text-slate-600">Fecha objetivo</dt>
            <dd className="text-[14px] font-semibold tabular-nums text-slate-900">{fecha ?? '—'}</dd>
          </div>
        </dl>

        {abierta && (
          <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
            {campana.senal && (
              <div>
                <p className="mb-0.5 text-[10.5px] font-medium uppercase tracking-wide text-slate-600">Por qué ahora</p>
                <p className="text-[12.5px] leading-relaxed text-slate-700 [font-variant-numeric:tabular-nums]">{campana.senal}</p>
              </div>
            )}
            {campana.producto && (
              <div>
                <p className="mb-0.5 text-[10.5px] font-medium uppercase tracking-wide text-slate-600">Qué se ofrece</p>
                <p className="text-[12.5px] leading-relaxed text-slate-700">{campana.producto}</p>
              </div>
            )}
            {campana.pitch && (
              <div>
                <p className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-slate-600">Cómo plantearlo</p>
                <blockquote className="rounded-xl border-l-2 bg-slate-50 px-3 py-2 text-[12.5px] italic leading-relaxed text-slate-700"
                            style={{ borderColor: tipo.color }}>
                  {campana.pitch}
                </blockquote>
              </div>
            )}
            {!!campana.base?.paises?.length && (
              <p className="text-[12px] text-slate-600">
                Países: <span className="text-slate-800">{campana.base.paises.join(' · ')}</span>
              </p>
            )}

            <MisCuentasDeCampana slug={campana.slug} activo={abierta} color={tipo.color} />
          </div>
        )}

        <button
          onClick={() => setAbierta((v) => !v)}
          className="mt-3 min-h-[40px] w-full rounded-lg border border-slate-200 text-[12.5px] font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 active:scale-[0.96]"
        >
          {abierta ? 'Ver menos' : 'Ver el detalle'}
        </button>
      </div>
    </motion.article>
  );
}

function Grupo({ titulo, filas, vacio }: { titulo: string; filas: Fila[]; vacio: string }) {
  return (
    <section aria-label={titulo} className="mb-6">
      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">{titulo}</h2>
        <span className="text-[11.5px] tabular-nums text-slate-500">{filas.length}</span>
      </div>
      {filas.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-[13px] leading-relaxed text-slate-600 shadow-sm">
          {vacio}
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filas.map((f, i) => <Tarjeta key={f.campana.slug} {...f} indice={i} />)}
        </div>
      )}
    </section>
  );
}

/**
 * Las cuentas de esta campaña que le tocan a quien está mirando, con qué hacer con cada
 * una. Solo se pide cuando la tarjeta está desplegada: cada consulta va a BigQuery y
 * pedirlas todas al abrir el tab sería una por campaña activa.
 *
 * Un ejecutivo sin cuentas en la campaña no ve un bloque vacío: no ve nada. La campaña
 * puede ser de otro país o de otro equipo, y un "0 cuentas" ahí solo genera dudas.
 */
function MisCuentasDeCampana({ slug, activo, color }: { slug: string; activo: boolean; color: string }) {
  const { data, isLoading, error } = useMisCuentas(slug, activo);

  if (!activo) return null;
  if (isLoading) {
    return <p className="text-[12px] text-slate-500">Buscando tus cuentas…</p>;
  }
  // Un fallo acá no puede romper la tarjeta: el resto de la campaña sigue siendo útil.
  if (error) {
    return (
      <p className="text-[12px] text-slate-500">
        No se pudieron cargar tus cuentas en este momento.
      </p>
    );
  }
  if (!data?.cuentas.length) return null;

  return (
    <div className="border-t border-slate-100 pt-3">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-2">
        <p className="text-[10.5px] font-medium uppercase tracking-wide text-slate-600">
          Tus cuentas en esta campaña
        </p>
        <p className="text-[11px] tabular-nums text-slate-500">
          {data.cuentas.length} de {numero(data.total_campana)}
        </p>
      </div>

      {data.accion_general && (
        <p className="mb-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[12px] leading-relaxed text-slate-700">
          {data.accion_general}
        </p>
      )}

      <ul className="space-y-2">
        {data.cuentas.map((c) => (
          <li key={`${c.pais}|${c.panel_id}`} className="border-l-2 pl-2.5" style={{ borderColor: color }}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <p className="text-[12.5px] font-medium text-slate-900">{c.nombre}</p>
              <p className="text-[11.5px] tabular-nums text-slate-500">
                {c.monto_6m_usd != null ? usdCorto(c.monto_6m_usd) : '—'}
              </p>
            </div>
            {c.accion
              ? <p className="text-[12px] leading-relaxed text-slate-600">{c.accion.texto}</p>
              : <p className="text-[12px] text-slate-400">Sin datos suficientes para sugerir una acción.</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VistaEquipo() {
  const { data: catalogo, isLoading: cargandoCat, error: errorCat } = useCampanasPublicas();
  const { data: seguimientos, isLoading: cargandoSeg, error: errorSeg } = useSeguimientos();
  const { data: rol } = useUserRole();

  // El C-level ve las campañas de toda la región. El Country Manager y los ejecutivos ven
  // las de su país, igual que en el resto del panel — y nunca con `===`, porque las
  // fuentes escriben Mexico/México y Peru/Perú de las dos formas.
  const soloSuPais = rol?.rol === 'Country Manager' || rol?.rol === 'Ejecutivo';
  const paisPropio = rol?.pais;

  const { activas, pasadas } = useMemo(() => {
    const act: Fila[] = [];
    const pas: Fila[] = [];
    for (const campana of catalogo?.campanas ?? []) {
      const seg = seguimientos?.[campana.slug];
      if (!seg) continue;                                   // sin seguimiento = no aprobada

      if (soloSuPais && paisPropio) {
        const paises = campana.base?.paises ?? [];
        // Una campaña sin países declarados es regional: la ve todo el mundo.
        if (paises.length && !paises.some((p) => mismoPais(p, paisPropio))) continue;
      }

      if (ESTADOS_ACTIVOS.includes(seg.estado)) act.push({ campana, seg });
      else if (ESTADOS_PASADOS.includes(seg.estado)) pas.push({ campana, seg });
    }
    return { activas: act, pasadas: pas };
  }, [catalogo, seguimientos, soloSuPais, paisPropio]);

  const cargando = cargandoCat || cargandoSeg;
  const error = (errorCat ?? errorSeg) as Error | null;

  return (
    <div className="py-5">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Campañas comerciales</h1>
        <p className="mt-0.5 text-[13px] text-slate-500">
          Las campañas en curso y las que ya terminaron, con el incentivo asociado.
          {soloSuPais && paisPropio ? ` Se muestran las de ${paisPropio}.` : ''}
        </p>
      </div>

      {cargando ? (
        <div className="flex h-40 items-center justify-center">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-transparent"
                aria-label="Cargando" />
        </div>
      ) : error ? (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[13.5px] font-medium text-amber-900">No se pudieron cargar las campañas.</p>
          <p className="mt-1 font-mono text-[11.5px] break-all text-amber-800">{error.message}</p>
        </div>
      ) : (
        <>
          <Grupo
            titulo="Campañas activas"
            filas={activas}
            vacio={soloSuPais && paisPropio
              ? `No hay campañas en curso para ${paisPropio}. Cuando se apruebe una, aparece acá con su incentivo y su fecha objetivo.`
              : 'No hay campañas en curso. Cuando se apruebe una, aparece acá con su incentivo y su fecha objetivo.'}
          />
          <Grupo
            titulo="Campañas pasadas"
            filas={pasadas}
            vacio="Todavía no hay campañas cerradas."
          />
        </>
      )}
    </div>
  );
}
