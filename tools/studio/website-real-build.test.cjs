'use strict';
// Core: the real site, part 1 (#256). Build finishes on the site's PR link; Check starts on the real site. Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService, createServerService } = require('../../src/renderer/studio/studio-service.js');
const { fillStory, startSiteAtBuild } = require('./helpers/website-story.cjs');

const ID = 'sample-home', REPO = 'site-sample-home-services';
const PR = `https://github.com/Jaxsavvy/${REPO}/pull/3`, PREVIEW = 'https://3-abc.site-sample-home-services.pages.dev';
async function atBuild(s = createSampleService()) {   // the client approved the design: the Job is at Build
  s.setProjects([{ id: ID, name: 'Sample Home Services' }]);
  const job = await s.startJob(ID, 'website', 'standard');
  await fillStory(s, ID, job.id);
  for (let guard = 0; guard < 20 && (await s.getJob(ID, job.id)).stageId !== 'lock'; guard++) {
    if ((await s.getJob(ID, job.id)).waitingOnJax) await s.approveStage(ID, job.id); else await s.completeStage(ID, job.id);
  }
  await s.completeStage(ID, job.id);
  await s.answerDesign(ID, job.id, { approved: true });
  assert.equal((await s.getJob(ID, job.id)).stageId, 'build');
  return { s, job };
}
const flagsOf = async (s, jobId) => (await s.getChecks(ID, jobId)).flags;

test('real sign-in: Build finishes on the PR link; Check starts on the real site, not the site engine', async () => {
  const { s, job } = await atBuild(createSampleService({ practice: false }));
  assert.equal((await s.getJob(ID, job.id)).realSite, false);
  await assert.rejects(s.completeStage(ID, job.id), /Build the site first: paste its pull request link on the Build kit/);
  await s.setBuildLinks(ID, job.id, { pr: PR });
  assert.equal((await s.getJob(ID, job.id)).realSite, true);
  const after = await s.completeStage(ID, job.id);
  assert.deepEqual([after.stageId, after.realSite], ['check', true]);
  const checks = await s.getChecks(ID, job.id);
  assert.deepEqual(checks.flags.map(f => f.check), ['pr', 'preview'], 'no site engine checks');
  assert.match(checks.flags[0].message, new RegExp(`open ${PR.replace(/[.]/g, '\\.')} and confirm they passed`));
  assert.deepEqual(checks.notRun, ['site-screenshots']);
  const build = after.stages.find(st => st.id === 'build');
  assert.match(build.goal, /Claude Code builds the site from the build kit/);
  assert.deepEqual(build.needs, ['Pull request link', 'Preview link']);
});

test('the preview flag clears only with the link; a new PR link needs confirming again', async () => {
  const { s, job } = await atBuild(createSampleService({ practice: false }));
  await s.setBuildLinks(ID, job.id, { pr: PR });
  await s.completeStage(ID, job.id);
  const [pr, preview] = await flagsOf(s, job.id);
  await assert.rejects(s.resolveFlag(ID, job.id, preview.id, 'Cloudflare later'), /this flag clears by itself/);
  await s.resolveFlag(ID, job.id, pr.id, 'Build and size budget are green on GitHub.');
  await assert.rejects(s.completeStage(ID, job.id), /1 flag to review/);
  await s.setBuildLinks(ID, job.id, { pr: PR, preview: PREVIEW });
  assert.deepEqual((await flagsOf(s, job.id)).map(f => [f.id, !!f.resolved]), [[pr.id, true]], 'same PR: still confirmed');
  await s.setBuildLinks(ID, job.id, { pr: `https://github.com/Jaxsavvy/${REPO}/pull/4`, preview: PREVIEW });
  const fresh = await flagsOf(s, job.id);
  assert.equal(fresh.length, 1); assert.notEqual(fresh[0].id, pr.id); assert.equal(fresh[0].resolved, null);
  assert.equal((await s.runChecks(ID, job.id)).length, 1, 'running again finds the same flag');
  await s.resolveFlag(ID, job.id, fresh[0].id, 'Green after the fix.');
  assert.equal((await s.getChecks(ID, job.id)).log.length, 2);
  assert.equal((await s.completeStage(ID, job.id)).stageId, 'review');
});

test('practice: without a PR link the practice site path is unchanged, and it never takes links afterwards', async () => {
  const { s, job } = await atBuild();
  await assert.rejects(s.completeStage(ID, job.id), /Build the site first: paste its pull request link on the Build kit, or start the practice site/);
  await startSiteAtBuild(s, ID, job.id);
  const after = await s.completeStage(ID, job.id);
  assert.deepEqual([after.stageId, after.realSite], ['check', false]);
  assert.deepEqual((await s.getChecks(ID, job.id)).notRun, ['phone-screenshot', 'links-open']);
  await assert.rejects(s.setBuildLinks(ID, job.id, { pr: PR }), /built as a practice site/);
  assert.equal((await s.getJob(ID, job.id)).realSite, false);
});

test('practice with a PR link: the real site wins, even with a practice site started', async () => {
  const { s, job } = await atBuild();
  await startSiteAtBuild(s, ID, job.id);
  await s.setBuildLinks(ID, job.id, { pr: PR, preview: PREVIEW });
  await s.completeStage(ID, job.id);
  assert.deepEqual((await flagsOf(s, job.id)).map(f => f.check), ['pr']);
  assert.equal(s.addBoardChecks(ID, job.id, { flags: [{ check: 'phone', message: 'Too wide', where: 'Home' }], ran: ['phone-screenshot'] }), null,
    'the old phone check never lands on the real site');
});

test('real sign-in: the real site\'s checks are saved with the Job, and the old phone check is skipped', async () => {
  const folder = new Map(), boardRuns = [];
  const computer = () => {
    const local = createSampleService({ practice: false });
    const server = createServerService({ local,
      request: async (method, endpoint) => ({ success: true, data: /\/spaces\/sample-home$/.test(endpoint) ? { id: ID, name: 'Sample Home Services', dna: null } : [] }),
      readSave: async (spaceId, name) => (folder.has(name) ? { success: true, content: folder.get(name) } : { success: false, missing: true }),
      saveFile: async (spaceId, name, content) => { folder.set(name, content); return { success: true }; },
      checkBoard: async req => { boardRuns.push(req); return { success: true, flags: [], ran: ['phone-screenshot', 'links-open'] }; } });
    server.setProjects([{ id: ID, name: 'Sample Home Services' }]);
    return { local, server };
  };
  const a = computer(), { job } = await atBuild(a.local);
  assert.equal((await a.server.startSite(ID, job.id, { from: 'cards' })).ok, true);   // a practice site too: still skipped
  await a.server.setBuildLinks(ID, job.id, { pr: PR });
  assert.equal((await a.server.completeStage(ID, job.id)).stageId, 'check');
  const [pr] = await a.server.runChecks(ID, job.id);
  await a.server.resolveFlag(ID, job.id, pr.id, 'Green on GitHub.');
  assert.deepEqual(boardRuns, []);
  const back = await computer().server.getChecks(ID, job.id);
  assert.deepEqual(back.flags.map(f => [f.check, !!f.resolved]), [['pr', true], ['preview', false]]);
  assert.deepEqual(back.notRun, ['site-screenshots']);
  assert.equal((await computer().server.getJob(ID, job.id)).realSite, true);
});
