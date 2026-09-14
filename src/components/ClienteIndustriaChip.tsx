import { useState } from 'react';
import type { ClienteTabla } from '../hooks/useTablaClientes';
import { useIndustriaViva, TAXONOMIA_INDUSTRIA } from '../hooks/useIndustriaViva';
import { useEditarIndustria } from '../hooks/useEditarIndustria';

/**
 * Chip de industria con edición en vivo — click abre un `<select>` de la
 * taxonomía cerrada y guarda directo en la hoja "Industria — Cartera por
 * País" (ver useIndustriaViva/useEditarIndustria). Compartido entre el
 * Comparador y el panel de detalle de Industria por País: misma fuente,
 * mismo comportamiento en todo el dashboard.
 *
 * `buscar(pais, panelId)` puede devolver una fila más nueva que `c.industria`
 * —esa última viene horneada de la hoja maestra, que solo se actualiza
 * cuando alguien corre "🔄 Actualizar Cartera"— así que siempre se prioriza
 * la fila en vivo si existe, y se cae al valor de cartera como fallback
 * mientras la hoja en vivo carga.
 *
 * Si la empresa no tiene fila en esa hoja todavía, no se puede editar acá
 * —no hay dónde escribir la corrección— y se muestra el valor de la cartera
 * tal cual, sin lápiz.
 */
export function ChipIndustria({ c }: { c: ClienteTabla }) {
  const { buscar, isLoading } = useIndustriaViva();
  const { guardar, guardando, error } = useEditarIndustria();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState('');

  const fila = buscar(c.pais, c.panelId || c.idTributario);
  const industriaActual = fila?.industria ?? c.industria;
  if (!industriaActual && isLoading) return null; // evita el parpadeo "sin industria" mientras carga
  if (!industriaActual) return null;

  if (editando) {
    return (
      <span className="inline-flex items-center gap-1">
        <select
          value={valor}
          onChange={e => setValor(e.target.value)}
          disabled={guardando}
          autoFocus
          className="text-[10px] border border-slate-200 rounded-full px-1.5 py-0.5 bg-white text-slate-600
                     focus:outline-none focus:ring-1 focus:ring-[#0097A7]"
        >
          {TAXONOMIA_INDUSTRIA.map(op => <option key={op} value={op}>{op}</option>)}
        </select>
        <button
          type="button"
          disabled={guardando || !fila}
          onClick={async () => {
            if (!fila) return;
            try {
              await guardar({ tab: fila.tab, fila: fila.fila, industria: valor });
              setEditando(false);
            } catch { /* el error queda en el hook, se muestra abajo */ }
          }}
          className="text-[10px] font-semibold text-[#0097A7] hover:underline disabled:opacity-40"
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button
          type="button"
          disabled={guardando}
          onClick={() => setEditando(false)}
          className="text-[10px] text-slate-400 hover:text-slate-600"
        >
          Cancelar
        </button>
        {error && <span className="text-[10px] text-red-500">{error.message.slice(0, 60)}</span>}
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={!fila}
      title={fila ? 'Corregir la industria de esta cuenta' : 'Esta empresa todavía no tiene fila en la hoja de Industria — no se puede editar acá'}
      onClick={() => { setValor(industriaActual); setEditando(true); }}
      className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#0097A7]/10 text-[#0097A7]
                 enabled:hover:bg-[#0097A7]/20 transition-colors
                 disabled:cursor-default disabled:opacity-60 flex items-center gap-1"
    >
      {industriaActual}
      {fila && <span aria-hidden className="text-[#0097A7]/50">✎</span>}
    </button>
  );
}
