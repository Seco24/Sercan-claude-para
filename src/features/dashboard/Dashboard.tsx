import { useState } from 'react';
import { AllocationBar } from '../../components/charts';
import { Segmented } from '../../components/fields';
import { Icon } from '../../components/Icon';
import { Money } from '../../components/Money';
import { formatDate, formatDayHeading, monthLabel, monthOf } from '../../domain/dates';
import { categoryOf, expensesInMonth } from '../../domain/expenses';
import { formatRate, tl, usd } from '../../domain/money';
import type { CapitalMovement, Expense } from '../../domain/types';
import { href } from '../../hooks/useHashRoute';
import { useStore } from '../../state/store';
import { InitialCapitalForm, MovementForm } from './CapitalForms';

type CapitalModal = { kind: 'initial' } | { kind: 'movement'; movement?: CapitalMovement; type?: 'deposit' | 'withdraw' } | null;

export function Dashboard({ onAddExpense, onEditExpense }: { onAddExpense: () => void; onEditExpense: (e: Expense) => void }) {
  const { state, ledger: L, today, dispatch } = useStore();
  const [modal, setModal] = useState<CapitalModal>(null);
  const month = monthOf(today);
  const recent = expensesInMonth(state.expenses, month).slice(0, 6);
  const isEmpty = state.capital.initial === 0 && state.capital.movements.length === 0 && state.expenses.length === 0 && state.ppfLots.length === 0 && state.holdings.length === 0;
  const movements = [...state.capital.movements].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">Özet</h1>
          <p className="page__sub">{formatDayHeading(today)}</p>
        </div>
        <div className="page__actions">
          <button className="btn btn--ghost hide-sm" onClick={() => setModal({ kind: 'movement', type: 'deposit' })}>
            <Icon name="plus" size={18} /> Ana paraya ekle
          </button>
          <button className="btn btn--primary hide-sm" onClick={onAddExpense}>
            <Icon name="receipt" size={18} /> Harcama ekle
          </button>
        </div>
      </header>

      {isEmpty && (
        <section className="onboard">
          <h2>Başlamak için ana paranızı girin</h2>
          <p>
            Elinizdeki toplam nakit tutarı başlangıç ana parası olarak girin. Sonra harcamalarınızı ekledikçe ana paradan otomatik düşülür;
            para piyasası fonu ve ABD hisseleriniz de bugünkü değerleriyle ana paraya eklenir.
          </p>
          <button className="btn btn--primary" onClick={() => setModal({ kind: 'initial' })}>
            Başlangıç ana parasını gir
          </button>
        </section>
      )}

      {L.liquidity < -0.004 && L.funding !== 'none' && L.funding !== 'external' && (
        <div className="banner">
          <Icon name="alert" size={18} />
          <div className="banner__body">
            <p>
              Nakit eksiye düştü: yatırımlarınızdaki para nakitten düşülmüş. Bu para başlangıç ana paranıza dahil değilse, yani ayrıca
              vardıysa, yatırımları öyle işaretleyin.
            </p>
            <button className="btn btn--sm btn--ghost" onClick={() => dispatch({ type: 'investments/setFunding', fundedFromCash: false })}>
              Yatırımlardaki para ayrıca vardı
            </button>
          </div>
        </div>
      )}

      <section className="hero" aria-label="Ana para ve nakit">
        <div className="hero__fig">
          <h2 className="hero__label">Ana para</h2>
          <p className={`hero__value num${L.anaPara < 0 ? ' is-neg' : ''}`}>{tl(L.anaPara)}</p>
          {Math.abs(L.todayChange) > 0.004 && (
            <p className="hero__today">
              Bugün <span className={`num ${L.todayChange > 0 ? 'is-pos' : 'is-neg'}`}>{tl(L.todayChange, { signed: true })}</span>
              <span className="muted">
                {' '}
                (PPF {tl(L.ppf.todayGain, { signed: true })}
                {L.stocks.rows.length > 0 && state.fx.usdTry ? `, ABD ${tl(L.stocks.dayChangeUsd * state.fx.usdTry, { signed: true })}` : ''})
              </span>
            </p>
          )}
          <ul className="hero__parts" aria-label="Ana paranın dağılımı">
            <li>
              <span className={`swatch s1`} aria-hidden="true" /> Nakit <span className="num">{tl(L.liquidity, { decimals: 0 })}</span>
            </li>
            <li>
              <span className={`swatch s2`} aria-hidden="true" /> PPF <span className="num">{tl(L.ppf.value, { decimals: 0 })}</span>
            </li>
            <li>
              <span className={`swatch s3`} aria-hidden="true" /> ABD{' '}
              <span className="num">{L.stocksExcluded ? 'kur yok' : tl(L.stocksTry, { decimals: 0 })}</span>
            </li>
          </ul>
          <div className="hero__actions">
            <button className="btn btn--sm btn--ghost" onClick={() => setModal({ kind: 'movement', type: 'deposit' })}>
              <Icon name="plus" size={16} /> Ekle
            </button>
            <button className="btn btn--sm btn--ghost" onClick={() => setModal({ kind: 'movement', type: 'withdraw' })}>
              <Icon name="minus" size={16} /> Çek
            </button>
            <button className="btn btn--sm btn--ghost" onClick={() => setModal({ kind: 'initial' })}>
              <Icon name="edit" size={16} /> Başlangıç
            </button>
          </div>
        </div>
        <div className="hero__fig hero__fig--net">
          <h2 className="hero__label">Nakit (kalan likidite)</h2>
          <p className={`hero__value num${L.liquidity < 0 ? ' is-neg' : ''}`}>{tl(L.liquidity)}</p>
          <p className="hero__note">
            Yatırımda olmayan, harcanabilir para. Harcamalar buradan düşer.
            {L.stocksExcluded && <span className="warn-text"> USD/TRY kuru olmadığından ABD hisseleri ana paraya eklenemedi.</span>}
          </p>
        </div>
      </section>

      <section className="stats" aria-label="Özet rakamlar">
        <a className="stat" href={href('harcamalar')}>
          <span className="stat__label">Bu ayın harcaması (aylık borç)</span>
          <span className="stat__value num">{tl(L.monthExpenses)}</span>
          <span className="stat__note">
            {monthLabel(month)}, {L.monthExpenseCount} kayıt
          </span>
        </a>
        <a className="stat" href={href('yatirimlar')}>
          <span className="stat__label">Yatırımdaki toplam tutar</span>
          <span className="stat__value num">{tl(L.investments)}</span>
          <span className="stat__note">
            PPF {tl(L.ppf.value, { decimals: 0 })}, ABD {L.stocks.valueTry != null ? tl(L.stocks.valueTry, { decimals: 0 }) : usd(L.stocks.valueUsd, { decimals: 0 })}
          </span>
        </a>
        <a className="stat" href={href('yatirimlar')}>
          <span className="stat__label">Yatırım kazancı</span>
          <span className={`stat__value num${L.investmentGain > 0.004 ? ' is-pos' : L.investmentGain < -0.004 ? ' is-neg' : ''}`}>
            {tl(L.investmentGain, { signed: true })}
          </span>
          <span className="stat__note">PPF getirisi ve hisse kâr/zararı, ana paraya dahil</span>
        </a>
      </section>

      <div className="grid-2">
        <section className="panel">
          <h2 className="panel__title">Hesap dökümü</h2>
          <p className="panel__sub">Rakamların birbirinden nasıl türediği</p>
          <dl className="ledger">
            <LedgerRow label="Başlangıç ana parası" value={L.initial} note={formatDate(state.capital.initialDate)} />
            {L.deposits > 0 && <LedgerRow op="+" label="Eklemeler" value={L.deposits} />}
            {L.withdrawals > 0 && <LedgerRow op="−" label="Çekimler" value={L.withdrawals} />}
            <LedgerRow op="−" label="Harcamalar (tüm zamanlar)" value={L.totalExpenses} />
            {Math.abs(L.realized) > 0.004 && <LedgerRow op={L.realized >= 0 ? '+' : '−'} label="Kapanan yatırımlardan dönen" value={Math.abs(L.realized)} />}
            {L.investedFromCash > 0.004 && (
              <LedgerRow
                op="−"
                label="Nakitten yatırıma aktarılan"
                value={L.investedFromCash}
                note={`PPF ${tl(L.ppfFunded, { decimals: 0 })}, ABD ${tl(L.stocksFunded, { decimals: 0 })}`}
              />
            )}
            <LedgerRow total label="Nakit" value={L.liquidity} />
            <LedgerRow op="+" label="Para piyasası fonu (bugünkü bakiye)" value={L.ppf.value} />
            <LedgerRow op="+" label="ABD borsası (bugünkü TL değeri)" value={L.stocksTry} note={L.stocksExcluded ? 'USD/TRY kuru girilmedi' : undefined} />
            <LedgerRow grand label="Ana para" value={L.anaPara} />
          </dl>
          {L.funding !== 'none' && <FundingControl funding={L.funding} />}
        </section>

        <div className="stack">
          <section className="panel">
            <h2 className="panel__title">Varlık dağılımı</h2>
            {L.anaPara > 0 ? (
              <AllocationBar
                parts={[
                  { key: 'cash', label: 'Nakit', value: L.liquidity, slot: 1 },
                  { key: 'ppf', label: 'Para piyasası fonu', value: L.ppf.value, slot: 2 },
                  { key: 'us', label: 'ABD borsası', value: L.stocks.valueTry ?? 0, slot: 3 },
                ]}
              />
            ) : (
              <p className="empty">Ana para veya yatırım ekledikçe dağılım burada görünür.</p>
            )}
            {state.fx.usdTry && (
              <p className="panel__foot muted">
                USD/TRY {formatRate(state.fx.usdTry)} {state.fx.source === 'manual' ? '(elle girildi)' : ''}
              </p>
            )}
          </section>

          <section className="panel">
            <div className="panel__row">
              <h2 className="panel__title">Bu ayki son harcamalar</h2>
              <a className="link" href={href('harcamalar')}>
                Tümü
              </a>
            </div>
            {recent.length === 0 ? (
              <div className="empty">
                <p>{monthLabel(month)} için henüz harcama yok.</p>
                <button className="btn btn--sm btn--ghost" onClick={onAddExpense}>
                  <Icon name="plus" size={16} /> Harcama ekle
                </button>
              </div>
            ) : (
              <ul className="rows">
                {recent.map((e) => {
                  const c = categoryOf(e.categoryId, state.categories);
                  return (
                    <li key={e.id}>
                      <button className="row" onClick={() => onEditExpense(e)}>
                        <span className="row__icon" aria-hidden="true">
                          {c.emoji}
                        </span>
                        <span className="row__main">
                          <span className="row__title">{e.description || c.name}</span>
                          <span className="row__sub">
                            {c.name}, {formatDate(e.date)}
                          </span>
                        </span>
                        <Money className="row__amount" value={-e.amount} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className="panel">
        <div className="panel__row">
          <div>
            <h2 className="panel__title">Ana para hareketleri</h2>
            <p className="panel__sub">Maaş, gelir veya transfer gibi eklemeler ve çekimler</p>
          </div>
          <button className="btn btn--sm btn--ghost" onClick={() => setModal({ kind: 'movement', type: 'deposit' })}>
            <Icon name="plus" size={16} /> Hareket ekle
          </button>
        </div>
        <ul className="rows">
          <li>
            <button className="row" onClick={() => setModal({ kind: 'initial' })}>
              <span className="row__icon" aria-hidden="true">
                <Icon name="wallet" size={18} />
              </span>
              <span className="row__main">
                <span className="row__title">Başlangıç ana parası</span>
                <span className="row__sub">{formatDate(state.capital.initialDate)}</span>
              </span>
              <Money className="row__amount" value={state.capital.initial} />
            </button>
          </li>
          {movements.map((m) => (
            <li key={m.id}>
              <button className="row" onClick={() => setModal({ kind: 'movement', movement: m })}>
                <span className="row__icon" aria-hidden="true">
                  <Icon name={m.type === 'deposit' ? 'plus' : 'minus'} size={18} />
                </span>
                <span className="row__main">
                  <span className="row__title">{m.note || (m.type === 'deposit' ? 'Ekleme' : 'Çekme')}</span>
                  <span className="row__sub">{formatDate(m.date)}</span>
                </span>
                <Money className="row__amount" value={m.type === 'deposit' ? m.amount : -m.amount} signed tone />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {modal?.kind === 'initial' && <InitialCapitalForm onClose={() => setModal(null)} />}
      {modal?.kind === 'movement' && <MovementForm movement={modal.movement} initialType={modal.type} onClose={() => setModal(null)} />}
    </div>
  );
}

/**
 * Yatırımlardaki paranın kaynağı: başlangıç ana parasının içinden mi çıktı (nakitten düşülür),
 * yoksa ayrıca mı vardı (nakitten düşülmez)? Yanlış seçim parayı iki kez saydırır ya da eksik gösterir;
 * doğru seçim, "Nakit" satırının gerçek nakitle aynı çıkmasıdır.
 */
function FundingControl({ funding }: { funding: 'cash' | 'external' | 'mixed' }) {
  const { dispatch } = useStore();
  return (
    <div className="funding">
      <p className="funding__q">Yatırımlardaki para nereden geldi?</p>
      <Segmented<'cash' | 'external' | 'mixed'>
        label="Yatırımlardaki paranın kaynağı"
        value={funding}
        onChange={(v) => v !== 'mixed' && dispatch({ type: 'investments/setFunding', fundedFromCash: v === 'cash' })}
        options={[
          { value: 'cash', label: 'Başlangıç ana paramın içinden' },
          { value: 'external', label: 'Ayrıca vardı' },
        ]}
      />
      <p className="field__hint">
        {funding === 'mixed' ? 'Şu an yatırımlara göre farklı ayarlı. ' : ''}
        "Nakit" satırı elinizdeki gerçek nakitle (banka ve cüzdan) aynı çıkacak şekilde seçin. Emin değilseniz ikisini de deneyip Nakit'e bakın.
      </p>
    </div>
  );
}

function LedgerRow({ label, value, op, note, total, grand }: { label: string; value: number; op?: string; note?: string; total?: boolean; grand?: boolean }) {
  return (
    <div className={`ledger__row${total ? ' ledger__row--total' : ''}${grand ? ' ledger__row--grand' : ''}`}>
      <dt>
        <span className="ledger__op" aria-hidden="true">
          {op ?? (total || grand ? '=' : '')}
        </span>
        <span>
          {label}
          {note && <span className="ledger__note">{note}</span>}
        </span>
      </dt>
      <dd className={`num${value < -0.004 ? ' is-neg' : ''}`}>{tl(value)}</dd>
    </div>
  );
}
