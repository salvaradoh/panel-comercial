import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { Campana, Destinatario, Seguimiento } from '../../hooks/useCampanas';
import { useEquipoComercial, indexarPorNombre, claveNombre, esPersona } from '../../hooks/useEquipo';
import { useAvanceCampana } from '../../hooks/useCampanas';
import { useEnviarCorreo } from '../../hooks/useEnviarCorreo';
import { useTrampaDeFoco } from '../../hooks/useTrampaDeFoco';
import { claveCuenta, construirCorreo, construirCorreoClientes, construirMime } from './correo';
import { estiloTipo } from './formato';

const ROL_AREA = 'Área de incentivos';

/**
 * Deriva a quién le corresponde el correo: los ejecutivos que tienen cuentas en la base
 * objetivo de ESTA campaña —no todo el equipo— más la persona del área que pone el
 * incentivo. Es lo que pidió el flujo: si la campaña es de un país o de unos ejecutivos
 * puntuales, solo les llega a ellos.
 *
 * Se cruza por nombre normalizado contra `Codigos Vendedores`. Los nombres que la cartera
 * usa como bolsa ("Otros", "País") no son personas y quedan fuera.
 */
export function destinatariosSugeridos(
  campana: Campana,
  seg: Seguimiento,
  equipo: ReturnType<typeof indexarPorNombre>,
): { lista: Destinatario[]; sinCorreo: string[] } {
  const lista: Destinatario[] = [];
  const sinCorreo: string[] = [];
  const vistos = new Set<string>();

  for (const k of campana.base?.kams ?? []) {
    if (!esPersona(k.nombre)) continue;
    const p = equipo.get(claveNombre(k.nombre));
    if (!p) { sinCorreo.push(k.nombre); continue; }
    if (vistos.has(p.email)) continue;
    vistos.add(p.email);
    lista.push({ email: p.email, nombre: p.nombre, rol: p.rol || 'Ejecutivo' });
  }

  // Sin incentivo no hay área que sumar: agregarla obligaría a alguien de Marketing a
  // leer un correo que no le pide nada.
  const contacto = seg.incentivo_tipo === 'ninguno'
    ? '' : seg.incentivo_contacto.trim().toLowerCase();
  if (contacto.includes('@') && !vistos.has(contacto)) {
    lista.push({ email: contacto, nombre: seg.incentivo_area || 'Área de incentivos', rol: ROL_AREA });
  }
  return { lista, sinCorreo };
}

interface Props {
  campana: Campana;
  seguimiento: Seguimiento;
  onCerrar: () => void;
  onEnviado: (destinatarios: Destinatario[], asunto: string) => void;
}

export function ModalEnviar({ campana, seguimiento, onCerrar, onEnviado }: Props) {
  const tipo = estiloTipo(campana.tipo);
  const { data: equipo, isLoading: cargandoEquipo } = useEquipoComercial();
  const { enviar, enviando, error } = useEnviarCorreo();

  const indice = useMemo(() => indexarPorNombre(equipo), [equipo]);
  const sugerido = useMemo(
    () => destinatariosSugeridos(campana, seguimiento, indice),
    [campana, seguimiento, indice],
  );

  const [destinatarios, setDestinatarios] = useState<Destinatario[]>([]);
  const [nuevo, setNuevo] = useState('');
  const [errorNuevo, setErrorNuevo] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  // Segundo correo, con la lista de cuentas. Va aparte del anuncio para que ese se lea de
  // un vistazo y este quede como material de trabajo. Solo tiene sentido si hay cuentas.
  const hayCuentas = (campana.cuentas?.length ?? 0) > 0;
  const [enviarLista, setEnviarLista] = useState(true);
  const [verPrevia, setVerPrevia] = useState<'anuncio' | 'cuentas'>('anuncio');
  // Si el anuncio sale y la lista falla, no se puede reintentar todo: reenviar duplicaría
  // el anuncio. Se guarda cuál ya salió para que el reintento mande solo lo que falta.
  const [anuncioEnviado, setAnuncioEnviado] = useState(false);
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const dialogoRef = useRef<HTMLDivElement>(null);

  // Los guardados ganan sobre los sugeridos: si alguien ya ajustó la lista, se respeta.
  useEffect(() => {
    if (cargandoEquipo) return;
    setDestinatarios(seguimiento.destinatarios.length ? seguimiento.destinatarios : sugerido.lista);
  }, [cargandoEquipo, seguimiento.destinatarios, sugerido.lista]);

  useEffect(() => { cerrarRef.current?.focus(); }, []);
  useTrampaDeFoco(dialogoRef, true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !enviando) onCerrar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCerrar, enviando]);

  const correo = useMemo(
    () => construirCorreo(campana, seguimiento, destinatarios),
    [campana, seguimiento, destinatarios],
  );
  // El avance trae, por cuenta, qué tiene que hacer el ejecutivo. Se pide solo si la
  // campaña tiene cuentas. Si todavía no llegó, el correo sale sin esa línea en vez de
  // esperar: es preferible a bloquear el envío por un dato de apoyo.
  const { data: avance } = useAvanceCampana(hayCuentas ? campana.slug : null);
  const acciones = useMemo(() => {
    const m = new Map<string, NonNullable<typeof avance>['cuentas'][number]['accion']>();
    for (const c of avance?.cuentas ?? []) m.set(claveCuenta(c), c.accion);
    return m;
  }, [avance]);

  const correoLista = useMemo(
    () => (hayCuentas
      ? construirCorreoClientes(campana, seguimiento, acciones, avance?.accion_general)
      : null),
    [campana, seguimiento, hayCuentas, acciones, avance?.accion_general],
  );
  const conLista = Boolean(correoLista) && enviarLista;
  const previa = verPrevia === 'cuentas' && correoLista ? correoLista : correo;

  const agregar = () => {
    const email = nuevo.trim().toLowerCase();
    if (!email) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setErrorNuevo('No parece un correo válido.'); return; }
    if (destinatarios.some((d) => d.email === email)) { setErrorNuevo('Ya está en la lista.'); return; }
    const p = equipo?.find((x) => x.email === email);
    setDestinatarios((d) => [...d, { email, nombre: p?.nombre ?? email.split('@')[0], rol: p?.rol ?? ROL_AREA }]);
    setNuevo('');
    setErrorNuevo('');
  };

  const onEnviar = async () => {
    if (!destinatarios.length) return;
    const para = destinatarios.map((d) => d.email);
    try {
      // En serie y no en paralelo: el permiso de Gmail se pide en el primer envío, y dos
      // llamadas simultáneas abrirían dos ventanas de consentimiento.
      if (!anuncioEnviado) {
        await enviar(construirMime(para, correo));
        setAnuncioEnviado(true);
        onEnviado(destinatarios, correo.asunto);
      }
      if (conLista && correoLista) {
        await enviar(construirMime(para, correoLista));
        onEnviado(destinatarios, correoLista.asunto);
      }
      setAnuncioEnviado(false);
    } catch {
      // useEnviarCorreo ya expone el error; el modal queda abierto para reintentar.
      // anuncioEnviado se conserva a propósito: el reintento manda solo lo que falta.
      setConfirmando(false);
    }
  };

  return (
    <>
      <motion.div
        className="fixed inset-0 z-50 bg-slate-900/40"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={() => !enviando && onCerrar()}
        aria-hidden="true"
      />
      <motion.div
        ref={dialogoRef}
        role="dialog" aria-modal="true" aria-labelledby="titulo-enviar"
        initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -12, filter: 'blur(4px)' }}
        transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
        className="fixed left-1/2 top-1/2 z-50 flex alto-modal w-[min(94vw,760px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <div className="min-w-0">
            <h2 id="titulo-enviar" className="text-[15px] font-semibold tracking-tight text-slate-900">
              Comunicar la campaña
            </h2>
            <p className="mt-0.5 text-[12.5px] text-slate-600">
              El correo sale desde tu cuenta. No se puede deshacer.
            </p>
          </div>
          <button
            ref={cerrarRef}
            onClick={onCerrar}
            disabled={enviando}
            aria-label="Cerrar sin enviar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 active:scale-[0.96] disabled:opacity-40"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {/* ------------------------------------------------------- destinatarios */}
          <section className="px-5 py-4">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              Destinatarios ({destinatarios.length})
            </h3>

            {cargandoEquipo ? (
              <p className="text-[12.5px] text-slate-600">Resolviendo los correos del equipo…</p>
            ) : (
              <>
                <ul className="mb-2 flex flex-wrap gap-2">
                  {destinatarios.map((d) => (
                    <li
                      key={d.email}
                      className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[12px] ${
                        d.rol === ROL_AREA
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="font-medium">{d.nombre}</span>
                      <span className="text-slate-500">{d.email}</span>
                      <button
                        onClick={() => setDestinatarios((x) => x.filter((y) => y.email !== d.email))}
                        aria-label={`Quitar a ${d.nombre} de los destinatarios`}
                        className="-my-1 ml-0.5 flex h-8 min-h-[32px] w-8 items-center justify-center rounded text-[15px] leading-none text-slate-600 transition-colors duration-150 hover:bg-rose-100 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 active:scale-[0.96]"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                  {!destinatarios.length && (
                    <li className="text-[12.5px] text-rose-700">
                      No hay destinatarios. Agregá al menos uno para poder enviar.
                    </li>
                  )}
                </ul>

                {sugerido.sinCorreo.length > 0 && (
                  <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-900">
                    Sin correo en la hoja del equipo: {sugerido.sinCorreo.join(', ')}. Agregalos a mano
                    si corresponde.
                  </p>
                )}

                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-slate-600">
                    Agregar otro correo
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={nuevo}
                      onChange={(e) => { setNuevo(e.target.value); setErrorNuevo(''); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }}
                      placeholder="persona@apprecio.com"
                      aria-invalid={Boolean(errorNuevo)}
                      aria-describedby={errorNuevo ? 'error-correo' : undefined}
                      className="min-h-[40px] flex-1 rounded-lg border border-slate-300 px-2.5 text-[13px] text-slate-800 transition-colors placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                    <button
                      onClick={agregar}
                      className="min-h-[40px] rounded-lg border border-slate-300 px-3 text-[13px] font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 active:scale-[0.96]"
                    >
                      Agregar
                    </button>
                  </div>
                  {errorNuevo && (
                    <p id="error-correo" role="alert" className="mt-1 text-[12px] text-rose-700">{errorNuevo}</p>
                  )}
                </label>
              </>
            )}
          </section>

          {/* ---------------------------------------------------------- vista previa */}
          <section className="border-t border-slate-100 px-5 py-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                Vista previa
              </h3>
              {correoLista && (
                <div role="tablist" aria-label="Cuál de los dos correos se previsualiza"
                     className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
                  {([['anuncio', 'Anuncio'], ['cuentas', 'Cuentas']] as const).map(([k, etiqueta]) => (
                    <button
                      key={k}
                      role="tab"
                      aria-selected={verPrevia === k}
                      onClick={() => setVerPrevia(k)}
                      className={`min-h-[32px] rounded-md px-3 text-[12px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                        verPrevia === k
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {etiqueta}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {correoLista && (
              <label className="mb-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <input
                  type="checkbox"
                  checked={enviarLista}
                  onChange={(e) => setEnviarLista(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-slate-700"
                />
                <span className="text-[12.5px] leading-snug text-slate-700">
                  Enviar también el correo con las {campana.cuentas.length} cuentas seleccionadas.
                  <span className="block text-slate-500">
                    Son dos mensajes distintos, a los mismos destinatarios.
                  </span>
                </span>
              </label>
            )}

            <p className="mb-2 text-[12.5px] text-slate-700">
              <span className="text-slate-500">Asunto:</span> {previa.asunto}
            </p>
            {/* srcDoc + sandbox vacío: el HTML es nuestro, pero igual se aísla del panel. */}
            <iframe
              title="Vista previa del correo"
              srcDoc={previa.html}
              sandbox=""
              className="h-80 w-full rounded-xl border border-slate-200 bg-slate-50"
            />
          </section>

          {seguimiento.envios.length > 0 && (
            <section className="border-t border-slate-100 px-5 py-4">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                Ya se envió antes
              </h3>
              <ul className="space-y-1">
                {[...seguimiento.envios].reverse().map((e, i) => (
                  <li key={i} className="text-[12px] tabular-nums text-slate-600">
                    {new Date(e.ts).toLocaleString('es-CL', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })} · {e.para.length} destinatarios · {e.por}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* -------------------------------------------------------------- acciones */}
        <footer className="border-t border-slate-200 bg-slate-50 px-5 py-3">
          {error && (
            <p role="alert" className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[12.5px] text-rose-800">
              {error.message}
            </p>
          )}
          {confirmando ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex-1 text-[13px] font-medium text-slate-800">
                {anuncioEnviado
                  ? 'El anuncio ya salió. Falta el correo con las cuentas. ¿Reintentar?'
                  : `Se ${conLista ? 'enviarán 2 correos' : 'enviará 1 correo'} a ${
                      destinatarios.length} ${
                      destinatarios.length === 1 ? 'persona' : 'personas'}. ¿Confirmás?`}
              </span>
              <button
                onClick={() => setConfirmando(false)}
                disabled={enviando}
                className="min-h-[40px] rounded-lg border border-slate-300 px-3 text-[13px] font-medium text-slate-700 transition-colors duration-150 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 active:scale-[0.96] disabled:opacity-40"
              >
                Volver
              </button>
              <button
                onClick={onEnviar}
                disabled={enviando}
                className="min-h-[40px] rounded-lg px-4 text-[13px] font-medium text-white transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.96] disabled:opacity-50"
                style={{ background: tipo.color, ['--tw-ring-color' as string]: tipo.color }}
              >
                {enviando ? 'Enviando…' : 'Sí, enviar ahora'}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={onCerrar}
                className="min-h-[40px] rounded-lg border border-slate-300 px-3 text-[13px] font-medium text-slate-700 transition-colors duration-150 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 active:scale-[0.96]"
              >
                Cancelar
              </button>
              <button
                onClick={() => setConfirmando(true)}
                disabled={!destinatarios.length || cargandoEquipo}
                className="min-h-[40px] rounded-lg px-4 text-[13px] font-medium text-white transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.96] disabled:opacity-50"
                style={{ background: tipo.color, ['--tw-ring-color' as string]: tipo.color }}
              >
                Revisar y enviar
              </button>
            </div>
          )}
        </footer>
      </motion.div>
    </>
  );
}
