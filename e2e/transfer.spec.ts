import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { installFakeSpotify } from './fake-spotify';

test.use({ locale: 'en-US' });

async function signIn(page: Page) {
  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Sign in with Spotify' }).click();
  await (await popup).waitForEvent('close');
}

test('transfers selected playlists and liked songs to the new account', async ({
  page,
  context,
}) => {
  const spotify = await installFakeSpotify(context);
  // Ads are off by default: nothing may be requested from Google.
  const adRequests: string[] = [];
  page.on('request', (r) => r.url().includes('googlesyndication') && adRequests.push(r.url()));
  await page.goto('/');

  // Step 1–2: connect both accounts.
  await expect(page.getByRole('heading', { name: 'Connect your old account' })).toBeVisible();
  await signIn(page);
  await expect(page.getByText('Alice', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Connect your new account' })).toBeVisible();
  await signIn(page);
  await expect(page.getByText('Bob', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 3: choose.
  await expect(page.getByRole('heading', { name: 'Choose what to transfer' })).toBeVisible();
  await expect(page.getByText('Road trip')).toBeVisible();
  await expect(page.getByText('Copy', { exact: true })).toBeVisible();
  await expect(page.getByText('Follow', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Select all (2)' }).click();

  await page.getByRole('tab', { name: /Liked songs/ }).click();
  // Work inside the active tab: sections already opened may stay in the DOM, hidden.
  const songs = page.getByRole('tabpanel', { name: /Liked songs/ });
  await songs.getByPlaceholder('Search by name or artist').fill('Song 2');
  await expect(songs.getByText('Song 1')).toBeHidden();
  await songs.getByText('Song 2', { exact: true }).click();
  await expect(page.getByText('3 items selected')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 4: review and start.
  await expect(page.getByText('1 copied, 1 followed')).toBeVisible();
  await page.getByRole('button', { name: 'Start transfer' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Start transfer' }).click();

  // Step 6: report.
  await expect(page.getByRole('heading', { name: 'Transfer finished' })).toBeVisible();
  await expect(page.getByText('Everything went through.')).toBeVisible();

  expect(spotify.created).toEqual([
    { name: 'Road trip', public: true, description: 'Songs for the car' },
  ]);
  expect(spotify.added).toEqual([
    { playlistId: 'copy-1', uris: ['spotify:track:t1', 'spotify:track:t2'] },
  ]);
  expect(spotify.saved).toEqual(['spotify:playlist:theirs', 'spotify:track:t2']);
  expect(adRequests).toEqual([]);
  await expect(page.locator('ins.adsbygoogle')).toHaveCount(0);
});

test('keeps the order of liked songs, timing the pauses in a worker', async ({ page, context }) => {
  // Slow writes keep the run step on screen long enough to check it.
  const spotify = await installFakeSpotify(context, { writeDelayMs: 400 });
  await page.goto('/');
  await signIn(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await signIn(page);
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('tab', { name: /Liked songs/ }).click();
  await page.getByRole('button', { name: 'Select all (3)' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Keep the order of liked songs').click();

  // The 1 s pauses between saves run in a dedicated worker (not throttled in background tabs).
  const worker = page.waitForEvent('worker');
  await page.getByRole('button', { name: 'Start transfer' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Start transfer' }).click();
  expect((await worker).url()).toMatch(/\/worker-[A-Z0-9]+\.js(\?|$)/);

  await expect(page.getByText('Liked songs are saved one at a time')).toBeVisible();
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(violations.map((v) => v.id)).toEqual([]);

  await expect(page.getByRole('heading', { name: 'Transfer finished' })).toBeVisible();
  // One song per request, oldest first.
  expect(spotify.saved).toEqual(['spotify:track:t3', 'spotify:track:t2', 'spotify:track:t1']);
});

test('shows the Italian UI when the browser is in Italian', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'it-IT' });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Collega il tuo account vecchio' })).toBeVisible();
  await context.close();
});

test('switches language from the menu, loading it on demand, and remembers it', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Connect your old account' })).toBeVisible();

  // Italian isn't in the initial bundle: choosing it downloads its own chunk.
  await page.waitForLoadState('networkidle');
  const scripts: string[] = [];
  page.on('response', (r) => r.url().endsWith('.js') && scripts.push(r.url()));
  await page.getByRole('button', { name: 'Language' }).click();
  await page.getByRole('menuitemradio', { name: 'Italiano' }).click();
  await expect(page.getByRole('heading', { name: 'Collega il tuo account vecchio' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');
  expect(scripts.length).toBeGreaterThan(0);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Collega il tuo account vecchio' })).toBeVisible();
});

test('shows the privacy policy inside the app, also from its old address', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'it-IT' });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('link', { name: 'Privacy' }).click();
  await expect(page).toHaveURL('/privacy');
  await expect(page.getByRole('heading', { name: 'Privacy Policy', level: 1 })).toBeVisible();
  // The app's own header and the note about the English-only text are there.
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByText('Questa informativa è disponibile solo in inglese.')).toBeVisible();

  await page.goto('/privacypolicy.html');
  await expect(page).toHaveURL('/privacy');
  await context.close();
});

test('the help page and the OAuth callback route are served', async ({ page }) => {
  await page.goto('/help');
  await expect(page.getByRole('heading', { name: 'How Trikatuka works' })).toBeVisible();
  // Opened directly (no popup opener), the callback page sends the user home.
  await page.goto('/afterLogin?error=access_denied&state=old.x');
  await expect(page).toHaveURL('/');
});
