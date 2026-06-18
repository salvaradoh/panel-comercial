import { useEffect, useRef } from 'react';
import { createChart, ColorType, LineStyle, AreaSeries, LineSeries } from 'lightweight-charts';
import { Card } from '../ui/Card';
import type { SeriePoint, Granularidad } from '../../hooks/useSeries';

const OPCIONES: { key: Granularidad; label: string }[] = [
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mes' },
  { key: 'trimestre', label: 'Trimestral' },
];

interface RevenueChartProps {
  data: SeriePoint[];
  granularidad: Granularidad;
  onGranularidadChange: (g: Granularidad) => void;
  isLoading?: boolean;
  paisesData?: { pais: string; pct: number }[];
  // Nuevos props para selector de mes en vista semanal
  mesSemana?: number;
  onMesSemanaChange?: (mes: number) => void;
  anio?: number;
}

function fmtUSD(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function RevenueChart({ data, granularidad, onGranularidadChange, isLoading, paisesData, mesSemana, onMesSemanaChange }: RevenueChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Limpiar chart anterior
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    if (!data.length) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#64748b',
        fontSize: 11,
        fontFamily: 'Inter, system-ui, sans-serif',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: '#f1f5f9' },
        horzLines: { color: '#f1f5f9' },
      },
      crosshair: {
        vertLine: { color: '#0097A7', width: 1, style: LineStyle.Dashed },
        horzLine: { color: '#0097A7', width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: '#e2e8f0',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: '#e2e8f0',
        timeVisible: false,
        secondsVisible: false,
        tickMarkFormatter: (time: any) => {
          if (granularidad !== 'semana') return '';
          // lightweight-charts v5 passes { year, month, day }
          const day = typeof time === 'object' ? time.day : new Date(time as string).getDate();
          const sem = day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : 4;
          return `Sem ${sem}`;
        },
      },
      handleScroll: true,
      handleScale: true,
      width: containerRef.current.clientWidth,
      height: 320,
    });

    chartRef.current = chart;

    // Serie de área — Revenue real
    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: '#0097A7',
      topColor: 'rgba(0, 151, 167, 0.3)',
      bottomColor: 'rgba(0, 151, 167, 0.02)',
      lineWidth: 2,
      priceFormat: { type: 'custom', formatter: fmtUSD, minMove: 1000 },
    });

    areaSeries.setData(data.map(d => ({ time: d.time as any, value: d.value })));

    // Serie de línea — Meta
    const metaSeries = chart.addSeries(LineSeries, {
      color: '#94a3b8',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceFormat: { type: 'custom', formatter: fmtUSD, minMove: 1000 },
      title: 'Meta',
    });

    metaSeries.setData(data.map(d => ({ time: d.time as any, value: d.meta })));

    chart.timeScale().fitContent();

    // Magnifier Tooltip — sigue el crosshair con valor exacto + ranking de países
    const tooltipEl = tooltipRef.current;
    if (tooltipEl) {
      chart.subscribeCrosshairMove((param) => {
        if (!param.point || !param.time || !param.seriesData.size) {
          tooltipEl.style.display = 'none';
          return;
        }

        const areaData = param.seriesData.get(areaSeries) as { value: number } | undefined;
        const metaData = param.seriesData.get(metaSeries) as { value: number } | undefined;
        if (!areaData) { tooltipEl.style.display = 'none'; return; }

        // Formatear tiempo
        const t = param.time as any;
        let timeLabel = '';
        if (typeof t === 'object' && t.day) {
          const sem = t.day <= 7 ? 1 : t.day <= 14 ? 2 : t.day <= 21 ? 3 : 4;
          const meses = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
          timeLabel = granularidad === 'semana'
            ? `Sem ${sem} · ${meses[t.month]} ${t.year}`
            : granularidad === 'mes'
            ? `${meses[t.month]} ${t.year}`
            : `T${t.month <= 3 ? 1 : t.month <= 6 ? 2 : t.month <= 9 ? 3 : 4} ${t.year}`;
        }

        // Ranking de países — siempre cumplimiento anual, no cambia con el filtro de período
        const pointRanking = paisesData ?? [];
        const sorted = [...pointRanking].sort((a, b) => b.pct - a.pct);

        const rankingHTML = sorted.map((p, i) =>
          `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:4px">
            <span style="color:#94a3b8;font-size:10px">${i + 1}. ${p.pais}</span>
            <span style="font-size:10px;font-weight:600;color:${p.pct >= 1 ? '#10b981' : p.pct >= 0.8 ? '#f59e0b' : '#ef4444'}">${(p.pct * 100).toFixed(1)}%</span>
          </div>`
        ).join('');

        tooltipEl.innerHTML = `
          <div style="font-size:10px;color:#94a3b8;margin-bottom:6px;font-weight:600">${timeLabel}</div>
          <div style="display:flex;align-items:baseline;gap:6px">
            <span style="font-size:16px;font-weight:700;color:#0f172a">${fmtUSD(areaData.value)}</span>
            <span style="font-size:10px;color:#0097A7">Revenue</span>
          </div>
          ${metaData ? `<div style="font-size:10px;color:#94a3b8;margin-top:2px">Meta: ${fmtUSD(metaData.value)}</div>` : ''}
          ${rankingHTML ? `<div style="border-top:1px solid #f1f5f9;margin-top:8px;padding-top:6px">${rankingHTML}</div>` : ''}
        `;

        tooltipEl.style.display = 'block';

        // Posicionar el tooltip cerca del punto sin salirse del contenedor
        const containerWidth = containerRef.current?.clientWidth ?? 600;
        const tooltipWidth = 180;
        const x = param.point.x;
        const left = x + tooltipWidth > containerWidth ? x - tooltipWidth - 10 : x + 10;
        tooltipEl.style.left = `${Math.max(0, left)}px`;
        tooltipEl.style.top = '10px';
      });
    }

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [data, paisesData, granularidad]);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Revenue vs Meta</h3>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-[#0097A7] rounded" /> Revenue
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-slate-400 rounded border-dashed border-t border-slate-400" /> Meta
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-1">
            {OPCIONES.map(op => (
              <button
                key={op.key}
                onClick={() => onGranularidadChange(op.key)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all active:scale-95 ${
                  granularidad === op.key
                    ? 'bg-[#0097A7] text-white border-[#0097A7] font-semibold'
                    : 'border-slate-200 text-slate-600 hover:border-[#0097A7] hover:text-[#0097A7]'
                }`}
                aria-pressed={granularidad === op.key}
              >
                {op.label}
              </button>
            ))}
          </div>
          {granularidad === 'semana' && onMesSemanaChange && (
            <div className="flex gap-1 flex-wrap justify-end">
              {['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map((m, i) => (
                <button
                  key={i}
                  onClick={() => onMesSemanaChange(i + 1)}
                  className={`text-xs px-2 py-1 rounded-lg border transition-all ${
                    mesSemana === i + 1
                      ? 'bg-[#0097A7] text-white border-[#0097A7] font-semibold'
                      : 'border-slate-200 text-slate-500 hover:border-[#0097A7]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="h-80 bg-slate-50 rounded-xl animate-pulse" />
      ) : data.length === 0 ? (
        <div className="h-80 flex items-center justify-center text-slate-400 text-sm">
          Sin datos para el período seleccionado
        </div>
      ) : (
        <div className="relative">
          <div ref={containerRef} className="w-full rounded-xl overflow-hidden" style={{ height: 320 }} />
          <div
            ref={tooltipRef}
            style={{
              display: 'none',
              position: 'absolute',
              backgroundColor: 'white',
              border: '1px solid #f1f5f9',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
              borderRadius: '12px',
              padding: '10px 14px',
              minWidth: '160px',
              maxWidth: '200px',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          />
        </div>
      )}
    </Card>
  );
}
