import type { BrowserContext, Route } from '@playwright/test'

/**
 * A tiny in-memory Spotify: accounts + Web API, enough for the wizard's happy path.
 * The old account (`old-user`) has a library; the new one (`new-user`) starts empty.
 */
export interface FakeSpotify {
  created: Array<{ name: string; public: boolean; description?: string }>
  added: Array<{ playlistId: string; uris: string[] }>
  saved: string[]
}

const users = {
  old: { id: 'old-user', display_name: 'Alice', uri: 'spotify:user:old-user', images: [] },
  new: { id: 'new-user', display_name: 'Bob', uri: 'spotify:user:new-user', images: [] },
}

const playlists = [
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
]

const tracks = [1, 2, 3].map((n) => ({
  added_at: '',
  track: {
    id: `t${n}`,
    name: `Song ${n}`,
    uri: `spotify:track:t${n}`,
    type: 'track',
    artists: [{ id: 'a', name: 'Band', uri: 'spotify:artist:a' }],
    album: { name: 'Album', images: [] },
  },
}))

function page<T>(items: T[]) {
  return { items, total: items.length, limit: 50, offset: 0, next: null }
}

export async function installFakeSpotify(context: BrowserContext): Promise<FakeSpotify> {
  const state: FakeSpotify = { created: [], added: [], saved: [] }

  await context.route('https://accounts.spotify.com/authorize?**', async (route) => {
    const url = new URL(route.request().url())
    const state = url.searchParams.get('state')!
    const slot = state.split('.')[0]!
    const redirect = new URL(url.searchParams.get('redirect_uri')!)
    redirect.searchParams.set('code', `code-${slot}`)
    redirect.searchParams.set('state', state)
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

    if (method === 'GET' && path === '/me') return json(route, users[slot])
    if (method === 'GET' && path === '/me/playlists')
      return json(route, page(isOld ? playlists : []))
    if (method === 'GET' && path === '/me/tracks') return json(route, page(isOld ? tracks : []))
    if (method === 'GET' && (path === '/me/albums' || path === '/me/shows'))
      return json(route, page([]))
    if (method === 'GET' && path === '/me/following')
      return json(route, { artists: { ...page([]), cursors: { after: null } } })
    if (method === 'GET' && path === '/playlists/mine/items')
      return json(
        route,
        page([
          { added_at: '', is_local: false, item: { uri: 'spotify:track:t1' } },
          { added_at: '', is_local: false, item: { uri: 'spotify:track:t2' } },
        ]),
      )
    if (method === 'GET' && path === '/me/library/contains') {
      const uris = (url.searchParams.get('uris') ?? '').split(',')
      return json(
        route,
        uris.map((u) => state.saved.includes(u)),
      )
    }
    if (method === 'POST' && path === '/me/playlists') {
      const data = req.postDataJSON() as FakeSpotify['created'][number]
      state.created.push(data)
      return json(route, { ...playlists[0], id: 'copy-1', name: data.name }, 201)
    }
    if (method === 'POST' && path.startsWith('/playlists/') && path.endsWith('/items')) {
      state.added.push({ playlistId: path.split('/')[2]!, uris: req.postDataJSON().uris })
      return json(route, { snapshot_id: 's' }, 201)
    }
    if (method === 'PUT' && path === '/me/library') {
      state.saved.push(...(url.searchParams.get('uris') ?? '').split(','))
      return route.fulfill({ status: 200, body: '' })
    }
    return json(route, { error: { status: 404, message: `Unmocked ${method} ${path}` } }, 404)
  })

  return state
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}
