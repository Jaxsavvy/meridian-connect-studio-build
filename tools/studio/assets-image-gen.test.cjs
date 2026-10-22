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

test('mounted references follow this Space live and removed references invalidate confirmation without losing a draft', async () => {
  const base = createSampleService(), tick = () => new Promise(setImmediate);
  const own = await base.generateImage({ spaceId: 'sandbox-me', description: 'Reference', count: 1 });
  const doc = { createElement: tag => new Element(tag, doc), activeElement: null }, host = new Element('div', doc);
  let reads = 0;
  const cleanup = mountCanvas(host, { spaceId: 'sandbox-me', studio: {
    service: { ...base, listAssets: id => { reads += 1; return base.listAssets(id); } }, setDirty() {}, on: () => () => {},
  } }); await tick();
  const description = host.all().find(n => n.tag === 'textarea'), reference = host.all().filter(n => n.tag === 'select')[1];
  description.value = 'Unsaved paper boat'; description.events.input(); reference.value = own.results[0].assetId; reference.events.change();
  host.all().find(n => n.textContent === 'Sharpen my description').events.click();
  const confirm = host.all().find(n => n.type === 'checkbox'); confirm.checked = true; confirm.events.change();
  const before = reads; await base.generateImage({ spaceId: 'sandbox-team', description: 'Foreign', count: 1 }); await tick();
  assert.equal(reads, before); assert.equal(confirm.checked, true);
  const added = await base.generateImage({ spaceId: 'sandbox-me', description: 'Added', count: 1 }); await tick();
  assert.ok(reference.children.some(n => n.value === added.results[0].assetId));
  await base.trashAsset('sandbox-me', own.results[0].assetId); await tick();
  assert.equal(reference.value, ''); assert.equal(confirm.checked, false); assert.equal(description.value, 'Unsaved paper boat');
  assert.equal(host.all().find(n => n.textContent === 'Generate').disabled, true);
  assert.ok(host.all().some(n => /reference is no longer available/.test(n.textContent || '')));
  cleanup(); const stopped = reads; await base.restoreAsset('sandbox-me', own.results[0].assetId); await tick(); assert.equal(reads, stopped);
});

test('generation revalidates a reference removed after confirmation before calling the service', async () => {
  const base = createSampleService(), own = await base.generateImage({ spaceId: 'sandbox-me', description: 'Reference', count: 1 });
  let calls = 0;
  const c = await prepare({ ...base, generateImage: request => { calls += 1; return base.generateImage(request); } });
  await c.addReference(own.results[0].assetId); c.sharpen(); c.confirm(true);
  await base.trashAsset('sandbox-me', own.results[0].assetId);
  assert.equal(await c.generate(), false); assert.equal(calls, 0); assert.deepEqual(c.snapshot().references, []);
  assert.equal(c.snapshot().confirmed, false); assert.equal(c.snapshot().dirty, true);
  assert.equal(c.snapshot().description, 'A crew in a workshop'); assert.match(c.snapshot().error, /reference is no longer available/);
  c.dispose();
});

test('live changes preserve a failed Keep retry and unavailable results cannot become variation references', async () => {
  const base = createSampleService(); let fail = true, calls = 0;
  const c = await prepare({ ...base, keepAsset: async (...args) => {
    calls += 1; if (fail) throw Object.assign(new Error(), { code: 'OFFLINE' }); return base.keepAsset(...args);
  } }); c.confirm(true); await c.generate(); const id = c.snapshot().results[0].assetId;
  await c.keep(id); await c.assetsChanged(); assert.equal(c.snapshot().phase, 'failed'); assert.equal(c.snapshot().dirty, true);
  fail = false; await c.retry(); assert.equal(calls, 2); assert.equal(c.snapshot().phase, 'ready'); assert.equal(c.snapshot().dirty, false);
  await base.trashAsset('sandbox-me', id); await c.assetsChanged(); assert.equal(c.variations(id), false); c.dispose();
});

test('asset refreshes queue during writes, reject stale reads, and clear inaccessible data before access retry', async () => {
  const base = createSampleService(), c = await prepare(base); c.confirm(true); await c.generate();
  const id = c.snapshot().results[0].assetId; let resolveKeep;
  const pendingService = { ...base, keepAsset: async (...args) => { await new Promise(resolve => { resolveKeep = resolve; }); return base.keepAsset(...args); } };
  const queued = await prepare(pendingService); queued.receive(packet({ results: c.snapshot().results }));
  const keep = queued.keep(id); await new Promise(setImmediate);
  const added = await base.generateImage({ spaceId: 'sandbox-me', description: 'While saving', count: 1 });
  await queued.assetsChanged(); assert.equal(queued.snapshot().phase, 'saving'); resolveKeep(); await keep;
  assert.ok(queued.snapshot().assets.some(a => a.id === added.results[0].assetId)); queued.dispose(); c.dispose();
  const pending = []; let defer = false, denied = false;
  const fresh = await prepare({ ...base, listAssets: id => {
    if (denied) throw Object.assign(new Error('private diagnostic'), { status: 403 });
    return defer ? new Promise(resolve => pending.push(resolve)) : base.listAssets(id);
  } });
  const assets = await base.listAssets('sandbox-me'); defer = true;
  const old = fresh.assetsChanged(), current = fresh.assetsChanged(); pending[1]([]); await current; pending[0](assets); await old;
  assert.deepEqual(fresh.snapshot().assets, []); defer = false; denied = true; await fresh.assetsChanged();
  assert.equal(fresh.snapshot().ready, false); assert.deepEqual(fresh.snapshot().results, []); assert.doesNotMatch(fresh.snapshot().error, /private diagnostic/);
  denied = false; await fresh.retry(); assert.equal(fresh.snapshot().ready, true); fresh.dispose();
});

test('mounted canvas tags first generation and Variations with the Job Look stage; standalone requests stay unchanged', async () => {
  for (const inJob of [true, false]) {
    const base = createSampleService(), job = await base.startJob('sandbox-me', 'website', 'standard'), requests = [];
    const service = { ...base, generateImage: req => { requests.push(req); return base.generateImage(req); } };
    const doc = { createElement: tag => new Element(tag, doc), activeElement: null }, host = new Element('div', doc);
    const cleanup = mountCanvas(host, { spaceId: 'sandbox-me', ...(inJob ? { jobId: job.id, stageId: 'look' } : { stageId: 'look' }),
      studio: { service, setDirty() {}, on: () => () => {} } });
    const tick = () => new Promise(setImmediate); await tick();
    const click = async label => { const b = host.all().find(n => n.tag === 'button' && n.textContent === label && !n.hidden); assert.ok(b); assert.equal(b.disabled, false); await b.events.click(); await tick(); };
    const approve = () => { const c = host.all().find(n => n.type === 'checkbox'); c.checked = true; c.events.change(); };
    const input = host.all().find(n => n.tag === 'textarea'); input.value = 'Synthetic stage image'; input.events.input();
    await click('Sharpen my description'); approve(); await click('Generate'); await click('Variations'); approve(); await click('Generate');
    assert.equal(requests.length, 2);
    const assets = await base.listAssets('sandbox-me'), grouped = await base.listJobAssets('sandbox-me', job.id);
    if (inJob) {
      assert.equal(grouped.look.length, 8);
      assert.ok(requests.every(r => r.jobId === job.id && r.stageId === 'look'));
      assert.ok(assets.every(a => a.jobId === job.id && a.stageId === 'look'));
    } else {
      assert.equal(grouped.look.length, 0);
      assert.ok(assets.every(a => !Object.hasOwn(a, 'jobId') && !Object.hasOwn(a, 'stageId')));
      for (const r of requests) assert.deepEqual(Object.keys(r).sort(), ['spaceId', 'requestId', 'presetId', 'description', 'count', 'references'].sort());
    }
    cleanup();
  }
});

test('Job context stays on the same confirmed request through retry and uncertain-success reconciliation', async () => {
  const base = createSampleService(), job = await base.startJob('sandbox-me', 'website', 'standard'), calls = [];
  let fail = true;
  const c = await prepare({ ...base, generateImage: req => { calls.push(req); if (fail) throw new Error('Offline'); return base.generateImage(req); } },
    { jobId: job.id, stageId: 'look' });
  c.confirm(true); await c.generate(); fail = false; await c.retry();
  assert.equal(calls.length, 2); assert.equal(calls[0], calls[1]);
  assert.equal(calls[1].jobId, job.id); assert.equal(calls[1].stageId, 'look');
  assert.equal((await base.listJobAssets('sandbox-me', job.id)).look.length, 1); c.dispose();
  let writes = 0;
  const recovered = await prepare({ ...base, generateImage: async req => { writes++; await base.generateImage(req); throw new Error('Disconnected after save'); } },
    { jobId: job.id, stageId: 'look' });
  recovered.confirm(true); await recovered.generate(); assert.equal(writes, 1);
  assert.equal(recovered.snapshot().results.length, 1);
  assert.equal((await base.listJobAssets('sandbox-me', job.id)).look.length, 2); recovered.dispose();
});
