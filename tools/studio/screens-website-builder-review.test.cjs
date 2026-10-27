'use strict';
// Tyler 30: the Website builder opens at Review for fixes (#221). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { fillStory, startSiteAtBuild } = require('./helpers/website-story.cjs');
const { mountCanvas } = require('../../src/renderer/studio/screens/website-builder.js');
const Edit = require('../../src/renderer/studio/website/site-edit.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
const settle = async () => { for (let i = 0; i < 12; i++) await tick(); };
function dom() {
  const win = { listeners: {}, confirm: () => true, addEventListener(k, fn) { (this.listeners[k] ||= []).push(fn); },
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
const field = el => walk(el).find(n => n.attrs['data-focus'] === 'text');
const alerts = el => walk(el).filter(n => n.attrs.role === 'alert').map(text);
const headline = site => Edit.editableList(site, 'home').find(i => i.key === 'hero-headline').text;
async function atReview() {
  const service = createSampleService(), job = await service.startJob('sample-client', 'website', 'standard'), sp = job.spaceId;
  await fillStory(service, sp, job.id);
  for (let guard = 0; guard < 14; guard++) {
    const j = await service.getJob(sp, job.id); if (j.stageId === 'review') break;
    await startSiteAtBuild(service, sp, job.id);
    if (j.waitingOnJax) await service.approveStage(sp, job.id); else await service.completeStage(sp, job.id);
  }
  return { service, job };
}
async function mount(s, { stageId = 'review', ...over } = {}) {
  const d = dom(), dirty = [], service = { ...s.service, ...over };
  const cleanup = mountCanvas(d.el, { spaceId: s.job.spaceId, jobId: s.job.id, stageId, studio: { service, setDirty: v => dirty.push(v) } });
  await settle(); return { ...d, dirty, cleanup };
}
async function editHeadline(m, words) {
  btn(m.el, 'Heading: Roofs done right').click(); field(m.el).value = words; field(m.el).events.input();
  btn(m.el, 'Apply').click(); await settle();
}

test('opens at Review without Build the site or Finish, with the fixing line; other stages stay empty', async () => {
  const s = await atReview(), m = await mount(s);
  assert.ok(walk(m.el).some(n => n.tag === 'iframe' && n.attrs.sandbox === 'allow-scripts'));
  assert.match(text(m.el), /Fixing during Review: every save is checked again, and anything the check finds shows up as a Review comment\./);
  for (const label of ['Build the site from the chapter cards', 'Finish']) assert.equal(btn(m.el, label), undefined, label);
  assert.ok(btn(m.el, 'Save site')); assert.ok(btn(m.el, 'Heading: Roofs done right')); assert.ok(btn(m.el, 'Apply page details'));
  m.cleanup();
  const check = await mount(s, { stageId: 'check' }); assert.match(text(check.el), /opens at the Build stage, and at Review for fixes/); check.cleanup();
});

test('at Review, Apply and Save work and say the project files are up to date', async () => {
  const s = await atReview(), m = await mount(s);
  await editHeadline(m, 'Roofs fixed right'); assert.deepEqual(m.dirty, [true]);
  btn(m.el, 'Save site').click(); await settle();
  assert.equal(headline(await s.service.getSite(s.job.spaceId, s.job.id)), 'Roofs fixed right');
  assert.match(text(m.el), /Saved\. The site files in the project folder are up to date\./); assert.deepEqual(alerts(m.el), []);
  assert.equal(m.dirty.at(-1), false); assert.equal(btn(m.el, 'Save site').disabled, true);
  assert.doesNotMatch(text(m.el), /\$|price|cost/i);
  m.cleanup();
});

test('failed project files show an alert, and Save stays available to try again', async () => {
  const s = await atReview(); let saves = 0;
  const m = await mount(s, { saveSite: async (...a) => {
    saves++; const out = await s.service.saveSite(...a);
    return saves === 1 ? { ...out, files: { saved: ['site.json'], failed: [{ name: 'Site - home.html', error: 'Disk full' }] } } : out;
  } });
  await editHeadline(m, 'Roofs fixed right'); btn(m.el, 'Save site').click(); await settle();
  assert.deepEqual(alerts(m.el), ['Saved, but these files didn\'t save to the project folder: Site - home.html. Save again before sending Review to Jax.']);
  assert.equal(btn(m.el, 'Save site').disabled, false);   // nothing unsaved, but the files still need saving
  btn(m.el, 'Save site').click(); await settle();
  assert.equal(saves, 2); assert.deepEqual(alerts(m.el), []); assert.match(text(m.el), /project folder are up to date/);
  m.cleanup();
});

test('while waiting on Jax the builder is read-only', async () => {
  const s = await atReview(); await s.service.completeStage(s.job.spaceId, s.job.id);
  assert.equal((await s.service.getJob(s.job.spaceId, s.job.id)).waitingOnJax, true);
  const m = await mount(s);
  assert.match(text(m.el), /With Jax for review\./); assert.doesNotMatch(text(m.el), /Fixing during Review/);
  for (const label of ['Save site', 'Finish', 'Apply', 'Apply page details']) assert.equal(btn(m.el, label), undefined, label);
  assert.equal(walk(m.el).some(n => (n.tag === 'input' || n.tag === 'textarea') && !n.disabled), false);
  m.cleanup(); assert.equal(m.win.listeners.message.length, 0);
});
