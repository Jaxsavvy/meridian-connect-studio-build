'use strict';
// Core: sample data for workflows, jobs, Review and versions (Wave 2 prep).
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');

function service() {
  const s = createSampleService();
  s.setProjects([{ id: 'client-a', name: 'Client A' }, { id: 'client-b', name: 'Client B' }]);
  return s;
}

test('website workflow: tiers and stages; Motion only in Cinematic; unknown workflow is null', async () => {
  const s = service();
  const wf = await s.getWorkflow('website');
  assert.deepEqual(wf.tiers.map(t => t.id), ['standard', 'cinematic']);
  assert.deepEqual(wf.stages.map(st => st.id), ['brief', 'plan', 'storyboard', 'look', 'motion', 'build', 'check', 'review', 'launch']);
  assert.equal(await s.getWorkflow('seo'), null);
  const std = await s.startJob('client-a', 'website', 'standard');
  const cin = await s.startJob('client-a', 'website', 'cinematic');
  assert.ok(!std.stages.some(st => st.id === 'motion'));
  assert.ok(cin.stages.some(st => st.id === 'motion'));
  assert.equal(std.name, 'Website v1'); assert.equal(cin.name, 'Website v2');
  await assert.rejects(s.startJob('client-a', 'website', 'deluxe'), /Standard or Cinematic/);
  await assert.rejects(s.startJob('client-a', 'seo', 'standard'), /coming soon/);
});

test('stages Jax approves wait on him; team stages advance; Space home shows progress', async () => {
  const s = service();
  const job = await s.startJob('client-a', 'website', 'standard');
  assert.equal(job.stageId, 'brief');
  let next = await s.completeStage('client-a', job.id);          // Brief is approved by Jax
  assert.equal(next.stageId, 'brief'); assert.equal(next.waitingOnJax, true);
  assert.equal(next.stages[0].status, 'waiting-on-jax');
  next = await s.approveStage('client-a', job.id);
  assert.equal(next.stageId, 'plan'); assert.equal(next.stages[0].status, 'done');
  next = await s.completeStage('client-a', job.id);              // Plan is a team stage
  assert.equal(next.stageId, 'storyboard');
  const space = await s.getSpace('client-a');
  assert.equal(space.jobs[0].stage, 'Storyboard');
  assert.ok(space.jobs[0].progress > 0);
  await assert.rejects(s.approveStage('client-a', job.id), /not waiting on Jax/);
});

test('jobs never cross Spaces', async () => {
  const s = service();
  const job = await s.startJob('client-a', 'website', 'standard');
  await assert.rejects(s.getJob('client-b', job.id), /not found/);
  await assert.rejects(s.completeStage('client-b', job.id), /not found/);
  const b = await s.getSpace('client-b');
  assert.equal(b.jobs[0].name, 'Website v1'); assert.equal(b.jobs[0].stage, 'Not started'); // placeholder only
});

test('Send to Review: waits on Jax, no double send, approval locks it', async () => {
  const s = service();
  const out = await s.generateImage({ spaceId: 'client-a', presetId: 'website-hero', description: 'Stage', count: 1 });
  const id = out.results[0].assetId;
  const sent = await s.sendToReview('client-a', id, 'Hero option');
  assert.equal(sent.review.status, 'waiting'); assert.equal(sent.kept, true);
  await assert.rejects(s.sendToReview('client-a', id), /Already waiting/);
  assert.equal((await s.listReview('client-a')).length, 1);
  assert.equal((await s.listReview('client-b')).length, 0);
  const approved = await s.approveAsset('client-a', id);
  assert.equal(approved.approved, true);
  await assert.rejects(s.trashAsset('client-a', id), /only be removed by Jax/);
});

test('versions: originals never change; history is per family and per Space', async () => {
  const s = service();
  const out = await s.generateImage({ spaceId: 'client-a', presetId: 'website-hero', description: 'Stage', count: 1 });
  const v1 = out.results[0].assetId;
  const v2 = await s.saveVersion('client-a', v1, { url: 'data:image/png;base64,AA' });
  const v3 = await s.saveVersion('client-a', v2.id);
  assert.equal(v2.version, 2); assert.equal(v2.parentId, v1); assert.match(v2.name, /__v2$/);
  assert.equal(v3.version, 3); assert.equal(v3.parentId, v2.id);
  const history = await s.listVersions('client-a', v3.id);
  assert.deepEqual(history.map(a => a.version), [1, 2, 3]);
  assert.notEqual(history[0].url, 'data:image/png;base64,AA');   // original untouched
  await assert.rejects(s.listVersions('client-b', v1), /not found/);
});

test('images made inside a Job are tagged and listed per stage; other Jobs and Spaces never mix', async () => {
  const s = service();
  const job = await s.startJob('client-a', 'website', 'standard');
  const other = await s.startJob('client-a', 'website', 'cinematic');
  await s.generateImage({ spaceId: 'client-a', presetId: 'website-hero', description: 'Stage', count: 2, jobId: job.id, stageId: 'look' });
  await s.generateImage({ spaceId: 'client-a', presetId: 'website-hero', description: 'Loose', count: 1 });
  const byStage = await s.listJobAssets('client-a', job.id);
  assert.equal(byStage.look.length, 2); assert.equal(byStage.brief.length, 0);
  assert.equal(Object.values(await s.listJobAssets('client-a', other.id)).flat().length, 0);
  await assert.rejects(s.generateImage({ spaceId: 'client-b', presetId: 'website-hero', description: 'x', jobId: job.id }), /not found/);
  assert.equal((await s.listJobs('client-a')).length, 2);
  assert.equal((await s.listJobs('client-b')).length, 0);
});

test('sample-mode stand-in Jax approves waiting stages and Review items after a delay; off by default', async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const off = service();
  const j0 = await off.startJob('client-a', 'website', 'standard');
  await off.completeStage('client-a', j0.id); await wait(30);
  assert.equal((await off.getJob('client-a', j0.id)).waitingOnJax, true);          // tests: never auto-approved

  const s = createSampleService({ simulateJaxMs: 10 });
  s.setProjects([{ id: 'client-a', name: 'Client A' }]);
  const job = await s.startJob('client-a', 'website', 'standard');
  assert.equal((await s.completeStage('client-a', job.id)).waitingOnJax, true);
  await wait(40);
  assert.equal((await s.getJob('client-a', job.id)).stageId, 'plan');
  const out = await s.generateImage({ spaceId: 'client-a', presetId: 'website-hero', description: 'x', count: 1 });
  await s.sendToReview('client-a', out.results[0].assetId);
  await wait(40);
  assert.equal((await s.listAssets('client-a'))[0].approved, true);
});

test('Move to client: sandbox work copies into a client as a new original; never client to client', async () => {
  const s = service();
  const out = await s.generateImage({ spaceId: 'sandbox-me', presetId: 'website-hero', description: 'Idea', count: 1 });
  const id = out.results[0].assetId;
  const copy = await s.copyToSpace('sandbox-me', id, 'client-a');
  assert.equal(copy.spaceId, 'client-a'); assert.equal(copy.version, 1); assert.equal(copy.parentId, null);
  assert.equal(copy.kept, true); assert.deepEqual(copy.copiedFrom, { spaceId: 'sandbox-me', assetId: id });
  assert.equal((await s.listAssets('sandbox-me')).length, 1);                 // sandbox copy stays
  await assert.rejects(s.copyToSpace('client-a', copy.id, 'client-b'), /Only sandbox work/);
  await assert.rejects(s.copyToSpace('sandbox-me', id, 'sandbox-me'), /different Space/);
  await assert.rejects(s.copyToSpace('sandbox-me', id, 'nope'), /not found/);
});
