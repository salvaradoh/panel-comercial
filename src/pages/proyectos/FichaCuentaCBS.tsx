import { useEffect } from 'react';
import type { ReactNode } from 'react';
import type { FilaCBS } from '../../lib/cbs';
import { estadoDe, ESTADO_META, usdDe, fmtUSDExacto } from '../../lib/cbs';
import { TierChip } from './ui';

/** Países que la hoja evalúa como destino, en el orden en que los escribe. */
const OPORTUNIDAD: { campo: keyof FilaCBS; pais: string }[] = [
  { campo: 'oportunidadChile',    pais: 'Chile' },
  { campo: 'oportunidadColombia', pais: 'Colombia' },
  { campo: 'oportunidadPeru',     pais: 'Perú' },
  { campo: 'oportunidadMexico',   pais: 'México' },
  { campo: 'oportunidadEcuador',  pais: 'Ecuador' },
];

/**
 * Color del veredicto por país. Son tres valores cerrados en la hoja:
 * `Sí` (hay oportunidad), `Cliente` (ya factura ahí) y `No aplica`.
 */
function chipOportunidad(v: string) {
  const s = v.trim().toLowerCase();
  if (s === 'cliente')  return { txt: 'Ya es cliente', clase: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (/^s[íi]$/.test(s)) return { txt: 'Oportunidad',  clase: 'bg-sky-50 text-sky-700 border-sky-200' };
  return { txt: 'No aplica', clase: 'bg-slate-50 text-slate-400 border-slate-200' };
}

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">{titulo}</h4>
      {children}
    </section>
  );
}

function Dato({ label, valor, mono }: { label: string; valor: ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-1 border-b border-slate-50 last:border-0">
      <span className="text-[13px] text-slate-400 flex-shrink-0">{label}</span>
      <span className={`text-[13px] text-slate-700 text-right min-w-0 ${mono ? 'tabular-nums' : ''}`}>
        {valor}
      </span>
    </div>
  );
}

/** Persona con correo: el mailto es la acción concreta que la ficha habilita. */
function Persona({ nombre, area, correo, vacio }: {
  nombre: string; area: string; correo: string; vacio: string;
}) {
  if (!nombre && !correo) return <p className="text-[13px] text-slate-300">{vacio}</p>;
  return (
    <div>
      <p className="text-[13px] font-medium text-slate-700">{nombre || 'Sin nombre registrado'}</p>
      {area && <p className="text-[12px] text-slate-400">{area}</p>}
      {correo && (
        <a
          href={`mailto:${correo}`}
          className="inline-block mt-1 text-[12px] text-[#0097A7] hover:underline break-all"
        >
          {correo}
        </a>
      )}
    </div>
  );
}

interface Props {
  fila: FilaCBS;
  onClose: () => void;
}

/**
 * Ficha de una cuenta del proyecto, como overlay flotante.
 *
 * Mismo patrón que la ficha de cliente de Segmentación y por las mismas razones:
 * **no lleva backdrop**, porque un backdrop —aunque sea transparente— captura los
 * clics y obligaría a cerrar la ficha para elegir otra cuenta. Sin él la tabla
 * sigue viva debajo y se salta de una cuenta a otra sin cerrar. Por eso tampoco
 * es `aria-modal`: no bloquea la página y declararlo modal sería mentirle al
 * lector de pantalla.
 */
export function FichaCuentaCBS({ fila, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const estado = estadoDe(fila);
  const meta = ESTADO_META[estado];
  const usd = usdDe(fila);

  return (
    <aside
      role="dialog"
      aria-label={`Ficha de ${fila.razonSocial || fila.nombreEmpresa}`}
      className="fixed top-24 bottom-4 right-4 left-4 xl:left-[46%] z-40
                 max-h-[760px] rounded-2xl border border-slate-200 bg-white
                 shadow-[0_10px_40px_-8px_rgba(15,23,42,0.35)]
                 flex flex-col overflow-hidden"
    >
      {/* Encabezado */}
      <header className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-slate-800 leading-tight">
            {fila.razonSocial || fila.nombreEmpresa || 'Sin razón social'}
          </h3>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <TierChip tier={fila.segmentacion} />
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-lg px-2 py-0.5"
              style={{ color: meta.color, background: `${meta.color}14`, border: `1px solid ${meta.color}33` }}
              title={meta.ayuda}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
              {meta.label}
            </span>
            <span className="text-[11px] text-slate-400">{fila.paisOrigen} → {fila.paisDestino || 'MX'}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar ficha"
          className="text-slate-400 hover:text-slate-600 text-xl leading-none px-1 active:scale-90 transition-transform"
        >
          ×
        </button>
      </header>

      {/* Cuerpo en dos columnas: la ficha es ancha, apilar todo desperdicia el espacio */}
      <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">

        <Bloque titulo="Cuenta">
          <Dato label="KAM asignado" valor={fila.idKam || '—'} />
          <Dato
            label="Facturación 12m"
            mono
            valor={usd > 0
              ? <span className="font-semibold">{fmtUSDExacto(usd)}</span>
              : <span className="text-slate-300">Sin dato</span>}
          />
          {fila.paginaWeb && (
            <Dato
              label="Web"
              valor={
                <a href={fila.paginaWeb} target="_blank" rel="noopener noreferrer"
                   className="text-[#0097A7] hover:underline break-all">
                  {fila.paginaWeb.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')} ↗
                </a>
              }
            />
          )}
          {fila.paisesConPresencia && (
            <Dato label="Presencia" valor={<span className="text-[12px]">{fila.paisesConPresencia}</span>} />
          )}
        </Bloque>

        <Bloque titulo="Uso de la plataforma">
          <Dato label="Usuarios incentivados" valor={fila.usuariosIncentivados.toLocaleString('es-PE')} mono />
          <Dato label="Abonos totales"        valor={fila.abonosTotales.toLocaleString('es-PE')} mono />
          <Dato label="Empleados"             valor={fila.usuariosEmpleados.toLocaleString('es-PE')} mono />
          <Dato label="Clientes finales"      valor={fila.usuariosClientes.toLocaleString('es-PE')} mono />
          {fila.usuariosComisionistas > 0 && (
            <Dato label="Comisionistas" valor={fila.usuariosComisionistas.toLocaleString('es-PE')} mono />
          )}
        </Bloque>

        <Bloque titulo="Contacto actual">
          <Persona
            nombre={fila.contactoActual}
            area={fila.areaContacto}
            correo={fila.correoContacto}
            vacio="Sin contacto registrado en la hoja"
          />
        </Bloque>

        <Bloque titulo="Sponsor validado">
          <Persona
            nombre={fila.nombreSponsor}
            area={fila.areaSponsor}
            correo={fila.correoSponsor}
            vacio="Todavía no hay sponsor validado"
          />
        </Bloque>

        <div className="md:col-span-2">
          <Bloque titulo={`Oportunidad por país (${fila.totalOpp || 0} en total)`}>
            <div className="flex flex-wrap gap-2">
              {OPORTUNIDAD.map(({ campo, pais }) => {
                const { txt, clase } = chipOportunidad(String(fila[campo] ?? ''));
                return (
                  <span key={pais} className={`text-[11px] rounded-lg border px-2 py-1 ${clase}`}>
                    <span className="font-semibold">{pais}</span>
                    <span className="opacity-70"> · {txt}</span>
                  </span>
                );
              })}
            </div>
          </Bloque>
        </div>

        {fila.motivoCompra && (
          <div className="md:col-span-2">
            <Bloque titulo="Motivo de compra">
              <p className="text-[13px] text-slate-600">{fila.motivoCompra}</p>
            </Bloque>
          </div>
        )}

        {(fila.notas || fila.seguimiento) && (
          <div className="md:col-span-2">
            <Bloque titulo="Notas y seguimiento">
              {fila.notas && (
                <p className="text-[13px] text-slate-600 mb-2">{fila.notas}</p>
              )}
              {fila.seguimiento && (
                <p className="text-[13px] text-slate-600 bg-slate-50 rounded-xl p-3">
                  <span className="text-[11px] uppercase tracking-wide text-slate-400 block mb-0.5">
                    Prospección
                  </span>
                  {fila.seguimiento}
                </p>
              )}
            </Bloque>
          </div>
        )}

        {fila.idKamBdm && (
          <div className="md:col-span-2">
            <Bloque titulo="Derivación">
              <Dato label="Pasó a" valor={`${fila.comercialDestino || '—'} · ${fila.idKamBdm}`} />
              <Dato label="País destino" valor={fila.paisDestino || '—'} />
            </Bloque>
          </div>
        )}
      </div>
    </aside>
  );
}
