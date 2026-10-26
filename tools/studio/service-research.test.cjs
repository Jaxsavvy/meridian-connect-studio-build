'use strict';
// Core: research service methods in Studio, practice research first (#125).
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService, createServerService } = require('../../src/renderer/studio/studio-service.js');
const { validateEvidence } = require('../../src/renderer/studio/decks/research-model.js');

async function deck(options) {
  const s = createSampleService(options);
  s.setProjects([{ id: 'riverdale', name: 'Riverdale Home Services' }]);
  const job = await s.startJob('riverdale', 'pitch-deck', 'deck');
  return { s, job, events: [] };
}
const watch = (s, list) => s.on((event, detail) => { if (event === 'research-changed') list.push(detail.jobId); });

test('start research: the person confirms which business it is, then research is done', async () => {
  const { s, job, events } = await deck();
  const off = watch(s, events);
  assert.equal((await s.getResearch('riverdale', job.id)).status, 'not-started');
  await assert.rejects(s.startResearch('riverdale', job.id, {}), /what kind of business/);
  await assert.rejects(s.startResearch('riverdale', job.id, { category: 'plumber\nnext line' }), /what kind of business/);
  const run = await s.startResearch('riverdale', job.id, { category: 'plumber' });
  assert.equal(run.status, 'needs-match'); assert.match(run.runId, /^run-/);
  let r = await s.getResearch('riverdale', job.id);
  assert.equal(r.category, 'plumber');
  assert.deepEqual(r.candidates.map(c => c.placeId), ['sample-place-you-0001', 'sample-place-you-0002']);
  assert.equal(r.score, null); assert.deepEqual(r.evidence, []);
  await assert.rejects(s.confirmMatch('riverdale', job.id, 'sample-place-elsewhere'), /Pick one of the businesses/);
  assert.equal((await s.confirmMatch('riverdale', job.id, 'sample-place-you-0002')).status, 'done');
  await assert.rejects(s.confirmMatch('riverdale', job.id, 'sample-place-you-0001'), /no match to confirm/);
  r = await s.getResearch('riverdale', job.id);
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
  assert.equal((await s.startResearch('riverdale', job.id, { category: 'plumber' })).status, 'running');
  await assert.rejects(s.startResearch('riverdale', job.id, { category: 'plumber' }), /already running/);
  await new Promise(done => setTimeout(done, 20));
  assert.equal((await s.getResearch('riverdale', job.id)).status, 'needs-match');
});

test('apply research to the deck: numbers from the evidence, the person\'s words kept, missing returned', async () => {
  const { s, job } = await deck();
  await assert.rejects(s.applyResearchToDeck('riverdale', job.id), /run the research and confirm/);
  const blank = await s.getDeck('riverdale', job.id);
  await s.saveDeck('riverdale', job.id, { ...blank, market: { ...blank.market, headline: 'A large local market' } });
  await s.startResearch('riverdale', job.id, { category: 'plumber' });
  await s.confirmMatch('riverdale', job.id, 'sample-place-you-0001');
  const out = await s.applyResearchToDeck('riverdale', job.id, { names: { 'sample-place-rival-1': 'Summit Services' } });
  assert.equal(out.deck.market.headline, 'A large local market');            // words kept
  assert.equal(out.deck.client.placeId, 'sample-place-you-0001');
  assert.deepEqual(out.deck.market.stats.map(x => x.value), [48.2, 18.1, 1.9]);
  assert.equal(out.deck.competitors.rows.find(r => r.placeId === 'sample-place-rival-1').name, 'Summit Services');
  assert.ok(out.missing.length > 0); assert.equal('missing' in out.deck, false);
  assert.equal(out.ok, false);                                               // words still to write...
  assert.equal(out.errors.some(e => /evidence|isn't in the research/.test(e.message)), false);   // ...but every number is backed
  assert.deepEqual((await s.getDeck('riverdale', job.id)).score, out.deck.score);
});

test('Research + write needs research done and a confirmed business', async () => {
  const { s, job } = await deck();
  await assert.rejects(s.completeStage('riverdale', job.id), /run the research and confirm the business first/);
  await s.startResearch('riverdale', job.id, { category: 'plumber' });
  await assert.rejects(s.completeStage('riverdale', job.id), /confirm the business first/);   // still needs a match
  await s.useSampleResearch('riverdale', job.id);                                            // practice: done + passing deck
  assert.match((await s.getResearch('riverdale', job.id)).summary, /^# Research summary: Riverdale Home Services/);
  await s.completeStage('riverdale', job.id);
  await assert.rejects(s.startResearch('riverdale', job.id, { category: 'plumber' }), /locked/);
  await assert.rejects(s.applyResearchToDeck('riverdale', job.id), /locked/);
  assert.equal((await s.getResearch('riverdale', job.id)).status, 'done');
});

test('real mode: research waits on the server agent (#126)', async () => {
  const server = createServerService({ request: async () => ({ success: true, data: [] }) });
  server.setProjects([{ id: 'riverdale', name: 'Riverdale Home Services' }]);
  const job = await server.startJob('riverdale', 'pitch-deck', 'deck');
  await assert.rejects(server.startResearch('riverdale', job.id, { category: 'plumber' }), /Coming soon/);
  await assert.rejects(server.getResearch('riverdale', job.id), /Coming soon/);
  await assert.rejects(server.confirmMatch('riverdale', job.id, 'sample-place-you-0001'), /Coming soon/);
  await assert.rejects(server.applyResearchToDeck('riverdale', job.id), /run the research/);
});
