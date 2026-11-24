import { daysInMonth, monthOf } from './dates';
import type { Category, Expense, MonthKey } from './types';

export const UNCATEGORIZED: Category = { id: 'diger', name: 'Diğer', emoji: '📦' };

export function categoryOf(id: string, categories: Category[]): Category {
  return categories.find((c) => c.id === id) ?? UNCATEGORIZED;
}

export function expensesInMonth(expenses: Expense[], month: MonthKey): Expense[] {
  return expenses
    .filter((e) => monthOf(e.date) === month)
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
}

export const totalOf = (expenses: Expense[]) => expenses.reduce((t, e) => t + e.amount, 0);

export interface CategoryShare {
  category: Category;
  total: number;
  count: number;
  share: number;
}

export function categoryBreakdown(expenses: Expense[], categories: Category[]): CategoryShare[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const e of expenses) {
    const c = categoryOf(e.categoryId, categories);
    const cur = map.get(c.id) ?? { total: 0, count: 0 };
    cur.total += e.amount;
    cur.count += 1;
    map.set(c.id, cur);
  }
  const grand = totalOf(expenses);
  return [...map.entries()]
    .map(([id, v]) => ({
      category: categoryOf(id, categories),
      total: v.total,
      count: v.count,
      share: grand > 0 ? v.total / grand : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export function monthlyTotals(expenses: Expense[], months: MonthKey[]): Array<{ month: MonthKey; total: number }> {
  const totals = new Map<MonthKey, number>(months.map((m) => [m, 0]));
  for (const e of expenses) {
    const m = monthOf(e.date);
    if (totals.has(m)) totals.set(m, totals.get(m)! + e.amount);
  }
  return months.map((m) => ({ month: m, total: totals.get(m)! }));
}

/** Kaydı olan tüm aylar, yeniden eskiye */
export function allMonths(expenses: Expense[]): Array<{ month: MonthKey; total: number; count: number }> {
  const map = new Map<MonthKey, { total: number; count: number }>();
  for (const e of expenses) {
    const m = monthOf(e.date);
    const cur = map.get(m) ?? { total: 0, count: 0 };
    cur.total += e.amount;
    cur.count += 1;
    map.set(m, cur);
  }
  return [...map.entries()].map(([month, v]) => ({ month, ...v })).sort((a, b) => (a.month < b.month ? 1 : -1));
}

/** Ayın geçen günlerine göre günlük ortalama (geçmiş aylar için ayın tamamı) */
export function dailyAverage(total: number, month: MonthKey, todayMonth: MonthKey, todayDay: number): number {
  const days = month === todayMonth ? todayDay : month < todayMonth ? daysInMonth(month) : 0;
  return days > 0 ? total / days : 0;
}

/** Aynı güne ait harcamaları gruplar (liste görünümü için) */
export function groupByDay(expenses: Expense[]): Array<{ date: string; items: Expense[]; total: number }> {
  const groups: Array<{ date: string; items: Expense[]; total: number }> = [];
  for (const e of expenses) {
    const last = groups[groups.length - 1];
    if (last && last.date === e.date) {
      last.items.push(e);
      last.total += e.amount;
    } else groups.push({ date: e.date, items: [e], total: e.amount });
  }
  return groups;
}
