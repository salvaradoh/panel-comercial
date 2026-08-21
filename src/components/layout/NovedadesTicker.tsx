import { useNovedades, fechaRelativa, formatMontoLocal, BEAT_URL } from '../../hooks/useNovedades';
import type { Novedad, NovedadTipo } from '../../hooks/useNovedades';
import { BanderaPais } from '../ui/BanderaPais';

// Cuántas novedades de cada tipo entran al ticker. Los generados
// automáticamente (cliente/equipo/país) además deben ser de importancia alta.
const CUPOS: { tipo: NovedadTipo; max: number }[] = [
  { tipo: 'campanazo', max: 5 },
  { tipo: 'cierre',    max: 1 },
  { tipo: 'manual',    max: 2 },
  { tipo: 'equipo',    max: 2 },
  { tipo: 'cliente',   max: 2 },
  { tipo: 'pais',      max: 1 },
];

const TIPO_COLOR: Record<string, string> = {
  campanazo: '#D97706',   // ámbar — venta cerrada
  cliente:   '#0E7490',   // teal — movimiento de cliente
  equipo:    '#6D28D9',   // violeta — ejecutivos
  pais:      '#1D4ED8',   // azul — hitos de país
  cierre:    '#047857',   // verde — cierre de periodo
  manual:    '#57534E',   // piedra — aviso publicado a mano
};

const TIPO_LABEL: Record<string, string> = {
  campanazo: 'Campanazo',
  cliente:   'Cartera',
  equipo:    'Equipo',
  pais:      'País',
  cierre:    'Cierre',
  manual:    'Aviso',
};

interface NovedadesTickerProps {
  onOpen: () => void;
}

function TickerItem({ n, onOpen }: { n: Novedad; onOpen: () => void }) {
  const color = TIPO_COLOR[n.tipo] ?? TIPO_COLOR.manual;
  const esCampanazo = n.tipo === 'campanazo' && !!n.empresa;

  // Contenedor <div>, no <button>: un <a> no puede ir anidado dentro de un <button>.
  return (
    <div className="px-3 py-2.5 rounded-lg bg-white border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all">
      <button onClick={onOpen} className="w-full text-left block active:scale-[0.98] transition-transform">
        <span className="flex items-center gap-1.5 mb-1">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
          <span className="text-[9px] font-bold tracking-wider uppercase" style={{ color }}>
            {TIPO_LABEL[n.tipo] ?? n.tipo}
          </span>
          {/* El país no se veía en el ticker (la página sí lo mostraba), así que
              no había forma de saber a qué mercado apuntaba la novedad. Bandera
              como imagen + nombre: a 9px la bandera sola no se distingue. */}
          {n.pais && (
            <BanderaPais pais={n.pais} conNombre
                         className="text-[9px] text-slate-400 shrink-0 max-w-[88px]" />
          )}
          <span className="text-[9px] text-slate-300 ml-auto tabular-nums shrink-0">
            {fechaRelativa(n.fecha)}
          </span>
        </span>
        {esCampanazo ? (
          <>
            <span className="text-[11px] leading-snug text-slate-600 line-clamp-2 block">
              <span className="font-semibold text-slate-700">{n.autor.split(' ')[0]}</span>
              {' · '}{n.empresa}
            </span>
            {n.monto > 0 && (
              <span className="text-[10px] font-bold tabular-nums mt-0.5 block" style={{ color }}>
                {formatMontoLocal(n.monto, n.moneda)}
              </span>
            )}
          </>
        ) : (
          <span className="text-[11px] leading-snug text-slate-600 line-clamp-3 block">
            {n.titulo}
          </span>
        )}
      </button>

      {(esCampanazo || n.reacciones.length > 0) && (
        <div className="flex items-center gap-1.5 mt-2">
          {esCampanazo && (
            <a
              href={BEAT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[9.5px] font-bold transition-all active:scale-95 hover:brightness-95 shrink-0"
              style={{ color: '#B45309', background: '#FEF3C7' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3" aria-hidden="true">
                <path d="M12 3l1.9 4.5 4.9.4-3.7 3.2 1.1 4.8L12 13.4 7.8 15.9l1.1-4.8L5.2 7.9l4.9-.4L12 3z" />
              </svg>
              Felicitar
            </a>
          )}
          <ReaccionesCompactas lista={n.reacciones} />
        </div>
      )}
    </div>
  );
}

/**
 * Versión reducida para el ticker: en 210px no cabe el conteo por emoji, así que
 * se muestran los 3 más votados y el total al lado.
 */
function ReaccionesCompactas({ lista }: { lista: { emoji: string; n: number }[] }) {
  if (!lista.length) return null;
  const total = lista.reduce((s, r) => s + r.n, 0);
  const top = [...lista].sort((a, b) => b.n - a.n).slice(0, 3);

  return (
    <span
      className="inline-flex items-center gap-0.5 ml-auto shrink-0"
      title={`${total} reacción${total === 1 ? '' : 'es'} en Chat`}
    >
      {top.map((r) => (
        <span key={r.emoji} className="text-[10px] leading-none" aria-hidden="true">{r.emoji}</span>
      ))}
      {total > top.length && (
        <span className="text-[9px] font-bold text-slate-400 tabular-nums ml-0.5">{total}</span>
      )}
    </span>
  );
}

/**
 * Barra lateral fija con las últimas 5 novedades, desplazándose como créditos.
 *
 * El shell no tiene sidebar y el contenido está capado a 1200px centrado, así que
 * en pantallas anchas sobra espacio a la derecha. Va `fixed` para no reestructurar
 * el layout, y se oculta bajo xl donde se montaría encima del contenido.
 */
export function NovedadesTicker({ onOpen }: NovedadesTickerProps) {
  const { data: novedades } = useNovedades();

  // Cupo por tipo, no los N más recientes a secas: si no, una racha de
  // campanazos tapa el cierre del mes y los avisos del equipo.
  // `novedades` ya viene ordenado por fecha desc, así que filtrar y cortar
  // devuelve los más recientes de cada tipo.
  const lista = (novedades ?? []).filter((n) => n.importancia === 'alta');
  const ultimas = CUPOS
    .flatMap(({ tipo, max }) => lista.filter((n) => n.tipo === tipo).slice(0, max))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  if (ultimas.length === 0) return null;

  // La lista va duplicada: al animar de -50% a 0 el segundo bloque queda donde
  // arrancó el primero, así el loop no tiene salto visible.
  const duplicadas = [...ultimas, ...ultimas];
  const duracion = Math.max(20, ultimas.length * 6);

  return (
    <aside
      className="hidden xl:flex flex-col fixed right-3 top-32 bottom-4 w-[210px] z-10 pointer-events-auto"
      aria-label="Últimas novedades"
    >
      <style>{`
        @keyframes novTickerScroll {
          from { transform: translateY(-50%); }
          to   { transform: translateY(0); }
        }
        .nov-ticker-track {
          animation: novTickerScroll var(--nov-dur) linear infinite;
        }
        .nov-ticker-mask:hover .nov-ticker-track { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .nov-ticker-track { animation: none; }
        }
      `}</style>

      <div className="flex items-center gap-1.5 mb-2 px-1">
        <svg viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" className="w-3.5 h-3.5">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400">
          Novedades
        </span>
      </div>

      <div className="nov-ticker-mask flex-1 overflow-hidden relative">
        {/* Degradados para que las tarjetas entren y salgan sin cortarse en seco */}
        <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-slate-50 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-slate-50 to-transparent z-10 pointer-events-none" />

        <div
          className="nov-ticker-track flex flex-col gap-2"
          style={{ ['--nov-dur' as string]: `${duracion}s` }}
        >
          {duplicadas.map((n, i) => (
            <TickerItem key={`${n.id}-${i}`} n={n} onOpen={onOpen} />
          ))}
        </div>
      </div>

      <button
        onClick={onOpen}
        className="mt-2 text-[10px] font-bold text-slate-400 hover:text-[#D97706] transition-colors px-1 text-left"
      >
        Ver todas →
      </button>
    </aside>
  );
}
