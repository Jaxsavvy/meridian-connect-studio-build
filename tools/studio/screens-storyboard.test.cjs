'use strict';
// Tyler 33: Storyboard film strip (#233). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { fillStory } = require('./helpers/website-story.cjs');
const { mountCanvas, safeUrl } = require('../../src/renderer/studio/screens/storyboard.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
const settle = async () => { for (let i = 0; i < 12; i++) await tick(); };
function dom() {
  const doc = { activeElement: null, createElement(tag) { return { tag, ownerDocument: doc, children: [], attrs: {}, events: {},
    setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; }, append(...items) { this.children.push(...items); },
    appendChild(item) { this.append(item); }, replaceChildren(...items) { this.children = items; },
    addEventListener(k, fn) { this.events[k] = fn; }, removeEventListener(k, fn) { if (this.events[k] === fn) delete this.events[k]; },
    focus() { doc.activeElement = this; }, remove() {}, click() { if (!this.disabled) this.events.click?.(); } }; } };
  return doc.createElement('div');
}
const walk = el => [el, ...el.children.flatMap(walk)];
const text = el => (el.textContent || '') + el.children.map(text).join('');
const btn = (el, label) => walk(el).find(n => n.tag === 'button' && (n.attrs['aria-label'] || text(n)) === label);
const tiles = el => walk(el).filter(n => String(n.className).startsWith('studio-storyboard-tile'));
const count = el => text(walk(el).find(n => n.className === 'studio-storyboard-count'));
const alerts = el => walk(el).filter(n => n.attrs.role === 'alert').map(text);
// A Website Job at Storyboard with three chapters on two pages; fillStory already kept a frame for Home · Hero.
async function atStoryboard() {
  const service = createSampleService(), job = await service.startJob('sample-client', 'website', 'standard'), sp = job.spaceId;
  await fillStory(service, sp, job.id);
  const story = await service.getStory(sp, job.id), first = story.pages[0].chapters[0];
  story.pages[0].chapters.push({ ...first, id: 'services', name: 'Services', job: 'Show what we fix' });
  story.pages.push({ id: 'about', name: 'About', path: '/about', purpose: 'Who we are', chapters: [{ ...first, id: 'story', name: 'Story', job: 'Earn trust' }] });
  await service.saveStory(sp, job.id, story);
  for (let guard = 0; guard < 10; guard++) {
    const j = await service.getJob(sp, job.id); if (j.stageId === 'storyboard') break;
    if (j.waitingOnJax) await service.approveStage(sp, job.id); else await service.completeStage(sp, job.id);
  }
  return { service, job };
}
async function mount(s, { stageId = 'storyboard', service = s.service, clipboard } = {}) {
  const el = dom(), cleanup = mountCanvas(el, { spaceId: s.job.spaceId, jobId: s.job.id, stageId, clipboard, studio: { service } });
  await settle(); return { el, cleanup };
}

test('outside Storyboard, or for a non-Website Job, it shows a plain empty state', async () => {
  const s = await atStoryboard(), a = await mount(s, { stageId: 'words' });
  assert.match(text(a.el), /opens at the Storyboard stage/); a.cleanup();
  const deck = createSampleService(); deck.setProjects([{ id: 'client-a', name: 'Client A' }]);
  const dj = await deck.startJob('client-a', 'pitch-deck', 'deck'), b = await mount({ service: deck, job: dj });
  assert.match(text(b.el), /Only Website Jobs have a storyboard/); b.cleanup();
});

test('tiles follow the cards, with page names; arrow keys move along the strip as one tab stop', async () => {
  const s = await atStoryboard(), { el, cleanup } = await mount(s);
  assert.equal(count(el), '1 of 3 chapters have a frame');
  assert.deepEqual(walk(el).filter(n => n.className === 'studio-storyboard-page').map(text), ['Home', 'About']);
  assert.deepEqual(tiles(el).map(t => t.children[1].textContent), ['Hero', 'Services', 'Story']);
  assert.match(text(tiles(el)[1]), /No frame yetServicesShow what we fix/);
  assert.equal(walk(tiles(el)[0]).find(n => n.tag === 'img').attrs.alt, 'Storyboard frame: Hero');
  assert.deepEqual(tiles(el).map(t => t.tabIndex), [0, -1, -1]);
  tiles(el)[0].events.keydown({ key: 'ArrowRight' }); assert.equal(el.ownerDocument.activeElement, tiles(el)[1]);
  assert.deepEqual(tiles(el).map(t => t.tabIndex), [-1, 0, -1]);
  tiles(el)[1].events.keydown({ key: 'ArrowRight' }); tiles(el)[2].events.keydown({ key: 'ArrowRight' });
  assert.equal(el.ownerDocument.activeElement, tiles(el)[2]);   // stops at the end
  tiles(el)[2].events.keydown({ key: 'ArrowLeft' }); assert.equal(el.ownerDocument.activeElement, tiles(el)[1]);
  assert.doesNotMatch(text(el), /\$|price|cost/i);
  cleanup();
});

test('make a frame, keep it: Kept, on the tile, the count goes up, focus stays on the kept frame; Copy prompt', async () => {
  const s = await atStoryboard(), copied = [], { el, cleanup } = await mount(s, { clipboard: { writeText: async t => { copied.push(t); } } });
  tiles(el)[1].click(); assert.match(text(el), /Home · ServicesShow what we fix/); assert.match(text(el), /No frames made yet/);
  btn(el, 'Make a frame').click(); assert.equal(btn(el, 'Making…').disabled, true); await settle();
  btn(el, 'Make a frame').click(); await settle();   // a second one keeps the first
  assert.equal(walk(el).filter(n => n.className === 'studio-storyboard-thumb').length, 2);
  btn(el, 'Keep frame 2 of Services').click(); await settle();
  const board = await s.service.getStoryboard(s.job.spaceId, s.job.id), services = board.chapters[1];
  assert.equal(services.keptId, services.frames[1].id);
  assert.equal(count(el), '2 of 3 chapters have a frame'); assert.match(text(el), /Kept/);
  assert.equal(el.ownerDocument.activeElement.attrs['data-focus'], `frame:${services.frames[1].id}`);
  assert.equal(walk(tiles(el)[1]).find(n => n.tag === 'img').attrs.alt, 'Storyboard frame: Services');
  btn(el, 'Copy prompt: Services').click(); await settle();
  assert.deepEqual(copied, [services.prompt]); assert.match(text(el), /Copied/);
  cleanup();
});

test('unsafe image URLs never render; the service error shows', async () => {
  for (const url of ['javascript:alert(1)', 'http://example.test/a.png', 'data:text/html,<b>x</b>']) assert.equal(safeUrl(url), false, url);
  const s = await atStoryboard();
  const service = { ...s.service, listJobAssets: async (...a) => { const out = await s.service.listJobAssets(...a); out.storyboard.forEach(x => { x.url = 'javascript:alert(1)'; }); return out; },
    makeStoryboardFrame: async () => { throw Error('Coming soon with the real server.'); } };
  const { el, cleanup } = await mount(s, { service });
  assert.equal(walk(el).some(n => n.tag === 'img'), false); assert.match(text(tiles(el)[0]), /No frame yet/);
  tiles(el)[0].click(); btn(el, 'Make a frame').click(); await settle();
  assert.deepEqual(alerts(el), ['Coming soon with the real server.']); assert.equal(btn(el, 'Make a frame').disabled, false);
  cleanup();
});

test('once sent to Jax it is read-only; cleanup removes listeners and ignores late results', async () => {
  const s = await atStoryboard(), sp = s.job.spaceId, id = s.job.id;
  for (const [pageId, chapterId] of [['home', 'services'], ['about', 'story']]) {
    const b = await s.service.makeStoryboardFrame(sp, id, { pageId, chapterId });
    const c = b.chapters.find(x => x.chapterId === chapterId);
    await s.service.keepStoryboardFrame(sp, id, { pageId, chapterId, frameId: c.frames[0].id });
  }
  await s.service.completeStage(sp, id);
  const ro = await mount(s); tiles(ro.el)[0].click();
  assert.match(text(ro.el), /With Jax: the storyboard is locked\./); assert.equal(count(ro.el), '3 of 3 chapters have a frame');
  assert.equal(btn(ro.el, 'Make a frame'), undefined); assert.equal(btn(ro.el, 'Keep this frame'), undefined);
  ro.cleanup();
  const s2 = await atStoryboard(); let reads = 0, release;
  const late = { ...s2.service, getStoryboard: (...a) => { reads++; return reads === 1 ? s2.service.getStoryboard(...a) : new Promise(r => { release = () => r(s2.service.getStoryboard(...a)); }); } };
  const m = await mount(s2, { service: late });
  await s2.service.makeStoryboardFrame(s2.job.spaceId, s2.job.id, { pageId: 'home', chapterId: 'services' }); await settle();
  const controls = walk(m.el).filter(n => n.events.click || n.events.keydown); assert.ok(controls.length >= 3);
  const shown = text(m.el); m.cleanup(); release(); await settle();
  assert.equal(text(m.el), shown); assert.ok(controls.every(n => !n.events.click && !n.events.keydown));
});
