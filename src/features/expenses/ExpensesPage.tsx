import { useMemo, useState } from 'react';
import { MonthBars, RankedBars } from '../../components/charts';
import { Icon } from '../../components/Icon';
import { Money } from '../../components/Money';
import { formatDayHeading, lastMonths, monthLabel, monthOf, shiftMonth } from '../../domain/dates';
import { allMonths, categoryBreakdown, categoryOf, dailyAverage, expensesInMonth, groupByDay, monthlyTotals, totalOf } from '../../domain/expenses';
import { tl } from '../../domain/money';
import type { Expense, MonthKey } from '../../domain/types';
import { useStore } from '../../state/store';
import { DailyLimitMeter } from '../limit/DailyLimit';

export function ExpensesPage({ onAdd, onEdit }: { onAdd: (date?: string) => void; onEdit: (e: Expense) => void }) {
  const { state, today } = useStore();
  const currentMonth = monthOf(today);
  const [month, setMonth] = useState<MonthKey>(currentMonth);
  const [filter, setFilter] = useState<string | null>(null);

  const monthExpenses = useMemo(() => expensesInMonth(state.expenses, month), [state.expenses, month]);
  const total = totalOf(monthExpenses);
  const prevTotal = totalOf(expensesInMonth(state.expenses, shiftMonth(month, -1)));
  const breakdown = categoryBreakdown(monthExpenses, state.categories);
  const history = monthlyTotals(state.expenses, lastMonths(month > currentMonth ? month : currentMonth, 12));
  const months = allMonths(state.expenses);
  const visible = filter ? monthExpenses.filter((e) => categoryOf(e.categoryId, state.categories).id === filter) : monthExpenses;
  const groups = groupByDay(visible);
  const avg = dailyAverage(total, month, currentMonth, Number(today.slice(8, 10)));
  const diff = total - prevTotal;

  const go = (m: MonthKey) => {
    setMonth(m);
    setFilter(null);
  };

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">Harcamalar</h1>
          <p className="page__sub">Her harcama ana paradan otomatik düşülür</p>
        </div>
        <div className="page__actions">
          <button className="btn btn--primary hide-sm" onClick={() => onAdd(month === currentMonth ? undefined : `${month}-01`)}>
            <Icon name="plus" size={18} /> Harcama ekle
          </button>
        </div>
      </header>

      <div className="month-nav">
        <button className="icon-btn" onClick={() => go(shiftMonth(month, -1))} aria-label="Önceki ay">
          <Icon name="chevronLeft" />
        </button>
        <h2 className="month-nav__label">{monthLabel(month)}</h2>
        <button className="icon-btn" onClick={() => go(shiftMonth(month, 1))} aria-label="Sonraki ay">
          <Icon name="chevronRight" />
        </button>
        {month !== currentMonth && (
          <button className="btn btn--sm btn--ghost" onClick={() => go(currentMonth)}>
            Bu aya dön
          </button>
        )}
      </div>

      {month === currentMonth && <DailyLimitMeter />}

      <section className="stats stats--month" aria-label="Aylık özet">
        <div className="stat stat--lead">
          <span className="stat__label">Aylık borç (toplam harcama)</span>
          <span className="stat__value num">{tl(total)}</span>
          <span className="stat__note">
            {prevTotal > 0 || total > 0
              ? diff === 0
                ? `${monthLabel(shiftMonth(month, -1))} ile aynı`
                : `${monthLabel(shiftMonth(month, -1))} ayına göre ${tl(Math.abs(diff))} ${diff > 0 ? 'daha fazla' : 'daha az'}`
              : 'Bu ay için kayıt yok'}
          </span>
        </div>
        <div className="stat">
          <span className="stat__label">Kayıt sayısı</span>
          <span className="stat__value num">{monthExpenses.length}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Günlük ortalama</span>
          <span className="stat__value num">{tl(avg)}</span>
        </div>
      </section>

      <div className="grid-2">
        <section className="panel">
          <h2 className="panel__title">Kategori dağılımı</h2>
          {breakdown.length ? (
            <RankedBars rows={breakdown.map((b) => ({ key: b.category.id, label: b.category.name, emoji: b.category.emoji, value: b.total, share: b.share, count: b.count }))} />
          ) : (
            <p className="empty">Bu ay harcama girilmedi.</p>
          )}
        </section>
        <section className="panel">
          <h2 className="panel__title">Son 12 ay</h2>
          <p className="panel__sub">Bir aya dokunarak o ayın kayıtlarını açın</p>
          <MonthBars data={history} selected={month} onSelect={go} />
        </section>
      </div>

      <section className="panel">
        <div className="panel__row">
          <h2 className="panel__title">{monthLabel(month)} kayıtları</h2>
          <button className="btn btn--sm btn--ghost" onClick={() => onAdd(month === currentMonth ? undefined : `${month}-01`)}>
            <Icon name="plus" size={16} /> Ekle
          </button>
        </div>
        {breakdown.length > 1 && (
          <div className="chips chips--scroll" role="toolbar" aria-label="Kategoriye göre süz">
            <button className="chip" aria-pressed={filter == null} onClick={() => setFilter(null)}>
              Tümü
            </button>
            {breakdown.map((b) => (
              <button key={b.category.id} className="chip" aria-pressed={filter === b.category.id} onClick={() => setFilter(filter === b.category.id ? null : b.category.id)}>
                <span aria-hidden="true">{b.category.emoji}</span> {b.category.name}
              </button>
            ))}
          </div>
        )}
        {groups.length === 0 ? (
          <div className="empty">
            <p>Bu ay için kayıt yok.</p>
            <button className="btn btn--sm btn--ghost" onClick={() => onAdd(month === currentMonth ? undefined : `${month}-01`)}>
              <Icon name="plus" size={16} /> Harcama ekle
            </button>
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.date} className="day-group">
              <div className="day-group__head">
                <span>{formatDayHeading(g.date)}</span>
                <span className="num">{tl(g.total)}</span>
              </div>
              <ul className="rows">
                {g.items.map((e) => {
                  const c = categoryOf(e.categoryId, state.categories);
                  return (
                    <li key={e.id}>
                      <button className="row" onClick={() => onEdit(e)}>
                        <span className="row__icon" aria-hidden="true">
                          {c.emoji}
                        </span>
                        <span className="row__main">
                          <span className="row__title">{e.description || c.name}</span>
                          <span className="row__sub">{c.name}</span>
                        </span>
                        <Money className="row__amount" value={-e.amount} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>

      {months.length > 0 && (
        <section className="panel">
          <h2 className="panel__title">Tüm aylar</h2>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Ay</th>
                <th scope="col" className="r">
                  Kayıt
                </th>
                <th scope="col" className="r">
                  Toplam
                </th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.month} className={m.month === month ? 'is-selected' : ''}>
                  <td>
                    <button className="link" onClick={() => go(m.month)}>
                      {monthLabel(m.month)}
                    </button>
                  </td>
                  <td className="r num">{m.count}</td>
                  <td className="r num">{tl(m.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
