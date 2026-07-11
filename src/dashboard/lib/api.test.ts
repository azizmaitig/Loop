import { apiFetch, ApiError } from './api';

// Runner-agnostic (works under both Bun test and Vitest globals).
let fetchCalls: { url: string; init?: unknown }[] = [];

function mockFetch(status: number, body: string) {
  return (async (url: string, init?: unknown) => {
    fetchCalls.push({ url, init });
    return {
      status,
      ok: status >= 200 && status < 300,
      statusText: 'status-' + status,
      text: async () => body,
      json: async () => JSON.parse(body),
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

describe('apiFetch', () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    fetchCalls = [];
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('parses JSON on success', async () => {
    globalThis.fetch = mockFetch(200, '{"score":42}');
    const res = await apiFetch<{ score: number }>('/api/health-score');
    expect(res.score).toBe(42);
  });

  it('resolves null on 404 when allowNotFound is set', async () => {
    globalThis.fetch = mockFetch(404, '{"error":"no checkpoint"}');
    const res = await apiFetch<{ x: number }>('/api/checkpoint', { allowNotFound: true });
    expect(res).toBeNull();
  });

  it('throws ApiError on non-2xx', async () => {
    globalThis.fetch = mockFetch(500, '{"error":"boom"}');
    await expect(apiFetch('/api/x')).rejects.toBeInstanceOf(ApiError);
  });

  it('builds query params', async () => {
    const fn = mockFetch(200, '{}');
    globalThis.fetch = fn;
    await apiFetch('/api/metrics', { params: { window: '1h', lastN: 50 } });
    const url = fetchCalls[0].url;
    expect(url).toContain('window=1h');
    expect(url).toContain('lastN=50');
  });
});
