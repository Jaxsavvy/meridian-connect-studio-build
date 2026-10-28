'use strict';
// Core: Build runner part 2, the Job keeps the client site's PR link and preview link (#252). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkLinks } = require('../../src/renderer/studio/website/build-prompt.js');
const { createSampleService, createServerService } = require('../../src/renderer/studio/studio-service.js');
const { fillStory } = require('./helpers/website-story.cjs');

const ID = 'sample-home', REPO = 'site-sample-home-services';
const PR = `https://github.com/Jaxsavvy/${REPO}/pull/3`, PREVIEW = 'https://3-abc.site-sample-home-services.pages.dev';
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
  await assert.rejects(s.setBuildLinks(ID, job.id, { pr: PR }), /after the client approves the design/);
  await s.completeStage(ID, job.id);
  await s.answerDesign(ID, job.id, { approved: true });
  return { s, job };
}

test('checkLinks: only a PR in the client\'s repo, and only an https pages.dev preview', () => {
  assert.deepEqual(checkLinks({ pr: ` ${PR}/ `, preview: PREVIEW }, REPO), { pr: PR, preview: PREVIEW });
  assert.deepEqual(checkLinks({ pr: PR }, REPO), { pr: PR, preview: '' }, 'the preview can wait for Cloudflare');
  for (const pr of [`http://github.com/Jaxsavvy/${REPO}/pull/3`, `https://github.com/Someone/${REPO}/pull/3`, 'https://github.com/Jaxsavvy/site-other/pull/3',
    `https://github.com/Jaxsavvy/${REPO}/issues/3`, `https://github.com/Jaxsavvy/${REPO}/pull/0`, `https://github.com/Jaxsavvy/${REPO}/pull/3#x`, '']) {
    assert.throws(() => checkLinks({ pr }, REPO), /Paste the pull request link from Jaxsavvy\/site-sample-home-services/, pr);
  }
  for (const preview of ['http://x.pages.dev', 'https://pages.dev.example.com', 'https://user:pass@x.pages.dev', 'not a link', `https://${'a'.repeat(300)}.pages.dev`]) {
    assert.throws(() => checkLinks({ pr: PR, preview }, REPO), /must be an https:\/\/….pages.dev link/, preview);
  }
});

test('the Job keeps the links once the design is approved; a refused link changes nothing', async () => {
  const { s, job } = await approved();
  assert.equal((await s.getBuildKit(ID, job.id)).links, null);
  const events = []; s.on((e, d) => events.push([e, d.spaceId]));
  const links = await s.setBuildLinks(ID, job.id, { pr: PR, preview: PREVIEW });
  assert.deepEqual([links.pr, links.preview, typeof links.at], [PR, PREVIEW, 'string']);
  assert.deepEqual(events, [['jobs-changed', ID]]);
  await assert.rejects(s.setBuildLinks(ID, job.id, { pr: 'https://github.com/Jaxsavvy/site-other/pull/9' }), /Paste the pull request link/);
  assert.equal((await s.getBuildKit(ID, job.id)).links.pr, PR);
  const deck = await s.startJob(ID, 'pitch-deck', 'deck');
  await assert.rejects(s.setBuildLinks(ID, deck.id, { pr: PR }), /Only Website Jobs/);
});

test('real sign-in: the links are saved with the Website Job, and a bad saved link comes back empty', async () => {
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
  const a = computer(), { job } = await approved(a.local);
  await a.server.setBuildLinks(ID, job.id, { pr: PR });
  assert.equal((await computer().server.getBuildKit(ID, job.id)).links.pr, PR);
  const saved = JSON.parse(folder.get(file));
  saved.jobs[0].buildLinks.pr = 'https://github.com/Someone/site-sample-home-services/pull/3';
  saved.revision += 1; folder.set(file, JSON.stringify(saved));
  assert.equal((await computer().server.getBuildKit(ID, job.id)).links, null);
});
