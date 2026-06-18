import type { ReactNode } from 'react';
import { Card } from './Card';
import { DeltaArrow } from './DeltaArrow';

interface KpiStatProps {
  label: string;
  value: string;
  sub?: string;
  delta?: number;
  icon?: ReactNode;
  colorClass?: string;
  valueAriaLabel?: string;
}

export function KpiStat({ label, value, sub, delta, icon, colorClass = 'text-[#0097A7]', valueAriaLabel }: KpiStatProps) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide truncate">{label}</p>
          <p className={`text-2xl font-bold tabular-nums mt-1 ${colorClass}`} aria-label={valueAriaLabel}>{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5 truncate">{sub}</p>}
          {delta !== undefined && (
            <div className="mt-1 transition-colors">
              <DeltaArrow value={delta} />
            </div>
          )}
        </div>
        {icon && <div className="text-2xl text-slate-300 flex-shrink-0">{icon}</div>}
      </div>
    </Card>
  );
}
