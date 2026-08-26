import { CBS_ACENTO } from '../../lib/cbs';

/**
 * Nivel "proyecto" dentro del tab Proyectos.
 *
 * Hoy hay uno solo (CBS), y aun así existe el nivel: la idea desde el pedido
 * original es que Proyectos aloje varias iniciativas, y agregar la segunda tiene
 * que ser una línea acá y no rehacer la navegación.
 */
export type ProyectoTab = 'cbs';

const TABS: { id: ProyectoTab; label: string; sub: string }[] = [
  { id: 'cbs', label: 'CBS', sub: 'Cross Border Sales · LATAM → México' },
];

interface ProyectosSubNavProps {
  active: ProyectoTab;
  onChange: (t: ProyectoTab) => void;
}

export function ProyectosSubNav({ active, onChange }: ProyectosSubNavProps) {
  return (
    <div className="flex gap-0 border-b border-slate-200" role="tablist" aria-label="Proyectos">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          onClick={() => onChange(tab.id)}
          title={tab.sub}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px active:scale-95 ${
            active === tab.id ? '' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          style={active === tab.id ? { borderBottomColor: CBS_ACENTO, color: CBS_ACENTO } : undefined}
          aria-selected={active === tab.id}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
