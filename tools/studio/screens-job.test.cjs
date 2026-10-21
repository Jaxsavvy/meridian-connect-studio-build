'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { createJob, render, safeUrl } = require('../../src/renderer/studio/screens/job.js');
const { createSpace } = require('../../src/renderer/studio/screens/space.js');
const { mount } = require('../../src/renderer/studio/screens/stage-bar.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
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
const click = (el, label) => walk(el).find(n => n.tag === 'button' && text(n) === label).click();
test('sample Job page shows ordered stages, safe stage images, progress, statuses and routes', async () => {
  const service = createSampleService(), routes = [], el = dom();
  const job = await service.startJob('sample-client', 'website', 'standard');
  const params = { spaceId: job.spaceId, jobId: job.id };
  const cleanup = render(el, params, { service, navigate: (...v) => routes.push(v) });
  assert.match(text(el), /Loading Job/); await tick();
  assert.match(text(el), /Website v1Standard0 of 8 stages done/);
  assert.equal(walk(el).filter(n => n.attrs['aria-current'] === 'step').length, 1);
  assert.deepEqual(walk(el).filter(n => n.tag === 'h2').map(n => n.textContent), job.stages.map(s => s.name));
  assert.match(text(el), /current/); assert.match(text(el), /upcoming/); assert.match(text(el), /Nothing made here yet/);
  assert.ok(job.stages.every(stage => stage.needs.every(need => text(el).includes(need))));
  await service.completeStage(job.spaceId, job.id); await tick(); assert.match(text(el), /Waiting on Jax/);
  await service.approveStage(job.spaceId, job.id); await tick();
  await service.completeStage(job.spaceId, job.id); await service.completeStage(job.spaceId, job.id); await tick();
  const generated = await service.generateImage({ ...params, stageId: 'look', description: 'Synthetic hero', count: 1 });
  await tick(); const images = walk(el).filter(n => n.tag === 'img'); assert.equal(images.length, 1);
  const assets = await service.listJobAssets(job.spaceId, job.id);
  assert.equal(images[0].alt, assets.look[0].name); assert.equal(images[0].src, generated.results[0].url);
  assert.match(text(el), /3 of 8 stages done/);
  click(el, 'Open in Work'); click(el, 'Back');
  assert.deepEqual(routes, [['work', params], ['space', { spaceId: job.spaceId }]]);
  while (!(await service.getJob(job.spaceId, job.id)).finished) {
    await service.completeStage(job.spaceId, job.id);
    if ((await service.getJob(job.spaceId, job.id)).waitingOnJax) await service.approveStage(job.spaceId, job.id);
  }
  await tick(); assert.match(text(el), /8 of 8 stages doneJob finished/);
  assert.equal(walk(el).some(n => n.attrs['aria-current']), false); cleanup();
});
test('loads together, ignores foreign events, retries safe failures, rejects foreign Jobs and stale responses', async () => {
  let listener, removed = false, reads = 0;
  const pending = [], views = [], routes = [];
  const service = { on(fn) { listener = fn; return () => { removed = true; }; },
    getJob() { reads++; return new Promise((resolve, reject) => pending.push({ resolve, reject })); },
    async listJobAssets() { return {}; } };
  const model = createJob({ service, spaceId: 'a', jobId: 'j', report: v => views.push(v), navigate: (...v) => routes.push(v) });
  const first = model.load(); model.openWork(); assert.equal(routes.length, 0);
  pending[0].reject(Error('secret error')); await first; assert.equal(views.at(-1).state, 'failed');
  assert.doesNotMatch(JSON.stringify(views), /secret error/);
  for (const job of [null, { id: 'j', spaceId: 'b' }, { id: 'wrong', spaceId: 'a' }]) {
    const retry = model.load(); pending.at(-1).resolve(job); await retry; assert.equal(views.at(-1).state, 'failed');
  }
  const count = reads; listener('jobs-changed', { spaceId: 'b' }); listener('assets-changed', { spaceId: 'b' });
  assert.equal(reads, count);
  listener('jobs-changed', { spaceId: 'a' }); const old = pending.at(-1);
  listener('assets-changed', { spaceId: 'a' }); pending.at(-1).resolve({ id: 'j', spaceId: 'a', name: 'New' });
  await tick(); old.resolve({ id: 'j', spaceId: 'a', name: 'Old' }); await tick(); assert.equal(views.at(-1).job.name, 'New');
  const late = model.load(); model.dispose(); const length = views.length;
  pending.at(-1).resolve({ id: 'j', spaceId: 'a' }); await late; await model.load(); model.back(); model.openWork();
  assert.equal(views.length, length); assert.equal(removed, true); assert.equal(routes.length, 0);
});
test('unsafe image URLs never reach the DOM; Cinematic and retry work', async () => {
  for (const url of ['https://example.test/image', 'blob:sample', 'data:image/png;base64,AAAA']) assert.ok(safeUrl(url));
  for (const url of ['http://example.test/image', 'javascript:alert(1)', 'file:///image', 'data:text/html,x', null]) assert.ok(!safeUrl(url));
  const service = createSampleService(), el = dom(); let fail = true;
  const job = await service.startJob('sample-client', 'website', 'cinematic');
  const cleanup = render(el, { spaceId: job.spaceId, jobId: job.id }, { service: { ...service,
    async getJob() { if (fail) throw Error('private'); return job; },
    async listJobAssets() { return { brief: [{ kind: 'image', url: 'javascript:alert(1)', name: 'Unsafe' }] }; },
  }, navigate() {} });
  await tick(); assert.match(text(el), /Unable to open/); fail = false; click(el, 'Try again'); await tick();
  assert.match(text(el), /Cinematic/); assert.equal(walk(el).some(n => n.tag === 'img'), false); cleanup();
});
test('real Active Jobs and stage-bar Job page button route to the Job; placeholders cannot open', async () => {
  const service = createSampleService(), routes = [], el = dom();
  const job = await service.startJob('sample-client', 'website', 'standard');
  const navigate = (...v) => routes.push(v), params = { spaceId: job.spaceId, jobId: job.id };
  const model = createSpace({ service, spaceId: job.spaceId, navigate, report() {} });
  await model.load(); assert.equal(model.openJob('unknown'), false); assert.equal(model.openJob(job.id), true);
  const cleanup = mount(el, { ...params, studio: { service, navigate } }); await tick(); click(el, 'Job page');
  assert.deepEqual(routes, [['job', params], ['job', params]]); cleanup(); model.dispose();
});
