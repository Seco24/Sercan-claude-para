import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, lastMonths, shiftMonth } from './dates';
import { emptyState } from './defaults';
import { categoryBreakdown, expensesInMonth, totalOf } from './expenses';
import { computeLedger } from './ledger';
import { parseDecimal } from './money';
import { dailyRate, lotDetail, ppfValueAt, withRateChange } from './ppf';
import { summarizeStocks, valueHolding } from './stocks';
import type { AppState, PpfLot, StockHolding } from './types';
import { reducer } from '../state/reducer';

const lot = (over: Partial<PpfLot> = {}): PpfLot => ({
  id: 'l1',
  name: 'PPF',
  principal: 100_000,
  startDate: '2026-01-01',
  mode: 'simple',
  rates: [{ from: '2026-01-01', monthlyRate: 2.45 }],
  fundedFromCash: true,
  ...over,
});

describe('tarih yardımcıları', () => {
  it('gün farkını yaz saatinden bağımsız hesaplar', () => {
    expect(daysBetween('2026-03-28', '2026-03-31')).toBe(3);
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365);
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
  it('ay kaydırma ve son N ay', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(lastMonths('2026-03', 3)).toEqual(['2026-01', '2026-02', '2026-03']);
  });
});

describe('sayı girişi (TR/EN)', () => {
  it.each([
    ['1.250,50', 1250.5],
    ['1250,5', 1250.5],
    ['1,250.50', 1250.5],
    ['1.250', 1250],
    ['1.000.000', 1_000_000],
    ['₺ 2.500', 2500],
    ['0.5', 0.5],
    ['12.5', 12.5],
    ['−3,2', -3.2],
  ])('%s → %d', (input, expected) => {
    expect(parseDecimal(input)).toBeCloseTo(expected, 6);
  });
  it('USD alanlarında tek nokta ondalıktır', () => {
    expect(parseDecimal('182.125', { dotIsDecimal: true })).toBeCloseTo(182.125);
  });
  it('geçersiz girdiler null döner', () => {
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('1,2,3a')).toBeNull();
  });
});

describe('para piyasası fonu', () => {
  it('basit modda her gün eşit artar: 100.000 × %2,45 / 30', () => {
    const daily = (100_000 * 0.0245) / 30; // 81,666...
    const l = lot();
    expect(ppfValueAt(l, '2026-01-01')).toBe(100_000);
    expect(ppfValueAt(l, '2026-01-02')).toBeCloseTo(100_000 + daily, 6);
    expect(ppfValueAt(l, '2026-01-11')).toBeCloseTo(100_000 + daily * 10, 6);
    expect(ppfValueAt(l, '2026-01-31')).toBeCloseTo(102_450, 6); // 30 günde tam aylık getiri
    const d = lotDetail(l, '2026-01-21');
    expect(d.todayGain).toBeCloseTo(daily, 6);
    expect(d.nextDayGain).toBeCloseTo(daily, 6);
    expect(d.daysElapsed).toBe(20);
  });

  it('bileşik modda 30 günde tam %2,45 büyür', () => {
    const l = lot({ mode: 'compound' });
    expect(ppfValueAt(l, '2026-01-31')).toBeCloseTo(102_450, 6);
    expect(ppfValueAt(l, '2026-03-02')).toBeCloseTo(100_000 * 1.0245 ** 2, 6);
    expect(dailyRate(2.45, 'compound')).toBeCloseTo(1.0245 ** (1 / 30) - 1, 12);
  });

  it('oran değişikliğinde birikmiş getiri korunur', () => {
    const changed = withRateChange(lot(), '2026-01-11', 3);
    // 10 gün %2,45 + 20 gün %3
    const expected = 100_000 * (1 + (0.0245 * 10) / 30 + (0.03 * 20) / 30);
    expect(ppfValueAt(changed, '2026-01-31')).toBeCloseTo(expected, 6);
    expect(ppfValueAt(changed, '2026-01-11')).toBeCloseTo(ppfValueAt(lot(), '2026-01-11'), 6);
  });

  it('başlangıçtan önceki tarihte oran değişimi baştan uygulanır', () => {
    const changed = withRateChange(lot(), '2025-12-01', 3);
    expect(changed.rates).toEqual([{ from: '2026-01-01', monthlyRate: 3 }]);
  });
});

describe('ABD hisseleri', () => {
  const h: StockHolding = {
    id: 'h1',
    symbol: 'AAPL',
    quantity: 10,
    avgCost: 150,
    buyDate: '2026-01-01',
    fxAtPurchase: 40,
    fundedFromCash: true,
    note: '',
  };
  it('değer, kâr/zarar ve TL karşılığını hesaplar', () => {
    const v = valueHolding(h, { price: 180, prevClose: 175, fetchedAt: 0, source: 'api' }, 50);
    expect(v.valueUsd).toBe(1800);
    expect(v.pnlUsd).toBe(300);
    expect(v.pnlPct).toBeCloseTo(0.2);
    expect(v.dayChangeUsd).toBe(50);
    expect(v.valueTry).toBe(90_000);
    expect(v.costTry).toBe(60_000);
    expect(v.pnlTry).toBe(30_000);
    expect(v.cashCostTry).toBe(60_000);
  });
  it('fiyat yoksa maliyet fiyatına düşer ve işaretler', () => {
    const s = summarizeStocks([h], {}, 50);
    expect(s.rows[0].priceMissing).toBe(true);
    expect(s.valueUsd).toBe(1500);
    expect(s.missingPrices).toBe(1);
  });
  it('kur yoksa TL toplamı null olur', () => {
    expect(summarizeStocks([h], {}, null).valueTry).toBeNull();
    expect(summarizeStocks([], {}, null).valueTry).toBe(0);
  });
});

describe('ana para defteri', () => {
  const today = '2026-01-31';
  const base = (): AppState => {
    const s = emptyState();
    s.capital.initial = 200_000;
    return s;
  };

  it('harcama ana paradan düşer; silinince geri gelir', () => {
    let s = base();
    s = reducer(s, { type: 'expense/add', expense: { amount: 1_500, categoryId: 'market', description: 'Market', date: '2026-01-10' } });
    s = reducer(s, { type: 'expense/add', expense: { amount: 500, categoryId: 'ulasim', description: '', date: '2026-01-12' } });
    let L = computeLedger(s, today);
    expect(L.anaPara).toBe(198_000);
    expect(L.monthExpenses).toBe(2_000);

    const id = s.expenses[0].id;
    s = reducer(s, { type: 'expense/update', expense: { ...s.expenses[0], amount: 2_500 } });
    expect(computeLedger(s, today).anaPara).toBe(197_000);

    s = reducer(s, { type: 'expense/delete', id });
    L = computeLedger(s, today);
    expect(L.anaPara).toBe(199_500);
    expect(L.totalExpenses).toBe(500);
  });

  it('yatırım likiditeden düşer, net varlığa güncel değeriyle eklenir', () => {
    let s = base();
    s = reducer(s, { type: 'ppf/add', lot: { ...lot(), startDate: '2026-01-01' } });
    s = reducer(s, { type: 'stock/add', holding: { symbol: 'MSFT', quantity: 2, avgCost: 400, buyDate: today, fxAtPurchase: 50, fundedFromCash: true, note: '' } });
    s = reducer(s, { type: 'quotes/merge', quotes: { MSFT: { price: 450, prevClose: null, fetchedAt: 0, source: 'api' } } });
    s = reducer(s, { type: 'fx/set', fx: { usdTry: 50, updatedAt: 0, source: 'manual', asOf: null } });
    const L = computeLedger(s, today);
    expect(L.anaPara).toBe(200_000);
    expect(L.investedFromCash).toBe(100_000 + 40_000);
    expect(L.liquidity).toBe(60_000);
    const ppfValue = 100_000 * (1 + (0.0245 * 30) / 30);
    expect(L.investments).toBeCloseTo(ppfValue + 900 * 50, 6);
    expect(L.netWorth).toBeCloseTo(60_000 + ppfValue + 45_000, 6);
  });

  it('dışarıdan getirilen yatırım likiditeyi etkilemez', () => {
    let s = base();
    s = reducer(s, { type: 'ppf/add', lot: { ...lot(), fundedFromCash: false } });
    const L = computeLedger(s, today);
    expect(L.liquidity).toBe(200_000);
    expect(L.netWorth).toBeCloseTo(200_000 + 102_450, 6);
  });

  it('bozdurulan fon gerçekleşen getiriyi ana paraya ekler', () => {
    let s = base();
    s = reducer(s, { type: 'ppf/add', lot: lot() });
    const id = s.ppfLots[0].id;
    s = reducer(s, {
      type: 'position/close',
      kind: 'ppf',
      id,
      record: { label: 'PPF', detail: '', openedAt: '2026-01-01', closedAt: today, costTry: 100_000, proceedsTry: 102_450, fundedFromCash: true },
    });
    const L = computeLedger(s, today);
    expect(s.ppfLots).toHaveLength(0);
    expect(L.anaPara).toBe(202_450);
    expect(L.liquidity).toBe(202_450);
    expect(L.netWorth).toBe(202_450);
  });

  it('ana para hareketleri bakiyeye yansır', () => {
    let s = base();
    s = reducer(s, { type: 'capital/addMovement', movement: { type: 'deposit', amount: 30_000, date: today, note: 'Maaş' } });
    s = reducer(s, { type: 'capital/addMovement', movement: { type: 'withdraw', amount: 5_000, date: today, note: '' } });
    expect(computeLedger(s, today).anaPara).toBe(225_000);
  });
});

describe('harcama özetleri', () => {
  it('aylık süzme ve kategori dağılımı', () => {
    let s = emptyState();
    s = reducer(s, { type: 'expense/add', expense: { amount: 100, categoryId: 'market', description: '', date: '2026-01-05' } });
    s = reducer(s, { type: 'expense/add', expense: { amount: 300, categoryId: 'kira', description: '', date: '2026-01-06' } });
    s = reducer(s, { type: 'expense/add', expense: { amount: 50, categoryId: 'market', description: '', date: '2026-02-01' } });
    const jan = expensesInMonth(s.expenses, '2026-01');
    expect(totalOf(jan)).toBe(400);
    const b = categoryBreakdown(jan, s.categories);
    expect(b[0].category.id).toBe('kira');
    expect(b[0].share).toBeCloseTo(0.75);
  });
});
