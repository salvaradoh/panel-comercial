interface DeltaArrowProps {
  value: number;
  className?: string;
}

export function DeltaArrow({ value, className = '' }: DeltaArrowProps) {
  const isPositive = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums ${
        isPositive ? 'text-emerald-600' : 'text-red-500'
      } ${className}`}
      aria-label={`${isPositive ? 'Incremento' : 'Decremento'} de ${Math.abs(value).toFixed(1)}%`}
    >
      {isPositive ? '▲' : '▼'} {Math.abs(value).toFixed(1)}%
    </span>
  );
}
