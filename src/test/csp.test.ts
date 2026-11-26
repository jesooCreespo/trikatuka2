// @vitest-environment node
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * Guard for the Content Security Policy in firebase.json: the inline theme script of index.html
 * is allowed by its SHA-256 hash, so editing it must update the hash (the test prints the value).
 */

const root = fileURLToPath(new URL('../../', import.meta.url))
const read = (path: string) => readFileSync(`${root}${path}`, 'utf8')

interface FirebaseHeaders {
  hosting: { headers: { source: string; headers: { key: string; value: string }[] }[] }
}

const firebase = JSON.parse(read('firebase.json')) as FirebaseHeaders
const csp = firebase.hosting.headers
  .filter((rule) => rule.source === '**')
  .flatMap((rule) => rule.headers)
  .find((h) => h.key === 'Content-Security-Policy')?.value

const directive = (name: string) =>
  (csp ?? '')
    .split(';')
    .map((d) => d.trim().split(/\s+/))
    .find(([n]) => n === name)
    ?.slice(1) ?? []

describe('Content Security Policy', () => {
  it('is sent for every path', () => {
    expect(csp, 'missing Content-Security-Policy on the "**" rule').toBeTruthy()
  })

  it('allows exactly the inline scripts of the HTML pages, by hash', () => {
    const inline = ['index.html', 'afterLogin.html'].flatMap((page) =>
      [...read(page).matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!),
    )
    expect(inline.length, 'expected the inline theme script').toBeGreaterThan(0)
    const allowed = directive('script-src')
    for (const source of inline) {
      const hash = `'sha256-${createHash('sha256').update(source).digest('base64')}'`
      expect(
        allowed,
        `an inline script changed: put ${hash} in script-src (firebase.json) instead of the old hash`,
      ).toContain(hash)
    }
    // Only those hashes: a stale one would keep allowing a script that no longer exists.
    expect(allowed.filter((s) => s.startsWith("'sha256-"))).toHaveLength(inline.length)
  })

  it('enforces Trusted Types with only the default policy (worker script URLs)', () => {
    expect(directive('require-trusted-types-for')).toEqual(["'script'"])
    expect(directive('trusted-types')).toEqual(['default'])
  })
})
