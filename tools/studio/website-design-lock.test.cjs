'use strict';
// Core: Design lock, one bundle, the client approves, send back for changes (#238). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildBundle, bundleGaps, FORMAT } = require('../../src/renderer/studio/website/design-bundle.js');
const { createSampleService, createServerService } = require('../../src/renderer/studio/studio-service.js');
const { fillStory } = require('./helpers/website-story.cjs');

const ID = 'sample-home';
async function walkTo(s, jobId, stageId) {
  for (let guard = 0; guard < 20; guard++) {
    const j = await s.getJob(ID, jobId); if (j.stageId === stageId) return j;
    if (j.waitingOnJax) await s.approveStage(ID, jobId); else await s.completeStage(ID, jobId);
  }
  throw new Error(`never reached ${stageId}`);
}
async function atLock(s = createSampleService()) {
  s.setProjects([{ id: ID, name: 'Sample Home Services' }]);
  const job = await s.startJob(ID, 'website', 'standard');
  await fillStory(s, ID, job.id);
  await walkTo(s, job.id, 'lock');
  return { s, job };
}
const card = { id: 'hero', name: 'Hero', job: 'Call', words: { eyebrow: '', headline: 'Roofs', body: 'Crews', button: 'Call' }, layout: 'hero-photo',
  motion: 'none', phone: 'Stack', proof: [], shots: [{ id: 'shot-1', what: 'Crew', prompt: 'p', size: 'wide', tool: 'image', assetId: 'a-shot' }] };

test('the bundle holds everything the build needs, in the cards\' order, and says what is missing', () => {
  const story = { pages: [{ id: 'home', name: 'Home', path: '/', purpose: 'Calls', chapters: [card, { ...card, id: 'proof', name: 'Proof' }] }] };
  const concept = { line: 'A roof that shrugs off the rain', audience: 'Homeowners', goal: 'Calls', references: [{ url: 'https://example.com/a', note: 'x' }], mood: ['calm'] };
  const b = buildBundle({ name: 'Sample Roofing', tier: 'standard', concept, story, frames: { 'home/hero': 'a-frame' }, look: { direction: 'bold', assetId: 'a-look' }, style: { colors: {} } });
  assert.equal(b.format, FORMAT);
  assert.deepEqual(b.pages[0].chapters.map(c => [c.id, c.frame]), [['hero', 'a-frame'], ['proof', null]]);
  assert.deepEqual(b.assets, ['a-look', 'a-frame', 'a-shot'], 'each image once, look frame first');
  assert.equal(b.concept.line, concept.line);
  concept.mood.push('loud'); assert.deepEqual(b.concept.mood, ['calm'], 'a copy, not the live concept');
  assert.deepEqual(bundleGaps(b).map(g => g.where), ['Home · Proof']);
  assert.deepEqual(bundleGaps(b, { hasAsset: id => id !== 'a-shot' }).map(g => g.where), ['Home · Hero · Crew', 'Home · Proof', 'Home · Proof · Crew']);
  assert.deepEqual(bundleGaps(buildBundle({ name: 'x', story: { pages: [] } })).map(g => g.where), ['Concept', 'Look frame', 'Pages']);
});

test('Design lock comes after Look and assets; sending freezes the bundle and waits on Jax', async () => {
  const { s, job } = await atLock();
  const stage = (await s.getWorkflow('website')).stages.find(st => st.id === 'lock');
  assert.deepEqual([stage.approver, stage.tools, stage.check], ['jax', ['design-lock'], 'The client approves the design']);
  let lock = await s.getDesignLock(ID, job.id);
  assert.deepEqual([lock.gaps, lock.sent, lock.answer, lock.bundle.business.name], [[], null, null, 'Sample Home Services']);
  assert.equal(lock.bundle.style.colors.accent, '#2bb3a3', 'style numbers from the practice DNA');
  assert.equal(lock.bundle.assets.length, 3);
  const events = []; s.on(e => events.push(e));
  assert.equal((await s.completeStage(ID, job.id)).waitingOnJax, true);
  assert.ok(events.includes('design-changed'));
  lock = await s.getDesignLock(ID, job.id);
  assert.equal(lock.sent.version, 1);
  await assert.rejects(s.completeStage(ID, job.id), /already with Jax/);
  await assert.rejects(s.sendBack(ID, job.id, 'words'), /while it's with the team/);
  await s.approveStage(ID, job.id);   // Jax: the client said yes
  lock = await s.getDesignLock(ID, job.id);
  assert.deepEqual([(await s.getJob(ID, job.id)).stageId, lock.answer.approved, lock.answer.by], ['build', true, 'jax']);
  await assert.rejects(s.answerDesign(ID, job.id, { approved: true }), /isn't waiting on the client/);
});

test('the client asks for changes; the team sends it back, the gates run again, and version 2 is approved', async () => {
  const { s, job } = await atLock();
  await s.completeStage(ID, job.id);
  await assert.rejects(s.answerDesign(ID, job.id, { approved: false, note: '  ' }), /Say what the client wants changed/);
  let lock = await s.answerDesign(ID, job.id, { approved: false, note: 'Warmer photos, please.' });
  assert.deepEqual([lock.answer.approved, lock.answer.by, lock.history.length], [false, 'client', 1]);
  const back = await s.getJob(ID, job.id);
  assert.deepEqual([back.stageId, back.waitingOnJax], ['lock', false]);
  await assert.rejects(s.sendBack(ID, job.id, 'build'), /earlier stage/);
  await assert.rejects(s.sendBack(ID, job.id, 'nope'), /earlier stage/);
  const reopened = await s.sendBack(ID, job.id, 'storyboard');
  assert.equal(reopened.stageId, 'storyboard');
  assert.deepEqual(reopened.stages.filter(st => st.status === 'done').map(st => st.id), ['brief', 'concept', 'plan', 'words']);
  const hero = (await s.getStoryboard(ID, job.id)).chapters[0];
  await s.makeStoryboardFrame(ID, job.id, { pageId: hero.pageId, chapterId: hero.chapterId });   // the frames are open again
  assert.equal((await s.completeStage(ID, job.id)).waitingOnJax, true, 'Storyboard waits on Jax again');
  await walkTo(s, job.id, 'lock');
  await s.completeStage(ID, job.id);
  assert.equal((await s.getDesignLock(ID, job.id)).sent.version, 2);
  lock = await s.answerDesign(ID, job.id, { approved: true, note: 'Looks great.' });
  assert.deepEqual(lock.history.map(h => [h.version, h.approved]), [[1, false], [2, true]]);
  assert.equal((await s.getJob(ID, job.id)).stageId, 'build');
});

test('the app\'s practice stand-in for Jax leaves Design lock for the client to answer', async () => {
  const { s, job } = await atLock(createSampleService({ simulateJaxMs: 5 }));
  await s.completeStage(ID, job.id);
  await new Promise(r => setTimeout(r, 30));
  assert.equal((await s.getJob(ID, job.id)).waitingOnJax, true);
  await s.answerDesign(ID, job.id, { approved: true });
  assert.equal((await s.getJob(ID, job.id)).stageId, 'build');
});

test('a missing piece stops the send; only Website Jobs have a Design lock', async () => {
  const { s, job } = await atLock();
  const frame = (await s.getDesignLock(ID, job.id)).bundle.pages[0].chapters[0].frame;
  await s.trashAsset(ID, frame);
  await assert.rejects(s.completeStage(ID, job.id), /isn't ready to lock: Home · Hero: Keep a storyboard frame/);
  const deck = await s.startJob(ID, 'pitch-deck', 'deck');
  await assert.rejects(s.getDesignLock(ID, deck.id), /Only Website Jobs/);
});

test('real sign-in: the client\'s answer is "Coming soon", no sample brand, and the lock comes back from the project folder', async () => {
  const folder = new Map(), file = 'Website - Studio save.json';
  const computer = () => {
    const local = createSampleService({ practice: false });
    const server = createServerService({ local,
      request: async (method, endpoint) => ({ success: true, data: /\/spaces\/sample-home$/.test(endpoint) ? { id: ID, name: 'Sample Home Services', dna: null } : [] }),
      readSave: async (spaceId, name) => (folder.has(name) ? { success: true, content: folder.get(name) } : { success: false, missing: true }),
      saveFile: async (spaceId, name, content) => { folder.set(name, content); return { success: true }; } });
    server.setProjects([{ id: ID, name: 'Sample Home Services' }]);
    return { local, server };
  };
  const a = computer(), { job } = await atLock(a.local);
  assert.notEqual((await a.server.getDesignLock(ID, job.id)).bundle.style.colors.accent, '#2bb3a3');
  await a.server.completeStage(ID, job.id);
  await assert.rejects(a.server.answerDesign(ID, job.id, { approved: true }), /Coming soon/);
  await a.local.answerDesign(ID, job.id, { approved: false, note: 'Bigger phone number.' });   // stands in for the server's link
  await a.server.sendBack(ID, job.id, 'look');
  const b = computer().server, lock = await b.getDesignLock(ID, job.id);
  assert.deepEqual([(await b.getJob(ID, job.id)).stageId, lock.sent.version, lock.answer.note], ['look', 1, 'Bigger phone number.']);
  const saved = JSON.parse(folder.get(file)), j = saved.jobs[0];
  j.design.answer.by = 'someone'; j.design.history.push({ version: 9, approved: 'yes', by: 'client' });
  saved.revision += 1; folder.set(file, JSON.stringify(saved));
  const c = await computer().server.getDesignLock(ID, job.id);
  assert.deepEqual([c.answer, c.history.length], [null, 1], 'answers that don\'t check out are dropped');
  j.design = undefined; j.templateVersion = 3; j.stageId = 'look'; saved.revision += 1; folder.set(file, JSON.stringify(saved));
  assert.ok(!(await computer().server.getJob(ID, job.id)).stages.some(st => st.id === 'lock'), 'a v3 Job keeps its stages');
});
