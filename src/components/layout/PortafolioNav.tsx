export type PortafolioTab = 'estacionales' | 'recurrentes';

const TABS: { id: PortafolioTab; label: string }[] = [
  { id: 'estacionales', label: 'Clientes Estacionales' },
  { id: 'recurrentes', label: 'Clientes Recurrentes' },
];

interface PortafolioNavProps {
  active: PortafolioTab;
  onChange: (t: PortafolioTab) => void;
}

export function PortafolioNav({ active, onChange }: PortafolioNavProps) {
  return (
    <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-5 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
            active === tab.id
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
          aria-pressed={active === tab.id}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
