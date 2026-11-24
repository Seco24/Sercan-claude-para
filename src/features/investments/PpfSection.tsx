import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { formatDate } from '../../domain/dates';
import { formatPercent, tl } from '../../domain/money';
import { annualRate, dailyRate } from '../../domain/ppf';
import type { PpfLot } from '../../domain/types';
import { useStore } from '../../state/store';
import { PpfCloseForm, PpfLotForm, PpfRateForm } from './PpfForms';

type ModalState = { kind: 'lot'; lot?: PpfLot } | { kind: 'rate'; lotId?: string } | { kind: 'close'; lot: PpfLot } | null;

export function PpfSection() {
  const { state, ledger } = useStore();
  const [modal, setModal] = useState<ModalState>(null);
  const P = ledger.ppf;
  const dpm = state.settings.ppfDaysPerMonth;
  const rates = [...new Set(P.lots.map((d) => d.currentRate))];
  const modes = [...new Set(P.lots.map((d) => d.lot.mode))];
  const headlineRate = rates.length === 1 ? rates[0] : state.settings.ppfDefaultRate;
  const headlineMode = modes.length === 1 ? modes[0] : state.settings.ppfDefaultMode;

  return (
    <section aria-labelledby="ppf-title" className="stack">
      <div className="section-head">
        <div>
          <h2 id="ppf-title" className="section-title">
            Para piyasası fonu
          </h2>
          <p className="page__sub">
            Aylık {formatPercent(headlineRate / 100, 2)} getiri{rates.length > 1 ? ' (fonlara göre farklı oranlar var)' : ''}, günlük işler
          </p>
        </div>
        <div className="page__actions">
          {P.lots.length > 0 && (
            <button className="btn btn--ghost btn--sm" onClick={() => setModal({ kind: 'rate' })}>
              <Icon name="edit" size={16} /> Oranı güncelle
            </button>
          )}
          <button className="btn btn--primary btn--sm" onClick={() => setModal({ kind: 'lot' })}>
            <Icon name="plus" size={16} /> Fon ekle
          </button>
        </div>
      </div>

      {P.lots.length === 0 ? (
        <div className="panel empty">
          <p>Henüz para piyasası fonu eklenmedi. Tutarı ve yatırım tarihini girin; birikmiş getiri ve güncel bakiye her gün otomatik hesaplanır.</p>
          <button className="btn btn--primary" onClick={() => setModal({ kind: 'lot' })}>
            <Icon name="plus" size={18} /> Fon ekle
          </button>
        </div>
      ) : (
        <>
          <div className="panel ppf-hero">
            <div className="ppf-hero__main">
              <span className="stat__label">Güncel fon bakiyesi</span>
              <span className="ppf-hero__value num">{tl(P.value)}</span>
              <span className="ppf-hero__today">
                <span className="is-pos num">{tl(P.todayGain, { signed: true })}</span> bugün eklendi, yarın{' '}
                <span className="num">{tl(P.nextDayGain, { signed: true })}</span> daha
              </span>
            </div>
            <dl className="kv">
              <div>
                <dt>Yatırılan anapara</dt>
                <dd className="num">{tl(P.principal)}</dd>
              </div>
              <div>
                <dt>Birikmiş getiri</dt>
                <dd className="num is-pos">{tl(P.accrued, { signed: true })}</dd>
              </div>
              <div>
                <dt>Günlük oran</dt>
                <dd className="num">
                  {formatPercent(dailyRate(headlineRate, headlineMode, dpm), 4)}
                  <span className="kv__sub">
                    aylık {formatPercent(headlineRate / 100, 2)} {headlineMode === 'simple' ? `÷ ${Math.round(dpm * 100) / 100} gün` : 'günlük bileşik'}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          <div className="panel">
            <h3 className="panel__title">Getiri projeksiyonu</h3>
            <p className="panel__sub">Bugünkü oranlar sabit kalırsa</p>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Süre</th>
                  <th scope="col">Tarih</th>
                  <th scope="col" className="r">
                    Bakiye
                  </th>
                  <th scope="col" className="r">
                    Ek getiri
                  </th>
                </tr>
              </thead>
              <tbody>
                {P.projections.map((p) => (
                  <tr key={p.label}>
                    <td>{p.label}</td>
                    <td className="muted">{formatDate(p.date)}</td>
                    <td className="r num">{tl(p.value)}</td>
                    <td className="r num is-pos">{tl(p.gain, { signed: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="lots">
            {P.lots.map((d) => (
              <li key={d.lot.id} className="panel lot">
                <div className="lot__head">
                  <div>
                    <h3 className="lot__name">{d.lot.name}</h3>
                    <p className="lot__meta">
                      {formatDate(d.lot.startDate)} başlangıç, {d.started ? `${d.daysElapsed} gündür işliyor` : 'getiri yarın başlar'}
                      {d.lot.fundedFromCash ? '' : ', dışarıdan'}
                    </p>
                  </div>
                  <span className="badge">
                    aylık {formatPercent(d.currentRate / 100, 2)} {d.lot.mode === 'simple' ? 'basit' : 'bileşik'}
                  </span>
                </div>
                <dl className="kv kv--4">
                  <div>
                    <dt>Anapara</dt>
                    <dd className="num">{tl(d.lot.principal)}</dd>
                  </div>
                  <div>
                    <dt>Birikmiş getiri</dt>
                    <dd className="num is-pos">{tl(d.accrued, { signed: true })}</dd>
                  </div>
                  <div>
                    <dt>Bugünkü artış</dt>
                    <dd className="num">{tl(d.todayGain, { signed: true })}</dd>
                  </div>
                  <div>
                    <dt>Güncel bakiye</dt>
                    <dd className="num strong">{tl(d.value)}</dd>
                  </div>
                </dl>
                <p className="lot__detail muted">
                  Günlük {formatPercent(d.dailyRate, 4)}, yıllık {formatPercent(annualRate(d.currentRate, d.lot.mode), 2)} {d.lot.mode === 'simple' ? 'basit' : 'efektif'}; yarın {tl(d.tomorrowValue)}
                </p>
                <div className="lot__actions">
                  <button className="btn btn--sm btn--ghost" onClick={() => setModal({ kind: 'lot', lot: d.lot })}>
                    <Icon name="edit" size={16} /> Düzenle
                  </button>
                  <button className="btn btn--sm btn--ghost" onClick={() => setModal({ kind: 'rate', lotId: d.lot.id })}>
                    Oranı değiştir
                  </button>
                  <button className="btn btn--sm btn--ghost" onClick={() => setModal({ kind: 'close', lot: d.lot })}>
                    <Icon name="sell" size={16} /> Bozdur
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {modal?.kind === 'lot' && <PpfLotForm lot={modal.lot} onClose={() => setModal(null)} />}
      {modal?.kind === 'rate' && <PpfRateForm lotId={modal.lotId} onClose={() => setModal(null)} />}
      {modal?.kind === 'close' && <PpfCloseForm lot={modal.lot} onClose={() => setModal(null)} />}
    </section>
  );
}
