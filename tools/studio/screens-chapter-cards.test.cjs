'use strict';
// Tyler 21: Chapter cards board (#188). Synthetic data only (fillStory, "Sample Client").
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { fillStory } = require('./helpers/website-story.cjs');
const { mountCanvas } = require('../../src/renderer/studio/screens/chapter-cards.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
const settle = async () => { for (let i = 0; i < 8; i++) await tick(); };
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
const btn = (el, label) => walk(el).find(n => n.tag === 'button' && (n.attrs['aria-label'] || text(n)) === label);
const fieldOf = (el, label) => walk(el).find(n => n.tag === 'label' && n.children[0]?.textContent === label)?.children[1];
const set = (el, label, value) => { const f = fieldOf(el, label); f.value = value; (f.events.input || f.events.change)(); };
async function website({ tier = 'standard', stage = 'plan', fill = true } = {}) {
  const service = createSampleService(), job = await service.startJob('sample-client', 'website', tier);
  if (fill) await fillStory(service, job.spaceId, job.id);
  for (let guard = 0; guard < 12; guard++) {   // walk the Job to the stage under test (sample Jax approves his stages)
    const j = await service.getJob(job.spaceId, job.id); if (j.stageId === stage) break;
    if (j.waitingOnJax) await service.approveStage(job.spaceId, job.id); else await service.completeStage(job.spaceId, job.id);
  }
  return { service, job };
}
async function board(s, stageId, extra = {}) {
  const el = dom(), dirty = [];
  const cleanup = mountCanvas(el, { spaceId: s.job.spaceId, jobId: s.job.id, stageId, studio: { service: s.service, setDirty: v => dirty.push(v) }, ...extra });
  await settle(); return { el, dirty, cleanup };
}

test('Story and sitemap: pages and chapters can be added, moved and removed; Home stays; Save updates the gaps', async () => {
  const s = await website(), { el, dirty, cleanup } = await board(s, 'plan');
  assert.match(text(el), /Chapter cards: Story and sitemap/);
  assert.ok(fieldOf(el, 'Chapter name').tag === 'input' && fieldOf(el, 'Its one job').tag === 'textarea');
  assert.equal(fieldOf(el, 'Headline'), undefined);   // later stages' fields are hidden
  assert.equal(btn(el, 'Remove page Home'), undefined);   // Home always stays
  btn(el, 'Add chapter').click(); set(el, 'Chapter name', 'Services');
  assert.deepEqual(dirty, [true]); assert.match(text(el), /Unsaved changes/);
  btn(el, 'Move Chapter 2 up').click();   // typing doesn't redraw (focus stays in the box), so the list still says Chapter 2
  assert.equal(text(walk(el).find(n => n.tag === 'ol').children[0].children[0]), 'Services');
  btn(el, 'Add page').click(); set(el, 'Page name', 'About'); set(el, 'Path', '/about');
  btn(el, 'Save cards').click(); await settle();
  assert.equal(dirty.at(-1), false); btn(el, 'Home /').click(); assert.ok(btn(el, 'Move Services down'));   // the list catches up after the redraw
  const saved = await s.service.getStory(s.job.spaceId, s.job.id);
  assert.deepEqual(saved.pages.map(p => p.name), ['Home', 'About']); assert.deepEqual(saved.pages[0].chapters.map(c => c.name), ['Services', 'Hero']);
  const gaps = await s.service.getStoryGaps(s.job.spaceId, s.job.id, 'plan');
  assert.equal(walk(walk(el).find(n => n.tag === 'aside')).filter(n => n.tag === 'button').length, gaps.length);
  assert.ok(gaps.length > 0); assert.match(text(el), /About: Say what the page is for/);
  btn(el, 'About /about').click(); btn(el, 'Remove page About').click(); assert.equal(btn(el, 'About /about'), undefined);
  cleanup();
});

test('each stage shows its own fields; earlier ones are read-only and the structure is fixed', async () => {
  const s = await website({ stage: 'words' }), { el, cleanup } = await board(s, 'words');
  assert.equal(fieldOf(el, 'Chapter name').tag, 'p'); assert.equal(text(fieldOf(el, 'Its one job')), 'Make the visitor call for an estimate');
  assert.equal(fieldOf(el, 'Headline').value, 'Roofs done right'); assert.equal(fieldOf(el, 'Layout'), undefined);
  assert.equal(btn(el, 'Add chapter'), undefined); assert.equal(btn(el, 'Add page'), undefined);
  cleanup();
  const sb = await website({ stage: 'storyboard' }), b = await board(sb, 'storyboard');
  assert.equal(fieldOf(b.el, 'Headline').tag, 'p'); assert.equal(fieldOf(b.el, 'Layout').value, 'hero-photo');
  assert.equal(fieldOf(b.el, 'Kept asset'), undefined); assert.ok(btn(b.el, 'Add shot') && btn(b.el, 'Add proof'));
  b.cleanup();
});

test('Standard hides motion and video; Cinematic offers them', async () => {
  const std = await website({ stage: 'storyboard' }), a = await board(std, 'storyboard');
  assert.deepEqual(fieldOf(a.el, 'Motion').children.map(o => o.value), ['', 'none']);
  assert.deepEqual(fieldOf(a.el, 'Tool').children.map(o => o.value), ['', 'image']); a.cleanup();
  const cin = await website({ tier: 'cinematic', stage: 'storyboard' }), b = await board(cin, 'storyboard');
  assert.ok(fieldOf(b.el, 'Motion').children.some(o => o.value === 'parallax'));
  assert.ok(fieldOf(b.el, 'Tool').children.some(o => o.value === 'video')); b.cleanup();
});

test('Look offers only this Space\'s kept assets', async () => {
  const s = await website({ stage: 'look' });
  const loose = (await s.service.generateImage({ spaceId: s.job.spaceId, description: 'Not kept', count: 1 })).results[0].assetId;
  const other = (await s.service.generateImage({ spaceId: 'sandbox-me', description: 'Elsewhere', count: 1 })).results[0].assetId;
  await s.service.keepAsset('sandbox-me', other);
  const { el, cleanup } = await board(s, 'look'), pick = fieldOf(el, 'Kept asset');
  const offered = pick.children.map(o => o.value).filter(Boolean);
  const kept = (await s.service.listAssets(s.job.spaceId)).filter(a => a.kept).map(a => a.id);
  assert.deepEqual(offered.sort(), kept.sort()); assert.ok(!offered.includes(loose) && !offered.includes(other));
  assert.equal(fieldOf(el, 'Layout').tag, 'p');   // Storyboard fields are read-only here
  cleanup();
});

test('clicking a gap opens that card; with no gaps the panel says Ready', async () => {
  const s = await website({ fill: false });
  const story = await s.service.getStory(s.job.spaceId, s.job.id);
  story.pages[0].chapters = [{ name: 'Hero', job: 'Call us' }, { name: 'Proof' }];
  await s.service.saveStory(s.job.spaceId, s.job.id, story);
  const { el, cleanup } = await board(s, 'plan');
  walk(el).find(n => n.tag === 'button' && /Proof: Give the chapter one job/.test(text(n))).click();
  assert.match(text(el), /Editing: Proof/); assert.equal(fieldOf(el, 'Chapter name').value, 'Proof');
  assert.match(text(el), /Needs work/); cleanup();
  const full = await website({ stage: 'plan' }), b = await board(full, 'plan');
  assert.match(text(b.el), /Ready: mark the stage done/); b.cleanup();
});

test('locked after Look and assets is done; other states show plainly', async () => {
  const s = await website({ stage: 'build' }), { el, cleanup } = await board(s, 'look');
  assert.match(text(el), /locked: Look and assets is done/); assert.equal(btn(el, 'Save cards').disabled, true);
  assert.equal(fieldOf(el, 'Kept asset').disabled, true);
  await assert.rejects(s.service.saveStory(s.job.spaceId, s.job.id, await s.service.getStory(s.job.spaceId, s.job.id)), /locked/);
  cleanup();
  const other = await board(s, 'review'); assert.match(text(other.el), /Open a Website story stage/); other.cleanup();
  const deck = createSampleService(); deck.setProjects([{ id: 'client-a', name: 'Client A' }]);
  const dj = await deck.startJob('client-a', 'pitch-deck', 'deck');
  const failed = await board({ service: deck, job: dj }, 'plan'); assert.match(text(failed.el), /Only Website Jobs have chapter cards/); failed.cleanup();
  assert.doesNotMatch(text(el), /\$|price|cost/i);
});

test('cleanup removes listeners and clears the unsaved mark', async () => {
  const s = await website(), { el, dirty, cleanup } = await board(s, 'plan');
  set(el, 'Chapter name', 'Edited'); const controls = walk(el).filter(n => n.events.click || n.events.input || n.events.change);
  assert.ok(controls.length > 5); cleanup();
  assert.ok(controls.every(n => !n.events.click && !n.events.input && !n.events.change)); assert.equal(dirty.at(-1), false);
});
