export type Tab = 'metas' | 'cartera' | 'segmentacion' | 'ranking';

const TABS: { id: Tab; label: string }[] = [
  { id: 'metas', label: 'Desempeño' },
  { id: 'cartera', label: 'Portafolio' },
  { id: 'segmentacion', label: 'Clientes' },
  { id: 'ranking', label: 'Ranking' },
];

interface SubNavProps {
  active: Tab;
  onChange: (tab: Tab) => void;
}

export function SubNav({ active, onChange }: SubNavProps) {
  return (
    <nav className="bg-white border-b border-slate-200 px-6 flex gap-0" aria-label="Tabs principales">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={[
            'px-5 py-3 text-sm font-medium transition-all border-b-2 -mb-px active:scale-95',
            active === tab.id
              ? 'border-[#0097A7] text-[#0097A7]'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200',
          ].join(' ')}
          aria-current={active === tab.id ? 'page' : undefined}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
