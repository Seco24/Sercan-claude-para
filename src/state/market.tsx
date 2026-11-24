import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useToast } from '../components/Toast';
import { usd } from '../domain/money';
import type { ApiProviderId } from '../domain/types';
import { fetchUsdTry } from '../services/fx';
import { PROVIDERS } from '../services/quotes';
import { useStore } from './store';

/**
 * Piyasa verisi katmanı: hisse fiyatları ve USD/TRY kuru.
 * - "Yenile" ile elle, ayarlanan aralıkla otomatik (sekme görünürken) güncellenir.
 * - Hata / istek limiti durumunda mevcut fiyatlar SİLİNMEZ; son bilinen fiyat ve zamanı gösterilir.
 * - Sağlayıcı "manuel" ise fiyatlar kullanıcı tarafından girilir.
 */

export interface MarketStatus {
  quotesLoading: boolean;
  quotesError: string | null;
  quotesNotice: string | null;
  quotesAt: number | null;
  symbolErrors: Record<string, string>;
  fxLoading: boolean;
  fxError: string | null;
}

interface MarketValue {
  status: MarketStatus;
  refreshQuotes: (opts?: { silent?: boolean }) => Promise<void>;
  refreshFx: (opts?: { silent?: boolean }) => Promise<void>;
  testProvider: (provider: ApiProviderId, key: string) => Promise<{ ok: boolean; message: string }>;
}

const MarketContext = createContext<MarketValue | null>(null);

const FX_STALE_MS = 6 * 60 * 60 * 1000;

export function MarketProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const stateRef = useRef(state);
  stateRef.current = state;
  const busy = useRef({ quotes: false, fx: false });
  const [status, setStatus] = useState<MarketStatus>({
    quotesLoading: false,
    quotesError: null,
    quotesNotice: null,
    quotesAt: null,
    symbolErrors: {},
    fxLoading: false,
    fxError: null,
  });

  const refreshQuotes = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      const s = stateRef.current;
      if (busy.current.quotes) return;
      const providerId = s.settings.quoteProvider;
      const symbols = [...new Set(s.holdings.map((h) => h.symbol))]
        // En eski fiyatı olanlar önce: limitli sağlayıcılarda sırayla hepsi güncellenir.
        .sort((a, b) => (s.quotes[a]?.fetchedAt ?? 0) - (s.quotes[b]?.fetchedAt ?? 0));
      if (symbols.length === 0) return;
      if (providerId === 'manual') {
        if (!silent) toast('Manuel fiyat modundasınız. Fiyatı değiştirmek için hissenin fiyatına dokunun.');
        return;
      }
      const key = s.settings.apiKeys[providerId]?.trim();
      if (!key) {
        const msg = `${PROVIDERS[providerId].label} API anahtarı girilmemiş. Ayarlar'dan ekleyin ya da fiyatları elle girin.`;
        setStatus((st) => ({ ...st, quotesError: msg }));
        if (!silent) toast(msg, 'error');
        return;
      }
      busy.current.quotes = true;
      setStatus((st) => ({ ...st, quotesLoading: true }));
      try {
        const res = await PROVIDERS[providerId].fetchQuotes(symbols, key);
        const got = Object.keys(res.quotes).length;
        if (got) dispatch({ type: 'quotes/merge', quotes: res.quotes });
        const failed = Object.keys(res.errors);
        let notice: string | null = null;
        if (res.rateLimited) notice = `İstek limitine ulaşıldı: ${got}/${symbols.length} hisse güncellendi, diğerlerinde son bilinen fiyat gösteriliyor.`;
        else if (failed.length) notice = `${failed.join(', ')} için fiyat alınamadı.`;
        setStatus((st) => ({
          ...st,
          quotesLoading: false,
          quotesError: res.fatal ?? null,
          quotesNotice: notice,
          quotesAt: got ? Date.now() : st.quotesAt,
          symbolErrors: res.errors,
        }));
        if (!silent) {
          if (res.fatal) toast(res.fatal, 'error');
          else if (notice) toast(notice, got ? 'info' : 'error');
          else toast(`${got} hissenin fiyatı güncellendi`, 'success');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Fiyatlar alınamadı';
        setStatus((st) => ({ ...st, quotesLoading: false, quotesError: msg }));
        if (!silent) toast(msg, 'error');
      } finally {
        busy.current.quotes = false;
      }
    },
    [dispatch, toast],
  );

  const refreshFx = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (busy.current.fx) return;
      busy.current.fx = true;
      setStatus((st) => ({ ...st, fxLoading: true }));
      try {
        const r = await fetchUsdTry();
        dispatch({ type: 'fx/set', fx: { usdTry: r.rate, updatedAt: Date.now(), source: 'api', asOf: r.asOf || null } });
        setStatus((st) => ({ ...st, fxLoading: false, fxError: null }));
        if (!silent) toast(`USD/TRY kuru güncellendi (${r.source})`, 'success');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Kur alınamadı';
        setStatus((st) => ({ ...st, fxLoading: false, fxError: msg }));
        if (!silent) toast(`${msg} Son bilinen kur kullanılıyor.`, 'error');
      } finally {
        busy.current.fx = false;
      }
    },
    [dispatch, toast],
  );

  const testProvider = useCallback(async (provider: ApiProviderId, key: string) => {
    try {
      const res = await PROVIDERS[provider].fetchQuotes(['AAPL'], key.trim());
      if (res.fatal) return { ok: false, message: res.fatal };
      if (res.rateLimited) return { ok: false, message: 'Anahtar çalışıyor olabilir ancak istek limitine takıldı. Biraz sonra tekrar deneyin.' };
      const q = res.quotes.AAPL;
      if (q) return { ok: true, message: `Bağlantı başarılı: AAPL ${usd(q.price)}` };
      return { ok: false, message: res.errors.AAPL ?? 'Yanıt alınamadı' };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Bağlantı hatası' };
    }
  }, []);

  // Açılışta: kur ve fiyatlar eskiyse sessizce güncelle.
  const { settings, holdings } = state;
  useEffect(() => {
    const s = stateRef.current;
    if (s.settings.fxMode === 'auto' && (!s.fx.updatedAt || Date.now() - s.fx.updatedAt > FX_STALE_MS || s.fx.source !== 'api')) {
      void refreshFx({ silent: true });
    }
  }, [settings.fxMode, refreshFx]);

  const holdingKey = holdings.map((h) => h.symbol).sort().join(',');
  useEffect(() => {
    if (!holdingKey) return;
    const s = stateRef.current;
    const intervalMs = Math.max(1, s.settings.autoRefreshMinutes || 15) * 60_000;
    const stale = s.holdings.some((h) => {
      const q = s.quotes[h.symbol];
      return !q || (q.source === 'api' && Date.now() - q.fetchedAt > intervalMs);
    });
    if (stale) void refreshQuotes({ silent: true });
  }, [holdingKey, settings.quoteProvider, settings.apiKeys, refreshQuotes, settings.autoRefreshMinutes]);

  // Otomatik yenileme döngüsü (yalnızca sekme görünürken).
  useEffect(() => {
    const minutes = settings.autoRefreshMinutes;
    if (!minutes || !holdingKey) return;
    const tick = () => {
      if (document.visibilityState === 'visible') {
        void refreshQuotes({ silent: true });
        if (stateRef.current.settings.fxMode === 'auto' && Date.now() - (stateRef.current.fx.updatedAt ?? 0) > FX_STALE_MS) {
          void refreshFx({ silent: true });
        }
      }
    };
    const id = window.setInterval(tick, minutes * 60_000);
    const onVisible = () => {
      const s = stateRef.current;
      const oldest = Math.min(...s.holdings.map((h) => s.quotes[h.symbol]?.fetchedAt ?? 0));
      if (document.visibilityState === 'visible' && Date.now() - oldest > minutes * 60_000) tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [settings.autoRefreshMinutes, holdingKey, refreshQuotes, refreshFx]);

  const value = useMemo(() => ({ status, refreshQuotes, refreshFx, testProvider }), [status, refreshQuotes, refreshFx, testProvider]);
  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket(): MarketValue {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error('useMarket, MarketProvider içinde kullanılmalı');
  return ctx;
}
