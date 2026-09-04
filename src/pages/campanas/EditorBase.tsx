import { useMemo, useState } from 'react';
import type { CuentaBase } from '../../hooks/useCampanas';
import { kamsDeCuentas, useBuscarCuentas } from '../../hooks/useCampanas';
import { useEquipoComercial } from '../../hooks/useEquipo';
import { numero, usd } from './formato';

/**
 * Edita la base objetivo de una campaña.
 *
 * Las **cuentas son la fuente de verdad** y los ejecutivos se derivan de ellas. Por eso:
 * quitar un ejecutivo quita sus cuentas, y cuando a un ejecutivo no le queda ninguna deja
 * de aparecer solo — no hay dos listas que se puedan contradecir. Sumar un ejecutivo trae
 * sus cuentas de la cartera; también se puede sumar un cliente puntual por nombre.
 */

const BOTON =
  'min-h-[40px] rounded-lg px-3 text-[13px] font-medium transition-colors duration-150 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.96] ' +
  'disabled:cursor-not-allowed disabled:opacity-40';

const INPUT =
  'w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[13px] text-slate-800 ' +
  'transition-colors duration-150 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none ' +
  'focus:ring-2 focus:ring-slate-200';

const clave = (c: CuentaBase) => `${c.pais}||${c.panel_id}`;

interface Props {
  cuentas: CuentaBase[];
  acento: string;
  onCambiar: (cuentas: CuentaBase[]) => void;
  onRestaurar: () => void;
  editada: boolean;
}

export function EditorBase({ cuentas, acento, onCambiar, onRestaurar, editada }: Props) {
  const { data: equipo } = useEquipoComercial();
  const [modo, setModo] = useState<'ejecutivo' | 'cliente' | null>(null);
  const [kamElegido, setKamElegido] = useState('');
  const [texto, setTexto] = useState('');
  const [buscado, setBuscado] = useState('');

  const kams = useMemo(() => kamsDeCuentas(cuentas), [cuentas]);
  const yaEstan = useMemo(() => new Set(cuentas.map(clave)), [cuentas]);
  const total = useMemo(() => cuentas.reduce((a, c) => a + (c.monto_6m_usd ?? 0), 0), [cuentas]);

  const filtro = modo === 'ejecutivo' && kamElegido ? { kam: kamElegido }
               : modo === 'cliente' && buscado ? { q: buscado }
               : null;
  const { data: resultado, isLoading: buscando } = useBuscarCuentas(filtro);

  const candidatas = (resultado?.cuentas ?? []).filter((c) => !yaEstan.has(clave(c)));

  const quitarEjecutivo = (nombre: string) =>
    onCambiar(cuentas.filter((c) => (c.kam ?? '').trim() !== nombre));

  const quitarCuenta = (c: CuentaBase) =>
    onCambiar(cuentas.filter((x) => clave(x) !== clave(c)));

  const sumar = (nuevas: CuentaBase[]) => {
    const map = new Map(cuentas.map((c) => [clave(c), c]));
    nuevas.forEach((c) => map.set(clave(c), c));
    onCambiar([...map.values()]);
  };

  return (
    <div className="space-y-3">
      {/* ------------------------------------------------------------ totales */}
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-[10.5px] uppercase tracking-wide text-slate-600">Cuentas</dt>
          <dd className="text-[18px] font-semibold tabular-nums text-slate-900">{numero(cuentas.length)}</dd>
        </div>
        <div>
          <dt className="text-[10.5px] uppercase tracking-wide text-slate-600">Facturación semestral</dt>
          <dd className="text-[18px] font-semibold tabular-nums text-slate-900">{usd(total)}</dd>
        </div>
      </dl>

      {/* --------------------------------------------------------- ejecutivos */}
      <div>
        <p className="mb-1.5 text-[10.5px] font-medium uppercase tracking-wide text-slate-600">
          Ejecutivos ({kams.length})
        </p>
        {kams.length === 0 ? (
          <p className="text-[12.5px] text-slate-600">
            Sin ejecutivos: la base no tiene cuentas. Agregá alguna abajo.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {kams.map((k) => (
              <li key={k.nombre}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[12px] text-slate-700">
                <span className="font-medium">{k.nombre}</span>
                <span className="tabular-nums text-slate-600">{k.cuentas}</span>
                <button
                  onClick={() => quitarEjecutivo(k.nombre)}
                  aria-label={`Quitar a ${k.nombre} y sus ${k.cuentas} cuentas de la campaña`}
                  className="-my-1 flex h-8 w-8 items-center justify-center rounded text-[15px] leading-none text-slate-600 transition-colors duration-150 hover:bg-rose-100 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 active:scale-[0.96]"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ------------------------------------------------------------ cuentas */}
      <div>
        <p className="mb-1.5 text-[10.5px] font-medium uppercase tracking-wide text-slate-600">
          Cuentas de la base
        </p>
        {cuentas.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-900">
            La base quedó vacía. Sin cuentas no se puede medir el avance de la campaña.
          </p>
        ) : (
          <div className="max-h-64 overflow-auto rounded-xl border border-slate-200">
            <div className="tabla-scroll">
              <table className="w-full border-collapse text-[12px] tabla-apilable">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-left text-[10.5px] uppercase tracking-wide text-slate-600">
                    <th scope="col" className="px-3 py-2 font-medium">Cuenta</th>
                    <th scope="col" className="px-3 py-2 font-medium">Ejecutivo</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">6 meses</th>
                    <th scope="col" className="px-2 py-2"><span className="sr-only">Quitar</span></th>
                  </tr>
                </thead>
                <tbody>
                  {cuentas.map((c) => (
                    <tr key={clave(c)} className="border-t border-slate-100 hover:bg-slate-50">
                      <td data-titular className="max-w-[210px] truncate px-3 py-1.5 text-slate-800" title={c.nombre}>
                        {c.nombre}
                        <span className="ml-1.5 text-[10.5px] text-slate-600">{c.pais}</span>
                      </td>
                      <td data-label="Ejecutivo" className="px-3 py-1.5 text-slate-600">{c.kam ?? '—'}</td>
                      <td data-label="6 meses" className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                        {c.monto_6m_usd != null ? usd(c.monto_6m_usd) : '—'}
                      </td>
                      <td data-label="Quitar" className="px-2 py-1">
                        <button
                          onClick={() => quitarCuenta(c)}
                          aria-label={`Quitar ${c.nombre} de la base objetivo`}
                          className="flex h-8 w-8 items-center justify-center rounded text-[15px] leading-none text-slate-500 transition-colors duration-150 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 active:scale-[0.96]"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------ agregar */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 flex flex-wrap gap-2">
          <button
            onClick={() => setModo(modo === 'ejecutivo' ? null : 'ejecutivo')}
            aria-pressed={modo === 'ejecutivo'}
            className={`${BOTON} border ${modo === 'ejecutivo' ? 'border-slate-500 bg-white text-slate-900' : 'border-slate-300 text-slate-700 hover:bg-white'}`}
            style={{ ['--tw-ring-color' as string]: acento }}
          >
            Sumar un ejecutivo
          </button>
          <button
            onClick={() => setModo(modo === 'cliente' ? null : 'cliente')}
            aria-pressed={modo === 'cliente'}
            className={`${BOTON} border ${modo === 'cliente' ? 'border-slate-500 bg-white text-slate-900' : 'border-slate-300 text-slate-700 hover:bg-white'}`}
            style={{ ['--tw-ring-color' as string]: acento }}
          >
            Sumar un cliente
          </button>
          {editada && (
            <button
              onClick={onRestaurar}
              className={`${BOTON} ml-auto border border-slate-300 text-slate-700 hover:bg-white`}
              style={{ ['--tw-ring-color' as string]: '#94A3B8' }}
            >
              Volver a la base del brief
            </button>
          )}
        </div>

        {modo === 'ejecutivo' && (
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-600">Ejecutivo</span>
            <select className={INPUT} value={kamElegido} onChange={(e) => setKamElegido(e.target.value)}>
              <option value="">Elegí a quién sumar…</option>
              {(equipo ?? []).map((p) => (
                <option key={p.email} value={p.nombre}>{p.nombre} — {p.rol} ({p.pais})</option>
              ))}
            </select>
          </label>
        )}

        {modo === 'cliente' && (
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-600">Nombre del cliente</span>
            <div className="flex gap-2">
              <input
                className={INPUT} type="text" value={texto} placeholder="Parte del nombre"
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setBuscado(texto.trim()); } }}
              />
              <button onClick={() => setBuscado(texto.trim())} disabled={!texto.trim()}
                      className={`${BOTON} border border-slate-300 text-slate-700 hover:bg-white`}
                      style={{ ['--tw-ring-color' as string]: acento }}>
                Buscar
              </button>
            </div>
          </label>
        )}

        {modo && (
          <div className="mt-2">
            {buscando ? (
              <p className="text-[12px] text-slate-600">Buscando…</p>
            ) : !filtro ? (
              <p className="text-[12px] text-slate-600">
                {modo === 'ejecutivo' ? 'Elegí un ejecutivo para ver sus cuentas.' : 'Escribí un nombre y buscá.'}
              </p>
            ) : candidatas.length === 0 ? (
              <p className="text-[12px] text-slate-600">
                No hay cuentas nuevas para sumar{resultado?.cuentas.length ? ' (todas ya están en la base)' : ''}.
              </p>
            ) : (
              <>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[12px] text-slate-700">
                    {candidatas.length} {candidatas.length === 1 ? 'cuenta disponible' : 'cuentas disponibles'}
                  </span>
                  {modo === 'ejecutivo' && (
                    <button onClick={() => sumar(candidatas)}
                            className={`${BOTON} px-3 text-white`}
                            style={{ background: acento, ['--tw-ring-color' as string]: acento }}>
                      Sumar las {candidatas.length}
                    </button>
                  )}
                </div>
                <ul className="max-h-44 space-y-1 overflow-auto">
                  {candidatas.map((c) => (
                    <li key={clave(c)} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5">
                      <span className="flex-1 truncate text-[12px] text-slate-800" title={c.nombre}>
                        {c.nombre}
                        <span className="ml-1.5 text-[10.5px] text-slate-600">{c.pais} · {c.kam}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-[11.5px] text-slate-600">
                        {c.monto_6m_usd != null ? usd(c.monto_6m_usd) : '—'}
                      </span>
                      <button
                        onClick={() => sumar([c])}
                        aria-label={`Sumar ${c.nombre} a la base objetivo`}
                        className="min-h-[32px] shrink-0 rounded-md border border-slate-300 px-2 text-[11.5px] font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 active:scale-[0.96]"
                      >
                        Sumar
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
