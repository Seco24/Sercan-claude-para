import { useState } from 'react';
import { ConfirmButton, DateInput, Field, NumberInput, TextInput } from '../../components/fields';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { round2 } from '../../domain/money';
import type { Expense } from '../../domain/types';
import { useStore } from '../../state/store';

export interface ExpenseDraft {
  expense?: Expense;
  date?: string;
}

export function ExpenseForm({ draft, onClose }: { draft: ExpenseDraft; onClose: () => void }) {
  const { state, dispatch, today } = useStore();
  const toast = useToast();
  const editing = draft.expense;
  const [amount, setAmount] = useState<number | null>(editing?.amount ?? null);
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? state.categories[0]?.id ?? 'diger');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [date, setDate] = useState(editing?.date ?? draft.date ?? today);
  const [error, setError] = useState<string | null>(null);

  // Son kullanılan açıklamalar (hızlı giriş için öneri)
  const suggestions = [...new Set(state.expenses.slice(-60).map((e) => e.description).filter(Boolean))].slice(-20);

  const submit = () => {
    if (amount == null || !(amount > 0)) {
      setError('Sıfırdan büyük bir tutar girin');
      return;
    }
    const data = { amount: round2(amount), categoryId, description: description.trim(), date };
    if (editing) {
      dispatch({ type: 'expense/update', expense: { ...editing, ...data } });
      toast('Harcama güncellendi', 'success');
    } else {
      dispatch({ type: 'expense/add', expense: data });
      toast('Harcama eklendi, ana paradan düşüldü', 'success');
    }
    onClose();
  };

  return (
    <Modal
      open
      title={editing ? 'Harcamayı düzenle' : 'Harcama ekle'}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          {editing && (
            <ConfirmButton
              onConfirm={() => {
                dispatch({ type: 'expense/delete', id: editing.id });
                toast('Harcama silindi, tutar ana paraya geri eklendi');
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
            {editing ? 'Kaydet' : 'Ekle'}
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
        autoFocus={!editing}
      />
      <Field label="Kategori">
        <div className="chips" role="radiogroup" aria-label="Kategori">
          {state.categories.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={categoryId === c.id}
              className="chip"
              onClick={() => setCategoryId(c.id)}
            >
              <span aria-hidden="true">{c.emoji}</span> {c.name}
            </button>
          ))}
        </div>
      </Field>
      <TextInput label="Açıklama" value={description} onChange={setDescription} placeholder="örn. Haftalık market alışverişi" list="expense-suggestions" />
      <datalist id="expense-suggestions">
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <DateInput label="Tarih" value={date} onChange={setDate} />
    </Modal>
  );
}
