'use strict';
// Core: each pitch deck's data is stored, and Research + write finishes only with a deck that passes (#119).
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService, createServerService } = require('../../src/renderer/studio/studio-service.js');
const { validateEvidence } = require('../../src/renderer/studio/decks/research-model.js');

async function deck() {
  const s = createSampleService();
  s.setProjects([{ id: 'sample-home', name: 'Sample Home Services' }, { id: 'client-b', name: 'Client B' }]);
  const job = await s.startJob('sample-home', 'pitch-deck', 'deck');
  return { s, job };
}

test('a new deck is blank with the project name; only pitch deck Jobs have one', async () => {
  const { s, job } = await deck();
  const d = await s.getDeck('sample-home', job.id);
  assert.equal(d.version, 1); assert.equal(d.client.name, 'Sample Home Services');
  assert.equal(d.competitors.rows[0].you, true); assert.equal(d.homePages.tiers.length, 3);
  const site = await s.startJob('client-b', 'website', 'standard');
  await assert.rejects(s.getDeck('client-b', site.id), /Only pitch deck Jobs/);
  await assert.rejects(s.getDeck('sample-home', 'job-404'), /Job not found/);
});

test('saving keeps an unfinished deck and names every field still to fix', async () => {
  const { s, job } = await deck();
  const events = [];
  const off = s.on((event, detail) => events.push([event, detail.jobId]));
  const blank = await s.getDeck('sample-home', job.id);
  const out = await s.saveDeck('sample-home', job.id, { ...blank, bottomLine: { ...blank.bottomLine, headline: 'Customers are looking' }, pricing: 1500 });
  off();
  assert.equal(out.ok, false);
  assert.ok(out.errors.some(e => e.path === 'pricing' && /Unknown field/.test(e.message)));   // nothing internal gets in
  assert.ok(out.errors.some(e => e.path === 'bottomLine.text'));
  assert.ok(out.errors.some(e => e.path === 'market.stats.0.value' && /No evidence/.test(e.message)));
  assert.deepEqual(events, [['deck-changed', job.id]]);
  const saved = await s.getDeck('sample-home', job.id);
  assert.equal(saved.bottomLine.headline, 'Customers are looking'); assert.equal('pricing' in saved, false);
  await assert.rejects(s.saveDeck('sample-home', job.id, null), /group of fields/);
  await assert.rejects(s.saveDeck('sample-home', job.id, []), /group of fields/);
});

test('Research + write refuses a broken deck, then passes with one the evidence backs', async () => {
  const { s, job } = await deck();
  await assert.rejects(s.completeStage('sample-home', job.id), /run the research and confirm the business first/);   // #125
  const { evidence, deck: practice } = await s.useSampleResearch('sample-home', job.id);
  assert.equal(validateEvidence(evidence).ok, true);
  assert.equal(evidence.some(e => e.kind === 'google' && e.value != null), false);   // Google values are never stored
  assert.deepEqual((await s.saveDeck('sample-home', job.id, practice)).errors, []);
  const changed = JSON.parse(JSON.stringify(practice));
  changed.market.stats[0].value += 5;                                                  // a number nobody can source
  const out = await s.saveDeck('sample-home', job.id, changed);
  assert.equal(out.ok, false); assert.deepEqual(out.errors.map(e => e.path), ['market.stats.0.value']);
  await assert.rejects(s.completeStage('sample-home', job.id), /1 field still needs work/);
  await s.saveDeck('sample-home', job.id, practice);
  const view = await s.completeStage('sample-home', job.id);
  assert.deepEqual(view.openStageIds, ['home-t1', 'home-t2', 'home-t3']);
});

test('the deck locks once Research + write is done', async () => {
  const { s, job } = await deck();
  const { deck: practice } = await s.useSampleResearch('sample-home', job.id);
  await s.completeStage('sample-home', job.id);
  await assert.rejects(s.saveDeck('sample-home', job.id, practice), /locked/);
  await assert.rejects(s.useSampleResearch('sample-home', job.id), /locked/);
  assert.equal((await s.getDeck('sample-home', job.id)).score.value, practice.score.value);
});

test('research summary and project files come only from a passing deck', async () => {
  const { s, job } = await deck();
  await assert.rejects(s.getResearchSummary('sample-home', job.id), /isn't done yet/);
  await assert.rejects(s.getResearchFiles('sample-home', job.id), /isn't done yet/);
  await s.useSampleResearch('sample-home', job.id);
  const md = await s.getResearchSummary('sample-home', job.id);
  assert.match(md, /^# Research summary: Sample Home Services, Sample Town/);
  assert.match(md, /rating and reviews live from Google Maps/);
  const files = await s.getResearchFiles('sample-home', job.id);
  assert.deepEqual(files.map(f => f.name), ['Research summary.md', 'Evidence.json', 'Deck data.json']);
  assert.equal(JSON.parse(files[2].content).client.name, 'Sample Home Services');
  const saved = await s.saveToProjectFiles('sample-home', job.id, files);
  assert.deepEqual(saved.saved, ['Pitch deck v1 - Research summary.md', 'Pitch deck v1 - Evidence.json', 'Pitch deck v1 - Deck data.json']);
  await s.completeStage('sample-home', job.id);
});

test('real mode keeps decks local for now and never uses practice research', async () => {
  const server = createServerService({ request: async () => ({ success: true, data: [] }) });
  server.setProjects([{ id: 'sample-home', name: 'Sample Home Services' }]);
  const job = await server.startJob('sample-home', 'pitch-deck', 'deck');
  assert.equal((await server.getDeck('sample-home', job.id)).client.name, 'Sample Home Services');
  assert.equal((await server.saveDeck('sample-home', job.id, await server.getDeck('sample-home', job.id))).ok, false);
  await assert.rejects(server.useSampleResearch('sample-home', job.id), /practice mode/);
  await assert.rejects(server.completeStage('sample-home', job.id), /isn't done yet/);
});
