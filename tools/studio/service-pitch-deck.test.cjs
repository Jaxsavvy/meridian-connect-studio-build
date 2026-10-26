'use strict';
// Core: Pitch deck workflow, locked starter for new prospects, assignable stages (#113).
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService, createServerService } = require('../../src/renderer/studio/studio-service.js');

const STAGES = ['research', 'fill', 'home-t1', 'home-t2', 'home-t3', 'assemble', 'check', 'review', 'publish', 'print'];
const prospect = (s, extra = {}) => s.createProspect({ company: 'Riverdale Home Services', town: 'Eugene', ...extra });

test('pitch deck workflow: ten stages, three home-page builds, Review and Publish wait on Jax', async () => {
  const wf = await createSampleService().getWorkflow('pitch-deck');
  assert.deepEqual(wf.stages.map(st => st.id), STAGES);
  assert.deepEqual(wf.stages.filter(st => st.approver === 'jax').map(st => st.id), ['review', 'publish']);
  assert.ok(wf.stages.filter(st => st.id.startsWith('home-')).every(st => st.tools.includes('homepage-builder')));
  const tools = await createSampleService().listTools();
  assert.ok(['deck-builder', 'homepage-builder'].every(id => tools.some(t => t.id === id)));
});

test('New prospect creates a client Space with a locked Pitch deck Job on stage 1', async () => {
  const s = createSampleService();
  const events = [];
  s.on(e => events.push(e));
  const { space, job } = await prospect(s, { website: 'https://riverdale.example', googleProfile: 'https://maps.google.com/?cid=1' });
  assert.equal(space.type, 'client'); assert.equal(space.name, 'Riverdale Home Services'); assert.equal(space.town, 'Eugene');
  assert.equal(job.workflowId, 'pitch-deck'); assert.equal(job.stageId, 'research');
  assert.equal(job.locked, true); assert.equal(job.template, 'pitch-deck-starter');
  assert.deepEqual(job.stages.map(st => st.id), STAGES);
  assert.ok(events.includes('spaces-changed') && events.includes('jobs-changed'));
  assert.ok((await s.listSpaces()).some(x => x.id === space.id));
  const home = await s.getSpace(space.id);
  assert.equal(home.jobs[0].workflowId, 'pitch-deck');
  s.setProjects([{ id: 'client-a', name: 'Client A' }]);          // a project refresh keeps prospects
  assert.ok((await s.listSpaces()).some(x => x.id === space.id));
});

test('prospect input is checked; duplicates and bad links are refused', async () => {
  const s = createSampleService();
  await assert.rejects(s.createProspect({ town: 'Eugene' }), /Company name is required/);
  await assert.rejects(s.createProspect({ company: 'Acme' }), /Town is required/);
  await assert.rejects(s.createProspect(null), /Company name is required/);
  await assert.rejects(s.createProspect({ company: 'x'.repeat(121), town: 'Eugene' }), /too long/);
  await assert.rejects(prospect(s, { website: 'javascript:alert(1)' }), /http/);
  await assert.rejects(prospect(s, { website: 'not a link' }), /web link/);
  await prospect(s);
  await assert.rejects(prospect(s, { company: 'riverdale home services', town: 'EUGENE' }), /already exists/);
});

test('pitch decks only start from New prospect, and their stages cannot change', async () => {
  const s = createSampleService();
  s.setProjects([{ id: 'client-a', name: 'Client A' }]);
  await assert.rejects(s.startJob('client-a', 'pitch-deck', 'deck'), /New prospect/);
  const { space, job } = await prospect(s);
  const again = await s.getJob(space.id, job.id);
  again.stages.reverse();                                             // a caller's copy can't touch the Job
  assert.deepEqual((await s.getJob(space.id, job.id)).stages.map(st => st.id), STAGES);
});

test('stages are assignable; Jax stages stay with Jax; finished stages lock', async () => {
  const s = createSampleService();
  const { space, job } = await prospect(s);
  assert.deepEqual((await s.listPeople()).map(p => p.id), ['jax', 'tyler', 'cassy']);
  let view = await s.assignStage(space.id, job.id, 'home-t2', 'tyler');
  assert.equal(view.stages.find(st => st.id === 'home-t2').assignee, 'tyler');
  assert.equal(view.stages.find(st => st.id === 'research').assignee, null);
  assert.equal(view.stages.find(st => st.id === 'review').assignee, 'jax');
  view = await s.assignStage(space.id, job.id, 'home-t2', null);
  assert.equal(view.stages.find(st => st.id === 'home-t2').assignee, null);
  await assert.rejects(s.assignStage(space.id, job.id, 'review', 'tyler'), /stays with him/);
  await assert.rejects(s.assignStage(space.id, job.id, 'research', 'stranger'), /someone on the team/);
  await assert.rejects(s.assignStage(space.id, job.id, 'launch', 'tyler'), /Unknown stage/);
  await s.completeStage(space.id, job.id);                          // Research done
  await assert.rejects(s.assignStage(space.id, job.id, 'research', 'cassy'), /finished/);
});

test('walk the whole deck: team stages advance, Review and Publish wait on Jax', async () => {
  const s = createSampleService();
  const { space, job } = await prospect(s);
  let view;
  for (const id of ['research', 'fill', 'home-t1', 'home-t2', 'home-t3', 'assemble', 'check']) {
    view = await s.completeStage(space.id, job.id);
    assert.ok(view.stages.find(st => st.id === id).status === 'done');
  }
  view = await s.completeStage(space.id, job.id);
  assert.equal(view.stageId, 'review'); assert.equal(view.waitingOnJax, true);
  view = await s.approveStage(space.id, job.id);
  view = await s.completeStage(space.id, job.id);
  assert.equal(view.stageId, 'publish'); assert.equal(view.waitingOnJax, true);
  view = await s.approveStage(space.id, job.id);
  view = await s.completeStage(space.id, job.id);
  assert.equal(view.finished, true);
});

test('no money anywhere in a prospect Space or Job', async () => {
  const s = createSampleService();
  const { space, job } = await prospect(s);
  const dump = JSON.stringify([await s.getSpace(space.id), await s.getJob(space.id, job.id)]).toLowerCase();
  for (const word of ['price', 'cost', 'budget', 'revenue', 'deal', '$']) assert.ok(!dump.includes(word), word);
});

test('server mode says New prospect needs the server, and keeps assignment local', async () => {
  const s = createServerService({ request: async () => ({ success: false, error: 'offline' }) });
  await assert.rejects(s.createProspect({ company: 'Acme', town: 'Eugene' }), /Coming soon with the real server/);
  assert.deepEqual((await s.listPeople()).map(p => p.id), ['jax', 'tyler', 'cassy']);
});
