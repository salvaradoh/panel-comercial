import { useState } from 'react';

type SectionId = 'rewards' | 'gc' | null;

interface Tool {
  label: string;
  description: string;
  href: string;
  cat: string;
}

const SECTIONS: Record<
  Exclude<SectionId, null>,
  { title: string; color: string; tools: Tool[] }
> = {
  rewards: {
    title: 'Rewards',
    color: '#6C5FBF',
    tools: [
      {
        cat: 'Operaciones',
        label: 'Solicitud de reversa Apprecio',
        description: 'Formulario para solicitar reversas de puntos en la plataforma.',
        href: 'https://ecamus-apprecio.github.io/solicitud-migraci-n-cargas/',
      },
      {
        cat: 'Reportes',
        label: 'Reporte de resumen empresas',
        description: 'Genera un reporte con un resumen de los resultados del cliente en los últimos 12 meses.',
        href: 'https://n8n.openip.cl/form/reporteempresa',
      },
    ],
  },
  gc: {
    title: 'Gift Cards',
    color: '#0F6E56',
    tools: [
      {
        cat: 'Pedidos',
        label: 'Pedido de Gift Cards',
        description: 'Formulario para solicitar y gestionar pedidos de gift cards.',
        href: 'https://ecamus-apprecio.github.io/pedidos-gc/',
      },
      {
        cat: 'Operaciones',
        label: 'Solicitud de reversa Apprecio',
        description: 'Formulario para solicitar reversas en la plataforma.',
        href: 'https://ecamus-apprecio.github.io/solicitud-migraci-n-cargas/',
      },
    ],
  },
};

const DIRECT_CARDS = [
  {
    id: 'beat',
    label: 'Colaboradores',
    title: 'Apprecio Beat',
    description: 'Recursos comerciales, demos, pricing y generadores de propuesta para la plataforma de colaboradores.',
    href: 'https://ftorres-hub.github.io/appreciobeat/beat.html',
    bg: '#FA345E',
  },
  {
    id: 'smart-loyalty',
    label: 'Fidelización de Clientes',
    title: 'Smart Loyalty',
    description: 'Genera propuestas de Smart Loyalty personalizada para clientes.',
    href: 'https://n8n.openip.cl/form/propuestas.saas',
    bg: '#146787',
  },
];

/**
 * Enlaces a documentos y hojas. Van en un bloque aparte y con estilo sobrio
 * porque no son plataformas: abrir un Sheet no es lo mismo que entrar a Beat,
 * y mezclarlos en las tarjetas de color los haría competir en jerarquía.
 */
const ENLACES = [
  {
    id: 'hubspot-contactos',
    cat: 'CRM',
    label: 'Contactos Hubspot',
    description: 'Base de contactos exportada de Hubspot.',
    href: 'https://docs.google.com/spreadsheets/d/1pH0mqBDI32xfmhIT0IuuBe0wattXiOX1T94UX2dwqcI/edit?gid=1835880345#gid=1835880345',
  },
];

const SECTION_CARDS = [
  {
    id: 'rewards' as const,
    label: 'Puntos',
    title: 'Rewards',
    description: 'Herramientas y solicitudes para la gestión de puntos y reversas.',
    bg: '#B2A8E7',
  },
  {
    id: 'gc' as const,
    label: 'Gift Cards',
    title: 'Gift Cards',
    description: 'Formulario de pedidos y herramientas para la gestión de gift cards.',
    bg: '#45C1AD',
  },
];

export function HerramientasPage() {
  const [section, setSection] = useState<SectionId>(null);

  const active = section ? SECTIONS[section] : null;

  return (
    <div className="py-6 pb-14">
      {/* Header */}
      <div className="mb-5">
        {section ? (
          <button
            onClick={() => setSection(null)}
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-slate-700 transition-colors mb-4"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Volver
          </button>
        ) : null}
        <h1 className="text-xl font-bold text-slate-800">
          {section ? active!.title : 'Herramientas'}
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {section
            ? `Recursos disponibles para ${active!.title}`
            : 'Accede a los recursos y herramientas internas de Apprecio.'}
        </p>
      </div>

      {/* Landing grid */}
      {!section && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Cards que abren URL directa */}
          {DIRECT_CARDS.map((card) => (
            <a
              key={card.id}
              href={card.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl p-5 cursor-pointer relative overflow-hidden flex flex-col transition-all hover:opacity-90 hover:-translate-y-0.5 active:scale-[0.99]"
              style={{ background: card.bg }}
            >
              <div
                className="absolute w-28 h-28 rounded-full bottom-[-34px] right-[-22px]"
                style={{ background: 'rgba(255,255,255,0.07)' }}
              />
              <span
                className="text-[10px] font-bold tracking-widest uppercase mb-1.5"
                style={{ color: 'rgba(255,255,255,0.6)' }}
              >
                {card.label}
              </span>
              <span className="text-[18px] font-extrabold text-white leading-tight mb-2">
                {card.title}
              </span>
              <span className="text-[12px] leading-relaxed mb-4 flex-1" style={{ color: 'rgba(255,255,255,0.75)' }}>
                {card.description}
              </span>
              <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                Abrir
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </span>
            </a>
          ))}

          {/* Cards que abren sección interna */}
          {SECTION_CARDS.map((card) => (
            <button
              key={card.id}
              onClick={() => setSection(card.id)}
              className="rounded-2xl p-5 cursor-pointer relative overflow-hidden flex flex-col text-left transition-all hover:opacity-90 hover:-translate-y-0.5 active:scale-[0.99]"
              style={{ background: card.bg }}
            >
              <div
                className="absolute w-28 h-28 rounded-full bottom-[-34px] right-[-22px]"
                style={{ background: 'rgba(255,255,255,0.07)' }}
              />
              <span
                className="text-[10px] font-bold tracking-widest uppercase mb-1.5"
                style={{ color: 'rgba(255,255,255,0.6)' }}
              >
                {card.label}
              </span>
              <span className="text-[18px] font-extrabold text-white leading-tight mb-2">
                {card.title}
              </span>
              <span className="text-[12px] leading-relaxed mb-4 flex-1" style={{ color: 'rgba(255,255,255,0.75)' }}>
                {card.description}
              </span>
              <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                Ver recursos
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Enlaces — solo en la vista principal, igual que la grilla de tarjetas */}
      {!section && (
        <>
          <div className="flex items-center gap-3 mt-8 mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Enlaces</h2>
            <span aria-hidden className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ENLACES.map((e) => (
              <a
                key={e.id}
                href={e.href}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col
                           transition-all hover:-translate-y-0.5 hover:border-[#0097A7]/50 active:scale-[0.99]"
              >
                <span className="text-[10px] font-bold tracking-wide uppercase mb-1 text-[#0097A7]">
                  {e.cat}
                </span>
                <span className="text-[14px] font-bold text-slate-800 mb-1 leading-snug">
                  {e.label}
                </span>
                <span className="text-[12px] text-slate-400 leading-relaxed flex-1 mb-3">
                  {e.description}
                </span>
                <span className="text-[11px] font-bold text-[#0097A7] flex items-center gap-1">
                  Abrir
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </span>
              </a>
            ))}
          </div>
        </>
      )}

      {/* Vista de sección interna */}
      {section && active && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {active.tools.map((tool) => (
            <a
              key={tool.href + tool.label}
              href={tool.href}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col hover:-translate-y-0.5 hover:border-opacity-60 transition-all"
              style={{ ['--hover-border' as string]: active.color }}
            >
              <span
                className="text-[10px] font-bold tracking-wide uppercase mb-1"
                style={{ color: active.color }}
              >
                {tool.cat}
              </span>
              <span className="text-[14px] font-bold text-slate-800 mb-2 leading-snug">
                {tool.label}
              </span>
              <span className="text-[12px] text-slate-400 leading-relaxed flex-1 mb-4">
                {tool.description}
              </span>
              <span
                className="text-[11px] font-bold flex items-center gap-1"
                style={{ color: active.color }}
              >
                Abrir herramienta
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
