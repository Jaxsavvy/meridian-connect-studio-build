'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { groupTools, recentAssets, progress, createSpace, render } = require('../../src/renderer/studio/screens/space.js');
const tick = () => new Promise(r => setImmediate(r));
function setup(overrides = {}) {
  const views = [], routes = []; let listener, removed = false;
  const service = { ...createSampleService(), ...overrides,
    on(fn) { listener = fn; return () => { removed = true; }; } };
  const model = createSpace({ service, spaceId: 'sample-client', report: v => views.push(v), navigate: (...v) => routes.push(v) });
  return { views, routes, service, model, emit: (...args) => listener(...args), removed: () => removed };
}
test('workflow row precedes tools; only available entries can open Work', async () => {
  const s = setup(); await s.model.load();
  const groups = groupTools(await s.service.listTools());
  assert.deepEqual(groups.map(g => g.kind), ['workflow', 'tool']);
  assert.deepEqual(groups[0].tools.filter(t => !t.disabled).map(t => t.id), ['website', 'pitch-deck']); // Core switched Website on after #77, Pitch deck in #113
  assert.equal(s.model.open('video'), false); assert.equal(s.model.open('unknown'), false);
  assert.equal(s.model.open('image-gen'), true); assert.equal(s.model.open('asset-library'), true);
  s.model.back();
  assert.deepEqual(s.routes, [['work', { spaceId: 'sample-client', toolId: 'image-gen' }],
    ['work', { spaceId: 'sample-client', toolId: 'asset-library' }], ['home']]);
});
test('recent assets stay in Space, omit trash, show newest six; progress is bounded', () => {
  const assets = Array.from({ length: 8 }, (_, i) => ({ id: String(i), spaceId: 'a' }));
  assert.deepEqual(recentAssets([...assets, { id: 'foreign', spaceId: 'b' }, { spaceId: 'a', trashed: true }], 'a')
    .map(a => a.id), ['7', '6', '5', '4', '3', '2']);
  assert.deepEqual([progress(-9), progress(120), progress('bad'), progress(45)], [0, 100, 0, 45]);
});
test('failures hide raw service errors, retry works, and mismatched Space is refused', async () => {
  let fail = true;
  const s = setup({ getSpace: async () => { if (fail) throw Error('private details'); return { id: 'sample-client', jobs: [] }; } });
  await s.model.load(); assert.equal(s.views.at(-1).state, 'failed');
  assert.equal(s.model.open('image-gen'), false);
  assert.doesNotMatch(JSON.stringify(s.views), /private details/);
  fail = false; await s.model.load(); assert.equal(s.views.at(-1).state, 'ready');
  const other = setup({ getSpace: async () => ({ id: 'foreign' }) });
  await other.model.load(); assert.equal(other.views.at(-1).state, 'failed');
});
test('asset events are scoped, cleanup unsubscribes and late loads cannot show old client data', async () => {
  let release, count = 0;
  const s = setup({ getSpace: () => { count++; return new Promise(r => { release = r; }); } });
  const loading = s.model.load();
  s.emit('assets-changed', { spaceId: 'other' }); assert.equal(count, 1);
  s.model.dispose(); const length = s.views.length;
  release({ id: 'sample-client' }); await loading;
  assert.equal(s.views.length, length); assert.equal(s.removed(), true);
});
// Small synthetic DOM checks the actual labels, disabled controls and click wiring.
function dom() {
  const doc = { createElement(tag) { return { tag, ownerDocument: doc, children: [], attrs: {}, events: {},
    setAttribute(k, v) { this.attrs[k] = v; }, append(...items) { this.children.push(...items); },
    appendChild(item) { this.append(item); }, replaceChildren(...items) { this.children = items; },
    addEventListener(k, fn) { this.events[k] = fn; }, remove() {},
    click() { if (!this.disabled) this.events.click?.(); } }; } };
  return doc.createElement('main');
}
const walk = el => [el, ...el.children.flatMap(walk)];
const text = el => (el.textContent || '') + el.children.map(text).join('');
test('rendered sample DNA, jobs, Coming soon labels and native buttons work', async () => {
  const el = dom(), routes = [];
  const cleanup = render(el, { spaceId: 'sample-client' }, { service: createSampleService(), navigate: (...v) => routes.push(v) });
  assert.match(text(el), /Loading Space/); await tick();
  assert.match(text(el), /Draft, waiting on Jax/); assert.match(text(el), /Website v1/);
  const buttons = walk(el).filter(e => e.tag === 'button');
  buttons.find(e => text(e) === 'Image gen').click();
  buttons.find(e => text(e) === 'Asset Library').click();
  const video = buttons.find(e => text(e).startsWith('Video'));
  assert.equal(video.disabled, true); assert.match(text(video), /Coming soon/); video.click();
  buttons.find(e => text(e) === 'Back to Studio').click();
  assert.equal(routes.length, 3); cleanup();
});
test('rendered retry button recovers to sandbox empty sections', async () => {
  const base = createSampleService(); let fail = true;
  const service = { ...base, getSpace: id => { if (fail) throw Error('offline'); return base.getSpace(id); } };
  const el = dom(); const cleanup = render(el, { spaceId: 'sandbox-me' }, { service, navigate() {} });
  await tick(); fail = false;
  walk(el).find(e => e.tag === 'button' && text(e) === 'Try again').click(); await tick();
  assert.match(text(el), /Sandboxes don't need Project DNA/);
  assert.match(text(el), /No active Jobs/); assert.match(text(el), /No assets/); cleanup();
});
