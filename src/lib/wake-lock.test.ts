import { keepScreenAwake, type WakeLockEnv } from './wake-lock'

class FakeDocument extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible'
  setVisibility(state: DocumentVisibilityState) {
    this.visibilityState = state
    this.dispatchEvent(new Event('visibilitychange'))
  }
}

function fakeSentinel() {
  const sentinel = {
    released: false,
    release: vi.fn(async () => {
      sentinel.released = true
    }),
  }
  return sentinel
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

function setup(request: () => Promise<unknown>) {
  const doc = new FakeDocument()
  const requestFn = vi.fn(request)
  const env = {
    navigator: { wakeLock: { request: requestFn } },
    document: doc,
  } as unknown as WakeLockEnv
  return { doc, request: requestFn, env }
}

describe('keepScreenAwake', () => {
  it('does nothing and never throws when the API is missing', () => {
    expect(() => keepScreenAwake({ navigator: {}, document: new FakeDocument() })()).not.toThrow()
    expect(() => keepScreenAwake({})()).not.toThrow()
    // jsdom's real navigator has no wakeLock either.
    expect(() => keepScreenAwake()()).not.toThrow()
  })

  it('swallows denied requests, sync or async', async () => {
    const denied = setup(() => Promise.reject(new DOMException('denied', 'NotAllowedError')))
    const release = keepScreenAwake(denied.env)
    await flush()
    expect(denied.request).toHaveBeenCalledWith('screen')
    expect(() => release()).not.toThrow()

    const throwing = setup(() => {
      throw new TypeError('not supported')
    })
    expect(() => keepScreenAwake(throwing.env)()).not.toThrow()
    await flush()
  })

  it('re-acquires the lock when the page becomes visible again and releases it at the end', async () => {
    const sentinels: ReturnType<typeof fakeSentinel>[] = []
    const { doc, request, env } = setup(async () => {
      const s = fakeSentinel()
      sentinels.push(s)
      return s
    })

    const release = keepScreenAwake(env)
    await flush()
    expect(request).toHaveBeenCalledTimes(1)

    // The browser releases the lock when the page is hidden.
    sentinels[0]!.released = true
    doc.setVisibility('hidden')
    await flush()
    expect(request).toHaveBeenCalledTimes(1)

    doc.setVisibility('visible')
    await flush()
    expect(request).toHaveBeenCalledTimes(2)

    release()
    expect(sentinels[1]!.release).toHaveBeenCalled()
    doc.setVisibility('hidden')
    doc.setVisibility('visible')
    await flush()
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('releases a lock granted after the run already ended', async () => {
    const sentinel = fakeSentinel()
    let grant!: (s: unknown) => void
    const { env } = setup(() => new Promise((resolve) => (grant = resolve)))
    const release = keepScreenAwake(env)
    release()
    grant(sentinel)
    await flush()
    expect(sentinel.release).toHaveBeenCalled()
  })

  it('does not request the lock while the page is hidden', async () => {
    const { doc, request, env } = setup(async () => fakeSentinel())
    doc.visibilityState = 'hidden'
    const release = keepScreenAwake(env)
    await flush()
    expect(request).not.toHaveBeenCalled()
    release()
  })
})
