'use strict';
// Core: stage notes (Brief, Plan, Storyboard), the "This stage needs" checklist and draftCopy (Wave 2 prep).
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');

async function setup() {
  const s = createSampleService();
  s.setProjects([{ id: 'client-a', name: 'Client A' }, { id: 'client-b', name: 'Client B' }]);
  const job = await s.startJob('client-a', 'website', 'standard');
  return { s, job };
}

test('Copywriter and Storyboard are available tools', async () => {
  const tools = await createSampleService().listTools();
  for (const id of ['copywriter', 'storyboard']) assert.equal(tools.find(t => t.id === id).state, 'available');
});

test('brief notes start empty, save cleaned text, and emit stage-notes-changed', async () => {
  const { s, job } = await setup();
  assert.deepEqual(await s.getStageNotes('client-a', job.id, 'brief'), { goal: '', audience: '', callToAction: '', pages: [], mustHave: '' });
  const events = []; s.on((event, detail) => events.push([event, detail]));
  const saved = await s.saveStageNotes('client-a', job.id, 'brief',
    { goal: '  More estimate calls ', audience: 'Local homeowners', callToAction: 'Call for an estimate', pages: ['Home', '', 'Services'], extra: 'dropped' });
  assert.deepEqual(saved, { goal: 'More estimate calls', audience: 'Local homeowners', callToAction: 'Call for an estimate', pages: ['Home', 'Services'], mustHave: '' });
  assert.deepEqual(await s.getStageNotes('client-a', job.id, 'brief'), saved);
  assert.deepEqual(events.at(-1), ['stage-notes-changed', { spaceId: 'client-a', jobId: job.id, stageId: 'brief' }]);
  assert.equal((await s.getJob('client-a', job.id)).stages.find(st => st.id === 'brief').hasNotes, true);
});

test('plan pages keep sections in order; unknown section kinds become other; limits are enforced', async () => {
  const { s, job } = await setup();
  const plan = await s.saveStageNotes('client-a', job.id, 'plan', { pages: [{ name: 'Home', purpose: 'Get calls',
    sections: [{ kind: 'hero', heading: 'Roofs done right', copy: 'Copy' }, { kind: 'banner', heading: 'Odd' }] }] });
  assert.deepEqual(plan.pages[0].sections.map(sec => sec.kind), ['hero', 'other']);
  await assert.rejects(s.saveStageNotes('client-a', job.id, 'plan', { pages: Array.from({ length: 21 }, () => ({})) }), /at most 20/);
  await assert.rejects(s.saveStageNotes('client-a', job.id, 'plan', { pages: [{ name: 'x'.repeat(81) }] }), /too long/);
  await assert.rejects(s.saveStageNotes('client-a', job.id, 'plan', { pages: [{ name: 5 }] }), /must be text/);
  await assert.rejects(s.saveStageNotes('client-a', job.id, 'plan', ['nope']), /must be an object/);
});

test('storyboard frames may only point at this Space\'s assets', async () => {
  const { s, job } = await setup();
  const own = (await s.generateImage({ spaceId: 'client-a', description: 'Synthetic hero', count: 1 })).results[0].assetId;
  const other = (await s.generateImage({ spaceId: 'client-b', description: 'Synthetic hero', count: 1 })).results[0].assetId;
  const saved = await s.saveStageNotes('client-a', job.id, 'storyboard', { frames: [{ page: 'Home', section: 0, sketch: 'Big photo, call button', assetId: own }, { page: 'Home', section: 99 }] });
  assert.deepEqual(saved.frames.map(f => [f.section, f.assetId]), [[0, own], [0, null]]);
  await assert.rejects(s.saveStageNotes('client-a', job.id, 'storyboard', { frames: [{ page: 'Home', assetId: other }] }), /not in this Space/);
});

test('notes are scoped to the Job and Space, and lock once the stage is finished or waiting on Jax', async () => {
  const { s, job } = await setup();
  await assert.rejects(s.getStageNotes('client-b', job.id, 'brief'), /Job not found/);
  await assert.rejects(s.getStageNotes('client-a', job.id, 'look'), /no notes/);
  await s.saveStageNotes('client-a', job.id, 'brief', { goal: 'Calls' });
  await s.completeStage('client-a', job.id); // Brief waits on Jax
  await assert.rejects(s.saveStageNotes('client-a', job.id, 'brief', { goal: 'Changed' }), /locked/);
  await s.approveStage('client-a', job.id);
  await assert.rejects(s.saveStageNotes('client-a', job.id, 'brief', { goal: 'Changed' }), /locked/);
  assert.equal((await s.getStageNotes('client-a', job.id, 'brief')).goal, 'Calls');
  const copy = await s.getStageNotes('client-a', job.id, 'brief'); copy.goal = 'mutated';
  assert.equal((await s.getStageNotes('client-a', job.id, 'brief')).goal, 'Calls');
});

test('the stage checklist saves ticks for the current stage only', async () => {
  const { s, job } = await setup();
  assert.deepEqual(job.stages[0].needsDone, [false, false, false, false]);
  const updated = await s.setStageNeed('client-a', job.id, 1, true);
  assert.deepEqual(updated.stages[0].needsDone, [false, true, false, false]);
  assert.deepEqual((await s.getJob('client-a', job.id)).stages[0].needsDone, [false, true, false, false]);
  await assert.rejects(s.setStageNeed('client-a', job.id, 4, true), /Unknown checklist item/);
  await assert.rejects(s.setStageNeed('client-a', job.id, '1', true), /Unknown checklist item/);
  await s.completeStage('client-a', job.id);
  await assert.rejects(s.setStageNeed('client-a', job.id, 0, true), /can no longer be changed/);
});

test('draftCopy proposes text without saving or mentioning money', async () => {
  const { s, job } = await setup();
  const result = await s.draftCopy({ spaceId: 'client-a', jobId: job.id, kind: 'section', input: { heading: 'Roof repair' } });
  assert.match(result.draft, /Roof repair/);
  assert.doesNotMatch(JSON.stringify(result), /\$|cost|price/i);
  assert.equal(result.settingsUsed.useBrandDna, true);
  assert.equal((await s.getJob('client-a', job.id)).stages.some(st => st.hasNotes), false);
  await assert.rejects(s.draftCopy({ spaceId: 'nowhere', kind: 'section' }), /Space not found/);
});
