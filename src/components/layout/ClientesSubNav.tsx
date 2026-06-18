export type ClientesSubTab = 'salud' | 'segmentacion';

const TABS: { id: ClientesSubTab; label: string }[] = [
  { id: 'salud', label: 'Salud del Cliente' },
  { id: 'segmentacion', label: 'Segmentación' },
];

interface ClientesSubNavProps {
  active: ClientesSubTab;
  onChange: (t: ClientesSubTab) => void;
}

export function ClientesSubNav({ active, onChange }: ClientesSubNavProps) {
  return (
    <div className="flex gap-0 border-b border-slate-200">
      {TABS.map((tab) => (
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
