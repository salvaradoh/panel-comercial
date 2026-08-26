import { Card } from '../../components/ui';
import { SEG_COLOR, SEG_BG } from '../../components/salud';
import { CBS_ACENTO, fmtNum } from '../../lib/cbs';
import type { VentanaProyecto } from '../../lib/cbs';

// ── TierChip ──────────────────────────────────────────────────────────────────
// Reusa la paleta de segmentos del resto del panel (A+ verde, A ámbar, B naranja,
// C rojo) en vez de la de Looker Studio: dentro del panel "Tier A" tiene que
// verse igual acá que en Clientes.

export function TierChip({ tier }: { tier: string }) {
  const clave = tier.replace(/^tier\s*/i, '').trim();
  const color = SEG_COLOR[clave] ?? '#64748b';
  const bg    = SEG_BG[clave] ?? '#f1f5f9';
  return (
    <span
      className="inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      style={{ color, background: bg, border: `1px solid ${color}44` }}
    >
      {tier || '—'}
    </span>
  );
}

// ── Selector ──────────────────────────────────────────────────────────────────

export function Selector({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 min-w-[160px]">
      <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700
                   focus:outline-none focus:ring-2 focus:ring-[#E11D48]/30 focus:border-[#E11D48]
                   transition-shadow"
      >
        <option value="">Todos</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

// ── KPI ───────────────────────────────────────────────────────────────────────

export function KpiCBS({ label, valor, sub, acento = CBS_ACENTO }: {
  label: string; valor: string | number; sub?: string; acento?: string;
}) {
  return (
    <Card className="!p-4">
      <div className="border-l-4 pl-3 -ml-1" style={{ borderColor: acento }}>
        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide leading-tight">{label}</p>
        <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: acento }}>{valor}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}

// ── Estados de tabla ──────────────────────────────────────────────────────────

export function SinDatos({ mensaje = 'No hay filas que cumplan estos filtros.' }: { mensaje?: string }) {
  return (
    <div className="py-10 text-center text-sm text-slate-400">{mensaje}</div>
  );
}

/** Paginador compacto, con el mismo formato "1 - 100 / 284" del tablero original. */
export function Paginador({ pagina, porPagina, total, onPagina }: {
  pagina: number; porPagina: number; total: number; onPagina: (p: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const desde = total === 0 ? 0 : pagina * porPagina + 1;
  const hasta = Math.min((pagina + 1) * porPagina, total);
  return (
    <div className="flex items-center justify-end gap-3 pt-3 text-xs text-slate-500">
      <span className="tabular-nums">{desde} – {hasta} / {fmtNum(total)}</span>
      <div className="flex gap-1">
        <button
          onClick={() => onPagina(Math.max(0, pagina - 1))}
          disabled={pagina === 0}
          aria-label="Página anterior"
          className="w-7 h-7 rounded-lg border border-slate-200 disabled:opacity-30
                     hover:bg-slate-50 active:scale-95 transition-all"
        >‹</button>
        <button
          onClick={() => onPagina(Math.min(paginas - 1, pagina + 1))}
          disabled={pagina >= paginas - 1}
          aria-label="Página siguiente"
          className="w-7 h-7 rounded-lg border border-slate-200 disabled:opacity-30
                     hover:bg-slate-50 active:scale-95 transition-all"
        >›</button>
      </div>
    </div>
  );
}

/** Celda de bandera 1/0: nunca solo un color, siempre el número o el guion. */
export function Flag({ v }: { v: number }) {
  return v > 0
    ? <span className="tabular-nums font-semibold text-emerald-600">{v}</span>
    : <span className="text-slate-300">—</span>;
}

// ── Cabecera del tablero ──────────────────────────────────────────────────────

/**
 * Cabecera con el estado de la ventana de trabajo.
 *
 * La fecha sale de la hoja (`ventanaProyecto`), nunca del código. Al 2026-08-25
 * las `Fecha fin` son de abril, así que muestra "vencida hace N días" y pide
 * actualizar la hoja; en cuanto corrijan las fechas, el mismo componente pasa
 * solo a cuenta regresiva. Así no queda una fecha cableada que después nadie
 * recuerda cambiar.
 */
export function CabeceraCBS({ titulo, bajada, ventana }: {
  titulo: string;
  bajada: string;
  ventana: VentanaProyecto;
}) {
  const { diasRestantes, vencida, finISO } = ventana;
  return (
    <div className="rounded-2xl px-5 py-4 text-white" style={{ background: CBS_ACENTO }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold leading-tight">{titulo}</h2>
          <p className="text-sm text-white/85 mt-0.5">{bajada}</p>
        </div>
        {diasRestantes !== null && (
          <div className="bg-white/15 rounded-xl px-3 py-2 text-right">
            {vencida ? (
              <>
                <p className="text-[11px] uppercase tracking-wide text-white/70">Ventana vencida</p>
                <p className="text-lg font-bold tabular-nums leading-tight">
                  hace {Math.abs(diasRestantes)} días
                </p>
                <p className="text-[10px] text-white/70">
                  Fecha fin en la hoja: {finISO} · actualizala
                </p>
              </>
            ) : (
              <>
                <p className="text-[11px] uppercase tracking-wide text-white/70">Quedan</p>
                <p className="text-lg font-bold tabular-nums leading-tight">
                  {diasRestantes} días
                </p>
                <p className="text-[10px] text-white/70">hasta {finISO}</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Alerta accionable: un hallazgo con su botón para ir a verlo.
 *
 * A diferencia de un KPI, no está para informar sino para que alguien haga algo,
 * así que siempre lleva la acción al lado. Si no hay nada que reportar no se
 * dibuja: una alerta en cero es ruido.
 */
export function AlertaAccionable({ icono, texto, detalle, onAccion, textoAccion, tono = 'rose' }: {
  icono: string;
  texto: string;
  detalle: string;
  onAccion?: () => void;
  textoAccion?: string;
  tono?: 'rose' | 'amber';
}) {
  const estilos = tono === 'rose'
    ? 'bg-rose-50 border-rose-200 text-rose-800'
    : 'bg-amber-50 border-amber-200 text-amber-800';
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 ${estilos}`}>
      <span aria-hidden="true" className="text-base flex-shrink-0">{icono}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-tight">{texto}</p>
        <p className="text-[11px] opacity-80 leading-tight mt-0.5">{detalle}</p>
      </div>
      {onAccion && textoAccion && (
        <button
          onClick={onAccion}
          className="flex-shrink-0 text-[11px] font-semibold rounded-lg px-2.5 py-1.5
                     bg-white/70 hover:bg-white active:scale-95 transition-all border border-current/20"
        >
          {textoAccion}
        </button>
      )}
    </div>
  );
}

/** Chip de filtro activo, con su × para quitarlo. */
export function ChipFiltro({ label, onQuitar }: { label: string; onQuitar: () => void }) {
  return (
    <button
      onClick={onQuitar}
      className="inline-flex items-center gap-1.5 text-[11px] font-medium rounded-full
                 bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1
                 transition-colors active:scale-95"
      aria-label={`Quitar filtro ${label}`}
    >
      {label}
      <span className="text-slate-400" aria-hidden="true">×</span>
    </button>
  );
}
