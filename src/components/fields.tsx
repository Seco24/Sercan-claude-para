import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { formatMoney, formatNumber, parseDecimal, type Currency } from '../domain/money';

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string }) {
  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <label className="field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? <p className="field__error">{error}</p> : hint ? <p className="field__hint">{hint}</p> : null}
    </div>
  );
}

interface NumberInputProps {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  /** Para birimi verilirse sembol ve önizleme gösterilir */
  currency?: Currency;
  /** Para birimi olmayan alanlarda birim (adet, %, ₺/$) */
  suffix?: string;
  placeholder?: string;
  hint?: ReactNode;
  error?: string | null;
  autoFocus?: boolean;
  maxDecimals?: number;
}

/**
 * Sayı/tutar girişi. Mobilde ondalık klavye açar; "1.250,50" ve "1250.5" gibi yazımları kabul eder,
 * girilen değerin nasıl yorumlandığını altta gösterir.
 */
export function NumberInput({ label, value, onChange, currency, suffix, placeholder, hint, error, autoFocus, maxDecimals = 6 }: NumberInputProps) {
  const id = useId();
  const dotIsDecimal = currency === 'USD' || suffix === 'adet' || suffix === '%' || suffix === '₺/$';
  const toText = (v: number | null) => (v == null ? '' : formatNumber(v, maxDecimals).replace(/\./g, ''));
  const [text, setText] = useState(() => toText(value));
  const lastEmitted = useRef<number | null>(value);

  // Dışarıdan değer değişirse (ör. hesaplanan alan) metni güncelle.
  useEffect(() => {
    if (value !== lastEmitted.current) {
      setText(toText(value));
      lastEmitted.current = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const parsed = text.trim() ? parseDecimal(text, { dotIsDecimal }) : null;
  const invalid = text.trim() !== '' && parsed == null;
  const preview =
    parsed != null && !invalid
      ? currency
        ? formatMoney(parsed, currency, { decimals: currency === 'USD' && Math.abs(parsed) < 1 ? 4 : 2 })
        : `${formatNumber(parsed, maxDecimals)}${suffix ? ` ${suffix}` : ''}`
      : null;

  return (
    <Field
      label={label}
      htmlFor={id}
      error={error ?? (invalid ? 'Geçerli bir sayı girin' : null)}
      hint={
        <>
          {preview && text.trim() !== preview ? <span className="field__preview">= {preview}</span> : null}
          {hint ? <span>{hint}</span> : null}
        </>
      }
    >
      <div className="input-affix">
        {currency && <span className="input-affix__pre">{currency === 'TRY' ? '₺' : '$'}</span>}
        <input
          id={id}
          className="input input--num"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          placeholder={placeholder ?? '0'}
          value={text}
          autoFocus={autoFocus}
          onChange={(e) => {
            const t = e.target.value;
            setText(t);
            const v = t.trim() ? parseDecimal(t, { dotIsDecimal }) : null;
            lastEmitted.current = v;
            onChange(v);
          }}
        />
        {(suffix || currency) && <span className="input-affix__post">{suffix ?? (currency === 'TRY' ? 'TL' : 'USD')}</span>}
      </div>
    </Field>
  );
}

export function TextInput({ label, value, onChange, placeholder, hint, error, list, maxLength = 120, autoFocus }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: ReactNode; error?: string | null; list?: string; maxLength?: number; autoFocus?: boolean }) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error}>
      <input id={id} className="input" type="text" value={value} placeholder={placeholder} list={list} maxLength={maxLength} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function DateInput({ label, value, onChange, hint, max, min }: { label: string; value: string; onChange: (v: string) => void; hint?: ReactNode; max?: string; min?: string }) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <input id={id} className="input" type="date" value={value} max={max} min={min} required onChange={(e) => e.target.value && onChange(e.target.value)} />
    </Field>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode }) {
  const id = useId();
  return (
    <div className="toggle-row">
      <div>
        <label htmlFor={id} className="toggle-row__label">
          {label}
        </label>
        {hint && <p className="field__hint">{hint}</p>}
      </div>
      <input id={id} type="checkbox" role="switch" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </div>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, label, size }: { value: T; options: Array<{ value: T; label: ReactNode }>; onChange: (v: T) => void; label: string; size?: 'sm' }) {
  return (
    <div className={`segmented${size ? ` segmented--${size}` : ''}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className="segmented__item"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** İki adımlı silme düğmesi: ilk tıklamada onay ister, 3 sn içinde ikinci tıklama siler. */
export function ConfirmButton({ children, confirmText = 'Emin misiniz? Tekrar dokunun', onConfirm, className = 'btn btn--danger-ghost' }: { children: ReactNode; confirmText?: string; onConfirm: () => void; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button type="button" className={`${className}${armed ? ' is-armed' : ''}`} onClick={() => (armed ? onConfirm() : setArmed(true))}>
      {armed ? confirmText : children}
    </button>
  );
}
