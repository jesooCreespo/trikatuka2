import {
  codeChallenge,
  completeLogin,
  prepareLogin,
  refreshAuth,
  savePendingLogin,
  SCOPES,
  startLogin,
} from './auth'

beforeEach(() => {
  vi.stubEnv('VITE_SPOTIFY_CLIENT_ID', 'client-123')
  sessionStorage.clear()
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
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

  it('prepares the authorize URL without touching storage', async () => {
    const prepared = await prepareLogin('new')
    const url = new URL(prepared.url)
    const p = url.searchParams

    expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize')
    expect(p.get('client_id')).toBe('client-123')
    expect(p.get('code_challenge_method')).toBe('S256')
    expect(p.get('redirect_uri')).toBe(`${window.location.origin}/afterLogin`)
    expect(p.get('scope')).toBe(SCOPES.join(' '))
    expect(p.get('show_dialog')).toBe('true')
    expect(p.get('state')).toBe(prepared.state)
    expect(prepared.state).toMatch(/^new\./)
    await expect(codeChallenge(prepared.verifier)).resolves.toBe(p.get('code_challenge'))
    expect(sessionStorage.length + localStorage.length).toBe(0)
  })
})

describe('startLogin', () => {
  it('saves verifier and state before opening the popup on the authorize URL', async () => {
    const prepared = await prepareLogin('old')
    let storedWhenOpened: string | null = null
    const open = vi.spyOn(window, 'open').mockImplementation(() => {
      // The popup copies the opener's sessionStorage at this moment.
      storedWhenOpened = sessionStorage.getItem('trikatuka:pkce:old')
      return { closed: false } as Window
    })

    void startLogin(prepared)

    expect(open).toHaveBeenCalledWith(
      prepared.url,
      expect.stringContaining(prepared.state),
      expect.any(String),
    )
    expect(JSON.parse(storedWhenOpened!)).toEqual({
      verifier: prepared.verifier,
      state: prepared.state,
    })
  })

  it('rejects and cleans up when the popup is blocked', async () => {
    const prepared = await prepareLogin('old')
    vi.spyOn(window, 'open').mockReturnValue(null)
    await expect(startLogin(prepared)).rejects.toThrow('popup-blocked')
    expect(sessionStorage.getItem('trikatuka:pkce:old')).toBeNull()
  })

  it('resolves with the tokens posted back by the popup', async () => {
    const prepared = await prepareLogin('new')
    vi.spyOn(window, 'open').mockReturnValue({ closed: false } as Window)
    const pending = startLogin(prepared)
    const auth = { accessToken: 'a', refreshToken: 'r', expiresAt: 1, scope: '' }

    // Messages from another origin are ignored.
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://evil.test',
        data: { type: 'trikatuka:spotify-auth', slot: 'new', error: 'x' },
      }),
    )
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: { type: 'trikatuka:spotify-auth', slot: 'new', auth },
      }),
    )

    await expect(pending).resolves.toEqual(auth)
    expect(sessionStorage.getItem('trikatuka:pkce:new')).toBeNull()
  })
})

describe('completeLogin', () => {
  it('exchanges the code with the stored verifier', async () => {
    const prepared = await prepareLogin('old')
    savePendingLogin(prepared)
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        tokenResponse({ access_token: 'a', refresh_token: 'r', expires_in: 3600, scope: 's' }),
      )

    const res = await completeLogin(
      `https://app.test/afterLogin?code=C&state=${prepared.state}`,
      fetchImpl,
    )

    expect(res.slot).toBe('old')
    expect(res.auth).toMatchObject({ accessToken: 'a', refreshToken: 'r', scope: 's' })
    const body = fetchImpl.mock.calls[0]![1]!.body as URLSearchParams
    expect(Object.fromEntries(body)).toEqual({
      client_id: 'client-123',
      grant_type: 'authorization_code',
      code: 'C',
      redirect_uri: 'https://app.test/afterLogin',
      code_verifier: prepared.verifier,
    })
    // The verifier is single-use.
    expect(sessionStorage.getItem('trikatuka:pkce:old')).toBeNull()
  })

  it('rejects a state that does not match', async () => {
    savePendingLogin(await prepareLogin('old'))
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
