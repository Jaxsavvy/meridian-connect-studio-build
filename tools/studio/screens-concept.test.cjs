'use strict';
// Tyler 32: Concept screen (#232). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { mountCanvas } = require('../../src/renderer/studio/screens/concept.js');
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
const input = (el, id) => walk(el).find(n => n.attrs['data-focus'] === id);
const type = (el, id, value) => { const i = input(el, id); i.value = value; i.events.input(); };
const enter = (el, word) => { const i = input(el, 'mood-input'); i.value = word; i.events.keydown({ key: 'Enter' }); };
const alerts = el => walk(el).filter(n => n.attrs.role === 'alert').map(text);
async function atConcept() {
  const service = createSampleService(), job = await service.startJob('sample-client', 'website', 'standard');
  await service.completeStage(job.spaceId, job.id); await service.approveStage(job.spaceId, job.id);   // Kickoff
  return { service, job };
}
async function mount(s, { stageId = 'concept', service = s.service } = {}) {
  const el = dom(), dirty = [];
  const cleanup = mountCanvas(el, { spaceId: s.job.spaceId, jobId: s.job.id, stageId, studio: { service, setDirty: v => dirty.push(v) } });
  await settle(); return { el, dirty, cleanup };
}
async function fillAll(m) {
  type(m.el, 'line', 'A roof that shrugs off the rain'); type(m.el, 'audience', 'Homeowners in the valley'); type(m.el, 'goal', 'Book a roof check');
  for (const i of [0, 1, 2]) { type(m.el, `ref-url-${i}`, `https://example.com/ref-${i + 1}`); type(m.el, `ref-note-${i}`, 'Clear call button'); }
  for (const w of ['calm', 'sturdy', 'local']) enter(m.el, w);
}

test('outside Concept, or for a non-Website Job, it shows a plain empty state', async () => {
  const s = await atConcept(), a = await mount(s, { stageId: 'plan' });
  assert.match(text(a.el), /opens at the Concept stage/); a.cleanup();
  const deck = createSampleService(); deck.setProjects([{ id: 'client-a', name: 'Client A' }]);
  const dj = await deck.startJob('client-a', 'pitch-deck', 'deck'), b = await mount({ service: deck, job: dj });
  assert.match(text(b.el), /Only Website Jobs have a concept/); b.cleanup();
});

test('every field is labelled with its limit; Draft with Meridian fills the form without saving', async () => {
  const s = await atConcept(); let release;
  const service = { ...s.service, draftConcept: (...a) => new Promise(r => { release = () => r(s.service.draftConcept(...a)); }) };
  const m = await mount(s, { service });
  assert.equal(input(m.el, 'line').maxLength, 140); assert.equal(input(m.el, 'audience').maxLength, 200); assert.equal(input(m.el, 'ref-note-0').maxLength, 160);
  assert.ok(walk(m.el).filter(n => n.tag === 'input').every(i => walk(m.el).some(l => l.tag === 'label' && l.children.includes(i))));
  assert.match(text(m.el), /Name it as a place or feeling, like 'a roof that shrugs off the rain'\./);
  btn(m.el, 'Draft with Meridian').click(); assert.equal(btn(m.el, 'Working…').disabled, true);
  release(); await settle();
  assert.match(input(m.el, 'line').value, /the calm after one phone call/);
  assert.match(text(m.el), /Meridian's draft: check it, add the reference sites, then Save\./);
  assert.equal(input(m.el, 'ref-url-0').value, ''); assert.deepEqual(m.dirty, [true]);
  assert.equal((await s.service.getConcept(s.job.spaceId, s.job.id)).line, '');   // nothing saved
  m.cleanup();
  const soon = await mount(s, { service: { ...s.service, draftConcept: async () => { throw Error('Coming soon with the real server.'); } } });
  btn(soon.el, 'Draft with Meridian').click(); await settle();
  assert.deepEqual(alerts(soon.el), ['Coming soon with the real server.']); soon.cleanup();
});

test('a bad link is refused; a partial save shows Still needed; a complete one is Ready to send to Jax', async () => {
  const s = await atConcept(), m = await mount(s);
  type(m.el, 'line', 'A roof that shrugs off the rain'); type(m.el, 'ref-url-0', 'http://example.com');
  btn(m.el, 'Save').click(); await settle();
  assert.deepEqual(alerts(m.el), ['Reference site 1: use a full https:// link.']);
  assert.equal((await s.service.getConcept(s.job.spaceId, s.job.id)).line, '');
  type(m.el, 'ref-url-0', ''); btn(m.el, 'Save').click(); await settle();
  assert.equal((await s.service.getConcept(s.job.spaceId, s.job.id)).line, 'A roof that shrugs off the rain');
  assert.match(text(m.el), /Still needed: Say who the site is for\./);
  assert.match(text(walk(m.el).find(n => n.attrs['aria-label'] === 'Still needed')), /Add 3 reference sites \(0 so far\)/);
  assert.equal(m.dirty.at(-1), false);
  enter(m.el, 'bad!word'); assert.deepEqual(alerts(m.el), ['Mood words: letters, spaces and dashes only.']);
  await fillAll(m); assert.equal(m.el.ownerDocument.activeElement, input(m.el, 'mood-input'));
  btn(m.el, 'Remove local').click(); enter(m.el, 'local');
  btn(m.el, 'Save').click(); await settle();
  assert.match(text(m.el), /Ready to send to Jax/); assert.doesNotMatch(text(m.el), /Still needed/);
  assert.doesNotMatch(text(m.el), /\$|price|cost/i);
  m.cleanup();
});

test('reference links are plain text, never links; once with Jax it is read-only', async () => {
  const s = await atConcept(), m = await mount(s); await fillAll(m); btn(m.el, 'Save').click(); await settle(); m.cleanup();
  await s.service.completeStage(s.job.spaceId, s.job.id);
  const ro = await mount(s);
  assert.match(text(ro.el), /With Jax/); assert.match(text(ro.el), /https:\/\/example\.com\/ref-1Clear call button/);
  assert.equal(walk(ro.el).some(n => n.tag === 'a'), false);
  assert.equal(walk(ro.el).some(n => n.tag === 'input' || n.tag === 'button'), false);
  ro.cleanup();
  await s.service.approveStage(s.job.spaceId, s.job.id);
  const done = await mount(s); assert.match(text(done.el), /Approved/); assert.equal(walk(done.el).some(n => n.tag === 'a'), false); done.cleanup();
});

test('reloads on concept-changed when nothing is unsaved; cleanup removes listeners and ignores late results', async () => {
  const s = await atConcept(); let reads = 0, release;
  const service = { ...s.service, getConcept: (...a) => { reads++; return s.service.getConcept(...a); },
    draftConcept: (...a) => new Promise(r => { release = () => r(s.service.draftConcept(...a)); }) };
  const m = await mount(s, { service });
  await s.service.saveConcept(s.job.spaceId, s.job.id, { line: 'Saved elsewhere' }); await settle();
  assert.equal(input(m.el, 'line').value, 'Saved elsewhere');
  type(m.el, 'goal', 'Typing here'); const before = reads;
  await s.service.saveConcept(s.job.spaceId, s.job.id, { line: 'Another save' }); await settle();
  assert.equal(reads, before); assert.equal(input(m.el, 'goal').value, 'Typing here');   // unsaved work stays
  btn(m.el, 'Draft with Meridian').click();
  const controls = walk(m.el).filter(n => n.events.click || n.events.input || n.events.keydown); assert.ok(controls.length >= 10);
  m.cleanup(); release(); await settle();
  assert.ok(controls.every(n => !n.events.click && !n.events.input && !n.events.keydown)); assert.equal(m.dirty.at(-1), false);
});
