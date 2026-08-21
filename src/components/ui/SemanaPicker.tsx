interface SemanaPickerProps {
  semana: number;
  onChange: (s: number) => void;
  semanas?: number[];
}

export function SemanaPicker({ semana, onChange, semanas = [1, 2, 3, 4] }: SemanaPickerProps) {
  return (
    <div className="flex items-center gap-1.5">
      {semanas.map((s) => {
        const label = s === 0 ? 'Mes' : `S${s}`;
        const ariaLabel = s === 0 ? 'Mes completo' : `Semana ${s}`;
        const isActive = semana === s;
        return (
          <button
            key={s}
            onClick={() => onChange(s)}
            aria-label={ariaLabel}
            aria-pressed={isActive}
            className={`px-2 h-6 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
              isActive
                ? 'bg-[#0097A7] text-white shadow-sm'
                : 'border border-slate-200 text-slate-500 hover:border-[#0097A7] hover:text-[#0097A7]'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
