'use strict';
// Core: the real site, part 3 (#263). Review on the preview link: comments on a page or chapter of the locked bundle. Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService, createServerService } = require('../../src/renderer/studio/studio-service.js');
const { fillStory, startSiteAtBuild } = require('./helpers/website-story.cjs');

const ID = 'sample-home', REPO = 'site-sample-home-services';
const PR = `https://github.com/Jaxsavvy/${REPO}/pull/3`, PREVIEW = 'https://3-abc.site-sample-home-services.pages.dev';
async function atBuild(s, { practiceSite = false } = {}) {   // the client approved the design: the Job is at Build
  s.setProjects([{ id: ID, name: 'Sample Home Services' }]);
  const job = await s.startJob(ID, 'website', 'standard');
  await fillStory(s, ID, job.id);
  for (let guard = 0; guard < 20 && (await s.getJob(ID, job.id)).stageId !== 'lock'; guard++) {
    if ((await s.getJob(ID, job.id)).waitingOnJax) await s.approveStage(ID, job.id); else await s.completeStage(ID, job.id);
  }
  await s.completeStage(ID, job.id);
  await s.answerDesign(ID, job.id, { approved: true });
  if (practiceSite) await startSiteAtBuild(s, ID, job.id);
  return job;
}
// Build and Check on the real site; for real sign-in, Connect's preview check is given by hand.
async function atReview(s, opts) {
  const job = await atBuild(s, opts);
  await s.setBuildLinks(ID, job.id, { pr: PR, preview: PREVIEW });
  await s.completeStage(ID, job.id);
  s.addPreviewChecks(ID, job.id, { flags: [], ran: ['site-screenshots', 'links-open'] });
  for (const f of (await s.getChecks(ID, job.id)).flags) await s.resolveFlag(ID, job.id, f.id, 'Checked.');
  assert.equal((await s.completeStage(ID, job.id)).stageId, 'review');
  return job;
}

test('Review on the real site: the preview\'s pages, comments on a page or a chapter, and the gate', async () => {
  const s = createSampleService({ practice: false }), job = await atReview(s);
  const review = await s.getReview(ID, job.id);
  assert.deepEqual(review.site, { preview: PREVIEW, pages: [{ id: 'home', name: 'Home', url: `${PREVIEW}/`, sections: [{ id: 'hero', name: 'Hero' }] }] });
  const hero = await s.addReviewComment(ID, job.id, { pageId: 'home', sectionId: 'hero', text: 'Make the call button bigger.' });
  assert.deepEqual([hero.where, hero.sectionId, hero.key, hero.source], ['Home · Hero', 'hero', null, 'team']);
  const page = await s.addReviewComment(ID, job.id, { pageId: 'home', text: 'The page feels long on a phone.' });
  assert.deepEqual([page.where, page.sectionId], ['Home', null]);
  await assert.rejects(s.addReviewComment(ID, job.id, { pageId: 'about', text: 'x' }), /That page isn't on the site/);
  await assert.rejects(s.addReviewComment(ID, job.id, { pageId: 'home', sectionId: 'footer', text: 'x' }), /That part of the site isn't on this page/);
  await assert.rejects(s.addReviewComment(ID, job.id, { pageId: 'home', sectionId: 'hero', text: '  ' }), /Write the comment first/);
  await assert.rejects(s.completeStage(ID, job.id), /2 comments need an answer/);
  await s.resolveReviewComment(ID, job.id, hero.id, { kind: 'fixed', note: 'Bigger button, pushed to the PR.' });
  await s.resolveReviewComment(ID, job.id, page.id, { kind: 'keep', note: 'The client wants every section.' });
  assert.equal((await s.completeStage(ID, job.id)).waitingOnJax, true, 'Review goes to Jax with no practice site');
});

test('the real site needs its preview link for Review, and its practice site can\'t change', async () => {
  const s = createSampleService(), job = await atReview(s, { practiceSite: true });
  await assert.rejects(s.saveSite(ID, job.id, (await s.getSite(ID, job.id))), /This site changes through its pull request/);
  await s.setBuildLinks(ID, job.id, { pr: PR });   // the preview link taken away
  assert.equal((await s.getReview(ID, job.id)).site, null);
  await assert.rejects(s.addReviewComment(ID, job.id, { pageId: 'home', text: 'x' }), /Paste the preview link on the Build kit first/);
});

test('openPreview opens a page of the preview in Connect\'s preview window, and only that', async () => {
  const opened = [];
  let answer = { success: true };
  const s = createSampleService({ openWindow: async (url, title) => { opened.push([url, title]); return answer; } }), job = await atReview(s);
  assert.deepEqual(await s.openPreview(ID, job.id, 'home'), { opened: `${PREVIEW}/` });
  assert.deepEqual(opened, [[`${PREVIEW}/`, 'Sample Home Services: Home']]);
  await assert.rejects(s.openPreview(ID, job.id, 'about'), /That page isn't on the site/);
  answer = { success: false, error: 'Not a web address' };
  await assert.rejects(s.openPreview(ID, job.id, 'home'), /couldn't open\. Copy the link/);
  const bare = createSampleService(), other = await atReview(bare);
  await assert.rejects(bare.openPreview(ID, other.id, 'home'), /Copy the link and open it in your browser/);
  const practiceSite = createSampleService({ openWindow: async () => ({ success: true }) }), plain = await atBuild(practiceSite, { practiceSite: true });
  await assert.rejects(practiceSite.openPreview(ID, plain.id, 'home'), /Paste the preview link/);
  assert.equal((await practiceSite.getReview(ID, plain.id)).site, null, 'the practice site keeps its own Review');
});

test('real sign-in: Review comments on the real site are saved with the Job, and the preview opens through Connect', async () => {
  const folder = new Map(), opened = [];
  const computer = () => {
    const local = createSampleService({ practice: false, openWindow: async url => { opened.push(url); return { success: true }; } });
    const server = createServerService({ local,
      request: async (method, endpoint) => ({ success: true, data: /\/spaces\/sample-home$/.test(endpoint) ? { id: ID, name: 'Sample Home Services', dna: null } : [] }),
      readSave: async (spaceId, name) => (folder.has(name) ? { success: true, content: folder.get(name) } : { success: false, missing: true }),
      saveFile: async (spaceId, name, content) => { folder.set(name, content); return { success: true }; } });
    server.setProjects([{ id: ID, name: 'Sample Home Services' }]);
    return { local, server };
  };
  const a = computer(), job = await atReview(a.local);
  await a.server.addReviewComment(ID, job.id, { pageId: 'home', text: 'Whole page: warmer photos.' });
  await a.server.addReviewComment(ID, job.id, { pageId: 'home', sectionId: 'hero', text: 'Shorter headline.' });
  const back = await computer().server.getReview(ID, job.id);
  assert.deepEqual(back.comments.map(c => [c.where, c.sectionId, c.text]), [['Home', null, 'Whole page: warmer photos.'], ['Home · Hero', 'hero', 'Shorter headline.']]);
  assert.equal(back.site.pages[0].url, `${PREVIEW}/`);
  await computer().server.openPreview(ID, job.id, 'home');
  assert.deepEqual(opened, [`${PREVIEW}/`]);
});
