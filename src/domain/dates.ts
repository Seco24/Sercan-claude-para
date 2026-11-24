import type { ISODate, MonthKey } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Yerel saate göre bugünün tarihi (YYYY-MM-DD). */
export function todayISO(now: Date = new Date()): ISODate {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function isISODate(s: unknown): s is ISODate {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function parts(iso: ISODate): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number);
  return [y, m, d];
}

/** Takvim günü numarası (saat dilimi / yaz saati etkisinden bağımsız). */
export function dayNumber(iso: ISODate): number {
  const [y, m, d] = parts(iso);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** b - a gün farkı */
export function daysBetween(a: ISODate, b: ISODate): number {
  return dayNumber(b) - dayNumber(a);
}

export function addDays(iso: ISODate, n: number): ISODate {
  const dt = new Date((dayNumber(iso) + n) * 86_400_000);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function monthOf(iso: ISODate): MonthKey {
  return iso.slice(0, 7);
}

export function shiftMonth(key: MonthKey, delta: number): MonthKey {
  const [y, m] = key.split('-').map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
}

export function daysInMonth(key: MonthKey): number {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** endKey dahil geriye doğru n ay (eskiden yeniye sıralı) */
export function lastMonths(endKey: MonthKey, n: number): MonthKey[] {
  return Array.from({ length: n }, (_, i) => shiftMonth(endKey, i - (n - 1)));
}

const monthLong = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const monthShort = new Intl.DateTimeFormat('tr-TR', { month: 'short', timeZone: 'UTC' });
const dateMed = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const dateDay = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long', timeZone: 'UTC' });
const timeFmt = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' });
const dateTimeFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const utc = (iso: ISODate) => new Date(dayNumber(iso) * 86_400_000);

export function monthLabel(key: MonthKey): string {
  const s = monthLong.format(utc(`${key}-01`));
  return s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1);
}

export function monthShortLabel(key: MonthKey): string {
  return monthShort.format(utc(`${key}-01`));
}

export function formatDate(iso: ISODate): string {
  return dateMed.format(utc(iso));
}

export function formatDayHeading(iso: ISODate): string {
  return dateDay.format(utc(iso));
}

/** Zaman damgasını "bugün 14:05" / "3 Kas 14:05" biçiminde gösterir. */
export function formatTimestamp(ms: number, now: number = Date.now()): string {
  const d = new Date(ms);
  if (todayISO(d) === todayISO(new Date(now))) return `bugün ${timeFmt.format(d)}`;
  return dateTimeFmt.format(d);
}

/** "5 dk önce" gibi göreli zaman */
export function formatAgo(ms: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return 'az önce';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} dk önce`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} sa önce`;
  return `${Math.round(h / 24)} gün önce`;
}
