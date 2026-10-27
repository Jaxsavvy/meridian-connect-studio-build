'use strict';
// Core: Website Review stage, team comments on the site (#216). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService, createServerService } = require('../../src/renderer/studio/studio-service.js');
const { fillStory } = require('./helpers/website-story.cjs');

const ID = 'sample-home';
async function toReview(s = createSampleService()) {
  s.setProjects([{ id: ID, name: 'Sample Home Services' }]);
  const job = await s.startJob(ID, 'website', 'standard');
  await s.completeStage(ID, job.id); await s.approveStage(ID, job.id);   // Kickoff
  await fillStory(s, ID, job.id);
  await s.completeStage(ID, job.id); await s.completeStage(ID, job.id);   // Story and sitemap, Words
  await s.completeStage(ID, job.id); await s.approveStage(ID, job.id);   // Storyboard
  await s.completeStage(ID, job.id);                                      // Look and assets
  await s.completeStage(ID, job.id); await s.approveStage(ID, job.id);   // Design lock: Jax approves for the client (#238)
  await s.startSite(ID, job.id, { from: 'cards' });
  const atCheck = await s.completeStage(ID, job.id);                      // Build
  return { s, job, atCheck };
}

test('comments go on a real part of the site, only while Review is open', async () => {
  const { s, job, atCheck } = await toReview();
  assert.equal(atCheck.stageId, 'check');
  await assert.rejects(s.addReviewComment(ID, job.id, { pageId: 'home', sectionId: 'hero', text: 'Bigger photo' }), /while Review is open/);
  assert.equal((await s.completeStage(ID, job.id)).stageId, 'review');
  await assert.rejects(s.addReviewComment(ID, job.id, { pageId: 'home', sectionId: 'nope', text: 'x' }), /isn't on this page/);
  await assert.rejects(s.addReviewComment(ID, job.id, { pageId: 'home', sectionId: 'hero', key: 'site-name', text: 'x' }), /isn't in this section/);
  await assert.rejects(s.addReviewComment(ID, job.id, { pageId: 'home', sectionId: 'hero', text: '   ' }), /Write the comment/);
  await assert.rejects(s.addReviewComment(ID, job.id, { pageId: 'home', sectionId: 'hero', text: 'x'.repeat(1001) }), /too long/);
  const events = []; s.on((e, d) => events.push([e, d.jobId]));
  const c = await s.addReviewComment(ID, job.id, { pageId: 'home', sectionId: 'hero', key: 'hero-headline', text: 'Say "free estimate" here.' });
  assert.deepEqual([c.where, c.key, c.resolved], ['Home · Hero', 'hero-headline', null]);
  assert.deepEqual(events, [['review-changed', job.id]]);
  assert.deepEqual((await s.getReview(ID, job.id)).open, 1);
});

test('every comment needs an answer with a note before Review goes to Jax; then comments lock', async () => {
  const { s, job } = await toReview();
  await s.completeStage(ID, job.id);
  const a = await s.addReviewComment(ID, job.id, { pageId: 'home', sectionId: 'hero', text: 'Bigger photo' });
  const b = await s.addReviewComment(ID, job.id, { pageId: 'home', sectionId: 'site-nav', text: 'Add the phone number' });
  await assert.rejects(s.completeStage(ID, job.id), /2 comments need an answer/);
  await assert.rejects(s.resolveReviewComment(ID, job.id, a.id, { kind: 'maybe', note: 'x' }), /fixed or keep/);
  await assert.rejects(s.resolveReviewComment(ID, job.id, a.id, { kind: 'keep', note: ' ' }), /Say why it stays/);
  await assert.rejects(s.resolveReviewComment(ID, job.id, a.id, { kind: 'fixed' }), /Say what changed/);
  await s.resolveReviewComment(ID, job.id, a.id, { kind: 'keep', note: 'The client likes this photo.' });
  await assert.rejects(s.resolveReviewComment(ID, job.id, a.id, { kind: 'fixed', note: 'x' }), /already has an answer/);
  await assert.rejects(s.completeStage(ID, job.id), /1 comment needs an answer/);
  await s.resolveReviewComment(ID, job.id, b.id, { kind: 'fixed', note: 'Phone added to the menu.' });
  const sent = await s.completeStage(ID, job.id);
  assert.equal(sent.waitingOnJax, true);
  await assert.rejects(s.addReviewComment(ID, job.id, { pageId: 'home', sectionId: 'hero', text: 'Late' }), /while Review is open/);
  const review = await s.getReview(ID, job.id);
  assert.equal(review.open, 0);
  assert.deepEqual(review.comments.map(c => c.resolved.kind), ['keep', 'fixed']);
});

test('only Website Jobs have a review, and real sign-in keeps it with the rest of the Website Job', async () => {
  const s = createSampleService();
  s.setProjects([{ id: ID, name: 'Sample Home Services' }]);
  const deck = await s.startJob(ID, 'pitch-deck', 'deck');
  await assert.rejects(s.getReview(ID, deck.id), /Only Website Jobs/);
  const local = createSampleService({ practice: false });
  const { job } = await toReview(local);
  await local.completeStage(ID, job.id);
  const server = createServerService({ local, request: async () => ({ success: true, data: [] }) });
  await server.addReviewComment(ID, job.id, { pageId: 'home', sectionId: 'hero', text: 'Bigger photo' });
  assert.equal((await server.getReview(ID, job.id)).open, 1);
  const wf = await s.getWorkflow('website');
  assert.deepEqual(wf.stages.find(st => st.id === 'review').tools, ['site-review', 'website']);   // the builder, for fixes (#219)
});
