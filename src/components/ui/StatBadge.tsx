'use client';



interface StatBadgeProps {
  value: number; // positive = growth, negative = decrease
  type?: 'percentage' | 'number';
  className?: string;
}

export default function StatBadge({
  value,
  type = 'percentage',
  className = '',
}: StatBadgeProps) {
  const isPositive = value >= 0;
  const absValue = Math.abs(value);
  const displayValue = type === 'percentage' ? `${absValue.toFixed(1)}%` : absValue;

  const bgStyle = isPositive
    ? 'bg-green-50 border border-green-100 text-green-700'
    : 'bg-red-50 border border-red-100 text-red-700';

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 select-none ${bgStyle} ${className}`}
    >
      <span>{isPositive ? '▲' : '▼'}</span>
      <span>{displayValue}</span>
    </span>
  );
}
