'use strict';
// Core: Auto check part 2 (#131) in the real service: Connect's board check runs when Assemble board finishes,
// its flags block Auto check until resolved, and they're kept with the deck (synthetic data only).
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService, createServerService } = require('../../src/renderer/studio/studio-service.js');
const board = require('../../src/renderer/studio/tools/pitch-deck/board.js');

const FILE = 'Pitch deck - Studio save.json';
function setup(checkBoard) {
  const files = new Map(), requests = [];
  const saveFile = async (id, name, content) => { files.set(`${id}/${name}`, content); return { success: true }; };
  const readSave = async id => (files.has(`${id}/${FILE}`) ? { success: true, content: files.get(`${id}/${FILE}`) } : { success: false, missing: true });
  // The practice service stands in for the deck work, so this test needs no typed-in research.
  const local = createSampleService();
  const open = (l = local) => createServerService({ request: async () => ({ success: true, data: [] }), local: l, saveFile, readSave, board,
    checkBoard: async req => { requests.push(req); return checkBoard(req); } });
  const server = open();
  server.setProjects([{ id: 'sample-home', name: 'Sample Home Services' }]);
  return { local, server, requests, files, open };
}
async function toAutoCheck({ local, server }) {
  const job = await server.startJob('sample-home', 'pitch-deck', 'deck');
  await local.useSampleResearch('sample-home', job.id);
  for (const id of ['research', 'home-t1', 'home-t2', 'home-t3', 'assemble']) await server.completeStage('sample-home', job.id, id);
  return job;
}
const FOUND = { success: true, ran: ['phone-screenshot', 'links-open'], screenshot: 'Pitch deck v1 - Board on a phone.png', flags: [
  { check: 'phone', message: 'Something runs off the side on a phone: the board is 520px wide on a 390px screen.', where: 'board' },
  { check: 'links-open', message: 'This link doesn\'t open: https://ads.google.com/', where: 'demand.source.url' },
  { check: 'deck', message: 'not a board check', where: 'x' }] };

test('finishing Assemble board sends the rendered board and its links to Connect; its flags block Auto check', async () => {
  const s = setup(async () => FOUND);
  const job = await toAutoCheck(s);
  const [req] = s.requests;
  assert.equal(req.projectId, 'sample-home'); assert.equal(req.fileName, 'Pitch deck v1 - Board on a phone.png');
  assert.match(req.html, /^<!doctype html>/); assert.match(req.html, /Live from Google Maps/);
  assert.ok(req.links.some(l => l.url === 'https://data.census.gov/' && /^market\.stats\.\d\.source\.url$/.test(l.where)));
  let checks = await s.server.getChecks('sample-home', job.id);
  assert.deepEqual(checks.notRun, []);
  assert.deepEqual(checks.flags.map(f => f.check), ['phone', 'links-open']);       // only board-check kinds are taken
  await assert.rejects(s.server.completeStage('sample-home', job.id, 'check'), /2 flags to review/);
  await s.server.resolveFlag('sample-home', job.id, checks.flags[0].id, 'The wide table scrolls on purpose.');
  await s.server.runChecks('sample-home', job.id);                                   // same findings: still resolved
  checks = await s.server.getChecks('sample-home', job.id);
  assert.deepEqual(checks.flags.map(f => !!f.resolved), [true, false]);
  await s.server.resolveFlag('sample-home', job.id, checks.flags[1].id, 'Google Ads blocks link checkers; opens in a browser.');
  assert.equal((await s.server.completeStage('sample-home', job.id, 'check')).stageId, 'review');
  const saved = JSON.parse(s.files.get(`sample-home/${FILE}`)).jobs[0].checks;
  assert.deepEqual(saved.notRun, []); assert.equal(saved.flags.length, 2);
});

test('if Connect can\'t run the board check, Assemble still finishes and the checks stay "not run"', async () => {
  for (const broken of [async () => ({ success: false, error: 'offline' }), async () => { throw new Error('boom'); }]) {
    const s = setup(broken);
    const job = await toAutoCheck(s);
    const checks = await s.server.getChecks('sample-home', job.id);
    assert.deepEqual(checks.notRun, ['phone-screenshot', 'links-open']);
    assert.deepEqual(checks.flags, []);
    assert.equal((await s.server.completeStage('sample-home', job.id, 'check')).stageId, 'review');
  }
});
