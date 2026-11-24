import { formatMoney, formatPercent, type Currency } from '../domain/money';

interface MoneyProps {
  value: number;
  currency?: Currency;
  signed?: boolean;
  /** Pozitif yeşil, negatif kırmızı */
  tone?: boolean;
  decimals?: number;
  className?: string;
}

export function Money({ value, currency = 'TRY', signed, tone, decimals, className = '' }: MoneyProps) {
  const t = tone ? (value > 0.004 ? ' is-pos' : value < -0.004 ? ' is-neg' : '') : '';
  return (
    <span className={`money money--${currency.toLowerCase()}${t} ${className}`.trim()}>
      {formatMoney(value, currency, { signed, decimals })}
    </span>
  );
}

export function Delta({ value, pct, currency = 'TRY', className = '' }: { value: number | null; pct?: number | null; currency?: Currency; className?: string }) {
  if (value == null) return <span className={`delta ${className}`}>—</span>;
  const tone = value > 0.004 ? 'is-pos' : value < -0.004 ? 'is-neg' : '';
  return (
    <span className={`delta ${tone} ${className}`.trim()}>
      <span aria-hidden="true">{value > 0.004 ? '▲' : value < -0.004 ? '▼' : '•'}</span>{' '}
      {formatMoney(value, currency, { signed: true })}
      {pct != null && (
        <>
          {' '}
          <span className="delta__pct">({formatPercent(pct, 2, true)})</span>
        </>
      )}
    </span>
  );
}
