'use strict';
// Core: the Website Check stage runner (#206). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const SiteCheck = require('../../src/renderer/studio/website/site-check.js');
const Library = require('../../src/renderer/studio/website/section-library.js');
const { createSampleService, createServerService } = require('../../src/renderer/studio/studio-service.js');
const { fillStory } = require('./helpers/website-story.cjs');

const ID = 'sample-home';
async function toBuild(s = createSampleService()) {
  s.setProjects([{ id: ID, name: 'Sample Home Services' }]);
  const job = await s.startJob(ID, 'website', 'standard');
  await s.completeStage(ID, job.id); await s.approveStage(ID, job.id);
  await fillStory(s, ID, job.id);
  await s.completeStage(ID, job.id); await s.completeStage(ID, job.id);
  await s.completeStage(ID, job.id); await s.approveStage(ID, job.id);
  await s.completeStage(ID, job.id);
  await s.completeStage(ID, job.id); await s.approveStage(ID, job.id);   // Design lock: Jax approves for the client (#238)
  return { s, job };
}
const el = (tag, attrs, ...children) => ({ tag, ...(attrs ? { attrs } : {}), ...(children.length ? { children } : {}) });
const page = (id, path, title, sections, extra = {}) => ({ id, path, title, sections, ...extra });
const sec = (id, tree) => ({ id, label: id, tree });
function site(pages, colors = {}) {
  return { version: 1, name: 'Sample Home Services', theme: { colors: { bg: '#faf9f6', text: '#14202e', accent: '#1f6fd6', 'on-accent': '#f8f7f3', light: '#f8f7f3', ...colors },
    fonts: { heading: 'Inter', body: 'Inter' } }, pages };
}
const messages = (s, opts) => SiteCheck.checkSite(s, opts).map(f => `${f.check}: ${f.message}`);

test('Build needs a site; the Check runs by itself and a clean site passes with nothing to review', async () => {
  const { s, job } = await toBuild();
  await assert.rejects(s.completeStage(ID, job.id), /Build the site first/);
  await s.startSite(ID, job.id, { from: 'cards' });
  assert.equal((await s.completeStage(ID, job.id)).stageId, 'check');
  const checks = await s.getChecks(ID, job.id);
  assert.ok(checks.ranAt);
  assert.deepEqual(checks.flags, []);
  assert.deepEqual(checks.notRun, ['phone-screenshot', 'links-open'], 'phone and live links run in Connect');
  assert.equal((await s.completeStage(ID, job.id)).stageId, 'review');
});

test('a flag blocks Check until a person explains it; it stays explained when the checks run again', async () => {
  const { s, job } = await toBuild();
  const { site: built } = await s.startSite(ID, job.id, { from: 'cards' });
  built.pages[0].description = 'D'.repeat(161);
  assert.equal((await s.saveSite(ID, job.id, built)).ok, true);
  await s.completeStage(ID, job.id);
  const [flag] = (await s.getChecks(ID, job.id)).flags;
  assert.equal(flag.check, 'seo');
  await assert.rejects(s.completeStage(ID, job.id), /1 flag to review/);
  await assert.rejects(s.resolveFlag(ID, job.id, flag.id, '  '), /Say why/);
  await s.resolveFlag(ID, job.id, flag.id, 'The client wants the long description.');
  assert.equal((await s.runChecks(ID, job.id))[0].resolved.note, 'The client wants the long description.');
  assert.equal((await s.completeStage(ID, job.id)).stageId, 'review');
  assert.equal((await s.getChecks(ID, job.id)).log.length, 1);
});

test('Google basics, accessibility, links inside the site and the speed estimate', () => {
  const home = page('home', '/', 'T'.repeat(61), [sec('hero', el('section', null,
    el('h1', null, { text: 'Roofs' }), el('h3', null, { text: 'Jump' }),
    el('img', { src: 'asset:a1', alt: '' }), el('img', { src: 'asset:a2', alt: '', 'aria-hidden': true }),
    el('a', { href: '/gone' }, { text: 'Gone' }), el('a', { href: '/services#nope' }, { text: 'Nope' }), el('a', { href: '#hero' }, { text: 'Top' }),
    el('a', { href: 'tel:+15415550100' }), ...Array.from({ length: 15 }, (_, i) => el('img', { src: `asset:b${i}`, alt: 'x', loading: 'lazy' }))))]);
  const services = page('services', '/services', 'Same', [sec('list', el('section', null, el('h2', null, { text: 'A' })))], { description: 'Services.' });
  const about = page('about', '/about', 'Same', [sec('two', el('section', null, el('h1', null, { text: 'A' }), el('h1', null, { text: 'B' })))], { description: 'About.' });
  const got = messages(site([home, services, about]), { sizes: { home: 200 * 1024 } });
  for (const want of [/^seo: The page title is 61 characters/, /^seo: Add a description/, /^seo: Same title as Same/, /^seo: This page has no main heading/,
    /^seo: This page has 2 main headings/, /^accessibility: Describe this image/, /^accessibility: The headings jump from level 1 to 3/,
    /^accessibility: This link has no words/, /^links: .*page that doesn't exist: \/gone/, /^links: .*section that isn't on that page: \/services#nope/,
    /^speed: This page is about 200 KB/, /^speed: This page has 17 images/, /^speed: 2 images load right away/]) {
    assert.ok(got.some(m => want.test(m)), `missing ${want}`);
  }
  assert.equal(got.filter(m => m.startsWith('accessibility: Describe')).length, 1, 'hidden images need no description');
  assert.ok(!got.some(m => /#hero/.test(m)), 'a link to a section on the same page is fine');
  assert.match(messages(site([page('home', '/', 'Home', [sec('a', el('h1', null, { text: 'x' }))], { description: 'd' })], { text: '#cccccc' })).join(), /Text on the page is hard to read/);
});

test('the assembler gives every page one main heading, keeping its look', () => {
  const story = { pages: [{ id: 'home', name: 'Home', path: '/', purpose: 'Calls', chapters: [{ id: 'hero', name: 'Hero', job: 'Calls', layout: 'hero-split',
    words: { headline: 'Roofs', body: 'B', button: 'Call' }, shots: [], proof: [] }] },
  { id: 'services', name: 'Services', path: '/services', purpose: 'List', chapters: [{ id: 'list', name: 'List', job: 'List', layout: 'process',
    words: { headline: 'How it works', body: 'One: first\nTwo: second', button: '' }, shots: [], proof: [] }] }] };
  const out = Library.assembleSite(story, { name: 'Sample Home Services' });
  assert.equal(out.ok, true);
  const h1s = p => JSON.stringify(p).match(/"tag":"h1"/g) || [];
  assert.deepEqual(out.site.pages.map(p => h1s(p).length), [1, 1]);
  assert.match(JSON.stringify(out.site.pages[1]), /"tag":"h1","attrs":\{"data-edit":"list-headline","class":"as-h2"\}/);
});

test('real sign-in: Connect checks every page on a phone and the outside links once, when Build finishes', async () => {
  const local = createSampleService({ practice: false });
  const { job } = await toBuild(local);
  const { site: built } = await local.startSite(ID, job.id, { from: 'cards' });
  built.pages.push({ id: 'about', path: '/about', title: 'About', description: 'About us.', sections: [JSON.parse(JSON.stringify(built.pages[0].sections[1]))] });
  built.pages[0].sections[1].tree.children.push({ tag: 'a', attrs: { href: 'https://example.com/reviews' }, children: [{ text: 'Reviews' }] });
  assert.equal((await local.saveSite(ID, job.id, built)).ok, true);
  const calls = [];
  const server = createServerService({ local, request: async () => ({ success: true, data: [] }), readSave: async () => ({ success: false, missing: true }),
    checkBoard: async req => { calls.push(req); return { success: true, ran: ['phone-screenshot', 'links-open'],
      flags: req.links.length ? [{ check: 'links-open', message: 'This link doesn\'t open: https://example.com/reviews', where: 'Home · Hero' }]
        : [{ check: 'phone', message: 'Something runs off the side on a phone.', where: 'board' }] }; } });
  await server.completeStage(ID, job.id);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(c => c.links.length), [1, 0], 'outside links are checked once');
  assert.ok(calls.every(c => /^<!doctype html>/.test(c.html) && !c.html.includes('meridian-select') && !c.html.includes('<script>')));
  assert.deepEqual(calls.map(c => c.fileName.replace(/^.* - /, '')), ['Site home on a phone.png', 'Site about on a phone.png']);
  const checks = await server.getChecks(ID, job.id);
  assert.deepEqual(checks.notRun, []);
  assert.deepEqual(checks.flags.map(f => [f.check, f.where]), [['links-open', 'Home · Hero'], ['phone', 'About']]);
});
