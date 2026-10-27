'use strict';
// Core: Auto check runner, part 1 (#131): deck checker, evidence guard, secure links, internal-words scan.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService, createServerService } = require('../../src/renderer/studio/studio-service.js');

async function deck() {
  const s = createSampleService();
  s.setProjects([{ id: 'sample-home', name: 'Sample Home Services' }]);
  const job = await s.startJob('sample-home', 'pitch-deck', 'deck');
  return { s, job };
}
// Research + write, the three home pages and Assemble board, so Auto check is the open stage.
async function toAutoCheck(s, job, change = d => d) {
  const { deck: practice } = await s.useSampleResearch('sample-home', job.id);
  assert.deepEqual((await s.saveDeck('sample-home', job.id, change(practice))).errors, []);
  for (const id of ['research', 'home-t1', 'home-t2', 'home-t3', 'assemble']) await s.completeStage('sample-home', job.id, id);
}

test('Assemble board finishing runs Auto check by itself; a clean deck has nothing to review', async () => {
  const { s, job } = await deck();
  assert.equal((await s.getChecks('sample-home', job.id)).ranAt, null);
  await toAutoCheck(s, job);
  const checks = await s.getChecks('sample-home', job.id);
  assert.ok(checks.ranAt); assert.deepEqual(checks.flags, []);
  assert.deepEqual(checks.notRun, ['phone-screenshot', 'links-open']);   // part 2, with the board on the server
  assert.equal((await s.completeStage('sample-home', job.id, 'check')).stageId, 'review');
});

test('each check flags what it finds, by field', async () => {
  const { s, job } = await deck();
  const blank = await s.runChecks('sample-home', job.id);                 // nothing researched yet
  assert.ok(blank.some(f => f.check === 'deck' && f.where === 'bottomLine.text'));
  assert.ok(blank.some(f => f.check === 'evidence' && f.where === 'market.stats.0.value'));
  await toAutoCheck(s, job, d => {
    d.bottomLine.headline = 'Internal notes for Tyler';
    d.bottomLine.text = 'Our pricing starts at $500 a month.';
    d.reputation.text = 'Draft: no clients yet in this town.';
    d.demand.source.url = 'http://example.com/demand';
    d.market.stats[0].prefix = '$';                                      // allowed: the prospect's own market number
    return d;
  });
  const flags = (await s.getChecks('sample-home', job.id)).flags.map(f => [f.check, f.where, f.message]);
  assert.deepEqual(flags, [                                               // in board order
    ['internal-words', 'bottomLine.headline', 'Internal word on the board: "Internal".'],
    ['internal-words', 'bottomLine.text', 'Internal word on the board: "pricing".'],
    ['links', 'demand.source.url', 'Use a secure https:// link.'],
    ['internal-words', 'reputation.text', 'Internal word on the board: "no clients".'],
  ]);
});

test('Auto check can\'t finish while a flag is open; resolving needs a note, is logged and survives a re-run', async () => {
  const { s, job } = await deck();
  await toAutoCheck(s, job, d => { d.visibility.text = 'Tyler checked this page.'; d.gaps.text = 'Draft for now.'; return d; });
  let { flags } = await s.getChecks('sample-home', job.id);
  assert.equal(flags.length, 2);
  await assert.rejects(s.completeStage('sample-home', job.id, 'check'), /Auto check isn't done: 2 flags to review/);
  await assert.rejects(s.resolveFlag('sample-home', job.id, flags[0].id, '  '), /Say why/);
  await assert.rejects(s.resolveFlag('sample-home', job.id, 'flag-404', 'ok'), /not found/);
  const done = await s.resolveFlag('sample-home', job.id, flags[0].id, 'Tyler is the owner\'s name too.');
  assert.equal(done.resolved.note, 'Tyler is the owner\'s name too.');
  await assert.rejects(s.resolveFlag('sample-home', job.id, flags[0].id, 'again'), /already resolved/);
  flags = await s.runChecks('sample-home', job.id);                     // same findings: the resolved one stays resolved
  assert.deepEqual(flags.map(f => !!f.resolved), [true, false]);
  await assert.rejects(s.completeStage('sample-home', job.id, 'check'), /1 flag to review/);
  await s.resolveFlag('sample-home', job.id, flags[1].id, 'Reworded on the board.');
  const log = (await s.getChecks('sample-home', job.id)).log;
  assert.deepEqual(log.map(x => [x.check, x.where]), [['internal-words', 'visibility.text'], ['internal-words', 'gaps.text']]);
  assert.ok(log.every(x => x.at && x.note));
  await s.completeStage('sample-home', job.id, 'check');
  await assert.rejects(s.runChecks('sample-home', job.id), /finished/);
  await assert.rejects(s.resolveFlag('sample-home', job.id, flags[1].id, 'late'), /finished/);
});

test('real mode runs Auto check locally for now (like Jobs)', async () => {
  const server = createServerService({ request: async () => ({ success: true, data: [] }) });
  server.setProjects([{ id: 'sample-home', name: 'Sample Home Services' }]);
  const job = await server.startJob('sample-home', 'pitch-deck', 'deck');
  assert.ok((await server.runChecks('sample-home', job.id)).some(f => f.check === 'deck'));
  assert.ok((await server.getChecks('sample-home', job.id)).ranAt);
});
