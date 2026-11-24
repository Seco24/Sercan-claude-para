export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

/** Zaman aşımlı JSON isteği. Ağ hatası, zaman aşımı ve HTTP hatalarını anlaşılır mesajlara çevirir. */
export async function fetchJson<T = unknown>(url: string, opts: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException('timeout', 'TimeoutError')), opts.timeoutMs ?? 12_000);
  const onAbort = () => ctrl.abort(opts.signal?.reason);
  opts.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (!res.ok) throw new HttpError(res.status, `HTTP ${res.status}`, body);
    return body as T;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (ctrl.signal.aborted) {
      const reason = ctrl.signal.reason as DOMException | undefined;
      throw new Error(reason?.name === 'TimeoutError' ? 'Bağlantı zaman aşımına uğradı' : 'İstek iptal edildi');
    }
    throw new Error('Ağ bağlantısı kurulamadı (çevrimdışı olabilirsiniz)');
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
