/**
 * Uygulamanın tüm veri modeli. Kalıcı olarak saklanan tek kaynak (single source of truth)
 * `AppState`'tir; bakiye, net varlık, aylık borç gibi tüm rakamlar bu durumdan
 * saf fonksiyonlarla TÜRETİLİR (bkz. domain/ledger.ts). Hiçbir bakiye ayrıca
 * saklanmaz; bu sayede bir harcama silindiğinde/düzenlendiğinde her şey kendiliğinden doğru kalır.
 */

/** Yerel takvim günü, 'YYYY-MM-DD' */
export type ISODate = string;
/** Ay anahtarı, 'YYYY-MM' */
export type MonthKey = string;

export type MovementType = 'deposit' | 'withdraw';

/** Ana paraya ekleme / ana paradan çekme hareketi */
export interface CapitalMovement {
  id: string;
  type: MovementType;
  amount: number; // TL, her zaman pozitif
  date: ISODate;
  note: string;
}

export interface Capital {
  /** Başlangıç ana parası (TL) */
  initial: number;
  initialDate: ISODate;
  movements: CapitalMovement[];
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
}

export interface Expense {
  id: string;
  amount: number; // TL, pozitif
  categoryId: string;
  description: string;
  date: ISODate;
  createdAt: number;
}

/** simple: aylık oran / ay gün sayısı kadar her gün eşit artış. compound: günlük bileşik. */
export type AccrualMode = 'simple' | 'compound';

/** Belirli bir tarihten itibaren geçerli aylık getiri oranı (yüzde, örn. 2.45) */
export interface RatePeriod {
  from: ISODate;
  monthlyRate: number;
}

/** Para piyasası fonuna yapılan tek bir yatırım (lot) */
export interface PpfLot {
  id: string;
  name: string;
  principal: number; // TL
  startDate: ISODate;
  mode: AccrualMode;
  /** Sıralı oran dönemleri. İlk dönem her zaman startDate'ten başlar. */
  rates: RatePeriod[];
  /** true ise yatırım tutarı likiditeden (ana paradan) aktarılmış sayılır */
  fundedFromCash: boolean;
}

export interface StockHolding {
  id: string;
  symbol: string;
  quantity: number;
  avgCost: number; // USD / hisse
  buyDate: ISODate;
  /** Alış anındaki USD/TRY kuru — TL maliyet ve likiditeden düşülen tutar için */
  fxAtPurchase: number | null;
  fundedFromCash: boolean;
  note: string;
}

export type QuoteSource = 'api' | 'manual';

export interface Quote {
  price: number; // USD
  prevClose: number | null;
  /** Fiyatın uygulamaya alındığı an (ms) */
  fetchedAt: number;
  source: QuoteSource;
  provider?: string;
}

/** Satılmış / bozdurulmuş yatırım — gerçekleşen kâr/zarar kaydı */
export interface ClosedPosition {
  id: string;
  kind: 'ppf' | 'stock';
  label: string;
  detail: string;
  openedAt: ISODate;
  closedAt: ISODate;
  /** TL maliyet (likiditeden düşülmüş tutar ya da tahmini maliyet) */
  costTry: number;
  /** Ana paraya dönen TL tutar */
  proceedsTry: number;
  fundedFromCash: boolean;
}

export type QuoteProviderId = 'finnhub' | 'twelvedata' | 'alphavantage' | 'manual';
export type ApiProviderId = Exclude<QuoteProviderId, 'manual'>;
export type ThemePref = 'system' | 'light' | 'dark';

export interface Settings {
  theme: ThemePref;
  quoteProvider: QuoteProviderId;
  apiKeys: Partial<Record<ApiProviderId, string>>;
  /** 0 = kapalı */
  autoRefreshMinutes: number;
  fxMode: 'auto' | 'manual';
  ppfDefaultRate: number;
  ppfDefaultMode: AccrualMode;
  /** Aylık oranın günlüğe bölünmesinde kullanılan gün sayısı (30 veya 365/12) */
  ppfDaysPerMonth: number;
}

export interface FxState {
  usdTry: number | null;
  updatedAt: number | null;
  source: 'api' | 'manual' | null;
  /** Kaynağın bildirdiği kur tarihi */
  asOf: string | null;
}

export interface AppState {
  version: number;
  capital: Capital;
  expenses: Expense[];
  categories: Category[];
  ppfLots: PpfLot[];
  holdings: StockHolding[];
  quotes: Record<string, Quote>;
  fx: FxState;
  closed: ClosedPosition[];
  settings: Settings;
}
