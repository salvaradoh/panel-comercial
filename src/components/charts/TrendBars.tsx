import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card } from '../ui/Card';

interface TrendPoint {
  mes: string;
  valor: number;
}

interface TrendBarsProps {
  title: string;
  data: TrendPoint[];
  color?: string;
}

function fmtK(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

export function TrendBars({ title, data, color = '#0097A7' }: TrendBarsProps) {
  const lastIdx = data.length - 1;
  return (
    <Card>
      <p className="text-xs font-semibold text-slate-500 mb-2">{title}</p>
      <div style={{ width: '100%', height: 80 }}>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => [fmtK(Number(v)), title]}
              contentStyle={{ fontSize: 11 }}
            />
            <Bar dataKey="valor" radius={[3, 3, 0, 0]} barSize={16}>
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={i === lastIdx ? color : `${color}55`}
                  opacity={i === lastIdx ? 1 : 0.6}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
