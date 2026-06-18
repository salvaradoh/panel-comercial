interface BadgeProps {
  label: string;
  color?: 'teal' | 'blue' | 'green' | 'amber' | 'orange' | 'red' | 'gray';
}

const COLOR_MAP = {
  teal:   'bg-[#E0F7FA] text-[#0097A7]',
  blue:   'bg-blue-50 text-blue-700',
  green:  'bg-green-50 text-green-700',
  amber:  'bg-amber-50 text-amber-700',
  orange: 'bg-orange-50 text-orange-600',
  red:    'bg-red-50 text-red-600',
  gray:   'bg-slate-100 text-slate-600',
};

export function Badge({ label, color = 'gray' }: BadgeProps) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${COLOR_MAP[color]}`}>
      {label}
    </span>
  );
}
