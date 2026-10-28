'use strict';
// Core: the real site, part 2 (#260). Check on the preview link: Connect's results land in Check. Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService, createServerService } = require('../../src/renderer/studio/studio-service.js');
const { fillStory } = require('./helpers/website-story.cjs');

const ID = 'sample-home', REPO = 'site-sample-home-services';
const PR = `https://github.com/Jaxsavvy/${REPO}/pull/3`, PREVIEW = 'https://3-abc.site-sample-home-services.pages.dev';
async function atBuild(s) {   // the client approved the design: the Job is at Build
  s.setProjects([{ id: ID, name: 'Sample Home Services' }]);
  const job = await s.startJob(ID, 'website', 'standard');
  await fillStory(s, ID, job.id);
  for (let guard = 0; guard < 20 && (await s.getJob(ID, job.id)).stageId !== 'lock'; guard++) {
    if ((await s.getJob(ID, job.id)).waitingOnJax) await s.approveStage(ID, job.id); else await s.completeStage(ID, job.id);
  }
  await s.completeStage(ID, job.id);
  await s.answerDesign(ID, job.id, { approved: true });
  return job;
}
// Real sign-in on one computer; every computer shares the project folder. preview: what Connect's check answers.
function computer(folder, preview) {
  const local = createSampleService({ practice: false }), asked = [];
  const server = createServerService({ local,
    request: async (method, endpoint) => ({ success: true, data: /\/spaces\/sample-home$/.test(endpoint) ? { id: ID, name: 'Sample Home Services', dna: null } : [] }),
    readSave: async (spaceId, name) => (folder.has(name) ? { success: true, content: folder.get(name) } : { success: false, missing: true }),
    saveFile: async (spaceId, name, content) => { folder.set(name, content); return { success: true }; },
    checkPreview: async req => { asked.push(req); return preview(req); } });
  server.setProjects([{ id: ID, name: 'Sample Home Services' }]);
  return { local, server, asked };
}
const SEO = { check: 'seo', where: 'Home', message: 'The page has no description for Google.' };
const found = (flags = [SEO], ran = ['site-screenshots', 'links-open']) => async () => ({ success: true, flags, ran, shots: [] });
const checksOf = async (s, jobId) => (await s.getChecks(ID, jobId)).flags.map(f => [f.check, !!f.resolved]);

test('Build on the real site asks Connect to check the preview\'s pages; its flags and the look flag land in Check', async () => {
  const folder = new Map(), a = computer(folder, found()), job = await atBuild(a.local);
  await a.server.setBuildLinks(ID, job.id, { pr: PR, preview: PREVIEW });
  assert.deepEqual(a.asked, [], 'not before Check');
  assert.equal((await a.server.completeStage(ID, job.id)).stageId, 'check');
  assert.deepEqual(a.asked, [{ projectId: ID, preview: PREVIEW, name: job.name, pages: [{ path: '/', label: 'Home' }] }]);
  const checks = await a.server.getChecks(ID, job.id);
  assert.deepEqual(checks.flags.map(f => f.check), ['seo', 'look', 'pr']);
  assert.match(checks.flags[1].message, /Compare the screenshots of https:\/\/3-abc\.site-sample-home-services\.pages\.dev .* with the look frame/);
  assert.deepEqual(checks.notRun, []);
  for (const f of checks.flags) await a.server.resolveFlag(ID, job.id, f.id, 'Checked.');
  assert.equal((await a.server.completeStage(ID, job.id)).stageId, 'review');
  const back = computer(folder, found());
  assert.equal((await back.server.getJob(ID, job.id)).stageId, 'review', 'saved with the Job');
});

test('real sign-in: Check waits until Connect has checked the preview; flags explained once stay explained', async () => {
  let answer = async () => ({ success: false, error: 'offline' });
  const folder = new Map(), a = computer(folder, req => answer(req)), job = await atBuild(a.local);
  await a.server.setBuildLinks(ID, job.id, { pr: PR, preview: PREVIEW });
  await a.server.completeStage(ID, job.id);
  const [pr] = (await a.server.getChecks(ID, job.id)).flags;
  await a.server.resolveFlag(ID, job.id, pr.id, 'Green on GitHub.');
  assert.deepEqual((await a.server.getChecks(ID, job.id)).notRun, ['site-screenshots']);
  await assert.rejects(a.server.completeStage(ID, job.id), /Connect hasn't checked the preview yet\. Run the checks again/);
  answer = found();
  await a.server.runChecks(ID, job.id);
  const seo = (await a.server.getChecks(ID, job.id)).flags.find(f => f.check === 'seo');
  await a.server.resolveFlag(ID, job.id, seo.id, 'The client wants it blank for now.');
  await a.server.runChecks(ID, job.id);
  assert.deepEqual(await checksOf(a.server, job.id), [['seo', true], ['look', false], ['pr', true]]);
  const reload = computer(folder, found());
  assert.deepEqual(await checksOf(reload.server, job.id), [['seo', true], ['look', false], ['pr', true]], 'the save file keeps them');
  assert.deepEqual((await reload.server.getChecks(ID, job.id)).notRun, []);
});

test('a new preview link while Check is open is checked again: the look flag asks again, the rest is kept', async () => {
  const folder = new Map(), a = computer(folder, found()), job = await atBuild(a.local);
  await a.server.setBuildLinks(ID, job.id, { pr: PR, preview: PREVIEW });
  await a.server.completeStage(ID, job.id);
  for (const f of (await a.server.getChecks(ID, job.id)).flags) await a.server.resolveFlag(ID, job.id, f.id, 'Checked.');
  const next = 'https://4-def.site-sample-home-services.pages.dev';
  await a.server.setBuildLinks(ID, job.id, { pr: PR, preview: next });
  assert.equal(a.asked.at(-1).preview, next);
  const flags = (await a.server.getChecks(ID, job.id)).flags;
  assert.deepEqual(flags.map(f => [f.check, !!f.resolved]), [['seo', true], ['look', false], ['pr', true]]);
  assert.match(flags[1].message, /4-def/);
});

test('Sample sign-in: no Connect, so the screenshots stay "Not run yet" and don\'t block; only preview kinds are taken', async () => {
  const s = createSampleService(), job = await atBuild(s);
  assert.equal(await s.getPreviewPages(ID, job.id), null, 'not at Check yet');
  await s.setBuildLinks(ID, job.id, { pr: PR });
  await s.completeStage(ID, job.id);
  assert.equal(await s.getPreviewPages(ID, job.id), null, 'no preview link yet');
  await s.setBuildLinks(ID, job.id, { pr: PR, preview: PREVIEW });
  assert.deepEqual((await s.getPreviewPages(ID, job.id)).pages, [{ path: '/', label: 'Home' }]);
  s.addPreviewChecks(ID, job.id, { flags: [SEO, { check: 'pr', where: 'x', message: 'Forged' }, { check: 'deck', where: 'x', message: 'Forged' }], ran: [] });
  assert.deepEqual(await checksOf(s, job.id), [['seo', false], ['pr', false]], 'no look flag without screenshots');
  assert.deepEqual((await s.getChecks(ID, job.id)).notRun, ['site-screenshots']);
  for (const f of (await s.getChecks(ID, job.id)).flags) await s.resolveFlag(ID, job.id, f.id, 'Checked.');
  assert.equal((await s.completeStage(ID, job.id)).stageId, 'review');
  assert.equal(s.addPreviewChecks(ID, job.id, { flags: [SEO], ran: [] }), null, 'Check is done');
});
