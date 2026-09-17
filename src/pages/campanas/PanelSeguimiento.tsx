import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Campana, Destinatario, Seguimiento } from '../../hooks/useCampanas';
import {
  ESTADOS, ETIQUETA_ESTADO, ETIQUETA_INCENTIVO, SEGUIMIENTO_VACIO, TIPOS_INCENTIVO,
  aplicarOverrides, useAvanceCampana, useGuardarSeguimiento, useSeguimiento,
} from '../../hooks/useCampanas';
import { useAuth } from '../../auth/AuthContext';
import { ESTILO_ESTADO, UNIDAD_INCENTIVO, estiloTipo, numero, usd } from './formato';
import { AvanceBase } from './AvanceBase';
import { EditorBase } from './EditorBase';
// La plantilla del correo arrastra el GIF de las estrellas (~50 KB en base64) y solo hace
// falta al previsualizar o enviar. Cargarla aparte deja el tab liviano para el resto.
const ModalEnviar = lazy(() => import('./ModalEnviar').then((m) => ({ default: m.ModalEnviar })));
const VistaPreviaCorreo = lazy(() =>
  import('./VistaPreviaCorreo').then((m) => ({ default: m.VistaPreviaCorreo })));
import { useTrampaDeFoco } from '../../hooks/useTrampaDeFoco';

// Lottie pesa más que toda esta vista junta y solo se usa en el instante en que una
// campaña se cierra. Cargarlo aparte deja el tab liviano para el 99% de las visitas.
const Celebracion = lazy(() =>
  import('./Celebracion').then((m) => ({ default: m.Celebracion })),
);

/* --------------------------------------------------------------------- piezas */

const INPUT =
  'w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[13px] text-slate-800 ' +
  'transition-colors duration-150 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none ' +
  'focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-500';

// 40×40 es el mínimo aceptable en escritorio denso; 44 en cualquier control principal.
const BOTON =
  'min-h-[40px] rounded-lg px-3 text-[13px] font-medium transition-colors duration-150 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.96] ' +
  'disabled:cursor-not-allowed disabled:opacity-40';

function Campo({ etiqueta, children, ayuda }: { etiqueta: string; children: React.ReactNode; ayuda?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10.5px] font-medium uppercase tracking-wide text-slate-600">{etiqueta}</span>
      {children}
      {ayuda && <span className="mt-1 block text-[11px] leading-snug text-slate-500">{ayuda}</span>}
    </label>
  );
}

function Seccion({ titulo, children, accion }: { titulo: string; children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <section className="border-t border-slate-100 px-5 py-4">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">{titulo}</h3>
        {accion}
      </div>
      {children}
    </section>
  );
}

/* ---------------------------------------------------------------------- panel */

interface Props {
  campana: Campana;
  puedeEditar: boolean;
  onCerrar: () => void;
}

/**
 * Panel de una campaña: el detalle (editable), el avance medido contra la base objetivo,
 * el seguimiento y la comunicación al equipo.
 *
 * El flujo real que modela: los Admin eligen la campaña del análisis y definen el
 * incentivo → el C-level la aprueba en reunión → recién entonces se comunica por correo a
 * los ejecutivos involucrados y a la persona del área que pone el incentivo. Por eso el
 * envío está al final, detrás de una confirmación, y no es lo primero que se ve.
 */
export function PanelSeguimiento({ campana: publicada, puedeEditar, onCerrar }: Props) {
  const { user } = useAuth();
  const { data: guardado, isLoading: cargandoSeg, error: errorSeg } = useSeguimiento(publicada.slug);
  const { data: avance, isLoading: cargandoAvance, error: errorAvance } = useAvanceCampana(publicada.slug);
  const guardar = useGuardarSeguimiento(publicada.slug);

  const [borrador, setBorrador] = useState<Seguimiento>(SEGUIMIENTO_VACIO);
  const [notaNueva, setNotaNueva] = useState('');
  const [hitoNuevo, setHitoNuevo] = useState('');
  const [editandoDetalle, setEditandoDetalle] = useState(false);
  const [editandoBase, setEditandoBase] = useState(false);
  const [celebrar, setCelebrar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [viendoCorreo, setViendoCorreo] = useState(false);
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => { if (guardado) setBorrador(guardado); }, [guardado]);
  useEffect(() => { cerrarRef.current?.focus(); }, [publicada.slug]);
  // Mientras el modal de envío está abierto, la trampa la maneja el modal, no el panel.
  useTrampaDeFoco(panelRef, !enviando);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !enviando) onCerrar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCerrar, enviando]);

  // Lo que se muestra y lo que se manda por correo es la campaña publicada con las
  // ediciones del Admin encima.
  const campana = useMemo(() => aplicarOverrides(publicada, borrador.overrides), [publicada, borrador.overrides]);
  const tipo = estiloTipo(campana.tipo);
  const est = ESTILO_ESTADO[borrador.estado];
  // La unidad del monto sigue al tipo de incentivo: puntos Apprecio no son dólares.
  const unidad = UNIDAD_INCENTIVO[borrador.incentivo_tipo] ?? UNIDAD_INCENTIVO[''];

  const sucio = useMemo(
    () => JSON.stringify({ ...borrador, actualizado_en: 0, actualizado_por: '' })
       !== JSON.stringify({ ...(guardado ?? SEGUIMIENTO_VACIO), actualizado_en: 0, actualizado_por: '' }),
    [borrador, guardado],
  );

  /**
   * El avance lo calcula el backend sobre la base PUBLICADA, que no conoce las ediciones:
   * esas viven en Firestore y las escribe el navegador. Sin recortarlo, el panel mostraba
   * la misma campaña dos veces y en desacuerdo — arriba la base editada y abajo la lista
   * completa, con las cuentas que se acababan de quitar todavía presentes y contadas.
   *
   * Se recortan las filas y se recalcula el resumen entero: dejar los totales del backend
   * sobre una lista más corta daría porcentajes que no cierran con lo que se ve.
   */
  const avanceVisible = useMemo(() => {
    if (!avance?.medible || !borrador.overrides.cuentas) return avance;
    const enBase = new Set(campana.cuentas.map((c) => `${c.pais}||${c.panel_id}`));
    const cuentas = avance.cuentas.filter((c) => enBase.has(`${c.pais}||${c.panel_id}`));
    const cuenta = (f: (c: (typeof cuentas)[number]) => boolean) => cuentas.filter(f).length;
    return {
      ...avance,
      total: cuentas.length,
      cuentas,
      resumen: {
        logrados: cuenta((c) => c.logrado),
        pendientes: cuenta((c) => !c.logrado && c.encontrada),
        sin_dato: cuenta((c) => !c.encontrada),
        mejoraron: cuenta((c) => c.movimiento === 'mejoro'),
        empeoraron: cuenta((c) => c.movimiento === 'empeoro'),
        compraron: cuenta((c) => Boolean(c.compro_desde_inicio)),
        monto_antes_usd: cuentas.reduce((a, c) => a + (c.monto_antes_usd ?? 0), 0),
        monto_ahora_usd: cuentas.reduce((a, c) => a + (c.monto_ahora_usd ?? 0), 0),
      },
    };
  }, [avance, borrador.overrides.cuentas, campana.cuentas]);

  const aplicar = (parcial: Partial<Seguimiento>) => setBorrador((b) => ({ ...b, ...parcial }));
  const editarOverride = (campo: keyof NonNullable<Seguimiento['overrides']>, valor: string) =>
    setBorrador((b) => ({ ...b, overrides: { ...b.overrides, [campo]: valor } }));

  const onGuardar = () => {
    const cerrabaAhora = borrador.estado === 'cerrada' && guardado?.estado !== 'cerrada';
    guardar.mutate(borrador, { onSuccess: () => { if (cerrabaAhora) setCelebrar(true); } });
  };

  // Enviar el correo es irreversible, así que el registro del envío se persiste enseguida
  // y no se deja pendiente de que alguien apriete "Guardar".
  const onEnviado = (destinatarios: Destinatario[], asunto: string) => {
    const actualizado: Seguimiento = {
      ...borrador,
      destinatarios,
      envios: [...borrador.envios, {
        ts: Date.now(), por: user?.email ?? '', para: destinatarios.map((d) => d.email), asunto,
      }],
      estado: borrador.estado === 'propuesta' || borrador.estado === 'aprobada' ? 'en_curso' : borrador.estado,
    };
    setBorrador(actualizado);
    guardar.mutate(actualizado);
    setEnviando(false);
  };

  const yaSeEnvio = borrador.envios.length > 0;

  return (
    <>
      {celebrar && (
        <Suspense fallback={null}>
          <Celebracion onFin={() => setCelebrar(false)} />
        </Suspense>
      )}

      <Suspense fallback={null}>
        <AnimatePresence>
          {viendoCorreo && (
            <VistaPreviaCorreo
              campana={campana}
              seguimiento={borrador}
              onCerrar={() => setViendoCorreo(false)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {enviando && (
            <ModalEnviar
              campana={campana}
              seguimiento={borrador}
              onCerrar={() => setEnviando(false)}
              onEnviado={onEnviado}
            />
          )}
        </AnimatePresence>
      </Suspense>

      <motion.div
        className="fixed inset-0 z-40 bg-slate-900/20"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onCerrar}
        aria-hidden="true"
      />

      <motion.aside
        ref={panelRef}
        role="dialog" aria-modal="true" aria-label={`Campaña: ${campana.nombre}`}
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 260 }}
        className="fixed right-0 top-0 z-40 flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl"
      >
        {/* ---------------------------------------------------------- cabecera */}
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
          <span className="block h-1 w-full" style={{ background: tipo.color }} aria-hidden="true" />
          <div className="flex items-start justify-between gap-3 px-5 py-3.5">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
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
                  {ETIQUETA_ESTADO[borrador.estado]}
                </span>
                {yaSeEnvio && (
                  <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                    Comunicada
                  </span>
                )}
              </div>
              <h2 className="text-[16px] font-semibold leading-snug tracking-tight text-slate-900">
                {campana.nombre}
              </h2>
            </div>
            <button
              ref={cerrarRef}
              onClick={onCerrar}
              aria-label="Cerrar panel"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 active:scale-[0.96]"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </header>

        {/* -------------------------------------------------- detalle (editable) */}
        <Seccion
          titulo="Detalle de la campaña"
          accion={puedeEditar && (
            <button
              onClick={() => setEditandoDetalle((v) => !v)}
              aria-pressed={editandoDetalle}
              className={`${BOTON} border border-slate-300 text-slate-700 hover:bg-slate-50`}
              style={{ ['--tw-ring-color' as string]: '#94A3B8' }}
            >
              {editandoDetalle ? 'Listo' : 'Editar'}
            </button>
          )}
        >
          {editandoDetalle ? (
            <div className="space-y-3">
              <Campo etiqueta="Nombre" ayuda="Si esta campaña continúa la de la semana pasada, mantené el nombre: el seguimiento se ata a él.">
                <input className={INPUT} type="text"
                       value={borrador.overrides.nombre ?? publicada.nombre}
                       onChange={(e) => editarOverride('nombre', e.target.value)} />
              </Campo>
              <Campo etiqueta="Por qué ahora">
                <textarea className={`${INPUT} min-h-[76px] resize-y`}
                          value={borrador.overrides.senal ?? publicada.senal}
                          onChange={(e) => editarOverride('senal', e.target.value)} />
              </Campo>
              <Campo etiqueta="Producto que empuja">
                <textarea className={`${INPUT} min-h-[60px] resize-y`}
                          value={borrador.overrides.producto ?? publicada.producto}
                          onChange={(e) => editarOverride('producto', e.target.value)} />
              </Campo>
              <Campo etiqueta="Pitch para el ejecutivo">
                <textarea className={`${INPUT} min-h-[90px] resize-y`}
                          value={borrador.overrides.pitch ?? publicada.pitch}
                          onChange={(e) => editarOverride('pitch', e.target.value)} />
              </Campo>
              <p className="text-[11px] leading-snug text-slate-500">
                Las ediciones se guardan aparte del brief. Si se regenera el brief, lo editado acá se mantiene.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {campana.senal && (
                <div>
                  <p className="mb-0.5 text-[10.5px] font-medium uppercase tracking-wide text-slate-600">Por qué ahora</p>
                  <p className="text-[13px] leading-relaxed text-slate-700 [font-variant-numeric:tabular-nums]">{campana.senal}</p>
                </div>
              )}
              {campana.producto && (
                <div>
                  <p className="mb-0.5 text-[10.5px] font-medium uppercase tracking-wide text-slate-600">Producto que empuja</p>
                  <p className="text-[13px] leading-relaxed text-slate-700">{campana.producto}</p>
                </div>
              )}
              {campana.pitch && (
                <div>
                  <p className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-slate-600">
                    Lo que recibe el ejecutivo
                  </p>
                  <blockquote className="mb-2 rounded-xl border-l-2 bg-slate-50 px-3.5 py-2.5 text-[13px] italic leading-relaxed text-slate-700"
                              style={{ borderColor: tipo.color }}>
                    {campana.pitch}
                  </blockquote>
                  <button
                    onClick={() => setViendoCorreo(true)}
                    className={`${BOTON} border border-slate-300 text-slate-700 hover:bg-slate-50`}
                    style={{ ['--tw-ring-color' as string]: tipo.color }}
                  >
                    Ver el correo completo
                  </button>
                </div>
              )}
            </div>
          )}
        </Seccion>

        {/* ---------------------------------------------------------- base */}
        <Seccion
          titulo="Base objetivo"
          accion={puedeEditar && campana.cuentas.length > 0 && (
            <button
              onClick={() => setEditandoBase((v) => !v)}
              aria-pressed={editandoBase}
              className={`${BOTON} border border-slate-300 text-slate-700 hover:bg-slate-50`}
              style={{ ['--tw-ring-color' as string]: '#94A3B8' }}
            >
              {editandoBase ? 'Listo' : 'Editar base'}
            </button>
          )}
        >
          {editandoBase ? (
            <EditorBase
              cuentas={campana.cuentas}
              acento={tipo.color}
              editada={Boolean(borrador.overrides.cuentas)}
              onCambiar={(cuentas) =>
                setBorrador((b) => ({ ...b, overrides: { ...b.overrides, cuentas } }))}
              onRestaurar={() =>
                setBorrador((b) => {
                  const { cuentas: _fuera, ...resto } = b.overrides;
                  return { ...b, overrides: resto };
                })}
            />
          ) : campana.base ? (
            <>
              <dl className="mb-3 grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-[10.5px] uppercase tracking-wide text-slate-600">Cuentas</dt>
                  <dd className="text-[18px] font-semibold tabular-nums text-slate-900">{numero(campana.base.clientes)}</dd>
                </div>
                <div>
                  <dt className="text-[10.5px] uppercase tracking-wide text-slate-600">Facturación semestral</dt>
                  <dd className="text-[18px] font-semibold tabular-nums text-slate-900">{usd(campana.base.arr_6m_usd)}</dd>
                </div>
              </dl>
              {!!campana.base.paises?.length && (
                <p className="mb-1.5 text-[12.5px] text-slate-600">
                  Países: <span className="text-slate-800">{campana.base.paises.join(' · ')}</span>
                </p>
              )}
              {!!campana.base.kams?.length && (
                <ul className="flex flex-wrap gap-2">
                  {campana.base.kams.map((k) => (
                    <li key={k.nombre} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11.5px] text-slate-700">
                      {k.nombre}<span className="ml-1 tabular-nums text-slate-600">{k.cuentas}</span>
                    </li>
                  ))}
                </ul>
              )}
              {borrador.overrides.cuentas && (
                <p className="mt-2 text-[11px] text-slate-500">
                  Base editada a mano: ya no es la que trajo el brief.
                </p>
              )}
            </>
          ) : (
            <p className="text-[13px] leading-relaxed text-slate-600">{campana.base_texto || '—'}</p>
          )}
        </Seccion>

        <Seccion titulo="Avance de la base">
          <AvanceBase avance={avanceVisible} cargando={cargandoAvance} error={errorAvance as Error | null} acento={tipo.color} />
        </Seccion>

        {/* ------------------------------------------------------- seguimiento */}
        <Seccion titulo="Seguimiento e incentivo">
          {cargandoSeg ? (
            <p className="text-[12.5px] text-slate-600">Cargando seguimiento…</p>
          ) : errorSeg ? (
            <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-900">
              No se pudo leer el seguimiento. {(errorSeg as Error).message}
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo etiqueta="Estado">
                  <select className={INPUT} value={borrador.estado} disabled={!puedeEditar}
                          onChange={(e) => aplicar({ estado: e.target.value as Seguimiento['estado'] })}>
                    {ESTADOS.map((e) => <option key={e} value={e}>{ETIQUETA_ESTADO[e]}</option>)}
                  </select>
                </Campo>
                <Campo etiqueta="Fecha objetivo">
                  <input className={INPUT} type="date" value={borrador.fecha_objetivo} disabled={!puedeEditar}
                         onChange={(e) => aplicar({ fecha_objetivo: e.target.value })} />
                </Campo>
                <Campo etiqueta="Tipo de incentivo">
                  <select className={INPUT} value={borrador.incentivo_tipo} disabled={!puedeEditar}
                          onChange={(e) => aplicar({ incentivo_tipo: e.target.value as Seguimiento['incentivo_tipo'] })}>
                    <option value="">Sin definir</option>
                    {TIPOS_INCENTIVO.map((t) => <option key={t} value={t}>{ETIQUETA_INCENTIVO[t]}</option>)}
                  </select>
                </Campo>
                <Campo etiqueta="Área que lo aprueba">
                  <input className={INPUT} type="text" value={borrador.incentivo_area} disabled={!puedeEditar}
                         placeholder="Marketing, RR.HH., Comercial"
                         onChange={(e) => aplicar({ incentivo_area: e.target.value })} />
                </Campo>
                <Campo etiqueta="Contacto del área" ayuda="Recibe el correo junto con los ejecutivos.">
                  <input className={INPUT} type="email" value={borrador.incentivo_contacto} disabled={!puedeEditar}
                         placeholder="persona@apprecio.com"
                         onChange={(e) => aplicar({ incentivo_contacto: e.target.value })} />
                </Campo>
              </div>

              <Campo etiqueta="En qué consiste el incentivo">
                <textarea className={`${INPUT} min-h-[64px] resize-y`} value={borrador.incentivo_descripcion}
                          disabled={!puedeEditar}
                          placeholder="Puntos Apprecio por cuenta cerrada, horas libres por Apprecio Beat, viaje para el primer lugar, bono por meta de equipo…"
                          onChange={(e) => aplicar({ incentivo_descripcion: e.target.value })} />
              </Campo>

              <Campo
                etiqueta={`Monto de referencia (${unidad.corta})`}
                ayuda={`Opcional, en ${unidad.larga}. Sirve para dimensionar el pedido al área.`}
              >
                <input className={`${INPUT} tabular-nums`} type="number" min={0} step={unidad.paso}
                       value={borrador.incentivo_monto || ''} disabled={!puedeEditar} placeholder="0"
                       onChange={(e) => aplicar({ incentivo_monto: Number(e.target.value) || 0 })} />
              </Campo>

              {/* ------------------------------------------------------ hitos */}
              <div>
                <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-wide text-slate-600">Hitos</span>
                {borrador.hitos.length > 0 && (
                  <ul className="mb-2 space-y-1">
                    {borrador.hitos.map((h, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <input type="checkbox" checked={h.hecho} disabled={!puedeEditar}
                               id={`hito-${publicada.slug}-${i}`}
                               className="h-4 w-4 shrink-0 rounded border-slate-400 accent-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1"
                               onChange={(e) => aplicar({
                                 hitos: borrador.hitos.map((x, j) => j === i ? { ...x, hecho: e.target.checked } : x),
                               })} />
                        <label htmlFor={`hito-${publicada.slug}-${i}`}
                               className={`flex-1 text-[12.5px] ${h.hecho ? 'text-slate-500 line-through' : 'text-slate-700'}`}>
                          {h.texto}
                        </label>
                        {puedeEditar && (
                          <button onClick={() => aplicar({ hitos: borrador.hitos.filter((_, j) => j !== i) })}
                                  aria-label={`Quitar hito: ${h.texto}`}
                                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[16px] leading-none text-slate-600 transition-colors duration-150 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 active:scale-[0.96]">
                            ×
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {puedeEditar && (
                  <input className={INPUT} type="text" value={hitoNuevo} placeholder="Agregar un hito y apretar Enter"
                         onChange={(e) => setHitoNuevo(e.target.value)}
                         onKeyDown={(e) => {
                           if (e.key !== 'Enter' || !hitoNuevo.trim()) return;
                           e.preventDefault();
                           aplicar({ hitos: [...borrador.hitos, { texto: hitoNuevo.trim(), hecho: false }] });
                           setHitoNuevo('');
                         }} />
                )}
              </div>

              {/* ------------------------------------------------------ notas */}
              <div>
                <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-wide text-slate-600">Bitácora</span>
                {borrador.notas.length > 0 && (
                  <ul className="mb-2 space-y-1.5">
                    {[...borrador.notas].reverse().map((n, i) => (
                      <li key={i} className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                        <p className="text-[12.5px] leading-relaxed text-slate-700">{n.texto}</p>
                        <p className="mt-0.5 text-[10.5px] tabular-nums text-slate-500">
                          {n.autor} · {new Date(n.ts).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                {puedeEditar && (
                  <textarea className={`${INPUT} min-h-[54px] resize-y`} value={notaNueva}
                            placeholder="Anotar avance y apretar Enter"
                            onChange={(e) => setNotaNueva(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter' || e.shiftKey || !notaNueva.trim()) return;
                              e.preventDefault();
                              const autor = (user?.name || user?.email || '').split('@')[0];
                              aplicar({ notas: [...borrador.notas, { texto: notaNueva.trim(), autor, ts: Date.now() }] });
                              setNotaNueva('');
                            }} />
                )}
              </div>

              {puedeEditar ? (
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button onClick={onGuardar} disabled={!sucio || guardar.isPending}
                          className={`${BOTON} px-4 text-white`}
                          style={{ background: tipo.color, ['--tw-ring-color' as string]: tipo.color }}>
                    {guardar.isPending ? 'Guardando…' : 'Guardar'}
                  </button>
                  {/* El error va en bloque y no como una línea al lado del botón: la pantalla
                      muestra la edición apenas se hace —antes de guardar—, así que un guardado
                      fallido se veía igual que uno exitoso y el trabajo se perdía al recargar
                      sin que nadie se enterara. Acá dice explícitamente que NO quedó guardado. */}
                  {guardar.isError && (
                    <div role="alert"
                         className="w-full rounded-lg border border-rose-300 bg-rose-50 px-3 py-2">
                      <p className="text-[12.5px] font-semibold text-rose-900">
                        No se guardó. Los cambios de esta pantalla se van a perder si recargás.
                      </p>
                      <p className="mt-1 break-words text-[11.5px] text-rose-800">
                        {(guardar.error as Error).message}
                      </p>
                    </div>
                  )}
                  {!sucio && borrador.actualizado_en > 0 && (
                    <span className="text-[11.5px] tabular-nums text-slate-500">
                      Guardado {new Date(borrador.actualizado_en).toLocaleString('es-CL', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
              ) : (
                <p className="pt-1 text-[11.5px] text-slate-500">Solo lectura: el seguimiento lo edita un Admin.</p>
              )}
            </div>
          )}
        </Seccion>

        {/* ------------------------------------------------------- comunicar */}
        {puedeEditar && (
          <Seccion titulo="Comunicar al equipo">
            <p className="mb-2.5 text-[12.5px] leading-relaxed text-slate-600">
              Manda la campaña por correo a los ejecutivos con cuentas en la base objetivo y a la
              persona del área que pone el incentivo. Podés revisar y ajustar la lista antes de enviar.
            </p>

            {sucio && (
              <p className="mb-2.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-900">
                Tenés cambios sin guardar. El correo se arma con lo que está en pantalla; conviene
                guardar primero.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setEnviando(true)}
                className={`${BOTON} px-4 text-white`}
                style={{ background: tipo.color, ['--tw-ring-color' as string]: tipo.color }}
              >
                {yaSeEnvio ? 'Volver a enviar' : 'Revisar y enviar'}
              </button>
              {yaSeEnvio && (
                <span className="text-[11.5px] tabular-nums text-slate-600">
                  Último envío: {new Date(borrador.envios[borrador.envios.length - 1].ts)
                    .toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {' · '}{borrador.envios[borrador.envios.length - 1].para.length} destinatarios
                </span>
              )}
            </div>
          </Seccion>
        )}

        <div className="h-6" />
      </motion.aside>
    </>
  );
}

/** Envoltorio con animación de salida: sin AnimatePresence el panel desaparece de golpe. */
export function PanelSeguimientoAnimado(props: Props & { abierto: boolean }) {
  const { abierto, ...resto } = props;
  return <AnimatePresence>{abierto && <PanelSeguimiento key={resto.campana.slug} {...resto} />}</AnimatePresence>;
}
