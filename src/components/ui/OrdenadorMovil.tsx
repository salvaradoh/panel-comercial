/**
 * Reemplazo del orden por encabezado, para cuando la tabla está apilada.
 *
 * En modo apilado el `thead` se oculta —cada fila es una tarjeta con sus
 * propias etiquetas— y con él se van los `<th>` clickeables que ordenaban.
 * Este `<select>` repone esa función sin duplicar estado: escribe en el mismo
 * `orden` que ya usa la tabla, así que ordenar acá y clickear el encabezado en
 * desktop son la misma operación.
 *
 * Va DENTRO del `.tabla-scroll`, que es lo que establece el contenedor de
 * consulta; `solo-apilado` lo esconde en cuanto hay ancho para el encabezado
 * de verdad.
 */
export function OrdenadorMovil<T extends string>({ columnas, orden, onChange, id }: {
  columnas: { k: T; label: string }[];
  orden: T;
  onChange: (k: T) => void;
  /** Necesario para asociar la etiqueta cuando hay más de una tabla en la vista. */
  id: string;
}) {
  return (
    <div className="solo-apilado items-center gap-2 pb-2">
      <label htmlFor={id} className="text-[11px] uppercase tracking-wide text-slate-400 flex-none">
        Ordenar por
      </label>
      <select
        id={id}
        value={orden}
        onChange={(e) => onChange(e.target.value as T)}
        className="flex-1 min-w-0 text-xs font-semibold text-slate-700 border border-slate-200
                   rounded-lg px-2.5 py-2 bg-white outline-none focus:border-[#0097A7] transition-colors"
      >
        {columnas.map((c) => (
          <option key={c.k} value={c.k}>{c.label}</option>
        ))}
      </select>
    </div>
  );
}
