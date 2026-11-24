import type { Quote, StockHolding } from './types';

export interface HoldingValuation {
  holding: StockHolding;
  quote: Quote | null;
  /** Fiyat hiç alınamadıysa maliyet fiyatı kullanılır */
  priceMissing: boolean;
  price: number;
  costUsd: number;
  valueUsd: number;
  pnlUsd: number;
  pnlPct: number;
  dayChangeUsd: number | null;
  dayChangePct: number | null;
  valueTry: number | null;
  costTry: number | null;
  /** Kur farkı dahil TL bazlı kâr/zarar (alış kuru girildiyse) */
  pnlTry: number | null;
  /** Likiditeden (ana paradan) düşülen TL tutar */
  cashCostTry: number;
}

export function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

/** Likiditeden düşülen TL tutar: adet × maliyet × alış kuru */
export function holdingCashCost(h: StockHolding, fallbackUsdTry: number | null): number {
  if (!h.fundedFromCash) return 0;
  const rate = h.fxAtPurchase ?? fallbackUsdTry ?? 0;
  return h.quantity * h.avgCost * rate;
}

export function valueHolding(h: StockHolding, quote: Quote | null | undefined, usdTry: number | null): HoldingValuation {
  const q = quote ?? null;
  const priceMissing = !q || !(q.price > 0);
  const price = priceMissing ? h.avgCost : q!.price;
  const costUsd = h.quantity * h.avgCost;
  const valueUsd = h.quantity * price;
  const pnlUsd = valueUsd - costUsd;
  const prev = !priceMissing && q!.prevClose && q!.prevClose > 0 ? q!.prevClose : null;
  const valueTry = usdTry ? valueUsd * usdTry : null;
  const costTry = h.fxAtPurchase ? costUsd * h.fxAtPurchase : null;
  return {
    holding: h,
    quote: q,
    priceMissing,
    price,
    costUsd,
    valueUsd,
    pnlUsd,
    pnlPct: costUsd > 0 ? pnlUsd / costUsd : 0,
    dayChangeUsd: prev ? h.quantity * (price - prev) : null,
    dayChangePct: prev ? price / prev - 1 : null,
    valueTry,
    costTry,
    pnlTry: valueTry != null && costTry != null ? valueTry - costTry : null,
    cashCostTry: holdingCashCost(h, usdTry),
  };
}

export interface StockSummary {
  rows: HoldingValuation[];
  costUsd: number;
  valueUsd: number;
  pnlUsd: number;
  pnlPct: number;
  dayChangeUsd: number;
  dayChangePct: number | null;
  /** Kur yoksa null */
  valueTry: number | null;
  fundedCostTry: number;
  missingPrices: number;
  oldestQuoteAt: number | null;
}

export function summarizeStocks(
  holdings: StockHolding[],
  quotes: Record<string, Quote>,
  usdTry: number | null,
): StockSummary {
  const rows = holdings.map((h) => valueHolding(h, quotes[h.symbol], usdTry));
  const costUsd = rows.reduce((t, r) => t + r.costUsd, 0);
  const valueUsd = rows.reduce((t, r) => t + r.valueUsd, 0);
  const withDay = rows.filter((r) => r.dayChangeUsd != null);
  const dayChangeUsd = withDay.reduce((t, r) => t + (r.dayChangeUsd ?? 0), 0);
  const prevValue = withDay.reduce((t, r) => t + r.valueUsd - (r.dayChangeUsd ?? 0), 0);
  const times = rows.map((r) => r.quote?.fetchedAt).filter((t): t is number => typeof t === 'number');
  return {
    rows,
    costUsd,
    valueUsd,
    pnlUsd: valueUsd - costUsd,
    pnlPct: costUsd > 0 ? (valueUsd - costUsd) / costUsd : 0,
    dayChangeUsd,
    dayChangePct: prevValue > 0 ? dayChangeUsd / prevValue : null,
    valueTry: usdTry ? valueUsd * usdTry : rows.length === 0 ? 0 : null,
    fundedCostTry: rows.reduce((t, r) => t + r.cashCostTry, 0),
    missingPrices: rows.filter((r) => r.priceMissing).length,
    oldestQuoteAt: times.length ? Math.min(...times) : null,
  };
}

/** New York saatine göre ABD piyasasının normal seans içinde olup olmadığı (resmî tatiller hariç). */
export function usMarketOpen(now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const wd = get('weekday');
  if (wd === 'Sat' || wd === 'Sun') return false;
  const mins = Number(get('hour')) * 60 + Number(get('minute'));
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}
