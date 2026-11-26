import type { BrowserContext, Route } from '@playwright/test'

/**
 * An in-memory Spotify (accounts + Web API) installed with `context.route`, including the OAuth
 * popup. The old account owns `library`; the new account starts with `targetSaved` only.
 * Used by the e2e tests and by the demo screenshots (`screenshots/`).
 */

interface User {
  id: string
  display_name: string
  uri: string
  images: { url: string; width: number; height: number }[]
}

export interface FakeLibrary {
  users: { old: User; new: User }
  playlists: Record<string, unknown>[]
  /** Items of playlists the old user can read, by playlist id. */
  playlistItems: Record<string, Record<string, unknown>[]>
  tracks: Record<string, unknown>[]
  albums: Record<string, unknown>[]
  artists: Record<string, unknown>[]
  shows: Record<string, unknown>[]
  /** URIs the new account already has (for "skip duplicates"). */
  targetSaved?: string[]
}

export interface FakeSpotifyOptions {
  library?: FakeLibrary
  /** `PUT /me/library` requests containing any of these URIs fail with 403. */
  failUris?: string[]
  /** Delay for every write, to observe a transfer in progress. */
  writeDelayMs?: number
}

export interface FakeSpotify {
  created: Array<{ name: string; public: boolean; description?: string }>
  added: Array<{ playlistId: string; uris: string[] }>
  saved: string[]
}

const user = (id: string, name: string): User => ({
  id,
  display_name: name,
  uri: `spotify:user:${id}`,
  images: [],
})

/** The small library used by the e2e tests. */
export const TEST_LIBRARY: FakeLibrary = {
  users: { old: user('old-user', 'Alice'), new: user('new-user', 'Bob') },
  playlists: [
    {
      id: 'mine',
      name: 'Road trip',
      uri: 'spotify:playlist:mine',
      public: true,
      collaborative: false,
      description: 'Songs for the car',
      images: [],
      owner: { id: 'old-user', display_name: 'Alice' },
      items: { total: 2 },
    },
    {
      id: 'theirs',
      name: 'Top hits',
      uri: 'spotify:playlist:theirs',
      public: true,
      collaborative: false,
      description: null,
      images: [],
      owner: { id: 'someone', display_name: 'Someone' },
      items: { total: 50 },
    },
  ],
  playlistItems: {
    mine: [
      { added_at: '', is_local: false, item: { uri: 'spotify:track:t1' } },
      { added_at: '', is_local: false, item: { uri: 'spotify:track:t2' } },
    ],
  },
  tracks: [1, 2, 3].map((n) => ({
    added_at: '',
    track: {
      id: `t${n}`,
      name: `Song ${n}`,
      uri: `spotify:track:t${n}`,
      type: 'track',
      artists: [{ id: 'a', name: 'Band', uri: 'spotify:artist:a' }],
      album: { name: 'Album', images: [] },
    },
  })),
  albums: [],
  artists: [],
  shows: [],
}

/** Offset paging that honours `offset`/`limit` like the real API. */
function page<T>(items: T[], url: URL) {
  const offset = Number(url.searchParams.get('offset') ?? 0)
  const limit = Number(url.searchParams.get('limit') ?? 20)
  const slice = items.slice(offset, offset + limit)
  const next =
    offset + limit < items.length
      ? `${url.origin}${url.pathname}?offset=${offset + limit}&limit=${limit}`
      : null
  return { items: slice, total: items.length, limit, offset, next }
}

/** Cursor paging for followed artists (`after` = id of the last artist of the previous page). */
function cursorPage(items: Record<string, unknown>[], url: URL) {
  const limit = Number(url.searchParams.get('limit') ?? 20)
  const after = url.searchParams.get('after')
  const start = after ? items.findIndex((a) => a.id === after) + 1 : 0
  const slice = items.slice(start, start + limit)
  const more = start + limit < items.length
  return {
    items: slice,
    total: items.length,
    limit,
    next: more ? 'next' : null,
    cursors: { after: more ? (slice.at(-1)?.id as string) : null },
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function installFakeSpotify(
  context: BrowserContext,
  { library = TEST_LIBRARY, failUris = [], writeDelayMs = 0 }: FakeSpotifyOptions = {},
): Promise<FakeSpotify> {
  const state: FakeSpotify = { created: [], added: [], saved: [] }
  const targetSaved = new Set(library.targetSaved ?? [])
  const fail = new Set(failUris)

  await context.route('https://accounts.spotify.com/authorize?**', async (route) => {
    const url = new URL(route.request().url())
    const oauthState = url.searchParams.get('state')!
    const slot = oauthState.split('.')[0]!
    const redirect = new URL(url.searchParams.get('redirect_uri')!)
    redirect.searchParams.set('code', `code-${slot}`)
    redirect.searchParams.set('state', oauthState)
    await route.fulfill({ status: 302, headers: { Location: redirect.toString() } })
  })

  await context.route('https://accounts.spotify.com/api/token', async (route) => {
    const body = new URLSearchParams(route.request().postData() ?? '')
    const slot = (body.get('code') ?? '').replace('code-', '')
    await json(route, {
      access_token: `tok-${slot}`,
      refresh_token: `ref-${slot}`,
      expires_in: 3600,
      scope: '',
    })
  })

  await context.route('https://api.spotify.com/v1/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname.replace('/v1', '')
    const slot = (req.headers()['authorization'] ?? '').endsWith('tok-old') ? 'old' : 'new'
    const isOld = slot === 'old'
    const method = req.method()
    const mine = <T>(items: T[]) => (isOld ? items : [])

    if (method !== 'GET' && writeDelayMs) await sleep(writeDelayMs)

    if (method === 'GET') {
      if (path === '/me') return json(route, library.users[slot])
      if (path === '/me/playlists') return json(route, page(mine(library.playlists), url))
      if (path === '/me/tracks') return json(route, page(mine(library.tracks), url))
      if (path === '/me/albums') return json(route, page(mine(library.albums), url))
      if (path === '/me/shows') return json(route, page(mine(library.shows), url))
      if (path === '/me/following')
        return json(route, { artists: cursorPage(mine(library.artists), url) })
      const items = path.match(/^\/playlists\/([^/]+)\/items$/)
      if (items) {
        const list = isOld ? library.playlistItems[items[1]!] : undefined
        if (!list) return json(route, { error: { status: 403, message: 'Forbidden' } }, 403)
        return json(route, page(list, url))
      }
      if (path === '/me/library/contains') {
        const uris = (url.searchParams.get('uris') ?? '').split(',')
        return json(
          route,
          uris.map((u) => targetSaved.has(u) || state.saved.includes(u)),
        )
      }
    }
    if (method === 'POST' && path === '/me/playlists') {
      const data = req.postDataJSON() as FakeSpotify['created'][number]
      state.created.push(data)
      const id = `copy-${state.created.length}`
      return json(route, { id, name: data.name, uri: `spotify:playlist:${id}` }, 201)
    }
    if (method === 'POST' && /^\/playlists\/[^/]+\/items$/.test(path)) {
      state.added.push({ playlistId: path.split('/')[2]!, uris: req.postDataJSON().uris })
      return json(route, { snapshot_id: 's' }, 201)
    }
    if (method === 'PUT' && path === '/me/library') {
      const uris = (url.searchParams.get('uris') ?? '').split(',')
      if (uris.some((u) => fail.has(u)))
        return json(route, { error: { status: 403, message: 'Forbidden' } }, 403)
      state.saved.push(...uris)
      return route.fulfill({ status: 200, body: '' })
    }
    return json(route, { error: { status: 404, message: `Unmocked ${method} ${path}` } }, 404)
  })

  return state
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}
