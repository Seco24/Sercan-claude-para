import { useRef, useState } from 'react';
import { ConfirmButton, Field, NumberInput, Segmented, Toggle } from '../../components/fields';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { emptyState } from '../../domain/defaults';
import { formatAgo } from '../../domain/dates';
import { formatRate } from '../../domain/money';
import type { AccrualMode, ApiProviderId, Category, QuoteProviderId, ThemePref } from '../../domain/types';
import { PROVIDERS } from '../../services/quotes';
import { STORAGE_KEY, exportJson, importJson } from '../../services/storage';
import { useMarket } from '../../state/market';
import { useStore } from '../../state/store';
import { FxForm } from '../investments/StocksSection';

export function SettingsPage() {
  const { state, dispatch } = useStore();
  const { settings } = state;
  const set = (patch: Partial<typeof settings>) => dispatch({ type: 'settings/update', patch });

  return (
    <div className="page page--narrow">
      <header className="page__head">
        <div>
          <h1 className="page__title">Ayarlar</h1>
          <p className="page__sub">Tüm veriler yalnızca bu cihazda, tarayıcınızda saklanır</p>
        </div>
      </header>

      <section className="panel settings">
        <h2 className="panel__title">Görünüm</h2>
        <Field label="Tema">
          <Segmented<ThemePref>
            label="Tema"
            value={settings.theme}
            onChange={(theme) => set({ theme })}
            options={[
              { value: 'system', label: 'Sistem' },
              { value: 'light', label: 'Aydınlık' },
              { value: 'dark', label: 'Karanlık' },
            ]}
          />
        </Field>
      </section>

      <QuoteSettings />
      <FxSettings />

      <section className="panel settings">
        <h2 className="panel__title">Para piyasası fonu</h2>
        <NumberInput label="Varsayılan aylık getiri oranı" suffix="%" maxDecimals={4} value={settings.ppfDefaultRate} onChange={(v) => v != null && v >= 0 && set({ ppfDefaultRate: v })} hint="Yeni eklenen fonlar bu oranla başlar. Mevcut fonların oranını Yatırımlar bölümünden güncelleyin." />
        <Field label="Varsayılan getiri yöntemi">
          <Segmented<AccrualMode>
            label="Varsayılan getiri yöntemi"
            value={settings.ppfDefaultMode}
            onChange={(ppfDefaultMode) => set({ ppfDefaultMode })}
            options={[
              { value: 'simple', label: 'Basit (her gün eşit)' },
              { value: 'compound', label: 'Günlük bileşik' },
            ]}
          />
        </Field>
        <Field label="Aylık oranı günlüğe bölerken" hint="Tüm fonların hesaplamasını etkiler.">
          <Segmented<number>
            label="Ay gün sayısı"
            value={settings.ppfDaysPerMonth === 30 ? 30 : 365 / 12}
            onChange={(ppfDaysPerMonth) => set({ ppfDaysPerMonth })}
            options={[
              { value: 30, label: '30 gün' },
              { value: 365 / 12, label: '365 ÷ 12 gün' },
            ]}
          />
        </Field>
      </section>

      <CategorySettings />
      <DataSettings />
    </div>
  );
}

function QuoteSettings() {
  const { state, dispatch } = useStore();
  const { testProvider, refreshQuotes } = useMarket();
  const toast = useToast();
  const { settings } = state;
  const providerId = settings.quoteProvider;
  const provider = providerId === 'manual' ? null : PROVIDERS[providerId];
  const [draftKey, setDraftKey] = useState<Partial<Record<ApiProviderId, string>>>({});
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const keyValue = provider ? (draftKey[provider.id] ?? settings.apiKeys[provider.id] ?? '') : '';
  const saveKey = (id: ApiProviderId, key: string) => {
    dispatch({ type: 'settings/update', patch: { apiKeys: { ...settings.apiKeys, [id]: key.trim() || undefined } } });
  };

  return (
    <section className="panel settings">
      <h2 className="panel__title">Hisse fiyat verisi</h2>
      <Field label="Veri sağlayıcı">
        <Segmented<QuoteProviderId>
          label="Veri sağlayıcı"
          value={providerId}
          onChange={(quoteProvider) => {
            setResult(null);
            dispatch({ type: 'settings/update', patch: { quoteProvider } });
          }}
          options={[
            { value: 'finnhub', label: 'Finnhub' },
            { value: 'twelvedata', label: 'Twelve Data' },
            { value: 'alphavantage', label: 'Alpha Vantage' },
            { value: 'manual', label: 'Elle' },
          ]}
        />
      </Field>
      {provider ? (
        <>
          <p className="field__hint">
            {provider.limits}.{' '}
            <a href={provider.signupUrl} target="_blank" rel="noreferrer">
              Ücretsiz anahtar al
            </a>
          </p>
          <form
            className="key-form"
            onSubmit={async (e) => {
              e.preventDefault();
              saveKey(provider.id, keyValue);
              setDraftKey((d) => ({ ...d, [provider.id]: undefined }));
              if (!keyValue.trim()) {
                setResult(null);
                toast('API anahtarı kaldırıldı');
                return;
              }
              setTesting(true);
              const r = await testProvider(provider.id, keyValue);
              setTesting(false);
              setResult(r);
              if (r.ok) void refreshQuotes({ silent: true });
            }}
          >
            <Field label={`${provider.label} API anahtarı`} htmlFor="api-key">
              <div className="input-affix">
                <input
                  id="api-key"
                  className="input"
                  type={show ? 'text' : 'password'}
                  autoComplete="off"
                  spellCheck={false}
                  value={keyValue}
                  placeholder="Anahtarı yapıştırın"
                  onChange={(e) => setDraftKey((d) => ({ ...d, [provider.id]: e.target.value }))}
                />
                <button type="button" className="input-affix__btn" onClick={() => setShow((s) => !s)}>
                  {show ? 'Gizle' : 'Göster'}
                </button>
              </div>
            </Field>
            <button type="submit" className="btn btn--primary" disabled={testing}>
              {testing ? 'Deneniyor' : 'Kaydet ve bağlantıyı dene'}
            </button>
          </form>
          {result && (
            <p className={`result ${result.ok ? 'is-pos' : 'is-neg'}`}>
              <Icon name={result.ok ? 'check' : 'alert'} size={16} /> {result.message}
            </p>
          )}
          <p className="field__hint">Anahtar yalnızca bu tarayıcıda saklanır ve yedek dosyasına yazılmaz.</p>
        </>
      ) : (
        <p className="field__hint">Elle modda fiyatları Yatırımlar &gt; ABD borsası bölümünde hissenin fiyatına dokunarak girersiniz.</p>
      )}
      <Field label="Otomatik yenileme" hint="Yalnızca uygulama açık ve ekrandayken çalışır.">
        <Segmented<number>
          label="Otomatik yenileme"
          value={settings.autoRefreshMinutes}
          onChange={(autoRefreshMinutes) => dispatch({ type: 'settings/update', patch: { autoRefreshMinutes } })}
          options={[
            { value: 0, label: 'Kapalı' },
            { value: 1, label: '1 dk' },
            { value: 5, label: '5 dk' },
            { value: 15, label: '15 dk' },
            { value: 60, label: '1 sa' },
          ]}
        />
      </Field>
    </section>
  );
}

function FxSettings() {
  const { state, dispatch } = useStore();
  const { refreshFx, status } = useMarket();
  const [editing, setEditing] = useState(false);
  const { fx, settings } = state;
  return (
    <section className="panel settings">
      <h2 className="panel__title">USD/TRY kuru</h2>
      <Toggle
        label="Kuru otomatik al"
        checked={settings.fxMode === 'auto'}
        onChange={(on) => {
          dispatch({ type: 'settings/update', patch: { fxMode: on ? 'auto' : 'manual' } });
          if (on) void refreshFx();
        }}
        hint="Anahtarsız ücretsiz kaynaklar: Frankfurter (ECB), yedek olarak ExchangeRate-API. Günde bir kez güncellenir."
      />
      <div className="panel__row">
        <p>
          Güncel: <strong className="num">{fx.usdTry ? formatRate(fx.usdTry) : 'yok'}</strong>{' '}
          <span className="muted">
            {fx.source === 'manual' ? '(elle girildi)' : fx.updatedAt ? `(${formatAgo(fx.updatedAt)} alındı)` : ''}
          </span>
        </p>
        <div className="page__actions">
          {settings.fxMode === 'auto' && (
            <button className="btn btn--sm btn--ghost" onClick={() => refreshFx()} disabled={status.fxLoading}>
              <Icon name="refresh" size={16} className={status.fxLoading ? 'spin' : ''} /> Şimdi güncelle
            </button>
          )}
          <button className="btn btn--sm btn--ghost" onClick={() => setEditing(true)}>
            Elle gir
          </button>
        </div>
      </div>
      {status.fxError && <p className="result is-neg">{status.fxError}</p>}
      {editing && <FxForm onClose={() => setEditing(false)} />}
    </section>
  );
}

function CategorySettings() {
  const { state, dispatch } = useStore();
  const [emoji, setEmoji] = useState('🏷️');
  const [name, setName] = useState('');
  const used = new Set(state.expenses.map((e) => e.categoryId));

  const update = (c: Category, patch: Partial<Category>) => dispatch({ type: 'category/update', category: { ...c, ...patch } });

  return (
    <section className="panel settings">
      <h2 className="panel__title">Harcama kategorileri</h2>
      <ul className="cat-list">
        {state.categories.map((c) => (
          <li key={c.id}>
            <input className="input input--emoji" aria-label={`${c.name} simgesi`} value={c.emoji} maxLength={4} onChange={(e) => update(c, { emoji: e.target.value })} />
            <input className="input" aria-label="Kategori adı" value={c.name} maxLength={40} onChange={(e) => update(c, { name: e.target.value })} onBlur={(e) => !e.target.value.trim() && update(c, { name: 'Adsız' })} />
            <ConfirmButton className="icon-btn" confirmText="Sil?" onConfirm={() => dispatch({ type: 'category/delete', id: c.id })}>
              <Icon name="trash" size={18} />
              <span className="sr-only">{c.name} sil</span>
            </ConfirmButton>
          </li>
        ))}
      </ul>
      {[...used].some((id) => !state.categories.find((c) => c.id === id)) && (
        <p className="field__hint">Silinen kategorilerdeki harcamalar "Diğer" altında görünür.</p>
      )}
      <form
        className="cat-add"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          dispatch({ type: 'category/add', category: { name: name.trim(), emoji: emoji || '•' } });
          setName('');
        }}
      >
        <input className="input input--emoji" aria-label="Yeni kategori simgesi" value={emoji} maxLength={4} onChange={(e) => setEmoji(e.target.value)} />
        <input className="input" aria-label="Yeni kategori adı" placeholder="Yeni kategori" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn btn--ghost">
          <Icon name="plus" size={18} /> Ekle
        </button>
      </form>
    </section>
  );
}

function DataSettings() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  let bytes = 0;
  try {
    bytes = (localStorage.getItem(STORAGE_KEY) ?? '').length * 2;
  } catch {
    /* erişim yok */
  }

  const download = () => {
    const blob = new Blob([exportJson(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `para-defteri-yedek-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Yedek dosyası indirildi', 'success');
  };

  return (
    <section className="panel settings">
      <h2 className="panel__title">Veri ve yedekleme</h2>
      <p className="field__hint">
        Veriler bu tarayıcının yerel deposunda ({(bytes / 1024).toFixed(1)} KB) kalıcı olarak saklanır. Tarayıcı verilerini temizlerseniz veya başka bir cihaza geçerseniz yedek dosyasını kullanın.
      </p>
      <div className="btn-row">
        <button className="btn btn--ghost" onClick={download}>
          <Icon name="download" size={18} /> Yedeği indir (JSON)
        </button>
        <button className="btn btn--ghost" onClick={() => fileRef.current?.click()}>
          <Icon name="upload" size={18} /> Yedekten geri yükle
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            try {
              const next = importJson(await file.text(), state);
              if (!confirm('Mevcut verilerin yerini yedekteki veriler alacak. Devam edilsin mi?')) return;
              dispatch({ type: 'state/replace', state: next });
              toast('Yedek geri yüklendi', 'success');
            } catch (err) {
              toast(`Yedek okunamadı: ${err instanceof Error ? err.message : err}`, 'error');
            }
          }}
        />
      </div>
      <div className="danger-zone">
        <div>
          <strong>Tüm verileri sil</strong>
          <p className="field__hint">Ana para, harcamalar, yatırımlar ve ayarlar silinir. Geri alınamaz; önce yedek indirin.</p>
        </div>
        <ConfirmButton
          className="btn btn--danger"
          confirmText="Kalıcı olarak silinsin mi?"
          onConfirm={() => {
            const fresh = emptyState();
            fresh.settings = { ...fresh.settings, theme: state.settings.theme };
            dispatch({ type: 'state/replace', state: fresh });
            toast('Tüm veriler silindi');
          }}
        >
          Verileri sıfırla
        </ConfirmButton>
      </div>
    </section>
  );
}
