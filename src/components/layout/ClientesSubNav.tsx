// El id 'cuentas-clave' se conserva a propósito aunque la etiqueta ahora diga
// "Priorización": alimenta los eventos de analítica (`analisis:cuentas-clave:*`)
// ya registrados en Firestore, y renombrarlo partiría la serie histórica.
export type ClientesSubTab = 'overview' | 'salud' | 'segmentacion' | 'ipc' | 'cuentas-clave' | 'movimientos' | 'industria';

const TABS: { id: ClientesSubTab; label: string }[] = [
  { id: 'overview',      label: 'Overview' },
  { id: 'salud',         label: 'Salud del Cliente' },
  { id: 'segmentacion',  label: 'Segmentación' },
  { id: 'ipc',           label: 'Análisis IPC' },
  { id: 'cuentas-clave', label: 'Priorización' },
  { id: 'industria',     label: 'Industria por País' },
  { id: 'movimientos',   label: 'Movimientos' },
];

interface ClientesSubNavProps {
  active: ClientesSubTab;
  onChange: (t: ClientesSubTab) => void;
  /**
   * Ejecutivo (o admin impersonando uno): no ve Movimientos ni Industria por
   * País. Movimientos mide la cartera completa del país y se lee en clave de
   * gestión —cuánta cartera se está enfriando, qué ejecutivo tiene más— así
   * que es una vista de Country Manager, C-level y Admin (mismo criterio que
   * el ABC en Priorización). Industria por País compara entre países, y el
   * ejecutivo está acotado a uno solo: no hay comparación que hacer.
   */
  esEjecutivo?: boolean;
}

export function ClientesSubNav({ active, onChange, esEjecutivo }: ClientesSubNavProps) {
  const tabs = esEjecutivo ? TABS.filter(t => t.id !== 'movimientos') : TABS;

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
