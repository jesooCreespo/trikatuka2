import { readFileSync } from 'node:fs';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { installFakeSpotify, TEST_LIBRARY, type FakeLibrary } from './fake-spotify';

/**
 * Runs the app under the security headers of firebase.json (CSP, Trusted Types, Permissions-Policy
 * and the rest). Neither `ng serve` nor the Firebase emulator sends `headers`, so they are added to
 * every document response here; any CSP violation or console error fails the test.
 */

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

const firebase = JSON.parse(readFileSync('firebase.json', 'utf8')) as {
  hosting: { headers: HeaderRule[] };
};
/** The headers Firebase sends with every response (the `**` rule). */
const SECURITY_HEADERS = Object.fromEntries(
  firebase.hosting.headers
    .filter((rule) => rule.source === '**')
    .flatMap((rule) => rule.headers)
    .map(({ key, value }) => [key.toLowerCase(), value]),
);

/** Spotify image hosts the policy allows (see CLAUDE.md, "Security headers"). */
const IMAGES = {
  playlist: 'https://mosaic.scdn.co/640/ab67616d0000b273aaaa',
  customPlaylist: 'https://image-cdn-ak.spotifycdn.com/image/ab67706c0000da84bbbb',
  album: 'https://i.scdn.co/image/ab67616d00001e02cccc',
  avatar: 'https://platform-lookaside.fbsbx.com/platform/profilepic/?asid=1',
};

const LIBRARY: FakeLibrary = {
  ...TEST_LIBRARY,
  users: {
    old: { ...TEST_LIBRARY.users.old, images: [{ url: IMAGES.avatar, width: 64, height: 64 }] },
    new: TEST_LIBRARY.users.new,
  },
  playlists: TEST_LIBRARY.playlists.map((p, i) => ({
    ...p,
    images: [{ url: i === 0 ? IMAGES.playlist : IMAGES.customPlaylist, width: 640, height: 640 }],
  })),
  tracks: TEST_LIBRARY.tracks.map((t) => ({
    ...t,
    track: {
      ...(t['track'] as object),
      album: { name: 'Album', images: [{ url: IMAGES.album, width: 300, height: 300 }] },
    },
  })),
};

// A 1×1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

/**
 * `ng serve` injects Vite's live-reload client. Its WebSocket to 127.0.0.1 fails once the document
 * comes from `route.fulfill` (Chrome's Local Network Access checks no longer see a loopback page),
 * whatever the headers. Production builds have no such client.
 */
function isDevServerNoise(message: string) {
  return /\[vite\]|Vite server|WebSocket connection to 'ws:\/\/127\.0\.0\.1/.test(message);
}

interface Guard {
  violations: string[];
  errors: string[];
  images: string[];
}

/**
 * Adds the headers to documents of the app's origin (main page and OAuth popup) and collects CSP
 * violations, console errors and uncaught exceptions of every page of the context.
 */
async function guard(context: BrowserContext, baseURL: string): Promise<Guard> {
  const result: Guard = { violations: [], errors: [], images: [] };
  await context.route(`${baseURL}/**`, async (route) => {
    if (route.request().resourceType() !== 'document') return route.fallback();
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), ...SECURITY_HEADERS } });
  });
  await context.route(/^https:\/\/[^/]*(scdn\.co|spotifycdn\.com|fbsbx\.com)\//, (route) => {
    result.images.push(route.request().url());
    return route.fulfill({ contentType: 'image/png', body: PNG });
  });
  await context.exposeBinding('__reportCspViolation', ({ page }, message: string) => {
    result.violations.push(`${page.url()}: ${message}`);
  });
  await context.addInitScript(() => {
    const report = (window as unknown as { __reportCspViolation: (m: string) => void })
      .__reportCspViolation;
    document.addEventListener('securitypolicyviolation', (e) =>
      report(`${e.effectiveDirective} blocked ${e.blockedURI || 'inline'} (${e.sample})`),
    );
  });
  const watch = (page: Page) => {
    page.on('console', (m) => {
      if (m.type() === 'error' && !isDevServerNoise(m.text())) result.errors.push(m.text());
    });
    page.on('pageerror', (e) => result.errors.push(String(e)));
  };
  context.pages().forEach(watch);
  context.on('page', watch);
  return result;
}

async function signIn(page: Page) {
  const popup = page.waitForEvent('popup');
  // The first free "Sign in" button: From, then To.
  await page.getByRole('button', { name: 'Sign in with Spotify' }).first().click();
  await (await popup).waitForEvent('close');
}

test.use({ locale: 'en-US' });

test('firebase.json sends a CSP and the other security headers', () => {
  const csp = SECURITY_HEADERS['content-security-policy'];
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("require-trusted-types-for 'script'");
  expect(csp).not.toContain('unsafe-eval');
  expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  expect(SECURITY_HEADERS['x-content-type-options']).toBe('nosniff');
  expect(SECURITY_HEADERS['referrer-policy']).toBeTruthy();
  expect(SECURITY_HEADERS['permissions-policy']).toContain('screen-wake-lock=(self)');
});

test('the whole transfer works under the security headers', async ({ context, page, baseURL }) => {
  const result = await guard(context, baseURL!);
  const spotify = await installFakeSpotify(context, { library: LIBRARY });

  const response = await page.goto('/');
  expect(await response!.headerValue('content-security-policy')).toBe(
    SECURITY_HEADERS['content-security-policy'],
  );
  // The stylesheet applies to the screen (critical CSS inlining would leave it `media="print"`
  // until an inline script, blocked by the policy, switches it).
  await expect(page.locator('link[rel="stylesheet"]')).toHaveAttribute('href', /^styles-/);
  await expect(page.locator('link[rel="stylesheet"]')).not.toHaveAttribute('media', 'print');

  await signIn(page);
  await expect(page.getByText('Alice', { exact: true })).toBeVisible();
  await signIn(page);
  await expect(page.getByText('Bob', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByText('Road trip')).toBeVisible();
  await page.getByRole('button', { name: 'Select all (2)' }).click();
  await page.getByRole('tab', { name: /Liked songs/ }).click();
  const songs = page.getByRole('tabpanel', { name: /Liked songs/ });
  await songs.getByText('Song 2', { exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // The backup is a lazy chunk plus a blob: download.
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup' }).click();
  expect((await download).suggestedFilename()).toMatch(/^trikatuka-backup-old-user-.*\.json$/);

  await page.getByRole('button', { name: 'Start transfer' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Start transfer' }).click();
  await expect(page.getByRole('heading', { name: 'Transfer finished' })).toBeVisible();
  expect(spotify.saved).toEqual(['spotify:playlist:theirs', 'spotify:track:t2']);

  // Lazy routes and the language chunk load too.
  await page.getByRole('button', { name: 'Language' }).click();
  await page.getByRole('menuitemradio', { name: 'Italiano' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');
  await page.goto('/help');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: 'Privacy Policy', level: 1 })).toBeVisible();

  expect(result.images).toEqual(expect.arrayContaining(Object.values(IMAGES)));
  expect(result.violations).toEqual([]);
  expect(result.errors).toEqual([]);
});

test('keep-order pauses run in the timer worker under the security headers', async ({
  context,
  page,
  baseURL,
}) => {
  const result = await guard(context, baseURL!);
  const spotify = await installFakeSpotify(context, { library: LIBRARY });

  await page.goto('/');
  await signIn(page);
  await signIn(page);
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('tab', { name: /Liked songs/ }).click();
  const songs = page.getByRole('tabpanel', { name: /Liked songs/ });
  await songs.getByText('Song 1', { exact: true }).click();
  await songs.getByText('Song 2', { exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Keep the order of liked songs').click();

  // Creating the worker is a Trusted Types sink: it must not be blocked (and silently fall back
  // to main-thread timers, which hidden tabs throttle).
  const worker = page.waitForEvent('worker');
  await page.getByRole('button', { name: 'Start transfer' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Start transfer' }).click();
  expect((await worker).url()).toMatch(/\/worker-[\w-]+\.js(\?|$)/);
  await expect(page.getByRole('heading', { name: 'Transfer finished' })).toBeVisible();
  expect(spotify.saved).toEqual(['spotify:track:t2', 'spotify:track:t1']);

  expect(result.violations).toEqual([]);
  expect(result.errors).toEqual([]);
});

test('the theme script still applies dark mode before first paint', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ colorScheme: 'dark' });
  const result = await guard(context, baseURL!);
  // Record whether <html> is already dark when <body> is parsed, i.e. before anything is painted.
  await context.addInitScript(() => {
    new MutationObserver((_, observer) => {
      if (!document.body) return;
      (window as unknown as { darkAtBody: boolean }).darkAtBody =
        document.documentElement.classList.contains('dark');
      observer.disconnect();
    }).observe(document, { childList: true, subtree: true });
  });
  const page = await context.newPage();
  await page.goto('/');
  expect(await page.evaluate(() => (window as unknown as { darkAtBody: boolean }).darkAtBody)).toBe(
    true,
  );
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  expect(result.violations).toEqual([]);
  expect(result.errors).toEqual([]);
  await context.close();
});

test('the policy is enforced: other origins are blocked', async ({ context, page, baseURL }) => {
  const result = await guard(context, baseURL!);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Connect your accounts' })).toBeVisible();
  await page.evaluate(async () => {
    const img = document.createElement('img');
    img.src = 'https://example.com/pixel.png';
    document.body.append(img);
    await fetch('https://example.com/steal').catch(() => undefined);
    try {
      document.body.insertAdjacentHTML('beforeend', '<b>not trusted</b>');
    } catch {
      // Trusted Types reject plain strings.
    }
  });
  await expect
    .poll(() => result.violations.map((v) => v.split(': ')[1]!.split(' ')[0]).sort())
    .toEqual(['connect-src', 'img-src', 'require-trusted-types-for']);
});
