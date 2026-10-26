'use strict';
// Core: Keep for built pages (#149): a kept page asset tagged with its Job and stage, versioned per stage.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService, createServerService } = require('../../src/renderer/studio/studio-service.js');

const HTML = '<!doctype html><html><body><h1>Riverdale</h1><footer>Concept for discussion, not affiliated with Riverdale Home Services</footer></body></html>';
const page = (name, html = HTML) => ({ name, html });
async function deck({ homePagesOpen = true } = {}) {
  const s = createSampleService();
  s.setProjects([{ id: 'riverdale', name: 'Riverdale Home Services' }]);
  const job = await s.startJob('riverdale', 'pitch-deck', 'deck');
  if (homePagesOpen) {   // Research + write done (practice deck passes the check): the three home pages open
    await s.useSampleResearch('riverdale', job.id);
    await s.completeStage('riverdale', job.id);
  }
  return { s, job };
}

test('Keep a built page: a kept page asset in its stage, listed with the Job', async () => {
  const { s, job } = await deck();
  let events = 0;
  const off = s.on(event => { if (event === 'assets-changed') events += 1; });
  const a = await s.savePageAsset('riverdale', job.id, 'home-t2', page('Home page Tier 2'));
  off();
  assert.equal(events, 1);
  assert.equal(a.kind, 'page'); assert.equal(a.kept, true); assert.equal(a.approved, false);
  assert.equal(a.name, 'Home page Tier 2__v1'); assert.equal(a.version, 1); assert.equal(a.parentId, null);
  assert.equal(a.jobId, job.id); assert.equal(a.stageId, 'home-t2'); assert.equal(a.html, HTML);
  assert.equal(a.createdBy, 'homepage-builder');
  assert.ok(a.url.startsWith('data:image/svg+xml'));   // thumbnail, so asset views still show something
  const byStage = await s.listJobAssets('riverdale', job.id);
  assert.deepEqual(byStage['home-t2'].map(x => x.id), [a.id]);
  assert.deepEqual(byStage['home-t1'], []);
  assert.ok((await s.listAssets('riverdale')).some(x => x.id === a.id));
});

test('keeping again in the same stage makes the next version; other stages start their own', async () => {
  const { s, job } = await deck();
  const v1 = await s.savePageAsset('riverdale', job.id, 'home-t1', page('Home page Tier 1'));
  const v2 = await s.savePageAsset('riverdale', job.id, 'home-t1', page('Home page Tier 1__v1', HTML.replace('Riverdale</h1>', 'Riverdale Plumbing</h1>')));
  assert.equal(v2.name, 'Home page Tier 1__v2'); assert.equal(v2.version, 2); assert.equal(v2.parentId, v1.id);
  assert.notEqual(v2.html, v1.html);
  assert.deepEqual((await s.listVersions('riverdale', v2.id)).map(x => x.version), [1, 2]);
  const t3 = await s.savePageAsset('riverdale', job.id, 'home-t3', page('Home page Tier 3'));
  assert.equal(t3.version, 1); assert.equal(t3.parentId, null);
});

test('only open stages take a page; name and html are checked', async () => {
  const early = await deck({ homePagesOpen: false });
  await assert.rejects(early.s.savePageAsset('riverdale', early.job.id, 'home-t1', page('Home page Tier 1')), /isn't open/);
  const { s, job } = await deck();
  const save = (stageId, p) => s.savePageAsset('riverdale', job.id, stageId, p);
  await assert.rejects(save('assemble', page('Board')), /isn't open/);
  await assert.rejects(save('nope', page('Board')), /isn't open/);
  await assert.rejects(s.savePageAsset('riverdale', 'job-404', 'home-t1', page('Home page Tier 1')), /Job not found/);
  await assert.rejects(save('home-t1', page('')), /plain name/);
  await assert.rejects(save('home-t1', page('Tier 1\nline two')), /plain name/);
  await assert.rejects(save('home-t1', page('x'.repeat(81))), /too long/);
  await assert.rejects(save('home-t1', page('Home page Tier 1', '   ')), /empty/);
  await assert.rejects(save('home-t1', { name: 'Home page Tier 1', html: 42 }), /empty/);
  await assert.rejects(save('home-t1', null), /plain name/);
  await assert.rejects(save('home-t1', page('Home page Tier 1', 'x'.repeat(5 * 1024 * 1024 + 1))), /5 MB/);
  await s.completeStage('riverdale', job.id, 'home-t1');
  await assert.rejects(save('home-t1', page('Home page Tier 1')), /isn't open/);   // finished stages are closed
  assert.equal((await s.listAssets('riverdale')).length, 0);
});

test('real mode: Keep for pages waits on the real server', async () => {
  const server = createServerService({ request: async () => ({ success: true, data: [] }) });
  server.setProjects([{ id: 'riverdale', name: 'Riverdale Home Services' }]);
  assert.throws(() => server.savePageAsset('riverdale', 'job-1', 'home-t1', page('Home page Tier 1')), /Coming soon/);
});
