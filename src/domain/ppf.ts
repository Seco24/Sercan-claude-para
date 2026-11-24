import { addDays, daysBetween } from './dates';
import type { AccrualMode, ISODate, PpfLot, RatePeriod } from './types';

/**
 * Para Piyasası Fonu (PPF) getiri hesabı.
 *
 * Aylık oran (örn. %2,45) "ay gün sayısı"na (varsayılan 30) bölünerek günlüğe çevrilir:
 *  - simple   : her gün anaparanın (r / D) kadarı eklenir → bakiye her gün EŞİT tutarda artar.
 *               bakiye = P × (1 + Σ rᵢ × günᵢ / D)
 *  - compound : günlük bileşik → d = (1 + r)^(1/D) − 1, bakiye = P × Π (1 + rᵢ)^(günᵢ / D)
 *               (30 günde tam olarak aylık r kadar büyür)
 *
 * Oran değişiklikleri `rates` dönemleriyle tutulur; her dönem kendi gün sayısı kadar işler.
 * Böylece oran güncellendiğinde geçmişte birikmiş getiri korunur.
 */

export const DEFAULT_DAYS_PER_MONTH = 30;

function sortedRates(lot: PpfLot): RatePeriod[] {
  const rates = [...lot.rates].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  if (rates.length === 0) return [{ from: lot.startDate, monthlyRate: 0 }];
  // İlk dönem lotun başlangıcından itibaren geçerlidir: başlangıçta yürürlükte olan oran alınır.
  let initial = rates[0].monthlyRate;
  for (const r of rates) if (r.from <= lot.startDate) initial = r.monthlyRate;
  return [{ from: lot.startDate, monthlyRate: initial }, ...rates.filter((r) => r.from > lot.startDate)];
}

/** Belirli bir gün itibarıyla geçerli aylık oran (yüzde). */
export function rateOn(lot: PpfLot, date: ISODate): number {
  const rates = sortedRates(lot);
  let current = rates[0].monthlyRate;
  for (const r of rates) if (r.from <= date) current = r.monthlyRate;
  return current;
}

/** `date` gününün başındaki bakiye (startDate'ten bu yana geçen tam gün kadar getiri işlemiş). */
export function ppfValueAt(lot: PpfLot, date: ISODate, daysPerMonth = DEFAULT_DAYS_PER_MONTH): number {
  if (date <= lot.startDate || lot.principal <= 0) return lot.principal;
  const rates = sortedRates(lot);
  let simple = 0;
  let factor = 1;
  for (let i = 0; i < rates.length; i++) {
    const segStart = rates[i].from;
    if (segStart >= date) break;
    const next = rates[i + 1]?.from;
    const segEnd = next && next < date ? next : date;
    const days = daysBetween(segStart, segEnd);
    if (days <= 0) continue;
    const r = rates[i].monthlyRate / 100;
    simple += (r * days) / daysPerMonth;
    factor *= Math.pow(1 + r, days / daysPerMonth);
  }
  return lot.mode === 'simple' ? lot.principal * (1 + simple) : lot.principal * factor;
}

/** Aylık oranın günlük karşılığı (oran olarak, örn. 0.000816) */
export function dailyRate(monthlyRatePct: number, mode: AccrualMode, daysPerMonth = DEFAULT_DAYS_PER_MONTH): number {
  const r = monthlyRatePct / 100;
  return mode === 'simple' ? r / daysPerMonth : Math.pow(1 + r, 1 / daysPerMonth) - 1;
}

/** Yıllık karşılık: basit modda nominal (r×12), bileşikte efektif ((1+r)^12 − 1) */
export function annualRate(monthlyRatePct: number, mode: AccrualMode): number {
  const r = monthlyRatePct / 100;
  return mode === 'simple' ? r * 12 : Math.pow(1 + r, 12) - 1;
}

export interface PpfProjection {
  label: string;
  days: number;
  date: ISODate;
  value: number;
  gain: number;
}

export interface PpfLotDetail {
  lot: PpfLot;
  started: boolean;
  daysElapsed: number;
  value: number;
  accrued: number;
  currentRate: number;
  dailyRate: number;
  /** Bugün eklenen tutar (dün → bugün) */
  todayGain: number;
  /** Yarın eklenecek tutar (bugün → yarın) */
  nextDayGain: number;
  tomorrowValue: number;
  projections: PpfProjection[];
}

const HORIZONS: Array<[string, number]> = [
  ['1 ay', 30],
  ['3 ay', 90],
  ['6 ay', 180],
  ['1 yıl', 365],
];

export function lotDetail(lot: PpfLot, today: ISODate, daysPerMonth = DEFAULT_DAYS_PER_MONTH): PpfLotDetail {
  const value = ppfValueAt(lot, today, daysPerMonth);
  const yesterdayValue = ppfValueAt(lot, addDays(today, -1), daysPerMonth);
  const tomorrow = addDays(today, 1);
  const tomorrowValue = ppfValueAt(lot, tomorrow, daysPerMonth);
  const currentRate = rateOn(lot, today);
  const base = lot.startDate > today ? lot.startDate : today;
  return {
    lot,
    started: lot.startDate < today,
    daysElapsed: Math.max(0, daysBetween(lot.startDate, today)),
    value,
    accrued: value - lot.principal,
    currentRate,
    dailyRate: dailyRate(currentRate, lot.mode, daysPerMonth),
    todayGain: value - yesterdayValue,
    nextDayGain: tomorrowValue - value,
    tomorrowValue,
    projections: HORIZONS.map(([label, days]) => {
      const date = addDays(base, days);
      const v = ppfValueAt(lot, date, daysPerMonth);
      return { label, days, date, value: v, gain: v - value };
    }),
  };
}

export interface PpfSummary {
  lots: PpfLotDetail[];
  principal: number;
  fundedPrincipal: number;
  value: number;
  accrued: number;
  todayGain: number;
  nextDayGain: number;
  projections: PpfProjection[];
}

export function summarizePpf(lots: PpfLot[], today: ISODate, daysPerMonth = DEFAULT_DAYS_PER_MONTH): PpfSummary {
  const details = lots.map((l) => lotDetail(l, today, daysPerMonth));
  const acc = (f: (d: PpfLotDetail) => number) => details.reduce((t, d) => t + f(d), 0);
  const value = acc((d) => d.value);
  return {
    lots: details,
    principal: acc((d) => d.lot.principal),
    fundedPrincipal: acc((d) => (d.lot.fundedFromCash ? d.lot.principal : 0)),
    value,
    accrued: acc((d) => d.accrued),
    todayGain: acc((d) => d.todayGain),
    nextDayGain: acc((d) => d.nextDayGain),
    projections: HORIZONS.map(([label, days], i) => {
      const v = acc((d) => d.projections[i].value);
      return { label, days, date: addDays(today, days), value: v, gain: v - value };
    }),
  };
}

/**
 * Bir lota yeni oran dönemi ekler. Değişiklik tarihi lot başlangıcına eşit/öncesindeyse
 * ilk dönemin oranı güncellenir (baştan itibaren geçerli).
 */
export function withRateChange(lot: PpfLot, from: ISODate, monthlyRate: number): PpfLot {
  const rates = sortedRates(lot);
  if (from <= lot.startDate) {
    rates[0] = { from: lot.startDate, monthlyRate };
    return { ...lot, rates };
  }
  const next = rates.filter((r) => r.from !== from);
  next.push({ from, monthlyRate });
  next.sort((a, b) => (a.from < b.from ? -1 : 1));
  return { ...lot, rates: next };
}

export function withoutRatePeriod(lot: PpfLot, from: ISODate): PpfLot {
  if (from <= lot.startDate) return lot;
  return { ...lot, rates: lot.rates.filter((r) => r.from !== from) };
}

export function normalizedRates(lot: PpfLot): RatePeriod[] {
  return sortedRates(lot);
}
