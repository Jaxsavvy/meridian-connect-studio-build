'use strict';
// Core: Pitch deck workflow started inside a client project, locked, with assignable stages (#113).
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService, createServerService } = require('../../src/renderer/studio/studio-service.js');

const STAGES = ['research', 'home-t1', 'home-t2', 'home-t3', 'assemble', 'check', 'review', 'publish', 'print'];
function service() {
  const s = createSampleService();
  s.setProjects([{ id: 'riverdale', name: 'Riverdale Home Services' }, { id: 'client-b', name: 'Client B' }]);
  return s;
}
const start = (s, options) => s.startJob('riverdale', 'pitch-deck', 'deck', options);

test('pitch deck workflow: nine stages, three home-page builds, Review and Publish wait on Jax', async () => {
  const s = service();
  const wf = await s.getWorkflow('pitch-deck');
  assert.deepEqual(wf.stages.map(st => st.id), STAGES);
  assert.deepEqual(wf.tiers.map(t => t.id), ['deck']);
  assert.deepEqual(wf.stages.filter(st => st.approver === 'jax').map(st => st.id), ['review', 'publish']);
  assert.ok(wf.stages.filter(st => st.id.startsWith('home-')).every(st => st.tools.includes('homepage-builder')));
  const tools = await s.listTools();
  assert.equal(tools.find(t => t.id === 'pitch-deck').state, 'available');
  assert.ok(['deck-builder', 'homepage-builder'].every(id => tools.some(t => t.id === id)));
});

test('Start pitch deck inside a project: locked Job on stage 1 with the builders picked', async () => {
  const s = service();
  const job = await start(s, { assignees: { research: 'jax', 'home-t1': 'tyler', 'home-t2': 'tyler', 'home-t3': 'jax' } });
  assert.equal(job.workflowId, 'pitch-deck'); assert.equal(job.stageId, 'research');
  assert.equal(job.locked, true); assert.equal(job.template, 'pitch-deck-starter');
  assert.deepEqual(job.stages.map(st => st.id), STAGES);
  const who = Object.fromEntries(job.stages.map(st => [st.id, st.assignee]));
  assert.equal(who.research, 'jax'); assert.equal(who['home-t2'], 'tyler'); assert.equal(who['home-t3'], 'jax');
  assert.equal(who.assemble, null); assert.equal(who.review, 'jax'); assert.equal(who.publish, 'jax');
  assert.equal((await s.getSpace('riverdale')).jobs[0].workflowId, 'pitch-deck');
  assert.equal((await s.startJob('client-b', 'website', 'standard')).locked, false);   // Website stays unlocked
});

test('pitch decks only run in client projects, one at a time, with valid builders', async () => {
  const s = service();
  await assert.rejects(s.startJob('sandbox-me', 'pitch-deck', 'deck'), /client project/);
  await assert.rejects(s.startJob('riverdale', 'pitch-deck', 'standard'), /Pick a tier/);
  await assert.rejects(start(s, { assignees: { review: 'tyler' } }), /stays with him/);
  await assert.rejects(start(s, { assignees: { research: 'stranger' } }), /someone on the team/);
  await assert.rejects(start(s, { assignees: { launch: 'tyler' } }), /Unknown stage/);
  await assert.rejects(start(s, { assignees: ['tyler'] }), /must be an object/);
  await start(s);
  await assert.rejects(start(s), /already has a pitch deck in progress/);
  await s.startJob('client-b', 'pitch-deck', 'deck');                                    // other projects are fine
});

test('the Job is locked: a caller\'s copy can\'t change its stages', async () => {
  const s = service();
  const job = await start(s);
  const copy = await s.getJob('riverdale', job.id);
  copy.stages.reverse();
  assert.deepEqual((await s.getJob('riverdale', job.id)).stages.map(st => st.id), STAGES);
});

test('builders can be changed later; Jax stages stay with Jax; finished stages lock', async () => {
  const s = service();
  const job = await start(s);
  assert.deepEqual((await s.listPeople('pitch-deck')).map(p => p.id), ['jax', 'tyler']);
  assert.deepEqual((await s.listPeople()).map(p => p.id), ['jax', 'tyler', 'cassy']);
  await assert.rejects(s.assignStage('riverdale', job.id, 'assemble', 'cassy'), /someone on the team/);   // Jax and Tyler only
  let view = await s.assignStage('riverdale', job.id, 'home-t2', 'tyler');
  assert.equal(view.stages.find(st => st.id === 'home-t2').assignee, 'tyler');
  view = await s.assignStage('riverdale', job.id, 'home-t2', null);
  assert.equal(view.stages.find(st => st.id === 'home-t2').assignee, null);
  await assert.rejects(s.assignStage('riverdale', job.id, 'review', 'tyler'), /stays with him/);
  await assert.rejects(s.assignStage('riverdale', job.id, 'research', 'stranger'), /someone on the team/);
  await s.useSampleResearch('riverdale', job.id);                                       // practice deck passes the check (#119)
  await s.completeStage('riverdale', job.id);                                           // Research done
  await assert.rejects(s.assignStage('riverdale', job.id, 'research', 'tyler'), /finished/);
});

test('walk the whole deck: team stages advance, Review and Publish wait on Jax, then a new deck can start', async () => {
  const s = service();
  const job = await start(s);
  await s.useSampleResearch('riverdale', job.id);
  let view;
  for (const id of ['research', 'home-t1', 'home-t2', 'home-t3', 'assemble', 'check']) {
    view = await s.completeStage('riverdale', job.id, id);
    assert.equal(view.stages.find(st => st.id === id).status, 'done');
  }
  view = await s.completeStage('riverdale', job.id);
  assert.equal(view.stageId, 'review'); assert.equal(view.waitingOnJax, true);
  await s.approveStage('riverdale', job.id);
  view = await s.completeStage('riverdale', job.id);
  assert.equal(view.stageId, 'publish'); assert.equal(view.waitingOnJax, true);
  await s.approveStage('riverdale', job.id);
  view = await s.completeStage('riverdale', job.id);
  assert.equal(view.finished, true);
  assert.equal((await start(s)).name, 'Pitch deck v2');
});

test('no money anywhere in a pitch deck Job', async () => {
  const s = service();
  const job = await start(s);
  const dump = JSON.stringify(await s.getJob('riverdale', job.id)).toLowerCase();
  for (const word of ['price', 'cost', 'budget', 'revenue', 'deal', '$']) assert.ok(!dump.includes(word), word);
});

test('server mode keeps people and assignment on the local Jobs for now', async () => {
  const s = createServerService({ request: async () => ({ success: false, error: 'offline' }) });
  assert.deepEqual((await s.listPeople()).map(p => p.id), ['jax', 'tyler', 'cassy']);
  assert.equal(typeof s.assignStage, 'function');
});

test('the three home pages are built side by side; Assemble opens when all three are done', async () => {
  const s = service();
  const job = await start(s);
  await s.useSampleResearch('riverdale', job.id);
  let view = await s.completeStage('riverdale', job.id);                                // Research + write
  assert.deepEqual(view.openStageIds, ['home-t1', 'home-t2', 'home-t3']);
  assert.deepEqual(view.stages.filter(st => st.status === 'current').map(st => st.id), ['home-t1', 'home-t2', 'home-t3']);
  await assert.rejects(s.completeStage('riverdale', job.id, 'assemble'), /isn't open yet/);
  view = await s.setStageNeed('riverdale', job.id, 0, true, 'home-t3');                 // tick on a non-first open stage
  assert.deepEqual(view.stages.find(st => st.id === 'home-t3').needsDone, [true, false, false]);
  view = await s.completeStage('riverdale', job.id, 'home-t3');
  view = await s.completeStage('riverdale', job.id, 'home-t1');
  assert.deepEqual(view.openStageIds, ['home-t2']);
  assert.equal((await s.getSpace('riverdale')).jobs[0].stage, 'Home pages (2 of 3 done)');
  await assert.rejects(s.completeStage('riverdale', job.id, 'home-t1'), /isn't open yet/);   // already done
  view = await s.completeStage('riverdale', job.id, 'home-t2');
  assert.deepEqual(view.openStageIds, ['assemble']);
});

test('a Job keeps the stages it started with (template version)', async () => {
  const s = service();
  const job = await start(s);
  assert.equal(job.templateVersion, 1);
  const wf = await s.getWorkflow('pitch-deck');
  wf.stages.length = 0;                                                                  // callers get copies
  assert.deepEqual((await s.getJob('riverdale', job.id)).stages.map(st => st.id), STAGES);
});

test('Research + write is one stage; Check is automatic; home pages need the "Concept for discussion" line', async () => {
  const wf = await service().getWorkflow('pitch-deck');
  const research = wf.stages.find(st => st.id === 'research');
  assert.equal(research.name, 'Research + write');
  assert.ok(research.tools.includes('research') && research.tools.includes('deck-builder'));
  assert.ok(!wf.stages.some(st => st.id === 'fill'));
  const check = wf.stages.find(st => st.id === 'check');
  assert.equal(check.automatic, true);
  assert.deepEqual(check.needs, ['Deck checker', 'Evidence guard', 'Phone screenshot', 'Link check', 'Internal-words scan']);
  assert.ok(wf.stages.filter(st => st.group === 'home').every(st => st.needs.includes('"Concept for discussion" line')));
});

test('every stage records when it opened and finished', async () => {
  let t = Date.parse('2026-10-27T16:00:00Z');
  const s = createSampleService({ now: () => t });
  s.setProjects([{ id: 'riverdale', name: 'Riverdale Home Services' }]);
  const job = await s.startJob('riverdale', 'pitch-deck', 'deck');
  assert.equal(job.stages[0].timing.openedAt, '2026-10-27T16:00:00.000Z');
  assert.equal(job.stages[1].timing, null);                                      // not open yet
  t += 25 * 60000;
  await s.useSampleResearch('riverdale', job.id);
  let view = await s.completeStage('riverdale', job.id);                         // Research + write took 25 min
  assert.equal(view.stages[0].timing.minutes, 25);
  assert.ok(['home-t1', 'home-t2', 'home-t3'].every(id => view.stages.find(st => st.id === id).timing.openedAt === '2026-10-27T16:25:00.000Z'));
  t += 40 * 60000;
  view = await s.completeStage('riverdale', job.id, 'home-t2');
  assert.equal(view.stages.find(st => st.id === 'home-t2').timing.minutes, 40);
  assert.equal(view.stages.find(st => st.id === 'home-t1').timing.minutes, null); // still open
});
