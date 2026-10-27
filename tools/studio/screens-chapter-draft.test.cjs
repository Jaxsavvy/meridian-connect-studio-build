'use strict';
// Tyler 23: "Draft with Meridian" on the chapter cards, Words stage (#195). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { fillStory } = require('./helpers/website-story.cjs');
const { mountCanvas } = require('../../src/renderer/studio/screens/chapter-cards.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
const settle = async () => { for (let i = 0; i < 8; i++) await tick(); };
function dom() {
  const doc = { activeElement: null, createElement(tag) { return { tag, ownerDocument: doc, children: [], attrs: {}, events: {},
    setAttribute(k, v) { this.attrs[k] = v; }, append(...items) { this.children.push(...items); },
    appendChild(item) { this.append(item); }, replaceChildren(...items) { this.children = items; },
    addEventListener(k, fn) { this.events[k] = fn; }, removeEventListener(k, fn) { if (this.events[k] === fn) delete this.events[k]; },
    focus() { doc.activeElement = this; }, remove() {}, click() { if (!this.disabled) this.events.click?.(); } }; } };
  return doc.createElement('div');
}
const walk = el => [el, ...el.children.flatMap(walk)];
const text = el => (el.textContent || '') + el.children.map(text).join('');
const btn = (el, label) => walk(el).find(n => n.tag === 'button' && (n.attrs['aria-label'] || text(n)) === label);
const fieldOf = (el, label) => walk(el).find(n => n.tag === 'label' && n.children[0]?.textContent === label)?.children[1];
async function atStage(stage) {
  const service = createSampleService(), job = await service.startJob('sample-client', 'website', 'standard');
  await fillStory(service, job.spaceId, job.id);
  const story = await service.getStory(job.spaceId, job.id);   // a second chapter to switch to
  story.pages[0].chapters.push({ name: 'Services', job: 'Show what we fix', words: { headline: 'What we fix', body: 'Roofs and gutters.' } });
  await service.saveStory(job.spaceId, job.id, story);
  for (let guard = 0; guard < 8; guard++) {
    const j = await service.getJob(job.spaceId, job.id); if (j.stageId === stage) break;
    if (j.waitingOnJax) await service.approveStage(job.spaceId, job.id); else await service.completeStage(job.spaceId, job.id);
  }
  return { service, job };
}
async function board(s, stageId, service = s.service) {
  const el = dom(), dirty = [];
  const cleanup = mountCanvas(el, { spaceId: s.job.spaceId, jobId: s.job.id, stageId, studio: { service, setDirty: v => dirty.push(v) } });
  await settle(); return { el, dirty, cleanup };
}

test('the button shows only at Words, on the open chapter', async () => {
  for (const stage of ['plan', 'storyboard']) {
    const s = await atStage(stage), b = await board(s, stage);
    assert.equal(btn(b.el, 'Draft with Meridian'), undefined, stage); b.cleanup();
  }
  const s = await atStage('words'), { el, cleanup } = await board(s, 'words');
  assert.ok(btn(el, 'Draft with Meridian')); cleanup();
});

test('the card is unchanged until Use this; Use this fills the words, marks unsaved, and Save stores them', async () => {
  const s = await atStage('words'), calls = [];
  const service = { ...s.service, draftChapter: (...a) => { calls.push(a[2]); return s.service.draftChapter(...a); } };
  const { el, dirty, cleanup } = await board(s, 'words', service);
  btn(el, 'Draft with Meridian').click(); await settle();
  assert.deepEqual(calls, [{ page: 'Home', name: 'Hero', job: 'Make the visitor call for an estimate' }]);
  const offer = walk(el).find(n => n.attrs['aria-label'] === 'Meridian\'s draft');
  assert.match(text(offer), /Meridian suggestsHeadlineHero, done right the first time/);
  assert.equal(el.ownerDocument.activeElement, offer);   // focus moves to the proposal
  assert.equal(fieldOf(el, 'Headline').value, 'Roofs done right'); assert.deepEqual(dirty, []);   // nothing changed yet
  btn(el, 'Use this').click();
  assert.equal(fieldOf(el, 'Headline').value, 'Hero, done right the first time');
  assert.match(fieldOf(el, 'Body').value, /^Make the visitor call for an estimate\. We show up on time/);
  assert.equal(fieldOf(el, 'Button text').value, 'Get a free estimate');
  assert.deepEqual(dirty, [true]); assert.equal(el.ownerDocument.activeElement, btn(el, 'Draft with Meridian'));
  btn(el, 'Save cards').click(); await settle();
  const saved = (await s.service.getStory(s.job.spaceId, s.job.id)).pages[0].chapters[0].words;
  assert.equal(saved.headline, 'Hero, done right the first time'); assert.equal(dirty.at(-1), false);
  cleanup();
});

test('Discard, or opening another chapter, drops the draft and leaves the card as it was', async () => {
  const s = await atStage('words'), { el, dirty, cleanup } = await board(s, 'words');
  btn(el, 'Draft with Meridian').click(); await settle(); btn(el, 'Discard').click();
  assert.equal(walk(el).some(n => n.attrs['aria-label'] === 'Meridian\'s draft'), false);
  assert.equal(fieldOf(el, 'Headline').value, 'Roofs done right'); assert.deepEqual(dirty, []);
  assert.equal(el.ownerDocument.activeElement, btn(el, 'Draft with Meridian'));
  btn(el, 'Draft with Meridian').click(); await settle(); btn(el, 'Services').click();
  assert.equal(walk(el).some(n => n.attrs['aria-label'] === 'Meridian\'s draft'), false); assert.match(text(el), /Editing: Services/);
  cleanup();
});

test('an error shows the service message as an alert; the draft text is plain text', async () => {
  const s = await atStage('words');
  const soon = { ...s.service, draftChapter: async () => { throw Error('Coming soon with the real server.'); } };
  const a = await board(s, 'words', soon); btn(a.el, 'Draft with Meridian').click(); await settle();
  assert.ok(walk(a.el).some(n => n.attrs.role === 'alert' && text(n) === 'Coming soon with the real server.'));
  assert.equal(btn(a.el, 'Draft with Meridian').disabled, false); a.cleanup();
  let release; const slow = { ...s.service, draftChapter: () => new Promise(r => { release = r; }) };
  const b = await board(s, 'words', slow); btn(b.el, 'Draft with Meridian').click(); await settle();
  assert.equal(btn(b.el, 'Drafting…').disabled, true);   // disabled while drafting
  release({ draft: { headline: '<script>x</script>', body: '<b>hi</b>', button: 'Go' } }); await settle();
  assert.match(text(b.el), /<script>x<\/script>/); assert.doesNotMatch(text(b.el), /\$|price|cost/i);
  b.cleanup();
});

test('cleanup removes listeners', async () => {
  const s = await atStage('words'), { el, cleanup } = await board(s, 'words');
  btn(el, 'Draft with Meridian').click(); await settle();
  const controls = walk(el).filter(n => n.events.click || n.events.input || n.events.change);
  assert.ok(controls.some(n => text(n) === 'Use this')); cleanup();
  assert.ok(controls.every(n => !n.events.click && !n.events.input && !n.events.change));
});
