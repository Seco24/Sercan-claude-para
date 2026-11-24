import { useState } from 'react';
import { monthLabel, monthShortLabel } from '../domain/dates';
import { formatMoney, formatPercent, tl } from '../domain/money';
import type { MonthKey } from '../domain/types';

/** Son N ayın harcama sütunları — tıklanınca o aya gider. Tek renk (büyüklük), seçili ay koyu. */
export function MonthBars({ data, selected, onSelect }: { data: Array<{ month: MonthKey; total: number }>; selected: MonthKey; onSelect: (m: MonthKey) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.total), 1);
  const avg = data.filter((d) => d.total > 0).reduce((t, d, _, a) => t + d.total / a.length, 0);
  const shown = hover != null ? data[hover] : null;
  return (
    <div className="mbars">
      <div className="mbars__tip" aria-hidden={!shown}>
        {shown ? (
          <>
            <span>{monthLabel(shown.month)}</span>
            <strong className="num">{tl(shown.total)}</strong>
          </>
        ) : (
          <>
            <span>Aylık ortalama</span>
            <strong className="num">{tl(avg)}</strong>
          </>
        )}
      </div>
      <div className="mbars__plot" onMouseLeave={() => setHover(null)}>
        {avg > 0 && <div className="mbars__avg" style={{ bottom: `${(avg / max) * 100}%` }} aria-hidden="true" />}
        {data.map((d, i) => (
          <button
            key={d.month}
            type="button"
            className={`mbars__col${d.month === selected ? ' is-selected' : ''}`}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            onClick={() => onSelect(d.month)}
            aria-label={`${monthLabel(d.month)}: ${tl(d.total)}`}
            aria-pressed={d.month === selected}
          >
            <span className="mbars__bar" style={{ height: d.total > 0 ? `max(3px, ${(d.total / max) * 100}%)` : 0 }} />
          </button>
        ))}
      </div>
      <div className="mbars__axis" aria-hidden="true">
        {data.map((d) => (
          <span key={d.month} className={d.month === selected ? 'is-selected' : ''}>
            {monthShortLabel(d.month)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Kategori dağılımı — sıralı yatay çubuklar, doğrudan etiketli. */
export function RankedBars({ rows }: { rows: Array<{ key: string; label: string; emoji?: string; value: number; share: number; count?: number }> }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="rbars">
      {rows.map((r) => (
        <li key={r.key} className="rbars__row" title={`${r.label}: ${tl(r.value)} (${formatPercent(r.share, 1)})`}>
          <span className="rbars__label">
            {r.emoji && <span aria-hidden="true">{r.emoji} </span>}
            {r.label}
            {r.count != null && <span className="muted"> · {r.count}</span>}
          </span>
          <span className="rbars__value num">{tl(r.value)}</span>
          <span className="rbars__pct num muted">{formatPercent(r.share, 0)}</span>
          <span className="rbars__track" aria-hidden="true">
            <span className="rbars__fill" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export interface AllocationPart {
  key: string;
  label: string;
  value: number;
  /** 1..3 — kategorik palet sırası (varlık türüne sabit bağlı) */
  slot: 1 | 2 | 3;
  sub?: string;
}

/** Varlık dağılımı şeridi: Likidite / PPF / ABD borsası. */
export function AllocationBar({ parts }: { parts: AllocationPart[] }) {
  const positive = parts.map((p) => ({ ...p, v: Math.max(0, p.value) }));
  const total = positive.reduce((t, p) => t + p.v, 0);
  if (total <= 0) return null;
  return (
    <div className="alloc">
      <div className="alloc__bar" role="img" aria-label={positive.map((p) => `${p.label} ${formatPercent(p.v / total, 0)}`).join(', ')}>
        {positive
          .filter((p) => p.v > 0)
          .map((p) => (
            <span key={p.key} className={`alloc__seg s${p.slot}`} style={{ flexGrow: p.v }} title={`${p.label}: ${tl(p.value)}`} />
          ))}
      </div>
      <ul className="alloc__legend">
        {parts.map((p) => (
          <li key={p.key}>
            <span className={`swatch s${p.slot}`} aria-hidden="true" />
            <span className="alloc__name">{p.label}</span>
            <span className="alloc__val num">{formatMoney(p.value, 'TRY', { decimals: 0 })}</span>
            <span className="alloc__pct num muted">{total > 0 ? formatPercent(Math.max(0, p.value) / total, 0) : '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
