import { ConfirmButton, Segmented } from '../../components/fields';
import { formatDate } from '../../domain/dates';
import { closedCashEffect } from '../../domain/ledger';
import { tl, usd } from '../../domain/money';
import { useStore } from '../../state/store';
import { PpfSection } from './PpfSection';
import { StocksSection } from './StocksSection';

export type InvestTab = 'ppf' | 'abd';

export function InvestmentsPage({ tab, onTab }: { tab: InvestTab; onTab: (t: InvestTab) => void }) {
  const { state, ledger: L, dispatch } = useStore();
  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">Yatırımlar</h1>
          <p className="page__sub">Fonun ve hisselerin bugünkü değeri ana paraya anlık olarak eklenir</p>
        </div>
      </header>

      <section className="stats" aria-label="Yatırım özeti">
        <div className="stat stat--lead">
          <span className="stat__label">Yatırımdaki toplam tutar</span>
          <span className="stat__value num">{tl(L.investments)}</span>
          <span className="stat__note">{L.stocksExcluded ? 'ABD hisseleri için USD/TRY kuru gerekli' : 'Güncel değer, TL'}</span>
        </div>
        <button className="stat stat--btn" onClick={() => onTab('ppf')} aria-pressed={tab === 'ppf'}>
          <span className="stat__label">Para piyasası fonu</span>
          <span className="stat__value num">{tl(L.ppf.value)}</span>
          <span className="stat__note is-pos">{tl(L.ppf.accrued, { signed: true })} getiri</span>
        </button>
        <button className="stat stat--btn" onClick={() => onTab('abd')} aria-pressed={tab === 'abd'}>
          <span className="stat__label">ABD borsası</span>
          <span className="stat__value num">{usd(L.stocks.valueUsd)}</span>
          <span className="stat__note">{L.stocks.valueTry != null ? `≈ ${tl(L.stocks.valueTry)}` : 'kur girilmedi'}</span>
        </button>
      </section>

      <Segmented
        label="Yatırım türü"
        value={tab}
        onChange={onTab}
        options={[
          { value: 'ppf', label: 'Para piyasası fonu' },
          { value: 'abd', label: 'ABD borsası' },
        ]}
      />

      {tab === 'ppf' ? <PpfSection /> : <StocksSection />}

      {state.closed.length > 0 && (
        <section className="panel">
          <h2 className="panel__title">Kapanan yatırımlar</h2>
          <p className="panel__sub">Satılan ve bozdurulan pozisyonlar; dönen tutar ana paraya eklendi</p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Yatırım</th>
                  <th scope="col">Tarih</th>
                  <th scope="col" className="r">
                    Maliyet
                  </th>
                  <th scope="col" className="r">
                    Dönen
                  </th>
                  <th scope="col" className="r">
                    Kâr/zarar
                  </th>
                  <th scope="col">
                    <span className="sr-only">İşlem</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.closed.map((c) => {
                  const pnl = c.proceedsTry - c.costTry;
                  return (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.label}</strong>
                        <span className="cell-sub">
                          {c.kind === 'ppf' ? 'PPF' : 'ABD'}, {c.detail}
                        </span>
                      </td>
                      <td className="muted">
                        {formatDate(c.openedAt)} – {formatDate(c.closedAt)}
                      </td>
                      <td className="r num">{tl(c.costTry)}</td>
                      <td className="r num">{tl(c.proceedsTry)}</td>
                      <td className={`r num ${pnl >= 0 ? 'is-pos' : 'is-neg'}`}>{tl(pnl, { signed: true })}</td>
                      <td className="r">
                        <ConfirmButton
                          className="link link--danger"
                          confirmText={`Ana paradan ${tl(closedCashEffect(c))} geri alınsın mı?`}
                          onConfirm={() => dispatch({ type: 'position/deleteClosed', id: c.id })}
                        >
                          Kaydı sil
                        </ConfirmButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
