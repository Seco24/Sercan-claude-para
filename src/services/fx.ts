import { fetchJson } from './http';

export interface FxResult {
  rate: number;
  asOf: string;
  source: string;
}

/**
 * USD/TRY kuru — anahtar gerektirmeyen iki ücretsiz kaynak, sırayla denenir:
 *  1) Frankfurter (Avrupa Merkez Bankası referans kurları, iş günü güncellenir)
 *  2) open.er-api.com (ExchangeRate-API, günlük güncellenir)
 */
export async function fetchUsdTry(signal?: AbortSignal): Promise<FxResult> {
  const errors: string[] = [];
  try {
    const r = await fetchJson<{ date?: string; rates?: { TRY?: number } }>(
      'https://api.frankfurter.dev/v1/latest?base=USD&symbols=TRY',
      { signal, timeoutMs: 8000 },
    );
    if (r.rates?.TRY && r.rates.TRY > 0) return { rate: r.rates.TRY, asOf: r.date ?? '', source: 'Frankfurter (ECB)' };
    errors.push('Frankfurter: kur yok');
  } catch (e) {
    errors.push(`Frankfurter: ${e instanceof Error ? e.message : e}`);
  }
  try {
    const r = await fetchJson<{ result?: string; rates?: { TRY?: number }; time_last_update_utc?: string }>(
      'https://open.er-api.com/v6/latest/USD',
      { signal, timeoutMs: 8000 },
    );
    if (r.result === 'success' && r.rates?.TRY && r.rates.TRY > 0) {
      const asOf = r.time_last_update_utc ? new Date(r.time_last_update_utc).toISOString().slice(0, 10) : '';
      return { rate: r.rates.TRY, asOf, source: 'ExchangeRate-API' };
    }
    errors.push('ExchangeRate-API: kur yok');
  } catch (e) {
    errors.push(`ExchangeRate-API: ${e instanceof Error ? e.message : e}`);
  }
  throw new Error(`Kur alınamadı. ${errors.join(' · ')}`);
}
