'use strict';
// Core: research service methods in Studio, practice research first (#125).
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService, createServerService } = require('../../src/renderer/studio/studio-service.js');
const { validateEvidence } = require('../../src/renderer/studio/decks/research-model.js');

async function deck(options) {
  const s = createSampleService(options);
  s.setProjects([{ id: 'sample-home', name: 'Sample Home Services' }]);
  const job = await s.startJob('sample-home', 'pitch-deck', 'deck');
  return { s, job, events: [] };
}
const watch = (s, list) => s.on((event, detail) => { if (event === 'research-changed') list.push(detail.jobId); });

test('start research: the person confirms which business it is, then research is done', async () => {
  const { s, job, events } = await deck();
  const off = watch(s, events);
  assert.equal((await s.getResearch('sample-home', job.id)).status, 'not-started');
  await assert.rejects(s.startResearch('sample-home', job.id, {}), /what kind of business/);
  await assert.rejects(s.startResearch('sample-home', job.id, { category: 'plumber\nnext line' }), /what kind of business/);
  const run = await s.startResearch('sample-home', job.id, { category: 'plumber' });
  assert.equal(run.status, 'needs-match'); assert.match(run.runId, /^run-/);
  let r = await s.getResearch('sample-home', job.id);
  assert.equal(r.category, 'plumber');
  assert.deepEqual(r.candidates.map(c => c.placeId), ['sample-place-you-0001', 'sample-place-you-0002']);
  assert.equal(r.score, null); assert.deepEqual(r.evidence, []);
  await assert.rejects(s.confirmMatch('sample-home', job.id, 'sample-place-elsewhere'), /Pick one of the businesses/);
  assert.equal((await s.confirmMatch('sample-home', job.id, 'sample-place-you-0002')).status, 'done');
  await assert.rejects(s.confirmMatch('sample-home', job.id, 'sample-place-you-0001'), /no match to confirm/);
  r = await s.getResearch('sample-home', job.id);
  assert.equal(r.status, 'done'); assert.equal(r.placeId, 'sample-place-you-0002');
  assert.equal(validateEvidence(r.evidence).ok, true);
  assert.equal(r.evidence.find(e => e.kind === 'place' && e.subject === 'client').placeId, 'sample-place-you-0002');
  assert.equal(r.score.parts.reduce((t, p) => t + p.max, 0), 100);
  assert.ok(r.score.missing.includes('Rating compared with competitors'));   // live Google values come with #127
  assert.equal(r.summary, null);                                             // the deck doesn't pass yet
  assert.doesNotMatch(JSON.stringify(r), /cost|price|spend/i);               // no costs shown
  off();
  assert.deepEqual(events, [job.id, job.id]);
});

test('in the app, practice research shows as running first', async () => {
  const { s, job } = await deck({ simulateJaxMs: 5 });
  assert.equal((await s.startResearch('sample-home', job.id, { category: 'plumber' })).status, 'running');
  await assert.rejects(s.startResearch('sample-home', job.id, { category: 'plumber' }), /already running/);
  await new Promise(done => setTimeout(done, 20));
  assert.equal((await s.getResearch('sample-home', job.id)).status, 'needs-match');
});

test('apply research to the deck: numbers from the evidence, draft words in the blanks, the person\'s words kept', async () => {
  const { s, job } = await deck();
  await assert.rejects(s.applyResearchToDeck('sample-home', job.id), /run the research and confirm/);
  const blank = await s.getDeck('sample-home', job.id);
  await s.saveDeck('sample-home', job.id, { ...blank, market: { ...blank.market, headline: 'A large local market' } });
  await s.startResearch('sample-home', job.id, { category: 'plumber' });
  await s.confirmMatch('sample-home', job.id, 'sample-place-you-0001');
  const out = await s.applyResearchToDeck('sample-home', job.id, { names: { 'sample-place-rival-1': 'Summit Services' } });
  assert.equal(out.deck.market.headline, 'A large local market');            // words kept
  assert.equal(out.deck.client.placeId, 'sample-place-you-0001');
  assert.deepEqual(out.deck.market.stats.map(x => x.value), [48.2, 18.1, 1.9]);
  assert.equal(out.deck.competitors.rows.find(r => r.placeId === 'sample-place-rival-1').name, 'Summit Services');
  assert.ok(out.missing.length > 0); assert.equal('missing' in out.deck, false);
  assert.equal(out.deck.competitors.rows.find(r => r.placeId === 'sample-place-rival-2').name, 'Valley Pros (sample)');
  assert.ok(out.deck.bottomLine.headline.length > 0);                        // Meridian drafted the blanks
  assert.deepEqual(out.errors, []); assert.equal(out.ok, true);              // every number backed, every field filled
  assert.deepEqual((await s.getDeck('sample-home', job.id)).score, out.deck.score);
  const view = await s.completeStage('sample-home', job.id);                   // the #129 path: run, confirm, use, finish
  assert.deepEqual(view.openStageIds, ['home-t1', 'home-t2', 'home-t3']);
});

test('Research + write needs research done and a confirmed business', async () => {
  const { s, job } = await deck();
  await assert.rejects(s.completeStage('sample-home', job.id), /run the research and confirm the business first/);
  await s.startResearch('sample-home', job.id, { category: 'plumber' });
  await assert.rejects(s.completeStage('sample-home', job.id), /confirm the business first/);   // still needs a match
  await s.useSampleResearch('sample-home', job.id);                                            // practice: done + passing deck
  assert.match((await s.getResearch('sample-home', job.id)).summary, /^# Research summary: Sample Home Services/);
  await s.completeStage('sample-home', job.id);
  await assert.rejects(s.startResearch('sample-home', job.id, { category: 'plumber' }), /locked/);
  await assert.rejects(s.applyResearchToDeck('sample-home', job.id), /locked/);
  assert.equal((await s.getResearch('sample-home', job.id)).status, 'done');
});

test('real mode: the research agent waits on the server (#126); hand-entered research works now', async () => {
  const server = createServerService({ request: async () => ({ success: true, data: [] }) });
  server.setProjects([{ id: 'sample-home', name: 'Sample Home Services' }]);
  const job = await server.startJob('sample-home', 'pitch-deck', 'deck');
  await assert.rejects(server.startResearch('sample-home', job.id, { category: 'plumber' }), /Coming soon/);
  await assert.rejects(server.confirmMatch('sample-home', job.id, 'sample-place-you-0001'), /Coming soon/);
  assert.equal((await server.getResearch('sample-home', job.id)).status, 'not-started');
  await assert.rejects(server.applyResearchToDeck('sample-home', job.id), /run the research/);
});
