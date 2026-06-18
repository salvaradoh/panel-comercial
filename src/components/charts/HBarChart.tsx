import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card } from '../ui/Card';

interface HBarItem {
  nombre: string;
  avance: number;
  pct: number;
}

interface HBarChartProps {
  data: HBarItem[];
  title?: string;
}

const COLORS = ['#0097A7', '#00838F', '#006064', '#80DEEA'];

function fmtK(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

export function HBarChart({ data, title = 'Por Producto' }: HBarChartProps) {
  return (
    <Card>
      <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>
      <div style={{ width: '100%', height: data.length * 44 + 20 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 0, right: 60, left: 20, bottom: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="nombre"
              width={130}
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => [fmtK(Number(v)), 'Avance']}
              contentStyle={{ fontSize: 11 }}
            />
            <Bar dataKey="avance" radius={[0, 6, 6, 0]} barSize={24}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Labels de % */}
      <div className="mt-3 flex flex-col gap-1">
        {data.map((d, i) => (
          <div key={d.nombre} className="flex justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              {d.nombre}
            </span>
            <span className="tabular-nums font-medium">
              {d.pct.toFixed(1)}% · {fmtK(d.avance)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
