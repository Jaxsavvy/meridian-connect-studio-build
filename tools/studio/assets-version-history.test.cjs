'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { createHistory, safePreview, mount } = require('../../src/renderer/studio/assets/version-history.js');
const { mountCanvas } = require('../../src/renderer/studio/tools/asset-library/asset-library.js');
const tick = () => new Promise(setImmediate);
async function seed(service, spaceId = 'sandbox-me') {
  return (await service.generateImage({ spaceId, description: 'Synthetic hero', count: 1 })).results[0].assetId;
}
test('restoring an older version appends a new child, preserving all originals and comparing any pair', async () => {
  const service = createSampleService(), id = await seed(service), original = (await service.listVersions('sandbox-me', id))[0];
  const v2 = await service.saveVersion('sandbox-me', id, { url: 'https://example.test/v2.png' });
  const c = createHistory({ spaceId: 'sandbox-me', assetId: id, service }); await c.load();
  assert.deepEqual(c.snapshot().versions.map(v => v.version), [1, 2]);
  assert.equal(c.pick('a', v2.id), true); assert.equal(c.pick('b', id), true);
  assert.equal(c.pick('a', 'foreign'), false); assert.equal(c.snapshot().b, id);
  assert.equal(await c.restore(id), true);
  const versions = c.snapshot().versions; assert.deepEqual(versions[0], original);
  assert.equal(versions[2].parentId, id); assert.equal(versions[2].url, original.url);
  assert.match(versions[2].name, /__v3$/); assert.equal(await c.restore(versions[2].id), false); c.dispose();
});
test('foreign IDs fail, foreign rows are dropped, empty and failed reads can retry', async () => {
  const service = createSampleService(), id = await seed(service, 'sandbox-team');
  const c = createHistory({ spaceId: 'sandbox-me', assetId: id, service }); assert.equal(await c.load(), false);
  assert.equal(c.snapshot().phase, 'failed'); assert.deepEqual(c.snapshot().versions, []); c.dispose();
  let rows = [], fail = false;
  const d = createHistory({ spaceId: 'sandbox-me', assetId: 'local', service: {
    on: () => () => {}, listVersions: async () => { if (fail) throw new Error('Offline.'); return rows; },
  } });
  await d.load(); assert.deepEqual(d.snapshot().versions, []);
  rows = [{ id: 'local', spaceId: 'sandbox-me', version: 1 }, { id: 'foreign', spaceId: 'sandbox-team', version: 2 }];
  await d.load(); assert.equal(d.snapshot().versions.length, 1);
  fail = true; await d.load(); assert.equal(d.snapshot().error, 'Offline.'); assert.deepEqual(d.snapshot().versions, []);
  fail = false; await d.load(); assert.equal(d.snapshot().phase, 'ready'); d.dispose();
});
test('events filter Spaces, stale reads and disposed reads are ignored, cleanup unsubscribes', async () => {
  const pending = []; let listener, stopped = false;
  const c = createHistory({ spaceId: 'sandbox-me', assetId: 'x', service: {
    on: fn => { listener = fn; return () => { stopped = true; }; }, listVersions: () => new Promise(resolve => pending.push(resolve)),
  } });
  const old = c.load(), latest = c.load();
  pending[1]([]); await latest; pending[0]([{ id: 'x', spaceId: 'sandbox-me', version: 1 }]); await old;
  assert.deepEqual(c.snapshot().versions, []); listener('assets-changed', { spaceId: 'sandbox-team' }); assert.equal(pending.length, 2);
  listener('assets-changed', { spaceId: 'sandbox-me' }); assert.equal(pending.length, 3); c.dispose(); pending[2]([]); await tick(); assert.equal(stopped, true);
});
test('restore errors are shown, duplicate clicks are blocked, failed reload never repeats a write', async () => {
  const base = createSampleService(), id = await seed(base); await base.saveVersion('sandbox-me', id);
  let release, failRead = false, writes = 0, failWrite = true;
  const service = { ...base, listVersions: (...args) => { if (failRead) throw new Error('Read failed.'); return base.listVersions(...args); },
    saveVersion: async (...args) => { writes++; if (failWrite) throw new Error('Restore failed.'); await new Promise(r => { release = r; }); const made = await base.saveVersion(...args); failRead = true; return made; } };
  const c = createHistory({ spaceId: 'sandbox-me', assetId: id, service }); await c.load();
  await c.restore(id); assert.equal(c.snapshot().error, 'Restore failed.');
  failWrite = false; const saving = c.restore(id); assert.equal(await c.restore(id), false); assert.equal(c.snapshot().phase, 'saving');
  release(); await saving; assert.equal(c.snapshot().phase, 'failed'); failRead = false; await c.load();
  assert.equal(writes, 2); assert.equal(c.snapshot().versions.length, 3); c.dispose();
});
class Element {
  constructor(tag, doc) { this.tag = tag; this.ownerDocument = doc; this.children = []; this.dataset = {}; this.events = {}; this.attributes = {}; this.classList = { toggle() {} }; }
  append(...nodes) { this.children.push(...nodes); } replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(k, v) { this.attributes[k] = v; } addEventListener(k, fn) { this.events[k] = fn; }
  all() { return [this, ...this.children.flatMap(c => c.all())]; }
  contains(n) { return this.all().includes(n); } querySelectorAll() { return this.all().filter(n => n.dataset.focus); }
  focus() { this.ownerDocument.activeElement = this; }
}
const dom = () => { const doc = { createElement: tag => new Element(tag, doc) }; return new Element('div', doc); };
test('registered part and Library button mount labelled previews, compare, restore, focus and cleanup', async () => {
  let registered; vm.runInNewContext(fs.readFileSync(require.resolve('../../src/renderer/studio/assets/version-history.js'), 'utf8'),
    { window: { MeridianStudio: { registerPart: (id, part) => { registered = { id, part }; } } } });
  assert.equal(registered.id, 'version-history'); assert.equal(typeof registered.part.mount, 'function');
  const service = createSampleService(), id = await seed(service); await service.saveVersion('sandbox-me', id);
  const host = dom(); let mounted = 0, slot;
  const studio = { service, setDirty() {}, current: () => ({ params: { assetId: id } }),
    mountInto(el, kind, part, ctx) { mounted++; slot = el; assert.equal(kind, 'part'); assert.equal(part, 'version-history'); mount(el, { ...ctx, studio }); } };
  const cleanup = mountCanvas(host, { spaceId: 'sandbox-me', studio }); await tick();
  const click = async text => { const b = host.all().find(n => n.tag === 'button' && n.textContent === text && !n.hidden); assert.ok(b, text); assert.ok(!b.disabled); b.focus(); await b.events.click(); await tick(); };
  await click('Version history'); assert.equal(mounted, 1); assert.ok(host.all().some(n => n.textContent === 'Original'));
  await click('Compare B'); assert.ok(host.all().some(n => n.textContent?.startsWith('B:') && n.textContent.endsWith('v1')));
  await click('Restore'); assert.ok(host.all().some(n => n.textContent?.endsWith('v3')));
  assert.ok(host.all().filter(n => n.tag === 'img').every(n => safePreview(n.src)));
  await click('Close details'); assert.equal(slot.disposeVersionHistory, undefined); cleanup(); assert.deepEqual(host.children, []);
  for (const url of ['file:///private.png', 'javascript:alert(1)', 'http://example.test/a.png']) assert.equal(safePreview(url), false);
  for (const url of ['https://example.test/a.png', 'blob:synthetic', 'data:image/png;base64,AA']) assert.equal(safePreview(url), true);
});
