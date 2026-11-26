import { TestBed } from '@angular/core/testing';
import type { LibraryItem } from '@/lib/library';
import type { AuthData } from '@/lib/spotify/types';
import { Session } from './session';
import { Wizard } from './wizard';

const auth = (token: string): AuthData => ({
  accessToken: token,
  refreshToken: `r-${token}`,
  expiresAt: Date.now() + 3_600_000,
  scope: '',
});
const profile = (id: string) => ({ id, display_name: id, uri: `spotify:user:${id}`, images: [] });
const track = (id: string): LibraryItem => ({
  category: 'tracks',
  id,
  uri: `spotify:track:${id}`,
  name: id,
  subtitle: '',
  imageUrl: null,
});

describe('account swap', () => {
  let session: Session;
  let wizard: Wizard;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.resetTestingModule();
    session = TestBed.inject(Session);
    wizard = TestBed.inject(Wizard);
    session.setAccount('old', { auth: auth('alice'), profile: profile('alice') });
    session.setAccount('new', { auth: auth('bob'), profile: profile('bob') });
  });

  it('exchanges the accounts together with their tokens', () => {
    session.swap();
    expect(session.accounts().old?.profile.id).toBe('bob');
    expect(session.accounts().old?.auth.accessToken).toBe('bob');
    expect(session.accounts().new?.profile.id).toBe('alice');
    expect(session.accounts().new?.auth.accessToken).toBe('alice');
  });

  it('keeps a selection per source account, so swapping back restores it', () => {
    wizard.toggle(track('a1'), true);
    expect(Object.keys(wizard.selection().tracks)).toEqual(['a1']);

    session.swap();
    // Bob is the source now: nothing selected from his library yet.
    expect(wizard.selectionCount()).toBe(0);
    wizard.toggle(track('b1'), true);

    session.swap();
    expect(Object.keys(wizard.selection().tracks)).toEqual(['a1']);
    session.swap();
    expect(Object.keys(wizard.selection().tracks)).toEqual(['b1']);
  });

  it('persists selections per account in sessionStorage', () => {
    wizard.toggle(track('a1'), true);
    const saved = JSON.parse(sessionStorage.getItem('trikatuka:wizard:v2')!);
    expect(Object.keys(saved.selections.alice.tracks)).toEqual(['a1']);
  });
});
