import { mkdirSync, readFileSync } from 'node:fs'
import { test, type Page } from '@playwright/test'
import { installFakeSpotify } from '../e2e/fake-spotify'
import { DEMO_FAILURES, DEMO_LIBRARY, installDemoCovers } from './demo-library'

/**
 * Generates the demo screenshots in docs/screenshots/ (`npm run screenshots`).
 * Runs the real app against a fake Spotify with a made-up library.
 */

const OUT = 'docs/screenshots'
const readLocale = (code: string) =>
  JSON.parse(readFileSync(`src/i18n/locales/${code}.json`, 'utf-8')) as Record<string, unknown>
const LOCALES = { en: readLocale('en'), it: readLocale('it') }
type Lang = keyof typeof LOCALES

const SHOTS = [
  '1-connect',
  '2-select-playlists',
  '3-select-songs',
  '4-review',
  '5-transfer',
  '6-report',
  '7-privacy',
] as const
type Shot = (typeof SHOTS)[number]

interface Flow {
  lang: Lang
  theme: 'light' | 'dark'
  device: 'desktop' | 'mobile'
  shots: readonly Shot[]
}

const FLOWS: Flow[] = [
  { lang: 'en', theme: 'light', device: 'desktop', shots: SHOTS },
  { lang: 'en', theme: 'dark', device: 'desktop', shots: SHOTS },
  { lang: 'it', theme: 'light', device: 'desktop', shots: SHOTS },
  { lang: 'it', theme: 'dark', device: 'desktop', shots: SHOTS },
  {
    lang: 'en',
    theme: 'light',
    device: 'mobile',
    shots: ['1-connect', '2-select-playlists', '6-report'],
  },
  {
    lang: 'it',
    theme: 'dark',
    device: 'mobile',
    shots: ['1-connect', '2-select-playlists', '6-report'],
  },
]

const VIEWPORTS = {
  desktop: { width: 1280, height: 860 },
  mobile: { width: 390, height: 844 },
}

const PLAYLISTS_TO_PICK = [
  'Road trip 2025',
  'Focus · deep work',
  'Office radio',
  'Fresh Finds Weekly',
  'Acoustic covers',
  'Lo-fi to study',
  'Late night drive',
  "Summer '24",
  'Wedding playlist',
]

/** Looks up a UI string the way the app does, so buttons are found in any language. */
function translator(lang: Lang) {
  return (key: string, vars: Record<string, string | number> = {}) => {
    const value = key
      .split('.')
      .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], LOCALES[lang])
    if (typeof value !== 'string') throw new Error(`Missing translation ${lang}:${key}`)
    return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(vars[name]))
  }
}

async function signIn(page: Page, label: string) {
  const popup = page.waitForEvent('popup')
  // The first free "Sign in" button: From, then To.
  await page.getByRole('button', { name: label }).first().click()
  await (await popup).waitForEvent('close')
}

test.describe.configure({ mode: 'parallel' })

mkdirSync(OUT, { recursive: true })

for (const flow of FLOWS) {
  test(`${flow.lang} ${flow.theme} ${flow.device}`, async ({ browser }) => {
    test.setTimeout(120_000)
    const t = translator(flow.lang)
    const context = await browser.newContext({
      colorScheme: flow.theme,
      locale: flow.lang === 'it' ? 'it-IT' : 'en-US',
      viewport: VIEWPORTS[flow.device],
    })
    await installDemoCovers(context)
    await installFakeSpotify(context, {
      library: DEMO_LIBRARY,
      failUris: DEMO_FAILURES,
      writeDelayMs: 250,
    })
    const page = await context.newPage()

    const shot = async (name: Shot, { idle = true } = {}) => {
      if (!flow.shots.includes(name)) return
      if (idle) await page.waitForLoadState('networkidle')
      await page.screenshot({
        path: `${OUT}/${flow.lang}-${flow.theme}-${flow.device}-${name}.png`,
        fullPage: true,
        animations: 'disabled',
        caret: 'hide',
      })
    }
    const continueButton = () => page.getByRole('button', { name: t('connect.continue') })

    // 1. Connect both accounts.
    await page.goto('/')
    // Full-page captures stitch the page while scrolling: sticky bars would end up in the
    // middle of the image. Only in screenshots, keep them in the normal flow.
    await page.addStyleTag({ content: 'header, .sticky { position: static !important; }' })
    await signIn(page, t('connect.signIn'))
    await signIn(page, t('connect.signIn'))
    await page
      .getByRole('button', { name: t('connect.signOut') })
      .nth(1)
      .waitFor()
    await shot('1-connect')
    await continueButton().click()

    // 2–3. Choose.
    await page.getByText(PLAYLISTS_TO_PICK[0]!, { exact: true }).waitFor()
    for (const name of PLAYLISTS_TO_PICK) await page.getByText(name, { exact: true }).click()
    await shot('2-select-playlists')

    const selectAllIn = async (category: string, count: number) => {
      await page.getByRole('tab', { name: new RegExp(t(`categories.${category}`)) }).click()
      await page.getByRole('button', { name: t('select.selectAllShown', { count }) }).click()
    }
    await selectAllIn('tracks', DEMO_LIBRARY.tracks.length)
    // Show search too, and keep the image short.
    await page.getByPlaceholder(t('select.search')).fill('Golden')
    await shot('3-select-songs')
    await page.getByPlaceholder(t('select.search')).fill('')
    await selectAllIn('albums', DEMO_LIBRARY.albums.length)
    await selectAllIn('artists', DEMO_LIBRARY.artists.length)
    await selectAllIn('shows', DEMO_LIBRARY.shows.length)
    await continueButton().click()

    // 4. Review.
    await page.getByRole('heading', { name: t('review.title') }).waitFor()
    await shot('4-review')

    // 5. Transfer in progress (writes are slowed down by the fake Spotify).
    await page.getByRole('button', { name: t('review.start') }).click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: t('review.start') })
      .click()
    await page.getByRole('heading', { name: t('run.title') }).waitFor()
    await page.waitForTimeout(3500)
    await shot('5-transfer', { idle: false })

    // 6. Report: two followed playlists are refused on purpose, some items are skipped.
    await page.getByRole('heading', { name: t('report.titleIssues') }).waitFor({ timeout: 90_000 })
    await shot('6-report')

    // 7. Privacy policy, now a page of the app.
    await page.getByRole('link', { name: t('footer.privacy') }).click()
    await page.getByRole('heading', { name: 'Privacy Policy', level: 1 }).waitFor()
    await shot('7-privacy')

    await context.close()
  })
}
