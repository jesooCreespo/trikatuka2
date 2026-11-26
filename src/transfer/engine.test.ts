import type { LibraryItem } from '@/lib/library'
import { SpotifyApiError } from '@/lib/spotify/client'
import type { SpotifyApi } from '@/lib/spotify/endpoints'
import type { Paging } from '@/lib/spotify/types'
import { runTransfer, summarize, type TransferContext } from './engine'

function paging<T>(items: T[], offset = 0, size = 50): Paging<T> {
  const page = items.slice(offset, offset + size)
  return {
    items: page,
    total: items.length,
    limit: size,
    offset,
    next: offset + size < items.length ? 'n' : null,
  }
}

function fakeApi(overrides: Partial<SpotifyApi> = {}): SpotifyApi {
  return {
    me: vi.fn(),
    myPlaylists: vi.fn(async () => paging([])),
    playlistItems: vi.fn(async () => paging([])),
    savedTracks: vi.fn(),
    savedAlbums: vi.fn(),
    savedShows: vi.fn(),
    followedArtists: vi.fn(),
    createPlaylist: vi.fn(async (data) => ({ id: `new-${data.name}` }) as never),
    addPlaylistItems: vi.fn(async () => {}),
    saveToLibrary: vi.fn(async () => {}),
    libraryContains: vi.fn(async (uris: string[]) => uris.map(() => false)),
    ...overrides,
  }
}

const track = (n: number): LibraryItem => ({
  category: 'tracks',
  id: `t${n}`,
  uri: `spotify:track:t${n}`,
  name: `Track ${n}`,
  subtitle: '',
  imageUrl: null,
})

const playlist = (id: string, ownerId: string, collaborative = false): LibraryItem => ({
  category: 'playlists',
  id,
  uri: `spotify:playlist:${id}`,
  name: `List ${id}`,
  subtitle: '',
  imageUrl: null,
  playlist: {
    ownerId,
    ownerName: null,
    collaborative,
    isPublic: true,
    description: 'd',
    itemCount: 0,
  },
})

function ctx(
  source: SpotifyApi,
  target: SpotifyApi,
  extra: Partial<TransferContext> = {},
): TransferContext {
  return {
    source,
    target,
    sourceUserId: 'me',
    targetUserId: 'me2',
    sleep: vi.fn(async () => {}),
    ...extra,
  }
}

const noOpts = { keepOrder: false, skipDuplicates: false }

describe('runTransfer: library items', () => {
  it('saves oldest first in batches of 40', async () => {
    const target = fakeApi()
    // Spotify lists newest first: t0 is the most recently saved.
    const tracks = Array.from({ length: 85 }, (_, i) => track(i))

    const results = await runTransfer({ tracks }, noOpts, ctx(fakeApi(), target))

    const calls = vi.mocked(target.saveToLibrary).mock.calls.map((c) => c[0])
    expect(calls.map((c) => c.length)).toEqual([40, 40, 5])
    expect(calls[0]![0]).toBe('spotify:track:t84')
    expect(calls[2]!.at(-1)).toBe('spotify:track:t0')
    expect(summarize(results).ok).toBe(85)
  })

  it('keeps order by saving one track per second', async () => {
    const target = fakeApi()
    const sleep = vi.fn(async () => {})
    await runTransfer(
      { tracks: [track(0), track(1), track(2)] },
      { ...noOpts, keepOrder: true },
      ctx(fakeApi(), target, { sleep }),
    )

    expect(vi.mocked(target.saveToLibrary).mock.calls.map((c) => c[0])).toEqual([
      ['spotify:track:t2'],
      ['spotify:track:t1'],
      ['spotify:track:t0'],
    ])
    expect(sleep).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(1000, undefined)
  })

  it('skips what the target already has', async () => {
    const target = fakeApi({
      libraryContains: vi.fn(async (uris: string[]) => uris.map((u) => u.endsWith('t1'))),
    })
    const results = await runTransfer(
      { tracks: [track(0), track(1)] },
      { ...noOpts, skipDuplicates: true },
      ctx(fakeApi(), target),
    )

    expect(vi.mocked(target.saveToLibrary).mock.calls).toEqual([[['spotify:track:t0'], undefined]])
    expect(results.find((r) => r.item.id === 't1')).toMatchObject({
      status: 'skipped',
      reason: 'result.alreadyInLibrary',
    })
  })

  it('marks a failed batch and keeps going', async () => {
    const target = fakeApi({
      saveToLibrary: vi
        .fn()
        .mockRejectedValueOnce(new SpotifyApiError(403, 'Forbidden'))
        .mockResolvedValue(undefined),
    })
    const tracks = Array.from({ length: 41 }, (_, i) => track(i))
    const results = await runTransfer({ tracks }, noOpts, ctx(fakeApi(), target))

    const counts = summarize(results)
    expect(counts.failed).toBe(40)
    expect(counts.ok).toBe(1)
    expect(results.find((r) => r.status === 'failed')?.reason).toBe('result.forbidden')
  })

  it('marks the rest as cancelled when aborted', async () => {
    const controller = new AbortController()
    const target = fakeApi({
      saveToLibrary: vi.fn(async () => controller.abort()),
    })
    const results = await runTransfer(
      { tracks: [track(0), track(1)], albums: [{ ...track(9), category: 'albums', id: 'a9' }] },
      { ...noOpts, keepOrder: true },
      ctx(fakeApi(), target, {
        signal: controller.signal,
        sleep: async (_ms, signal) => signal?.throwIfAborted(),
      }),
    )
    expect(summarize(results)).toMatchObject({ ok: 1, cancelled: 2 })
  })

  it('reports progress updates', async () => {
    const onUpdate = vi.fn()
    await runTransfer({ tracks: [track(0)] }, noOpts, ctx(fakeApi(), fakeApi(), { onUpdate }))
    const statuses = onUpdate.mock.calls.map((c) => c[0][0].status)
    expect(statuses).toEqual(['pending', 'running', 'ok'])
  })
})

describe('runTransfer: playlists', () => {
  it('copies owned playlists and follows others, oldest first', async () => {
    const source = fakeApi({
      playlistItems: vi.fn(async (_id: string, offset: number) =>
        paging(
          [
            { added_at: '', is_local: false, item: { uri: 'spotify:track:a' } },
            { added_at: '', is_local: false, track: { uri: 'spotify:episode:b' } },
            { added_at: '', is_local: true, item: { uri: 'spotify:local:x' } },
          ] as never[],
          offset,
        ),
      ),
    })
    const target = fakeApi()
    const lists = [
      playlist('collab', 'me', true),
      playlist('theirs', 'someone'),
      playlist('mine', 'me'),
    ]

    const results = await runTransfer({ playlists: lists }, noOpts, ctx(source, target))

    expect(target.createPlaylist).toHaveBeenCalledTimes(1)
    expect(target.createPlaylist).toHaveBeenCalledWith(
      { name: 'List mine', public: true, description: 'd' },
      undefined,
    )
    expect(target.addPlaylistItems).toHaveBeenCalledWith(
      'new-List mine',
      ['spotify:track:a', 'spotify:episode:b'],
      undefined,
    )
    expect(vi.mocked(target.saveToLibrary).mock.calls.map((c) => c[0])).toEqual([
      ['spotify:playlist:theirs'],
      ['spotify:playlist:collab'],
    ])
    expect(results.find((r) => r.item.id === 'mine')).toMatchObject({
      status: 'ok',
      added: 2,
      omitted: 1,
    })
  })

  it('adds items in pages of 100', async () => {
    const entries = Array.from({ length: 230 }, (_, i) => ({
      added_at: '',
      is_local: false,
      item: { uri: `spotify:track:${i}` },
    }))
    const source = fakeApi({
      playlistItems: vi.fn(async (_id: string, o: number) => paging(entries as never[], o)),
    })
    const target = fakeApi()
    await runTransfer({ playlists: [playlist('mine', 'me')] }, noOpts, ctx(source, target))
    expect(vi.mocked(target.addPlaylistItems).mock.calls.map((c) => c[1].length)).toEqual([
      100, 100, 30,
    ])
  })

  it('skips copies whose name already exists in the target and already-followed playlists', async () => {
    const target = fakeApi({
      myPlaylists: vi.fn(async () =>
        paging([{ name: 'List mine', owner: { id: 'me2' } }] as never[]),
      ),
      libraryContains: vi.fn(async (uris: string[]) => uris.map(() => true)),
    })
    const results = await runTransfer(
      { playlists: [playlist('mine', 'me'), playlist('theirs', 'x')] },
      { ...noOpts, skipDuplicates: true },
      ctx(fakeApi(), target),
    )
    expect(target.createPlaylist).not.toHaveBeenCalled()
    expect(target.saveToLibrary).not.toHaveBeenCalled()
    expect(summarize(results).skipped).toBe(2)
  })
})
