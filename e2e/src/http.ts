import { Agent, setGlobalDispatcher } from 'undici';

/**
 * One bounded keep-alive agent for every `fetch` of the e2e suites (vitest setupFile). Without it Node's default dispatcher opens connections on
 * demand and a sweep that does not read response bodies keeps every socket busy until GC, which showed up as `fetch failed` on suite 49.
 * Keep-alive stays below the servers' own 5 s idle timeout so a socket is never reused after the server closed it.
 */
export const E2E_MAX_CONNECTIONS = Number(process.env.E2E_MAX_CONNECTIONS ?? 16);
setGlobalDispatcher(new Agent({ connections: E2E_MAX_CONNECTIONS, pipelining: 1, keepAliveTimeout: 3_000, keepAliveMaxTimeout: 4_000, connectTimeout: 10_000 }));

export interface Probe { status: number; ms: number; error?: string }
/**
 * Status-only request for the never-5xx sweeps: the body is always drained (the socket goes back to the pool), a connection-level failure
 * is retried up to 3 times with a growing pause (0.25 s, 0.5 s, 0.75 s) (a refused/reset socket is not an HTTP answer; a server that is really down fails both attempts and
 * is reported as -1 with the error code), and a bounded gap between requests applies backpressure so a sweep cannot outrun the API.
 */
export async function probe(url: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<Probe> {
  const t0 = Date.now(); let error = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      await res.arrayBuffer();
      return { status: res.status, ms: Date.now() - t0 };
    } catch (e) { const err = e as Error & { cause?: { code?: string; message?: string } }; error = `${err.name}: ${err.message} ${err.cause?.code ?? err.cause?.message ?? ''}`.trim(); await new Promise((r) => setTimeout(r, 250 * (attempt + 1))); }
  }
  return { status: -1, ms: Date.now() - t0, error };
}
