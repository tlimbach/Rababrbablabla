import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../dist/updates.js', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));

function setup({ version = 'new', idle = true, offline = false, valid = true } = {}) {
  const events = {}, replacements = [], requests = [];
  const page = value => ({
    querySelectorAll: () => [{ getAttribute: name => name === 'src' ? `app.js?v=${value}` : null }],
    querySelector: () => valid ? {} : null
  });
  const document = { ...page('old'), hidden: false, addEventListener(name, handler) { events[name] = handler; } };
  const start = runInNewContext(source.replace('export function', 'function') + '\nstartAutoUpdates;', {
    URL, document,
    location: { href: 'https://example.org/plapperwurm/develop/?setting=1#controls', replace: url => replacements.push(url) },
    window: { addEventListener(name, handler) { events[name] = handler; } },
    DOMParser: class { parseFromString() { return page(version); } },
    async fetch(url, options) {
      requests.push({ url: url.href, cache: options.cache });
      if (offline) throw new Error('offline');
      return { ok: true, text: async () => 'html' };
    }
  });
  const updates = start(() => idle);
  return { updates, events, document, replacements, requests, stop() { idle = true; updates.applyPending(); } };
}

test('new version reloads the same view with a fresh URL and bypasses the cache', async () => {
  const app = setup();
  await settle();
  assert.equal(app.requests[0].cache, 'no-store');
  assert.equal(app.replacements.length, 1);
  const target = new URL(app.replacements[0]);
  assert.equal(target.pathname, '/plapperwurm/develop/');
  assert.equal(target.searchParams.get('setting'), '1');
  assert.ok(target.searchParams.has('_update'));
  assert.equal(target.hash, '#controls');
  app.events.pageshow();
  await settle();
  assert.equal(app.replacements.length, 1);
});

test('an update waits for the active audio session to stop', async () => {
  const app = setup({ idle: false });
  await settle();
  assert.equal(app.replacements.length, 0);
  app.stop();
  assert.equal(app.replacements.length, 1);
});

test('unchanged, offline and invalid responses never reload', async () => {
  for (const options of [{ version: 'old' }, { offline: true }, { valid: false }]) {
    const app = setup(options);
    await settle();
    assert.equal(app.replacements.length, 0);
  }
});

test('returning to a visible app checks again; hiding it does not', async () => {
  const app = setup({ version: 'old' });
  await settle();
  app.document.hidden = true;
  app.events.visibilitychange();
  await settle();
  assert.equal(app.requests.length, 1);
  app.document.hidden = false;
  app.events.visibilitychange();
  await settle();
  assert.equal(app.requests.length, 2);
});
