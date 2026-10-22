'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const strip = require('../../src/renderer/studio/assets/assets-strip.js');
const library = require('../../src/renderer/studio/tools/asset-library/asset-library.js');
const image = require('../../src/renderer/studio/tools/image-gen/image-gen.js');
const tick = () => new Promise(setImmediate);
async function seed(service, spaceId = 'sandbox-me') {
  return (await service.generateImage({ spaceId, description: 'Synthetic paper boat', count: 1 })).results[0];
}
test('review controller accepts an optional 500-character note, refuses foreign/waiting/approved/trash and locks approved trash', async () => {
  const service = createSampleService(), own = await seed(service), other = await seed(service, 'sandbox-team');
  const c = strip.createController({ spaceId: 'sandbox-me', service }); await c.load();
  assert.equal(await c.act('review', other.assetId), false);
  assert.equal(await c.act('review', own.assetId, 'x'.repeat(501)), false);
  assert.equal(await c.act('review', own.assetId, 'x'.repeat(500)), true);
  assert.equal(c.snapshot().assets[0].review.note.length, 500);
  assert.equal(strip.reviewStatus(c.snapshot().assets[0]), 'Waiting on Jax');
  assert.equal(await c.act('review', own.assetId), false);
  await service.approveAsset('sandbox-me', own.assetId); await tick();
  assert.equal(strip.reviewStatus(c.snapshot().assets[0]), 'Approved');
  assert.equal(await c.act('review', own.assetId), false); assert.equal(await c.act('trash', own.assetId), false);
  assert.ok(!strip.actionsFor(c.snapshot().assets[0]).includes('trash'));
  const next = await seed(service); await tick(); await c.act('review', next.assetId);
  assert.equal((await service.listReview('sandbox-me'))[0].review.note, '');
  assert.equal(strip.canReview({ trashed: true }), false); c.dispose();
});
test('In review uses listReview, filters query and foreign rows, follows approval and retries failed reads', async () => {
  const base = createSampleService(), own = await seed(base), foreign = await seed(base, 'sandbox-team');
  await base.sendToReview('sandbox-me', own.assetId); await base.sendToReview('sandbox-team', foreign.assetId);
  let reads = 0, fail = false;
  const service = { ...base, listReview: async id => { reads++; if (fail) throw new Error('Offline'); return [...await base.listReview(id), ...await base.listReview('sandbox-team')]; } };
  const c = library.createLibrary({ spaceId: 'sandbox-me', service, selectedId: own.assetId });
  await c.load(); await c.filter('', 'review'); assert.equal(reads, 1); assert.equal(c.snapshot().assets.length, 1);
  assert.equal(c.snapshot().selected.id, own.assetId); assert.equal(c.select(foreign.assetId), false);
  await c.filter('no-match', 'review'); assert.deepEqual(c.snapshot().assets, []);
  fail = true; await c.filter('', 'review'); assert.equal(c.snapshot().phase, 'failed');
  fail = false; await c.retry(); assert.equal(c.snapshot().assets.length, 1);
  await base.approveAsset('sandbox-me', own.assetId); await tick(); assert.deepEqual(c.snapshot().assets, []); c.dispose();
});
test('duplicate sends are blocked while pending and cleanup ignores late Review completion', async () => {
  for (const canvas of [false, true]) {
    const base = createSampleService(), result = await seed(base); let release, calls = 0, reports = 0;
    const service = { ...base, sendToReview: async (...args) => { calls++; await new Promise(r => { release = r; }); return base.sendToReview(...args); } };
    const c = canvas ? image.createCanvas({ spaceId: 'sandbox-me', service, onChange: () => reports++ })
      : strip.createController({ spaceId: 'sandbox-me', service, onChange: () => reports++ });
    if (canvas) { await c.start(); c.receive({ spaceId: 'sandbox-me', toolId: 'image-gen', requestId: 'synthetic', results: [result] }); } else await c.load();
    const send = () => canvas ? c.review(result.assetId, 'Check the crop') : c.act('review', result.assetId, 'Check the crop');
    const pending = send(); assert.equal(await send(), false); assert.equal(calls, 1);
    c.dispose(); const before = reports; release(); await pending; assert.equal(reports, before);
  }
});
class Element {
  constructor(tag, doc) { this.tag = tag; this.ownerDocument = doc; this.children = []; this.dataset = {}; this.events = {}; this.attributes = {}; this.value = ''; this._disabled = false; this.classList = { toggle() {} }; }
  get disabled() { return this._disabled; } set disabled(v) { this._disabled = v; if (v && this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = null; }
  append(...nodes) { this.children.push(...nodes); } replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(k, v) { this.attributes[k] = v; } addEventListener(k, fn) { this.events[k] = fn; }
  all() { return [this, ...this.children.flatMap(n => n.all())]; } contains(n) { return this.all().includes(n); }
  querySelectorAll() { return this.all().filter(n => n.dataset.focus); } focus() { this.ownerDocument.activeElement = this; }
}
function dom() { const doc = { activeElement: null, createElement: tag => new Element(tag, doc) }; return new Element('div', doc); }
function find(host, text) { return host.all().find(n => n.tag === 'button' && n.textContent === text && !n.hidden); }
async function click(host, text) { const b = find(host, text); assert.ok(b, text); assert.equal(b.disabled, false, text); b.focus(); await b.events.click(); await tick(); }
async function mounted(kind, service, result) {
  const host = dom(), dirty = []; let listener;
  const studio = { service, setDirty: v => dirty.push(v), current: () => ({ params: { assetId: result.assetId } }),
    on: fn => { listener = fn; return () => {}; }, navigate() {} };
  const cleanup = (kind === 'strip' ? strip.mount : kind === 'library' ? library.mountCanvas : image.mountCanvas)(host, { spaceId: 'sandbox-me', studio });
  await tick();
  if (kind === 'image') { listener('image-results', { spaceId: 'sandbox-me', toolId: 'image-gen', requestId: 'synthetic', results: [result] }); await tick(); }
  return { host, cleanup, dirty };
}
for (const kind of ['strip', 'library', 'image']) test(kind + ': mounted note, error/retry, Waiting/Approved chips and keyboard focus work', async () => {
  const base = createSampleService(), result = await seed(base), foreign = await seed(base, 'sandbox-team'), calls = [];
  let fail = true;
  const service = { ...base, sendToReview: (...args) => { calls.push(args); if (fail) throw new Error('Review is offline.'); return base.sendToReview(...args); } };
  const { host, cleanup, dirty } = await mounted(kind, service, result);
  let note = host.all().find(n => n.dataset.focus === result.assetId + ':review-note');
  assert.equal(note.maxLength, 500); note.focus(); note.value = 'Please check the crop.'; note.events.input(); assert.equal(dirty.at(-1), true);
  await click(host, 'Review'); assert.ok(host.all().some(n => n.textContent === 'Review is offline.'));
  assert.equal(host.all().find(n => n.dataset.focus === result.assetId + ':review-note').value, 'Please check the crop.');
  fail = false; await click(host, 'Try again');
  assert.deepEqual(calls, [['sandbox-me', result.assetId, 'Please check the crop.'], ['sandbox-me', result.assetId, 'Please check the crop.']]);
  assert.ok(host.all().some(n => n.textContent === 'Waiting on Jax')); assert.equal(find(host, 'Review').disabled, true);
  assert.equal(host.all().find(n => n.dataset.focus === result.assetId + ':review-note').value, '');
  assert.equal(dirty.at(-1), false); assert.ok(host.contains(host.ownerDocument.activeElement));
  assert.ok(!host.all().some(n => n.dataset.focus?.startsWith(foreign.assetId + ':')));
  await base.approveAsset('sandbox-me', result.assetId); await tick();
  assert.ok(host.all().some(n => n.textContent === 'Approved')); assert.equal(find(host, 'Review').disabled, true);
  assert.equal(find(host, 'Move to trash'), undefined); assert.equal(find(host, 'Approve'), undefined);
  if (kind === 'library') {
    const filter = host.all().find(n => n.tag === 'select'); assert.ok(filter.children.some(n => n.textContent === 'In review'));
    filter.value = 'review'; await filter.events.change(); await tick();
    assert.ok(host.all().some(n => n.textContent === 'Nothing is waiting on Jax.'));
  }
  cleanup(); assert.equal(dirty.at(-1), false); assert.deepEqual(host.children, []);
});
test('unsent notes survive refreshes and can be explicitly discarded', async () => {
  for (const kind of ['strip', 'library', 'image']) {
    const service = createSampleService(), result = await seed(service), { host, cleanup, dirty } = await mounted(kind, service, result);
    const note = host.all().find(n => n.dataset.focus === result.assetId + ':review-note'); note.value = 'Unsent note'; note.events.input();
    await service.keepAsset('sandbox-me', result.assetId); await tick();
    if (kind === 'library') await click(host, (await service.listAssets('sandbox-me'))[0].name);
    assert.equal(host.all().find(n => n.dataset.focus === result.assetId + ':review-note').value, 'Unsent note');
    await click(host, kind === 'image' ? 'Discard description' : 'Discard unsaved change'); assert.equal(dirty.at(-1), false);
    await click(host, 'Review'); assert.equal(host.ownerDocument.activeElement.textContent, 'Waiting on Jax'); cleanup();
  }
});
test('In review rejects stale and disposed reads and unsubscribes from live events', async () => {
  const pending = []; let off = false, listener;
  const c = library.createLibrary({ spaceId: 'sandbox-me', service: { on: fn => { listener = fn; return () => { off = true; }; },
    listReview: () => new Promise(resolve => pending.push(resolve)), listAssets: async () => [] } });
  const old = c.filter('', 'review'), fresh = c.filter('', 'all'); await fresh;
  pending[0]([{ id: 'stale', spaceId: 'sandbox-me', name: 'Stale', review: { status: 'waiting' } }]); await old; assert.deepEqual(c.snapshot().assets, []);
  const next = c.filter('', 'review'); c.dispose(); pending[1]([]); await next; assert.equal(off, true);
  listener('assets-changed', { spaceId: 'sandbox-me' }); assert.equal(pending.length, 2);
});
test('Image gen can retry a late-loading Review helper without leaving subscriptions behind', async () => {
  const window = { MeridianStudio: { registerTool() {} } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../../src/renderer/studio/tools/image-gen/image-gen.js'), 'utf8'), { window });
  const host = dom(), base = createSampleService(); let stopped = 0;
  const cleanup = window.MeridianImageGen.mountCanvas(host, { spaceId: 'sandbox-me', studio: {
    service: { ...base, on: fn => { const off = base.on(fn); return () => { stopped++; off(); }; } }, setDirty() {}, on: () => () => { stopped++; },
  } });
  assert.ok(host.all().some(n => n.textContent === 'Review controls are still loading. Try again.'));
  window.MeridianAssetsStrip = strip; await click(host, 'Try again'); assert.ok(host.all().some(n => n.textContent === 'Image gen'));
  cleanup(); assert.equal(stopped, 2);
});
