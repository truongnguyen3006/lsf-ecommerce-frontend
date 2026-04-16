'use client';

interface QuantityStepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export default function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  disabled = false,
  size = 'md',
}: QuantityStepperProps) {
  const heightClass = size === 'sm' ? 'h-10 w-10 text-base' : 'h-12 w-12 text-lg';
  const containerHeightClass = size === 'sm' ? 'h-10' : 'h-12';

  const decrease = () => {
    if (disabled) return;
    onChange(Math.max(min, value - 1));
  };

  const increase = () => {
    if (disabled) return;
    const nextValue = value + 1;
    onChange(max ? Math.min(max, nextValue) : nextValue);
  };

  return (
    <div
      className={`inline-flex items-center overflow-hidden rounded-full border border-[var(--color-border-strong)] bg-white ${containerHeightClass}`}
      aria-label="Bộ chọn số lượng"
    >
      <button
        type="button"
        aria-label="Giảm số lượng"
        onClick={decrease}
        disabled={disabled || value <= min}
        className={`${heightClass} flex items-center justify-center text-[var(--color-primary)] transition hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-40`}
      >
        −
      </button>
      <span className="min-w-12 px-2 text-center text-sm font-semibold text-[var(--color-primary)]">{value}</span>
      <button
        type="button"
        aria-label="Tăng số lượng"
        onClick={increase}
        disabled={disabled || (typeof max === 'number' && value >= max)}
        className={`${heightClass} flex items-center justify-center text-[var(--color-primary)] transition hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-40`}
      >
        +
      </button>
    </div>
  );
}
