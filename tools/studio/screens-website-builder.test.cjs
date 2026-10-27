'use strict';
// Tyler 24: Website builder, part 1: start the site and preview it (#199). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { fillStory } = require('./helpers/website-story.cjs');
const { mountCanvas } = require('../../src/renderer/studio/screens/website-builder.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
const settle = async () => { for (let i = 0; i < 10; i++) await tick(); };
function dom() {
  const doc = { createElement(tag) { return { tag, ownerDocument: doc, children: [], attrs: {}, events: {},
    setAttribute(k, v) { this.attrs[k] = v; }, append(...items) { this.children.push(...items); },
    appendChild(item) { this.append(item); }, replaceChildren(...items) { this.children = items; },
    addEventListener(k, fn) { this.events[k] = fn; }, removeEventListener(k, fn) { if (this.events[k] === fn) delete this.events[k]; },
    remove() {}, click() { if (!this.disabled) this.events.click?.(); } }; } };
  return doc.createElement('div');
}
const walk = el => [el, ...el.children.flatMap(walk)];
const text = el => (el.textContent || '') + el.children.map(text).join('');
const btn = (el, label) => walk(el).find(n => n.tag === 'button' && text(n) === label);
const frame = el => walk(el).find(n => n.tag === 'iframe');
async function atBuild({ pages = false } = {}) {
  const service = createSampleService(), job = await service.startJob('sample-client', 'website', 'standard');
  await fillStory(service, job.spaceId, job.id);
  if (pages) {   // a second page so there is something to switch to
    const story = await service.getStory(job.spaceId, job.id), home = story.pages[0];
    story.pages.push({ id: 'services', name: 'Services', path: '/services', purpose: 'List the work',
      chapters: [{ ...home.chapters[0], id: 'list', name: 'List', words: { ...home.chapters[0].words, headline: 'What we fix' } }] });
    await service.saveStory(job.spaceId, job.id, story);
  }
  for (let guard = 0; guard < 12; guard++) {
    const j = await service.getJob(job.spaceId, job.id); if (j.stageId === 'build') break;
    if (j.waitingOnJax) await service.approveStage(job.spaceId, job.id); else await service.completeStage(job.spaceId, job.id);
  }
  return { service, job };
}
async function mount(s, { stageId = 'build', service = s.service } = {}) {
  const el = dom(), cleanup = mountCanvas(el, { spaceId: s.job.spaceId, jobId: s.job.id, stageId, studio: { service } });
  await settle(); return { el, cleanup };
}

test('outside Build, or for a non-Website Job, it shows a plain empty state', async () => {
  const s = await atBuild(), a = await mount(s, { stageId: 'look' });
  assert.match(text(a.el), /opens at the Build stage/); assert.equal(btn(a.el, 'Build the site from the chapter cards'), undefined); a.cleanup();
  const deck = createSampleService(); deck.setProjects([{ id: 'client-a', name: 'Client A' }]);
  const dj = await deck.startJob('client-a', 'pitch-deck', 'deck'), b = await mount({ service: deck, job: dj });
  assert.match(text(b.el), /Only Website Jobs have a site to build/); b.cleanup();
});

test('Build the site works once, shows the report, then lists the pages and previews the first one', async () => {
  const s = await atBuild({ pages: true }); let starts = 0, release;
  const service = { ...s.service, startSite: (...a) => { starts++; return new Promise(r => { release = () => r(s.service.startSite(...a)); }); } };
  const { el, cleanup } = await mount(s, { service });
  assert.match(text(el), /Meridian builds the site from the finished chapter cards/);
  btn(el, 'Build the site from the chapter cards').click();
  assert.equal(btn(el, 'Building…').disabled, true); btn(el, 'Building…').click(); assert.equal(starts, 1);
  release(); await settle();
  const site = await s.service.getSite(s.job.spaceId, s.job.id);
  const pageButtons = walk(walk(el).find(n => n.tag === 'nav')).filter(n => n.tag === 'button').map(text);
  assert.deepEqual(pageButtons, site.pages.map(p => `${p.title} ${p.path}`.trim()));
  assert.equal(btn(el, 'Build the site from the chapter cards'), undefined);
  assert.equal(frame(el).srcdoc, (await s.service.previewPage(s.job.spaceId, s.job.id, site.pages[0].id)).html);
  assert.doesNotMatch(text(el), /\$|price|cost/i);
  cleanup();
});

test('the report shows as warnings, not errors', async () => {
  const s = await atBuild();
  const service = { ...s.service, startSite: async (...a) => ({ ...(await s.service.startSite(...a)),
    report: { custom: ['hero', 'faq'], short: [{ chapter: 'gallery', needs: '6 kept images' }] } }) };
  const { el, cleanup } = await mount(s, { service });
  btn(el, 'Build the site from the chapter cards').click(); await settle();
  const notes = walk(el).find(n => n.className === 'studio-card studio-website-notes');
  assert.equal(notes.attrs.role, 'status'); assert.match(text(notes), /2 chapters still marked custom/);
  assert.match(text(notes), /gallery is short on images \(needs 6 kept images\)/);
  assert.equal(walk(el).some(n => n.attrs.role === 'alert'), false);
  cleanup();
});

test('selecting a page asks previewPage for that page; the sandbox is exactly allow-scripts; Desktop and Phone widths', async () => {
  const s = await atBuild({ pages: true }); await s.service.startSite(s.job.spaceId, s.job.id, { from: 'cards' });
  const asked = [], service = { ...s.service, previewPage: (sp, j, id, o) => { asked.push(id); return s.service.previewPage(sp, j, id, o); } };
  const { el, cleanup } = await mount(s, { service });
  const site = await s.service.getSite(s.job.spaceId, s.job.id), second = site.pages[1];
  assert.equal(frame(el).attrs.sandbox, 'allow-scripts');   // exactly; never allow-same-origin or any other flag
  assert.equal(frame(el).attrs.width, '1280'); assert.equal(frame(el).attrs.title, `Preview: ${site.pages[0].title}`);
  btn(el, `${second.title} ${second.path}`).click(); await settle();
  assert.equal(asked.at(-1), second.id); assert.equal(frame(el).attrs.title, `Preview: ${second.title}`);
  btn(el, 'Phone').click(); assert.equal(frame(el).attrs.width, '390'); assert.equal(btn(el, 'Phone').attrs['aria-pressed'], 'true');
  const before = asked.length; btn(el, 'Reload preview').click(); await settle(); assert.equal(asked.length, before + 1);
  cleanup();
});

test('a failed start shows the service message; offline and failed loads show plainly', async () => {
  const s = await atBuild();
  const refuse = { ...s.service, startSite: async () => { throw Error('The site can only change while Build is open.'); } };
  const a = await mount(s, { service: refuse }); btn(a.el, 'Build the site from the chapter cards').click(); await settle();
  assert.ok(walk(a.el).some(n => n.attrs.role === 'alert' && text(n) === 'The site can only change while Build is open.'));
  assert.equal(btn(a.el, 'Build the site from the chapter cards').disabled, false); a.cleanup();
  const offline = { ...s.service, getJob: async () => { throw Object.assign(Error('x'), { code: 'OFFLINE' }); } };
  const b = await mount(s, { service: offline }); assert.match(text(b.el), /You are offline/); b.cleanup();
});

test('reloads on site-changed for this Job; cleanup removes listeners and ignores late results', async () => {
  const s = await atBuild(); let reads = 0;
  const service = { ...s.service, getSite: (...a) => { reads++; return s.service.getSite(...a); } };
  const { el, cleanup } = await mount(s, { service });
  await s.service.startSite(s.job.spaceId, s.job.id, { from: 'cards' }); await settle();
  assert.ok(frame(el)); assert.ok(reads >= 2);   // the site started elsewhere shows up here
  const controls = walk(el).filter(n => n.events.click); assert.ok(controls.length >= 3);
  cleanup(); assert.ok(controls.every(n => !n.events.click));
  const before = reads; const site = await s.service.getSite(s.job.spaceId, s.job.id);
  await s.service.saveSite(s.job.spaceId, s.job.id, site); await settle(); assert.equal(reads, before);
});
