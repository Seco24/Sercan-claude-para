import { useState } from 'react';
import { ConfirmButton, DateInput, Field, NumberInput, Segmented, TextInput, Toggle } from '../../components/fields';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { daysBetween, formatDate } from '../../domain/dates';
import { formatPercent, round2, tl } from '../../domain/money';
import { annualRate, dailyRate, normalizedRates, ppfValueAt } from '../../domain/ppf';
import type { AccrualMode, PpfLot } from '../../domain/types';
import { useStore } from '../../state/store';

function modeOptions() {
  return [
    { value: 'simple' as AccrualMode, label: 'Basit (her gün eşit)' },
    { value: 'compound' as AccrualMode, label: 'Günlük bileşik' },
  ];
}

export function RateExplainer({ rate, mode, daysPerMonth }: { rate: number; mode: AccrualMode; daysPerMonth: number }) {
  if (!(rate > 0)) return null;
  const d = dailyRate(rate, mode, daysPerMonth);
  return (
    <span>
      Günlük {formatPercent(d, 4)} ({mode === 'simple' ? `aylık oran ÷ ${Math.round(daysPerMonth * 100) / 100} gün` : `(1 + aylık)^(1/${Math.round(daysPerMonth * 100) / 100}) − 1`}), yıllık{' '}
      {mode === 'simple' ? `${formatPercent(annualRate(rate, mode), 2)} basit` : `${formatPercent(annualRate(rate, mode), 2)} efektif`}
    </span>
  );
}

export function PpfLotForm({ lot, onClose }: { lot?: PpfLot; onClose: () => void }) {
  const { state, dispatch, today } = useStore();
  const toast = useToast();
  const { settings } = state;
  const rates = lot ? normalizedRates(lot) : [];
  const [name, setName] = useState(lot?.name ?? 'Para piyasası fonu');
  const [principal, setPrincipal] = useState<number | null>(lot?.principal ?? null);
  const [startDate, setStartDate] = useState(lot?.startDate ?? today);
  const [rate, setRate] = useState<number | null>(rates[0]?.monthlyRate ?? settings.ppfDefaultRate);
  const [mode, setMode] = useState<AccrualMode>(lot?.mode ?? settings.ppfDefaultMode);
  const [funded, setFunded] = useState(lot?.fundedFromCash ?? true);
  const [errors, setErrors] = useState<{ principal?: string; rate?: string }>({});

  const preview =
    principal && principal > 0 && rate != null
      ? ppfValueAt({ id: '', name, principal, startDate, mode, fundedFromCash: funded, rates: [{ from: startDate, monthlyRate: rate }, ...rates.slice(1)] }, today, settings.ppfDaysPerMonth)
      : null;

  const submit = () => {
    const e: typeof errors = {};
    if (principal == null || !(principal > 0)) e.principal = 'Sıfırdan büyük bir tutar girin';
    if (rate == null || rate < 0 || rate > 100) e.rate = '0 ile 100 arasında bir oran girin';
    setErrors(e);
    if (Object.keys(e).length) return;
    const data = {
      name: name.trim() || 'Para piyasası fonu',
      principal: round2(principal!),
      startDate,
      mode,
      fundedFromCash: funded,
      rates: [{ from: startDate, monthlyRate: rate! }, ...rates.slice(1).filter((r) => r.from > startDate)],
    };
    if (lot) dispatch({ type: 'ppf/update', lot: { ...lot, ...data } });
    else dispatch({ type: 'ppf/add', lot: data });
    toast(lot ? 'Fon güncellendi' : funded ? 'Fon eklendi, tutar nakitten aktarıldı' : 'Fon eklendi', 'success');
    onClose();
  };

  return (
    <Modal
      open
      title={lot ? 'Fon yatırımını düzenle' : 'Para piyasası fonu ekle'}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          {lot && (
            <ConfirmButton
              confirmText="Kayıt silinsin mi? Tekrar dokunun"
              onConfirm={() => {
                dispatch({ type: 'ppf/delete', id: lot.id });
                toast('Fon kaydı silindi');
                onClose();
              }}
            >
              Sil
            </ConfirmButton>
          )}
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button type="submit" className="btn btn--primary">
            {lot ? 'Kaydet' : 'Ekle'}
          </button>
        </>
      }
    >
      <TextInput label="Fon adı" value={name} onChange={setName} placeholder="örn. XYZ Para Piyasası Fonu" />
      <NumberInput label="Yatırılan tutar" currency="TRY" value={principal} onChange={setPrincipal} error={errors.principal} autoFocus={!lot} />
      <DateInput label="Yatırım (başlangıç) tarihi" value={startDate} onChange={setStartDate} hint={startDate < today ? `${daysBetween(startDate, today)} gün önce` : startDate > today ? 'İleri tarihli: getiri bu tarihte başlar' : 'Getiri yarından itibaren işler'} />
      <NumberInput
        label={lot && rates.length > 1 ? 'Başlangıç aylık getiri oranı' : 'Aylık getiri oranı'}
        suffix="%"
        maxDecimals={4}
        value={rate}
        onChange={setRate}
        error={errors.rate}
        hint={rate != null ? <RateExplainer rate={rate} mode={mode} daysPerMonth={settings.ppfDaysPerMonth} /> : undefined}
      />
      <Field label="Getiri hesaplama yöntemi">
        <Segmented label="Getiri hesaplama yöntemi" value={mode} onChange={setMode} options={modeOptions()} />
      </Field>
      <Toggle label="Nakitten aktar" checked={funded} onChange={setFunded} hint="Para başlangıç ana paranızın içinden çıktıysa açık bırakın, tutar nakitten düşülür. Bu para ayrıca vardıysa kapatın. Fonun bugünkü değeri her iki durumda da ana paraya eklenir." />
      {lot && rates.length > 1 && (
        <div className="callout">
          <strong>Oran geçmişi</strong>
          <ul className="rate-history">
            {rates.map((r, i) => (
              <li key={r.from}>
                <span>
                  {formatDate(r.from)} itibarıyla aylık {formatPercent(r.monthlyRate / 100, 2)}
                </span>
                {i > 0 && (
                  <button
                    type="button"
                    className="link link--danger"
                    onClick={() => {
                      dispatch({ type: 'ppf/removeRate', lotId: lot.id, from: r.from });
                      toast('Oran değişikliği kaldırıldı');
                      onClose();
                    }}
                  >
                    Kaldır
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {preview != null && (
        <p className="form-summary">
          Bugünkü bakiye: <strong className="num">{tl(preview)}</strong>
          {principal ? <span className="muted"> (getiri {tl(preview - principal)})</span> : null}
        </p>
      )}
    </Modal>
  );
}

export function PpfRateForm({ lotId, onClose }: { lotId?: string; onClose: () => void }) {
  const { state, dispatch, today } = useStore();
  const toast = useToast();
  const lots = state.ppfLots;
  const target = lots.find((l) => l.id === lotId);
  const [scope, setScope] = useState<'one' | 'all'>(target ? 'one' : 'all');
  const [rate, setRate] = useState<number | null>(target ? normalizedRates(target).at(-1)!.monthlyRate : state.settings.ppfDefaultRate);
  const [from, setFrom] = useState(today);
  const [alsoDefault, setAlsoDefault] = useState(!target);
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal
      open
      size="sm"
      title="Getiri oranını güncelle"
      onClose={onClose}
      onSubmit={() => {
        if (rate == null || rate < 0 || rate > 100) return setError('0 ile 100 arasında bir oran girin');
        const ids = scope === 'one' && target ? [target.id] : lots.map((l) => l.id);
        dispatch({ type: 'ppf/changeRate', lotIds: ids, from, monthlyRate: rate });
        if (alsoDefault) dispatch({ type: 'settings/update', patch: { ppfDefaultRate: rate } });
        toast(`Aylık oran ${formatPercent(rate / 100, 2)} olarak güncellendi`, 'success');
        onClose();
      }}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button type="submit" className="btn btn--primary">
            Oranı uygula
          </button>
        </>
      }
    >
      {target && lots.length > 1 && (
        <Segmented
          label="Kapsam"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'one', label: target.name },
            { value: 'all', label: `Tüm fonlar (${lots.length})` },
          ]}
        />
      )}
      <NumberInput
        label="Yeni aylık getiri oranı"
        suffix="%"
        maxDecimals={4}
        value={rate}
        onChange={(v) => {
          setRate(v);
          setError(null);
        }}
        error={error}
        autoFocus
        hint={rate != null ? <RateExplainer rate={rate} mode={target?.mode ?? state.settings.ppfDefaultMode} daysPerMonth={state.settings.ppfDaysPerMonth} /> : undefined}
      />
      <DateInput label="Geçerlilik tarihi" value={from} onChange={setFrom} hint="Bu tarihe kadar birikmiş getiri eski oranla korunur. Başlangıç tarihinden önce bir tarih seçerseniz oran baştan itibaren uygulanır." />
      <Toggle label="Yeni fonlar için varsayılan oran yap" checked={alsoDefault} onChange={setAlsoDefault} />
    </Modal>
  );
}

export function PpfCloseForm({ lot, onClose }: { lot: PpfLot; onClose: () => void }) {
  const { state, dispatch, today } = useStore();
  const toast = useToast();
  const [date, setDate] = useState(today);
  const computed = ppfValueAt(lot, date, state.settings.ppfDaysPerMonth);
  const [amount, setAmount] = useState<number | null>(round2(computed));
  const [touched, setTouched] = useState(false);
  const value = touched ? amount : round2(computed);
  const gain = (value ?? 0) - lot.principal;

  return (
    <Modal
      open
      size="sm"
      title={`${lot.name} bozdur`}
      onClose={onClose}
      onSubmit={() => {
        if (value == null || value < 0) return;
        dispatch({
          type: 'position/close',
          kind: 'ppf',
          id: lot.id,
          record: {
            label: lot.name,
            detail: `${Math.max(0, daysBetween(lot.startDate, date))} gün, aylık %${normalizedRates(lot).at(-1)!.monthlyRate}`,
            openedAt: lot.startDate,
            closedAt: date,
            costTry: lot.principal,
            proceedsTry: round2(value),
            fundedFromCash: lot.fundedFromCash,
          },
        });
        toast(`${tl(value)} ana paraya aktarıldı`, 'success');
        onClose();
      }}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button type="submit" className="btn btn--primary">
            Bozdur ve ana paraya aktar
          </button>
        </>
      }
    >
      <DateInput label="Bozdurma tarihi" value={date} onChange={setDate} min={lot.startDate} />
      <NumberInput
        label="Hesaba geçen tutar"
        currency="TRY"
        value={value}
        onChange={(v) => {
          setTouched(true);
          setAmount(v);
        }}
        hint={`Hesaplanan bakiye ${tl(computed)}. Fon gerçekte farklı ödediyse düzeltin.`}
      />
      <p className="form-summary">
        Anapara {tl(lot.principal)}, gerçekleşen getiri{' '}
        <strong className={`num ${gain >= 0 ? 'is-pos' : 'is-neg'}`}>{tl(gain, { signed: true })}</strong>
      </p>
    </Modal>
  );
}
