import i18n, { type ResourceLanguage } from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import resourcesToBackend from 'i18next-resources-to-backend'
import { initReactI18next } from 'react-i18next'
import { codeFromPath, DEFAULT_LANGUAGE, languageName, pickLanguage } from './languages'
import en from './locales/en.json'

/**
 * English is bundled (it's also the fallback for missing keys). Every other file in
 * `./locales/` becomes its own chunk, downloaded only when that language is used.
 * Only files present at build time can ever be loaded: nothing is fetched from elsewhere.
 */
const loaders = import.meta.glob<{ default: ResourceLanguage }>([
  './locales/*.json',
  '!./locales/en.json',
])
const loaderByCode = new Map(
  Object.entries(loaders).map(([path, load]) => [codeFromPath(path), load]),
)

export const LANGUAGE_CODES = [DEFAULT_LANGUAGE, ...[...loaderByCode.keys()].sort()]

export const LANGUAGES = LANGUAGE_CODES.map((code) => ({ code, label: languageName(code) }))

/** Resolves once the detected language is loaded: render after it to avoid a flash of English. */
export const i18nReady = i18n
  .use(LanguageDetector)
  .use(
    resourcesToBackend(async (language: string) => {
      const load = loaderByCode.get(language)
      if (!load) throw new Error(`No translations for "${language}"`)
      return (await load()).default
    }),
  )
  .use(initReactI18next)
  .init({
    resources: { [DEFAULT_LANGUAGE]: { translation: en } },
    // Other languages come from the backend above.
    partialBundledLanguages: true,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: LANGUAGE_CODES,
    load: 'currentOnly',
    interpolation: { escapeValue: false }, // React already escapes everything it renders.
    react: { useSuspense: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'trikatuka:lang',
      caches: ['localStorage'],
      convertDetectedLanguage: (lng) => pickLanguage(lng, LANGUAGE_CODES),
    },
  })

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
})

export default i18n
