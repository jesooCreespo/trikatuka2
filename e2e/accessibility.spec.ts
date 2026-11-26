import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { installFakeSpotify } from './fake-spotify'

/** Every step and page must pass axe-core's WCAG 2.2 AA checks, in both themes. */
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function expectAccessible(page: Page, label: string) {
  // Let animations settle so contrast is measured on final colors.
  await page.waitForTimeout(300)
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze()
  const summary = violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  )
  expect(summary, `AXE violations on ${label}`).toEqual([])
}

async function signIn(page: Page) {
  const popup = page.waitForEvent('popup')
  // The first free "Sign in" button: From, then To.
  await page.getByRole('button', { name: 'Sign in with Spotify' }).first().click()
  await (await popup).waitForEvent('close')
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`every step passes AXE (${colorScheme})`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme, locale: 'en-US' })
    // One failing follow, so the report shows problems.
    await installFakeSpotify(context, { failUris: ['spotify:playlist:theirs'] })
    const page = await context.newPage()

    await page.goto('/')
    await page.getByRole('heading', { name: 'Connect your accounts' }).waitFor()
    await expectAccessible(page, 'connect')
    await signIn(page)
    await page.getByText('Alice', { exact: true }).waitFor()
    await signIn(page)
    await page.getByText('Bob', { exact: true }).waitFor()
    await expectAccessible(page, 'both connected')
    await page.getByRole('button', { name: 'Continue' }).click()

    await page.getByText('Road trip').waitFor()
    await page.getByRole('button', { name: 'Select all (2)' }).click()
    await expectAccessible(page, 'select')
    await page.getByRole('button', { name: 'Continue' }).click()

    await page.getByRole('heading', { name: 'Review and start' }).waitFor()
    await expectAccessible(page, 'review')
    await page.getByRole('button', { name: 'Start transfer' }).click()
    await page.getByRole('alertdialog').waitFor()
    await expectAccessible(page, 'confirm dialog')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Start transfer' }).click()

    await page.getByRole('heading', { name: 'Finished with some problems' }).waitFor()
    await expectAccessible(page, 'report')

    await page.goto('/help')
    await page.getByRole('heading', { name: 'How Trikatuka works' }).waitFor()
    await expectAccessible(page, 'help')
    await page.goto('/privacy')
    await page.getByRole('heading', { name: 'Privacy Policy', level: 1 }).waitFor()
    await expectAccessible(page, 'privacy')
    await context.close()
  })
}
