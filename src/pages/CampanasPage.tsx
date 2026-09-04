import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useBriefCampanas, useSeguimientos, type Campana, type EstadoCampana } from '../hooks/useCampanas';
import { useTrack } from '../hooks/useTrack';
import { Markdown } from './campanas/Markdown';
import { CambiosCartera } from './campanas/CambiosCartera';
import { CampanaCard } from './campanas/CampanaCard';
import { PanelSeguimientoAnimado } from './campanas/PanelSeguimiento';
import { VistaEquipo } from './campanas/VistaEquipo';
import { ACENTO, vinietasDeCambios } from './campanas/formato';

/* ------------------------------------------------------------------ piezas */

function Pregunta({ pregunta, respuesta }: { pregunta: string; respuesta: string }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        onClick={() => setAbierta((v) => !v)}
        aria-expanded={abierta}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
      >
        <span className="text-[13.5px] font-medium text-slate-800">{pregunta}</span>
        <span
          className="shrink-0 text-slate-500 transition-transform duration-150"
          style={{ transform: abierta ? 'rotate(90deg)' : 'none' }}
          aria-hidden="true"
        >
          ▸
        </span>
      </button>
      {abierta && (
        <div className="border-t border-slate-100 px-4 pb-3 pt-1">
          <Markdown texto={respuesta} />
        </div>
      )}
    </div>
  );
}

function Vacio({ motivo }: { motivo?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <p className="text-[14px] font-medium text-slate-800">Todavía no hay un brief publicado</p>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-slate-500">
        El brief se genera con el comando <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px]">/campanas</code>{' '}
        y se publica en la hoja <span className="font-medium">Cache_Campanas</span>. Una vez publicado aparece acá.
      </p>
      {motivo && <p className="mt-3 font-mono text-[11px] text-slate-500">{motivo}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------- vista */

/**
 * Dos vistas detrás del mismo tab:
 *
 * - **Admin**: el brief completo, todas las campañas propuestas, edición e incentivos. Es
 *   la mesa de trabajo donde se decide qué campaña se impulsa.
 * - **El resto del equipo**: solo las campañas ya aprobadas o cerradas, sin el análisis de
 *   cartera ni los nombres de clientes.
 *
 * Quién es quién no se decide acá: `/api/campanas/brief` responde 403 a todo el que no
 * esté en ADMIN_EMAILS, y de ese 403 se deduce la vista. Así el frontend no puede
 * "ascender" a nadie por error.
 */
export function CampanasPage() {
  const { error: errorBrief, isLoading: cargandoBrief } = useBriefCampanas();
  const sinAcceso = (errorBrief as Error | null)?.message.includes('403');

  if (cargandoBrief) {
    return (
      <div className="flex h-40 items-center justify-center">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-transparent"
              aria-label="Cargando" />
      </div>
    );
  }
  if (sinAcceso) return <VistaEquipo />;
  return <VistaAdmin />;
}

function VistaAdmin() {
  const { data: brief, isLoading, error } = useBriefCampanas();
  const { data: seguimientos } = useSeguimientos();
  const [abierta, setAbierta] = useState<Campana | null>(null);
  const { track } = useTrack();

  const errorObj = error as Error | null;

  const campanas = useMemo(
    () => [...(brief?.campanas ?? [])].sort((a, b) => a.prioridad - b.prioridad),
    [brief?.campanas],
  );
  const cambios = useMemo(() => vinietasDeCambios(brief?.markdown ?? ''), [brief?.markdown]);

  // Los estados llegan todos juntos en una sola lectura de la colección, así que la
  // grilla puede mostrar cuál ya se aprobó sin pedir un documento por tarjeta.
  const estadoDe = (c: Campana): EstadoCampana => seguimientos?.[c.slug]?.estado ?? 'propuesta';

  const abrir = (c: Campana) => {
    setAbierta(c);
    track('campana_abierta', c.slug);
  };

  return (
    <div className="py-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Campañas comerciales</h1>
          <p className="mt-0.5 text-[13px] text-slate-500">
            Cambios de la cartera y campañas propuestas. Cada una se abre para ver su base objetivo,
            el avance real y el incentivo que se le pide al área.
          </p>
        </div>
        {brief && !brief.sin_publicar && (
          <div className="text-right">
            <span className="block text-[11.5px] tabular-nums text-slate-500">
              {new Date(brief.generado_en!).toLocaleString('es-CL', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </span>
            {brief.semana_id && (
              <span className="block font-mono text-[11px] text-slate-500">{brief.semana_id}</span>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <span
            className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: ACENTO, borderTopColor: 'transparent' }}
            aria-label="Cargando"
          />
        </div>
      ) : errorObj ? (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[13.5px] font-medium text-amber-900">No se pudo leer el brief.</p>
          <p className="mt-1 font-mono text-[11.5px] break-all text-amber-800">{errorObj.message}</p>
        </div>
      ) : !brief || brief.sin_publicar ? (
        <Vacio motivo={brief?.motivo} />
      ) : (
        <>
          <CambiosCartera vinietas={cambios} />

          <section aria-labelledby="titulo-campanas" className="mb-6">
            <div className="mb-2.5 flex items-baseline justify-between">
              <h2 id="titulo-campanas" className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">
                Campañas propuestas
              </h2>
              <span className="text-[11.5px] tabular-nums text-slate-500">
                {campanas.length} {campanas.length === 1 ? 'campaña' : 'campañas'}
              </span>
            </div>

            {campanas.length === 0 ? (
              <p className="rounded-2xl border border-slate-200 bg-white p-5 text-[13px] text-slate-500 shadow-sm">
                El brief publicado no trae campañas que se puedan mostrar como tarjetas. Abajo queda
                el texto completo.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {campanas.map((c, i) => (
                  <CampanaCard
                    key={c.slug}
                    campana={c}
                    indice={i}
                    estado={estadoDe(c)}
                    activa={abierta?.slug === c.slug}
                    onAbrir={() => abrir(c)}
                  />
                ))}
              </div>
            )}
          </section>

          {(brief.preguntas?.length ?? 0) > 0 && (
            <section aria-label="Preguntas frecuentes sobre la cartera" className="mb-6">
              <h2 className="mb-2.5 text-[12px] font-semibold uppercase tracking-wider text-slate-500">
                Preguntas frecuentes
              </h2>
              <div className="space-y-2">
                {brief.preguntas!.map((p, i) => (
                  <Pregunta key={i} pregunta={p.pregunta} respuesta={p.respuesta} />
                ))}
              </div>
            </section>
          )}

          {/* El brief completo sigue disponible: las tarjetas resumen, no reemplazan. */}
          <motion.details
            className="group rounded-2xl border border-slate-200 bg-white shadow-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          >
            <summary className="cursor-pointer list-none px-5 py-3 text-[12.5px] font-medium text-slate-600 transition-colors hover:text-slate-900">
              Ver el brief completo en texto
            </summary>
            <div className="border-t border-slate-100 px-5 pb-5 pt-1">
              <Markdown texto={brief.markdown ?? ''} />
            </div>
          </motion.details>
        </>
      )}

      {abierta && (
        <PanelSeguimientoAnimado
          abierto
          campana={abierta}
          puedeEditar={Boolean(brief?.puede_editar)}
          onCerrar={() => setAbierta(null)}
        />
      )}
    </div>
  );
}
