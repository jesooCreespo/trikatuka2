import type { AuthData, Slot } from './types'

/**
 * Spotify Authorization Code flow with PKCE. The app has no backend, so it can't keep a
 * client secret; PKCE replaces it with a one-time verifier generated per login.
 *
 * 1. `prepareLogin` computes verifier, state, challenge and the authorize URL ahead of time
 *    (hashing is async), so that the click handler doesn't have to await anything.
 * 2. On click, `startLogin` synchronously saves verifier + state to sessionStorage and only then
 *    opens the popup. A popup opened with `window.open` starts with a *copy* of the opener's
 *    sessionStorage taken at that moment, so it must be written before opening, and the
 *    window.open call must not come after an `await` or popup blockers may stop it.
 * 3. Spotify redirects the popup to `/afterLogin` (see `src/afterLogin.ts`), which calls
 *    `completeLogin` to exchange the code and posts the tokens back to the opener.
 * 4. `refreshAuth` renews tokens without any secret.
 */

export const SCOPES = [
  'user-library-read',
  'user-library-modify',
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-follow-read',
  'user-follow-modify',
]

const ACCOUNTS_URL = 'https://accounts.spotify.com'
const PKCE_KEY = (slot: Slot) => `trikatuka:pkce:${slot}`
export const AUTH_MESSAGE_TYPE = 'trikatuka:spotify-auth'

export type AuthMessage =
  | { type: typeof AUTH_MESSAGE_TYPE; slot: Slot; auth: AuthData }
  | { type: typeof AUTH_MESSAGE_TYPE; slot: Slot | null; error: string }

export function getClientId(): string {
  const id = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined
  if (!id) throw new Error('VITE_SPOTIFY_CLIENT_ID is not set')
  return id
}

export function getRedirectUri(origin = window.location.origin): string {
  return `${origin}/afterLogin`
}

function randomString(length: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

export interface PreparedLogin {
  slot: Slot
  verifier: string
  state: string
  url: string
}

/** Computes everything a login needs. No side effects; each result must be used only once. */
export async function prepareLogin(slot: Slot): Promise<PreparedLogin> {
  const verifier = randomString(128)
  const state = `${slot}.${randomString(16)}`
  const params = new URLSearchParams({
    client_id: getClientId(),
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    code_challenge_method: 'S256',
    code_challenge: await codeChallenge(verifier),
    state,
    scope: SCOPES.join(' '),
    // Always show the consent dialog so the user can notice which account is signed in.
    show_dialog: 'true',
  })
  return { slot, verifier, state, url: `${ACCOUNTS_URL}/authorize?${params.toString()}` }
}

/** Stores verifier + state where the popup's `completeLogin` will find them. */
export function savePendingLogin({ slot, verifier, state }: PreparedLogin) {
  sessionStorage.setItem(PKCE_KEY(slot), JSON.stringify({ verifier, state }))
}

/**
 * Opens the Spotify login popup and resolves with the tokens it posts back.
 * Must be called synchronously from the click handler (no `await` before it).
 */
export function startLogin(prepared: PreparedLogin): Promise<AuthData> {
  const { slot } = prepared
  savePendingLogin(prepared)
  // A unique name per attempt: reusing an already open popup would keep its old sessionStorage.
  const popup = window.open(prepared.url, `spotify-login-${prepared.state}`, 'width=520,height=760')
  if (!popup) {
    sessionStorage.removeItem(PKCE_KEY(slot))
    return Promise.reject(new Error('popup-blocked'))
  }

  return new Promise<AuthData>((resolve, reject) => {
    const cleanup = () => {
      window.removeEventListener('message', onMessage)
      clearInterval(closedPoll)
      // The popup has its own copy; the opener's one is no longer needed.
      sessionStorage.removeItem(PKCE_KEY(slot))
    }
    const onMessage = (event: MessageEvent<AuthMessage>) => {
      if (event.origin !== window.location.origin) return
      const data = event.data
      if (data?.type !== AUTH_MESSAGE_TYPE || (data.slot !== slot && data.slot !== null)) return
      cleanup()
      if ('error' in data) reject(new Error(data.error))
      else resolve(data.auth)
    }
    const closedPoll = setInterval(() => {
      if (popup.closed) {
        cleanup()
        reject(new Error('popup-closed'))
      }
    }, 500)
    window.addEventListener('message', onMessage)
  })
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  error?: string
  error_description?: string
}

async function postToken(
  body: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<TokenResponse> {
  const res = await fetchImpl(`${ACCOUNTS_URL}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  })
  const json = (await res.json()) as TokenResponse
  if (!res.ok || json.error) {
    throw new Error(json.error_description || json.error || `token-request-failed-${res.status}`)
  }
  return json
}

function toAuthData(json: TokenResponse, previousRefreshToken = '', now = Date.now()): AuthData {
  return {
    accessToken: json.access_token,
    // Spotify may omit the refresh token on refresh; keep the old one then.
    refreshToken: json.refresh_token ?? previousRefreshToken,
    expiresAt: now + json.expires_in * 1000,
    scope: json.scope,
  }
}

/** Handles the redirect on `/afterLogin`: validates state and exchanges the code. */
export async function completeLogin(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ slot: Slot; auth: AuthData }> {
  const params = new URL(url).searchParams
  const state = params.get('state') ?? ''
  const slot = state.split('.')[0]
  if (slot !== 'old' && slot !== 'new') throw new Error('invalid-state')

  const error = params.get('error')
  if (error) throw Object.assign(new Error(error), { slot })

  const stored = sessionStorage.getItem(PKCE_KEY(slot))
  sessionStorage.removeItem(PKCE_KEY(slot))
  const { verifier, state: expectedState } = stored
    ? (JSON.parse(stored) as { verifier: string; state: string })
    : { verifier: '', state: '' }
  if (!verifier || state !== expectedState)
    throw Object.assign(new Error('state-mismatch'), { slot })

  const code = params.get('code')
  if (!code) throw Object.assign(new Error('missing-code'), { slot })

  const json = await postToken(
    {
      client_id: getClientId(),
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(new URL(url).origin),
      code_verifier: verifier,
    },
    fetchImpl,
  )
  return { slot, auth: toAuthData(json) }
}

export async function refreshAuth(
  auth: AuthData,
  fetchImpl: typeof fetch = fetch,
): Promise<AuthData> {
  const json = await postToken(
    { client_id: getClientId(), grant_type: 'refresh_token', refresh_token: auth.refreshToken },
    fetchImpl,
  )
  return toAuthData(json, auth.refreshToken)
}
