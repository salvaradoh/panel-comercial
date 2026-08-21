import { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { useMetas } from '../../hooks/useMetas';

const META_ANUAL_USD = 70_000_000;
const MESES_NOMBRE = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function fmtUSDFull(v: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
}

function fmtUSDShort(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function semanaActual(): number {
  return Math.min(4, Math.ceil(new Date().getDate() / 7));
}

interface AnnualMetricsPanelProps {
  ytdActual: number;
  anio: number;
  mes: number;
  proyeccionYoY?: number | null;
  horizontal?: boolean;
}

function ProgressBar({
  cumpl, color, proyPct,
}: {
  cumpl: number; color: string; proyPct?: number | null;
}) {
  return (
    <div className="relative w-full bg-slate-100 rounded-full h-1.5 overflow-hidden my-1.5">
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all"
        style={{ width: `${Math.min(cumpl * 100, 100)}%`, background: color }}
      />
      {proyPct != null && proyPct > cumpl && (
        <div
          className="absolute top-0 bottom-0 w-px bg-slate-500 opacity-50"
          style={{ left: `${Math.min(proyPct * 100, 100)}%` }}
        />
      )}
    </div>
  );
}

function AvanceCombinedCard({
  mes, anio, semana, semanasDisponibles, onSemanaChange,
  mesAvance, mesMeta,
  semAvance, semMeta,
  mesAvanceAnt,
  mesLoading, semLoading,
  compact = false,
  className,
}: {
  mes: number; anio: number; semana: number;
  semanasDisponibles: number[]; onSemanaChange: (s: number) => void;
  mesAvance: number; mesMeta: number; proyeccionMes: number | null;
  semAvance: number; semMeta: number; proyeccionSem: number | null;
  mesAvanceAnt: number;
  mesLoading: boolean; semLoading: boolean;
  compact?: boolean;
  className?: string;
}) {
  const mesCumpl  = mesMeta > 0 ? mesAvance / mesMeta : 0;
  const semCumpl  = semMeta > 0 ? semAvance / semMeta : 0;
  const mesColor  = mesCumpl >= 1 ? '#10b981' : mesCumpl >= 0.8 ? '#f59e0b' : '#ef4444';
  const semColor  = semCumpl >= 1 ? '#10b981' : semCumpl >= 0.8 ? '#f59e0b' : '#ef4444';
  const yoy       = !compact && mesAvanceAnt > 0 ? ((mesAvance - mesAvanceAnt) / mesAvanceAnt) * 100 : null;
  const mesGap    = mesMeta - mesAvance;
  const semGap    = semMeta - semAvance;

  const cardCls = compact ? `${className} !p-3` : className;

  return (
    <Card className={cardCls}>
      <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
        Avance {MESES_NOMBRE[mes]} {anio}
      </p>

      <div className="grid grid-cols-2 gap-x-3">
        {/* ── Mensual ── */}
        <div className="border-r border-slate-100 pr-3">
          <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wide mb-0.5">Mensual</p>
          {mesLoading ? (
            <div className="h-10 bg-slate-100 rounded animate-pulse" />
          ) : (
            <>
              <span className="text-sm font-bold tabular-nums leading-tight" style={{ color: '#0097A7' }}>
                {fmtUSDFull(mesAvance)}
              </span>
              {mesMeta > 0 && (
                <p className="text-[9px] text-slate-400 leading-none">Meta {fmtUSDShort(mesMeta)}</p>
              )}
              <ProgressBar cumpl={mesCumpl} color={mesColor} />
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold tabular-nums" style={{ color: mesColor }}>
                  {(mesCumpl * 100).toFixed(1)}%
                </span>
                {mesMeta > 0 && (
                  <span className={`text-[9px] tabular-nums ${mesGap <= 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {mesGap <= 0 ? `▲${fmtUSDShort(Math.abs(mesGap))}` : `${fmtUSDShort(mesGap)} rest.`}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Semanal ── */}
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wide">Semana</p>
            <select
              value={semana}
              onChange={e => onSemanaChange(Number(e.target.value))}
              className="text-[9px] font-semibold text-slate-600 bg-slate-100 border-0 rounded px-1 py-px cursor-pointer outline-none hover:bg-slate-200 transition-colors"
            >
              {(semanasDisponibles.length > 0 ? semanasDisponibles : [1, 2, 3, 4]).map(s => (
                <option key={s} value={s}>S{s}</option>
              ))}
            </select>
          </div>
          {semLoading ? (
            <div className="h-10 bg-slate-100 rounded animate-pulse" />
          ) : (
            <>
              <span className="text-sm font-bold tabular-nums leading-tight" style={{ color: '#0097A7' }}>
                {fmtUSDFull(semAvance)}
              </span>
              {semMeta > 0 && (
                <p className="text-[9px] text-slate-400 leading-none">Meta {fmtUSDShort(semMeta)}</p>
              )}
              <ProgressBar cumpl={semCumpl} color={semColor} />
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold tabular-nums" style={{ color: semColor }}>
                  {(semCumpl * 100).toFixed(1)}%
                </span>
                {semMeta > 0 && (
                  <span className={`text-[9px] tabular-nums ${semGap <= 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {semGap <= 0 ? `▲${fmtUSDShort(Math.abs(semGap))}` : `${fmtUSDShort(semGap)} rest.`}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {yoy !== null && (
        <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-slate-100">
          <span className="text-[9px] text-slate-400">
            Cierre {anio - 1}: {fmtUSDShort(mesAvanceAnt)}
          </span>
          <span className={`text-[9px] font-bold tabular-nums ${yoy >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {yoy >= 0 ? '▲' : '▼'} {Math.abs(yoy).toFixed(1)}% vs {anio - 1}
          </span>
        </div>
      )}
    </Card>
  );
}

export function AnnualMetricsPanel({ ytdActual, anio, mes, proyeccionYoY, horizontal = false }: AnnualMetricsPanelProps) {
  const mesActual = new Date().getMonth() + 1;
  const [semana, setSemana] = useState<number>(semanaActual());

  const { data: mesMetas,    isFetching: mesLoading } = useMetas(anio,      mes, 0);
  const { data: semMetas,    isFetching: semLoading } = useMetas(anio,      mes, semana);

  // Auto-seleccionar la última semana disponible cuando carguen los datos
  useEffect(() => {
    const disponibles = mesMetas?.semanasDisponibles ?? [];
    if (disponibles.length > 0) {
      setSemana(Math.max(...disponibles));
    }
  }, [mesMetas]);
  const { data: mesMetasAnt }                         = useMetas(anio - 1,  mes, 0);
  // Semanas individuales del año anterior para acumulado correcto
  const { data: semMetasAntW1 } = useMetas(anio - 1, mes, 1);
  const { data: semMetasAntW2 } = useMetas(anio - 1, mes, 2);
  const { data: semMetasAntW3 } = useMetas(anio - 1, mes, 3);
  const { data: semMetasAntW4 } = useMetas(anio - 1, mes, 4);

  const sum = (d: typeof mesMetas, field: 'avance' | 'meta') =>
    (d ?? { paises: [] }).paises.reduce((s, p) => s + p[field], 0);

  const sumProy = (d: typeof semMetas, field: 'proyeccionSem' | 'proyeccionMes') =>
    (d ?? { paises: [] }).paises.reduce((s, p) => s + ((p[field] as number | undefined) || 0), 0);

  const mesAvance    = sum(mesMetas,    'avance');
  const mesMeta      = sum(mesMetas,    'meta');
  const semAvance    = sum(semMetas,    'avance');
  const semMeta      = sum(semMetas,    'meta');
  const mesAvanceAnt = sum(mesMetasAnt, 'avance');

  // Proyecciones precomputadas por GAS (cols 8 y 9 del Cache_Reporte) — fuente primaria
  const proyeccionMesGAS = sumProy(semMetas, 'proyeccionMes');
  const proyeccionSemGAS = sumProy(semMetas, 'proyeccionSem');

  // Fallback: cálculo propio si GAS no tiene valores
  const allWeeksAnt = [semMetasAntW1, semMetasAntW2, semMetasAntW3, semMetasAntW4];
  const semAvanceAntCum = allWeeksAnt
    .slice(0, semana)
    .reduce((acc, d) => acc + sum(d, 'avance'), 0);

  const semAvanceAntFallback = sum(allWeeksAnt[semana - 1], 'avance');
  const denominadorYoY = semAvanceAntCum > 0
    ? semAvanceAntCum
    : semAvanceAntFallback > 0
      ? semAvanceAntFallback
      : mesAvanceAnt > 0 ? mesAvanceAnt * (semana / 4.33) : 0;

  const factorYoYMes          = denominadorYoY > 0 ? mesAvanceAnt / denominadorYoY : 0;
  const proyeccionMesFallback = factorYoYMes > 0 ? mesAvance * factorYoYMes : null;

  const _today       = new Date().getDate();
  const _semStart    = (semana - 1) * 7 + 1;
  const _semEnd      = semana * 7;
  const _diasElapsed = _today >= _semStart && _today <= _semEnd
    ? _today - _semStart + 1
    : _today > _semEnd ? 7 : 1;
  const proyeccionSemFallback = semAvance > 0 ? (semAvance / _diasElapsed) * 7 : null;

  // Usar GAS como fuente primaria; fallback a cálculo propio
  const proyeccionMes = proyeccionMesGAS > 0 ? proyeccionMesGAS : proyeccionMesFallback;
  const proyeccionSem = proyeccionSemGAS > 0 ? proyeccionSemGAS : proyeccionSemFallback;

  const pctHacia70M   = Math.min(ytdActual / META_ANUAL_USD, 1);
  const proyLineal    = mesActual > 0 ? (ytdActual / mesActual) * 12 : 0;
  const proyeccion    = proyeccionYoY ?? proyLineal;
  const tieneYoY      = proyeccionYoY != null && proyeccionYoY > 0;
  const pctProyeccion = proyeccion / META_ANUAL_USD;

  return (
    <div className={`flex gap-3 ${horizontal ? 'flex-row items-stretch' : 'flex-col'}`}>

      {/* Card: Meta $70M */}
      <Card className={horizontal ? 'flex-1 min-w-0 flex flex-col !p-3' : ''}>
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">Meta Global {anio}</p>
          <span className="text-[9px] text-slate-300">$70M</span>
        </div>
        <div className="flex items-baseline gap-1 mb-0.5">
          <span className={`font-bold tabular-nums text-[#0097A7] ${horizontal ? 'text-base' : 'text-xl'}`}>{fmtUSDFull(ytdActual)}</span>
          <span className="text-[10px] text-slate-400">/ $70M</span>
        </div>
        <div className="relative w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mb-0.5">
          <div className="absolute inset-y-0 left-0 rounded-full bg-[#0097A7] opacity-20"
            style={{ width: `${Math.min(pctProyeccion * 100, 100)}%` }} />
          <div className="absolute inset-y-0 left-0 rounded-full bg-[#0097A7]"
            style={{ width: `${Math.min(pctHacia70M * 100, 100)}%` }} />
        </div>
        <p className="text-[9px] text-slate-400 mb-1.5">{(pctHacia70M * 100).toFixed(1)}% alcanzado</p>
        <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-[9px] text-slate-400">Proyección al cierre</p>
            <p className={`text-xs font-bold tabular-nums ${proyeccion >= META_ANUAL_USD ? 'text-emerald-600' : 'text-amber-500'}`}>
              {fmtUSDFull(proyeccion)}
            </p>
            <p className={`text-[9px] font-medium ${proyeccion >= META_ANUAL_USD ? 'text-emerald-600' : 'text-red-500'}`}>
              {proyeccion >= META_ANUAL_USD
                ? `▲ ${fmtUSDShort(proyeccion - META_ANUAL_USD)} sobre`
                : `▼ ${fmtUSDShort(META_ANUAL_USD - proyeccion)} bajo`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-slate-400">{tieneYoY ? 'Factor YoY' : 'Lineal'}</p>
            <p className="text-[9px] text-slate-400">{MESES_NOMBRE[mesActual]}→Dic</p>
          </div>
        </div>
      </Card>

      {/* Card combinada: Avance Mensual + Semanal */}
      <div className={horizontal ? 'flex-1 min-w-0 flex flex-col' : ''}>
        <AvanceCombinedCard
          mes={mes}
          anio={anio}
          semana={semana}
          semanasDisponibles={mesMetas?.semanasDisponibles ?? []}
          onSemanaChange={setSemana}
          mesAvance={mesAvance}
          mesMeta={mesMeta}
          proyeccionMes={proyeccionMes}
          semAvance={semAvance}
          semMeta={semMeta}
          proyeccionSem={proyeccionSem}
          mesAvanceAnt={mesAvanceAnt}
          mesLoading={mesLoading}
          semLoading={semLoading}
          compact={horizontal}
          className={horizontal ? 'flex-1' : ''}
        />
      </div>

    </div>
  );
}
