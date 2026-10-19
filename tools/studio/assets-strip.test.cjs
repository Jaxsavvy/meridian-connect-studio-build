'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { visibleAssets, actionsFor, errorMessage, createController, mount } = require('../../src/renderer/studio/assets/assets-strip.js');
const tick = () => new Promise(setImmediate);
const asset = (id, extra = {}) => ({ id, name: id, spaceId: 'sandbox-me', kept: false, trashed: false, ...extra });

test('assets are Space-scoped, searched, separated from trash and newest first without mutating input', () => {
  const assets = [asset('old', { createdAt: '2026-01-01' }), asset('new', { createdAt: '2026-02-01' }),
    asset('foreign', { spaceId: 'sandbox-team' }), asset('deleted', { trashed: true })];
  assert.deepEqual(visibleAssets(assets, 'sandbox-me').map(a => a.id), ['new', 'old']);
  assert.deepEqual(visibleAssets(assets, 'sandbox-me', 'NEW').map(a => a.id), ['new']);
  assert.deepEqual(visibleAssets(assets, 'sandbox-me', '', true).map(a => a.id), ['deleted']);
  assert.equal(assets[0].id, 'old');
  assert.deepEqual(visibleAssets([asset('first'), asset('second')], 'sandbox-me').map(a => a.id), ['second', 'first']);
  assert.throws(() => visibleAssets(null, 'sandbox-me'));
});

test('actions reflect kept, trashed and approved state', () => {
  assert.deepEqual(actionsFor(asset('a')), ['keep', 'trash']);
  assert.deepEqual(actionsFor(asset('a', { kept: true })), ['trash']);
  assert.deepEqual(actionsFor(asset('a', { trashed: true })), ['restore']);
  assert.deepEqual(actionsFor(asset('a', { approved: true })), ['keep']);
  assert.match(errorMessage(new Error('Approved work cannot be removed')), /Jax/);
  assert.match(errorMessage({ code: 'OFFLINE' }), /offline/);
  assert.match(errorMessage({ status: 403 }), /access/);
  assert.doesNotMatch(errorMessage(new Error('private diagnostic')), /private diagnostic/);
});

test('sample service supports live generation, search, Keep, trash and Restore in one Space', async () => {
  const service = createSampleService();
  const dirty = [];
  const c = createController({ spaceId: 'sandbox-me', service, onDirty: v => dirty.push(v) });
  await c.load(); assert.deepEqual(c.snapshot().assets, []);
  await service.generateImage({ spaceId: 'sandbox-team', description: 'Other Space', count: 1 });
  await tick(); assert.deepEqual(c.snapshot().assets, []);
  await service.generateImage({ spaceId: 'sandbox-me', description: 'This Space', count: 2 });
  await tick(); assert.equal(c.snapshot().assets.length, 2);
  const id = c.snapshot().assets[0].id;
  await c.act('keep', id); assert.equal(c.snapshot().assets[0].kept, true);
  await c.act('trash', id); assert.equal(c.snapshot().assets.length, 1);
  await c.filter('', true); assert.equal(c.snapshot().assets[0].id, id);
  await c.act('restore', id); assert.equal(c.snapshot().assets.length, 0);
  await c.filter('sample', false); assert.equal(c.snapshot().assets.length, 2);
  assert.deepEqual(dirty, [true, false, true, false, true, false]);
  assert.equal(await c.act('trash', 'foreign'), false);
  c.dispose();
});

test('failed actions retry the same mutation and keep unsaved work guarded until retry or discard', async () => {
  let fail = true, calls = 0;
  const service = { on: () => () => {}, listAssets: async () => [asset('a')], keepAsset: async (space, id) => {
    assert.equal(space, 'sandbox-me'); assert.equal(id, 'a'); calls += 1;
    if (fail) throw Object.assign(new Error('private diagnostic'), { code: 'OFFLINE' });
  } };
  const c = createController({ spaceId: 'sandbox-me', service }); await c.load();
  assert.equal(await c.act('keep', 'a'), false); assert.equal(c.snapshot().dirty, true);
  assert.equal(await c.filter('other'), false);
  fail = false; await c.retry(); assert.equal(calls, 2); assert.equal(c.snapshot().dirty, false);
  fail = true; await c.act('keep', 'a'); await c.discard(); assert.equal(c.snapshot().dirty, false);
  c.dispose();
});

test('failed loads retry; stale and disposed responses cannot repopulate the strip', async () => {
  const pending = []; let stopped = false;
  const service = { on: () => () => { stopped = true; }, listAssets: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) };
  const c = createController({ spaceId: 'sandbox-me', service });
  const first = c.load(), latest = c.filter('new');
  pending[1].resolve([asset('new')]); await latest;
  pending[0].resolve([asset('old')]); await first; assert.equal(c.snapshot().assets[0].id, 'new');
  const failed = c.load(); pending[2].reject(new Error()); await failed; assert.equal(c.snapshot().phase, 'failed');
  const retry = c.retry(); pending[3].resolve([asset('new')]); await retry; assert.equal(c.snapshot().phase, 'ready');
  const late = c.load(); c.dispose(); pending[4].resolve([asset('new')]); await late;
  assert.equal(stopped, true); assert.deepEqual(c.snapshot().assets, []);
});

test('browser registration uses the assets-strip part', () => {
  let registered;
  vm.runInNewContext(fs.readFileSync(require.resolve('../../src/renderer/studio/assets/assets-strip.js'), 'utf8'), {
    window: { MeridianStudio: { registerPart: (id, part) => { registered = { id, part }; } } },
  });
  assert.equal(registered.id, 'assets-strip'); assert.equal(typeof registered.part.mount, 'function');
});

// Minimal DOM lets the actual mounted buttons exercise the service without a browser.
class Element {
  constructor(tag, doc) { this.tag = tag; this.ownerDocument = doc; this.children = []; this.dataset = {}; this.events = {}; this.value = ''; this.classList = { toggle() {} }; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute() {}
  addEventListener(type, fn) { this.events[type] = fn; }
  contains(node) { return this === node || this.children.some(child => child.contains(node)); }
  querySelectorAll() { return this.all().filter(n => n.dataset.focus); }
  all() { return [this, ...this.children.flatMap(child => child.all())]; }
  focus() { this.ownerDocument.activeElement = this; }
}
test('mounted controls and drag payload work on sample data and clean up', async () => {
  const doc = { createElement: tag => new Element(tag, doc), activeElement: null };
  const host = new Element('div', doc), service = createSampleService();
  await service.generateImage({ spaceId: 'sandbox-me', description: 'Sample', count: 1 });
  const dispose = mount(host, { spaceId: 'sandbox-me', studio: { service, setDirty() {} } }); await tick();
  const click = async label => { const b = host.all().find(n => n.tag === 'button' && n.textContent === label && !n.hidden); assert.ok(b, label); assert.equal(b.disabled, false); await b.events.click(); await tick(); };
  const row = host.all().find(n => n.tag === 'li'); let payload;
  row.events.dragstart({ dataTransfer: { setData: (type, id) => { payload = { type, id }; } } });
  assert.equal(payload.type, 'application/x-meridian-asset'); assert.ok(payload.id);
  host.all().find(n => n.textContent === 'Keep').focus();
  await click('Keep'); assert.ok(host.all().find(n => n.textContent === 'Kept'));
  assert.equal(doc.activeElement.textContent, 'Move to trash');
  await click('Move to trash'); await click('Trash'); await click('Restore'); await click('Back to assets');
  const input = host.all().find(n => n.type === 'search'); input.value = 'no match'; await click('Search');
  assert.ok(host.all().find(n => n.textContent === 'No assets match your search.'));
  dispose(); assert.deepEqual(host.children, []);
});
