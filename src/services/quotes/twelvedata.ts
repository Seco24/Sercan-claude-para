import { HttpError, fetchJson } from '../http';
import type { QuoteFetchResult, QuoteProvider } from './types';

interface TdQuote {
  symbol?: string;
  close?: string;
  previous_close?: string;
  code?: number;
  status?: string;
  message?: string;
}

const BATCH = 8; // ücretsiz plan: dakikada 8 kredi (sembol başına 1 kredi)

function isError(x: TdQuote): boolean {
  return x.status === 'error' || typeof x.code === 'number';
}

/** Twelve Data — tek istekte çoklu sembol; ücretsiz planda 8 kredi/dakika, 800/gün. */
export const twelvedata: QuoteProvider = {
  id: 'twelvedata',
  label: 'Twelve Data',
  signupUrl: 'https://twelvedata.com/pricing',
  limits: 'Ücretsiz: 8 sembol/dakika, 800 kredi/gün',
  async fetchQuotes(symbols, apiKey, signal) {
    const out: QuoteFetchResult = { quotes: {}, errors: {} };
    for (let i = 0; i < symbols.length; i += BATCH) {
      if (i > 0) {
        // Bir sonraki parti dakikalık limite takılır; kalanlar bir sonraki yenilemede alınır.
        out.rateLimited = true;
        break;
      }
      const chunk = symbols.slice(i, i + BATCH);
      let body: unknown;
      try {
        body = await fetchJson(
          `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(chunk.join(','))}&apikey=${encodeURIComponent(apiKey)}`,
          { signal },
        );
      } catch (err) {
        if (err instanceof HttpError && err.status === 429) out.rateLimited = true;
        else if (err instanceof HttpError && (err.status === 401 || err.status === 403)) out.fatal = 'Twelve Data API anahtarı geçersiz';
        else out.fatal = err instanceof Error ? err.message : 'Bilinmeyen hata';
        break;
      }
      const b = body as TdQuote & Record<string, TdQuote>;
      if (isError(b) && !b.symbol) {
        if (b.code === 429) out.rateLimited = true;
        else if (b.code === 401 || b.code === 403) out.fatal = 'Twelve Data API anahtarı geçersiz veya yetkisiz';
        else out.fatal = b.message ?? 'Twelve Data hatası';
        break;
      }
      const entries: Array<[string, TdQuote]> = chunk.length === 1 ? [[chunk[0], b]] : chunk.map((s) => [s, b[s]]);
      for (const [sym, q] of entries) {
        if (!q || isError(q)) {
          if (q?.code === 429) out.rateLimited = true;
          out.errors[sym] = q?.message ?? 'Sembol bulunamadı';
          continue;
        }
        const price = parseFloat(q.close ?? '');
        const prev = parseFloat(q.previous_close ?? '');
        if (!(price > 0)) {
          out.errors[sym] = 'Fiyat yok';
          continue;
        }
        out.quotes[sym] = { price, prevClose: prev > 0 ? prev : null, fetchedAt: Date.now(), source: 'api', provider: 'Twelve Data' };
      }
    }
    return out;
  },
};
