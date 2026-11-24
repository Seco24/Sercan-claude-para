import { monthOf } from './dates';
import { expensesInMonth, totalOf } from './expenses';
import { summarizePpf, type PpfSummary } from './ppf';
import { summarizeStocks, type StockSummary } from './stocks';
import type { AppState, ClosedPosition, ISODate } from './types';

/**
 * Ana Para / Net Varlık defteri — tüm özet rakamlar buradan türetilir.
 *
 *   Ana Para        = Başlangıç + Eklemeler − Çekimler − Tüm Harcamalar + Kapanan yatırımlardan dönen net
 *   Kalan Likidite  = Ana Para − Ana paradan yatırıma aktarılan (açık pozisyonların maliyeti)
 *   Yatırımlar      = PPF güncel bakiyesi + ABD hisselerinin TL karşılığı
 *   Net Varlık      = Kalan Likidite + Yatırımlar
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
  /** Ana para bakiyesi (harcamalar düşülmüş) */
  anaPara: number;
  ppfFunded: number;
  stocksFunded: number;
  investedFromCash: number;
  /** Kalan likidite */
  liquidity: number;
  ppf: PpfSummary;
  stocks: StockSummary;
  /** Yatırımdaki toplam tutar (güncel değer, TL) */
  investments: number;
  /** ABD hisseleri kur olmadığı için TL toplamına eklenemediyse true */
  stocksExcluded: boolean;
  netWorth: number;
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
  const anaPara = capital.initial + deposits - withdrawals - totalExpenses + realized;

  const usdTry = state.fx.usdTry;
  const ppf = summarizePpf(state.ppfLots, today, settings.ppfDaysPerMonth);
  const stocks = summarizeStocks(state.holdings, state.quotes, usdTry);

  const investedFromCash = ppf.fundedPrincipal + stocks.fundedCostTry;
  const liquidity = anaPara - investedFromCash;
  const stocksExcluded = stocks.valueTry == null;
  const investments = ppf.value + (stocks.valueTry ?? 0);
  const month = expensesInMonth(state.expenses, monthOf(today));

  return {
    today,
    initial: capital.initial,
    deposits,
    withdrawals,
    totalExpenses,
    realized,
    anaPara,
    ppfFunded: ppf.fundedPrincipal,
    stocksFunded: stocks.fundedCostTry,
    investedFromCash,
    liquidity,
    ppf,
    stocks,
    investments,
    stocksExcluded,
    netWorth: liquidity + investments,
    monthExpenses: totalOf(month),
    monthExpenseCount: month.length,
  };
}
