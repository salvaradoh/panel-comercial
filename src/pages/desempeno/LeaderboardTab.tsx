import React, { useState, useMemo, useTransition } from 'react';
import { useMetas } from '../../hooks/useMetas';
import { useKamsReporte } from '../../hooks/useKamsReporte';
import type { KamReporte } from '../../hooks/useKamsReporte';
import type { PaisData } from '../../hooks/types';
import { inicialesKam } from '../../lib/kams';
import { useKamPhotos, findKamPhoto } from '../../hooks/useKamPhotos';
import { useReuniones } from '../../hooks/useReuniones';
import type { SellerReuniones } from '../../hooks/useReuniones';

const EXCLUDED = new Set(['Ecuador', 'ecuador']);

const FLAG_CC: Record<string, string> = {
  Chile: 'cl', Perú: 'pe', Peru: 'pe', Colombia: 'co', México: 'mx', Mexico: 'mx',
};

const MEDALS = ['🥇', '🥈', '🥉'];
const MEDAL_BG = [
  'linear-gradient(135deg,#FFF8DC 0%,#FEF3C7 100%)',
  'linear-gradient(135deg,#F8F8F8 0%,#ECECEC 100%)',
  'linear-gradient(135deg,#FFF3EB 0%,#FFE4D0 100%)',
];
const MEDAL_BORDER = ['#EAC645', '#C8C8C8', '#D4895A'];
const MEDAL_COLOR  = ['#B45309', '#6B7280', '#C2622A'];

type LeaderTab = 'avances' | 'ranking' | 'reuniones';
type RolFilter = 'Todos' | 'KAM' | 'Full Cycle' | 'BDM';
interface LeaderboardTabProps { anio: number; mes: number; defaultSemana?: number; filterPais?: string }
const WEEK_OPTS = [{ v: 0, l: 'Mes' }, { v: 1, l: 'S1' }, { v: 2, l: 'S2' }, { v: 3, l: 'S3' }, { v: 4, l: 'S4' }];
const ROL_OPTS: RolFilter[] = ['Todos', 'KAM', 'Full Cycle', 'BDM'];

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtFull(v: number) {
  const abs = Math.abs(Math.round(v));
  const sign = v < 0 ? '-' : '';
  return `${sign}$${abs.toLocaleString('en-US')}`;
}
function fmtUSD(v: number) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
}

// [A6] Contraste badge: texto verde #065F46, amarillo #92400e
function pctTier(pct: number) {
  if (pct >= 1)   return { text: '#065F46', bar: '#34d399', bg: '#d1fae5' };
  if (pct >= 0.8) return { text: '#92400e', bar: '#fbbf24', bg: '#fef3c7' };
  return              { text: '#dc2626', bar: '#f87171', bg: '#fee2e2' };
}

const AVATAR_PALETTE = ['#6366f1','#0891b2','#0d9488','#7c3aed','#db2777','#ea580c','#65a30d','#2563eb'];
function avatarBg(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

// ── KamAvatar ─────────────────────────────────────────────────────────────────
// [P4] React.memo
const KamAvatar = React.memo(function KamAvatar({ nombre, photos, size = 40, ring }: {
  nombre: string; photos: Record<string, string> | undefined; size?: number; ring?: string;
}) {
  const photoUrl = findKamPhoto(photos, nombre);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
      boxShadow: ring ? `0 0 0 2.5px ${ring}, 0 2px 8px rgba(0,0,0,0.15)` : '0 1px 4px rgba(0,0,0,0.12)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: photoUrl ? '#e2e8f0' : avatarBg(nombre),
      fontSize: size * 0.34, fontWeight: 700, color: '#fff',
    }} aria-hidden="true">
      {photoUrl
        ? <img src={photoUrl} alt={nombre}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }} />
        : inicialesKam(nombre)
      }
    </div>
  );
});

// ── Badges ────────────────────────────────────────────────────────────────────
function PctBadge({ pct, xs }: { pct: number; xs?: boolean }) {
  const t = pctTier(pct);
  return (
    <span className={`inline-flex items-center rounded-full font-bold tabular-nums ${xs ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'}`}
      style={{ color: t.text, background: t.bg }}>
      {(pct * 100).toFixed(1)}%
    </span>
  );
}

function ConsistenciaBadge({ n, of = 4 }: { n: number; of?: number }) {
  const r = of > 0 ? n / of : 0;
  const c = r >= 0.75 ? '#059669' : r >= 0.5 ? '#d97706' : '#dc2626';
  const bg = r >= 0.75 ? '#d1fae5' : r >= 0.5 ? '#fef3c7' : '#fee2e2';
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums"
      style={{ color: c, background: bg }} title={`Consistencia: ${n}/${of} semanas ≥80%`}>
      {n}/{of}
      {/* [A10] aria-hidden en SVG decorativo */}
      <svg width="8" height="8" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <path d="M2 5l2 2 4-4" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function VarYoYChip({ v }: { v: number }) {
  if (!v) return <span className="text-[10px] text-slate-300">—</span>;
  const pos = v > 0;
  return (
    <span className={`text-[11px] font-semibold tabular-nums ${pos ? 'text-emerald-600' : 'text-red-500'}`}>
      {pos ? '+' : ''}{fmtFull(v)}
    </span>
  );
}

// ── Podium Card ───────────────────────────────────────────────────────────────
// [P4] React.memo
const PodiumCard = React.memo(function PodiumCard({ kam, rankIdx, photos }: { kam: KamReporte; rankIdx: number; photos: Record<string, string> | undefined }) {
  const cc = FLAG_CC[kam.pais];
  const isFirst = rankIdx === 0;
  return (
    <div className={`flex-1 flex flex-col items-center rounded-2xl px-4 pt-8 pb-5 gap-2 relative ${isFirst ? 'shadow-lg' : 'shadow-sm'}`}
      style={{ background: MEDAL_BG[rankIdx], border: `1.5px solid ${MEDAL_BORDER[rankIdx]}`, marginTop: isFirst ? 0 : 16 }}>
      {/* Medal */}
      <span className="absolute top-2 right-3 select-none" style={{ fontSize: isFirst ? 44 : 34, lineHeight: 1 }}>
        {MEDALS[rankIdx]}
      </span>

      <KamAvatar nombre={kam.nombre} photos={photos} size={isFirst ? 72 : 60} ring={MEDAL_BORDER[rankIdx]} />

      <div className="text-center mt-1">
        <p className="text-sm font-bold leading-tight" style={{ color: MEDAL_COLOR[rankIdx] }}>
          {kam.nombre.split(' ').slice(0, 2).join(' ')}
        </p>
        {cc && (
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <img src={`https://flagcdn.com/16x12/${cc}.png`} width={14} height={10} alt={kam.pais} className="rounded-[2px] opacity-80" />
            <span className="text-[10px] text-slate-400">{kam.pais}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <PctBadge pct={kam.pct} />
        <ConsistenciaBadge n={kam.consistencia} />
      </div>
    </div>
  );
});

// ── Avances KAM row — detailed (Meta/Avance/Proy/VarYoY/%) ────────────────────
// [P4] React.memo
const AvancesRow = React.memo(function AvancesRow({ kam, rank }: { kam: KamReporte; rank: number }) {
  const t = pctTier(kam.pct);
  const barW = Math.min(kam.pct * 100, 100);
  return (
    <div className="flex items-center gap-2.5 px-4 py-3 hover:bg-slate-50/80 transition-colors motion-reduce:transition-none">
      <span className="w-5 text-center text-xs font-bold tabular-nums text-slate-300 flex-shrink-0">{rank}</span>

      {/* Nombre + barra */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{kam.nombre}</p>
        {/* [P3] transform scaleX en lugar de width para evitar layout thrashing */}
        <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#e2e8f0' }}>
          <div className="h-1.5 rounded-full motion-reduce:transition-none" style={{ width: '100%', transformOrigin: 'left center', transform: `scaleX(${barW / 100})`, transition: 'transform 700ms ease', background: t.bar }} />
        </div>
      </div>

      <p className="text-xs font-medium tabular-nums text-slate-500 text-right hidden sm:block flex-shrink-0 w-20">{fmtFull(kam.meta)}</p>
      <p className="text-xs font-bold tabular-nums text-slate-800 text-right flex-shrink-0 w-20">{fmtFull(kam.avance)}</p>
      <p className="text-xs font-medium tabular-nums text-slate-500 text-right hidden md:block flex-shrink-0 w-20">{kam.proy > 0 ? fmtFull(kam.proy) : '—'}</p>
      <div className="text-right hidden md:block flex-shrink-0 w-20"><VarYoYChip v={kam.varYoY} /></div>
      <div className="flex-shrink-0 w-14 flex justify-end"><PctBadge pct={kam.pct} xs /></div>
    </div>
  );
});

// ── Ranking row — clean (solo posición, foto, nombre, barra, %) ───────────────
// [P4] React.memo
const RankingRow = React.memo(function RankingRow({ kam, rank }: { kam: KamReporte; rank: number }) {
  const t = pctTier(kam.pct);
  const barW = Math.min(kam.pct * 100, 100);
  const cc = FLAG_CC[kam.pais];
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/80 transition-colors motion-reduce:transition-none">
      <span className="w-6 text-center text-xs font-bold tabular-nums text-slate-300 flex-shrink-0">{rank}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-slate-800 truncate">{kam.nombre}</p>
          {cc && <img src={`https://flagcdn.com/16x12/${cc}.png`} width={14} height={10} alt={kam.pais} className="rounded-[2px] opacity-60 flex-shrink-0" />}
        </div>
        {/* [P3] transform scaleX en lugar de width para evitar layout thrashing */}
        <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#e2e8f0' }}>
          <div className="h-1.5 rounded-full motion-reduce:transition-none" style={{ width: '100%', transformOrigin: 'left center', transform: `scaleX(${barW / 100})`, transition: 'transform 700ms ease', background: t.bar }} />
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <PctBadge pct={kam.pct} />
        <ConsistenciaBadge n={kam.consistencia} />
      </div>
    </div>
  );
});

// ── Country Section (Avances tab) ─────────────────────────────────────────────
// [P4] React.memo
const CountrySection = React.memo(function CountrySection({ paisData, kams }: {
  paisData: PaisData; kams: KamReporte[];
}) {
  const [open, setOpen] = useState(true);
  const { pais, avance, meta, pct, proyeccionSem, varYoY } = paisData;
  const cc = FLAG_CC[pais];
  const t = pctTier(pct);
  const barW = Math.min(pct * 100, 100);
  const sorted = [...kams].sort((a, b) => b.pct - a.pct);

  // El total del país sale de la facturación completa; las filas son sólo de
  // ejecutivos. La diferencia es lo facturado por clientes sin ejecutivo asignado
  // (etiquetados 'Otros', 'País', '-' o en blanco según el país). Se muestra el
  // monto real en vez de una nota genérica, para que el descuadre sea explicable
  // y no parezca un error de cálculo.
  const avanceKams = sorted.reduce((s, k) => s + k.avance, 0);
  const sinAsignar = Math.round(avance - avanceKams);

  return (
    <div className="rounded-2xl border border-slate-100 shadow-sm overflow-hidden bg-white">
      <button
        // [A9] transition-colors motion-reduce:transition-none
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors motion-reduce:transition-none text-left"
        onClick={() => setOpen(o => !o)} aria-expanded={open}
      >
        <div className="flex items-center gap-2 flex-shrink-0">
          {cc && <img src={`https://flagcdn.com/20x15/${cc}.png`} srcSet={`https://flagcdn.com/40x30/${cc}.png 2x`}
            width={20} height={15} alt={pais} className="rounded-[3px] shadow-sm" />}
          <span className="text-sm font-bold text-slate-800">{pais}</span>
        </div>

        <div className="flex-1 mx-3 hidden sm:block">
          {/* [P3] transform scaleX en lugar de width para evitar layout thrashing */}
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#f1f5f9' }}>
            <div className="h-1.5 rounded-full motion-reduce:transition-none" style={{ width: '100%', transformOrigin: 'left center', transform: `scaleX(${barW / 100})`, transition: 'transform 700ms ease', background: t.bar }} />
          </div>
        </div>

        <div className="flex items-center gap-2.5 ml-auto flex-shrink-0">
          {proyeccionSem && proyeccionSem > 0 && (
            <div className="text-right hidden md:block cursor-help"
                 title="Proyección de cierre del mes, calculada con el ritmo del mismo mes del año pasado.">
              <span className="text-[10px] text-slate-400">Proy </span>
              <span className="text-xs font-semibold tabular-nums text-slate-500">{fmtFull(proyeccionSem)}</span>
            </div>
          )}
          {/* La cifra sola no decía contra qué compara: se rotula explícitamente */}
          {varYoY !== undefined && varYoY !== 0 && (
            <div className="hidden md:flex items-center gap-1 cursor-help"
                 title="Diferencia contra el mismo período del año anterior: lo vendido este mes vs. lo vendido a esta misma altura del mismo mes del año pasado.">
              <span className="text-[10px] text-slate-400 normal-case tracking-normal">vs 2025</span>
              <VarYoYChip v={varYoY} />
            </div>
          )}
          <div className="text-right hidden sm:block">
            <span className="text-sm font-bold tabular-nums text-slate-700">{fmtUSD(avance)}</span>
            <span className="text-xs text-slate-400 tabular-nums"> / {fmtUSD(meta)}</span>
          </div>
          <PctBadge pct={pct} />
          {/* [A9] transition-transform motion-reduce:transition-none  [A10] aria-hidden */}
          <svg className={`w-4 h-4 text-slate-400 transition-transform motion-reduce:transition-none flex-shrink-0 ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 divide-y divide-slate-50">
          {/* Cabecera columnas — los title explican contra qué se compara cada cifra */}
          <div className="flex items-center gap-2.5 px-4 py-2 bg-slate-50 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
            <span className="w-5" />
            <span className="flex-1">Ejecutivo</span>
            <span className="w-20 text-right hidden sm:block">Meta</span>
            <span className="w-20 text-right">Avance</span>
            <span className="w-20 text-right hidden md:block cursor-help"
                  title="Proyección de cierre del mes. Se calcula con el ritmo del mismo mes del año pasado: cuánto de ese mes quedaba por vender a esta misma altura.">
              Proy
            </span>
            <span className="w-20 text-right hidden md:block cursor-help"
                  title="Diferencia contra el mismo período del año anterior: lo vendido este mes vs. lo que el ejecutivo había vendido a esta misma altura del mismo mes del año pasado. No compara contra el mes completo.">
              vs Año ant
            </span>
            <span className="w-14 text-right">%</span>
          </div>
          {sorted.length === 0
            ? <p className="text-slate-400 text-sm text-center py-6">Sin datos de ejecutivos</p>
            : sorted.map((k, i) => <AvancesRow key={k.nombre} kam={k} rank={i + 1} />)
          }

          {/* Aclara por qué las filas no suman el total del país.
              Requiere al menos un ejecutivo: Ecuador no tiene estructura de KAMs,
              así que ahí el 100% no es "sin asignar" sino que no aplica. */}
          {sorted.length > 0 && sinAsignar > 500 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50/70 text-[11px] text-slate-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
              </svg>
              <span>
                Esta vista muestra sólo ejecutivos. El total de {pais} incluye{' '}
                <strong className="text-slate-500 tabular-nums">{fmtFull(sinAsignar)}</strong>{' '}
                de clientes sin ejecutivo asignado, por eso las filas no suman el total.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ── Reuniones tab ─────────────────────────────────────────────────────────────

function sellerCount(k: SellerReuniones, semana: number): number {
  if (semana === 0) return k.mes;
  if (semana === 1) return k.sem1;
  if (semana === 2) return k.sem2;
  if (semana === 3) return k.sem3;
  return k.sem4;
}

function posBadge(pos: number, count: number) {
  if (count === 0) return { bg: '#fee2e2', color: '#dc2626', label: '0' };
  if (pos === 1)   return { bg: '#FEF3C7', color: '#B45309', label: '🥇' };
  if (pos === 2)   return { bg: '#F8F8F8', color: '#6B7280', label: '🥈' };
  if (pos === 3)   return { bg: '#FFF3EB', color: '#C2622A', label: '🥉' };
  if (pos <= 7)    return { bg: '#e0f2fe', color: '#0369a1', label: String(pos) };
  return               { bg: '#f1f5f9', color: '#64748b', label: String(pos) };
}

const ReunionesList = React.memo(function ReunionesList({
  sellers, semana, rol, photos,
}: {
  sellers: SellerReuniones[];
  semana: number;
  rol: RolFilter;
  photos: Record<string, string> | undefined;
}) {
  const sorted = useMemo(() => {
    const base = rol === 'Todos' ? sellers : sellers.filter(s => s.rol === rol);
    return [...base].sort((a, b) => sellerCount(b, semana) - sellerCount(a, semana));
  }, [sellers, semana, rol]);

  const maxCount = sorted.length > 0 ? Math.max(1, sellerCount(sorted[0], semana)) : 1;

  if (sorted.length === 0) {
    return <p className="text-slate-400 text-sm text-center py-12">Sin datos de reuniones</p>;
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-100
        text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
        <span className="w-8 text-center">#</span>
        <span className="w-8" />
        <span className="flex-1">Ejecutivo</span>
        <span className="text-right w-16">Reuniones</span>
      </div>

      <div className="divide-y divide-slate-50">
        {sorted.map((s, i) => {
          const count = sellerCount(s, semana);
          const pos   = i + 1;
          const badge = posBadge(pos, count);
          const barW  = (count / maxCount) * 100;
          return (
            <div key={s.sellerEmail}
              className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/80 transition-colors motion-reduce:transition-none">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
                style={{ background: badge.bg, color: badge.color }}>
                {badge.label}
              </div>

              <KamAvatar nombre={s.nombre} photos={photos} size={32} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-slate-800 truncate">{s.nombre}</p>
                  {s.rol && s.rol !== 'KAM' && (
                    <span className="text-[10px] text-slate-400 flex-shrink-0 bg-slate-100 px-1.5 py-0.5 rounded-full">{s.rol}</span>
                  )}
                </div>
                <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#e2e8f0' }}>
                  <div className="h-1.5 rounded-full motion-reduce:transition-none"
                    style={{
                      width: '100%',
                      transformOrigin: 'left center',
                      transform: `scaleX(${barW / 100})`,
                      transition: 'transform 700ms ease',
                      background: count === 0 ? '#fca5a5' : pos <= 3 ? '#f59e0b' : '#0891b2',
                    }} />
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0 w-16 justify-end">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className="text-slate-400" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span className="text-sm font-bold tabular-nums"
                  style={{ color: count === 0 ? '#dc2626' : '#1e293b' }}>
                  {count}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-t border-slate-100">
        <div className="w-8" />
        <div className="w-8" />
        <p className="flex-1 text-xs font-semibold text-slate-500">Total reuniones</p>
        <span className="text-sm font-bold tabular-nums text-slate-700 w-16 text-right">
          {sorted.reduce((s, k) => s + sellerCount(k, semana), 0)}
        </span>
      </div>
    </div>
  );
});

// ── Main ──────────────────────────────────────────────────────────────────────
export function LeaderboardTab({ anio, mes, defaultSemana = 0, filterPais }: LeaderboardTabProps) {
  const [activeTab, setActiveTab]             = useState<LeaderTab>('avances');
  const [avancesSemana, setAvancesSemana]     = useState(defaultSemana > 0 ? defaultSemana : 0);
  const [reunionesSemana, setReunionesSemana] = useState(0);
  const [reunionesRol, setReunionesRol]       = useState<RolFilter>('Todos');
  // [P6] useTransition para cambios de tab y semana
  const [, startTransition] = useTransition();

  const { data: kamsMes,    isLoading: mesLoading }    = useKamsReporte(anio, mes, 0);
  const { data: kamsAv,     isLoading: avLoading }     = useKamsReporte(anio, mes, avancesSemana);
  const { data: metasAv,    isLoading: metasAvLoading } = useMetas(anio, mes, avancesSemana);
  useMetas(anio, mes, 0); // prefetch month metas
  const { data: photos } = useKamPhotos();
  const { data: reunionesData, isLoading: reunionesLoading } = useReuniones(anio, mes);

  const isLoading = activeTab === 'avances'   ? (avLoading || metasAvLoading)
                  : activeTab === 'reuniones'  ? reunionesLoading
                  : mesLoading;

  // [P5] useMemo para derivaciones costosas
  // Podium y Ranking: siempre global (sin filtro de país)
  const allMes = useMemo(() => (kamsMes ?? []).filter(k => !EXCLUDED.has(k.pais)), [kamsMes]);
  const top3   = useMemo(() => [...allMes].sort((a, b) => b.pct - a.pct).slice(0, 3), [allMes]);
  const podium = useMemo(() => top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3, [top3]);
  const rankingList = useMemo(() => [...allMes].sort((a, b) => b.pct - a.pct), [allMes]);
  // Avances: filtrado por país cuando aplica
  const avByPais = useMemo(() => {
    const map: Record<string, KamReporte[]> = {};
    for (const k of kamsAv ?? []) {
      if (EXCLUDED.has(k.pais)) continue;
      if (filterPais && k.pais !== filterPais) continue;
      if (!map[k.pais]) map[k.pais] = [];
      map[k.pais].push(k);
    }
    return map;
  }, [kamsAv, filterPais]);
  const paisesAv = useMemo(
    () => {
      const base = [...(metasAv?.paises ?? [])].filter(p => !EXCLUDED.has(p.pais));
      return (filterPais ? base.filter(p => p.pais === filterPais) : base).sort((a, b) => b.pct - a.pct);
    },
    [metasAv, filterPais],
  );

  // Agrega "Otros" por país: diferencia entre total real del país y suma de KAMs nombrados.
  // Los KAMs que ya resuelven a "Otros" (AA, EC, etc.) se excluyen del desglose para que
  // solo aparezca UNA fila "Otros" = country_total - named_KAMs (incluye los anónimos).
  const avByPaisWithOtros = useMemo(() => {
    const result: Record<string, KamReporte[]> = {};
    for (const [pais, kams] of Object.entries(avByPais)) {
      result[pais] = kams.filter(k => k.nombre !== 'Otros');
    }
    for (const p of paisesAv) {
      const namedKams = result[p.pais] ?? [];
      const namedSum  = namedKams.reduce((s, k) => s + k.avance, 0);
      const otros     = Math.round((p.avance - namedSum) * 100) / 100;
      if (otros > 1) {
        result[p.pais] = [
          ...namedKams,
          { pais: p.pais, nombre: 'Otros', meta: 0, avance: otros, proy: 0, ant: 0, pct: 0, varYoY: 0, consistencia: 0 },
        ];
      }
    }
    return result;
  }, [avByPais, paisesAv]);
  // Reuniones: siempre global (sin filtro de país)
  const reunionesFiltered = reunionesData;

  const mesNombre = new Date(anio, mes - 1).toLocaleString('es', { month: 'long', year: 'numeric' });

  return (
    <div className="flex flex-col gap-4">

      {/* Podium */}
      {podium.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Top Ejecutivos · {mesNombre}
          </p>
          <div className="flex gap-3 items-end">
            {podium.map(kam => (
              <PodiumCard key={kam.nombre} kam={kam} rankIdx={top3.indexOf(kam)} photos={photos} />
            ))}
          </div>
        </div>
      )}

      {/* Toggle + Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
          {(['avances', 'ranking', 'reuniones'] as LeaderTab[]).map(tab => (
            <button key={tab}
              // [P6] startTransition para cambio de tab
              onClick={() => startTransition(() => setActiveTab(tab))}
              aria-pressed={activeTab === tab}
              // [A9] transition-all motion-reduce:transition-none
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all motion-reduce:transition-none active:scale-95 ${
                activeTab === tab ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {tab === 'avances' ? 'Avances' : tab === 'ranking' ? 'Ranking' : 'Reuniones'}
            </button>
          ))}
        </div>

        {activeTab === 'avances' && (
          <div className="flex gap-1">
            {WEEK_OPTS.map(opt => (
              <button key={opt.v}
                onClick={() => startTransition(() => setAvancesSemana(opt.v))}
                aria-pressed={avancesSemana === opt.v}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all motion-reduce:transition-none duration-150 active:scale-95 ${
                  avancesSemana === opt.v ? 'bg-[#0097A7] text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}>
                {opt.l}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'reuniones' && (
          <>
            <div className="flex gap-1">
              {WEEK_OPTS.map(opt => (
                <button key={opt.v}
                  onClick={() => startTransition(() => setReunionesSemana(opt.v))}
                  aria-pressed={reunionesSemana === opt.v}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all motion-reduce:transition-none duration-150 active:scale-95 ${
                    reunionesSemana === opt.v ? 'bg-[#0097A7] text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}>
                  {opt.l}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {ROL_OPTS.map(r => (
                <button key={r}
                  onClick={() => startTransition(() => setReunionesRol(r))}
                  aria-pressed={reunionesRol === r}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all motion-reduce:transition-none duration-150 active:scale-95 ${
                    reunionesRol === r ? 'bg-violet-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}>
                  {r}
                </button>
              ))}
            </div>
          </>
        )}

        {/* [A8] role y aria-label en spinner  [A9] animate-spin motion-reduce:animate-none */}
        {isLoading && (
          <span
            role="status"
            aria-label="Cargando datos"
            className="w-4 h-4 rounded-full border-2 border-[#0097A7] border-t-transparent animate-spin motion-reduce:animate-none"
          />
        )}
      </div>

      {/* Content with smooth fade transition */}
      {/* [A9] transition-opacity motion-reduce:transition-none */}
      <div className={`transition-opacity motion-reduce:transition-none duration-300 ${isLoading ? 'opacity-50' : 'opacity-100'}`}>

        {/* Avances tab */}
        {activeTab === 'avances' && (
          <div className="flex flex-col gap-3">
            {paisesAv.length === 0 && !isLoading && (
              <p className="text-slate-400 text-sm text-center py-12">Sin datos para esta semana</p>
            )}
            {paisesAv.map(p => (
              <CountrySection key={p.pais} paisData={p} kams={avByPaisWithOtros[p.pais] ?? []} />
            ))}
          </div>
        )}

        {/* Ranking tab — clean leaderboard */}
        {activeTab === 'ranking' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-100
              text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
              <span className="w-6 text-center">#</span>
              <span className="w-[38px]" />
              <span className="flex-1">Ejecutivo</span>
              <span className="text-right">Cumpl. / Consist.</span>
            </div>
            <div className="divide-y divide-slate-50">
              {rankingList.length === 0 && !mesLoading
                ? <p className="text-slate-400 text-sm text-center py-10">Sin datos</p>
                : rankingList.map((k, i) => <RankingRow key={k.nombre} kam={k} rank={i + 1} />)
              }
            </div>
          </div>
        )}

        {/* Reuniones tab */}
        {activeTab === 'reuniones' && (
          reunionesFiltered && reunionesFiltered.length > 0
            ? <ReunionesList sellers={reunionesFiltered} semana={reunionesSemana} rol={reunionesRol} photos={photos} />
            : !reunionesLoading
              ? <p className="text-slate-400 text-sm text-center py-12">Sin datos de reuniones</p>
              : null
        )}
      </div>
    </div>
  );
}
