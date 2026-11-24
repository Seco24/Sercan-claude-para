import { HttpError, fetchJson, sleep } from '../http';
import type { QuoteFetchResult, QuoteProvider } from './types';

interface FinnhubQuote {
  c: number; // güncel
  d: number | null;
  dp: number | null;
  pc: number; // önceki kapanış
  t: number;
}

/** Finnhub — ücretsiz planda dakikada 60 istek, ABD hisseleri için gerçek zamanlı fiyat. */
export const finnhub: QuoteProvider = {
  id: 'finnhub',
  label: 'Finnhub',
  signupUrl: 'https://finnhub.io/register',
  limits: 'Ücretsiz: 60 istek/dakika, ABD hisseleri anlık',
  async fetchQuotes(symbols, apiKey, signal) {
    const out: QuoteFetchResult = { quotes: {}, errors: {} };
    for (let i = 0; i < symbols.length; i++) {
      const sym = symbols[i];
      if (i > 0) await sleep(120); // saniyede 30 istek sınırının altında kal
      try {
        const q = await fetchJson<FinnhubQuote>(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${encodeURIComponent(apiKey)}`,
          { signal },
        );
        if (!q || typeof q.c !== 'number' || q.c <= 0) {
          out.errors[sym] = 'Sembol bulunamadı veya fiyat yok';
          continue;
        }
        out.quotes[sym] = { price: q.c, prevClose: q.pc > 0 ? q.pc : null, fetchedAt: Date.now(), source: 'api', provider: 'Finnhub' };
      } catch (err) {
        if (err instanceof HttpError && err.status === 429) {
          out.rateLimited = true;
          break;
        }
        if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
          out.fatal = 'Finnhub API anahtarı geçersiz veya bu veriye erişimi yok';
          break;
        }
        out.errors[sym] = err instanceof Error ? err.message : 'Bilinmeyen hata';
        if (!(err instanceof HttpError)) break; // ağ hatası: diğer sembolleri denemeye gerek yok
      }
    }
    return out;
  },
};
