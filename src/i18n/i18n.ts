import {
  type EnvironmentProviders,
  inject,
  isDevMode,
  provideAppInitializer,
  Service,
  signal,
} from '@angular/core';
import {
  provideTransloco,
  type Translation,
  type TranslocoLoader,
  TranslocoService,
} from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { LOCALE_LOADERS } from './available-locales';
import { DEFAULT_LANGUAGE, languageName, pickLanguage } from './languages';
import en from './locales/en.json';

type Params = Record<string, unknown>;

/**
 * Languages come from the files in `./locales/` (registered by `npm run i18n:sync`): English is
 * bundled as the fallback, every other language is a lazy chunk loaded only when used. Only files
 * present at build time can ever be loaded: nothing is fetched from elsewhere.
 */
export const LANGUAGE_CODES = [DEFAULT_LANGUAGE, ...Object.keys(LOCALE_LOADERS).sort()];
export const LANGUAGES = LANGUAGE_CODES.map((code) => ({ code, label: languageName(code) }));

const STORAGE_KEY = 'trikatuka:lang';

class LocaleLoader implements TranslocoLoader {
  getTranslation(lang: string): Promise<Translation> {
    if (lang === DEFAULT_LANGUAGE) return Promise.resolve(en);
    const load = LOCALE_LOADERS[lang];
    return load ? load() : Promise.reject(new Error(`No translations for "${lang}"`));
  }
}

/**
 * Translation API for templates and code. `t()`/`tn()` read the `lang` signal, so templates that
 * call them re-render when the language changes.
 */
@Service()
export class I18n {
  private readonly transloco = inject(TranslocoService);
  private readonly active = signal(DEFAULT_LANGUAGE);

  readonly lang = this.active.asReadonly();
  readonly languages = LANGUAGES;

  t(key: string, params?: Params): string {
    this.active();
    return this.transloco.translate(key, params);
  }

  /** Plural-aware translation: picks `key_one`, `key_few`, `key_many`, `key_other`… for `count`. */
  tn(key: string, count: number, params: Params = {}): string {
    const lang = this.active();
    const values = { count, ...params };
    const form = `${key}_${new Intl.PluralRules(lang).select(count)}`;
    const text = this.transloco.translate(form, values);
    return text === form ? this.transloco.translate(`${key}_other`, values) : text;
  }

  /** Loads a language, then switches to it and remembers the choice. */
  async use(code: string): Promise<void> {
    const lang = pickLanguage(code, LANGUAGE_CODES);
    try {
      await firstValueFrom(this.transloco.load(lang));
    } catch {
      // Unavailable file: stay on what we have (English is always bundled).
      return;
    }
    this.transloco.setActiveLang(lang);
    this.active.set(lang);
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Storage disabled: the choice just isn't remembered.
    }
  }

  /** The saved choice, else the browser's preferred languages, else English. */
  detect(): string {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage disabled.
    }
    const candidates = [saved, ...navigator.languages, navigator.language].filter(
      (l): l is string => Boolean(l),
    );
    for (const candidate of candidates) {
      const lang = pickLanguage(candidate, LANGUAGE_CODES);
      if (lang !== DEFAULT_LANGUAGE || candidate.toLowerCase().startsWith('en')) return lang;
    }
    return DEFAULT_LANGUAGE;
  }
}

/** Transloco plus loading the user's language before the app renders (no flash of English). */
export function provideI18n(): EnvironmentProviders[] {
  return [
    ...provideTransloco({
      config: {
        availableLangs: LANGUAGE_CODES,
        defaultLang: DEFAULT_LANGUAGE,
        fallbackLang: DEFAULT_LANGUAGE,
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
        missingHandler: { useFallbackTranslation: true, logMissingKey: isDevMode() },
      },
      loader: LocaleLoader,
    }),
    provideAppInitializer(() => {
      const i18n = inject(I18n);
      return i18n.use(i18n.detect());
    }),
  ];
}
