import { monthOf } from './dates';
import { expensesInMonth, totalOf } from './expenses';
import { summarizePpf, type PpfSummary } from './ppf';
import { summarizeStocks, type StockSummary } from './stocks';
import type { AppState, ClosedPosition, ISODate } from './types';

/**
 * Ana Para defteri — tüm özet rakamlar buradan türetilir.
 *
 *   Sermaye         = Başlangıç + Eklemeler − Çekimler − Tüm Harcamalar + Kapanan yatırımlardan dönen net
 *   Nakit           = Sermaye − Ana paradan yatırıma aktarılan (açık pozisyonların maliyeti)   (kalan likidite)
 *   Yatırımlar      = PPF bugünkü bakiyesi + ABD hisselerinin bugünkü TL karşılığı
 *   Ana Para        = Nakit + Yatırımlar   → PPF her gün getirisi kadar, hisseler fiyatla anlık değişir
 *
 * Kapanan (satılan/bozdurulan) pozisyon ana paraya şu kadar etki eder:
 *   - ana paradan fonlandıysa: satış tutarı − maliyet (gerçekleşen kâr/zarar; maliyet zaten düşülmüştü)
 *   - dışarıdan getirildiyse: satış tutarının tamamı (ana paraya yeni para girişi)
 */

export function closedCashEffect(c: ClosedPosition): number {
  return c.fundedFromCash ? c.proceedsTry - c.costTry : c.proceedsTry;
}

export interface LedgerSummary {
  today: ISODate;
  initial: number;
  deposits: number;
  withdrawals: number;
  totalExpenses: number;
  realized: number;
  /** Başlangıç + eklemeler − çekimler − harcamalar + kapanan yatırımlardan dönen */
  capitalBase: number;
  ppfFunded: number;
  stocksFunded: number;
  investedFromCash: number;
  /** Nakit (kalan likidite) */
  liquidity: number;
  ppf: PpfSummary;
  stocks: StockSummary;
  /** ABD hisselerinin bugünkü TL değeri (kur yoksa 0) */
  stocksTry: number;
  /** Yatırımdaki toplam tutar (güncel değer, TL) */
  investments: number;
  /** ABD hisseleri kur olmadığı için TL toplamına eklenemediyse true */
  stocksExcluded: boolean;
  /** Ana para = nakit + PPF + ABD (anlık) */
  anaPara: number;
  /** Yatırımların gerçekleşmemiş kazancı: PPF birikmiş getiri + hisse kâr/zararı (TL) */
  investmentGain: number;
  /** Bugünkü değişim: PPF'in bugünkü getirisi + hisselerin günlük değişimi (TL) */
  todayChange: number;
  /** Açık yatırımların para kaynağı: hepsi ana paradan / hepsi dışarıdan / karışık / yatırım yok */
  funding: 'cash' | 'external' | 'mixed' | 'none';
  /** Bu ayın harcaması (aylık borç) */
  monthExpenses: number;
  monthExpenseCount: number;
}

export function computeLedger(state: AppState, today: ISODate): LedgerSummary {
  const { capital, settings } = state;
  const deposits = capital.movements.filter((m) => m.type === 'deposit').reduce((t, m) => t + m.amount, 0);
  const withdrawals = capital.movements.filter((m) => m.type === 'withdraw').reduce((t, m) => t + m.amount, 0);
  const totalExpenses = totalOf(state.expenses);
  const realized = state.closed.reduce((t, c) => t + closedCashEffect(c), 0);
  const capitalBase = capital.initial + deposits - withdrawals - totalExpenses + realized;

  const usdTry = state.fx.usdTry;
  const ppf = summarizePpf(state.ppfLots, today, settings.ppfDaysPerMonth);
  const stocks = summarizeStocks(state.holdings, state.quotes, usdTry);

  const investedFromCash = ppf.fundedPrincipal + stocks.fundedCostTry;
  const liquidity = capitalBase - investedFromCash;
  const stocksExcluded = stocks.valueTry == null;
  const stocksTry = stocks.valueTry ?? 0;
  const investments = ppf.value + stocksTry;
  const month = expensesInMonth(state.expenses, monthOf(today));

  const stocksGain = usdTry
    ? stocks.rows.reduce((t, r) => t + (r.priceMissing ? 0 : r.valueUsd * usdTry - (r.costTry ?? r.costUsd * usdTry)), 0)
    : 0;

  const flags = [...state.ppfLots.map((l) => l.fundedFromCash), ...state.holdings.map((h) => h.fundedFromCash)];
  const funding = flags.length === 0 ? 'none' : flags.every(Boolean) ? 'cash' : flags.some(Boolean) ? 'mixed' : 'external';

  return {
    today,
    initial: capital.initial,
    deposits,
    withdrawals,
    totalExpenses,
    realized,
    capitalBase,
    ppfFunded: ppf.fundedPrincipal,
    stocksFunded: stocks.fundedCostTry,
    investedFromCash,
    liquidity,
    ppf,
    stocks,
    stocksTry,
    investments,
    stocksExcluded,
    anaPara: liquidity + investments,
    investmentGain: ppf.accrued + stocksGain,
    todayChange: ppf.todayGain + (usdTry ? stocks.dayChangeUsd * usdTry : 0),
    funding,
    monthExpenses: totalOf(month),
    monthExpenseCount: month.length,
  };
}
