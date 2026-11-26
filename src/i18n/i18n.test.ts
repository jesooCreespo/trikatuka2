import en from './en.json'
import itTranslations from './it.json'

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v as object, `${prefix}${k}.`) : [`${prefix}${k}`],
  )
}

function placeholders(obj: object): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  const walk = (o: object, prefix: string) => {
    for (const [k, v] of Object.entries(o)) {
      if (v && typeof v === 'object') walk(v as object, `${prefix}${k}.`)
      else out[`${prefix}${k}`] = [...String(v).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]!).sort()
    }
  }
  walk(obj, '')
  return out
}

describe('translations', () => {
  it('have the same keys in every language', () => {
    expect(keys(itTranslations).sort()).toEqual(keys(en).sort())
  })

  it('use the same placeholders in every language', () => {
    expect(placeholders(itTranslations)).toEqual(placeholders(en))
  })
})
