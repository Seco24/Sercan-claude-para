import { useState } from 'react';
import { ConfirmButton, DateInput, NumberInput, Segmented, TextInput } from '../../components/fields';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { round2 } from '../../domain/money';
import type { CapitalMovement, MovementType } from '../../domain/types';
import { useStore } from '../../state/store';

export function InitialCapitalForm({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [amount, setAmount] = useState<number | null>(state.capital.initial || null);
  const [date, setDate] = useState(state.capital.initialDate);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      open
      size="sm"
      title="Başlangıç ana parası"
      onClose={onClose}
      onSubmit={() => {
        if (amount == null || amount < 0) return setError('Geçerli bir tutar girin');
        dispatch({ type: 'capital/setInitial', amount: round2(amount), date });
        toast('Başlangıç ana parası güncellendi', 'success');
        onClose();
      }}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button type="submit" className="btn btn--primary">
            Kaydet
          </button>
        </>
      }
    >
      <NumberInput
        label="Tutar"
        currency="TRY"
        value={amount}
        onChange={(v) => {
          setAmount(v);
          setError(null);
        }}
        error={error}
        autoFocus
        hint="Takibe başladığınız andaki toplam nakit/likit paranız. Sonradan eklemeleri ayrı hareket olarak girin."
      />
      <DateInput label="Başlangıç tarihi" value={date} onChange={setDate} />
    </Modal>
  );
}

export function MovementForm({ movement, initialType = 'deposit', onClose }: { movement?: CapitalMovement; initialType?: MovementType; onClose: () => void }) {
  const { dispatch, today } = useStore();
  const toast = useToast();
  const [type, setType] = useState<MovementType>(movement?.type ?? initialType);
  const [amount, setAmount] = useState<number | null>(movement?.amount ?? null);
  const [date, setDate] = useState(movement?.date ?? today);
  const [note, setNote] = useState(movement?.note ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (amount == null || !(amount > 0)) return setError('Sıfırdan büyük bir tutar girin');
    const data = { type, amount: round2(amount), date, note: note.trim() };
    if (movement) dispatch({ type: 'capital/updateMovement', movement: { ...movement, ...data } });
    else dispatch({ type: 'capital/addMovement', movement: data });
    toast(type === 'deposit' ? 'Ana paraya eklendi' : 'Ana paradan çekildi', 'success');
    onClose();
  };

  return (
    <Modal
      open
      size="sm"
      title={movement ? 'Hareketi düzenle' : type === 'deposit' ? 'Ana paraya ekle' : 'Ana paradan çek'}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          {movement && (
            <ConfirmButton
              onConfirm={() => {
                dispatch({ type: 'capital/deleteMovement', id: movement.id });
                toast('Hareket silindi');
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
            {movement ? 'Kaydet' : type === 'deposit' ? 'Ekle' : 'Çek'}
          </button>
        </>
      }
    >
      <Segmented
        label="Hareket türü"
        value={type}
        onChange={setType}
        options={[
          { value: 'deposit', label: 'Ekleme (gelir)' },
          { value: 'withdraw', label: 'Çekme' },
        ]}
      />
      <NumberInput
        label="Tutar"
        currency="TRY"
        value={amount}
        onChange={(v) => {
          setAmount(v);
          setError(null);
        }}
        error={error}
        autoFocus={!movement}
      />
      <TextInput label="Not" value={note} onChange={setNote} placeholder={type === 'deposit' ? 'örn. Kasım maaşı' : 'örn. Başka hesaba transfer'} />
      <DateInput label="Tarih" value={date} onChange={setDate} />
    </Modal>
  );
}
