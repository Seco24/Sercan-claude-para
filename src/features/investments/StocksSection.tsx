import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { NumberInput } from '../../components/fields';
import { Modal } from '../../components/Modal';
import { Delta } from '../../components/Money';
import { useToast } from '../../components/Toast';
import { formatAgo, formatDate } from '../../domain/dates';
import { formatNumber, formatPercent, formatRate, tl, usd } from '../../domain/money';
import { usMarketOpen } from '../../domain/stocks';
import type { StockHolding } from '../../domain/types';
import { useNow } from '../../hooks/useToday';
import { href } from '../../hooks/useHashRoute';
import { PROVIDERS } from '../../services/quotes';
import { useMarket } from '../../state/market';
import { useStore } from '../../state/store';
import { ManualPriceForm, SellStockForm, StockForm } from './StockForms';

type ModalState = { kind: 'edit'; holding?: StockHolding } | { kind: 'price'; symbol: string } | { kind: 'sell'; holding: StockHolding } | { kind: 'fx' } | null;

export function StocksSection() {
  const { state, ledger, dispatch } = useStore();
  const { status, refreshQuotes, refreshFx } = useMarket();
  const now = useNow(30_000);
  const [modal, setModal] = useState<ModalState>(null);
  const S = ledger.stocks;
  const { settings, fx } = state;
  const provider = settings.quoteProvider === 'manual' ? null : PROVIDERS[settings.quoteProvider];
  const hasKey = provider ? Boolean(settings.apiKeys[provider.id]) : false;
  const open = usMarketOpen(new Date(now));
  const lastUpdate = S.rows.reduce<number | null>((t, r) => (r.quote && (t == null || r.quote.fetchedAt > t) ? r.quote.fetchedAt : t), null);

  return (
    <section aria-labelledby="us-title" className="stack">
      <div className="section-head">
        <div>
          <h2 id="us-title" className="section-title">
            Amerikan borsası
          </h2>
          <p className="page__sub">
            <span className={`dot ${open ? 'dot--on' : ''}`} aria-hidden="true" />
            {open ? 'Piyasa açık' : 'Piyasa kapalı'} (NY 09:30–16:00)
            {provider ? `, fiyatlar ${provider.label}` : ', fiyatlar elle giriliyor'}
            {lastUpdate ? `, ${formatAgo(lastUpdate, now)} güncellendi` : ''}
          </p>
        </div>
        <div className="page__actions">
          {S.rows.length > 0 && (
            <button className="btn btn--ghost btn--sm" onClick={() => refreshQuotes()} disabled={status.quotesLoading}>
              <Icon name="refresh" size={16} className={status.quotesLoading ? 'spin' : ''} /> {status.quotesLoading ? 'Yenileniyor' : 'Fiyatları yenile'}
            </button>
          )}
          <button className="btn btn--primary btn--sm" onClick={() => setModal({ kind: 'edit' })}>
            <Icon name="plus" size={16} /> Hisse ekle
          </button>
        </div>
      </div>

      {provider && !hasKey && S.rows.length > 0 && (
        <div className="banner">
          <Icon name="alert" size={18} />
          <p>
            Canlı fiyat için {provider.label} API anahtarı gerekli (ücretsiz). <a href={href('ayarlar')}>Ayarlar</a>'dan ekleyin. O zamana kadar fiyata dokunarak elle girebilirsiniz.
          </p>
        </div>
      )}
      {status.quotesError && hasKey && (
        <div className="banner banner--error">
          <Icon name="alert" size={18} />
          <p>{status.quotesError}. Son bilinen fiyatlar gösteriliyor; dilerseniz fiyatı elle girin.</p>
        </div>
      )}
      {status.quotesNotice && !status.quotesError && (
        <div className="banner">
          <Icon name="alert" size={18} />
          <p>{status.quotesNotice}</p>
        </div>
      )}

      <div className="fx-row panel">
        <div>
          <span className="stat__label">USD/TRY</span>
          <span className="fx-row__value num">{fx.usdTry ? formatRate(fx.usdTry) : 'girilmedi'}</span>
          <span className="muted fx-row__meta">
            {fx.source === 'manual' ? 'elle girildi' : fx.asOf ? `${formatDate(fx.asOf)} kuru` : ''}
            {status.fxError && fx.source !== 'manual' ? ' (güncellenemedi, son bilinen kur)' : ''}
          </span>
        </div>
        <div className="page__actions">
          <button
            className="btn btn--sm btn--ghost"
            disabled={status.fxLoading}
            onClick={() => {
              if (settings.fxMode === 'manual') dispatch({ type: 'settings/update', patch: { fxMode: 'auto' } });
              void refreshFx();
            }}
          >
            <Icon name="refresh" size={16} className={status.fxLoading ? 'spin' : ''} /> Güncelle
          </button>
          <button className="btn btn--sm btn--ghost" onClick={() => setModal({ kind: 'fx' })}>
            <Icon name="edit" size={16} /> Elle gir
          </button>
        </div>
      </div>

      {S.rows.length === 0 ? (
        <div className="panel empty">
          <p>Takip etmek istediğiniz ABD hisselerini ekleyin: sembol, adet ve maliyet ya da yatırdığınız tutar yeterli.</p>
          <button className="btn btn--primary" onClick={() => setModal({ kind: 'edit' })}>
            <Icon name="plus" size={18} /> Hisse ekle
          </button>
        </div>
      ) : (
        <>
          <div className="panel us-summary">
            <div>
              <span className="stat__label">Portföy değeri</span>
              <span className="us-summary__value num">{usd(S.valueUsd)}</span>
              <span className="muted num">{S.valueTry != null ? `≈ ${tl(S.valueTry)}` : 'TL karşılığı için kur girin'}</span>
            </div>
            <dl className="kv">
              <div>
                <dt>Toplam maliyet</dt>
                <dd className="num">{usd(S.costUsd)}</dd>
              </div>
              <div>
                <dt>Toplam kâr/zarar</dt>
                <dd>
                  <Delta value={S.pnlUsd} pct={S.pnlPct} currency="USD" />
                </dd>
              </div>
              <div>
                <dt>Günlük değişim</dt>
                <dd>
                  <Delta value={S.dayChangeUsd} pct={S.dayChangePct} currency="USD" />
                </dd>
              </div>
            </dl>
          </div>

          <div className="panel holdings">
            <div className="holdings__head" aria-hidden="true">
              <span>Hisse</span>
              <span className="r">Fiyat</span>
              <span className="r">Değer</span>
              <span className="r">Kâr/zarar</span>
            </div>
            <ul className="rows">
              {S.rows.map((r) => {
                const h = r.holding;
                const err = status.symbolErrors[h.symbol];
                return (
                  <li key={h.id} className="holding">
                    <button className="holding__main" onClick={() => setModal({ kind: 'edit', holding: h })} aria-label={`${h.symbol} düzenle`}>
                      <span className="holding__sym">{h.symbol}</span>
                      <span className="holding__sub num">
                        {formatNumber(h.quantity, 6)} adet × {usd(h.avgCost)}
                      </span>
                    </button>
                    <button className="holding__price" onClick={() => setModal({ kind: 'price', symbol: h.symbol })} title="Fiyatı elle gir">
                      <span className="num strong">{usd(r.price)}</span>
                      <span className={`holding__tag${r.priceMissing || err ? ' is-warn' : ''}`}>
                        {r.priceMissing
                          ? 'fiyat yok, maliyet'
                          : r.dayChangePct != null
                            ? <span className={r.dayChangePct >= 0 ? 'is-pos' : 'is-neg'}>{formatPercent(r.dayChangePct, 2, true)}</span>
                            : r.quote?.source === 'manual'
                              ? 'elle'
                              : ''}
                        {r.quote && !r.priceMissing && (r.quote.source === 'manual' || now - r.quote.fetchedAt > 3_600_000) ? (
                          <span className="muted"> {r.quote.source === 'manual' ? 'elle, ' : ''}{formatAgo(r.quote.fetchedAt, now)}</span>
                        ) : null}
                      </span>
                    </button>
                    <span className="holding__value">
                      <span className="num strong">{usd(r.valueUsd)}</span>
                      <span className="num muted">{r.valueTry != null ? tl(r.valueTry, { decimals: 0 }) : '—'}</span>
                    </span>
                    <span className="holding__pnl">
                      {r.priceMissing ? (
                        <span className="muted">fiyat bekleniyor</span>
                      ) : (
                        <>
                          <Delta value={r.pnlUsd} currency="USD" />
                          <span className={`num ${r.pnlPct > 0.00005 ? 'is-pos' : r.pnlPct < -0.00005 ? 'is-neg' : ''}`}>{formatPercent(r.pnlPct, 2, true)}</span>
                          {r.pnlTry != null && <span className="num muted">TL bazında {tl(r.pnlTry, { signed: true, decimals: 0 })}</span>}
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="panel__foot muted">Hisseye dokunarak düzenleyin, satın veya silin; fiyata dokunarak elle fiyat girin.</p>
          </div>
        </>
      )}

      {modal?.kind === 'edit' && (
        <StockForm holding={modal.holding} onClose={() => setModal(null)} onSell={modal.holding ? () => setModal({ kind: 'sell', holding: modal.holding! }) : undefined} />
      )}
      {modal?.kind === 'price' && <ManualPriceForm symbol={modal.symbol} onClose={() => setModal(null)} />}
      {modal?.kind === 'sell' && <SellStockForm holding={modal.holding} onClose={() => setModal(null)} />}
      {modal?.kind === 'fx' && <FxForm onClose={() => setModal(null)} />}
    </section>
  );
}

export function FxForm({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [rate, setRate] = useState<number | null>(state.fx.usdTry);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      open
      size="sm"
      title="USD/TRY kurunu elle gir"
      onClose={onClose}
      onSubmit={() => {
        if (rate == null || !(rate > 0)) return setError('Sıfırdan büyük bir kur girin');
        dispatch({ type: 'fx/set', fx: { usdTry: rate, updatedAt: Date.now(), source: 'manual', asOf: null } });
        if (state.settings.fxMode === 'auto') dispatch({ type: 'settings/update', patch: { fxMode: 'manual' } });
        toast(`Kur ${formatRate(rate)} olarak kaydedildi; otomatik kur kapatıldı`, 'success');
        onClose();
      }}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button type="submit" className="btn btn--primary">
            Kuru kaydet
          </button>
        </>
      }
    >
      <NumberInput
        label="1 USD kaç TL"
        suffix="₺/$"
        maxDecimals={4}
        value={rate}
        onChange={(v) => {
          setRate(v);
          setError(null);
        }}
        error={error}
        autoFocus
        hint="Elle girilen kur, Ayarlar'dan otomatik kuru yeniden açana kadar kullanılır."
      />
    </Modal>
  );
}
