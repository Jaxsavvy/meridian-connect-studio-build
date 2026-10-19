'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { createWork, render } = require('../../src/renderer/studio/screens/work.js');
const tick = () => new Promise(r => setImmediate(r));
function setup(overrides = {}, toolId = 'image-gen') {
  const views = [], routes = [];
  const model = createWork({ service: { ...createSampleService(), ...overrides }, spaceId: 'sample-client', toolId,
    report: view => views.push(view), navigate: (...route) => routes.push(route) });
  return { model, views, routes };
}
test('Work loads names from service and Back preserves Space context', async () => {
  const s = setup(); const loading = s.model.load();
  assert.equal(s.views[0].state, 'loading'); await loading;
  assert.equal(s.views.at(-1).tool.name, 'Image gen');
  assert.equal(s.views.at(-1).space.id, 'sample-client');
  s.model.back(); assert.deepEqual(s.routes, [['space', { spaceId: 'sample-client' }]]);
});
test('unknown and coming-soon tools never mount; Space mismatch is refused', async () => {
  for (const id of ['unknown', 'video']) {
    const s = setup({}, id); await s.model.load(); assert.equal(s.views.at(-1).state, 'empty');
  }
  const s = setup({ getSpace: async () => ({ id: 'other-client' }) });
  await s.model.load(); assert.equal(s.views.at(-1).state, 'failed');
});
test('safe error and retry; disposed pending load cannot mount into a new screen', async () => {
  let fail = true;
  const base = createSampleService();
  const s = setup({ getSpace: async id => { if (fail) throw Error('internal details'); return base.getSpace(id); } });
  await s.model.load(); assert.equal(s.views.at(-1).state, 'failed');
  assert.doesNotMatch(JSON.stringify(s.views), /internal details/);
  fail = false; await s.model.load(); assert.equal(s.views.at(-1).state, 'ready');
  let release;
  const late = setup({ getSpace: () => new Promise(r => { release = r; }) });
  const pending = late.model.load(); late.model.dispose(); release({ id: 'sample-client' }); await pending;
  assert.equal(late.views.length, 1); await late.model.load(); assert.equal(late.views.length, 1);
});
function dom() {
  const doc = { createElement(tag) { return { tag, ownerDocument: doc, children: [], attrs: {}, events: {},
    setAttribute(k, v) { this.attrs[k] = v; }, append(...items) { this.children.push(...items); },
    appendChild(item) { this.append(item); }, replaceChildren(...items) { this.children = items; },
    addEventListener(k, fn) { this.events[k] = fn; }, removeEventListener(k, fn) { if (this.events[k] === fn) delete this.events[k]; },
    focus() { doc.activeElement = this; }, remove() {}, click() { this.events.click?.(); } }; } };
  return doc.createElement('main');
}
const walk = el => [el, ...el.children.flatMap(walk)];
const text = el => (el.textContent || '') + el.children.map(text).join('');
function shell(doc) {
  let confirmLeave = false;
  const win = { MeridianStudioService: { createSampleService }, confirm: () => confirmLeave };
  vm.runInNewContext(fs.readFileSync(require.resolve('../../src/renderer/studio/studio-app.js'), 'utf8'),
    { window: win, document: doc, console });
  return { studio: win.MeridianStudio, allowLeave() { confirmLeave = true; } };
}
test('actual shell placeholders, labeled regions, canvas focus and unsaved Back guard', async () => {
  const el = dom(); const s = shell(el.ownerDocument);
  const cleanup = render(el, { spaceId: 'sample-client', toolId: 'image-gen' }, s.studio);
  await tick();
  assert.match(text(el), /Tool "image-gen" — coming soon/);
  assert.match(text(el), /Panel "conversation" — coming soon/);
  assert.match(text(el), /Panel "assets-strip" — coming soon/);
  const regions = walk(el).filter(e => e.attrs['aria-labelledby']);
  assert.deepEqual(regions.map(e => e.attrs['aria-labelledby']),
    ['studio-work-canvas-heading', 'studio-work-conversation-heading', 'studio-work-assets-heading']);
  assert.ok(regions.every(e => e.tabIndex === 0));
  assert.equal(el.ownerDocument.activeElement.id, 'studio-work-canvas-heading');
  assert.equal(walk(el).find(e => e.className === 'studio-work-stage-bar').hidden, true);
  const back = walk(el).find(e => e.tag === 'button');
  s.studio.setDirty(true); back.click(); assert.equal(s.studio.current().name, 'home');
  s.allowLeave(); back.click(); assert.equal(s.studio.current().name, 'space');
  assert.equal(s.studio.current().params.spaceId, 'sample-client');
  cleanup(); assert.equal(back.events.click, undefined);
});
test('ready view mounts each region with the requested context; failure retry button works', async () => {
  const el = dom(), mounts = [], base = createSampleService(); let fail = true;
  const service = { ...base, getSpace: id => { if (fail) throw Error('offline'); return base.getSpace(id); } };
  const cleanup = render(el, { spaceId: 'sandbox-me', toolId: 'asset-library' },
    { service, navigate() {}, mountInto: (el, kind, id, ctx) => mounts.push({ kind, id, ctx }) });
  await tick(); assert.match(text(el), /Unable to open/);
  fail = false; walk(el).find(e => e.tag === 'button' && text(e) === 'Try again').click(); await tick();
  assert.deepEqual(mounts, [
    { kind: 'tool', id: 'asset-library', ctx: { spaceId: 'sandbox-me' } },
    { kind: 'part', id: 'conversation', ctx: { spaceId: 'sandbox-me', toolId: 'asset-library' } },
    { kind: 'part', id: 'assets-strip', ctx: { spaceId: 'sandbox-me', toolId: 'asset-library' } },
  ]); cleanup();
});
