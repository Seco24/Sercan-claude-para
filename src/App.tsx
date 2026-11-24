import { useEffect, useState } from 'react';
import { Icon, type IconName } from './components/Icon';
import { ToastProvider } from './components/Toast';
import { formatRate } from './domain/money';
import { Dashboard } from './features/dashboard/Dashboard';
import { ExpenseForm, type ExpenseDraft } from './features/expenses/ExpenseForm';
import { ExpensesPage } from './features/expenses/ExpensesPage';
import { InvestmentsPage, type InvestTab } from './features/investments/InvestmentsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { href, useHashRoute, type Route } from './hooks/useHashRoute';
import { MarketProvider } from './state/market';
import { StoreProvider, useStore } from './state/store';

const NAV: Array<{ route: Route; label: string; icon: IconName }> = [
  { route: 'ozet', label: 'Özet', icon: 'home' },
  { route: 'harcamalar', label: 'Harcamalar', icon: 'receipt' },
  { route: 'yatirimlar', label: 'Yatırımlar', icon: 'trend' },
  { route: 'ayarlar', label: 'Ayarlar', icon: 'settings' },
];

export default function App() {
  return (
    <ToastProvider>
      <StoreProvider>
        <MarketProvider>
          <Shell />
        </MarketProvider>
      </StoreProvider>
    </ToastProvider>
  );
}

/** Ayardaki temayı (sistem/aydınlık/karanlık) <html data-theme> olarak uygular. */
function useApplyTheme() {
  const { state } = useStore();
  const pref = state.settings.theme;
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = pref === 'dark' || (pref === 'system' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#101315' : '#eef1f0');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [pref]);
}

function Shell() {
  const { route, sub } = useHashRoute();
  const { state, ledger } = useStore();
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft | null>(null);
  useApplyTheme();

  const addExpense = (date?: string) => setExpenseDraft({ date });
  const editExpense = (expense: ExpenseDraft['expense']) => setExpenseDraft({ expense });
  const investTab: InvestTab = sub === 'abd' ? 'abd' : 'ppf';

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        İçeriğe geç
      </a>
      <aside className="sidebar">
        <a className="brand" href={href('ozet')}>
          <span className="brand__mark" aria-hidden="true" />
          Para Defteri
        </a>
        <nav aria-label="Ana menü">
          <ul className="nav">
            {NAV.map((n) => (
              <li key={n.route}>
                <a className="nav__item" href={href(n.route)} aria-current={route === n.route ? 'page' : undefined}>
                  <Icon name={n.icon} />
                  <span>{n.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="sidebar__foot">
          <div>
            <span className="muted">Ana para</span>
            <strong className="num">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(ledger.anaPara)}</strong>
          </div>
          {state.fx.usdTry && (
            <div>
              <span className="muted">USD/TRY</span>
              <strong className="num">{formatRate(state.fx.usdTry)}</strong>
            </div>
          )}
        </div>
      </aside>

      <main id="main" className="main">
        {route === 'ozet' && <Dashboard onAddExpense={() => addExpense()} onEditExpense={editExpense} />}
        {route === 'harcamalar' && <ExpensesPage onAdd={addExpense} onEdit={editExpense} />}
        {route === 'yatirimlar' && <InvestmentsPage tab={investTab} onTab={(t) => (window.location.hash = href('yatirimlar', t))} />}
        {route === 'ayarlar' && <SettingsPage />}
      </main>

      {(route === 'ozet' || route === 'harcamalar') && (
        <button className="fab" onClick={() => addExpense()} aria-label="Harcama ekle">
          <Icon name="plus" size={26} />
        </button>
      )}

      <nav className="tabbar" aria-label="Alt menü">
        {NAV.map((n) => (
          <a key={n.route} className="tabbar__item" href={href(n.route)} aria-current={route === n.route ? 'page' : undefined}>
            <Icon name={n.icon} size={22} />
            <span>{n.label}</span>
          </a>
        ))}
      </nav>

      {expenseDraft && <ExpenseForm draft={expenseDraft} onClose={() => setExpenseDraft(null)} />}
    </div>
  );
}
