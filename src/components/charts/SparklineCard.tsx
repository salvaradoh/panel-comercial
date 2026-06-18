import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { Card } from '../ui/Card';
import { DeltaArrow } from '../ui/DeltaArrow';
import type { PaisData } from '../../hooks/types';

interface SparklineCardProps {
  data: PaisData;
}

const COUNTRY_FLAG: Record<string, string> = {
  Chile: '🇨🇱',
  Perú: '🇵🇪',
  Peru: '🇵🇪',
  Colombia: '🇨🇴',
  México: '🇲🇽',
  Mexico: '🇲🇽',
  Ecuador: '🇪🇨',
};

function formatUSDK(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function SparklineCard({ data }: SparklineCardProps) {
  const delta = (data.pct - 1) * 100;
  const flag = COUNTRY_FLAG[data.pais] ?? '';

  return (
    <Card className="flex flex-col gap-2 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden="true">{flag}</span>
          <span className="text-sm font-semibold text-slate-700">{data.pais}</span>
        </div>
        <DeltaArrow value={delta} />
      </div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xl font-bold tabular-nums text-[#0097A7]">{formatUSDK(data.avance)}</p>
          <p className="text-xs text-slate-400">meta: {formatUSDK(data.meta)}</p>
        </div>
        <div style={{ width: '100%', height: 48 }}>
          <ResponsiveContainer width="100%" height={48}>
            <AreaChart data={data.serie} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${data.pais}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0097A7" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#0097A7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="avance"
                stroke="#0097A7"
                strokeWidth={2}
                fill={`url(#grad-${data.pais})`}
                dot={false}
                isAnimationActive={false}
              />
              <Tooltip
                formatter={(v) => [formatUSDK(Number(v)), 'Avance']}
                labelFormatter={(l) => `Sem ${l}`}
                contentStyle={{ fontSize: 11 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-1.5 rounded-full bg-[#0097A7] transition-all"
          style={{ width: `${Math.min(data.pct * 100, 100)}%` }}
          role="progressbar"
          aria-valuenow={Math.round(data.pct * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </Card>
  );
}
