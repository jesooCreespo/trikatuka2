/**
 * Available languages, derived from the files in `./locales/` at build time.
 * Adding `locales/<code>.json` is all it takes to add a language: no code changes.
 */

export const DEFAULT_LANGUAGE = 'en';

/** `./locales/de.json` -> `de` */
export function codeFromPath(path: string): string {
  return path.replace(/^.*\//, '').replace(/\.json$/, '');
}

/** The language's own name, e.g. "Deutsch" for `de`, as provided by the browser. */
export function languageName(code: string): string {
  try {
    const name = new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code;
    return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
  } catch {
    return code;
  }
}

/**
 * Maps a browser language (e.g. `it-IT`) to the best available one: exact match, then the
 * base language (`it`), then any regional variant of it (`pt` -> `pt-BR`), else the default.
 */
export function pickLanguage(requested: string | undefined, available: readonly string[]): string {
  if (!requested) return DEFAULT_LANGUAGE;
  const lower = requested.toLowerCase();
  const exact = available.find((code) => code.toLowerCase() === lower);
  if (exact) return exact;
  const base = lower.split('-')[0]!;
  return (
    available.find((code) => code.toLowerCase() === base) ??
    available.find((code) => code.toLowerCase().split('-')[0] === base) ??
    DEFAULT_LANGUAGE
  );
}
