import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const firebase = JSON.parse(read('firebase.json'));
const csp = firebase.hosting.headers
  .filter((rule) => rule.source === '**')
  .flatMap((rule) => rule.headers)
  .find((h) => h.key === 'Content-Security-Policy')?.value;

const directive = (name) =>
  csp
    .split(';')
    .map((d) => d.trim().split(/\s+/))
    .find(([n]) => n === name)
    ?.slice(1) ?? [];

test('firebase.json sends a Content-Security-Policy for every path', () => {
  assert.ok(csp, 'missing Content-Security-Policy on the "**" rule');
});

test('every inline script of src/index.html is allowed by its hash', () => {
  const html = read('src/index.html');
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(inline.length > 0, 'expected the inline theme script');
  const allowed = directive('script-src');
  for (const source of inline) {
    const hash = `'sha256-${createHash('sha256').update(source).digest('base64')}'`;
    assert.ok(
      allowed.includes(hash),
      `src/index.html changed: put ${hash} in script-src (firebase.json) instead of the old hash`,
    );
  }
  // Only those hashes: a stale one would keep allowing a script that no longer exists.
  assert.equal(allowed.filter((s) => s.startsWith("'sha256-")).length, inline.length);
});

test('critical CSS inlining stays off (its inline script would be blocked)', () => {
  const angular = JSON.parse(read('angular.json'));
  const optimization =
    angular.projects.trikatuka.architect.build.configurations.production.optimization;
  assert.equal(optimization?.styles?.inlineCritical, false);
});
