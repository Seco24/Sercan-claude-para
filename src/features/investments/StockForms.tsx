import { useState } from 'react';
import { ConfirmButton, DateInput, Field, NumberInput, Segmented, TextInput, Toggle } from '../../components/fields';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { formatTimestamp } from '../../domain/dates';
import { formatNumber, formatRate, round2, tl, usd } from '../../domain/money';
import { holdingCashCost, normalizeSymbol } from '../../domain/stocks';
import type { StockHolding } from '../../domain/types';
import { useStore } from '../../state/store';

export function StockForm({ holding, onClose, onSell }: { holding?: StockHolding; onClose: () => void; onSell?: () => void }) {
  const { state, dispatch, today } = useStore();
  const toast = useToast();
  const fx = state.fx.usdTry;
  const [symbol, setSymbol] = useState(holding?.symbol ?? '');
  const [inputMode, setInputMode] = useState<'qty' | 'amount'>('qty');
  const [quantity, setQuantity] = useState<number | null>(holding?.quantity ?? null);
  const [avgCost, setAvgCost] = useState<number | null>(holding?.avgCost ?? null);
  const [amountUsd, setAmountUsd] = useState<number | null>(holding ? round2(holding.quantity * holding.avgCost) : null);
  const [buyDate, setBuyDate] = useState(holding?.buyDate ?? today);
  const [funded, setFunded] = useState(holding?.fundedFromCash ?? true);
  const [fxAtPurchase, setFxAtPurchase] = useState<number | null>(holding?.fxAtPurchase ?? fx);
  const [note, setNote] = useState(holding?.note ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const qty = inputMode === 'qty' ? quantity : amountUsd && avgCost ? amountUsd / avgCost : null;
  const costUsd = qty != null && avgCost != null ? qty * avgCost : null;
  const knownSymbols = Object.keys(state.quotes);

  const submit = () => {
    const e: Record<string, string> = {};
    const sym = normalizeSymbol(symbol);
    if (!/^[A-Z0-9.\-^=]{1,12}$/.test(sym)) e.symbol = 'Geçerli bir sembol girin (örn. AAPL, MSFT, BRK.B)';
    if (avgCost == null || !(avgCost > 0)) e.avgCost = 'Sıfırdan büyük bir fiyat girin';
    if (inputMode === 'qty' && (quantity == null || !(quantity > 0))) e.quantity = 'Sıfırdan büyük bir adet girin';
    if (inputMode === 'amount' && (amountUsd == null || !(amountUsd > 0))) e.amountUsd = 'Sıfırdan büyük bir tutar girin';
    if (funded && (fxAtPurchase == null || !(fxAtPurchase > 0))) e.fx = 'Ana paradan düşülecek TL tutar için alış kurunu girin';
    setErrors(e);
    if (Object.keys(e).length) return;
    const data = {
      symbol: sym,
      quantity: Math.round(qty! * 1e6) / 1e6,
      avgCost: avgCost!,
      buyDate,
      fundedFromCash: funded,
      fxAtPurchase: fxAtPurchase && fxAtPurchase > 0 ? fxAtPurchase : null,
      note: note.trim(),
    };
    if (holding) dispatch({ type: 'stock/update', holding: { ...holding, ...data } });
    else dispatch({ type: 'stock/add', holding: data });
    toast(holding ? `${sym} güncellendi` : `${sym} portföye eklendi`, 'success');
    onClose();
  };

  const cashCost = costUsd != null ? holdingCashCost({ quantity: qty!, avgCost: avgCost!, fundedFromCash: funded, fxAtPurchase } as StockHolding, fx) : 0;

  return (
    <Modal
      open
      title={holding ? `${holding.symbol} düzenle` : 'Hisse ekle'}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          {holding && (
            <ConfirmButton
              confirmText="Silinsin mi? Tekrar dokunun"
              onConfirm={() => {
                dispatch({ type: 'stock/delete', id: holding.id });
                toast(`${holding.symbol} silindi`);
                onClose();
              }}
            >
              Sil
            </ConfirmButton>
          )}
          {holding && onSell && (
            <button type="button" className="btn btn--ghost" onClick={onSell}>
              Sat
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button type="submit" className="btn btn--primary">
            {holding ? 'Kaydet' : 'Ekle'}
          </button>
        </>
      }
    >
      <TextInput label="Sembol" value={symbol} onChange={(v) => setSymbol(v.toUpperCase())} placeholder="örn. AAPL" error={errors.symbol} list="known-symbols" maxLength={12} autoFocus={!holding} />
      <datalist id="known-symbols">
        {knownSymbols.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <Field label="Giriş şekli">
        <Segmented
          label="Giriş şekli"
          value={inputMode}
          onChange={setInputMode}
          options={[
            { value: 'qty', label: 'Adet ve maliyet' },
            { value: 'amount', label: 'Tutar ve alış fiyatı' },
          ]}
        />
      </Field>
      <div className="form-grid">
        {inputMode === 'qty' ? (
          <NumberInput label="Adet" suffix="adet" value={quantity} onChange={setQuantity} error={errors.quantity} />
        ) : (
          <NumberInput label="Yatırılan tutar" currency="USD" value={amountUsd} onChange={setAmountUsd} error={errors.amountUsd} />
        )}
        <NumberInput label={inputMode === 'qty' ? 'Ortalama maliyet (hisse başı)' : 'Alış fiyatı (hisse başı)'} currency="USD" value={avgCost} onChange={setAvgCost} error={errors.avgCost} />
      </div>
      {inputMode === 'amount' && qty != null && <p className="field__hint">≈ {formatNumber(qty, 6)} adet (kesirli hisse)</p>}
      <DateInput label="Alış tarihi" value={buyDate} onChange={setBuyDate} />
      <Toggle label="Ana paradan (likiditeden) aktar" checked={funded} onChange={setFunded} hint="Açıkken maliyetin TL karşılığı kalan likiditeden düşülür." />
      <NumberInput
        label="Alış anındaki USD/TRY kuru"
        suffix="₺/$"
        maxDecimals={4}
        value={fxAtPurchase}
        onChange={setFxAtPurchase}
        error={errors.fx}
        hint={funded ? 'TL maliyet ve kur farkı dahil kâr/zarar için kullanılır' : 'İsteğe bağlı: TL bazlı kâr/zarar için'}
      />
      <TextInput label="Not" value={note} onChange={setNote} placeholder="İsteğe bağlı" />
      {costUsd != null && costUsd > 0 && (
        <p className="form-summary">
          Toplam maliyet <strong className="num">{usd(costUsd)}</strong>
          {fxAtPurchase ? <span className="num"> ≈ {tl(costUsd * fxAtPurchase)}</span> : null}
          {funded && cashCost > 0 ? <span className="muted">, likiditeden {tl(cashCost)} düşülür</span> : null}
        </p>
      )}
    </Modal>
  );
}

export function ManualPriceForm({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const q = state.quotes[symbol];
  const [price, setPrice] = useState<number | null>(q?.price ?? null);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      open
      size="sm"
      title={`${symbol} fiyatını elle gir`}
      onClose={onClose}
      onSubmit={() => {
        if (price == null || !(price > 0)) return setError('Sıfırdan büyük bir fiyat girin');
        dispatch({ type: 'quotes/setManual', symbol, price });
        toast(`${symbol} fiyatı ${usd(price)} olarak kaydedildi`, 'success');
        onClose();
      }}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button type="submit" className="btn btn--primary">
            Fiyatı kaydet
          </button>
        </>
      }
    >
      <NumberInput
        label="Güncel fiyat (hisse başı)"
        currency="USD"
        value={price}
        onChange={(v) => {
          setPrice(v);
          setError(null);
        }}
        error={error}
        autoFocus
        hint={q ? `Son bilinen: ${usd(q.price)}, ${formatTimestamp(q.fetchedAt)} (${q.source === 'manual' ? 'elle' : q.provider ?? 'API'})` : 'Bu hisse için henüz fiyat yok'}
      />
      <p className="field__hint">Bir sonraki başarılı API güncellemesinde bu fiyatın yerine canlı fiyat gelir.</p>
    </Modal>
  );
}

export function SellStockForm({ holding, onClose }: { holding: StockHolding; onClose: () => void }) {
  const { state, dispatch, today } = useStore();
  const toast = useToast();
  const [price, setPrice] = useState<number | null>(state.quotes[holding.symbol]?.price ?? holding.avgCost);
  const [rate, setRate] = useState<number | null>(state.fx.usdTry ?? holding.fxAtPurchase);
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const proceedsUsd = price ? holding.quantity * price : 0;
  const proceedsTry = rate ? proceedsUsd * rate : 0;
  const costTry = holding.fundedFromCash ? holdingCashCost(holding, rate) : holding.quantity * holding.avgCost * (holding.fxAtPurchase ?? rate ?? 0);
  const pnl = proceedsTry - costTry;

  return (
    <Modal
      open
      size="sm"
      title={`${holding.symbol} sat`}
      onClose={onClose}
      onSubmit={() => {
        if (!price || !(price > 0) || !rate || !(rate > 0)) return setError('Satış fiyatı ve kur gerekli');
        dispatch({
          type: 'position/close',
          kind: 'stock',
          id: holding.id,
          record: {
            label: holding.symbol,
            detail: `${formatNumber(holding.quantity, 6)} adet, ${usd(holding.avgCost)} → ${usd(price)}, kur ${formatRate(rate)}`,
            openedAt: holding.buyDate,
            closedAt: date,
            costTry: round2(costTry),
            proceedsTry: round2(proceedsTry),
            fundedFromCash: holding.fundedFromCash,
          },
        });
        toast(`${holding.symbol} satıldı, ${tl(proceedsTry)} ana paraya aktarıldı`, 'success');
        onClose();
      }}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button type="submit" className="btn btn--primary">
            Sat ve ana paraya aktar
          </button>
        </>
      }
    >
      <p className="field__hint">Pozisyonun tamamı ({formatNumber(holding.quantity, 6)} adet) satılır. Kısmi satış için önce adedi düzenleyin.</p>
      <div className="form-grid">
        <NumberInput label="Satış fiyatı" currency="USD" value={price} onChange={setPrice} error={error} />
        <NumberInput label="USD/TRY kuru" suffix="₺/$" maxDecimals={4} value={rate} onChange={setRate} />
      </div>
      <DateInput label="Satış tarihi" value={date} onChange={setDate} />
      <p className="form-summary">
        Satış tutarı <strong className="num">{usd(proceedsUsd)}</strong> ≈ <strong className="num">{tl(proceedsTry)}</strong>
        <br />
        TL bazında kâr/zarar <strong className={`num ${pnl >= 0 ? 'is-pos' : 'is-neg'}`}>{tl(pnl, { signed: true })}</strong>
      </p>
    </Modal>
  );
}
