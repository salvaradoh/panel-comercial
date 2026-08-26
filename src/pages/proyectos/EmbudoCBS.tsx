import { Card } from '../../components/ui';
import type { EtapaEmbudo, TramoEstado, EstadoCBS } from '../../lib/cbs';
import { ESTADO_META, fmtUSDCorto, fmtUSDExacto } from '../../lib/cbs';

/**
 * Embudo de conversión de la rama ganadora.
 *
 * Cada etapa es un subconjunto estricto de la anterior (verificado: los cierres
 * y las reuniones son todos cuentas con sponsor), así que el % de conversión
 * significa lo que dice. Se muestran cuentas Y USD en cada escalón porque la
 * historia cambia según cuál mires: el 13% de conversión en cuentas mueve una
 * proporción de plata distinta.
 */
export function EmbudoConversion({ etapas }: { etapas: EtapaEmbudo[] }) {
  const max = Math.max(1, ...etapas.map((e) => e.cuentas));

  return (
    <Card>
      <h3 className="text-sm font-bold text-slate-700 mb-4">Embudo de conversión</h3>
      <div className="space-y-2">
        {etapas.map((e, i) => {
          const ancho = Math.max(6, (e.cuentas / max) * 100);
          const esFinal = i === etapas.length - 1;
          return (
            <div key={e.id}>
              <div className="flex items-center gap-3">
                <span className="w-32 text-xs text-slate-500 text-right flex-shrink-0" title={e.ayuda}>
                  {e.label}
                </span>
                <div className="flex-1 min-w-0">
                  <div
                    className="h-9 rounded-lg flex items-center justify-between px-3 transition-all"
                    style={{
                      width: `${ancho}%`,
                      minWidth: 130,
                      background: esFinal ? '#16A34A' : `rgba(225,29,72,${0.9 - i * 0.18})`,
                    }}
                    title={`${e.cuentas} cuentas · ${fmtUSDExacto(e.usd)}`}
                  >
                    <span className="text-sm font-bold text-white tabular-nums">{e.cuentas}</span>
                    <span className="text-[11px] text-white/90 tabular-nums">{fmtUSDCorto(e.usd)}</span>
                  </div>
                </div>
              </div>
              {/* Caída entre etapas: el número que importa es el que se pierde */}
              {e.conversion !== null && (
                <div className="flex items-center gap-3 py-0.5">
                  <span className="w-32 flex-shrink-0" />
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    ↳ {Math.round(e.conversion * 100)}% de la etapa anterior
                    <span className="text-slate-300"> · se pierden {etapas[i - 1].cuentas - e.cuentas}</span>
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/**
 * Barra de estados del universo — el filtro principal de la página.
 *
 * Los cinco estados son mutuamente excluyentes y suman el total, así que la
 * barra se lee como un 100%. Cada tramo es un botón: filtra la tabla de abajo.
 * Es lo que el Looker Studio no podía hacer y la razón de traer esto al panel.
 */
export function BarraEstados({ tramos, activo, onEstado }: {
  tramos: TramoEstado[];
  activo: EstadoCBS | null;
  onEstado: (e: EstadoCBS | null) => void;
}) {
  const total = tramos.reduce((a, t) => a + t.cuentas, 0);
  if (!total) return null;

  return (
    <Card>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-700">Estado de las cuentas</h3>
        <span className="text-[11px] text-slate-400">
          {activo ? 'Clic de nuevo para quitar el filtro' : 'Clic en un tramo para filtrar'}
        </span>
      </div>

      <div className="flex h-9 rounded-lg overflow-hidden bg-slate-100">
        {tramos.filter((t) => t.cuentas > 0).map((t) => {
          const meta = ESTADO_META[t.estado];
          const pct = (t.cuentas / total) * 100;
          const seleccionado = activo === t.estado;
          return (
            <button
              key={t.estado}
              onClick={() => onEstado(seleccionado ? null : t.estado)}
              aria-pressed={seleccionado}
              title={`${meta.label}: ${t.cuentas} cuentas · ${fmtUSDExacto(t.usd)}\n${meta.ayuda}`}
              className="flex items-center justify-center text-[11px] font-bold text-white
                         transition-all hover:brightness-110 active:scale-y-90"
              style={{
                width: `${pct}%`,
                background: meta.color,
                // El estado activo se marca por opacidad del resto, no solo por
                // color: con un único tramo resaltado el contraste sería sutil.
                opacity: activo && !seleccionado ? 0.35 : 1,
              }}
            >
              {pct > 5 ? t.cuentas : ''}
            </button>
          );
        })}
      </div>

      {/* Leyenda: siempre con texto y cifra, nunca solo el color */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3">
        {tramos.map((t) => {
          const meta = ESTADO_META[t.estado];
          const seleccionado = activo === t.estado;
          return (
            <button
              key={t.estado}
              onClick={() => onEstado(seleccionado ? null : t.estado)}
              aria-pressed={seleccionado}
              title={meta.ayuda}
              className={`flex items-center gap-1.5 text-[11px] rounded-lg px-1.5 py-1 -mx-1.5
                          transition-colors active:scale-95 ${
                seleccionado ? 'bg-slate-100' : 'hover:bg-slate-50'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: meta.color }} />
              <span className={seleccionado ? 'font-semibold text-slate-700' : 'text-slate-500'}>
                {meta.label}
              </span>
              <span className="tabular-nums font-semibold text-slate-700">{t.cuentas}</span>
              <span className="tabular-nums text-slate-400">{fmtUSDCorto(t.usd)}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
