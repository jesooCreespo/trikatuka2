import { expect, test, type Page } from '@playwright/test'
import { installFakeSpotify } from './fake-spotify'

test.use({ locale: 'en-US' })

async function signIn(page: Page) {
  const popup = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Sign in with Spotify' }).click()
  await (await popup).waitForEvent('close')
}

test('transfers selected playlists and liked songs to the new account', async ({
  page,
  context,
}) => {
  const spotify = await installFakeSpotify(context)
  await page.goto('/')

  // Step 1–2: connect both accounts.
  await expect(page.getByRole('heading', { name: 'Connect your old account' })).toBeVisible()
  await signIn(page)
  await expect(page.getByText('Alice', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Connect your new account' })).toBeVisible()
  await signIn(page)
  await expect(page.getByText('Bob', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  // Step 3: choose.
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
})

test('shows the Italian UI when the browser is in Italian', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'it-IT' })
  const page = await context.newPage()
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Collega il tuo account vecchio' })).toBeVisible()
  await context.close()
})

test('switches language from the menu, loading it on demand, and remembers it', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Connect your old account' })).toBeVisible()

  const italianChunk = page.waitForResponse((r) => /\/assets\/it-[\w-]+\.js$/.test(r.url()))
  await page.getByRole('button', { name: 'Language' }).click()
  await page.getByRole('menuitemradio', { name: 'Italiano' }).click()
  await italianChunk
  await expect(page.getByRole('heading', { name: 'Collega il tuo account vecchio' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'it')

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Collega il tuo account vecchio' })).toBeVisible()
})

test('the help page and the OAuth callback route are served', async ({ page }) => {
  await page.goto('/help')
  await expect(page.getByRole('heading', { name: 'How Trikatuka works' })).toBeVisible()
  // Opened directly (no popup opener), the callback page sends the user home.
  await page.goto('/afterLogin?error=access_denied&state=old.x')
  await expect(page).toHaveURL('/')
})
