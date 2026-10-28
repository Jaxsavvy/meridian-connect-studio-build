'use strict';
// Core: the real site (#267). During Review, saving the links checks the new preview again; new problems become comments. Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService, createServerService } = require('../../src/renderer/studio/studio-service.js');
const { fillStory } = require('./helpers/website-story.cjs');

const ID = 'sample-home', REPO = 'site-sample-home-services';
const PR = `https://github.com/Jaxsavvy/${REPO}/pull/3`, PREVIEW = 'https://3-abc.site-sample-home-services.pages.dev';
const FIX = 'https://4-def.site-sample-home-services.pages.dev';
const SEO = { check: 'seo', where: 'Home', message: 'The page has no description for Google.' };
async function atReview(s, links) {   // Build, Check and into Review on the real site; links: the Build kit's save
  s.setProjects([{ id: ID, name: 'Sample Home Services' }]);
  const job = await s.startJob(ID, 'website', 'standard');
  await fillStory(s, ID, job.id);
  for (let guard = 0; guard < 20 && (await s.getJob(ID, job.id)).stageId !== 'lock'; guard++) {
    if ((await s.getJob(ID, job.id)).waitingOnJax) await s.approveStage(ID, job.id); else await s.completeStage(ID, job.id);
  }
  await s.completeStage(ID, job.id);
  await s.answerDesign(ID, job.id, { approved: true });
  await links(job, { pr: PR, preview: PREVIEW });
  await s.completeStage(ID, job.id);
  if ((await s.getChecks(ID, job.id)).notRun.length) s.addPreviewChecks(ID, job.id, { flags: [], ran: ['site-screenshots', 'links-open'] });
  for (const f of (await s.getChecks(ID, job.id)).flags) await s.resolveFlag(ID, job.id, f.id, 'Checked.');
  assert.equal((await s.completeStage(ID, job.id)).stageId, 'review');
  return job;
}
// Real sign-in: the server service over a local one; preview() is what Connect's check answers.
function realSignIn(preview) {
  const folder = new Map(), asked = [];
  const local = createSampleService({ practice: false });
  const server = createServerService({ local,
    request: async (method, endpoint) => ({ success: true, data: /\/spaces\/sample-home$/.test(endpoint) ? { id: ID, name: 'Sample Home Services', dna: null } : [] }),
    readSave: async (spaceId, name) => (folder.has(name) ? { success: true, content: folder.get(name) } : { success: false, missing: true }),
    saveFile: async (spaceId, name, content) => { folder.set(name, content); return { success: true }; },
    checkPreview: async req => { asked.push(req.preview); return preview(); } });
  server.setProjects([{ id: ID, name: 'Sample Home Services' }]);
  return { local, server, asked };
}
const found = flags => async () => ({ success: true, flags, ran: ['site-screenshots', 'links-open'], shots: [] });
const checkComments = async (s, jobId) => (await s.getReview(ID, jobId)).comments.filter(c => c.source === 'check')
  .map(c => [c.text, c.where, c.resolved ? c.resolved.note : null]);

test('real sign-in: a fix\'s new preview is checked again; a new problem becomes a comment, a gone one answers itself', async () => {
  let preview = found([]);
  const r = realSignIn(() => preview()), job = await atReview(r.local, (j, links) => r.server.setBuildLinks(ID, j.id, links));
  preview = found([SEO]);
  await r.server.setBuildLinks(ID, job.id, { pr: PR, preview: FIX });
  assert.equal(r.asked.at(-1), FIX);
  assert.deepEqual(await checkComments(r.server, job.id), [['The automatic check found: The page has no description for Google.', 'Home', null]],
    'no look comment, and part 1\'s PR flag stays confirmed');
  await assert.rejects(r.server.completeStage(ID, job.id), /1 comment needs an answer/);
  const [comment] = (await r.server.getReview(ID, job.id)).comments;
  await assert.rejects(r.server.resolveReviewComment(ID, job.id, comment.id, { kind: 'fixed', note: 'Done' }), /fix it in the pull request and save the links again/);
  preview = found([]);
  await r.server.setBuildLinks(ID, job.id, { pr: PR, preview: FIX });   // the same links, saved again after the fix
  assert.deepEqual(await checkComments(r.server, job.id), [['The automatic check found: The page has no description for Google.', 'Home', 'The automatic check passes now.']]);
  assert.equal((await r.server.completeStage(ID, job.id)).waitingOnJax, true);
  const before = r.asked.length;
  await r.server.setBuildLinks(ID, job.id, { pr: PR, preview: PREVIEW });
  assert.equal(r.asked.length, before, 'nothing is checked while Review waits on Jax');
});

test('real sign-in: when Connect can\'t check the new preview, open comments stay open and Review waits', async () => {
  let preview = found([]);
  const r = realSignIn(() => preview()), job = await atReview(r.local, (j, links) => r.server.setBuildLinks(ID, j.id, links));
  preview = found([SEO]);
  await r.server.setBuildLinks(ID, job.id, { pr: PR, preview: FIX });
  preview = async () => ({ success: false, error: 'offline' });
  await r.server.setBuildLinks(ID, job.id, { pr: PR, preview: 'https://5-ghi.site-sample-home-services.pages.dev' });
  assert.deepEqual((await checkComments(r.server, job.id)).map(c => c[2]), [null], 'not answered by mistake');
  const [comment] = (await r.server.getReview(ID, job.id)).comments;
  await r.server.resolveReviewComment(ID, job.id, comment.id, { kind: 'keep', note: 'The client writes it next week.' });
  await assert.rejects(r.server.completeStage(ID, job.id), /Connect hasn't checked the latest preview yet/);
  preview = found([SEO]);
  await r.server.setBuildLinks(ID, job.id, { pr: PR, preview: FIX });
  assert.equal((await checkComments(r.server, job.id)).length, 1, 'a problem kept as is isn\'t asked again');
  assert.equal((await r.server.completeStage(ID, job.id)).waitingOnJax, true);
});

test('Sample sign-in: a new PR link during Review asks for its checks again; keep answers it for good', async () => {
  const s = createSampleService(), job = await atReview(s, (j, links) => s.setBuildLinks(ID, j.id, links));
  const next = `https://github.com/Jaxsavvy/${REPO}/pull/4`;
  await s.setBuildLinks(ID, job.id, { pr: next, preview: FIX });
  const [comment] = (await s.getReview(ID, job.id)).comments;
  assert.deepEqual([comment.source, comment.where], ['check', 'Pull request']);
  assert.match(comment.text, /open https:\/\/github\.com\/Jaxsavvy\/site-sample-home-services\/pull\/4 and confirm/);
  await s.resolveReviewComment(ID, job.id, comment.id, { kind: 'keep', note: 'Green on GitHub.' });
  await s.setBuildLinks(ID, job.id, { pr: next, preview: FIX });
  assert.equal((await s.getReview(ID, job.id)).comments.length, 1);
  assert.match((await s.getChecks(ID, job.id)).log.at(-1).note, /Green on GitHub/);
  assert.equal((await s.completeStage(ID, job.id)).waitingOnJax, true, 'no Connect in Sample sign-in, so no wait for it');
});
