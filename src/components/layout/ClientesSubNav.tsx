// Los ids 'cuentas-clave' y 'movimientos' se conservan a propósito aunque las
// etiquetas digan "Priorización" y "Churn": alimentan los eventos de analítica
// (`analisis:cuentas-clave:*`, `analisis:movimientos`) ya registrados en
// Firestore, y renombrarlos partiría la serie histórica.
export type ClientesSubTab = 'overview' | 'salud' | 'segmentacion' | 'ipc' | 'cuentas-clave' | 'movimientos' | 'industria';

const TABS: { id: ClientesSubTab; label: string }[] = [
  { id: 'overview',      label: 'Overview' },
  { id: 'salud',         label: 'Salud del Cliente' },
  { id: 'segmentacion',  label: 'Segmentación' },
  { id: 'ipc',           label: 'Análisis IPC' },
  { id: 'cuentas-clave', label: 'Priorización' },
  { id: 'industria',     label: 'Industria por País' },
  { id: 'movimientos',   label: 'Churn' },
];

interface ClientesSubNavProps {
  active: ClientesSubTab;
  onChange: (t: ClientesSubTab) => void;
}

/**
 * Ningún sub-tab se filtra por rol (2026-09-30, pedido de Samuel).
 *
 * Churn lo veía solo gestión —Country Manager, C-level y Admin— con el
 * argumento de que mide la cartera completa del país. Pero el ejecutivo ya ve
 * todo su país en el resto de las vistas, así que esconderlo solo le tapaba el
 * número por el que se lo mide. Industria por País se había abierto antes por la
 * misma razón.
 *
 * Y en cualquier caso, ocultar un tab NO es control de acceso: las hojas Cache_*
 * se leen con el token del propio usuario. Si algún dato de acá fuera sensible,
 * habría que exigirlo en el backend, no esconder el botón.
 */
export function ClientesSubNav({ active, onChange }: ClientesSubNavProps) {
  const tabs = TABS;

  return (
    <div className="flex gap-0 border-b border-slate-200">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
            active === tab.id
              ? 'border-[#0097A7] text-[#0097A7]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          aria-current={active === tab.id ? 'page' : undefined}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
