'use strict';
// Core: hand-entered research, so a real deck can be built before the research agent exists (synthetic data only).
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService, createServerService } = require('../../src/renderer/studio/studio-service.js');

const SRC = { label: 'Checked by hand', url: 'https://example.com/source' };
const ME = 'ChIJtestClient0001', RIVALS = ['ChIJtestRival00001', 'ChIJtestRival00002', 'ChIJtestRival00003'];
const projects = [{ id: 'sample-home', name: 'Sample Home Services' }];
// Everything a person would type in for one prospect.
const FACTS = [
  { kind: 'place', subject: 'client', placeId: ME, rank: 2, source: SRC },
  ...RIVALS.map((placeId, i) => ({ kind: 'place', subject: 'competitor', placeId, rank: [1, 3, 4][i], source: SRC })),
  ...['website', 'phone', 'hours', 'categories'].map(field => ({ kind: 'profile', subject: 'client', field, value: true, source: SRC })),
  { kind: 'profile', subject: 'client', field: 'photos', value: false, source: SRC },
  { kind: 'website', subject: 'client', field: 'speed', value: 61, source: SRC },
  ...['https', 'phoneLink'].map(field => ({ kind: 'website', subject: 'client', field, value: true, source: SRC })),
  { kind: 'website', subject: 'client', field: 'contactForm', value: false, source: SRC },
  { kind: 'census', subject: 'market', field: 'population', value: 52300, source: { label: 'US Census Bureau', url: 'https://data.census.gov/' } },
  { kind: 'demand', subject: 'market', field: 'monthlySearches', value: 2400, source: { label: 'Keyword research', url: 'https://example.com/demand' } },
];
// The words a person writes on the Pitch Deck page (#116): every blank text field, never a number.
function writeWords(value, key) {
  if (Array.isArray(value)) return value.map(v => writeWords(v));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, writeWords(v, k)]));
  if (value !== '' || ['prefix', 'unit', 'note'].includes(key)) return value;
  return key === 'url' ? 'https://example.com/source' : 'Words';
}

test('a typed-in fact is checked, dated, kept with its source, and replaced when typed again', async () => {
  const s = createSampleService(); s.setProjects(projects);
  const job = await s.startJob('sample-home', 'pitch-deck', 'deck');
  const add = fact => s.addEvidence('sample-home', job.id, fact);
  await assert.rejects(add({ kind: 'google', subject: 'client', field: 'rating', placeId: ME, source: SRC }), /live from Google Maps/);
  await assert.rejects(add({ kind: 'census', subject: 'market', field: 'population', value: 5, source: { label: 'x', url: 'ftp://x' } }), /source/);
  await assert.rejects(add({ kind: 'census', subject: 'market', field: 'income', value: 5, source: SRC }), /Unknown field/);
  await assert.rejects(add({ kind: 'census', subject: 'market', field: 'population', value: -5, source: SRC }), /0 or more/);
  await assert.rejects(add({ kind: 'place', subject: 'client', placeId: ME, source: SRC }), /rank/);
  await assert.rejects(add(null), /group of fields/);
  const first = await add(FACTS.at(-2));
  assert.equal(first.method, 'person'); assert.match(first.id, /^fact-/); assert.ok(first.fetchedAt);
  let r = await s.getResearch('sample-home', job.id);
  assert.equal(r.status, 'by-hand'); assert.equal(r.score, null);
  await add({ ...FACTS.at(-2), value: 52900 });                                 // a correction replaces it
  r = await s.getResearch('sample-home', job.id);
  assert.deepEqual(r.evidence.map(e => e.value), [52900]);
  const me = await add(FACTS[0]);                                               // the prospect's own Google place
  r = await s.getResearch('sample-home', job.id);
  assert.equal(r.status, 'done'); assert.equal(r.placeId, ME); assert.ok(r.score);
  await s.removeEvidence('sample-home', job.id, me.id);
  assert.equal((await s.getResearch('sample-home', job.id)).status, 'by-hand');
  await assert.rejects(s.removeEvidence('sample-home', job.id, 'ev-1'), /typed in/);
});

test('facts the research found stay; a run that still needs a match must be finished first', async () => {
  const s = createSampleService(); s.setProjects(projects);
  const job = await s.startJob('sample-home', 'pitch-deck', 'deck');
  await s.startResearch('sample-home', job.id, { category: 'plumber' });
  await assert.rejects(s.addEvidence('sample-home', job.id, FACTS.at(-1)), /pick the business/);
  const { evidence } = await s.useSampleResearch('sample-home', job.id);
  await assert.rejects(s.removeEvidence('sample-home', job.id, evidence[0].id), /typed in/);
  await s.addEvidence('sample-home', job.id, { ...FACTS.at(-2), value: 60000 });   // a person fills in a better number
  assert.equal((await s.getResearch('sample-home', job.id)).status, 'done');
});

test('real mode: type in the research, use it (numbers only), write the words, finish Research + write', async () => {
  const server = createServerService({ request: async () => ({ success: true, data: [] }), saveFile: async () => ({ success: true }) });
  server.setProjects(projects);
  const job = await server.startJob('sample-home', 'pitch-deck', 'deck');
  await assert.rejects(server.useSampleResearch('sample-home', job.id), /practice mode/);
  for (const fact of FACTS) await server.addEvidence('sample-home', job.id, fact);
  const r = await server.getResearch('sample-home', job.id);
  assert.equal(r.status, 'done'); assert.equal(r.evidence.length, FACTS.length);
  assert.equal(r.score.parts.reduce((t, p) => t + p.max, 0), 100);
  const names = { [RIVALS[0]]: 'Rival One', [RIVALS[1]]: 'Rival Two', [RIVALS[2]]: 'Rival Three' };
  const out = await server.applyResearchToDeck('sample-home', job.id, { names });
  assert.equal(out.deck.bottomLine.headline, '');                                // no practice words in real mode
  assert.deepEqual(out.deck.competitors.rows.map(row => row.name), ['Rival One', 'Sample Home Services', 'Rival Two', 'Rival Three']);
  assert.equal(out.deck.market.stats[1].estimate, true);                         // demand: always a labeled estimate
  assert.equal(out.errors.some(e => /evidence|isn't in the research/.test(e.message)), false);
  await assert.rejects(server.completeStage('sample-home', job.id), /fields still need work/);
  const words = writeWords(out.deck);
  words.demand.series = [210, 220, 215, 230, 240, 238];
  assert.deepEqual((await server.saveDeck('sample-home', job.id, words)).errors, []);
  const files = await server.getResearchFiles('sample-home', job.id);
  assert.ok(JSON.parse(files[1].content).every(e => e.method === 'person'));
  assert.deepEqual((await server.saveToProjectFiles('sample-home', job.id, files)).failed, []);
  assert.deepEqual((await server.completeStage('sample-home', job.id)).openStageIds, ['home-t1', 'home-t2', 'home-t3']);
});
