'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { createMove, mount } = require('../../src/renderer/studio/screens/move-to-client.js');
const { render } = require('../../src/renderer/studio/screens/space.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
async function setup() {
  const service = createSampleService();
  service.setProjects([{ id: 'sample-client', name: 'Sample Client' }]);
  const result = await service.generateImage({ spaceId: 'sandbox-me', description: 'Synthetic image', count: 1 });
  const assetId = result.results[0].assetId; await service.keepAsset('sandbox-me', assetId);
  return { service, spaceId: 'sandbox-me', assetId };
}
function dom() {
  const doc = { createElement(tag) { return { tag, tagName: tag.toUpperCase(), ownerDocument: doc, children: [], attrs: {}, events: {},
    setAttribute(k, v) { this.attrs[k] = v; }, append(...items) { for (const item of items) { item.parent = this; this.children.push(item); } },
    appendChild(item) { this.append(item); }, replaceChildren(...items) { this.children = []; this.append(...items); },
    addEventListener(k, fn) { this.events[k] = fn; }, remove() { if (this.parent) this.parent.children = this.parent.children.filter(n => n !== this); },
    focus() { doc.activeElement = this; }, contains(item) { return walk(this).includes(item); },
    querySelectorAll(tag) { return walk(this).filter(n => n.tag === tag); }, querySelector(tag) { return this.querySelectorAll(tag)[0]; },
    click() { if (!this.disabled) this.events.click?.(); } }; } };
  return doc.createElement('main');
}
const walk = el => [el, ...el.children.flatMap(walk)];
const text = el => (el.textContent || '') + el.children.map(text).join('');
const button = (el, label) => walk(el).find(n => n.tag === 'button' && text(n) === label);
test('confirm then copy makes a new client original, preserves sandbox, and routes to the chosen client', async () => {
  const s = await setup(), el = dom(), routes = []; let done = 0;
  const before = await s.service.listAssets(s.spaceId);
  const cleanup = mount(el, { ...s, studio: { service: s.service, navigate: (...v) => routes.push(v) }, onDone: () => done++ });
  await tick(); assert.ok(button(el, 'Sample Client')); assert.equal(button(el, 'My sandbox'), undefined);
  button(el, 'Sample Client').click();
  assert.match(text(el), new RegExp(`Copy ${before[0].name} into Sample Client\\? Your sandbox keeps its copy\\.`));
  button(el, 'Copy').click(); assert.equal(button(el, 'Copying…').disabled, true); assert.equal(button(el, 'Cancel').disabled, true);
  await tick(); assert.match(text(el), /Copied to Sample Client/);
  assert.deepEqual(await s.service.listAssets(s.spaceId), before);
  const copies = await s.service.listAssets('sample-client'); assert.equal(copies.length, 1);
  assert.notEqual(copies[0].id, s.assetId); assert.equal(copies[0].version, 1); assert.equal(copies[0].kept, true);
  button(el, 'Open Sample Client').click(); assert.deepEqual(routes, [['space', { spaceId: 'sample-client' }]]);
  button(el, 'Done').click(); assert.equal(done, 1); assert.equal(el.children.length, 0); cleanup();
});
test('only other client Spaces appear; cancel never copies; load failures retry and client sources are refused', async () => {
  const s = await setup(), views = []; let done = 0, copies = 0, fail = true;
  const service = { ...s.service, async listSpaces() {
    if (fail) throw Error('Offline'); return [{ id: s.spaceId, type: 'client' }, { id: 'team', type: 'sandbox-team' }];
  }, async copyToSpace() { copies++; } };
  const model = createMove({ ...s, service, report: v => views.push(v), onDone: () => done++, navigate() {} });
  await model.load(); assert.equal(views.at(-1).error, 'Offline'); fail = false; await model.load();
  assert.deepEqual(views.at(-1).clients, []); model.choose('team'); await model.copy(); model.done();
  assert.equal(copies, 0); assert.equal(done, 1); model.dispose();
  const el = dom(), cleanup = mount(el, { ...s, studio: { service, navigate() {} }, onDone() {} });
  await tick(); assert.match(text(el), /You don't have any client Spaces yet/); cleanup();
  const denied = createMove({ ...s, service: { ...service, getSpace: async () => ({ id: s.spaceId, type: 'client' }) },
    report: v => views.push(v), onDone() {}, navigate() {} });
  await denied.load(); assert.equal(views.at(-1).state, 'failed'); denied.dispose();
});
test('copy errors are visible and retryable; duplicate clicks and busy cancellation do not duplicate a copy', async () => {
  const s = await setup(), el = dom(); let reject, calls = 0, done = 0;
  const service = { ...s.service, copyToSpace(...args) {
    assert.deepEqual(args, [s.spaceId, s.assetId, 'sample-client']); calls++;
    return calls === 1 ? new Promise((_, fail) => { reject = fail; }) : s.service.copyToSpace(...args);
  } };
  const cleanup = mount(el, { ...s, studio: { service, navigate() {} }, onDone: () => done++ });
  await tick(); button(el, 'Sample Client').click(); button(el, 'Copy').click();
  button(el, 'Copying…').click(); button(el, 'Cancel').click(); assert.equal(calls, 1); assert.equal(done, 0);
  reject(Error('Copy unavailable')); await tick(); assert.match(text(el), /Copy unavailable/);
  button(el, 'Copy').click(); await tick(); assert.equal(calls, 2); assert.match(text(el), /Copied to/); cleanup();
});
test('disposal ignores late loads and copies; abort removes the panel without calling Done', async () => {
  const s = await setup(), views = []; let release;
  const model = createMove({ ...s, service: { ...s.service, listSpaces: () => new Promise(r => { release = r; }) },
    report: v => views.push(v), onDone() { assert.fail('disposed'); }, navigate() { assert.fail('disposed'); } });
  const pending = model.load(); model.dispose(); release([]); await pending; await model.load(); model.done(); model.open();
  assert.equal(views.length, 1);
  const el = dom(), controller = new AbortController();
  const cleanup = mount(el, { ...s, signal: controller.signal, studio: { service: { ...s.service,
    copyToSpace: () => new Promise(r => { release = r; }) }, navigate() {} }, onDone() { assert.fail('aborted'); } });
  await tick(); button(el, 'Sample Client').click(); button(el, 'Copy').click(); controller.abort(); release({}); await tick();
  assert.equal(el.children.length, 0); cleanup();
});
test('sandbox panel closes and restores its own asset button; client assets have no Move button; refresh aborts panel', async () => {
  const s = await setup(), el = dom(), contexts = [];
  const studio = { service: s.service, navigate() {}, mountInto(panel, kind, id, ctx) {
    assert.equal(kind, 'part'); assert.equal(id, 'move-to-client'); contexts.push(ctx); mount(panel, { ...ctx, studio });
  } };
  const cleanup = render(el, s, studio); await tick(); const move = button(el, 'Move to client'); assert.ok(move);
  move.click(); await tick(); button(el, 'Sample Client').click(); button(el, 'Cancel').click();
  assert.equal(el.ownerDocument.activeElement, move); assert.equal(contexts[0].signal.aborted, true);
  assert.equal((await s.service.listAssets('sample-client')).length, 0);
  move.click(); await tick(); await s.service.keepAsset(s.spaceId, s.assetId); await tick();
  assert.equal(contexts[1].signal.aborted, true);
  button(el, 'Move to client').click(); await tick(); cleanup(); assert.equal(contexts[2].signal.aborted, true);
  await s.service.copyToSpace(s.spaceId, s.assetId, 'sample-client');
  const client = dom(), closeClient = render(client, { spaceId: 'sample-client' }, studio); await tick();
  assert.equal(button(client, 'Move to client'), undefined); closeClient();
});
