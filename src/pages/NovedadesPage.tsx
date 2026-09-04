import { useState } from 'react';
import { sileo } from 'sileo';
import {
  useNovedades, useCrearNovedad, useDesactivarNovedad, fechaRelativa, formatMontoLocal, BEAT_URL,
} from '../hooks/useNovedades';
import type { Novedad, NovedadTipo } from '../hooks/useNovedades';
import { BanderaPais } from '../components/ui/BanderaPais';

const MAX_TITULO = 80;

const TIPO_META: Record<NovedadTipo, { label: string; color: string; bg: string }> = {
  campanazo: { label: 'Campanazo', color: '#B45309', bg: '#FEF3C7' },
  cliente:   { label: 'Cartera',   color: '#0E7490', bg: '#CFFAFE' },
  equipo:    { label: 'Equipo',    color: '#6D28D9', bg: '#EDE9FE' },
  pais:      { label: 'País',      color: '#1D4ED8', bg: '#DBEAFE' },
  cierre:    { label: 'Cierre',    color: '#047857', bg: '#D1FAE5' },
  manual:    { label: 'Aviso',     color: '#57534E', bg: '#F5F5F4' },
};

const FILTROS: { key: 'todas' | NovedadTipo; label: string }[] = [
  { key: 'todas',     label: 'Todas' },
  { key: 'campanazo', label: 'Campanazos' },
  { key: 'cliente',   label: 'Cartera' },
  { key: 'equipo',    label: 'Equipo' },
  { key: 'pais',      label: 'Países' },
  { key: 'cierre',    label: 'Cierres' },
  { key: 'manual',    label: 'Avisos' },
];

/** El verbo del campanazo cambia según qué tipo de cierre fue. */
const CLASE_VERBO: Record<string, string> = {
  nuevo:      'cerró un nuevo cliente',
  recuperado: 'recuperó un cliente',
  nueva_area: 'abrió una nueva área en',
  '':         'cerró',
};

interface NovedadesPageProps {
  isAdmin: boolean;
}

/** Reacciones que el equipo puso al campanazo en Chat. Solo lectura. */
function Reacciones({ lista }: { lista: { emoji: string; n: number }[] }) {
  if (!lista.length) return null;
  const total = lista.reduce((s, r) => s + r.n, 0);
  return (
    <span
      className="inline-flex items-center gap-1 flex-wrap"
      title={`${total} reacción${total === 1 ? '' : 'es'} en Google Chat`}
    >
      {lista.map((r) => (
        <span
          key={r.emoji}
          className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded-full bg-slate-50 border border-slate-100 text-[11px] leading-none"
        >
          <span aria-hidden="true">{r.emoji}</span>
          {r.n > 1 && <span className="font-semibold text-slate-400 tabular-nums">{r.n}</span>}
        </span>
      ))}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function NovedadCard({ n, isAdmin }: { n: Novedad; isAdmin: boolean }) {
  const meta = TIPO_META[n.tipo] ?? TIPO_META.manual;
  const desactivar = useDesactivarNovedad();

  async function handleEliminar() {
    if (!window.confirm(`¿Ocultar esta novedad?\n\n${n.titulo}`)) return;
    try {
      await desactivar.mutateAsync(n.id);
      sileo.success({ title: 'Novedad ocultada' });
    } catch (e) {
      sileo.error({
        title: 'No se pudo ocultar',
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <article className="bg-white border border-slate-100 rounded-xl p-4 hover:border-slate-200 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full"
          style={{ color: meta.color, background: meta.bg }}
        >
          {meta.label}
        </span>
        {n.pais && <BanderaPais pais={n.pais} conNombre className="text-[11px] text-slate-400" />}
        <span className="text-[11px] text-slate-300 ml-auto tabular-nums">
          {fechaRelativa(n.fecha)}
        </span>
        {isAdmin && (
          <button
            onClick={handleEliminar}
            disabled={desactivar.isPending}
            aria-label="Ocultar novedad"
            className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {n.tipo === 'campanazo' && n.empresa ? (
        <>
          {/* Narrativa: quién hizo qué */}
          <p className="text-[12px] text-slate-500 mb-0.5">
            <span className="font-bold text-slate-700">{n.autor}</span>{' '}
            {CLASE_VERBO[n.clase] ?? CLASE_VERBO['']}
          </p>

          <h3 className="text-[15px] font-bold text-slate-800 leading-snug mb-1.5">
            {n.empresa}
          </h3>

          {/* Monto en moneda local + producto + área */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            {n.monto > 0 && (
              <span className="text-[13px] font-bold tabular-nums" style={{ color: meta.color }}>
                {formatMontoLocal(n.monto, n.moneda)}
              </span>
            )}
            {n.producto && (
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {n.producto}
              </span>
            )}
            {n.area && (
              <span className="text-[11px] text-slate-400">{n.area}</span>
            )}
          </div>

          {n.cuerpo && (
            <p className="text-[12px] text-slate-500 leading-relaxed whitespace-pre-line">
              {n.cuerpo}
            </p>
          )}

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <a
              href={BEAT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95 hover:brightness-95"
              style={{ color: meta.color, background: meta.bg }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden="true">
                <path d="M12 3l1.9 4.5 4.9.4-3.7 3.2 1.1 4.8L12 13.4 7.8 15.9l1.1-4.8L5.2 7.9l4.9-.4L12 3z" />
              </svg>
              Felicitar en Apprecio Beat
            </a>
            <Reacciones lista={n.reacciones} />
          </div>
        </>
      ) : (
        <>
          <h3 className="text-[14px] font-bold text-slate-800 leading-snug mb-1">
            {n.titulo}
          </h3>
          {n.cuerpo && (
            <p className="text-[12px] text-slate-500 leading-relaxed whitespace-pre-line">
              {n.cuerpo}
            </p>
          )}
          {n.autor && n.autor !== 'Automático' && (
            <p className="text-[11px] text-slate-300 mt-2">— {n.autor}</p>
          )}
          {/* Un cliente recuperado también merece felicitación */}
          {n.tipo === 'cliente' && n.clase === 'recuperado' && (
            <a
              href={BEAT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95 hover:brightness-95"
              style={{ color: meta.color, background: meta.bg }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden="true">
                <path d="M12 3l1.9 4.5 4.9.4-3.7 3.2 1.1 4.8L12 13.4 7.8 15.9l1.1-4.8L5.2 7.9l4.9-.4L12 3z" />
              </svg>
              Felicitar en Apprecio Beat
            </a>
          )}
        </>
      )}
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ModalNueva({ onClose }: { onClose: () => void }) {
  const [titulo, setTitulo] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [pais, setPais]     = useState('');
  const crear = useCrearNovedad();

  const restantes = MAX_TITULO - titulo.length;
  const puedeGuardar = titulo.trim().length > 0 && restantes >= 0 && !crear.isPending;

  async function handleGuardar() {
    try {
      await crear.mutateAsync({ titulo: titulo.trim(), cuerpo: cuerpo.trim(), pais });
      sileo.success({ title: 'Novedad publicada' });
      onClose();
    } catch (e) {
      sileo.error({
        title: 'No se pudo publicar',
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Nueva novedad"
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-800">Nueva novedad</h2>
          <button onClick={onClose} aria-label="Cerrar" className="grid place-items-center w-10 h-10 sm:block sm:w-auto sm:h-auto text-slate-300 hover:text-slate-600 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <label className="block mb-3">
          <span className="flex items-baseline justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Título</span>
            <span className={`text-[11px] tabular-nums ${restantes < 0 ? 'text-red-500 font-bold' : 'text-slate-300'}`}>
              {restantes}
            </span>
          </span>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            autoFocus
            placeholder="Ej: Cartera de Juan pasa a María y Pedro"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#D97706] focus:ring-1 focus:ring-[#D97706]"
          />
          <span className="text-[10px] text-slate-300 mt-1 block">
            Es lo único que se ve en el ticker lateral. Máximo {MAX_TITULO} caracteres.
          </span>
        </label>

        <label className="block mb-3">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1 block">
            Detalle <span className="font-normal normal-case tracking-normal text-slate-300">(opcional)</span>
          </span>
          <textarea
            value={cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
            rows={4}
            placeholder="Contexto completo, visible en esta página."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:border-[#D97706] focus:ring-1 focus:ring-[#D97706]"
          />
        </label>

        <label className="block mb-5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1 block">
            País <span className="font-normal normal-case tracking-normal text-slate-300">(opcional)</span>
          </span>
          <select
            value={pais}
            onChange={(e) => setPais(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#D97706]"
          >
            <option value="">Sin país</option>
            {['Chile', 'Perú', 'Colombia', 'México', 'Ecuador'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={!puedeGuardar}
            className="px-4 py-2 text-sm font-bold text-white rounded-lg transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#D97706' }}
          >
            {crear.isPending ? 'Publicando…' : 'Publicar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function NovedadesPage({ isAdmin }: NovedadesPageProps) {
  const { data: novedades, isLoading, error } = useNovedades();
  const [filtro, setFiltro] = useState<'todas' | NovedadTipo>('todas');
  const [modalAbierto, setModalAbierto] = useState(false);

  const lista = (novedades ?? []).filter((n) => filtro === 'todas' || n.tipo === filtro);

  return (
    <div className="py-8 pb-16">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Novedades</h1>
          <p className="text-sm text-slate-400 mt-1">
            Campanazos, cierres de mes y avisos del equipo comercial.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setModalAbierto(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-bold text-white rounded-lg transition-all active:scale-95 shrink-0"
            style={{ background: '#D97706' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nueva novedad
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {FILTROS.map((f) => {
          const activo = filtro === f.key;
          const n = f.key === 'todas'
            ? (novedades ?? []).length
            : (novedades ?? []).filter((x) => x.tipo === f.key).length;
          return (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={[
                'px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all active:scale-95',
                activo
                  ? 'bg-slate-800 text-white'
                  : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300',
              ].join(' ')}
              aria-pressed={activo}
            >
              {f.label}
              <span className={`ml-1.5 tabular-nums ${activo ? 'text-slate-300' : 'text-slate-300'}`}>
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-40">
          <span className="animate-spin w-5 h-5 rounded-full border-2 border-[#D97706] border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="bg-white border border-slate-100 rounded-xl p-6 text-center">
          <p className="text-sm text-slate-500">No se pudieron cargar las novedades.</p>
          <p className="text-xs text-slate-300 mt-1">{String(error)}</p>
        </div>
      )}

      {!isLoading && !error && lista.length === 0 && (
        <div className="bg-white border border-slate-100 rounded-xl p-10 text-center">
          <p className="text-sm text-slate-400">Todavía no hay novedades.</p>
          {isAdmin && (
            <p className="text-xs text-slate-300 mt-1">Publica la primera con el botón de arriba.</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {lista.map((n) => (
          <NovedadCard key={n.id} n={n} isAdmin={isAdmin} />
        ))}
      </div>

      {modalAbierto && <ModalNueva onClose={() => setModalAbierto(false)} />}
    </div>
  );
}
