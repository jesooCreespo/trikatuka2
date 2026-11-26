// Gatekeeper for translation files (`npm run test:locales`, part of `npm test`): every file in
// src/i18n/locales/ must match en.json in shape and contain only plain text. This is what makes
// "just add a file" safe. Runs on Node's built-in test runner.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { codeFromPath, languageName, pickLanguage } from '../src/i18n/languages.ts';
import { renderAvailableLocales } from './sync-locales.mjs';

const DIR = fileURLToPath(new URL('../src/i18n/locales/', import.meta.url));
const GENERATED = fileURLToPath(new URL('../src/i18n/available-locales.ts', import.meta.url));
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const HTML = /<\/?[a-z!][^>]*>/i;
const URL_LIKE = /\b(?:https?:|ftp:|javascript:|data:|mailto:)|\bwww\.|\/\//i;
const PLACEHOLDER = /\{\{\s*([\w.]+)\s*(?:,[^}]*)?\}\}/g;

/** Parses JSON keeping every key, including `__proto__`, so it can be checked. */
function readLocale(file) {
  const problems = [];
  const flat = new Map();
  const data = JSON.parse(readFileSync(`${DIR}${file}`, 'utf-8'), function (key, value) {
    if (FORBIDDEN_KEYS.has(key)) problems.push(`forbidden key "${key}"`);
    return value;
  });
  const walk = (node, prefix) => {
    if (typeof node === 'string') flat.set(prefix, node);
    else if (node && typeof node === 'object' && !Array.isArray(node)) {
      for (const [key, value] of Object.entries(node)) walk(value, prefix ? `${prefix}.${key}` : key);
    } else problems.push(`"${prefix}" must be a string or an object`);
  };
  walk(data, '');
  return { flat, problems };
}

const placeholders = (text) => [...new Set([...text.matchAll(PLACEHOLDER)].map((m) => m[1]))].sort();

const files = readdirSync(DIR);
const en = readLocale('en.json').flat;
const enPluralBases = new Set(
  [...en.keys()].filter((k) => PLURAL_SUFFIX.test(k)).map((k) => k.replace(PLURAL_SUFFIX, '')),
);
const enPlain = [...en.keys()].filter((k) => !PLURAL_SUFFIX.test(k)).sort();

describe('locale files', () => {
  it('only contains .json files, including en.json', () => {
    assert.deepEqual(
      files.filter((f) => !f.endsWith('.json')),
      [],
    );
    assert.ok(files.includes('en.json'));
  });

  it('are all registered in src/i18n/available-locales.ts (run `npm run i18n:sync`)', () => {
    assert.equal(readFileSync(GENERATED, 'utf-8'), renderAvailableLocales(files));
  });

  for (const file of files.filter((f) => f.endsWith('.json'))) {
    describe(file, () => {
      const code = codeFromPath(file);
      const { flat, problems } = readLocale(file);

      it('is named after a valid language code', () => {
        assert.deepEqual(Intl.getCanonicalLocales(code), [code]);
      });

      it('has only nested objects and strings, with no forbidden keys', () => {
        assert.deepEqual(problems, []);
      });

      it('has exactly the keys of en.json', () => {
        const plain = [...flat.keys()]
          .filter((k) => !enPluralBases.has(k.replace(PLURAL_SUFFIX, '')))
          .sort();
        assert.deepEqual(plain, enPlain);
      });

      it('has the plural forms this language needs (and no others)', () => {
        const needed = new Intl.PluralRules(code).resolvedOptions().pluralCategories.slice().sort();
        for (const base of enPluralBases) {
          const forms = [...flat.keys()]
            .filter((k) => PLURAL_SUFFIX.test(k) && k.replace(PLURAL_SUFFIX, '') === base)
            .map((k) => k.match(PLURAL_SUFFIX)[1])
            .sort();
          assert.deepEqual(forms, needed, base);
        }
      });

      it('uses the same placeholders as en.json', () => {
        for (const [key, text] of flat) {
          const base = key.replace(PLURAL_SUFFIX, '');
          if (enPluralBases.has(base)) {
            // A singular form may leave out {{count}} ("one item"), but can't invent placeholders.
            const allowed = placeholders(en.get(`${base}_other`) ?? '');
            assert.deepEqual(
              placeholders(text).filter((p) => !allowed.includes(p)),
              [],
              key,
            );
          } else {
            assert.deepEqual(placeholders(text), placeholders(en.get(key) ?? ''), key);
          }
        }
      });

      it('contains plain text only: no HTML and no links', () => {
        for (const [key, text] of flat) {
          assert.equal(HTML.test(text), false, `${key}: ${text}`);
          assert.equal(URL_LIKE.test(text), false, `${key}: ${text}`);
        }
      });
    });
  }
});

describe('languages', () => {
  it('names each language in itself', () => {
    assert.equal(languageName('en'), 'English');
    assert.equal(languageName('it'), 'Italiano');
    assert.equal(languageName('de'), 'Deutsch');
  });

  it('picks the closest available language', () => {
    const available = ['en', 'it', 'pt-BR'];
    assert.equal(pickLanguage('it-IT', available), 'it');
    assert.equal(pickLanguage('IT', available), 'it');
    assert.equal(pickLanguage('pt', available), 'pt-BR');
    assert.equal(pickLanguage('pt-BR', available), 'pt-BR');
    assert.equal(pickLanguage('fr-FR', available), 'en');
    assert.equal(pickLanguage(undefined, available), 'en');
  });

  it('derives the code from the file path', () => {
    assert.equal(codeFromPath('./locales/pt-BR.json'), 'pt-BR');
  });
});
