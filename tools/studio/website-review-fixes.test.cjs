'use strict';
// Core: fixing the site during Review: edit, re-check, re-save the files (#219). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService, createServerService } = require('../../src/renderer/studio/studio-service.js');
const { fillStory } = require('./helpers/website-story.cjs');

const ID = 'sample-home';
async function toReview(s = createSampleService()) {
  s.setProjects([{ id: ID, name: 'Sample Home Services' }]);
  const job = await s.startJob(ID, 'website', 'standard');
  await s.completeStage(ID, job.id); await s.approveStage(ID, job.id);
  await fillStory(s, ID, job.id);
  await s.completeStage(ID, job.id); await s.completeStage(ID, job.id);
  await s.completeStage(ID, job.id); await s.approveStage(ID, job.id);
  await s.completeStage(ID, job.id);
  await s.startSite(ID, job.id, { from: 'cards' });
  await s.completeStage(ID, job.id); await s.completeStage(ID, job.id);   // Build, Check -> Review
  return { s, job };
}
const withDescription = (site, description) => { const next = JSON.parse(JSON.stringify(site)); next.pages[0].description = description; return next; };

test('the site can be fixed during Review; a new check problem becomes a comment and answers itself once fixed', async () => {
  const { s, job } = await toReview();
  const site = await s.getSite(ID, job.id);
  await assert.rejects(s.startSite(ID, job.id, { from: 'cards' }), /while Build is open/);
  await assert.rejects(s.finishSite(ID, job.id), /while Build is open/);
  const long = await s.saveSite(ID, job.id, withDescription(site, 'D'.repeat(161)));
  assert.equal(long.ok, true);
  assert.equal(long.files.failed.length, 0);
  assert.ok(long.files.saved.some(n => n.endsWith(' - site.json')));
  let review = await s.getReview(ID, job.id);
  assert.equal(review.open, 1);
  assert.deepEqual([review.comments[0].source, review.comments[0].pageId, review.comments[0].where], ['check', null, 'Home']);
  assert.match(review.comments[0].text, /The automatic check found: The description is 161 characters/);
  await assert.rejects(s.resolveReviewComment(ID, job.id, review.comments[0].id, { kind: 'fixed', note: 'Done' }), /still finds this/);
  await assert.rejects(s.completeStage(ID, job.id), /1 comment needs an answer/);
  await s.saveSite(ID, job.id, withDescription(site, 'Short again.'));
  review = await s.getReview(ID, job.id);
  assert.equal(review.open, 0);
  assert.deepEqual(review.comments[0].resolved && review.comments[0].resolved.kind, 'fixed');
  assert.match(review.comments[0].resolved.note, /passes now/);
  assert.equal((await s.completeStage(ID, job.id)).waitingOnJax, true);
  await assert.rejects(s.saveSite(ID, job.id, site), /Build or Review is open/);
});

test('keeping a check problem answers its flag, so it does not come back on the next save', async () => {
  const { s, job } = await toReview();
  const site = await s.getSite(ID, job.id);
  await s.saveSite(ID, job.id, withDescription(site, 'D'.repeat(161)));
  const [c] = (await s.getReview(ID, job.id)).comments;
  await s.resolveReviewComment(ID, job.id, c.id, { kind: 'keep', note: 'The client wants the long description.' });
  await s.saveSite(ID, job.id, withDescription(site, 'D'.repeat(161)));
  const review = await s.getReview(ID, job.id);
  assert.equal(review.comments.length, 1);
  assert.equal(review.open, 0);
  assert.equal((await s.getChecks(ID, job.id)).log.at(-1).note, 'The client wants the long description.');
});

test('real sign-in: Connect saves the site files on every Review save, and a failed save blocks sending to Jax', async () => {
  const local = createSampleService({ practice: false });
  const { job } = await toReview(local);
  let fail = true;
  const written = [];
  const folder = new Map();   // the project folder: Studio's save file sticks, a failing disk refuses the site files
  const server = createServerService({ local, request: async () => ({ success: true, data: [] }),
    readSave: async (spaceId, name) => (folder.has(name) ? { success: true, content: folder.get(name) } : { success: false, missing: true }),
    saveFile: async (spaceId, name, content) => {
      written.push(name);
      if (fail && !name.endsWith('Studio save.json')) return { success: false, error: 'Disk full' };
      folder.set(name, content); return { success: true };
    } });
  const site = await server.getSite(ID, job.id);
  const first = await server.saveSite(ID, job.id, site);
  assert.equal(first.files.failed.length > 0, true);
  assert.deepEqual(await local.listProjectFiles(ID), [], 'the practice copy saves nothing in real sign-in');
  await assert.rejects(server.completeStage(ID, job.id), /out of date: save the site again/);
  fail = false;
  const second = await server.saveSite(ID, job.id, site);
  assert.deepEqual(second.files.failed, []);
  assert.ok(written.some(n => n.endsWith(' - Site - home.html')));
  assert.equal((await server.completeStage(ID, job.id)).waitingOnJax, true);
});
