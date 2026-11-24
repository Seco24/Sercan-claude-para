import type { ApiProviderId } from '../../domain/types';
import { alphavantage } from './alphavantage';
import { finnhub } from './finnhub';
import { twelvedata } from './twelvedata';
import type { QuoteProvider } from './types';

/**
 * Fiyat sağlayıcı kayıt defteri. Yeni bir sağlayıcı eklemek için `QuoteProvider`
 * arayüzünü uygulayan bir dosya yazıp buraya eklemek yeterlidir.
 */
export const PROVIDERS: Record<ApiProviderId, QuoteProvider> = { finnhub, twelvedata, alphavantage };

export type { QuoteFetchResult, QuoteProvider } from './types';
