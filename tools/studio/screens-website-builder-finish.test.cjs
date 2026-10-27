'use strict';
// Tyler 26: Website builder, part 3: page details, remove a page, Finish (#201). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { fillStory } = require('./helpers/website-story.cjs');
const { mountCanvas } = require('../../src/renderer/studio/screens/website-builder.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
const settle = async () => { for (let i = 0; i < 12; i++) await tick(); };
function dom(answer = true) {
  const win = { asked: [], listeners: {}, confirm(m) { this.asked.push(m); return answer; },
    addEventListener(k, fn) { (this.listeners[k] ||= []).push(fn); },
    removeEventListener(k, fn) { this.listeners[k] = (this.listeners[k] || []).filter(f => f !== fn); } };
  const doc = { activeElement: null, defaultView: win, createElement(tag) { return { tag, ownerDocument: doc, children: [], attrs: {}, events: {},
    setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; }, append(...items) { this.children.push(...items); },
    appendChild(item) { this.append(item); }, replaceChildren(...items) { this.children = items; },
    addEventListener(k, fn) { this.events[k] = fn; }, removeEventListener(k, fn) { if (this.events[k] === fn) delete this.events[k]; },
    focus() { doc.activeElement = this; }, remove() {}, click() { if (!this.disabled) this.events.click?.(); } }; } };
  return { el: doc.createElement('div'), win, doc };
}
const walk = el => [el, ...el.children.flatMap(walk)];
const text = el => (el.textContent || '') + el.children.map(text).join('');
const btn = (el, label) => walk(el).find(n => n.tag === 'button' && (n.attrs['aria-label'] || text(n)) === label);
const input = (el, key) => walk(el).find(n => n.attrs['data-focus'] === `page-${key}`);
const type = (field, value) => { field.value = value; field.events.input(); };
const alerts = el => walk(el).filter(n => n.attrs.role === 'alert').map(text);
const pageButtons = el => walk(walk(el).find(n => n.tag === 'nav')).filter(n => n.tag === 'button');
async function atBuild() {
  const service = createSampleService(), job = await service.startJob('sample-client', 'website', 'standard');
  await fillStory(service, job.spaceId, job.id);
  const story = await service.getStory(job.spaceId, job.id), first = story.pages[0].chapters[0];
  story.pages.push({ id: 'about', name: 'About', path: '/about', purpose: 'Who we are', chapters: [{ ...first, id: 'story', name: 'Story' }] });
  await service.saveStory(job.spaceId, job.id, story);
  for (let guard = 0; guard < 12; guard++) {
    const j = await service.getJob(job.spaceId, job.id); if (j.stageId === 'build') break;
    if (j.waitingOnJax) await service.approveStage(job.spaceId, job.id); else await service.completeStage(job.spaceId, job.id);
  }
  await service.startSite(job.spaceId, job.id, { from: 'cards' });
  return { service, job };
}
async function mount(s, { answer, ...over } = {}) {
  const calls = [], asked = [], dirty = [], d = dom(answer), real = s.service;
  const service = { ...real,
    previewPage: (sp, j, id, o) => { asked.push({ id, site: o?.site }); return real.previewPage(sp, j, id, o); },
    saveSite: (...a) => { calls.push('saveSite'); return real.saveSite(...a); },
    finishSite: (...a) => { calls.push('finishSite'); return real.finishSite(...a); },
    completeStage: (...a) => { calls.push(`completeStage:${a[2]}`); return real.completeStage(...a); }, ...over };
  const cleanup = mountCanvas(d.el, { spaceId: s.job.spaceId, jobId: s.job.id, stageId: 'build', studio: { service, setDirty: v => dirty.push(v) } });
  await settle(); return { ...d, calls, asked, dirty, cleanup };
}

test('title and description change the draft, show their limits, and helper errors show', async () => {
  const s = await atBuild(), m = await mount(s);
  assert.equal(input(m.el, 'title').maxLength, 120); assert.equal(input(m.el, 'description').maxLength, 300);
  type(input(m.el, 'title'), 'Roofing in the valley'); type(input(m.el, 'description'), 'Licensed crews, fast estimates.');
  assert.match(text(m.el), /21 of 120 characters.*31 of 300 characters/);
  btn(m.el, 'Apply page details').click(); await settle();
  const home = m.asked.at(-1).site.pages[0];
  assert.equal(home.title, 'Roofing in the valley'); assert.equal(home.description, 'Licensed crews, fast estimates.');
  assert.deepEqual(m.dirty, [true]); assert.equal(m.doc.activeElement, btn(m.el, 'Apply page details'));
  const before = m.asked.length; type(input(m.el, 'title'), '   '); btn(m.el, 'Apply page details').click(); await settle();
  assert.equal(alerts(m.el).length, 1); assert.equal(m.asked.length, before);   // the draft stays as it was
  assert.doesNotMatch(text(m.el), /\$|price|cost/i);
  m.cleanup();
});

test('Home has no Remove button; removing another page asks first', async () => {
  const s = await atBuild(), no = await mount(s, { answer: false });
  assert.equal(walk(no.el).some(n => text(n) === 'Remove this page'), false);   // Home
  pageButtons(no.el)[1].click(); await settle();
  const about = (await s.service.getSite(s.job.spaceId, s.job.id)).pages[1];
  btn(no.el, `Remove page: ${about.title}`).click();
  assert.deepEqual(no.win.asked, ['Remove this page?']); assert.equal(pageButtons(no.el).length, 2); no.cleanup();
  const m = await mount(s); pageButtons(m.el)[1].click(); await settle();
  btn(m.el, `Remove page: ${about.title}`).click(); await settle();
  assert.equal(pageButtons(m.el).length, 1); assert.deepEqual(m.asked.at(-1).site.pages.map(p => p.path), ['/']);
  assert.equal(m.asked.at(-1).id, 'home'); assert.equal(m.doc.activeElement.attrs['data-focus'], 'pages');
  m.cleanup();
});

test('Finish saves, then finishSite, then completes Build; afterwards the builder is read-only', async () => {
  const s = await atBuild(), m = await mount(s);
  type(input(m.el, 'title'), 'Roofing in the valley'); btn(m.el, 'Apply page details').click(); await settle();
  btn(m.el, 'Finish').click(); assert.equal(btn(m.el, 'Working…').disabled, true); await settle();
  assert.deepEqual(m.calls, ['saveSite', 'finishSite', 'completeStage:build']);
  const n = (await s.service.getSite(s.job.spaceId, s.job.id)).pages.length + 1;   // site.json + one per page
  assert.match(text(m.el), new RegExp(`Saved to the project folder: ${n} files`));
  assert.ok((await s.service.listProjectFiles(s.job.spaceId)).some(f => /site\.json/.test(f.name)));
  assert.equal((await s.service.getSite(s.job.spaceId, s.job.id)).pages[0].title, 'Roofing in the valley');
  assert.notEqual((await s.service.getJob(s.job.spaceId, s.job.id)).stageId, 'build');
  assert.equal(m.doc.activeElement, walk(m.el).find(n => text(n) === 'Build is done.'));
  for (const label of ['Finish', 'Save site', 'Apply page details', 'Remove section']) assert.equal(btn(m.el, label), undefined, label);
  assert.equal(walk(m.el).some(n => n.tag === 'input' || n.tag === 'textarea'), false); assert.equal(m.dirty.at(-1), false);
  m.cleanup();
  const again = await mount(s);   // opened later: still read-only
  assert.match(text(again.el), /Build is done\./); assert.equal(btn(again.el, 'Finish'), undefined); again.cleanup();
});

test('a failed file or a refused save stops Finish before Build is completed', async () => {
  const s = await atBuild();
  const failing = await mount(s, { finishSite: async () => ({ saved: ['site.json'], failed: [{ name: 'Site - about.html', error: 'Disk full' }] }) });
  btn(failing.el, 'Finish').click(); await settle();
  assert.deepEqual(failing.calls, []);   // nothing unsaved, so no save; finishSite was replaced
  assert.match(alerts(failing.el)[0], /These files didn't save, so Build isn't done yet: Site - about\.html/);
  assert.equal((await s.service.getJob(s.job.spaceId, s.job.id)).stageId, 'build');
  assert.equal(failing.doc.activeElement, btn(failing.el, 'Finish')); failing.cleanup();
  const refused = await mount(s, { saveSite: async () => ({ ok: false, errors: [{ path: 'site', message: 'An image points at an asset that is not in this Space.' }] }) });
  type(input(refused.el, 'title'), 'New title'); btn(refused.el, 'Apply page details').click(); await settle();
  btn(refused.el, 'Finish').click(); await settle();
  assert.deepEqual(refused.calls, []); assert.deepEqual(alerts(refused.el), ['An image points at an asset that is not in this Space.']);
  assert.equal((await s.service.getJob(s.job.spaceId, s.job.id)).stageId, 'build'); assert.match(text(refused.el), /Unsaved changes/);
  refused.cleanup();
});

test('cleanup removes listeners', async () => {
  const s = await atBuild(), m = await mount(s); pageButtons(m.el)[1].click(); await settle();
  const controls = walk(m.el).filter(n => n.events.click || n.events.input); assert.ok(controls.some(n => text(n) === 'Finish'));
  m.cleanup(); assert.ok(controls.every(n => !n.events.click && !n.events.input)); assert.equal(m.win.listeners.message.length, 0);
});
