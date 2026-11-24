import { HttpError, fetchJson, sleep } from '../http';
import type { QuoteFetchResult, QuoteProvider } from './types';

type AvResponse = {
  'Global Quote'?: Record<string, string>;
  Note?: string;
  Information?: string;
  'Error Message'?: string;
};

/** Alpha Vantage — ücretsiz planda günde 25 istek; az sayıda hisse için uygundur. */
export const alphavantage: QuoteProvider = {
  id: 'alphavantage',
  label: 'Alpha Vantage',
  signupUrl: 'https://www.alphavantage.co/support/#api-key',
  limits: 'Ücretsiz: 25 istek/gün (gün sonu verisi)',
  async fetchQuotes(symbols, apiKey, signal) {
    const out: QuoteFetchResult = { quotes: {}, errors: {} };
    for (let i = 0; i < symbols.length; i++) {
      const sym = symbols[i];
      if (i > 0) await sleep(1100); // saniyede 1 istek
      let body: AvResponse;
      try {
        body = await fetchJson<AvResponse>(
          `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(sym)}&apikey=${encodeURIComponent(apiKey)}`,
          { signal },
        );
      } catch (err) {
        if (err instanceof HttpError && err.status === 429) out.rateLimited = true;
        else out.fatal = err instanceof Error ? err.message : 'Bilinmeyen hata';
        break;
      }
      if (body.Note || body.Information) {
        const msg = body.Note ?? body.Information ?? '';
        if (/api key|apikey|demo/i.test(msg) && !/rate limit|requests per/i.test(msg)) out.fatal = 'Alpha Vantage API anahtarı geçersiz';
        else out.rateLimited = true;
        break;
      }
      if (body['Error Message']) {
        out.errors[sym] = 'Sembol bulunamadı';
        continue;
      }
      const q = body['Global Quote'] ?? {};
      const price = parseFloat(q['05. price'] ?? '');
      const prev = parseFloat(q['08. previous close'] ?? '');
      if (!(price > 0)) {
        out.errors[sym] = 'Sembol bulunamadı';
        continue;
      }
      out.quotes[sym] = { price, prevClose: prev > 0 ? prev : null, fetchedAt: Date.now(), source: 'api', provider: 'Alpha Vantage' };
    }
    return out;
  },
};
