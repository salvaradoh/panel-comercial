import { useEffect, useRef, useState } from 'react';

export type Tab = 'metas' | 'cartera' | 'segmentacion' | 'mivista' | 'herramientas' | 'novedades' | 'proyectos' | 'campanas';

const ACENTO_DEFECTO = '#0097A7';

// `acento` distingue visualmente un tab del resto (Novedades va en ámbar).
const ALL_TABS: { id: Tab; label: string; acento?: string }[] = [
  { id: 'mivista',       label: 'Mi Vista' },
  { id: 'metas',         label: 'Desempeño' },
  { id: 'cartera',       label: 'Análisis clientes' },
  { id: 'segmentacion',  label: 'Clientes' },
  { id: 'herramientas',  label: 'Herramientas' },
  { id: 'novedades',     label: 'Novedades', acento: '#D97706' },
  // Solo Admin por ahora (ADMIN_TABS en App.tsx), hasta validar las cifras con el equipo.
  { id: 'proyectos',     label: 'Proyectos', acento: '#E11D48' },
  // Visible para todo el equipo, pero el Admin ve otra vista: el brief completo contra
  // solo las campañas aprobadas. Lo decide el backend, no esta lista.
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

  const tira = useRef<HTMLDivElement>(null);
  const botonActivo = useRef<HTMLButtonElement>(null);
  // Si hay recorrido a cada lado. Se mide en vez de suponerse: en desktop los
  // tabs entran de sobra y ambos quedan en false, así que los degradados no se
  // dibujan y la barra se ve exactamente como siempre.
  const [haceFalta, setHaceFalta] = useState({ izq: false, der: false });

  function medir() {
    const el = tira.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setHaceFalta({ izq: el.scrollLeft > 1, der: el.scrollLeft < max - 1 });
  }

  useEffect(() => {
    medir();
    const el = tira.current;
    if (!el) return;
    // ResizeObserver y no `resize` de window: la tira también cambia de ancho
    // cuando cambia la lista de tabs por rol, sin que la ventana se mueva.
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tabs.length]);

  // Al entrar, el tab activo tiene que quedar a la vista: un ejecutivo aterriza
  // en Mi Vista, que es el primero, pero un admin puede aterrizar en uno que
  // quedó fuera de pantalla. `block: 'nearest'` para que no haga scroll vertical
  // de la página entera.
  useEffect(() => {
    botonActivo.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);

  return (
    <nav className="relative bg-white" aria-label="Tabs principales">
      {/* La línea base va como capa aparte y no como `border-b` de la tira.
          Motivo: la tira ahora tiene `overflow-x`, y eso recorta todo lo que se
          salga de su caja —incluido el píxel con que el borde del tab activo
          montaba sobre la línea (el viejo `-mb-px`). Dibujándola detrás, el
          acento de 2px la tapa por debajo del tab activo igual que antes y la
          barra conserva exactamente el alto y el aspecto que tenía.
          Va primero en el DOM y la tira lleva `relative` para que la tira pinte
          encima: entre dos elementos posicionados, decide el orden del DOM. */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-slate-200" aria-hidden="true" />
      <div
        ref={tira}
        onScroll={medir}
        className="relative px-4 sm:px-6 flex gap-0 subnav-scroll"
      >
        {tabs.map((tab) => {
          const acento   = tab.acento ?? ACENTO_DEFECTO;
          const esActivo = active === tab.id;
          return (
            <button
              key={tab.id}
              ref={esActivo ? botonActivo : undefined}
              onClick={() => onChange(tab.id)}
              className={[
                // flex-none: sin esto, al no caber los tabs se aplastan y los
                // títulos se cortan en vez de habilitar el deslizamiento.
                'flex-none px-4 sm:px-5 py-3 text-sm font-medium transition-all border-b-2 active:scale-95 flex items-center gap-1.5 whitespace-nowrap',
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
      </div>

      {/* Degradados que avisan que hay más tabs de los que se ven. Van sobre la
          tira y no dentro, para que el scroll no los arrastre. */}
      {haceFalta.izq && (
        <div className="pointer-events-none absolute left-0 top-0 bottom-px w-8 bg-gradient-to-r from-white to-transparent" aria-hidden="true" />
      )}
      {haceFalta.der && (
        <div className="pointer-events-none absolute right-0 top-0 bottom-px w-8 bg-gradient-to-l from-white to-transparent" aria-hidden="true" />
      )}
    </nav>
  );
}
