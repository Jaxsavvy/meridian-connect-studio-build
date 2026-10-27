'use strict';
// Tyler 25: Website builder, part 2: select, edit text, move and remove sections (#200). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { fillStory } = require('./helpers/website-story.cjs');
const { mountCanvas } = require('../../src/renderer/studio/screens/website-builder.js');
const Edit = require('../../src/renderer/studio/website/site-edit.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
const settle = async () => { for (let i = 0; i < 10; i++) await tick(); };
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
const field = el => walk(el).find(n => n.tag === 'textarea' && !n.disabled);
const alerts = el => walk(el).filter(n => n.attrs.role === 'alert').map(text);
const send = (win, source, data) => { for (const fn of win.listeners.message || []) fn({ source, data }); };
async function atBuild({ pages = false } = {}) {
  const service = createSampleService(), job = await service.startJob('sample-client', 'website', 'standard');
  await fillStory(service, job.spaceId, job.id);
  const story = await service.getStory(job.spaceId, job.id), home = story.pages[0], first = home.chapters[0];
  home.chapters.push({ ...first, id: 'services', name: 'Services', words: { ...first.words, headline: 'What we fix' } });
  if (pages) story.pages.push({ id: 'about', name: 'About', path: '/about', purpose: 'Who we are', chapters: [{ ...first, id: 'story', name: 'Story' }] });
  await service.saveStory(job.spaceId, job.id, story);
  for (let guard = 0; guard < 12; guard++) {
    const j = await service.getJob(job.spaceId, job.id); if (j.stageId === 'build') break;
    if (j.waitingOnJax) await service.approveStage(job.spaceId, job.id); else await service.completeStage(job.spaceId, job.id);
  }
  await service.startSite(job.spaceId, job.id, { from: 'cards' });
  return { service, job };
}
async function mount(s, { answer, ...over } = {}) {
  const asked = [], dirty = [], d = dom(answer);
  const service = { ...s.service, ...over, previewPage: (sp, j, id, o) => { asked.push({ id, site: o?.site }); return s.service.previewPage(sp, j, id, o); } };
  const cleanup = mountCanvas(d.el, { spaceId: s.job.spaceId, jobId: s.job.id, stageId: 'build', studio: { service, setDirty: v => dirty.push(v) } });
  await settle();
  const frame = walk(d.el).find(n => n.tag === 'iframe'); frame.contentWindow = { name: 'preview' };
  return { ...d, frame, asked, dirty, cleanup };
}
const home = site => site.pages[0];
const headline = site => Edit.editableList(site, home(site).id).find(i => i.key === 'hero-headline').text;

test('messages from another window, of the wrong type, with a bad key or an unknown key do nothing', async () => {
  const s = await atBuild(), m = await mount(s), good = { type: 'meridian-select', key: 'hero-headline', sectionId: 'hero' };
  send(m.win, { name: 'other' }, good);
  send(m.win, m.frame.contentWindow, { ...good, type: 'meridian-open' });
  send(m.win, m.frame.contentWindow, { ...good, key: 'Hero-Headline' });
  send(m.win, m.frame.contentWindow, { ...good, key: '../hero' });
  send(m.win, m.frame.contentWindow, { ...good, sectionId: 'x'.repeat(41) });
  send(m.win, m.frame.contentWindow, { ...good, key: 'no-such-key' });
  send(m.win, m.frame.contentWindow, { ...good, sectionId: 'site-nav' });   // a real key, but not in that section
  send(m.win, m.frame.contentWindow, Object.assign(Object.create({ evil: true }), good));
  send(m.win, m.frame.contentWindow, 'meridian-select');
  assert.equal(field(m.el), undefined); assert.deepEqual(alerts(m.el), []);
  send(m.win, m.frame.contentWindow, good);
  assert.equal(field(m.el).value, 'Roofs done right'); assert.match(text(m.el), /Section: Hero/);
  assert.equal(m.doc.activeElement, field(m.el));
  m.cleanup();
});

test('Apply changes the draft and the preview, as text only; Save stores it and clears unsaved', async () => {
  const s = await atBuild(), m = await mount(s);
  btn(m.el, 'Heading: Roofs done right').click(); assert.equal(m.doc.activeElement, field(m.el));   // the keyboard route
  const box = field(m.el); box.value = '<b>Fresh</b> roofs'; box.events.input();
  btn(m.el, 'Apply').click(); await settle();
  assert.equal(headline(m.asked.at(-1).site), '<b>Fresh</b> roofs');
  assert.match(walk(m.el).find(n => n.tag === 'iframe').srcdoc, /&lt;b&gt;Fresh&lt;\/b&gt; roofs/);
  assert.equal(m.doc.activeElement, btn(m.el, 'Apply')); assert.deepEqual(m.dirty, [true]);
  assert.match(text(m.el), /Unsaved changes/); assert.equal(headline(await s.service.getSite(s.job.spaceId, s.job.id)), 'Roofs done right');
  btn(m.el, 'Save site').click(); await settle();
  assert.equal(headline(await s.service.getSite(s.job.spaceId, s.job.id)), '<b>Fresh</b> roofs');
  assert.deepEqual(m.dirty, [true, false]); assert.doesNotMatch(text(m.el), /Unsaved changes/);
  assert.equal(btn(m.el, 'Save site').disabled, true); assert.doesNotMatch(text(m.el), /\$|price|cost/i);
  m.cleanup();
});

test('Move and Remove work by keyboard; Remove asks first; focus stays with the section', async () => {
  const s = await atBuild(), no = await mount(s, { answer: false });
  btn(no.el, 'Remove Services').click(); assert.deepEqual(no.win.asked, ['Remove this section?']);
  assert.equal(no.asked.length, 1); assert.deepEqual(no.dirty, []); no.cleanup();
  const m = await mount(s), order = () => home(m.asked.at(-1).site).sections.map(x => x.id);
  assert.equal(btn(m.el, 'Move Hero up').disabled, true);   // the navigation always stays first
  btn(m.el, 'Move Services up').click(); await settle();
  assert.deepEqual(order(), ['site-nav', 'services', 'hero']);
  assert.equal(m.doc.activeElement, btn(m.el, 'Move Services down'));   // Move up is now disabled, so focus moves next to it
  btn(m.el, 'Move Services down').click(); await settle(); assert.deepEqual(order(), ['site-nav', 'hero', 'services']);
  btn(m.el, 'Remove Hero').click(); await settle();
  assert.deepEqual(order(), ['site-nav', 'services']); assert.equal(m.doc.activeElement.attrs['data-focus'], 'sections');
  m.cleanup();
});

test('a helper that refuses shows its errors and leaves the draft as it was', async () => {
  const s = await atBuild(), m = await mount(s);
  btn(m.el, 'Remove Hero').click(); await settle(); const before = m.asked.length, draft = m.asked.at(-1).site;
  btn(m.el, 'Remove Services').click();
  assert.deepEqual(alerts(m.el), ['A page needs at least one section.']); assert.equal(m.asked.length, before);
  btn(m.el, 'Heading: What we fix').click(); field(m.el).value = '   '; btn(m.el, 'Apply').click();
  assert.deepEqual(alerts(m.el), ['Text can\'t be empty.']); assert.equal(m.asked.length, before);
  btn(m.el, 'Move Services down').click(); assert.equal(m.asked.length, before);   // disabled at the bottom
  btn(m.el, 'Save site').click(); await settle();
  assert.deepEqual(home(await s.service.getSite(s.job.spaceId, s.job.id)).sections, home(draft).sections);
  const refuse = await mount(await atBuild(), { saveSite: async () => ({ ok: false, errors: [{ path: 'site', message: 'An image points at an asset that is not in this Space.' }] }) });
  btn(refuse.el, 'Move Services up').click(); await settle(); btn(refuse.el, 'Save site').click(); await settle();
  assert.deepEqual(alerts(refuse.el), ['An image points at an asset that is not in this Space.']); assert.deepEqual(refuse.dirty, [true]);
  m.cleanup(); refuse.cleanup();
});

test('the unsaved draft survives a page switch and a site-changed event; cleanup removes the message listener', async () => {
  const s = await atBuild({ pages: true }); let reads = 0;
  const m = await mount(s, { getSite: (...a) => { reads++; return s.service.getSite(...a); } });
  btn(m.el, 'Move Services up').click(); await settle();
  const page = i => walk(walk(m.el).find(n => n.tag === 'nav')).filter(n => n.tag === 'button')[i];
  page(1).click(); await settle(); assert.equal(m.asked.at(-1).id, 'about');
  page(0).click(); await settle(); assert.equal(m.asked.at(-1).id, 'home');
  assert.deepEqual(home(m.asked.at(-1).site).sections.map(x => x.id), ['site-nav', 'services', 'hero']);
  const before = reads, site = await s.service.getSite(s.job.spaceId, s.job.id);
  await s.service.saveSite(s.job.spaceId, s.job.id, site); await settle();
  assert.equal(reads, before); assert.match(text(m.el), /Unsaved changes/);   // someone else's save doesn't wipe the draft
  assert.equal(walk(m.el).find(n => n.tag === 'textarea' && n.disabled).disabled, true);
  assert.match(text(m.el), /Meridian's rewrites arrive with the server\./);
  assert.equal(m.win.listeners.message.length, 1); m.cleanup();
  assert.equal(m.win.listeners.message.length, 0); assert.equal(m.dirty.at(-1), false);
});
