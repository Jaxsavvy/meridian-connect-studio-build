'use strict';
// Core: real-mode pitch deck Jobs are kept in the project's folder, so they survive a restart and two people can share one (#171).
const test = require('node:test');
const assert = require('node:assert/strict');
const { createServerService } = require('../../src/renderer/studio/studio-service.js');

const FILE = 'Pitch deck - Studio save.json';
const projects = [{ id: 'sample-home', name: 'Sample Home Services' }];
const SRC = { label: 'Checked by hand', url: 'https://example.com/source' };
const fact = (field, value) => ({ kind: 'census', subject: 'market', field, value, source: SRC });
// A stand-in for the project's Docs folder in Team Hub.
function folder() {
  const files = new Map(), f = { files, writes: 0, failNext: false };
  f.saveFile = async (projectId, name, content) => {
    if (f.failNext) { f.failNext = false; return { success: false, error: 'offline' }; }
    f.writes += 1; files.set(`${projectId}/${name}`, content); return { success: true };
  };
  f.readSave = async projectId => (files.has(`${projectId}/${FILE}`) ? { success: true, content: files.get(`${projectId}/${FILE}`) } : { success: false, missing: true });
  f.saved = () => JSON.parse(files.get(`sample-home/${FILE}`));
  return f;
}
const open = f => { const s = createServerService({ request: async () => ({ success: true, data: [] }), saveFile: f.saveFile, readSave: f.readSave }); s.setProjects(projects); return s; };

test('a pitch deck survives closing the app: Job, builders, research and deck come back from the project folder', async () => {
  const f = folder(), jax = open(f);
  const job = await jax.startJob('sample-home', 'pitch-deck', 'deck', { assignees: { research: 'jax', 'home-t1': 'tyler' } });
  await jax.addEvidence('sample-home', job.id, fact('population', 52300));
  const blank = await jax.getDeck('sample-home', job.id);
  await jax.saveDeck('sample-home', job.id, { ...blank, bottomLine: { ...blank.bottomLine, headline: 'Customers are looking' } });
  assert.equal(f.saved().revision, 3); assert.equal(f.saved().jobs.length, 1);
  const again = open(f);                                                          // the app restarted
  assert.deepEqual((await again.listJobs('sample-home')).map(j => j.id), [job.id]);
  const back = await again.getJob('sample-home', job.id);
  assert.equal(back.stages.find(st => st.id === 'home-t1').assignee, 'tyler');
  assert.deepEqual((await again.getResearch('sample-home', job.id)).evidence.map(e => e.value), [52300]);
  assert.equal((await again.getDeck('sample-home', job.id)).bottomLine.headline, 'Customers are looking');
  const next = await again.startJob('client-x', 'pitch-deck', 'deck').catch(e => e);   // unknown project: refused, nothing written
  assert.ok(next instanceof Error); assert.equal(f.saved().revision, 3);
  await assert.rejects(again.startJob('sample-home', 'pitch-deck', 'deck'), /already has a pitch deck in progress/);
});

test('two people on one deck: a save never silently replaces the other person\'s', async () => {
  const f = folder(), jax = open(f);
  const job = await jax.startJob('sample-home', 'pitch-deck', 'deck');
  const tyler = open(f); await tyler.listJobs('sample-home');                    // both have revision 1
  await jax.addEvidence('sample-home', job.id, fact('population', 52300));         // revision 2
  await assert.rejects(tyler.addEvidence('sample-home', job.id, fact('households', 19800)), /Someone else saved this deck/);
  assert.deepEqual((await tyler.getResearch('sample-home', job.id)).evidence.map(e => e.field), ['population']);   // he has Jax's now
  await tyler.addEvidence('sample-home', job.id, fact('households', 19800));       // revision 3, both facts
  assert.deepEqual((await jax.listJobs('sample-home')).length, 1);                  // listing picks up Tyler's save
  assert.deepEqual((await jax.getResearch('sample-home', job.id)).evidence.map(e => e.field), ['population', 'households']);
  assert.equal(f.saved().revision, 3);
});

test('a failed save is kept and goes out with the next change; a broken file is never overwritten', async () => {
  const f = folder(), jax = open(f);
  const job = await jax.startJob('sample-home', 'pitch-deck', 'deck');
  f.failNext = true;
  await assert.rejects(jax.addEvidence('sample-home', job.id, fact('population', 52300)), /kept on this computer/);
  await jax.addEvidence('sample-home', job.id, fact('households', 19800));
  assert.deepEqual(f.saved().jobs[0].evidence.map(e => e.field), ['population', 'households']);
  const g = folder(); g.files.set(`sample-home/${FILE}`, 'not json');
  const broken = open(g);
  await assert.rejects(broken.listJobs('sample-home'), /can't be read/);
  await assert.rejects(broken.startJob('sample-home', 'pitch-deck', 'deck'), /can't be read/);
  assert.equal(g.writes, 0); assert.equal(g.files.get(`sample-home/${FILE}`), 'not json');
});

test('nothing in the save file is trusted as-is; sandboxes never touch a project folder', async () => {
  const f = folder(), jax = open(f);
  const job = await jax.startJob('sample-home', 'pitch-deck', 'deck');
  const data = f.saved(), j = data.jobs[0];
  j.assignees = { research: 'stranger', review: ['tyler', 'stranger', 'tyler'], 'home-t2': 'nobody' };   // off the team dropped; old one-id saves read
  j.evidence = [{ id: 'fact-90', kind: 'google', subject: 'client', field: 'rating', value: 4.9, placeId: 'ChIJtestClient0001',
    method: 'person', source: SRC, fetchedAt: '2026-10-27T00:00:00Z' }];        // a stored Google rating is refused
  j.deck = { ...(await jax.getDeck('sample-home', job.id)), pricing: 1500 };        // internal fields are dropped
  j.done = ['research', 'nope']; j.stageId = 'publish';
  data.jobs.push({ id: 'job-77', workflowId: 'website', tier: 'standard' });         // not a pitch deck: left out
  data.revision = 9; f.files.set(`sample-home/${FILE}`, JSON.stringify(data));
  const again = open(f);
  const back = await again.getJob('sample-home', job.id);
  assert.deepEqual((await again.listJobs('sample-home')).map(x => x.id), [job.id]);
  assert.equal(back.stages.find(st => st.id === 'research').assignee, null);
  assert.deepEqual(back.stages.find(st => st.id === 'review').assignees, ['tyler']);   // ASSIGN-MANY: Jax's stages can be handed off
  assert.deepEqual(back.stages.find(st => st.id === 'home-t2').assignees, []);
  assert.equal(back.stageId, 'home-t1');                                              // from what's done, not from the file
  assert.deepEqual((await again.getResearch('sample-home', job.id)).evidence, []);
  assert.equal('pricing' in (await again.getDeck('sample-home', job.id)), false);
  const writes = f.writes;
  await again.startJob('sandbox-team', 'website', 'standard');
  assert.equal(f.writes, writes);
});
