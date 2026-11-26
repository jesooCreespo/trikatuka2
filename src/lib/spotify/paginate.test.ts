import { chunk, fetchAllCursor, fetchAllOffset } from './paginate'

describe('fetchAllOffset', () => {
  it('walks pages until the total is reached', async () => {
    const data = Array.from({ length: 120 }, (_, i) => i)
    const fetchPage = vi.fn(async (offset: number) => ({
      items: data.slice(offset, offset + 50),
      total: data.length,
      limit: 50,
      offset,
      next: offset + 50 < data.length ? 'next' : null,
    }))
    const progress = vi.fn()

    await expect(fetchAllOffset(fetchPage, progress)).resolves.toEqual(data)
    expect(fetchPage.mock.calls.map((c) => c[0])).toEqual([0, 50, 100])
    expect(progress).toHaveBeenLastCalledWith(120, 120)
  })

  it('stops on an empty page even if total says otherwise', async () => {
    const fetchPage = vi.fn(async () => ({ items: [], total: 10, limit: 50, offset: 0, next: 'x' }))
    await expect(fetchAllOffset(fetchPage)).resolves.toEqual([])
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })
})

describe('fetchAllCursor', () => {
  it('follows the `after` cursor', async () => {
    const pages = [
      { items: ['a', 'b'], total: 3, limit: 2, next: 'n', cursors: { after: 'b' } },
      { items: ['c'], total: 3, limit: 2, next: null, cursors: { after: null } },
    ]
    const fetchPage = vi.fn(async (after: string | null) => pages[after ? 1 : 0]!)
    await expect(fetchAllCursor(fetchPage)).resolves.toEqual(['a', 'b', 'c'])
    expect(fetchPage.mock.calls.map((c) => c[0])).toEqual([null, 'b'])
  })
})

describe('chunk', () => {
  it('splits into fixed-size parts', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 3)).toEqual([])
  })
})
