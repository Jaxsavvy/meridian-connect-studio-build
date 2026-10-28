'use strict';
// Tyler 38: Build kit screen (#248). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { fillStory } = require('./helpers/website-story.cjs');
const { mountCanvas } = require('../../src/renderer/studio/screens/build-kit.js');
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
const btn = (el, label) => walk(el).find(n => n.tag === 'button' && text(n) === label);
const part = (el, label) => walk(el).find(n => n.tag === 'section' && n.attrs['aria-label'] === label);
const alerts = el => walk(el).filter(n => n.attrs.role === 'alert').map(text);
// A Website Job walked to Design lock; approve: true sends it and answers as the client, so it's at Build.
async function atLock({ approve = true } = {}) {
  const service = createSampleService(), job = await service.startJob('sample-client', 'website', 'standard'), sp = job.spaceId;
  await fillStory(service, sp, job.id);
  for (let guard = 0; guard < 12; guard++) {
    const j = await service.getJob(sp, job.id); if (j.stageId === 'lock') break;
    if (j.waitingOnJax) await service.approveStage(sp, job.id); else await service.completeStage(sp, job.id);
  }
  if (approve) { await service.completeStage(sp, job.id); await service.answerDesign(sp, job.id, { approved: true }); }
  return { service, job };
}
async function mount(s, { stageId = 'build', service = s.service, clipboard } = {}) {
  const el = dom(), cleanup = mountCanvas(el, { spaceId: s.job.spaceId, jobId: s.job.id, stageId, clipboard, studio: { service } });
  await settle(); return { el, cleanup };
}

test('empty states: outside Build, for a non-Website Job, and before the design is approved', async () => {
  const early = await atLock({ approve: false }), a = await mount(early);
  assert.match(text(a.el), /The build kit is ready once the client approves the design at Design lock\./);
  assert.deepEqual(alerts(a.el), []); a.cleanup();
  const s = await atLock(), b = await mount(s, { stageId: 'lock' }); assert.match(text(b.el), /opens at the Build stage/); b.cleanup();
  const deck = createSampleService(); deck.setProjects([{ id: 'client-a', name: 'Client A' }]);
  const dj = await deck.startJob('client-a', 'pitch-deck', 'deck'), c = await mount({ service: deck, job: dj });
  assert.match(text(c.el), /Only Website Jobs have a build kit/); c.cleanup();
});

test('the summary and prompt show as plain text; Copy prompt uses the clipboard', async () => {
  const s = await atLock(), copied = [], { el, cleanup } = await mount(s, { clipboard: { writeText: async t => { copied.push(t); } } });
  const kit = await s.service.getBuildKit(s.job.spaceId, s.job.id);
  assert.match(text(el), /Not saved to the project folder yet/);
  assert.match(text(part(el, 'Summary')), new RegExp(`Repo it will make: ${kit.repo}PagesHome: 1 chapterImages \\(3\\)look frame`));
  assert.match(text(part(el, 'Summary')), /photo, Home · Hero: Crew on a finished roof/);
  assert.equal(walk(el).some(n => n.tag === 'a'), false);
  assert.equal(walk(el).find(n => n.tag === 'pre').textContent, kit.prompt);
  assert.match(text(el), /Paste this into Claude Code to build the site\. It never publishes; Jax decides when a site goes live\./);
  btn(el, 'Copy prompt').click(); await settle();
  assert.deepEqual(copied, [kit.prompt]); assert.match(text(part(el, 'The prompt')), /Copied/);
  // No money on the screen; the prompt itself is Core's text and tells the builder never to show prices.
  assert.doesNotMatch(text(el).replace(kit.prompt, ''), /\$|price|cost/i);
  cleanup();
});

test('Save lists the saved files, then shows Saved: design version 1; a failure shows its alert', async () => {
  const s = await atLock(); let release;
  const service = { ...s.service, saveBuildKit: (...a) => new Promise(r => { release = () => r(s.service.saveBuildKit(...a)); }) };
  const { el, cleanup } = await mount(s, { service });
  btn(el, 'Save to the project folder').click(); assert.equal(btn(el, 'Saving…').disabled, true);
  release(); await settle();
  assert.match(text(el), /Saved: design version 1/);
  assert.match(text(part(el, 'Project folder')), /Saved to the project folderWebsite v1 - site bundle\.jsonWebsite v1 - build prompt\.md/);
  assert.equal(el.ownerDocument.activeElement, btn(el, 'Save to the project folder'));
  cleanup();
  const failing = { ...s.service, saveBuildKit: async () => ({ saved: ['Website v1 - site bundle.json'], failed: [{ name: 'Website v1 - build prompt.md', error: 'Disk full' }] }) };
  const f = await mount(s, { service: failing }); btn(f.el, 'Save to the project folder').click(); await settle();
  assert.deepEqual(alerts(f.el), ['Website v1 - build prompt.md: Disk full']); f.cleanup();
});

test('reloads on project-files-changed for this Space; cleanup removes listeners and ignores late results', async () => {
  const s = await atLock(); let reads = 0, release;
  const service = { ...s.service, getBuildKit: (...a) => { reads++; return reads === 1 ? s.service.getBuildKit(...a) : new Promise(r => { release = () => r(s.service.getBuildKit(...a)); }); } };
  const { el, cleanup } = await mount(s, { service });
  await s.service.saveBuildKit(s.job.spaceId, s.job.id); await settle(); assert.equal(reads, 2);   // saved elsewhere: reloads
  const controls = walk(el).filter(n => n.events.click); const shown = text(el);
  cleanup(); release(); await settle();
  assert.equal(text(el), shown); assert.ok(controls.every(n => !n.events.click));
  const before = reads; await s.service.saveBuildKit(s.job.spaceId, s.job.id); await settle(); assert.equal(reads, before);
});

test('site links: a refused link alerts and saves nothing; good links save, show as text with Copy link (#254)', async () => {
  const s = await atLock(), copied = [], { el, cleanup } = await mount(s, { clipboard: { writeText: async t => { copied.push(t); } } });
  const repo = (await s.service.getBuildKit(s.job.spaceId, s.job.id)).repo;
  const field = id => walk(el).find(n => n.attrs['data-focus'] === `link-${id}`);
  const type = (id, v) => { field(id).value = v; field(id).events.input(); };
  assert.ok(walk(part(el, 'Site links')).filter(n => n.tag === 'label').map(text).some(t => t.startsWith('Pull request link')));
  type('pr', 'https://github.com/someone-else/site/pull/1'); btn(el, 'Save links').click(); await settle();
  assert.equal(alerts(el).length, 1); assert.match(alerts(el)[0], /Paste the pull request link/);
  assert.equal((await s.service.getBuildKit(s.job.spaceId, s.job.id)).links, null);
  assert.equal(field('pr').value, 'https://github.com/someone-else/site/pull/1');   // what was typed stays to fix
  const pr = `https://github.com/Jaxsavvy/${repo}/pull/1`, preview = 'https://abc123.site-sample.pages.dev';
  type('pr', pr); type('preview', preview); btn(el, 'Save links').click(); await settle();
  const links = (await s.service.getBuildKit(s.job.spaceId, s.job.id)).links;
  assert.equal(links.pr, pr); assert.equal(links.preview, preview); assert.deepEqual(alerts(el), []);
  assert.match(text(part(el, 'Site links')), new RegExp(`Saved linksPull request: ${pr.replace(/[.]/g, '\\.')}Copy link`));
  assert.match(text(part(el, 'Site links')), /Saved [A-Z][a-z]{2} \d/);
  assert.equal(field('pr').value, pr); assert.equal(walk(el).some(n => n.tag === 'a'), false);
  walk(el).find(n => n.tag === 'button' && n.attrs['aria-label'] === 'Copy preview link').click(); await settle();
  assert.deepEqual(copied, [preview]); assert.match(text(part(el, 'Site links')), /Copied/);
  cleanup();
});
