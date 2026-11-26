import type { AuthData, Slot } from './types'

/**
 * Spotify Authorization Code flow with PKCE. The app has no backend, so it can't keep a
 * client secret; PKCE replaces it with a one-time verifier generated per login.
 *
 * 1. `startLogin` stores verifier + state per slot and opens Spotify's consent page in a popup.
 * 2. Spotify redirects the popup to `/afterLogin` (see `src/afterLogin.ts`), which calls
 *    `completeLogin` to exchange the code and posts the tokens back to the opener.
 * 3. `refreshAuth` renews tokens without any secret.
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

/** Builds the authorize URL and remembers verifier + state for the callback. */
export async function buildAuthorizeUrl(slot: Slot): Promise<string> {
  const verifier = randomString(128)
  const state = `${slot}.${randomString(16)}`
  // localStorage, not sessionStorage: the popup is opened before this runs (to dodge popup
  // blockers) and gets a snapshot of the opener's sessionStorage, so it would never see it.
  // The entry is single-use and removed by `completeLogin`.
  localStorage.setItem(PKCE_KEY(slot), JSON.stringify({ verifier, state }))

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
  return `${ACCOUNTS_URL}/authorize?${params.toString()}`
}

/** Opens the Spotify login popup and resolves with the tokens it posts back. */
export function startLogin(slot: Slot): Promise<AuthData> {
  // Open synchronously (inside the click handler) so popup blockers allow it.
  const popup = window.open('', `spotify-login-${slot}`, 'width=520,height=760')
  if (!popup) return Promise.reject(new Error('popup-blocked'))

  return new Promise<AuthData>((resolve, reject) => {
    const cleanup = () => {
      window.removeEventListener('message', onMessage)
      clearInterval(closedPoll)
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

    buildAuthorizeUrl(slot).then(
      (url) => {
        popup.location.href = url
      },
      (err: unknown) => {
        cleanup()
        popup.close()
        reject(err instanceof Error ? err : new Error(String(err)))
      },
    )
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

  const stored = localStorage.getItem(PKCE_KEY(slot))
  localStorage.removeItem(PKCE_KEY(slot))
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
