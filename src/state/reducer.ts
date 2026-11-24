import { newId } from '../domain/defaults';
import { withRateChange, withoutRatePeriod } from '../domain/ppf';
import type {
  AppState,
  CapitalMovement,
  Category,
  ClosedPosition,
  Expense,
  FxState,
  ISODate,
  PpfLot,
  Quote,
  Settings,
  StockHolding,
} from '../domain/types';

type Without<T, K extends keyof T> = Omit<T, K>;

export type Action =
  | { type: 'capital/setInitial'; amount: number; date: ISODate }
  | { type: 'capital/addMovement'; movement: Without<CapitalMovement, 'id'> }
  | { type: 'capital/updateMovement'; movement: CapitalMovement }
  | { type: 'capital/deleteMovement'; id: string }
  | { type: 'expense/add'; expense: Without<Expense, 'id' | 'createdAt'> }
  | { type: 'expense/update'; expense: Expense }
  | { type: 'expense/delete'; id: string }
  | { type: 'category/add'; category: Without<Category, 'id'> }
  | { type: 'category/update'; category: Category }
  | { type: 'category/delete'; id: string }
  | { type: 'ppf/add'; lot: Without<PpfLot, 'id'> }
  | { type: 'ppf/update'; lot: PpfLot }
  | { type: 'ppf/delete'; id: string }
  | { type: 'ppf/changeRate'; lotIds: string[]; from: ISODate; monthlyRate: number }
  | { type: 'ppf/removeRate'; lotId: string; from: ISODate }
  | { type: 'stock/add'; holding: Without<StockHolding, 'id'> }
  | { type: 'stock/update'; holding: StockHolding }
  | { type: 'stock/delete'; id: string }
  | { type: 'investments/setFunding'; fundedFromCash: boolean }
  | { type: 'position/close'; kind: 'ppf' | 'stock'; id: string; record: Without<ClosedPosition, 'id' | 'kind'> }
  | { type: 'position/deleteClosed'; id: string }
  | { type: 'quotes/merge'; quotes: Record<string, Quote> }
  | { type: 'quotes/setManual'; symbol: string; price: number }
  | { type: 'fx/set'; fx: FxState }
  | { type: 'settings/update'; patch: Partial<Settings> }
  | { type: 'state/replace'; state: AppState };

const replaceById = <T extends { id: string }>(list: T[], item: T) => list.map((x) => (x.id === item.id ? item : x));
const removeById = <T extends { id: string }>(list: T[], id: string) => list.filter((x) => x.id !== id);

/** Kullanılmayan fiyat kayıtlarını temizler (silinen hisseler) */
function pruneQuotes(state: AppState): AppState {
  const symbols = new Set(state.holdings.map((h) => h.symbol));
  const quotes = Object.fromEntries(Object.entries(state.quotes).filter(([s]) => symbols.has(s)));
  return { ...state, quotes };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'capital/setInitial':
      return { ...state, capital: { ...state.capital, initial: action.amount, initialDate: action.date } };
    case 'capital/addMovement':
      return {
        ...state,
        capital: { ...state.capital, movements: [...state.capital.movements, { ...action.movement, id: newId() }] },
      };
    case 'capital/updateMovement':
      return { ...state, capital: { ...state.capital, movements: replaceById(state.capital.movements, action.movement) } };
    case 'capital/deleteMovement':
      return { ...state, capital: { ...state.capital, movements: removeById(state.capital.movements, action.id) } };

    case 'expense/add':
      return { ...state, expenses: [...state.expenses, { ...action.expense, id: newId(), createdAt: Date.now() }] };
    case 'expense/update':
      return { ...state, expenses: replaceById(state.expenses, action.expense) };
    case 'expense/delete':
      return { ...state, expenses: removeById(state.expenses, action.id) };

    case 'category/add':
      return { ...state, categories: [...state.categories, { ...action.category, id: newId() }] };
    case 'category/update':
      return { ...state, categories: replaceById(state.categories, action.category) };
    case 'category/delete':
      // Harcamalar kategori kimliğini korur; silinen kategorideki harcamalar "Diğer" altında görünür.
      return { ...state, categories: removeById(state.categories, action.id) };

    case 'ppf/add':
      return { ...state, ppfLots: [...state.ppfLots, { ...action.lot, id: newId() }] };
    case 'ppf/update':
      return { ...state, ppfLots: replaceById(state.ppfLots, action.lot) };
    case 'ppf/delete':
      return { ...state, ppfLots: removeById(state.ppfLots, action.id) };
    case 'ppf/changeRate':
      return {
        ...state,
        ppfLots: state.ppfLots.map((l) => (action.lotIds.includes(l.id) ? withRateChange(l, action.from, action.monthlyRate) : l)),
      };
    case 'ppf/removeRate':
      return { ...state, ppfLots: state.ppfLots.map((l) => (l.id === action.lotId ? withoutRatePeriod(l, action.from) : l)) };

    case 'stock/add':
      return { ...state, holdings: [...state.holdings, { ...action.holding, id: newId() }] };
    case 'stock/update':
      return pruneQuotes({ ...state, holdings: replaceById(state.holdings, action.holding) });
    case 'stock/delete':
      return pruneQuotes({ ...state, holdings: removeById(state.holdings, action.id) });

    case 'investments/setFunding': {
      // Tüm açık yatırımların para kaynağını tek seferde ayarlar.
      // Ana paradan sayılan hisselerde alış kuru yoksa bugünkü kur alış kuru kabul edilir.
      const f = action.fundedFromCash;
      return {
        ...state,
        ppfLots: state.ppfLots.map((l) => ({ ...l, fundedFromCash: f })),
        holdings: state.holdings.map((h) => ({
          ...h,
          fundedFromCash: f,
          fxAtPurchase: f && !h.fxAtPurchase ? state.fx.usdTry : h.fxAtPurchase,
        })),
      };
    }
    case 'position/close': {
      const record: ClosedPosition = { ...action.record, id: newId(), kind: action.kind };
      const next =
        action.kind === 'ppf'
          ? { ...state, ppfLots: removeById(state.ppfLots, action.id) }
          : pruneQuotes({ ...state, holdings: removeById(state.holdings, action.id) });
      return { ...next, closed: [record, ...state.closed] };
    }
    case 'position/deleteClosed':
      return { ...state, closed: removeById(state.closed, action.id) };

    case 'quotes/merge':
      return { ...state, quotes: { ...state.quotes, ...action.quotes } };
    case 'quotes/setManual':
      return {
        ...state,
        quotes: {
          ...state.quotes,
          [action.symbol]: {
            price: action.price,
            prevClose: state.quotes[action.symbol]?.prevClose ?? null,
            fetchedAt: Date.now(),
            source: 'manual',
          },
        },
      };
    case 'fx/set':
      return { ...state, fx: action.fx };
    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'state/replace':
      return action.state;
    default:
      return state;
  }
}
