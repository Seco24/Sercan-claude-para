export type Currency = 'TRY' | 'USD';

const cache = new Map<string, Intl.NumberFormat>();
function nf(key: string, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat('tr-TR', opts);
    cache.set(key, f);
  }
  return f;
}

/** Negatif değerlerde tipografik eksi (−) kullanır, ₺ ve $ sembolleri asla karışmaz. */
const fixMinus = (s: string) => s.replace('-', '−');

export interface MoneyFormatOptions {
  /** +/− işaretini her zaman göster */
  signed?: boolean;
  /** Ondalık basamak (varsayılan 2) */
  decimals?: number;
  /** Büyük tutarları kısalt (1,2 Mn ₺) */
  compact?: boolean;
}

export function formatMoney(value: number, currency: Currency, opts: MoneyFormatOptions = {}): string {
  const decimals = opts.decimals ?? 2;
  const key = `${currency}|${decimals}|${opts.signed ? 's' : ''}|${opts.compact ? 'c' : ''}`;
  const f = nf(key, {
    style: 'currency',
    currency,
    minimumFractionDigits: opts.compact ? 0 : decimals,
    maximumFractionDigits: opts.compact ? 1 : decimals,
    signDisplay: opts.signed ? 'exceptZero' : 'auto',
    notation: opts.compact ? 'compact' : 'standard',
  });
  return fixMinus(f.format(Object.is(value, -0) ? 0 : value));
}

export const tl = (v: number, opts?: MoneyFormatOptions) => formatMoney(v, 'TRY', opts);
export const usd = (v: number, opts?: MoneyFormatOptions) => formatMoney(v, 'USD', opts);

export function formatNumber(value: number, maxDecimals = 2, minDecimals = 0): string {
  return fixMinus(
    nf(`n|${minDecimals}|${maxDecimals}`, {
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals,
    }).format(value),
  );
}

/** 0.0245 -> "%2,45" */
export function formatPercent(ratio: number, decimals = 2, signed = false): string {
  return fixMinus(
    nf(`p|${decimals}|${signed}`, {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      signDisplay: signed ? 'exceptZero' : 'auto',
    }).format(ratio),
  );
}

export function formatRate(usdTry: number): string {
  return formatNumber(usdTry, 4, 2);
}

export interface ParseOptions {
  /**
   * true: tek nokta her zaman ondalık ayırıcıdır ("182.125" -> 182,125).
   * false (TL alanları): "1.250" Türkçe binlik ayırıcı olarak okunur -> 1250.
   */
  dotIsDecimal?: boolean;
}

/**
 * Kullanıcı girdisini sayıya çevirir. Türkçe ("1.250,50") ve İngilizce ("1,250.50")
 * yazımlarını, para sembollerini ve boşlukları tolere eder. Geçersizse null döner.
 */
export function parseDecimal(raw: string, opts: ParseOptions = {}): number | null {
  let s = raw.trim().replace(/[\s ₺$]/g, '').replace(/(TL|TRY|USD)$/i, '');
  if (!s) return null;
  let negative = false;
  if (/^[-−]/.test(s)) {
    negative = true;
    s = s.slice(1);
  }
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    const dec = lastComma > lastDot ? ',' : '.';
    const thousands = dec === ',' ? '.' : ',';
    s = s.split(thousands).join('').replace(dec, '.');
  } else if (lastComma >= 0) {
    const p = s.split(',');
    s = p.length > 2 ? p.join('') : p.join('.');
  } else if (lastDot >= 0) {
    const p = s.split('.');
    if (p.length > 2) s = p.join('');
    else if (!opts.dotIsDecimal && p[1].length === 3 && p[0] !== '' && p[0] !== '0') s = p.join('');
  }
  if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Kayan nokta hatalarını önlemek için kuruş hassasiyetine yuvarlar. */
export const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export const sum = (values: Iterable<number>) => {
  let t = 0;
  for (const v of values) t += v;
  return t;
};
