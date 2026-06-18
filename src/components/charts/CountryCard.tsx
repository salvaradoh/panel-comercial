import { Card } from '../ui/Card';

const FLAG_CC: Record<string, string> = {
  Chile: 'cl', Perú: 'pe', Peru: 'pe', Colombia: 'co', México: 'mx', Mexico: 'mx', Ecuador: 'ec',
};

interface CountryCardProps {
  pais: string;
  avance: number;
  meta: number;
  pct: number;
  onClick?: () => void;
}

function fmtUSD(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function CountryCard({ pais, avance, meta, pct, onClick }: CountryCardProps) {
  const cc = FLAG_CC[pais];
  const cumplPct = pct * 100;
  const color = pct >= 1 ? '#10b981' : pct >= 0.8 ? '#f59e0b' : '#ef4444';
  const isClickable = !!onClick;

  return (
    <Card
      hoverable={isClickable}
      className={`${isClickable ? 'cursor-pointer' : ''} p-3`}
    >
      <button
        className="w-full text-left"
        onClick={onClick}
        disabled={!isClickable}
        aria-label={`Ver detalle de ${pais}`}
      >
        <div className="flex items-center gap-2 mb-2">
          {cc && (
            <img
              src={`https://flagcdn.com/22x16/${cc}.png`}
              width={22}
              height={16}
              alt={pais}
              className="rounded shadow-sm flex-shrink-0"
            />
          )}
          <span className="text-sm font-semibold text-slate-700">{pais}</span>
        </div>

        <p className="text-xl font-bold tabular-nums text-slate-800">{fmtUSD(avance)}</p>
        <p className="text-xs text-slate-400 mt-0.5">meta: {fmtUSD(meta)}</p>

        <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-1.5 rounded-full transition-all"
            style={{ width: `${Math.min(pct * 100, 100)}%`, background: color }}
            role="progressbar"
            aria-valuenow={Math.round(cumplPct)}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>

        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs tabular-nums font-semibold" style={{ color }}>
            {pct >= 1 ? '▲' : pct >= 0.8 ? '◆' : '▼'} {cumplPct.toFixed(1)}%
          </span>
          <span className="text-xs text-slate-400">de meta</span>
        </div>
      </button>
    </Card>
  );
}
