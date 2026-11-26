import { AuthLostError, createSpotifyClient, SpotifyApiError, type ClientDeps } from './client';
import type { AuthData } from './types';

const NOW = 1_000_000;

function auth(overrides: Partial<AuthData> = {}): AuthData {
  return {
    accessToken: 'tok',
    refreshToken: 'ref',
    expiresAt: NOW + 3_600_000,
    scope: '',
    ...overrides,
  };
}

function json(status: number, body?: unknown, headers: Record<string, string> = {}) {
  return new Response(body === undefined ? '' : JSON.stringify(body), { status, headers });
}

function setup(responses: Response[], deps: Partial<ClientDeps> = {}) {
  let current: AuthData | null = deps.getAuth ? deps.getAuth() : auth();
  const fetchImpl = vi.fn<typeof fetch>();
  for (const r of responses) fetchImpl.mockResolvedValueOnce(r);
  const sleep = vi.fn(async () => {});
  const setAuth = vi.fn((a: AuthData) => (current = a));
  const onAuthLost = vi.fn();
  const refresh = vi.fn(async (a: AuthData) => auth({ ...a, accessToken: 'fresh' }));
  const client = createSpotifyClient({
    getAuth: () => current,
    setAuth,
    onAuthLost,
    fetchImpl,
    sleep,
    refresh,
    now: () => NOW,
    ...deps,
  });
  return { client, fetchImpl, sleep, setAuth, onAuthLost, refresh };
}

describe('createSpotifyClient', () => {
  it('sends the bearer token, query and JSON body', async () => {
    const { client, fetchImpl } = setup([json(200, { id: 'x' })]);
    const res = await client.request('POST', '/me/playlists', {
      query: { a: 1 },
      body: { name: 'n' },
    });

    expect(res).toEqual({ id: 'x' });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.spotify.com/v1/me/playlists?a=1');
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer tok',
      'Content-Type': 'application/json',
    });
    expect(init?.body).toBe('{"name":"n"}');
  });

  it('accepts absolute `next` URLs and empty bodies', async () => {
    const { client, fetchImpl } = setup([json(200)]);
    await expect(
      client.request('PUT', 'https://api.spotify.com/v1/me/library?uris=a'),
    ).resolves.toBeUndefined();
    expect(fetchImpl.mock.calls[0]![0]).toBe('https://api.spotify.com/v1/me/library?uris=a');
  });

  it('refreshes the token before it expires', async () => {
    const { client, fetchImpl, refresh, setAuth } = setup([json(200, {})], {
      getAuth: () => auth({ expiresAt: NOW + 10_000 }),
    });
    await client.request('GET', '/me');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(setAuth).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'fresh' }));
    expect(fetchImpl.mock.calls[0]![1]?.headers).toMatchObject({ Authorization: 'Bearer fresh' });
  });

  it('refreshes once and retries after a 401', async () => {
    const { client, fetchImpl, refresh } = setup([json(401), json(200, { ok: 1 })]);
    await expect(client.request('GET', '/me')).resolves.toEqual({ ok: 1 });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('signs out when refreshing fails', async () => {
    const { client, onAuthLost } = setup([json(401)], {
      refresh: vi.fn().mockRejectedValue(new Error('nope')),
    });
    await expect(client.request('GET', '/me')).rejects.toBeInstanceOf(AuthLostError);
    expect(onAuthLost).toHaveBeenCalled();
  });

  it('waits for Retry-After on 429', async () => {
    const { client, sleep } = setup([json(429, {}, { 'Retry-After': '3' }), json(200, {})]);
    await client.request('GET', '/me');
    expect(sleep).toHaveBeenCalledWith(3000, undefined);
  });

  it('backs off on 5xx and eventually throws', async () => {
    const { client, sleep } = setup(
      [json(500), json(502), json(503, { error: { status: 503, message: 'down' } })],
      { maxRetries: 2 },
    );
    const err = await client.request('GET', '/me').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SpotifyApiError);
    expect(err).toMatchObject({ status: 503, message: 'down' });
    expect(sleep.mock.calls.map((c) => (c as unknown[])[0])).toEqual([1000, 2000]);
  });

  it('does not retry 4xx errors', async () => {
    const { client, fetchImpl } = setup([json(403, { error: { message: 'Forbidden' } })]);
    await expect(client.request('GET', '/x')).rejects.toMatchObject({ status: 403 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws AuthLostError without a session', async () => {
    const { client } = setup([], { getAuth: () => null });
    await expect(client.request('GET', '/me')).rejects.toBeInstanceOf(AuthLostError);
  });
});
