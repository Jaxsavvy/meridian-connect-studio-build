'use strict';
// Core: Meridian drafts a chapter card's words (#193). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const Cards = require('../../src/renderer/studio/website/chapter-cards.js');
const { createSampleService, createServerService } = require('../../src/renderer/studio/studio-service.js');

async function website() {
  const s = createSampleService();
  s.setProjects([{ id: 'sample-home', name: 'Sample Home Services' }]);
  const job = await s.startJob('sample-home', 'website', 'standard');
  return { s, job };
}

test('the draft fits the card, uses the chapter and Kickoff\'s call to action, and passes the Words gate', async () => {
  const { s, job } = await website();
  await s.saveStageNotes('sample-home', job.id, 'brief', { goal: 'More estimate calls', audience: 'Local homeowners',
    callToAction: 'Book a roof check', pages: ['Home'] });
  const { draft, settingsUsed } = await s.draftChapter('sample-home', job.id, { page: 'Home', name: 'Hero', job: 'Make the visitor call.' });
  assert.equal(draft.button, 'Book a roof check');
  assert.match(draft.headline, /^Hero/);
  assert.match(draft.body, /^Make the visitor call\. /);
  assert.equal(settingsUsed.model, 'sample');
  const story = { pages: [{ name: 'Home', path: '/', purpose: 'Get calls', chapters: [{ name: 'Hero', job: 'Get calls', words: draft }] }] };
  assert.deepEqual(Cards.stageGaps(Cards.cleanStory(story), 'words'), []);
});

test('drafting never saves, works with nothing typed yet, and stays inside the card limits', async () => {
  const { s, job } = await website();
  const before = await s.getStory('sample-home', job.id);
  const { draft } = await s.draftChapter('sample-home', job.id, {});
  assert.deepEqual(await s.getStory('sample-home', job.id), before);
  assert.equal(draft.button, 'Get a free estimate');
  const long = await s.draftChapter('sample-home', job.id, { name: 'N'.repeat(80), job: 'J'.repeat(300) });
  assert.ok(long.draft.headline.length <= 200 && long.draft.body.length <= 4000 && long.draft.button.length <= 60);
  await assert.rejects(s.draftChapter('sample-home', job.id, { name: 'N'.repeat(81) }), /too long/);
});

test('only Website Jobs draft chapters; real sign-in waits for the server', async () => {
  const s = createSampleService();
  s.setProjects([{ id: 'sample-home', name: 'Sample Home Services' }]);
  const deck = await s.startJob('sample-home', 'pitch-deck', 'deck');
  await assert.rejects(s.draftChapter('sample-home', deck.id, { name: 'Hero' }), /Only Website Jobs/);
  const server = createServerService({ request: async () => ({ success: true, data: [] }) });
  await assert.rejects(server.draftChapter('sample-home', 'any-job', { name: 'Hero' }), /Coming soon/);
});
