// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { codeFromPath, languageName, pickLanguage } from './languages'

/**
 * Gatekeeper for translation files: every file in `locales/` must match `en.json` in shape and
 * contain only plain text. This is what makes "just add a file" safe.
 */

const DIR = fileURLToPath(new URL('./locales/', import.meta.url))
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const HTML = /<\/?[a-z!][^>]*>/i
const URL_LIKE = /\b(?:https?:|ftp:|javascript:|data:|mailto:)|\bwww\.|\/\//i
const PLACEHOLDER = /\{\{\s*([\w.]+)\s*(?:,[^}]*)?\}\}/g

type Flat = Map<string, string>

/** Parses JSON keeping every key, including `__proto__`, so it can be checked. */
function readLocale(file: string): { flat: Flat; problems: string[] } {
  const problems: string[] = []
  const flat: Flat = new Map()
  const raw = readFileSync(`${DIR}${file}`, 'utf-8')
  const data = JSON.parse(raw, function (key, value: unknown) {
    if (FORBIDDEN_KEYS.has(key)) problems.push(`forbidden key "${key}"`)
    return value
  }) as unknown

  const walk = (node: unknown, prefix: string) => {
    if (typeof node === 'string') {
      flat.set(prefix, node)
    } else if (node && typeof node === 'object' && !Array.isArray(node)) {
      for (const [key, value] of Object.entries(node))
        walk(value, prefix ? `${prefix}.${key}` : key)
    } else {
      problems.push(`"${prefix}" must be a string or an object`)
    }
  }
  walk(data, '')
  return { flat, problems }
}

const placeholders = (text: string) =>
  [...new Set([...text.matchAll(PLACEHOLDER)].map((m) => m[1]!))].sort()

const files = readdirSync(DIR)
const en = readLocale('en.json').flat

/** `select.itemCount_one` -> `select.itemCount`; only for keys English pluralizes. */
const enPluralBases = new Set(
  [...en.keys()].filter((k) => PLURAL_SUFFIX.test(k)).map((k) => k.replace(PLURAL_SUFFIX, '')),
)
const enPlain = [...en.keys()].filter((k) => !PLURAL_SUFFIX.test(k)).sort()

describe('locale files', () => {
  it('only contains .json files', () => {
    expect(files.filter((f) => !f.endsWith('.json'))).toEqual([])
    expect(files).toContain('en.json')
  })

  describe.each(files.filter((f) => f.endsWith('.json')))('%s', (file) => {
    const code = codeFromPath(file)
    const { flat, problems } = readLocale(file)

    it('is named after a valid language code', () => {
      expect(Intl.getCanonicalLocales(code)).toEqual([code])
    })

    it('has only nested objects and strings, with no forbidden keys', () => {
      expect(problems).toEqual([])
    })

    it('has exactly the keys of en.json', () => {
      const plain = [...flat.keys()].filter((k) => !enPluralBases.has(k.replace(PLURAL_SUFFIX, '')))
      expect(plain.sort()).toEqual(enPlain)
    })

    it('has the plural forms this language needs (and no others)', () => {
      const needed = new Intl.PluralRules(code).resolvedOptions().pluralCategories.slice().sort()
      for (const base of enPluralBases) {
        const forms = [...flat.keys()]
          .filter((k) => k.replace(PLURAL_SUFFIX, '') === base && PLURAL_SUFFIX.test(k))
          .map((k) => k.match(PLURAL_SUFFIX)![1])
          .sort()
        expect(forms, base).toEqual(needed)
      }
    })

    it('uses the same placeholders as en.json', () => {
      for (const [key, text] of flat) {
        const base = key.replace(PLURAL_SUFFIX, '')
        if (enPluralBases.has(base)) {
          // A singular form may leave out {{count}} ("one item"), but can't invent placeholders.
          const allowed = placeholders(en.get(`${base}_other`) ?? '')
          expect(
            placeholders(text).filter((p) => !allowed.includes(p)),
            key,
          ).toEqual([])
        } else {
          expect(placeholders(text), key).toEqual(placeholders(en.get(key) ?? ''))
        }
      }
    })

    it('contains plain text only: no HTML and no links', () => {
      for (const [key, text] of flat) {
        expect(HTML.test(text), `${key}: ${text}`).toBe(false)
        expect(URL_LIKE.test(text), `${key}: ${text}`).toBe(false)
      }
    })
  })
})

describe('languages', () => {
  it('names each language in itself', () => {
    expect(languageName('en')).toBe('English')
    expect(languageName('it')).toBe('Italiano')
    expect(languageName('de')).toBe('Deutsch')
  })

  it('picks the closest available language', () => {
    const available = ['en', 'it', 'pt-BR']
    expect(pickLanguage('it-IT', available)).toBe('it')
    expect(pickLanguage('IT', available)).toBe('it')
    expect(pickLanguage('pt', available)).toBe('pt-BR')
    expect(pickLanguage('pt-BR', available)).toBe('pt-BR')
    expect(pickLanguage('fr-FR', available)).toBe('en')
    expect(pickLanguage(undefined, available)).toBe('en')
  })

  it('derives the code from the file path', () => {
    expect(codeFromPath('./locales/pt-BR.json')).toBe('pt-BR')
  })
})
