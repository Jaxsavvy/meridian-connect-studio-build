'use strict';
// Tyler 27: Website Check screen (#207). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { fillStory, startSiteAtBuild } = require('./helpers/website-story.cjs');
const { mountCanvas } = require('../../src/renderer/studio/screens/site-check.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
const settle = async () => { for (let i = 0; i < 10; i++) await tick(); };
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
const groupOf = (el, name) => walk(el).find(n => n.tag === 'section' && n.attrs['aria-label'] === name);
const note = (el, flagId) => walk(el).find(n => n.attrs['data-focus'] === `note:${flagId}`);
const summary = el => text(walk(el).find(n => n.className === 'studio-site-check-summary'));
// A Website Job at Check, with a page title and description too long for Google (two "Google basics" flags).
async function atCheck({ flags = true } = {}) {
  const service = createSampleService(), job = await service.startJob('sample-client', 'website', 'standard'), sp = job.spaceId;
  await fillStory(service, sp, job.id);
  for (let guard = 0; guard < 14; guard++) {
    const j = await service.getJob(sp, job.id); if (j.stageId === 'check') break;
    await startSiteAtBuild(service, sp, job.id);
    if (j.stageId === 'build' && flags) {
      const site = await service.getSite(sp, job.id); site.pages[0].title = 'T'.repeat(70); site.pages[0].description = 'D'.repeat(170);
      await service.saveSite(sp, job.id, site);
    }
    if (j.waitingOnJax) await service.approveStage(sp, job.id); else await service.completeStage(sp, job.id);
  }
  return { service, job };
}
async function mount(s, { stageId = 'check', service = s.service } = {}) {
  const el = dom(), cleanup = mountCanvas(el, { spaceId: s.job.spaceId, jobId: s.job.id, stageId, studio: { service } });
  await settle(); return { el, cleanup };
}

test('outside Check, or for a non-Website Job, it shows a plain empty state', async () => {
  const s = await atCheck({ flags: false }), a = await mount(s, { stageId: 'build' });
  assert.match(text(a.el), /opens at the Check stage/); assert.equal(btn(a.el, 'Run checks again'), undefined); a.cleanup();
  const deck = createSampleService(); deck.setProjects([{ id: 'client-a', name: 'Client A' }]);
  const dj = await deck.startJob('client-a', 'pitch-deck', 'deck'), b = await mount({ service: deck, job: dj });
  assert.match(text(b.el), /Only Website Jobs have a site to check/); b.cleanup();
});

test('flags are grouped by kind with plain names; notRun shows in practice mode', async () => {
  const s = await atCheck(), real = await s.service.getChecks(s.job.spaceId, s.job.id);
  const extra = [['speed', 'Big page'], ['accessibility', 'No alt'], ['links', 'Dead link'], ['phone', 'Too wide'], ['links-open', 'Gone']]
    .map(([check, message], i) => ({ id: `x${i}`, check, message, where: 'Home', resolved: null }));
  const service = { ...s.service, getChecks: async () => ({ ...real, flags: [...extra, ...real.flags] }) };
  const { el, cleanup } = await mount(s, { service });
  const names = walk(el).filter(n => n.tag === 'section' && n.className.includes('group')).map(n => n.attrs['aria-label']);
  assert.deepEqual(names.filter(Boolean), ['Google basics', 'Easy for everyone to use', 'Links inside the site', 'Outside links', 'Speed (estimate)', 'On a phone']);
  assert.match(text(groupOf(el, 'Google basics')), /The page title is 70 characters.*Home/);
  assert.match(text(el), /Checked /); assert.match(summary(el), /^7 to review · 0 explained$/);
  const notRun = walk(el).find(n => n.tag === 'section' && text(n).startsWith('Not run yet'));
  assert.deepEqual(walk(notRun).filter(n => n.tag === 'li').map(text), ['On a phone', 'Outside links']);
  assert.match(text(notRun), /These run in Connect after a real sign-in\./);
  assert.doesNotMatch(text(el), /\$|price|cost/i);
  cleanup();
});

test('an empty note is refused; resolving updates the summary and the log, and focus moves to the next flag', async () => {
  const s = await atCheck(), { el, cleanup } = await mount(s);
  const [first, second] = (await s.service.getChecks(s.job.spaceId, s.job.id)).flags;
  note(el, first.id).value = '   '; note(el, first.id).events.input();
  btn(el, `Mark as OK: ${first.message}`).click(); await settle();
  assert.ok(walk(el).some(n => n.attrs.role === 'alert' && text(n) === 'Say why this flag is OK before marking it.'));
  assert.equal((await s.service.getChecks(s.job.spaceId, s.job.id)).flags[0].resolved, null);
  note(el, first.id).value = 'The brand name needs the full title.'; note(el, first.id).events.input();
  btn(el, `Mark as OK: ${first.message}`).click(); await settle();
  assert.match(summary(el), /^1 to review · 1 explained$/);
  assert.match(text(groupOf(el, 'Google basics')), /ExplainedNote: The brand name needs the full title\./);
  assert.equal(btn(el, `Mark as OK: ${first.message}`), undefined);
  assert.equal(el.ownerDocument.activeElement, note(el, second.id));
  const history = walk(el).find(n => n.className === 'studio-card studio-site-check-history');
  assert.match(text(history), /Google basics · HomeThe page title is 70 characters.*Note: The brand name needs the full title\./);
  assert.equal(walk(history).some(n => n.tag === 'input' || n.tag === 'button'), false);   // read-only
  note(el, second.id).value = 'Long on purpose.'; note(el, second.id).events.input();
  btn(el, `Mark as OK: ${second.message}`).click(); await settle();
  const ready = walk(el).find(n => text(n) === 'Ready: mark the stage done');
  assert.equal(ready.attrs.role, 'status'); assert.equal(el.ownerDocument.activeElement, ready);
  cleanup();
});

test('Run checks again works; a resolved flag stays resolved; service errors show as alerts', async () => {
  const s = await atCheck(); let runs = 0;
  const service = { ...s.service, runChecks: (...a) => { runs++; return s.service.runChecks(...a); } };
  const { el, cleanup } = await mount(s, { service });
  const flag = (await s.service.getChecks(s.job.spaceId, s.job.id)).flags[0];
  await s.service.resolveFlag(s.job.spaceId, s.job.id, flag.id, 'Fine as it is.'); await settle();   // elsewhere: checks-changed reloads
  assert.match(summary(el), /^1 to review · 1 explained$/);
  btn(el, 'Run checks again').click(); assert.equal(btn(el, 'Checking…').disabled, true); await settle();
  assert.equal(runs, 1); assert.match(summary(el), /^1 to review · 1 explained$/);
  assert.equal(el.ownerDocument.activeElement, btn(el, 'Run checks again'));
  cleanup();
  const refuse = { ...s.service, resolveFlag: async () => { throw Error('Auto check is finished.'); } };
  const b = await mount(s, { service: refuse }), open = (await s.service.getChecks(s.job.spaceId, s.job.id)).flags.find(f => !f.resolved);
  note(b.el, open.id).value = 'ok'; note(b.el, open.id).events.input(); btn(b.el, `Mark as OK: ${open.message}`).click(); await settle();
  assert.ok(walk(b.el).some(n => n.attrs.role === 'alert' && text(n) === 'Auto check is finished.'));
  b.cleanup();
});

test('a clean site is ready; stale loads are ignored; cleanup removes listeners', async () => {
  const s = await atCheck({ flags: false }); let release, reads = 0;
  const service = { ...s.service, getChecks: (...a) => { reads++; return reads === 2 ? new Promise(r => { release = () => r(s.service.getChecks(...a)); }) : s.service.getChecks(...a); } };
  const { el, cleanup } = await mount(s, { service });
  assert.match(summary(el), /^0 to review · 0 explained$/); assert.match(text(el), /Ready: mark the stage done/);
  await s.service.runChecks(s.job.spaceId, s.job.id); await settle();   // load 2 hangs…
  await s.service.runChecks(s.job.spaceId, s.job.id); await settle();   // …load 3 wins
  const shown = text(el); release({ ranAt: null, flags: [{ id: 'old', check: 'seo', message: 'Stale', where: 'Home', resolved: null }], notRun: [], log: [] }); await settle();
  assert.equal(text(el), shown); assert.doesNotMatch(text(el), /Stale/);
  const controls = walk(el).filter(n => n.events.click || n.events.input); assert.ok(controls.length >= 1);
  cleanup(); assert.ok(controls.every(n => !n.events.click && !n.events.input));
  const before = reads; await s.service.runChecks(s.job.spaceId, s.job.id); await settle(); assert.equal(reads, before);
});
