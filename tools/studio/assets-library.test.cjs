'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { suggestedName, settingsRows, createLibrary, mountCanvas } = require('../../src/renderer/studio/tools/asset-library/asset-library.js');
const tick = () => new Promise(setImmediate);
const asset = (id, extra = {}) => ({ id, spaceId: 'sandbox-me', name: `${id}-hero-main__v1`, kind: 'image', version: 1, parentId: null, ...extra });
const seed = service => service.generateImage({ spaceId: 'sandbox-me', description: 'A crew at work', count: 2 });

test('suggested names use the merged rules, preserve the original and reject oversized Unicode', () => {
  const original = asset('Crew', { version: 2, name: 'Crew-Hero-Main__v2', parentId: 'first' }), before = structuredClone(original);
  assert.equal(suggestedName(original), 'crew-hero-main__v2'); assert.deepEqual(original, before);
  assert.equal(suggestedName(asset('a', { name: 'Cafe\u0301' })), 'café-image-main__v1');
  assert.throws(() => suggestedName(asset('a', { name: '\u0344'.repeat(160) })), { code: 'INVALID_TEXT' });
  assert.throws(() => suggestedName(asset('a', { name: 'n'.repeat(161) })), { code: 'INVALID_TEXT' });
  assert.throws(() => suggestedName(asset('a', { name: '😀'.repeat(80) })), { code: 'INVALID_TEXT' });
});

test('settings show only supplied display fields and never arbitrary financial or diagnostic fields', () => {
  assert.deepEqual(settingsRows({ preset: 'Website hero', size: '16:9', count: 2, useBrandDna: false, model: 'sample', cost: 99, price: 99, diagnostic: 'private' }),
    [['Preset', 'Website hero'], ['Size', '16:9'], ['Options', '2'], ['Brand DNA', 'Off'], ['Model', 'sample']]);
  assert.deepEqual(settingsRows({ Preset: 'Website hero', Size: '16:9', Options: '4', 'Brand DNA': 'On' }),
    [['Preset', 'Website hero'], ['Size', '16:9'], ['Options', '4'], ['Brand DNA', 'On']]);
  assert.deepEqual(settingsRows(null), []); assert.deepEqual(settingsRows({ size: 'invalid', count: 99, model: 'private/path' }), []);
});

test('sample data supports selected details, search, All/Kept/Trash and Keep/Trash/Restore', async () => {
  const service = createSampleService(), out = await seed(service), id = out.results[0].assetId;
  const foreign = await service.generateImage({ spaceId: 'sandbox-team', description: 'Other Space', count: 1 });
  const c = createLibrary({ spaceId: 'sandbox-me', service, selectedId: id }); await c.load();
  assert.equal(c.snapshot().assets.length, 2); assert.equal(c.snapshot().selected.id, id);
  assert.equal(c.snapshot().selected.version, 1); assert.equal(c.snapshot().selected.createdBy, 'image-gen');
  assert.equal(c.select(foreign.results[0].assetId), false);
  await c.act('keep'); await c.filter('', 'kept'); assert.equal(c.snapshot().assets.length, 1);
  await c.act('trash'); assert.equal(c.snapshot().assets.length, 0); assert.equal(c.snapshot().selected, null);
  await c.filter('', 'trash'); assert.equal(c.snapshot().selected.id, id); assert.deepEqual(c.actionsFor(c.snapshot().selected), ['restore']);
  await c.act('restore'); assert.equal(c.snapshot().assets.length, 0);
  await c.filter('SAMPLE-1', 'all'); assert.equal(c.snapshot().assets.length, 1);
  assert.equal(c.snapshot().selected.name, (await service.listAssets('sandbox-me'))[0].name);
  assert.equal(await c.filter('', 'unsupported'), false); c.dispose();
});

test('live updates ignore other Spaces; approved assets cannot be trashed', async () => {
  const service = createSampleService(); let reports = 0;
  const c = createLibrary({ spaceId: 'sandbox-me', service, onChange: () => { reports += 1; } });
  await c.load(); const before = reports;
  await service.generateImage({ spaceId: 'sandbox-team', description: 'Other Space', count: 1 }); await tick(); assert.equal(reports, before);
  const out = await seed(service); await tick(); assert.equal(c.snapshot().assets[0].id, out.results[1].assetId);
  const id = out.results[0].assetId; c.select(id);
  await service.sendToReview('sandbox-me', id); await service.approveAsset('sandbox-me', id); await tick();
  assert.equal(c.snapshot().selected.approved, true); assert.deepEqual(c.actionsFor(c.snapshot().selected), []);
  assert.equal(await c.act('trash'), false); assert.equal((await service.listAssets('sandbox-me')).length, 2); c.dispose();
});

test('failed writes retain their selection and guard unsaved work until retry or discard', async () => {
  const base = createSampleService(), out = await seed(base), id = out.results[0].assetId, dirty = [];
  let fail = true, calls = 0;
  const service = { ...base, keepAsset: async (space, target) => { calls += 1; if (fail) throw Object.assign(new Error('private diagnostic'), { code: 'OFFLINE' }); return base.keepAsset(space, target); } };
  const c = createLibrary({ spaceId: 'sandbox-me', service, selectedId: id, onDirty: value => dirty.push(value) }); await c.load();
  await c.act('keep'); assert.equal(c.snapshot().dirty, true); assert.match(c.snapshot().error, /offline/);
  assert.equal(c.close(), false); assert.equal(c.select(id), false); assert.equal(await c.filter('', 'trash'), false);
  fail = false; await c.retry(); assert.equal(calls, 2); assert.equal(c.snapshot().selected.kept, true); assert.deepEqual(dirty, [true, false]);
  fail = true; c.select(out.results[1].assetId); await c.act('keep'); await c.discard(); assert.equal(c.snapshot().dirty, false); c.dispose();
});

test('stale reads, denied access and cleanup cannot show old or foreign details; load retry works', async () => {
  const pending = []; let off = false;
  const service = { on: () => () => { off = true; }, listAssets: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) };
  const c = createLibrary({ spaceId: 'sandbox-me', service, selectedId: 'new' });
  const old = c.load(), fresh = c.filter('', 'trash');
  pending[1].resolve([asset('new', { trashed: true }), asset('foreign', { spaceId: 'sandbox-team', trashed: true })]); await fresh;
  pending[0].resolve([asset('old')]); await old; assert.equal(c.snapshot().assets.length, 1); assert.equal(c.snapshot().selected.id, 'new');
  const denied = c.load(); pending[2].reject(Object.assign(new Error('private diagnostic'), { status: 403 })); await denied;
  assert.equal(c.snapshot().selected, null); assert.deepEqual(c.snapshot().assets, []); assert.doesNotMatch(c.snapshot().error, /private diagnostic/);
  const retry = c.retry(); pending[3].resolve([asset('new', { trashed: true })]); await retry; assert.equal(c.snapshot().selected.id, 'new');
  const late = c.load(); c.dispose(); pending[4].resolve([asset('new', { trashed: true })]); await late;
  assert.equal(off, true); assert.deepEqual(c.snapshot().assets, []); assert.equal(c.snapshot().selected, null);
});

class Element {
  constructor(tag, doc) { this.tag = tag; this.ownerDocument = doc; this.children = []; this.dataset = {}; this.events = {}; this.attributes = {}; this.value = ''; this.disabled = false; this.classList = { toggle() {} }; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(type, fn) { this.events[type] = fn; }
  contains(node) { return this === node || this.children.some(c => c.contains(node)); }
  all() { return [this, ...this.children.flatMap(c => c.all())]; }
  querySelectorAll() { return this.all().filter(n => n.dataset.focus); }
  focus() { this.ownerDocument.activeElement = this; }
}
const dom = () => { const doc = { activeElement: null, createElement: tag => new Element(tag, doc) }; return new Element('div', doc); };
const click = async (host, text) => { const b = host.all().find(n => n.tag === 'button' && n.textContent === text && !n.hidden); assert.ok(b, text); assert.equal(b.disabled, false); await b.events.click(); await tick(); };
test('mounted controls show metadata, accept incoming selection and support keyboard search and actions', async () => {
  const host = dom(), service = createSampleService(), out = await seed(service); let off = false;
  const cleanup = mountCanvas(host, { spaceId: 'sandbox-me', studio: {
    service: { ...service, on: fn => { const stop = service.on(fn); return () => { off = true; stop(); }; } }, setDirty() {}, current: () => ({ params: { assetId: out.results[0].assetId } }),
  } }); await tick();
  assert.ok(host.all().some(n => n.textContent === 'Made by')); assert.ok(host.all().some(n => n.textContent === 'image-gen'));
  const name = (await service.listAssets('sandbox-me'))[0].name;
  await click(host, 'Close details'); assert.equal(host.ownerDocument.activeElement.textContent, name);
  await click(host, name); assert.equal(host.ownerDocument.activeElement.tag, 'h3');
  await click(host, 'Keep'); await click(host, 'Move to trash');
  const filter = host.all().find(n => n.tag === 'select'); filter.value = 'trash'; await filter.events.change(); await tick();
  await click(host, 'Restore'); filter.value = 'all'; await filter.events.change(); await tick();
  const image = host.all().find(n => n.tag === 'img'); image.events.error(); await click(host, 'Try preview again');
  const query = host.all().find(n => n.type === 'search'); query.value = 'no match'; let prevented = false;
  query.events.keydown({ key: 'Enter', preventDefault() { prevented = true; } }); await tick();
  assert.equal(prevented, true); assert.ok(host.all().some(n => n.textContent === 'No assets match your search.'));
  cleanup(); assert.equal(off, true); assert.deepEqual(host.children, []);
});

test('browser registration and startup retry work when helpers load after the Library script', async () => {
  let registered;
  const window = { MeridianStudio: { registerTool: (id, tool) => { registered = { id, tool }; } } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../../src/renderer/studio/tools/asset-library/asset-library.js'), 'utf8'), { window });
  assert.equal(registered.id, 'asset-library');
  const host = dom(), service = createSampleService();
  const cleanup = registered.tool.mountCanvas(host, { spaceId: 'sandbox-me', studio: { service, setDirty() {} } });
  assert.ok(host.all().some(n => n.textContent === 'Asset Library helpers are still loading. Try again.'));
  window.MeridianAssetModel = require('../../src/renderer/studio/assets/asset-model.js');
  window.MeridianAssetsStrip = require('../../src/renderer/studio/assets/assets-strip.js');
  await click(host, 'Try again'); assert.ok(host.all().some(n => n.textContent === 'Nothing here yet. Things you make in this Space show up here.'));
  cleanup();
});
