import type { TimerRequest } from './protocol'
import { createWorkerSleep, workerSleep, type Sleep } from './worker-sleep'

/** In-memory stand-in for the timer worker: records requests, fires timers on demand. */
class FakeWorker extends EventTarget {
  readonly requests: TimerRequest[] = []
  postMessage(message: TimerRequest) {
    this.requests.push(message)
  }
  fire(id: number) {
    this.dispatchEvent(new MessageEvent('message', { data: { id } }))
  }
  started() {
    return this.requests.filter((r) => r.ms >= 0)
  }
}

const abortError = () => new DOMException('stopped', 'AbortError')

/** Settles to 'resolved', the rejection reason, or 'pending' after flushing microtasks. */
async function state(promise: Promise<void>) {
  let result: unknown = 'pending'
  promise.then(
    () => (result = 'resolved'),
    (error: unknown) => (result = error),
  )
  for (let i = 0; i < 5; i++) await Promise.resolve()
  return result
}

type TimerRequestLike = { id: number; ms: number }

describe('workerSleep without Worker support (fallback)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('jsdom has no Worker, so it uses the main-thread timer', async () => {
    expect(typeof Worker).toBe('undefined')
    const sleep = workerSleep(1000)
    await vi.advanceTimersByTimeAsync(999)
    expect(await state(sleep)).toBe('pending')
    await vi.advanceTimersByTimeAsync(1)
    expect(await state(sleep)).toBe('resolved')
  })

  it('rejects with signal.reason on abort and clears the timer', async () => {
    const controller = new AbortController()
    const reason = abortError()
    const sleep = workerSleep(1000, controller.signal)
    controller.abort(reason)
    await expect(sleep).rejects.toBe(reason)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects at once when the signal is already aborted', async () => {
    const controller = new AbortController()
    const reason = abortError()
    controller.abort(reason)
    await expect(workerSleep(1000, controller.signal)).rejects.toBe(reason)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('falls back when creating the worker throws', async () => {
    const fallback = vi.fn<Sleep>(async () => {})
    const sleep = createWorkerSleep(() => {
      throw new Error('blocked by CSP')
    }, fallback)
    await sleep(5)
    expect(fallback).toHaveBeenCalledWith(5, undefined)
  })
})

describe('createWorkerSleep with a worker', () => {
  function setup() {
    const worker = new FakeWorker()
    const createWorker = vi.fn(() => worker)
    const fallback = vi.fn<Sleep>(async () => {})
    let now = 0
    const sleep = createWorkerSleep(createWorker, fallback, () => now)
    return { worker, createWorker, fallback, sleep, advance: (ms: number) => (now += ms) }
  }

  it('shares one lazily created worker between concurrent sleeps', async () => {
    const { worker, createWorker, fallback, sleep } = setup()
    expect(createWorker).not.toHaveBeenCalled()

    const a = sleep(1000)
    const b = sleep(500)
    expect(createWorker).toHaveBeenCalledTimes(1)
    const [ra, rb] = worker.started() as [TimerRequestLike, TimerRequestLike]
    expect(ra.ms).toBe(1000)
    expect(rb.ms).toBe(500)
    expect(ra.id).not.toBe(rb.id)

    worker.fire(rb.id)
    expect(await state(b)).toBe('resolved')
    expect(await state(a)).toBe('pending')
    worker.fire(ra.id)
    expect(await state(a)).toBe('resolved')
    expect(fallback).not.toHaveBeenCalled()
  })

  it('on abort rejects with signal.reason and cancels the worker timer', async () => {
    const { worker, sleep } = setup()
    const controller = new AbortController()
    const reason = abortError()
    const pending = sleep(1000, controller.signal)
    const { id } = worker.started()[0]!

    controller.abort(reason)
    await expect(pending).rejects.toBe(reason)
    expect(worker.requests).toContainEqual({ id, ms: -1 })

    // A late message for the cancelled timer is ignored.
    worker.fire(id)
    expect(await state(pending)).toBe(reason)
  })

  it('does not touch the worker when the signal is already aborted', async () => {
    const { worker, sleep } = setup()
    const controller = new AbortController()
    controller.abort(abortError())
    await expect(sleep(1000, controller.signal)).rejects.toBeInstanceOf(DOMException)
    expect(worker.requests).toEqual([])
  })

  it('continues pending sleeps on the main thread when the worker fails', async () => {
    const { worker, fallback, sleep, advance } = setup()
    const controller = new AbortController()
    const pending = sleep(1000, controller.signal)
    advance(300)

    worker.dispatchEvent(new Event('error'))
    expect(await state(pending)).toBe('resolved')
    expect(fallback).toHaveBeenCalledWith(700, controller.signal)

    // Later sleeps skip the broken worker.
    await sleep(50)
    expect(fallback).toHaveBeenLastCalledWith(50, undefined)
    expect(worker.started()).toHaveLength(1)
  })
})
