'use strict';
// Core: real Website Jobs are kept in the project folder, like pitch decks (#226). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createSampleService, createServerService } = require('../../src/renderer/studio/studio-service.js');
const { fillStory } = require('./helpers/website-story.cjs');

const ID = 'sample-home', SITE_FILE = 'Website - Studio save.json', DECK_FILE = 'Pitch deck - Studio save.json';
function setup() {
  const folder = new Map();   // the project's Docs folder in Team Hub
  const computer = () => {
    const local = createSampleService({ practice: false });
    const server = createServerService({ local,
      request: async (method, endpoint) => ({ success: true, data: /\/spaces\/sample-home$/.test(endpoint) ? { id: ID, name: 'Sample Home Services', dna: null } : [] }),
      readSave: async (spaceId, name) => (folder.has(`${spaceId}/${name}`) ? { success: true, content: folder.get(`${spaceId}/${name}`) } : { success: false, missing: true }),
      saveFile: async (spaceId, name, content) => { folder.set(`${spaceId}/${name}`, content); return { success: true }; } });
    server.setProjects([{ id: ID, name: 'Sample Home Services' }]);
    return { local, server };
  };
  return { folder, computer };
}
// Walks a Website Job to Build on one computer (Jax's approvals happen underneath; only he approves in real sign-in).
async function toBuild(pc) {
  const job = await pc.server.startJob(ID, 'website', 'standard');
  await pc.local.completeStage(ID, job.id); await pc.local.approveStage(ID, job.id);
  await fillStory(pc.local, ID, job.id);
  await pc.local.completeStage(ID, job.id); await pc.local.completeStage(ID, job.id);
  await pc.local.completeStage(ID, job.id); await pc.local.approveStage(ID, job.id);
  await pc.local.completeStage(ID, job.id);
  await pc.local.completeStage(ID, job.id); await pc.local.approveStage(ID, job.id);   // Design lock (#238)
  return job;
}

test('a real Website Job survives a restart: cards, look, site and review come back from the project folder', async () => {
  const { folder, computer } = setup();
  folder.set(`${ID}/${DECK_FILE}`, JSON.stringify({ version: 1, revision: 7, jobs: [] }));
  const a = computer(), job = await toBuild(a);
  const { site } = await a.server.startSite(ID, job.id, { from: 'cards' });
  await a.server.completeStage(ID, job.id); await a.server.completeStage(ID, job.id);   // Build, Check -> Review
  await a.server.addReviewComment(ID, job.id, { pageId: 'home', sectionId: 'hero', key: 'hero-headline', text: 'Say "free estimate".' });
  const b = computer();   // Connect restarted, or Tyler's computer
  const back = await b.server.getJob(ID, job.id);
  assert.equal(back.stageId, 'review');
  assert.deepEqual(await b.server.getSite(ID, job.id), site);
  assert.deepEqual(await b.server.getStory(ID, job.id), await a.server.getStory(ID, job.id));
  assert.equal((await b.server.getLook(ID, job.id)).chosenId, (await a.server.getLook(ID, job.id)).chosenId);
  assert.equal((await b.server.getReview(ID, job.id)).comments[0].text, 'Say "free estimate".');
  assert.equal(JSON.parse(folder.get(`${ID}/${DECK_FILE}`)).revision, 7, 'Website changes never touch the pitch deck file');
});

test('a newer save from someone else is picked up, and a change made over it is refused with their version loaded', async () => {
  const { computer } = setup();
  const a = computer(), job = await toBuild(a);
  await a.server.startSite(ID, job.id, { from: 'cards' });
  await a.server.completeStage(ID, job.id); await a.server.completeStage(ID, job.id);
  const b = computer();
  await b.server.listJobs(ID);
  const c = await a.server.addReviewComment(ID, job.id, { pageId: 'home', sectionId: 'hero', text: 'Bigger photo' });
  await b.server.listJobs(ID);   // listing picks up the newer save
  assert.equal((await b.server.getReview(ID, job.id)).open, 1);
  await a.server.resolveReviewComment(ID, job.id, c.id, { kind: 'keep', note: 'The client likes it.' });
  await assert.rejects(b.server.addReviewComment(ID, job.id, { pageId: 'home', sectionId: 'hero', text: 'Late' }), /Someone else saved this website/);
  const review = await b.server.getReview(ID, job.id);
  assert.deepEqual([review.open, review.comments.length], [0, 1], 'their version is loaded; the refused comment is not kept');
});

test('nothing in the save file is trusted as-is: a bad site, comment or look frame comes back empty', async () => {
  const { folder, computer } = setup();
  const a = computer(), job = await toBuild(a);
  await a.server.startSite(ID, job.id, { from: 'cards' });
  await a.server.completeStage(ID, job.id); await a.server.completeStage(ID, job.id);
  await a.server.addReviewComment(ID, job.id, { pageId: 'home', sectionId: 'hero', text: 'Keep me' });
  const saved = JSON.parse(folder.get(`${ID}/${SITE_FILE}`));
  const j = saved.jobs[0];
  j.site.pages[0].sections[1].tree.children.push({ tag: 'script', children: [{ text: 'alert(1)' }] });
  j.review.comments.push({ id: 'comment-99', text: '' }, { id: 'bad id!', text: 'x' });
  j.look.frames.forEach(f => { f.direction = 'neon'; });
  saved.revision += 1;
  folder.set(`${ID}/${SITE_FILE}`, JSON.stringify(saved));
  const c = computer();
  await c.server.getJob(ID, job.id);
  assert.equal(await c.server.getSite(ID, job.id), null);
  assert.deepEqual((await c.server.getReview(ID, job.id)).comments.map(x => x.text), ['Keep me']);
  assert.equal((await c.server.getLook(ID, job.id)).chosenId, null);
  assert.ok((await c.server.getStory(ID, job.id)).pages.length, 'the parts that check out still come back');
});

test('Connect reads only Studio\'s two save files', () => {
  const main = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
  assert.match(main, /const STUDIO_SAVES = \['Pitch deck - Studio save\.json', 'Website - Studio save\.json'\];/);
  assert.match(main, /if \(!STUDIO_SAVES\.includes\(name\)\) return \{ success: false/);
});
