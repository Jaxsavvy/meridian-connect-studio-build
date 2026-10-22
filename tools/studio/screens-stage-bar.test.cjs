'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { createStageBar, mount } = require('../../src/renderer/studio/screens/stage-bar.js');
const { createWork, render } = require('../../src/renderer/studio/screens/work.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
async function setup() {
  const service = createSampleService(), views = [], jobs = [];
  const job = await service.startJob('sample-client', 'website', 'standard');
  const model = createStageBar({ service, spaceId: job.spaceId, jobId: job.id,
    report: v => views.push(v), onStage: j => jobs.push(j) });
  await model.load(); return { service, job, views, jobs, model };
}
test('current, waiting, done and finished follow service; employees cannot approve Jax stages', async () => {
  const s = await setup(); assert.equal(s.views.at(-1).job.stages[0].status, 'current');
  await s.model.complete(); assert.equal(s.views.at(-1).job.waitingOnJax, true);
  const count = s.jobs.length; await s.model.complete(); assert.equal(s.jobs.length, count);
  await s.service.approveStage(s.job.spaceId, s.job.id); await tick();
  assert.equal(s.views.at(-1).job.stages[0].status, 'done');
  assert.equal(s.views.at(-1).job.stageId, 'plan');
  await s.model.complete(); assert.equal(s.views.at(-1).job.stageId, 'storyboard');
  while (!s.views.at(-1).job.finished) {
    await s.model.complete();
    if (s.views.at(-1).job.waitingOnJax) { await s.service.approveStage(s.job.spaceId, s.job.id); await tick(); }
  }
  assert.ok(s.views.at(-1).job.stages.every(stage => stage.status === 'done'));
  const finishedCount = s.jobs.length; await s.model.complete(); assert.equal(s.jobs.length, finishedCount); s.model.dispose();
});
test('foreign events ignored; failures retry; mismatched Jobs refused and disposal ignores late loads', async () => {
  let listener, release, removed = false, reads = 0, fail = true;
  const views = [], stages = [], service = { on(fn) { listener = fn; return () => { removed = true; }; },
    async getJob() { reads++; if (fail) throw Error('private'); return new Promise(r => { release = r; }); } };
  const model = createStageBar({ service, spaceId: 'a', jobId: 'job', report: v => views.push(v), onStage: j => stages.push(j) });
  await model.load(); assert.equal(views.at(-1).state, 'failed'); assert.doesNotMatch(JSON.stringify(views), /private/);
  listener('jobs-changed', { spaceId: 'b' }); assert.equal(reads, 1);
  fail = false; const wrong = model.load(); release({ id: 'job', spaceId: 'b' }); await wrong;
  assert.equal(views.at(-1).state, 'failed'); assert.equal(stages.length, 0);
  const pending = model.load(); model.dispose(); const count = views.length;
  release({ id: 'job', spaceId: 'a' }); await pending; await model.load();
  assert.equal(views.length, count); assert.equal(removed, true);
});
test('completion errors retry and duplicate clicks cannot complete two stages', async () => {
  const s = await setup(); let reject, calls = 0;
  const views = [], service = { ...s.service, completeStage() { calls++; return new Promise((_, fail) => { reject = fail; }); } };
  const model = createStageBar({ service, spaceId: s.job.spaceId, jobId: s.job.id, report: v => views.push(v) });
  await model.load(); const pending = model.complete(); await model.complete(); assert.equal(calls, 1);
  reject(Error('private')); await pending; assert.match(views.at(-1).error, /Try again/);
  assert.equal(views.at(-1).busy, false); model.dispose(); s.model.dispose();
});
function dom() {
  const doc = { createElement(tag) { return { tag, ownerDocument: doc, children: [], attrs: {}, events: {},
    setAttribute(k, v) { this.attrs[k] = v; }, append(...items) { this.children.push(...items); },
    appendChild(item) { this.append(item); }, replaceChildren(...items) { this.children = items; },
    addEventListener(k, fn) { this.events[k] = fn; }, removeEventListener(k) { delete this.events[k]; },
    focus() { doc.activeElement = this; }, remove() {}, click() { if (!this.disabled) this.events.click?.(); } }; } };
  return doc.createElement('main');
}
const walk = el => [el, ...el.children.flatMap(walk)];
const text = el => (el.textContent || '') + el.children.map(text).join('');
test('actual stage controls show current step, local checklist, quality check and waiting status', async () => {
  const s = await setup(), el = dom();
  const cleanup = mount(el, { spaceId: s.job.spaceId, jobId: s.job.id, studio: { service: s.service } });
  await tick(); assert.equal(walk(el).filter(n => n.attrs['aria-current'] === 'step').length, 1);
  assert.match(text(el), /Quality check: Brief matches Project DNA/); assert.match(text(el), /Approved by Jax/);
  const checkbox = walk(el).find(n => n.type === 'checkbox'); checkbox.checked = true; checkbox.events.change();
  walk(el).find(n => text(n) === 'Mark stage done').click(); await tick();
  assert.equal(walk(el).find(n => n.tag === 'button').disabled, true);
  assert.match(text(el), /Waiting on Jax/); assert.equal(walk(el).find(n => n.type === 'checkbox').checked, true);
  assert.equal((await s.service.getJob(s.job.spaceId, s.job.id)).stageId, 'brief'); cleanup(); s.model.dispose();
});
test('Work follows current stage, tool switching uses guarded screen navigation and exact mount context', async () => {
  const s = await setup(); await s.model.complete(); await s.service.approveStage(s.job.spaceId, s.job.id);
  await s.service.completeStage(s.job.spaceId, s.job.id); // Storyboard has two tools.
  const el = dom(), mounts = [], routes = [];
  const cleanup = render(el, { spaceId: s.job.spaceId, jobId: s.job.id }, { service: s.service,
    navigate: (...v) => routes.push(v), mountInto: (slot, kind, id, ctx) => mounts.push({ slot, kind, id, ctx }) });
  await tick(); assert.equal(walk(el).find(n => n.className === 'studio-work-stage-bar').hidden, false);
  const expected = { spaceId: s.job.spaceId, toolId: 'storyboard', jobId: s.job.id, stageId: 'storyboard' };
  for (const entry of mounts.slice(0, 3)) assert.deepEqual(entry.ctx, expected);
  walk(el).find(n => n.tag === 'button' && text(n) === 'Image gen').click();
  assert.deepEqual(routes[0], ['work', { ...expected, toolId: 'image-gen' }]);
  const stage = mounts.find(n => n.id === 'stage-bar');
  stage.ctx.onStage(await s.service.getJob(s.job.spaceId, s.job.id)); assert.equal(routes.length, 1);
  await s.service.completeStage(s.job.spaceId, s.job.id);
  const next = await s.service.getJob(s.job.spaceId, s.job.id); stage.ctx.onStage(next);
  assert.deepEqual(routes[1], ['work', { spaceId: s.job.spaceId, jobId: s.job.id, stageId: 'look', toolId: 'image-gen' }]);
  cleanup(); stage.ctx.onStage({ ...next, stageId: 'review' }); assert.equal(routes.length, 2); s.model.dispose();
});
test('selected tool stays in current stage; invalid selection resets; no-tools stages mount no tool', async () => {
  const s = await setup(), views = [];
  const job = await s.service.getJob(s.job.spaceId, s.job.id);
  for (const [stageId, toolId, want] of [['storyboard', 'image-gen', 'image-gen'], ['brief', 'image-gen', 'storyboard']]) {
    const service = { ...s.service, getJob: async () => ({ ...job, stageId: 'storyboard' }) };
    const model = createWork({ service, spaceId: job.spaceId, jobId: job.id, stageId, toolId, report: v => views.push(v) });
    await model.load(); assert.equal(views.at(-1).tool.id, want); model.dispose();
  }
  const el = dom(), mounts = [];
  const cleanup = render(el, { spaceId: job.spaceId, jobId: job.id }, { service: { ...s.service,
    getJob: async () => ({ ...job, stageId: 'review' }) }, navigate() {}, mountInto: (_, kind, id) => mounts.push({ kind, id }) });
  await tick(); assert.match(text(el), /Nothing to make in this stage/); assert.equal(mounts.some(m => m.kind === 'tool'), false);
  cleanup(); s.model.dispose();
});
test('Work refuses foreign or missing Jobs and provides a retryable safe failure', async () => {
  for (const job of [null, { id: 'job', spaceId: 'other' }, { id: 'other', spaceId: 'sample-client' }]) {
    const views = [], model = createWork({ service: { ...createSampleService(), getJob: async () => job },
      spaceId: 'sample-client', jobId: 'job', report: v => views.push(v) });
    await model.load(); assert.equal(views.at(-1).state, 'failed'); model.dispose();
  }
});
test('actual shell guards tool changes, disposes old mounts and ignores Job events after leaving', async () => {
  const fs = require('node:fs'), vm = require('node:vm'), el = dom(), doc = el.ownerDocument;
  let allow = false, activeTools = 0;
  const win = { MeridianStudioService: { createSampleService }, confirm: () => allow };
  vm.runInNewContext(fs.readFileSync(require.resolve('../../src/renderer/studio/studio-app.js'), 'utf8'), { window: win, document: doc, console });
  const studio = win.MeridianStudio, service = studio.service;
  studio.registerScreen('work', { render });
  studio.registerPart('stage-bar', { mount });
  for (const id of ['storyboard', 'image-gen']) studio.registerTool(id, { mountCanvas(_, ctx) {
    activeTools++; const off = ctx.studio.service.on(() => {});
    return () => { activeTools--; off(); };
  } });
  const job = await service.startJob('sample-client', 'website', 'standard');
  await service.completeStage(job.spaceId, job.id); await service.approveStage(job.spaceId, job.id);
  await service.completeStage(job.spaceId, job.id);
  doc.head = { appendChild() {} }; studio.navigate('work', { spaceId: job.spaceId, jobId: job.id });
  win.MeridianStudioUI.mount({ host: el, getProjects: () => [] }); win.MeridianStudioUI.setActive(true); await tick();
  assert.equal(activeTools, 1); studio.setDirty(true);
  walk(el).find(n => n.tag === 'button' && text(n) === 'Image gen').click(); await tick();
  assert.equal(studio.current().params.toolId, undefined); assert.equal(activeTools, 1);
  allow = true; walk(el).find(n => n.tag === 'button' && text(n) === 'Image gen').click(); await tick();
  assert.equal(studio.current().params.toolId, 'image-gen'); assert.equal(activeTools, 1);
  await service.completeStage(job.spaceId, job.id); await tick();
  assert.equal(studio.current().params.stageId, 'look'); assert.equal(activeTools, 1);
  studio.navigate('space', { spaceId: job.spaceId }); assert.equal(activeTools, 0);
  await service.completeStage(job.spaceId, job.id); await tick(); assert.equal(studio.current().name, 'space');
});
