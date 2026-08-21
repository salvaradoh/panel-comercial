export type Tab = 'metas' | 'cartera' | 'segmentacion' | 'mivista' | 'herramientas' | 'novedades' | 'campanas';

const ACENTO_DEFECTO = '#0097A7';

// `acento` distingue visualmente un tab del resto (Novedades va en ámbar).
const ALL_TABS: { id: Tab; label: string; acento?: string }[] = [
  { id: 'mivista',       label: 'Mi Vista' },
  { id: 'metas',         label: 'Desempeño' },
  { id: 'cartera',       label: 'Análisis clientes' },
  { id: 'segmentacion',  label: 'Clientes' },
  { id: 'herramientas',  label: 'Herramientas' },
  { id: 'novedades',     label: 'Novedades', acento: '#D97706' },
  // Solo Admin (ADMIN_TABS en App.tsx); el backend además exige requireAdmin.
  { id: 'campanas',      label: 'Campañas', acento: '#7C3AED' },
];

interface SubNavProps {
  active: Tab;
  onChange: (tab: Tab) => void;
  visibleTabs?: Tab[];
}

export function SubNav({ active, onChange, visibleTabs }: SubNavProps) {
  const tabs = visibleTabs
    ? ALL_TABS.filter(t => visibleTabs.includes(t.id))
    : ALL_TABS.filter(t => t.id !== 'mivista');

  return (
    <nav className="bg-white border-b border-slate-200 px-6 flex gap-0" aria-label="Tabs principales">
      {tabs.map((tab) => {
        const acento   = tab.acento ?? ACENTO_DEFECTO;
        const esActivo = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={[
              'px-5 py-3 text-sm font-medium transition-all border-b-2 -mb-px active:scale-95 flex items-center gap-1.5',
              esActivo
                ? ''
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200',
            ].join(' ')}
            // Tailwind no admite colores dinámicos en clases, así que el acento va inline
            style={esActivo ? { borderBottomColor: acento, color: acento } : undefined}
            aria-current={esActivo ? 'page' : undefined}
          >
            {/* Punto que marca el tab con acento propio aun cuando no está activo */}
            {tab.acento && !esActivo && (
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: tab.acento }} aria-hidden="true" />
            )}
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
