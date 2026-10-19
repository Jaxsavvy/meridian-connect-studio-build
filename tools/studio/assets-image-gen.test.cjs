'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { matchesResults, settingsRows, createCanvas, mountCanvas } = require('../../src/renderer/studio/tools/image-gen/image-gen.js');
const packet = (extra = {}) => ({ spaceId: 'sandbox-me', toolId: 'image-gen', requestId: 'chat-request', results: [{ assetId: 'chat-image', url: 'https://example.test/image.png' }], ...extra });
const prepare = async (service = createSampleService(), extra = {}) => { const c = createCanvas({ spaceId: 'sandbox-me', service, ...extra }); await c.start(); c.update({ description: 'A crew in a workshop', count: 1 }); c.sharpen(); return c; };

test('generation requires a loaded preset, a description, sharpening and explicit confirmation', async () => {
  const base = createSampleService(), calls = [], dirty = [];
  const c = await prepare({ ...base, generateImage: req => { calls.push(req); return base.generateImage(req); } }, { onDirty: value => dirty.push(value) });
  assert.equal(c.snapshot().presets.length, 9); assert.equal(c.snapshot().dirty, true);
  assert.equal(await c.generate(), false); assert.equal(calls.length, 0);
  c.confirm(true); assert.equal(await c.generate(), true); assert.equal(calls.length, 1);
  assert.equal(calls[0].count, 1); assert.equal(calls[0].spaceId, 'sandbox-me');
  assert.equal(c.snapshot().results.length, 1); assert.equal(c.snapshot().dirty, false);
  assert.deepEqual(dirty, [true, false]); assert.equal(await c.generate(), false);
  c.dispose();
});

test('changes invalidate confirmation and invalid counts, references and presets are refused', async () => {
  const c = await prepare(); c.confirm(true); c.update({ count: 2 });
  assert.equal(c.snapshot().confirmed, false); assert.equal(c.snapshot().proposal, '');
  for (const change of [{ count: 3 }, { presetId: 'missing' }, { description: 1 }, { references: 'foreign' }]) assert.equal(c.update(change), false);
  assert.equal(await c.addReference('foreign'), false); assert.deepEqual(c.snapshot().references, []);
  c.discard(); assert.equal(c.snapshot().dirty, false); c.dispose();
});

test('only matching Space and tool events are shown, without clearing a typed draft', async () => {
  const c = await prepare();
  for (const p of [null, packet({ spaceId: 'sandbox-team' }), packet({ toolId: 'video' }), packet({ results: null })]) {
    assert.equal(matchesResults(p, 'sandbox-me'), false); assert.equal(c.receive(p), false);
  }
  assert.deepEqual(c.snapshot().results, []); const p = packet(); assert.equal(c.receive(p), true);
  p.results[0].assetId = 'changed-outside'; assert.equal(c.snapshot().results[0].assetId, 'chat-image');
  assert.equal(c.snapshot().dirty, true); c.dispose(); assert.equal(c.receive(packet()), false);
});

test('settings allow only supplied display fields, including the conversation event schema', () => {
  assert.deepEqual(settingsRows({ preset: 'Website hero', size: '16:9', count: 4, useBrandDna: true, model: 'sample', cost: 99, price: 99, diagnostic: 'private' }),
    [['Preset', 'Website hero'], ['Size', '16:9'], ['Options', '4'], ['Brand DNA', 'On'], ['Model', 'sample']]);
  assert.deepEqual(settingsRows({ Preset: 'Website hero', Size: '16:9', Options: '4', 'Brand DNA': 'Off' }),
    [['Preset', 'Website hero'], ['Size', '16:9'], ['Options', '4'], ['Brand DNA', 'Off']]);
  assert.deepEqual(settingsRows(null), []); assert.deepEqual(settingsRows({ size: 'private', count: 9 }), []);
});

test('Keep persists; variations require another confirmation and reuse the refined description and preset', async () => {
  const base = createSampleService(), calls = [], sent = [];
  const c = await prepare({ ...base, generateImage: req => { calls.push(req); return base.generateImage(req); } }, { onSend: value => sent.push(value) });
  c.confirm(true); await c.generate(); const id = c.snapshot().results[0].assetId, refined = c.snapshot().refinedDescription;
  await c.keep(id); assert.equal((await base.listAssets('sandbox-me'))[0].kept, true);
  c.send(id); assert.deepEqual(sent, [{ spaceId: 'sandbox-me', toolId: 'asset-library', assetId: id }]);
  assert.equal(c.variations(id), true); assert.equal(await c.generate(), false); assert.equal(calls.length, 1);
  c.confirm(true); await c.generate(); assert.equal(calls[1].description, refined);
  assert.equal(calls[1].presetId, calls[0].presetId); assert.deepEqual(calls[1].references, [id]); c.dispose();
});

test('a real failure retries the same request ID; an uncertain saved result is reconciled without regenerating', async () => {
  const base = createSampleService(), calls = []; let fail = true;
  const c = await prepare({ ...base, generateImage: req => { calls.push(req); if (fail) throw new Error('private diagnostic'); return base.generateImage(req); } });
  c.confirm(true); await c.generate(); assert.equal(c.snapshot().phase, 'failed'); assert.doesNotMatch(c.snapshot().error, /private diagnostic/);
  fail = false; await c.retry(); assert.equal(calls[0].requestId, calls[1].requestId); c.dispose();
  let count = 0;
  const recovered = await prepare({ ...base, generateImage: async req => { count += 1; await base.generateImage(req); throw new Error('Connection ended'); } });
  recovered.confirm(true); await recovered.generate(); assert.equal(count, 1); assert.equal(recovered.snapshot().results.length, 1);
  assert.equal(recovered.snapshot().dirty, false); recovered.dispose();
});

test('a post-generation read failure retries only the read and late work is ignored after cleanup', async () => {
  const base = createSampleService(); let generated = 0, blockReads = false;
  const c = await prepare({ ...base, listAssets: async id => { if (blockReads) throw new Error(); return base.listAssets(id); }, generateImage: async req => { generated += 1; const out = await base.generateImage(req); blockReads = true; return out; } });
  c.confirm(true); await c.generate(); assert.equal(c.snapshot().phase, 'failed'); blockReads = false;
  await c.retry(); assert.equal(generated, 1); c.dispose();
  let resolve, notices = 0;
  const late = await prepare({ ...base, generateImage: () => new Promise(done => { resolve = done; }) }, { onChange: () => { notices += 1; } });
  late.confirm(true); const pending = late.generate(); await new Promise(setImmediate); late.dispose(); const before = notices;
  resolve({ requestId: 'late', results: [], settingsUsed: {} }); await pending; assert.equal(notices, before);
});

class Element {
  constructor(tag, doc) { this.tag = tag; this.ownerDocument = doc; this.children = []; this.dataset = {}; this.events = {}; this.value = ''; this.disabled = false; this.classList = { toggle() {} }; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute() {}
  addEventListener(type, fn) { this.events[type] = fn; }
  contains(n) { return this === n || this.children.some(c => c.contains(n)); }
  all() { return [this, ...this.children.flatMap(c => c.all())]; }
  querySelectorAll() { return this.all().filter(n => n.dataset.focus); }
  focus() { this.ownerDocument.activeElement = this; }
}
test('mounted buttons generate, Keep and navigate; cleanup removes both listeners', async () => {
  const doc = { createElement: tag => new Element(tag, doc), activeElement: null }, host = new Element('div', doc), base = createSampleService();
  let listener, stopped = 0, sent;
  const service = { ...base, on: fn => { const off = base.on(fn); return () => { stopped += 1; off(); }; } };
  const cleanup = mountCanvas(host, { spaceId: 'sandbox-me', studio: { service, setDirty() {}, navigate: (...args) => { sent = args; }, on: fn => { listener = fn; return () => { stopped += 1; }; } } });
  const tick = () => new Promise(setImmediate); await tick();
  const click = async label => { const b = host.all().find(n => n.tag === 'button' && n.textContent === label && !n.hidden); assert.ok(b, label); assert.equal(b.disabled, false); await b.events.click(); await tick(); };
  const input = host.all().find(n => n.tag === 'textarea'); input.value = 'Crew building a stage'; input.events.input();
  await click('Sharpen my description'); const confirm = host.all().find(n => n.type === 'checkbox'); confirm.checked = true; confirm.events.change();
  await click('Generate'); await click('Keep'); await click('Asset Library');
  assert.equal(sent[0], 'work'); assert.equal(sent[1].spaceId, 'sandbox-me'); assert.equal(sent[1].toolId, 'asset-library');
  listener('image-results', packet({ spaceId: 'foreign' })); assert.equal(host.all().some(n => n.textContent === 'chat-image'), false);
  cleanup(); assert.equal(stopped, 2); assert.deepEqual(host.children, []);
});

test('chat results wait for Space access, and denied access clears the previous result and settings', async () => {
  const base = createSampleService(); let deny = true;
  const c = createCanvas({ spaceId: 'sandbox-me', service: { ...base, getSpace: id => {
    if (deny) throw Object.assign(new Error('private diagnostic'), { status: 403 }); return base.getSpace(id);
  } } });
  c.receive(packet({ refinedDescription: 'A workshop', settingsUsed: { count: 1 } }));
  await c.start(); assert.equal(c.snapshot().phase, 'failed'); assert.deepEqual(c.snapshot().results, []);
  deny = false; await c.retry(); assert.equal(c.snapshot().results[0].assetId, 'chat-image');
  deny = true; await c.start(); assert.deepEqual(c.snapshot().results, []);
  assert.deepEqual(c.snapshot().settings, []); assert.equal(c.snapshot().refinedDescription, ''); c.dispose();
});

test('references must be active images returned by this Space and chat wins over a late canvas request', async () => {
  const base = createSampleService();
  const own = await base.generateImage({ spaceId: 'sandbox-me', description: 'Own', count: 1 });
  const foreign = await base.generateImage({ spaceId: 'sandbox-team', description: 'Other', count: 1 });
  let resolve;
  const c = await prepare({ ...base, generateImage: () => new Promise(done => { resolve = done; }) });
  assert.equal(await c.addReference(foreign.results[0].assetId), false);
  assert.equal(await c.addReference(own.results[0].assetId), true);
  assert.deepEqual(c.snapshot().references, [own.results[0].assetId]);
  c.sharpen(); c.confirm(true); const pending = c.generate(); await new Promise(setImmediate);
  c.receive(packet()); resolve({ requestId: 'old-canvas', results: own.results, settingsUsed: {} }); await pending;
  assert.equal(c.snapshot().results[0].assetId, 'chat-image'); assert.equal(c.snapshot().dirty, true); c.dispose();
});
