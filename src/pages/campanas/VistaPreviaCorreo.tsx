import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import type { Campana, Seguimiento } from '../../hooks/useCampanas';
import { useTrampaDeFoco } from '../../hooks/useTrampaDeFoco';
import { construirCorreo } from './correo';

/**
 * Muestra, tal cual, el correo que va a recibir el ejecutivo.
 *
 * Reemplaza al bloque de "pitch" suelto: el pitch por sí solo no decía qué le llega a la
 * persona ni cómo se ve. Acá se renderiza el HTML real —el mismo que arma el envío— así
 * que lo que se revisa es exactamente lo que sale.
 *
 * El iframe va con `sandbox` vacío: el HTML es nuestro y está escapado, pero igual se
 * aísla del panel.
 */
export function VistaPreviaCorreo({
  campana,
  seguimiento,
  onCerrar,
}: {
  campana: Campana;
  seguimiento: Seguimiento;
  onCerrar: () => void;
}) {
  const correo = construirCorreo(campana, seguimiento, []);
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const dialogoRef = useRef<HTMLDivElement>(null);

  useEffect(() => { cerrarRef.current?.focus(); }, []);
  useTrampaDeFoco(dialogoRef, true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCerrar]);

  return (
    <>
      <motion.div
        className="fixed inset-0 z-[60] bg-slate-900/40"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onCerrar}
        aria-hidden="true"
      />
      <motion.div
        ref={dialogoRef}
        role="dialog" aria-modal="true" aria-labelledby="titulo-vista-correo"
        initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -12, filter: 'blur(4px)' }}
        transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
        className="fixed left-1/2 top-1/2 z-[60] flex alto-modal w-[min(94vw,700px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <div className="min-w-0">
            <h2 id="titulo-vista-correo" className="text-[15px] font-semibold tracking-tight text-slate-900">
              Lo que recibe el ejecutivo
            </h2>
            <p className="mt-0.5 truncate text-[12.5px] text-slate-600">
              <span className="text-slate-500">Asunto:</span> {correo.asunto}
            </p>
          </div>
          <button
            ref={cerrarRef}
            onClick={onCerrar}
            aria-label="Cerrar la vista previa"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 active:scale-[0.96]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-hidden bg-slate-100 p-3">
          <iframe
            title="Vista previa del correo de la campaña"
            srcDoc={correo.html}
            sandbox=""
            className="h-full min-h-[420px] w-full rounded-xl border border-slate-200 bg-white"
          />
        </div>

        <footer className="border-t border-slate-200 bg-slate-50 px-5 py-2.5">
          <p className="text-[11.5px] leading-relaxed text-slate-600">
            El destello del encabezado se anima en Gmail. Si el cliente de correo bloquea
            imágenes, en su lugar aparece una estrella, no un hueco.
          </p>
        </footer>
      </motion.div>
    </>
  );
}
