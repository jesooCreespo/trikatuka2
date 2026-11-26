import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { installFakeSpotify, TEST_LIBRARY } from './fake-spotify'

test.use({ locale: 'en-US' })

async function signIn(page: Page) {
  const popup = page.waitForEvent('popup')
  // The first free "Sign in" button: From, then To.
  await page.getByRole('button', { name: 'Sign in with Spotify' }).first().click()
  await (await popup).waitForEvent('close')
}

test('transfers selected playlists and liked songs to the new account', async ({
  page,
  context,
}) => {
  const spotify = await installFakeSpotify(context)
  // Ads are off by default: nothing may be requested from Google.
  const adRequests: string[] = []
  page.on('request', (r) => r.url().includes('googlesyndication') && adRequests.push(r.url()))
  await page.goto('/')

  // Step 1: connect both accounts.
  await expect(page.getByRole('heading', { name: 'Connect your accounts' })).toBeVisible()
  await signIn(page)
  await expect(page.getByText('Alice', { exact: true })).toBeVisible()
  await signIn(page)
  await expect(page.getByText('Bob', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  // Step 2: choose.
  await expect(page.getByRole('heading', { name: 'Choose what to transfer' })).toBeVisible()
  await expect(page.getByText('Road trip')).toBeVisible()
  await expect(page.getByText('Copy', { exact: true })).toBeVisible()
  await expect(page.getByText('Follow', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Select all (2)' }).click()

  await page.getByRole('tab', { name: /Liked songs/ }).click()
  await page.getByPlaceholder('Search by name or artist').fill('Song 2')
  await expect(page.getByText('Song 1')).toBeHidden()
  await page.getByText('Song 2').click()
  await expect(page.getByText('3 items selected')).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  // Step 4: review and start.
  await expect(page.getByText('1 copied, 1 followed')).toBeVisible()
  await page.getByRole('button', { name: 'Start transfer' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Start transfer' }).click()

  // Step 6: report.
  await expect(page.getByRole('heading', { name: 'Transfer finished' })).toBeVisible()
  await expect(page.getByText('Everything went through.')).toBeVisible()

  expect(spotify.created).toEqual([
    { name: 'Road trip', public: true, description: 'Songs for the car' },
  ])
  expect(spotify.added).toEqual([
    { playlistId: 'copy-1', uris: ['spotify:track:t1', 'spotify:track:t2'] },
  ])
  expect(spotify.saved).toEqual(['spotify:playlist:theirs', 'spotify:track:t2'])
  expect(adRequests).toEqual([])
  await expect(page.locator('ins.adsbygoogle')).toHaveCount(0)
})

test('shows the Italian UI when the browser is in Italian', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'it-IT' })
  const page = await context.newPage()
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Collega i tuoi account' })).toBeVisible()
  await context.close()
})

test('switches language from the menu, loading it on demand, and remembers it', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Connect your accounts' })).toBeVisible()

  const italianChunk = page.waitForResponse((r) => /\/assets\/it-[\w-]+\.js$/.test(r.url()))
  await page.getByRole('button', { name: 'Language' }).click()
  await page.getByRole('menuitemradio', { name: 'Italiano' }).click()
  await italianChunk
  await expect(page.getByRole('heading', { name: 'Collega i tuoi account' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'it')

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Collega i tuoi account' })).toBeVisible()
})

test('shows the privacy policy inside the app, also from its old address', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'it-IT' })
  const page = await context.newPage()
  await page.goto('/')
  await page.getByRole('link', { name: 'Privacy' }).click()
  await expect(page).toHaveURL('/privacy')
  await expect(page.getByRole('heading', { name: 'Privacy Policy', level: 1 })).toBeVisible()
  // The app's own header and the note about the English-only text are there.
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page.getByText('Questa informativa è disponibile solo in inglese.')).toBeVisible()

  await page.goto('/privacypolicy.html')
  await expect(page).toHaveURL('/privacy')
  await context.close()
})

test('the help page and the OAuth callback route are served', async ({ page }) => {
  await page.goto('/help')
  await expect(page.getByRole('heading', { name: 'How Trikatuka works' })).toBeVisible()
  // Opened directly (no popup opener), the callback page sends the user home.
  await page.goto('/afterLogin?error=access_denied&state=old.x')
  await expect(page).toHaveURL('/')
})

test('keeps the order of liked songs, timing the pauses in a worker', async ({ page, context }) => {
  // Slow writes keep the run step on screen long enough to check it.
  const spotify = await installFakeSpotify(context, { writeDelayMs: 400 })
  await page.goto('/')
  await signIn(page)
  await signIn(page)
  await page.getByRole('button', { name: 'Continue' }).click()

  await page.getByRole('tab', { name: /Liked songs/ }).click()
  await page.getByRole('button', { name: 'Select all (3)' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('Keep the order of liked songs').click()

  // The 1 s pauses between saves run in a dedicated worker (not throttled in background tabs).
  const worker = page.waitForEvent('worker')
  await page.getByRole('button', { name: 'Start transfer' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Start transfer' }).click()
  expect((await worker).url()).toMatch(/\/timer\.worker-[\w-]+\.js(\?|$)/)

  await expect(page.getByText('Liked songs are saved one at a time')).toBeVisible()
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(violations.map((v) => v.id)).toEqual([])

  await expect(page.getByRole('heading', { name: 'Transfer finished' })).toBeVisible()
  // One song per request, oldest first.
  expect(spotify.saved).toEqual(['spotify:track:t3', 'spotify:track:t2', 'spotify:track:t1'])
})

test('loads and copies large libraries page by page, in order', async ({ page, context }) => {
  // Several pages of 50, read a few at a time: each must arrive once, in Spotify's order.
  const uris = Array.from({ length: 237 }, (_, i) => `spotify:track:p${i}`)
  const spotify = await installFakeSpotify(context, {
    library: {
      ...TEST_LIBRARY,
      playlists: [{ ...TEST_LIBRARY.playlists[0]!, items: { total: uris.length } }],
      playlistItems: {
        mine: uris.map((uri) => ({ added_at: '', is_local: false, item: { uri } })),
      },
      tracks: Array.from({ length: 180 }, (_, i) => ({
        added_at: '',
        track: {
          id: `s${i}`,
          name: `Track ${i}`,
          uri: `spotify:track:s${i}`,
          type: 'track',
          artists: [{ id: 'a', name: 'Band', uri: 'spotify:artist:a' }],
          album: { name: 'Album', images: [] },
        },
      })),
    },
  })
  await page.goto('/')
  await signIn(page)
  await signIn(page)
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByText('Road trip')).toBeVisible()
  await page.getByRole('button', { name: 'Select all (1)' }).click()
  await page.getByRole('tab', { name: /Liked songs/ }).click()
  const songs = page.getByRole('tabpanel', { name: /Liked songs/ })
  await expect(songs.getByRole('button', { name: 'Select all (180)' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  await page.getByRole('button', { name: 'Start transfer' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Start transfer' }).click()
  await expect(page.getByRole('heading', { name: 'Transfer finished' })).toBeVisible()

  expect(spotify.added.map((a) => a.uris.length)).toEqual([100, 100, 37])
  expect(spotify.added.flatMap((a) => a.uris)).toEqual(uris)
})

test('shows the progress of each playlist while transferring', async ({ page, context }) => {
  const uris = Array.from({ length: 237 }, (_, i) => `spotify:track:p${i}`)
  // Slow writes keep the run step on screen long enough to follow each playlist.
  await installFakeSpotify(context, {
    writeDelayMs: 500,
    library: {
      ...TEST_LIBRARY,
      playlists: [
        { ...TEST_LIBRARY.playlists[0]!, items: { total: uris.length } },
        TEST_LIBRARY.playlists[1]!,
      ],
      playlistItems: {
        mine: uris.map((uri) => ({ added_at: '', is_local: false, item: { uri } })),
      },
    },
  })
  await page.goto('/')
  await signIn(page)
  await signIn(page)
  await page.getByRole('button', { name: 'Continue' }).click()

  await page.getByRole('button', { name: 'Select all (2)' }).click()
  await page.getByRole('tab', { name: /Liked songs/ }).click()
  await page
    .getByRole('tabpanel', { name: /Liked songs/ })
    .getByText('Song 1', { exact: true })
    .click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Start transfer' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Start transfer' }).click()

  // Playlists are open by default; the one being copied shows its phase and a bar.
  const playlists = page.locator('details', { hasText: 'Playlists' })
  await expect(playlists).toHaveAttribute('open', '')
  await expect(playlists.getByText(/^Adding \d+ of 237$/)).toBeVisible()
  await expect(playlists.getByRole('progressbar', { name: /^Adding \d+ of 237$/ })).toBeVisible()
  // The followed playlist (processed first, oldest first) already shows its outcome.
  await expect(playlists.getByText('Followed')).toBeVisible()

  // Other sections are collapsed until opened.
  const songs = page.locator('details', { hasText: 'Liked songs' })
  await expect(songs).not.toHaveAttribute('open', '')
  await songs.locator('summary').click()
  await expect(songs.getByText('Song 1')).toBeVisible()

  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([])

  await expect(page.getByRole('heading', { name: 'Transfer finished' })).toBeVisible({
    timeout: 15_000,
  })
})

test('swaps the accounts without reloading what was already loaded', async ({ page, context }) => {
  await installFakeSpotify(context)
  // Count library reads per account (the fake tells accounts apart by their token).
  const reads: string[] = []
  page.on('request', (r) => {
    const url = new URL(r.url())
    if (url.hostname === 'api.spotify.com' && url.pathname === '/v1/me/playlists') {
      reads.push((r.headers()['authorization'] ?? '').endsWith('tok-old') ? 'alice' : 'bob')
    }
  })

  await page.goto('/')
  await signIn(page)
  await signIn(page)
  const from = page.getByRole('region', { name: 'From: old account' })
  const to = page.getByRole('region', { name: 'To: new account' })
  await expect(from.getByText('Alice', { exact: true })).toBeVisible()
  await expect(to.getByText('Bob', { exact: true })).toBeVisible()

  // Alice's library, and a selection from it.
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByText('Road trip', { exact: true }).click()
  await expect(page.getByText('1 item selected')).toBeVisible()
  expect(reads).toEqual(['alice'])

  // Swap: Bob becomes the source (his library is empty in the fake) and From/To trade places.
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByRole('button', { name: 'Swap accounts' }).click()
  await expect(from.getByText('Bob', { exact: true })).toBeVisible()
  await expect(to.getByText('Alice', { exact: true })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Accounts swapped' })).toHaveText(
    'Accounts swapped: from Bob to Alice',
  )
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('Nothing in this section.')).toBeVisible()
  await expect(page.getByText('Select at least one item to continue.')).toBeVisible()
  expect(reads).toEqual(['alice', 'bob'])

  // Swap back: Alice's library and selection come back with no new request to Spotify.
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByRole('button', { name: 'Swap accounts' }).click()
  await expect(from.getByText('Alice', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('Road trip', { exact: true })).toBeVisible()
  await expect(page.getByText('1 item selected')).toBeVisible()
  expect(reads).toEqual(['alice', 'bob'])

  // The review shows the direction of the transfer.
  await page.getByRole('button', { name: 'Continue' }).click()
  const review = page.locator('main')
  await expect(review.getByText('Alice', { exact: true })).toBeVisible()
  await expect(page.locator('[data-slot="card"]').filter({ hasText: /^From/ })).toContainText(
    'Alice',
  )
})
