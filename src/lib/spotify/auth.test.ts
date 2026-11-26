import { buildAuthorizeUrl, codeChallenge, completeLogin, refreshAuth, SCOPES } from './auth'

beforeEach(() => {
  vi.stubEnv('VITE_SPOTIFY_CLIENT_ID', 'client-123')
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function tokenResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

describe('PKCE', () => {
  it('computes the RFC 7636 S256 challenge', async () => {
    // Test vector from RFC 7636, appendix B.
    await expect(codeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).resolves.toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    )
  })

  it('builds the authorize URL and stores verifier/state per slot', async () => {
    const url = new URL(await buildAuthorizeUrl('new'))
    const p = url.searchParams

    expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize')
    expect(p.get('client_id')).toBe('client-123')
    expect(p.get('code_challenge_method')).toBe('S256')
    expect(p.get('redirect_uri')).toBe(`${window.location.origin}/afterLogin`)
    expect(p.get('scope')).toBe(SCOPES.join(' '))
    expect(p.get('show_dialog')).toBe('true')
    expect(p.get('state')).toMatch(/^new\./)

    const stored = JSON.parse(localStorage.getItem('trikatuka:pkce:new')!)
    expect(stored.state).toBe(p.get('state'))
    await expect(codeChallenge(stored.verifier)).resolves.toBe(p.get('code_challenge'))
  })
})

describe('completeLogin', () => {
  it('exchanges the code with the stored verifier', async () => {
    const authorize = new URL(await buildAuthorizeUrl('old'))
    const state = authorize.searchParams.get('state')!
    const { verifier } = JSON.parse(localStorage.getItem('trikatuka:pkce:old')!)
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        tokenResponse({ access_token: 'a', refresh_token: 'r', expires_in: 3600, scope: 's' }),
      )

    const res = await completeLogin(`https://app.test/afterLogin?code=C&state=${state}`, fetchImpl)

    expect(res.slot).toBe('old')
    expect(res.auth).toMatchObject({ accessToken: 'a', refreshToken: 'r', scope: 's' })
    const body = fetchImpl.mock.calls[0]![1]!.body as URLSearchParams
    expect(Object.fromEntries(body)).toEqual({
      client_id: 'client-123',
      grant_type: 'authorization_code',
      code: 'C',
      redirect_uri: 'https://app.test/afterLogin',
      code_verifier: verifier,
    })
    // The verifier is single-use.
    expect(localStorage.getItem('trikatuka:pkce:old')).toBeNull()
  })

  it('rejects a state that does not match', async () => {
    await buildAuthorizeUrl('old')
    await expect(
      completeLogin('https://app.test/afterLogin?code=C&state=old.forged'),
    ).rejects.toThrow('state-mismatch')
  })

  it('reports the error Spotify returned (e.g. access_denied)', async () => {
    await expect(
      completeLogin('https://app.test/afterLogin?error=access_denied&state=new.x'),
    ).rejects.toMatchObject({ message: 'access_denied', slot: 'new' })
  })
})

describe('refreshAuth', () => {
  it('keeps the old refresh token when Spotify omits it', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(tokenResponse({ access_token: 'new', expires_in: 60, scope: '' }))
    const res = await refreshAuth(
      { accessToken: 'old', refreshToken: 'keep', expiresAt: 0, scope: '' },
      fetchImpl,
    )
    expect(res).toMatchObject({ accessToken: 'new', refreshToken: 'keep' })
  })

  it('throws on error responses', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        tokenResponse({ error: 'invalid_grant', error_description: 'revoked' }, 400),
      )
    await expect(
      refreshAuth({ accessToken: '', refreshToken: 'x', expiresAt: 0, scope: '' }, fetchImpl),
    ).rejects.toThrow('revoked')
  })
})
