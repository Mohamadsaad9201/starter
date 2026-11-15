export class HttpError extends Error {
  constructor(public status: number, public url: string, public body: string) {
    super(`HTTP ${status} from ${new URL(url).host}: ${body.slice(0, 500)}`);
  }
}

export async function fetchJson<T = any>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    signal: init.signal ?? AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  if (!res.ok) throw new HttpError(res.status, url, text);
  return (text ? JSON.parse(text) : {}) as T;
}

/** Wrap a tool body so integration errors come back to the model as text instead of crashing the run. */
export async function safe(fn: () => Promise<unknown>): Promise<string> {
  try {
    const out = await fn();
    return typeof out === "string" ? out : JSON.stringify(out);
  } catch (err) {
    return `ERROR (treat this data source as MISSING): ${err instanceof Error ? err.message : String(err)}`;
  }
}
