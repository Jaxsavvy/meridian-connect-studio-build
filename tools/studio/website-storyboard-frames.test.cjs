'use strict';
// Core: storyboard frames, one ChatGPT frame per chapter, kept in order (#231). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { framePrompt, MAX_PROMPT } = require('../../src/renderer/studio/website/storyboard-frames.js');
const { createSampleService, createServerService } = require('../../src/renderer/studio/studio-service.js');
const { fillConcept } = require('./helpers/website-story.cjs');

const ID = 'sample-home';
const card = (id, name, headline) => ({ id, name, job: `Make the visitor trust the ${name.toLowerCase()}`,
  words: { headline, body: 'Licensed crews across the valley.', button: 'Call now' }, layout: 'hero-photo', motion: 'none', phone: 'Photo above the headline', shots: [] });
const STORY = { pages: [
  { id: 'home', name: 'Home', path: '/', purpose: 'Get estimate calls', chapters: [card('hero', 'Hero', 'Roofs done right'), card('proof', 'Proof', 'Crews you can check')] },
  { id: 'services', name: 'Services', path: '/services', purpose: 'List the work', chapters: [card('list', 'List', 'What we fix')] }] };
async function atStoryboard(s = createSampleService()) {
  s.setProjects([{ id: ID, name: 'Sample Home Services' }]);
  const job = await s.startJob(ID, 'website', 'standard');
  await s.completeStage(ID, job.id); await s.approveStage(ID, job.id);   // Kickoff
  await fillConcept(s, ID, job.id);
  await s.completeStage(ID, job.id); await s.approveStage(ID, job.id);   // Concept
  await s.saveStory(ID, job.id, STORY);
  await s.completeStage(ID, job.id); await s.completeStage(ID, job.id);   // Story and sitemap, Words
  return { s, job };
}
const at = (board, chapterId) => board.chapters.find(c => c.chapterId === chapterId);

test('framePrompt is one chapter: its job, words and layout, in the concept\'s mood', () => {
  const concept = { line: 'A roof that shrugs off the rain', mood: ['calm', 'sturdy'], audience: 'Homeowners' };
  const p = framePrompt(concept, STORY.pages[0], STORY.pages[0].chapters[0], { name: 'Sample Roofing', dna: { colors: ['#0b1f3a'] } });
  for (const want of ['"Sample Roofing"', '"Hero" section of the Home page', 'Make the visitor trust the hero', 'headline "Roofs done right"',
    'A roof that shrugs off the rain', 'Mood: calm, sturdy', '#0b1f3a', 'not the final design', 'no star ratings']) assert.ok(p.includes(want), want);
  assert.ok(!framePrompt(null, STORY.pages[0], STORY.pages[0].chapters[0], { name: 'x' }).includes('Brand colours'));
  const long = { ...STORY.pages[0].chapters[0], job: 'x'.repeat(5000) };
  assert.equal(framePrompt(concept, STORY.pages[0], long, { name: 'x' }).length, MAX_PROMPT);
  assert.throws(() => framePrompt(concept, STORY.pages[0], null), /Pick a chapter/);
});

test('the storyboard follows the cards\' order; frames are made, kept one per chapter, and listed at Storyboard', async () => {
  const { s, job } = await atStoryboard();
  let board = await s.getStoryboard(ID, job.id);
  assert.deepEqual(board.chapters.map(c => [c.pageName, c.chapterName]), [['Home', 'Hero'], ['Home', 'Proof'], ['Services', 'List']]);
  assert.deepEqual([board.kept, board.total], [0, 3]);
  const events = []; s.on((e, d) => { if (e === 'storyboard-changed') events.push(d.jobId); });
  await s.makeStoryboardFrame(ID, job.id, { pageId: 'home', chapterId: 'hero' });
  board = await s.makeStoryboardFrame(ID, job.id, { pageId: 'home', chapterId: 'hero' });
  const [a, b] = at(board, 'hero').frames;
  assert.equal(at(board, 'hero').keptId, null, 'nothing is kept until someone picks');
  const listed = (await s.listJobAssets(ID, job.id)).storyboard.map(x => x.id);
  assert.deepEqual(listed, [a.assetId, b.assetId]);
  await s.keepStoryboardFrame(ID, job.id, { pageId: 'home', chapterId: 'hero', frameId: a.id });
  board = await s.keepStoryboardFrame(ID, job.id, { pageId: 'home', chapterId: 'hero', frameId: b.id });
  assert.deepEqual([at(board, 'hero').keptId, board.kept], [b.id, 1]);
  assert.deepEqual(events, [job.id, job.id, job.id, job.id]);
  await assert.rejects(s.makeStoryboardFrame(ID, job.id, { pageId: 'home', chapterId: 'nope' }), /not on the cards/);
  await assert.rejects(s.keepStoryboardFrame(ID, job.id, { pageId: 'home', chapterId: 'proof', frameId: a.id }), /not on this chapter/);
  const story = await s.getStory(ID, job.id);   // reordering the cards reorders the strip; a removed chapter drops out
  story.pages[0].chapters = [story.pages[0].chapters[1]];
  story.pages.reverse(); story.pages[1].path = '/'; story.pages[0].path = '/services';
  await s.saveStory(ID, job.id, story);
  assert.deepEqual((await s.getStoryboard(ID, job.id)).chapters.map(c => c.chapterId), ['list', 'proof']);
});

test('Storyboard can\'t go to Jax until every chapter has a kept frame; then the frames lock', async () => {
  const { s, job } = await atStoryboard();
  const gaps = await s.getStoryGaps(ID, job.id, 'storyboard');
  assert.deepEqual(gaps.map(g => g.where), ['Home · Hero', 'Home · Proof', 'Services · List']);
  await assert.rejects(s.completeStage(ID, job.id), /Home · Hero: Keep a storyboard frame/);
  for (const c of (await s.getStoryboard(ID, job.id)).chapters) {
    const board = await s.makeStoryboardFrame(ID, job.id, { pageId: c.pageId, chapterId: c.chapterId });
    await s.keepStoryboardFrame(ID, job.id, { pageId: c.pageId, chapterId: c.chapterId, frameId: at(board, c.chapterId).frames[0].id });
  }
  assert.equal((await s.completeStage(ID, job.id)).waitingOnJax, true);
  await assert.rejects(s.makeStoryboardFrame(ID, job.id, { pageId: 'home', chapterId: 'hero' }), /locked once it goes to Jax/);
  assert.equal((await s.approveStage(ID, job.id)).stageId, 'look');
  const kept = at(await s.getStoryboard(ID, job.id), 'hero');
  await assert.rejects(s.keepStoryboardFrame(ID, job.id, { pageId: 'home', chapterId: 'hero', frameId: kept.keptId }), /locked/);
  assert.ok(!(await s.getStoryGaps(ID, job.id, 'look')).some(g => /storyboard frame/.test(g.message)), 'Look\'s gate never asks for frames');
  const deck = await s.startJob(ID, 'pitch-deck', 'deck');
  await assert.rejects(s.getStoryboard(ID, deck.id), /Only Website Jobs/);
});

test('real sign-in: making frames is "Coming soon", prompts never carry the sample brand, and kept frames come back from the project folder', async () => {
  const practice = await atStoryboard();
  assert.match(at(await practice.s.getStoryboard(ID, practice.job.id), 'hero').prompt, /#0b1f3a/);
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
  const a = computer(), { job } = await atStoryboard(a.local);
  await assert.rejects(a.server.makeStoryboardFrame(ID, job.id, { pageId: 'home', chapterId: 'hero' }), /Coming soon/);
  assert.doesNotMatch(at(await a.server.getStoryboard(ID, job.id), 'hero').prompt, /#0b1f3a|Brand colours/);
  const made = at(await a.local.makeStoryboardFrame(ID, job.id, { pageId: 'home', chapterId: 'hero' }), 'hero').frames[0];   // stands in for the server
  await a.server.keepStoryboardFrame(ID, job.id, { pageId: 'home', chapterId: 'hero', frameId: made.id });
  assert.equal(at(await computer().server.getStoryboard(ID, job.id), 'hero').keptId, made.id);
  const saved = JSON.parse(folder.get(file)), frames = saved.jobs[0].storyboard.frames;
  frames.push({ ...frames[0], id: 'frame-98' }, { ...frames[0], id: 'bad id!' }, { ...frames[0], id: 'frame-99', chapterId: '../x' });
  saved.revision += 1; folder.set(file, JSON.stringify(saved));
  const back = at(await computer().server.getStoryboard(ID, job.id), 'hero');
  assert.deepEqual([back.frames.map(f => f.id), back.keptId], [[made.id, 'frame-98'], made.id], 'bad frames are dropped; only one stays kept');
});
