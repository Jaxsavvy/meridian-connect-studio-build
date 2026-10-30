'use strict';
// Copywriter (#105): the Kickoff brief form's logic against the sample service (synthetic data only).
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { createCopywriter, OUTSIDE } = require('../../src/renderer/studio/tools/copywriter/copywriter.js');

async function setup(stageId = 'brief', { listeners, overrides } = {}) {
  const service = createSampleService();
  service.setProjects([{ id: 'sample-home', name: 'Sample Home Services' }]);
  const job = await service.startJob('sample-home', 'website', 'standard');
  const views = [], dirty = [];
  // the service is frozen: tests wrap a copy of its methods instead of changing it
  const wrapped = { ...service, ...(overrides || {}),
    ...(listeners ? { on(fn) { listeners.count += 1; const off = service.on(fn); return () => { listeners.count -= 1; off(); }; } } : {}) };
  const model = createCopywriter({ spaceId: 'sample-home', jobId: job.id, stageId, service: wrapped,
    onChange: s => views.push(s), onDirty: d => dirty.push(d) });
  await model.start();
  return { service, job, model, views, dirty, last: () => views.at(-1) };
}

test('loads, edits, saves, and a fresh load shows what was saved', async () => {
  const s = await setup();
  assert.equal(s.last().phase, 'ready');
  s.model.edit('goal', 'More booked estimates');
  s.model.edit('audience', 'Homeowners in Eugene');
  assert.equal(s.model.addPage('Services'), true);
  assert.equal(s.model.addPage('Services'), false, 'no duplicates');
  s.model.addPage('Contact');
  s.model.removePage(1);
  assert.equal(s.last().dirty, true);
  assert.equal(await s.model.save(), true);
  assert.equal(s.last().dirty, false);
  assert.deepEqual(s.dirty, [true, false]);
  const again = createCopywriter({ spaceId: 'sample-home', jobId: s.job.id, stageId: 'brief', service: s.service });
  await again.start();
  assert.deepEqual(again.snapshot().notes, { goal: 'More booked estimates', audience: 'Homeowners in Eugene', callToAction: '', pages: ['Services'], mustHave: '' });
});

test('Meridian\'s summary changes Goal only on Use this; Discard leaves it', async () => {
  const s = await setup();
  s.model.edit('goal', 'Original goal');
  await s.model.askSummary();
  assert.equal(typeof s.last().draft, 'string');
  assert.equal(s.last().notes.goal, 'Original goal');
  s.model.discardDraft();
  assert.equal(s.last().draft, null);
  assert.equal(s.last().notes.goal, 'Original goal');
  await s.model.askSummary();
  const draft = s.last().draft;
  s.model.useDraft();
  assert.equal(s.last().notes.goal, draft);
  assert.equal(s.last().dirty, true);
});

test('read-only once Kickoff is waiting on Jax or done', async () => {
  const s = await setup();
  s.model.edit('goal', 'Book estimates'); s.model.edit('audience', 'Homeowners'); s.model.edit('callToAction', 'Call now');
  s.model.addPage('Home');
  await s.model.save();
  await s.service.completeStage('sample-home', s.job.id, 'brief');
  await s.model.start();
  assert.equal(s.last().phase, 'locked');
  assert.equal(s.last().message, 'This stage is finished.');
  s.model.edit('goal', 'changed');
  assert.equal(s.last().notes.goal, 'Book estimates', 'no edits once locked');
});

test('outside a Job or at another stage it says where to open it', async () => {
  const s = await setup('plan');
  assert.equal(s.last().phase, 'outside');
  assert.equal(s.last().message, OUTSIDE);
  const noJob = createCopywriter({ spaceId: 'sample-home', jobId: '', stageId: 'brief', service: s.service });
  await noJob.start();
  assert.equal(noJob.snapshot().phase, 'outside');
});

test('another save reloads it unless there are unsaved edits; cleanup removes its listener', async () => {
  const listeners = { count: 0 };
  const s = await setup('brief', { listeners });
  assert.equal(listeners.count, 1);
  await s.service.saveStageNotes('sample-home', s.job.id, 'brief', { goal: 'From the other screen', pages: [] });
  await new Promise(r => setImmediate(r));
  assert.equal(s.model.snapshot().notes.goal, 'From the other screen');
  s.model.edit('goal', 'My unsaved text');
  await s.service.saveStageNotes('sample-home', s.job.id, 'brief', { goal: 'Someone else again', pages: [] });
  await new Promise(r => setImmediate(r));
  assert.equal(s.model.snapshot().notes.goal, 'My unsaved text', 'unsaved edits are never overwritten');
  s.model.dispose();
  assert.equal(listeners.count, 0);
});

test('a failed save keeps the edits and says why', async () => {
  const s = await setup('brief', { overrides: { saveStageNotes: async () => { throw new Error('Home base is busy.'); } } });
  s.model.edit('goal', 'Keep me');
  assert.equal(await s.model.save(), false);
  assert.equal(s.last().error, 'Home base is busy.');
  assert.equal(s.last().notes.goal, 'Keep me');
  assert.equal(s.last().dirty, true);
});
