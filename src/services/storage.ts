import { isISODate, todayISO } from '../domain/dates';
import { DEFAULT_SETTINGS, STATE_VERSION, emptyState, newId } from '../domain/defaults';
import type {
  AppState,
  CapitalMovement,
  Category,
  ClosedPosition,
  Expense,
  PpfLot,
  Quote,
  RatePeriod,
  Settings,
  StockHolding,
} from '../domain/types';

/**
 * Kalıcılık katmanı. Durum tarayıcının localStorage'ında tek bir JSON olarak tutulur.
 * Okunan/İçe aktarılan her veri `normalizeState` ile doğrulanıp eksik alanları
 * tamamlanır; ileride şema değişirse `migrate` içinde sürüm geçişi yapılır.
 */

export const STORAGE_KEY = 'para-defteri:state';

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const date = (v: unknown, d: string): string => (isISODate(v) ? v : d);
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);

function normalizeSettings(raw: unknown): Settings {
  const s = obj(raw);
  const keys = obj(s.apiKeys);
  const provider = str(s.quoteProvider, DEFAULT_SETTINGS.quoteProvider);
  return {
    theme: (['system', 'light', 'dark'] as const).find((t) => t === s.theme) ?? DEFAULT_SETTINGS.theme,
    quoteProvider: (['finnhub', 'twelvedata', 'alphavantage', 'manual'] as const).find((p) => p === provider) ?? 'finnhub',
    apiKeys: {
      finnhub: str(keys.finnhub) || undefined,
      twelvedata: str(keys.twelvedata) || undefined,
      alphavantage: str(keys.alphavantage) || undefined,
    },
    autoRefreshMinutes: Math.max(0, num(s.autoRefreshMinutes, DEFAULT_SETTINGS.autoRefreshMinutes)),
    fxMode: s.fxMode === 'manual' ? 'manual' : 'auto',
    ppfDefaultRate: num(s.ppfDefaultRate, DEFAULT_SETTINGS.ppfDefaultRate),
    ppfDefaultMode: s.ppfDefaultMode === 'compound' ? 'compound' : 'simple',
    ppfDaysPerMonth: num(s.ppfDaysPerMonth, DEFAULT_SETTINGS.ppfDaysPerMonth) > 0 ? num(s.ppfDaysPerMonth, 30) : 30,
    dailyLimit: Math.max(0, num(s.dailyLimit, 0)),
    limitNotify: bool(s.limitNotify, false),
    limitExcluded: arr(s.limitExcluded).filter((x): x is string => typeof x === 'string'),
  };
}

export function normalizeState(input: unknown): AppState {
  const base = emptyState();
  const r = obj(input);
  const today = todayISO();
  const cap = obj(r.capital);

  const movements: CapitalMovement[] = arr(cap.movements).map((m) => {
    const o = obj(m);
    return {
      id: str(o.id) || newId(),
      type: o.type === 'withdraw' ? 'withdraw' : 'deposit',
      amount: Math.abs(num(o.amount)),
      date: date(o.date, today),
      note: str(o.note),
    };
  });

  const categories: Category[] = arr(r.categories)
    .map((c) => {
      const o = obj(c);
      return { id: str(o.id) || newId(), name: str(o.name).trim(), emoji: str(o.emoji, '•') };
    })
    .filter((c) => c.name);

  const expenses: Expense[] = arr(r.expenses).map((e) => {
    const o = obj(e);
    return {
      id: str(o.id) || newId(),
      amount: Math.abs(num(o.amount)),
      categoryId: str(o.categoryId, 'diger'),
      description: str(o.description),
      date: date(o.date, today),
      createdAt: num(o.createdAt, Date.now()),
    };
  });

  const ppfLots: PpfLot[] = arr(r.ppfLots).map((l) => {
    const o = obj(l);
    const startDate = date(o.startDate, today);
    const rates: RatePeriod[] = arr(o.rates)
      .map((p) => ({ from: date(obj(p).from, startDate), monthlyRate: num(obj(p).monthlyRate, 2.45) }))
      .sort((a, b) => (a.from < b.from ? -1 : 1));
    return {
      id: str(o.id) || newId(),
      name: str(o.name, 'Para piyasası fonu'),
      principal: Math.abs(num(o.principal)),
      startDate,
      mode: o.mode === 'compound' ? 'compound' : 'simple',
      rates: rates.length ? rates : [{ from: startDate, monthlyRate: num(o.monthlyRate, 2.45) }],
      fundedFromCash: bool(o.fundedFromCash, true),
    };
  });

  const holdings: StockHolding[] = arr(r.holdings).map((h) => {
    const o = obj(h);
    return {
      id: str(o.id) || newId(),
      symbol: str(o.symbol).toUpperCase(),
      quantity: Math.abs(num(o.quantity)),
      avgCost: Math.abs(num(o.avgCost)),
      buyDate: date(o.buyDate, today),
      fxAtPurchase: numOrNull(o.fxAtPurchase),
      fundedFromCash: bool(o.fundedFromCash, true),
      note: str(o.note),
    };
  }).filter((h) => h.symbol);

  const quotes: Record<string, Quote> = {};
  for (const [sym, q] of Object.entries(obj(r.quotes))) {
    const o = obj(q);
    const price = num(o.price);
    if (price > 0) {
      quotes[sym] = {
        price,
        prevClose: numOrNull(o.prevClose),
        fetchedAt: num(o.fetchedAt, Date.now()),
        source: o.source === 'manual' ? 'manual' : 'api',
        provider: str(o.provider) || undefined,
      };
    }
  }

  const fx = obj(r.fx);
  const closed: ClosedPosition[] = arr(r.closed).map((c) => {
    const o = obj(c);
    return {
      id: str(o.id) || newId(),
      kind: o.kind === 'stock' ? 'stock' : 'ppf',
      label: str(o.label),
      detail: str(o.detail),
      openedAt: date(o.openedAt, today),
      closedAt: date(o.closedAt, today),
      costTry: num(o.costTry),
      proceedsTry: num(o.proceedsTry),
      fundedFromCash: bool(o.fundedFromCash, true),
    };
  });

  return {
    version: STATE_VERSION,
    capital: {
      initial: num(cap.initial),
      initialDate: date(cap.initialDate, base.capital.initialDate),
      movements,
    },
    expenses,
    categories: categories.length ? categories : base.categories,
    ppfLots,
    holdings,
    quotes,
    fx: {
      usdTry: numOrNull(fx.usdTry),
      updatedAt: numOrNull(fx.updatedAt),
      source: fx.source === 'api' || fx.source === 'manual' ? fx.source : null,
      asOf: str(fx.asOf) || null,
    },
    closed,
    settings: normalizeSettings(r.settings),
  };
}

/** Gelecekteki şema değişiklikleri için sürüm geçişleri burada yapılır. */
function migrate(raw: unknown): unknown {
  const r = obj(raw);
  const version = num(r.version, STATE_VERSION);
  if (version > STATE_VERSION) console.warn('Kayıtlı veri daha yeni bir sürüme ait; bilinen alanlar okunuyor.');
  return r;
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    return normalizeState(migrate(JSON.parse(raw)));
  } catch (err) {
    console.error('Kayıtlı veri okunamadı, boş durumla başlanıyor.', err);
    return emptyState();
  }
}

let lastSaved = '';
export function saveState(state: AppState): { ok: boolean; error?: string } {
  try {
    const json = JSON.stringify(state);
    if (json === lastSaved) return { ok: true };
    localStorage.setItem(STORAGE_KEY, json);
    lastSaved = json;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Tarayıcıdan verinin kalıcı tutulmasını ister (depolama temizliğinde silinmesin). */
export function requestPersistence(): void {
  try {
    void navigator.storage?.persist?.();
  } catch {
    /* desteklenmiyor */
  }
}

/** Yedek dosyası — API anahtarları güvenlik için dışarı aktarılmaz. */
export function exportJson(state: AppState): string {
  const copy: AppState = { ...state, settings: { ...state.settings, apiKeys: {} } };
  return JSON.stringify({ app: 'para-defteri', exportedAt: new Date().toISOString(), ...copy }, null, 2);
}

export function importJson(text: string, current: AppState): AppState {
  const parsed = JSON.parse(text);
  const o = obj(parsed);
  if (!('capital' in o) && !('expenses' in o)) throw new Error('Bu dosya bir Para Defteri yedeği gibi görünmüyor.');
  const next = normalizeState(migrate(parsed));
  // Mevcut cihazdaki API anahtarlarını koru
  next.settings.apiKeys = { ...current.settings.apiKeys, ...next.settings.apiKeys };
  return next;
}
