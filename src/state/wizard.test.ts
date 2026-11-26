import type { LibraryItem } from '@/lib/library'
import type { AuthData } from '@/lib/spotify/types'
import { useSession } from './session'
import { useWizard } from './wizard'

const auth = (token: string): AuthData => ({
  accessToken: token,
  refreshToken: `r-${token}`,
  expiresAt: Date.now() + 3_600_000,
  scope: '',
})
const profile = (id: string) => ({ id, display_name: id, uri: `spotify:user:${id}`, images: [] })
const track = (id: string): LibraryItem => ({
  category: 'tracks',
  id,
  uri: `spotify:track:${id}`,
  name: id,
  subtitle: '',
  imageUrl: null,
})
const selectedTracks = () => Object.keys(useWizard.getState().selection.tracks)

describe('account swap', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useSession.setState({ accounts: {} })
    useWizard.setState({ selections: {}, results: [] })
    useWizard.getState().syncSource()
    useSession.getState().setAccount('old', { auth: auth('alice'), profile: profile('alice') })
    useSession.getState().setAccount('new', { auth: auth('bob'), profile: profile('bob') })
  })

  it('exchanges the accounts together with their tokens', () => {
    useSession.getState().swap()
    const { old, new: target } = useSession.getState().accounts
    expect(old).toMatchObject({ profile: { id: 'bob' }, auth: { accessToken: 'bob' } })
    expect(target).toMatchObject({ profile: { id: 'alice' }, auth: { accessToken: 'alice' } })
  })

  it('keeps a selection per source account, so swapping back restores it', () => {
    useWizard.getState().toggle(track('a1'), true)
    expect(selectedTracks()).toEqual(['a1'])

    useSession.getState().swap()
    // Bob is the source now: nothing selected from his library yet.
    expect(selectedTracks()).toEqual([])
    useWizard.getState().toggle(track('b1'), true)

    useSession.getState().swap()
    expect(selectedTracks()).toEqual(['a1'])
    useSession.getState().swap()
    expect(selectedTracks()).toEqual(['b1'])
  })

  it('persists selections per account in sessionStorage', () => {
    useWizard.getState().toggle(track('a1'), true)
    const saved = JSON.parse(sessionStorage.getItem('trikatuka:wizard')!)
    expect(saved.version).toBe(2)
    expect(Object.keys(saved.state.selections.alice.tracks)).toEqual(['a1'])
  })
})
