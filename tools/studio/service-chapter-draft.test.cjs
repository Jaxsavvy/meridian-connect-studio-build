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
});

test('STUDIO-DRAFT: real sign-in drafts on the server (/draft), never with sample words, even when the server fails', async () => {
  const calls = [];
  let reply = { success: true, status: 200, data: { draft: { headline: 'H', body: 'B', button: 'Call' }, settingsUsed: { kind: 'chapter', model: 'meridian' } } };
  const server = createServerService({ request: async (method, endpoint, body) => { calls.push({ method, endpoint, body }); return reply; }, retryDelays: [] });
  const out = await server.draftChapter('sample-home', 'any-job', { name: 'Hero', page: 'Home', job: 'Say what we do', extra: 'dropped' });
  assert.deepEqual(out.draft, { headline: 'H', body: 'B', button: 'Call' });
  const last = calls.at(-1);
  assert.equal(last.method, 'POST');
  assert.equal(last.endpoint, '/api/studio/spaces/sample-home/draft');
  assert.deepEqual(last.body, { kind: 'chapter', input: { page: 'Home', name: 'Hero', job: 'Say what we do' } });
  reply = { success: true, status: 200, data: { draft: 'A site that books jobs.', settingsUsed: { kind: 'brief-summary' } } };
  const copy = await server.draftCopy({ spaceId: 'sample-home', kind: 'brief-summary', input: { notes: 'Roofing, Eugene', secret: 'x' } });
  assert.equal(copy.draft, 'A site that books jobs.');
  assert.deepEqual(calls.at(-1).body, { kind: 'brief-summary', input: { notes: 'Roofing, Eugene' } });
  reply = { success: false, status: 503, error: 'Meridian is switched off in Studio right now.', code: 'studio_ai_off' };
  await assert.rejects(server.draftCopy({ spaceId: 'sample-home', kind: 'headline', input: { heading: 'Roofs' } }), /switched off/);
  await assert.rejects(server.draftChapter('sample-home', 'any-job', { name: 'Hero' }), /switched off/);
});
