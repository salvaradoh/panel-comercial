interface PeriodSelectorProps {
  period: { anio: number; mes: number };
  onChange: (p: Partial<{ anio: number; mes: number }>) => void;
}

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const YEARS = [2026];

export function PeriodSelector({ period, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex items-center gap-3 px-6 py-2 bg-white border-b border-slate-100 flex-wrap">
      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Año</span>
      <div className="flex gap-1">
        {YEARS.map(y => (
          <button
            key={y}
            onClick={() => onChange({ anio: y })}
            aria-pressed={period.anio === y}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all active:scale-95 ${
              period.anio === y
                ? 'bg-[#0097A7] text-white border-[#0097A7] shadow-sm'
                : 'bg-white border-slate-200 text-slate-500 hover:border-[#0097A7] hover:text-[#0097A7]'
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-slate-200" />

      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Mes</span>
      <select
        value={period.mes}
        onChange={e => onChange({ mes: Number(e.target.value) })}
        className="text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1 bg-white outline-none cursor-pointer hover:border-[#0097A7] focus:border-[#0097A7] transition-colors"
      >
        {MESES.map((m, i) => (
          <option key={i} value={i + 1}>{m}</option>
        ))}
      </select>
    </div>
  );
}
