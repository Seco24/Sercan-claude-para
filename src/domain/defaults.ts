import { todayISO } from './dates';
import type { AppState, Category, Settings } from './types';

export const STATE_VERSION = 1;

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'market', name: 'Market', emoji: '🛒' },
  { id: 'faturalar', name: 'Faturalar', emoji: '💡' },
  { id: 'kira', name: 'Kira / Aidat', emoji: '🏠' },
  { id: 'yeme-icme', name: 'Yeme-içme', emoji: '🍽️' },
  { id: 'ulasim', name: 'Ulaşım', emoji: '🚗' },
  { id: 'saglik', name: 'Sağlık', emoji: '🩺' },
  { id: 'giyim', name: 'Giyim', emoji: '👕' },
  { id: 'eglence', name: 'Eğlence', emoji: '🎬' },
  { id: 'abonelik', name: 'Abonelikler', emoji: '🔁' },
  { id: 'egitim', name: 'Eğitim', emoji: '📚' },
  { id: 'kredi', name: 'Kredi / Taksit', emoji: '💳' },
  { id: 'diger', name: 'Diğer', emoji: '📦' },
];

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  quoteProvider: 'finnhub',
  apiKeys: {},
  autoRefreshMinutes: 5,
  fxMode: 'auto',
  ppfDefaultRate: 2.45,
  ppfDefaultMode: 'simple',
  ppfDaysPerMonth: 30,
};

export function emptyState(): AppState {
  return {
    version: STATE_VERSION,
    capital: { initial: 0, initialDate: todayISO(), movements: [] },
    expenses: [],
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    ppfLots: [],
    holdings: [],
    quotes: {},
    fx: { usdTry: null, updatedAt: null, source: null, asOf: null },
    closed: [],
    settings: { ...DEFAULT_SETTINGS, apiKeys: {} },
  };
}

export function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
