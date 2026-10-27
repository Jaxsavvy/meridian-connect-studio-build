'use strict';
// Core: the website builder service, preview script and edit helpers (#198). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../../src/renderer/studio/website/site-engine.js');
const Edit = require('../../src/renderer/studio/website/site-edit.js');
const { createSampleService, createServerService } = require('../../src/renderer/studio/studio-service.js');
const { fillStory } = require('./helpers/website-story.cjs');

const ID = 'sample-home';
async function toBuild(s = createSampleService()) {
  s.setProjects([{ id: ID, name: 'Sample Home Services' }, { id: 'other-home', name: 'Other Home Services' }]);
  const job = await s.startJob(ID, 'website', 'standard');
  await s.completeStage(ID, job.id); await s.approveStage(ID, job.id);   // Kickoff
  await fillStory(s, ID, job.id);
  await s.completeStage(ID, job.id); await s.completeStage(ID, job.id);   // Story and sitemap, Words
  await s.completeStage(ID, job.id); await s.approveStage(ID, job.id);   // Storyboard
  await s.completeStage(ID, job.id);                                      // Look and assets
  await s.completeStage(ID, job.id); await s.approveStage(ID, job.id);   // Design lock: Jax approves for the client (#238)
  return { s, job };
}

test('Build starts the site once, from the locked chapter cards', async () => {
  const s = createSampleService();
  s.setProjects([{ id: ID, name: 'Sample Home Services' }]);
  const early = await s.startJob(ID, 'website', 'standard');
  await assert.rejects(s.startSite(ID, early.id, { from: 'cards' }), /while Build is open/);
  const { job } = await toBuild(s);
  assert.equal(await s.getSite(ID, job.id), null);
  const events = []; s.on((e, d) => events.push([e, d.jobId]));
  await assert.rejects(s.startSite(ID, job.id, { from: 'pitch-deck' }), /chapter cards/);
  const out = await s.startSite(ID, job.id, { from: 'cards' });
  assert.equal(out.ok, true);
  assert.deepEqual(out.report, { custom: [], short: [] });
  assert.deepEqual(out.site.pages[0].sections.map(x => x.id), ['site-nav', 'hero']);
  assert.equal(out.site.concept, false);
  assert.deepEqual(events, [['site-changed', job.id]]);
  assert.deepEqual(await s.getSite(ID, job.id), out.site);
  await assert.rejects(s.startSite(ID, job.id, { from: 'cards' }), /already started/);
});

test('saving refuses anything the engine refuses, and images from another Space', async () => {
  const { s, job } = await toBuild();
  const { site } = await s.startSite(ID, job.id, { from: 'cards' });
  const hostile = JSON.parse(JSON.stringify(site));
  hostile.pages[0].sections[1].tree.children.push({ tag: 'script', children: [{ text: 'alert(1)' }] });
  assert.equal((await s.saveSite(ID, job.id, hostile)).ok, false);
  const other = (await s.generateImage({ spaceId: 'other-home', description: 'Synthetic photo', count: 1 })).results[0].assetId;
  const foreign = JSON.parse(JSON.stringify(site));
  foreign.pages[0].sections[1].tree.children.push({ tag: 'img', attrs: { src: `asset:${other}`, alt: 'x' } });
  assert.match((await s.saveSite(ID, job.id, foreign)).errors[0].message, /not in this Space/);
  const edited = Edit.setText(site, 'home', 'hero-headline', 'Roofs, done right');
  assert.equal((await s.saveSite(ID, job.id, edited.site)).ok, true);
  assert.equal(Edit.editableList(await s.getSite(ID, job.id), 'home').find(x => x.key === 'hero-headline').text, 'Roofs, done right');
});

test('the preview reports clicks, shows unsaved drafts without saving them, and never shows another Space\'s images', async () => {
  const { s, job } = await toBuild();
  const { site } = await s.startSite(ID, job.id, { from: 'cards' });
  const { html } = await s.previewPage(ID, job.id, 'home');
  assert.ok(html.includes(Engine.SCRIPTS.preview), 'preview script added');
  assert.match(html, /<img[^>]+src="data:image\/svg\+xml/, 'this Space\'s kept image resolves');
  const other = (await s.generateImage({ spaceId: 'other-home', description: 'Synthetic photo', count: 1 })).results[0].assetId;
  const draft = JSON.parse(JSON.stringify(site));
  draft.pages[0].sections[1].tree.children.push({ tag: 'img', attrs: { src: `asset:${other}`, alt: 'Other' } });
  assert.match((await s.previewPage(ID, job.id, 'home', { site: draft })).html, /<img alt="Other">/);
  assert.deepEqual(await s.getSite(ID, job.id), site, 'a previewed draft is not saved');
});

test('Finish saves site.json and one file per page, with no preview script', async () => {
  const { s, job } = await toBuild();
  await s.startSite(ID, job.id, { from: 'cards' });
  const out = await s.finishSite(ID, job.id);
  assert.deepEqual(out.failed, []);
  assert.deepEqual(out.saved.map(n => n.replace(/^.* - (?=site\.json|Site - )/, '')), ['site.json', 'Site - home.html']);
  const files = await s.getSiteFiles(ID, job.id);
  assert.ok(files.every(f => !f.content.includes('meridian-select')));
  assert.equal(JSON.parse(files[0].content).name, 'Sample Home Services');
  assert.equal((await s.completeStage(ID, job.id, 'build')).stageId, 'check');
  await assert.rejects(s.finishSite(ID, job.id), /while Build is open/);
});

test('edit helpers never change their input, keep the navigation first, and keep home', async () => {
  const { s, job } = await toBuild();
  const { site } = await s.startSite(ID, job.id, { from: 'cards' });
  const before = JSON.stringify(site);
  assert.deepEqual(Edit.editableList(site, 'home').map(x => x.key).slice(0, 2), ['site-name', 'hero-headline']);
  assert.equal(Edit.setText(site, 'home', 'hero-headline', '  ').ok, false);
  assert.equal(Edit.setText(site, 'home', 'hero-img1', 'x').ok, false, 'images have no words to edit');
  assert.equal(Edit.moveSection(site, 'home', 'hero', -1).ok, false, 'nothing moves above the navigation');
  assert.equal(Edit.removeSection(site, 'home', 'site-nav').ok, false);
  assert.equal(Edit.removeSection(site, 'home', 'hero').ok, false, 'a page keeps one section');
  assert.equal(Edit.setPageInfo(site, 'home', { title: 'T'.repeat(121) }).ok, false);
  assert.equal(Edit.setPageInfo(site, 'home', { title: 'Home', description: '' }).site.pages[0].description, undefined);
  assert.equal(Edit.removePage(site, 'home').ok, false);
  const two = JSON.parse(JSON.stringify(site));
  two.pages.push({ id: 'services', path: '/services', title: 'Services', sections: [JSON.parse(JSON.stringify(site.pages[0].sections[1]))] });
  two.pages[0].sections[0].tree.children[0].children.push({ tag: 'a', attrs: { href: '/services' }, children: [{ text: 'Services' }] });
  assert.equal(Edit.moveSection(two, 'home', 'site-nav', 1).ok, false, 'the navigation stays first');
  const gone = Edit.removePage(two, 'services');
  assert.equal(gone.ok, true);
  assert.equal(gone.site.pages.length, 1);
  assert.doesNotMatch(JSON.stringify(gone.site), /"href":"\/services"/, 'links to the removed page go too');
  assert.equal(JSON.stringify(site), before);
});

test('real sign-in starts from the project\'s real DNA (never the sample) and Finish saves through Connect', async () => {
  const written = [], local = createSampleService({ practice: false });
  const { job } = await toBuild(local);   // only Jax approves in real sign-in, so the stages are walked underneath
  const server = createServerService({ local,
    request: async (method, endpoint) => ({ success: true, data: /\/spaces\/sample-home$/.test(endpoint) ? { id: ID, name: 'Sample Home Services', dna: null } : [] }),
    saveFile: async (spaceId, name) => { written.push(name); return { success: true }; },
    readSave: async () => ({ success: false, missing: true }),
  });
  const { site } = await server.startSite(ID, job.id, { from: 'cards' });
  assert.notEqual(site.theme.colors.text, '#0b1f3a', 'the sample DNA colour is not used');
  const out = await server.finishSite(ID, job.id);
  assert.deepEqual(out.failed, []);
  assert.ok(written.some(n => n.endsWith(' - site.json')) && written.some(n => n.endsWith(' - Site - home.html')));
});
