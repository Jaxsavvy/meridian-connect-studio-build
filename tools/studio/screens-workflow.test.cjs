'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { createWorkflow, render } = require('../../src/renderer/studio/screens/workflow.js');
const spaceScreen = require('../../src/renderer/studio/screens/space.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup(overrides = {}) {
  const views = [], routes = [], service = { ...createSampleService(), ...overrides };
  const model = createWorkflow({ service, spaceId: 'sample-client', workflowId: 'website',
    report: view => views.push(view), navigate: (...route) => routes.push(route) });
  return { model, views, routes, service };
}
test('both tiers use service stages; Motion only in Cinematic; Job opens in its Space', async () => {
  const s = setup(); await s.model.load();
  assert.equal(s.views.at(-1).tier, 'standard');
  assert.equal(s.views.at(-1).stages.some(stage => stage.id === 'motion'), false);
  assert.equal(s.model.choose('unknown'), false); s.model.choose('cinematic');
  assert.equal(s.views.at(-1).stages.some(stage => stage.id === 'motion'), true);
  await s.model.start();
  const [route, params] = s.routes[0]; assert.equal(route, 'work');
  const job = await s.service.getJob(params.spaceId, params.jobId); assert.equal(job.tier, 'cinematic');
});
test('failed load retries, unavailable workflow and wrong Space refuse start', async () => {
  let fail = true; const base = createSampleService();
  const s = setup({ getSpace: id => { if (fail) throw Error('offline'); return base.getSpace(id); } });
  await s.model.load(); assert.equal(s.views.at(-1).state, 'failed');
  fail = false; await s.model.load(); assert.equal(s.views.at(-1).state, 'ready');
  for (const [override, state] of [[{ getWorkflow: async () => null }, 'empty'],
    [{ getSpace: async () => ({ id: 'other' }) }, 'failed'], [{ getWorkflow: async () => ({ id: 'other' }) }, 'failed']]) {
    const next = setup(override); await next.model.load(); await next.model.start();
    assert.equal(next.views.at(-1).state, state); assert.equal(next.routes.length, 0);
  }
});
test('busy start blocks duplicates, reports error and permits retry; disposed start never navigates', async () => {
  let release, calls = 0;
  const s = setup({ startJob: () => { calls++; return new Promise((resolve, reject) => { release = { resolve, reject }; }); } });
  await s.model.load(); const first = s.model.start(); await s.model.start();
  assert.equal(calls, 1); assert.equal(s.model.choose('cinematic'), false);
  release.reject(Error('Try later')); await first; assert.equal(s.views.at(-1).error, 'Try later');
  const pending = s.model.start(); s.model.dispose(); const length = s.views.length;
  release.resolve({ id: 'job', spaceId: 'sample-client', workflowId: 'website' }); await pending;
  await s.model.load(); assert.equal(s.routes.length, 0); assert.equal(s.views.length, length);
});
test('late loads are ignored after disposal; Back returns to the same Space', async () => {
  let release; const s = setup({ getWorkflow: () => new Promise(resolve => { release = resolve; }) });
  const pending = s.model.load(); s.model.back(); s.model.dispose();
  release(await createSampleService().getWorkflow('website')); await pending;
  assert.equal(s.views.at(-1).state, 'loading'); assert.deepEqual(s.routes, [['space', { spaceId: 'sample-client' }]]);
});
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
test('actual radio controls update stages, descriptions and approval labels; Start opens Job', async () => {
  const el = dom(), routes = [], service = createSampleService();
  const cleanup = render(el, { spaceId: 'sample-client', workflowId: 'website' }, { service, navigate: (...v) => routes.push(v) });
  assert.match(text(el), /Loading workflow/); await tick();
  assert.match(text(el), /Clean, fast site/); assert.match(text(el), /Jax approves/);
  const radio = walk(el).find(n => n.value === 'cinematic'); radio.checked = true; radio.events.change();
  assert.match(text(el), /Motion/);
  walk(el).find(n => n.tag === 'button' && text(n) === 'Start job').click();
  assert.equal(walk(el).find(n => text(n) === 'Starting Job…').disabled, true);
  await tick(); assert.equal(routes[0][0], 'work'); cleanup();
});
test('available workflows and real Jobs navigate; placeholder Job stays plain text; Job events refresh', async () => {
  const service = createSampleService(), routes = [], el = dom();
  const override = { ...service, listTools: async () => (await service.listTools()).map(t => t.id === 'website' ? { ...t, state: 'available' } : t) };
  const cleanup = spaceScreen.render(el, { spaceId: 'sample-client' }, { service: override, navigate: (...v) => routes.push(v) });
  await tick(); assert.equal(walk(el).some(n => n.tag === 'button' && text(n) === 'Website v1'), false);
  walk(el).find(n => n.tag === 'button' && text(n) === 'Website').click();
  assert.deepEqual(routes[0], ['workflow', { spaceId: 'sample-client', workflowId: 'website' }]);
  const job = await service.startJob('sample-client', 'website', 'standard'); await tick();
  walk(el).find(n => n.tag === 'button' && text(n) === 'Website v1').click();
  assert.deepEqual(routes[1], ['job', { spaceId: 'sample-client', jobId: job.id }]); cleanup();
});
test('rendered failed workflow retries and coming-soon state keeps Back available', async () => {
  let fail = true; const service = { ...createSampleService(), getWorkflow: async () => { if (fail) throw Error('offline'); return null; } };
  const el = dom(), routes = [];
  const cleanup = render(el, { spaceId: 'sample-client', workflowId: 'website' }, { service, navigate: (...v) => routes.push(v) });
  await tick(); fail = false; walk(el).find(n => text(n) === 'Try again').click(); await tick();
  assert.match(text(el), /This workflow is coming soon/);
  walk(el).find(n => text(n) === 'Back to Space').click(); assert.equal(routes[0][0], 'space'); cleanup();
});
