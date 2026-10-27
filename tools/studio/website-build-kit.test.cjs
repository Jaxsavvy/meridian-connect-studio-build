'use strict';
// Core: Build runner part 1, the build kit: approved bundle + Claude Code prompt, saved to the project folder (#246). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { repoName, buildPrompt, KIT } = require('../../src/renderer/studio/website/build-prompt.js');
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
async function approved(s = createSampleService()) {   // the client approved the design: the Job is at Build
  s.setProjects([{ id: ID, name: 'Sample Home Services' }]);
  const job = await s.startJob(ID, 'website', 'standard');
  await fillStory(s, ID, job.id);
  await walkTo(s, job.id, 'lock');
  await assert.rejects(s.getBuildKit(ID, job.id), /once the client approves the design/);
  await s.completeStage(ID, job.id);
  await s.answerDesign(ID, job.id, { approved: true, note: 'Looks right.' });
  return { s, job };
}

test('repoName and buildPrompt: the repo comes from the kit, pages build in order, and nothing is published', () => {
  assert.equal(repoName('Sample Roofing Co.'), 'site-sample-roofing-co');
  assert.equal(repoName('!!!'), 'site-client');
  assert.match(repoName(`A ${'b'.repeat(60)}`), /^site-a-b+$/);
  assert.ok(repoName(`A ${'b'.repeat(60)}`).length <= 45);
  const bundle = { business: { name: 'Sample Roofing Co' }, pages: [
    { name: 'Home', path: '/', chapters: [{ layout: 'hero-photo' }, { layout: 'services' }] }, { name: 'About', path: '/about', chapters: [{ layout: 'why-us' }] }] };
  const p = buildPrompt(bundle, { bundleFile: 'Website v1 - site bundle.json', images: [{ id: 'asset-7', use: 'look frame' }], version: 2 });
  for (const want of [`gh repo create Jaxsavvy/site-sample-roofing-co --private --template ${KIT} --clone`, 'design version 2',
    '"Website v1 - site bundle.json"', 'Home (/): hero-photo, services | About (/about): why-us', 'asset-7: look frame',
    'Do not publish or deploy', 'Never invent words, numbers, reviews or prices']) assert.ok(p.includes(want), want);
});

test('the kit is the approved bundle with every image it uses, and saving puts two files in the project folder', async () => {
  const { s, job } = await approved();
  const kit = await s.getBuildKit(ID, job.id), lock = await s.getDesignLock(ID, job.id);
  assert.equal(kit.repo, 'site-sample-home-services');
  assert.deepEqual(kit.bundle, lock.bundle, 'the frozen bundle the client approved');
  assert.deepEqual(kit.images.map(i => i.id), kit.bundle.assets);
  assert.deepEqual(kit.images.map(i => i.use.split(',')[0]), ['look frame', 'storyboard frame', 'photo']);   // the bundle's order
  assert.deepEqual([kit.files.map(f => f.name), kit.saved], [['site bundle.json', 'build prompt.md'], null]);
  const file = JSON.parse(kit.files[0].content);
  assert.deepEqual([file.format, file.design.version, file.design.approvedBy, file.images.length], ['meridian-site-bundle', 1, 'client', 3]);
  const out = await s.saveBuildKit(ID, job.id);
  assert.deepEqual(out, { saved: [`${job.name} - site bundle.json`, `${job.name} - build prompt.md`], failed: [] });
  assert.ok((await s.listProjectFiles(ID)).some(f => f.name === `${job.name} - build prompt.md`));
  assert.equal((await s.getBuildKit(ID, job.id)).saved.version, 1);
  assert.deepEqual((await s.getWorkflow('website')).stages.find(st => st.id === 'build').tools, ['website', 'build-kit']);
  const deck = await s.startJob(ID, 'pitch-deck', 'deck');
  await assert.rejects(s.getBuildKit(ID, deck.id), /Only Website Jobs/);
});

test('real sign-in: Connect saves the kit; a failed save records nothing; the record comes back from the project folder', async () => {
  const folder = new Map(); let failKit = true;
  const computer = () => {
    const local = createSampleService({ practice: false });
    const server = createServerService({ local,
      request: async (method, endpoint) => ({ success: true, data: /\/spaces\/sample-home$/.test(endpoint) ? { id: ID, name: 'Sample Home Services', dna: null } : [] }),
      readSave: async (spaceId, name) => (folder.has(name) ? { success: true, content: folder.get(name) } : { success: false, missing: true }),
      saveFile: async (spaceId, name, content) => {
        if (failKit && / - build prompt\.md$/.test(name)) return { success: false, error: 'Disk full' };
        folder.set(name, content); return { success: true };
      } });
    server.setProjects([{ id: ID, name: 'Sample Home Services' }]);
    return { local, server };
  };
  const a = computer(), { job } = await approved(a.local);
  assert.doesNotMatch((await a.server.getBuildKit(ID, job.id)).files[0].content, /#2bb3a3/, 'never the sample brand');
  const first = await a.server.saveBuildKit(ID, job.id);
  assert.deepEqual(first.failed.map(f => f.error), ['Disk full']);
  assert.equal((await a.server.getBuildKit(ID, job.id)).saved, null);
  failKit = false;
  assert.deepEqual((await a.server.saveBuildKit(ID, job.id)).failed, []);
  assert.match(folder.get(`${job.name} - build prompt.md`), /gh repo create Jaxsavvy\/site-sample-home-services/);
  assert.equal((await computer().server.getBuildKit(ID, job.id)).saved.version, 1);
  const file = 'Website - Studio save.json', saved = JSON.parse(folder.get(file));
  saved.jobs[0].buildKit = { version: 'one' }; saved.revision += 1; folder.set(file, JSON.stringify(saved));
  assert.equal((await computer().server.getBuildKit(ID, job.id)).saved, null, 'a record that doesn\'t check out is dropped');
});
