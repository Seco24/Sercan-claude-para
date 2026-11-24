import type { ApiProviderId, Quote } from '../../domain/types';

export interface QuoteFetchResult {
  quotes: Record<string, Quote>;
  /** Sembol bazlı hatalar (ör. sembol bulunamadı) */
  errors: Record<string, string>;
  /** Tüm isteği durduran hata (geçersiz anahtar vb.) */
  fatal?: string;
  /** Sağlayıcı istek limitine takıldı; kalan semboller için son bilinen fiyat korunur */
  rateLimited?: boolean;
}

export interface QuoteProvider {
  id: ApiProviderId;
  label: string;
  /** Ücretsiz anahtar alma sayfası */
  signupUrl: string;
  limits: string;
  fetchQuotes(symbols: string[], apiKey: string, signal?: AbortSignal): Promise<QuoteFetchResult>;
}
