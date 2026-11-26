/**
 * Trusted Types `default` policy, used by the browser when a plain string or URL reaches a
 * protected sink under `require-trusted-types-for 'script'` (see the CSP in firebase.json).
 *
 * The only such sink in the app is `new Worker(new URL('./timer.worker', import.meta.url))`
 * (src/lib/timers): the bundler needs that exact form to emit the worker, so it can't be wrapped
 * in a named policy. The default policy therefore accepts script URLs of the app's own worker
 * chunks (`worker-*.js` or `timer.worker-*.js` on this origin) and nothing else; HTML and script
 * strings stay blocked.
 */

interface TrustedTypePolicyFactoryLike {
  createPolicy(name: string, rules: { createScriptURL?: (input: string) => string | null }): unknown
}

// `worker-[hash].js` (Angular) or `timer.worker-[hash].js` (Vite), at any depth on this origin.
const WORKER_CHUNK = /^\/(?:.*\/)?(?:timer\.)?worker-[\w-]+\.js$/

export function allowedWorkerUrl(input: string, origin: string): string | null {
  let url: URL
  try {
    url = new URL(input, origin)
  } catch {
    return null
  }
  // A query string (the dev server may add one) still loads the same file of the app.
  return url.origin === origin && WORKER_CHUNK.test(url.pathname) ? url.href : null
}

export function installDefaultTrustedTypesPolicy(
  factory = (globalThis as { trustedTypes?: TrustedTypePolicyFactoryLike }).trustedTypes,
  origin = globalThis.location?.origin ?? '',
) {
  if (!factory) return
  try {
    factory.createPolicy('default', {
      // Returning null makes the browser block the value.
      createScriptURL: (input) => allowedWorkerUrl(input, origin),
    })
  } catch {
    // Already created, or not allowed by the CSP: the browser keeps enforcing the policy anyway.
  }
}
