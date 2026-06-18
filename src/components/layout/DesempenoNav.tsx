export type DesempenoTab = 'overview' | 'pais' | 'ejecutivo';

const TABS: { id: DesempenoTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'pais', label: 'Por País' },
  { id: 'ejecutivo', label: 'Por Ejecutivo' },
];

interface DesempenoNavProps {
  active: DesempenoTab;
  onChange: (t: DesempenoTab) => void;
}

export function DesempenoNav({ active, onChange }: DesempenoNavProps) {
  return (
    <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
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
