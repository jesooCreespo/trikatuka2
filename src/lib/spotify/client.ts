import { refreshAuth } from './auth'
import type { AuthData } from './types'

export const API_BASE = 'https://api.spotify.com/v1'

export class SpotifyApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'SpotifyApiError'
    this.status = status
  }
}

export class AuthLostError extends Error {
  constructor() {
    super('auth-lost')
    this.name = 'AuthLostError'
  }
}

export interface RequestOptions {
  query?: Record<string, string | number | undefined>
  body?: unknown
  signal?: AbortSignal
}

export interface SpotifyClient {
  request<T>(method: string, pathOrUrl: string, options?: RequestOptions): Promise<T>
}

export interface ClientDeps {
  getAuth: () => AuthData | null
  setAuth: (auth: AuthData) => void
  /** Called when the session can't be refreshed; the account should be signed out. */
  onAuthLost: () => void
  fetchImpl?: typeof fetch
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
  refresh?: (auth: AuthData) => Promise<AuthData>
  now?: () => number
  maxRetries?: number
}

/** Renew tokens slightly before they expire so long transfers don't hit a 401 mid-request. */
const EXPIRY_MARGIN_MS = 60_000
const MAX_RETRY_AFTER_S = 60

export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal?.reason)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * The only place that talks HTTP to the Web API. Adds the bearer token, refreshes it when it is
 * about to expire (or after a 401), and retries rate limits (429 + Retry-After) and 5xx errors.
 */
export function createSpotifyClient(deps: ClientDeps): SpotifyClient {
  const fetchImpl = deps.fetchImpl ?? ((...args) => fetch(...args))
  const sleep = deps.sleep ?? abortableSleep
  const refresh = deps.refresh ?? ((auth: AuthData) => refreshAuth(auth))
  const now = deps.now ?? Date.now
  const maxRetries = deps.maxRetries ?? 5

  let refreshing: Promise<AuthData> | null = null

  function refreshOnce(auth: AuthData): Promise<AuthData> {
    refreshing ??= refresh(auth)
      .then((fresh) => {
        deps.setAuth(fresh)
        return fresh
      })
      .catch(() => {
        deps.onAuthLost()
        throw new AuthLostError()
      })
      .finally(() => {
        refreshing = null
      })
    return refreshing
  }

  async function validAuth(): Promise<AuthData> {
    const auth = deps.getAuth()
    if (!auth) throw new AuthLostError()
    if (auth.expiresAt - EXPIRY_MARGIN_MS <= now()) return refreshOnce(auth)
    return auth
  }

  function buildUrl(pathOrUrl: string, query?: RequestOptions['query']): string {
    const url = new URL(pathOrUrl.startsWith('http') ? pathOrUrl : `${API_BASE}${pathOrUrl}`)
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }
    return url.toString()
  }

  async function request<T>(
    method: string,
    pathOrUrl: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const url = buildUrl(pathOrUrl, options.query)
    let refreshedAfter401 = false

    for (let attempt = 0; ; attempt++) {
      options.signal?.throwIfAborted()
      const auth = await validAuth()
      const res = await fetchImpl(url, {
        method,
        signal: options.signal,
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          Accept: 'application/json',
          ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      })

      if (res.ok) {
        const text = await res.text()
        return (text ? JSON.parse(text) : undefined) as T
      }

      if (res.status === 401 && !refreshedAfter401) {
        refreshedAfter401 = true
        await refreshOnce(auth)
        continue
      }

      const retryable = res.status === 429 || res.status >= 500
      if (retryable && attempt < maxRetries) {
        const retryAfter = Number(res.headers.get('Retry-After'))
        const delayMs =
          res.status === 429 && Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter, MAX_RETRY_AFTER_S) * 1000
            : Math.min(1000 * 2 ** attempt, 30_000)
        await sleep(delayMs, options.signal)
        continue
      }

      throw new SpotifyApiError(res.status, await errorMessage(res))
    }
  }

  return { request }
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as { error?: { message?: string } | string }
    if (typeof json.error === 'string') return json.error
    if (json.error?.message) return json.error.message
  } catch {
    // Body isn't JSON; fall through.
  }
  return `HTTP ${res.status}`
}
