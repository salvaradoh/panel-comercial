interface PeriodSelectorProps {
  period: { anio: number; mes: number };
  onChange: (p: Partial<{ anio: number; mes: number }>) => void;
}

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export function PeriodSelector({ period, onChange }: PeriodSelectorProps) {
  const years = [2024, 2025, 2026];

  return (
    <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-slate-100">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Período</span>

      <select
        value={period.anio}
        onChange={(e) => onChange({ anio: +e.target.value })}
        className="text-sm border border-slate-200 rounded-lg px-2 py-1 text-slate-700 bg-white"
        aria-label="Año"
      >
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>

      <select
        value={period.mes}
        onChange={(e) => onChange({ mes: +e.target.value })}
        className="text-sm border border-slate-200 rounded-lg px-2 py-1 text-slate-700 bg-white"
        aria-label="Mes"
      >
        {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
      </select>
    </div>
  );
}
