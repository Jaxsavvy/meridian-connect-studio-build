'use strict';
// Core #281 (pitch plan F2): finishing Assemble board saves the finished board to the project's Docs as one page,
// ready to publish; a deck that can't render or a failed save never blocks Assemble (synthetic data only).
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService, createServerService } = require('../../src/renderer/studio/studio-service.js');
const board = require('../../src/renderer/studio/tools/pitch-deck/board.js');

const BOARD = 'Pitch deck v1 - Board.html';
function setup({ saveFails = false, brokenBoard = false } = {}) {
  const files = new Map();
  const saveFile = async (id, name, content) => {
    if (saveFails && name === BOARD) return { success: false, error: 'disk full' };
    files.set(`${id}/${name}`, content);
    return { success: true };
  };
  const readSave = async (id, name) => (files.has(`${id}/${name}`) ? { success: true, content: files.get(`${id}/${name}`) } : { success: false, missing: true });
  const local = createSampleService();
  const renderer = brokenBoard ? { renderDeck() { throw new Error('cannot render'); } } : board;
  const server = createServerService({ request: async () => ({ success: true, data: [] }), local, saveFile, readSave, board: renderer,
    checkBoard: async () => ({ success: true, ran: ['phone-screenshot', 'links-open'], flags: [] }) });
  server.setProjects([{ id: 'sample-home', name: 'Sample Home Services' }]);
  return { local, server, files };
}
async function throughAssemble({ local, server }, upTo = 'assemble') {
  const job = await server.startJob('sample-home', 'pitch-deck', 'deck');
  await local.useSampleResearch('sample-home', job.id);
  for (const id of ['research', 'home-t1', 'home-t2', 'home-t3', 'assemble']) {
    await server.completeStage('sample-home', job.id, id);
    if (id === upTo) break;
  }
  return job;
}

test('finishing Assemble board saves the board page to the project files', async () => {
  const s = setup();
  const job = await throughAssemble(s, 'home-t3');
  assert.equal(s.files.has(`sample-home/${BOARD}`), false, 'not before Assemble finishes');
  await s.server.completeStage('sample-home', job.id, 'assemble');
  const html = s.files.get(`sample-home/${BOARD}`);
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /Market Opportunity Analysis/);
  assert.equal(html, board.renderDeck(await s.local.getDeck('sample-home', job.id)), 'the same page the board check sees');
});

test('a deck that cannot render or a failed save never blocks Assemble', async () => {
  for (const opts of [{ saveFails: true }, { brokenBoard: true }]) {
    const s = setup(opts);
    const job = await throughAssemble(s);
    assert.equal(s.files.has(`sample-home/${BOARD}`), false);
    assert.equal((await s.server.getJob('sample-home', job.id)).stageId, 'check', JSON.stringify(opts));
  }
});
