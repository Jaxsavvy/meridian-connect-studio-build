'use strict';
// Tyler 28: Look frame picker (#211). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { mountCanvas, safeUrl } = require('../../src/renderer/studio/screens/look-frames.js');
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
const cards = el => walk(el).filter(n => n.tag === 'li' && String(n.className).includes('studio-look-frames-card'));
const box = (el, name) => walk(el).find(n => n.tag === 'label' && text(n).endsWith(name)).children[0];
const alerts = el => walk(el).filter(n => n.attrs.role === 'alert').map(text);
// A Website Job at Look and assets with a finished storyboard and no look frame yet.
async function atLook() {
  const service = createSampleService(), job = await service.startJob('sample-client', 'website', 'standard'), sp = job.spaceId;
  await require('./helpers/website-story.cjs').fillConcept(service, sp, job.id);   // Core #229: the Concept gate
  await service.saveStory(sp, job.id, { pages: [{ id: 'home', name: 'Home', path: '/', purpose: 'Get estimate calls', chapters: [{ id: 'hero', name: 'Hero',
    job: 'Make the visitor call', words: { headline: 'Roofs done right', body: 'Licensed crews across the valley.', button: 'Call now' },
    layout: 'hero-photo', motion: 'none', phone: 'Photo above the headline', shots: [{ what: 'Crew on a finished roof', prompt: 'Roofing crew', size: 'wide', tool: 'image' }] }] }] });
  for (let guard = 0; guard < 8; guard++) {
    const j = await service.getJob(sp, job.id); if (j.stageId === 'look') break;
    if (j.waitingOnJax) await service.approveStage(sp, job.id); else await service.completeStage(sp, job.id);
  }
  return { service, job };
}
async function mount(s, { stageId = 'look', service = s.service, clipboard } = {}) {
  const el = dom(), cleanup = mountCanvas(el, { spaceId: s.job.spaceId, jobId: s.job.id, stageId, clipboard, studio: { service } });
  await settle(); return { el, cleanup };
}

test('outside Look, or for a non-Website Job, it shows a plain empty state', async () => {
  const s = await atLook(), a = await mount(s, { stageId: 'storyboard' });
  assert.match(text(a.el), /open at the Look and assets stage/); assert.equal(btn(a.el, 'Design the look with Meridian'), undefined); a.cleanup();
  const deck = createSampleService(); deck.setProjects([{ id: 'client-a', name: 'Client A' }]);
  const dj = await deck.startJob('client-a', 'pitch-deck', 'deck'), b = await mount({ service: deck, job: dj });
  assert.match(text(b.el), /Only Website Jobs have a look to pick/); b.cleanup();
});

test('makes frames for the ticked directions, disabled while running; making more keeps the old ones', async () => {
  const s = await atLook(), asked = []; let release;
  const service = { ...s.service, makeLookFrames: (sp, j, o) => { asked.push(o.directions); return new Promise(r => { release = () => r(s.service.makeLookFrames(sp, j, o)); }); } };
  const { el, cleanup } = await mount(s, { service });
  assert.match(text(el), /No look frames yet/);
  const premium = box(el, 'Premium and editorial'); premium.checked = false; premium.events.change();
  btn(el, 'Design the look with Meridian').click(); assert.equal(btn(el, 'Designing…').disabled, true);
  release(); await settle();
  assert.deepEqual(asked, [['bold', 'warm']]);
  assert.deepEqual(cards(el).map(c => walk(c).find(n => n.tag === 'img').attrs.alt), ['Look frame: Bold and confident', 'Look frame: Warm and trusted']);
  assert.equal(walk(el).some(n => n.attrs['aria-label'] === 'Shot list'), false);
  assert.equal(el.ownerDocument.activeElement, btn(el, 'Design the look with Meridian'));
  for (const name of ['Bold and confident', 'Warm and trusted']) { const b = box(el, name); b.checked = false; b.events.change(); }
  box(el, 'Premium and editorial').checked = true; box(el, 'Premium and editorial').events.change();
  btn(el, 'Design the look with Meridian').click(); release(); await settle();
  assert.deepEqual(asked.at(-1), ['premium']); assert.equal(cards(el).length, 3);
  assert.doesNotMatch(text(el), /\$|price|cost/i);
  cleanup();
});

test('picking a frame marks it Chosen and keeps focus there; the shot list follows; Copy prompt uses the clipboard', async () => {
  const s = await atLook(); await s.service.makeLookFrames(s.job.spaceId, s.job.id, { directions: ['bold', 'warm'] });
  const copied = [], { el, cleanup } = await mount(s, { clipboard: { writeText: async t => { copied.push(t); } } });
  btn(el, 'Pick this look: Warm and trusted').click(); await settle();
  const warm = cards(el)[1];
  assert.match(text(warm), /Warm and trustedChosen/); assert.doesNotMatch(text(cards(el)[0]), /Chosen/);
  assert.equal(btn(el, 'Pick this look: Warm and trusted').attrs['aria-pressed'], 'true');
  assert.equal(el.ownerDocument.activeElement, btn(el, 'Pick this look: Warm and trusted'));
  const shots = walk(el).find(n => n.attrs['aria-label'] === 'Shot list'), [shot] = await s.service.getShotPrompts(s.job.spaceId, s.job.id);
  assert.match(text(shots), /Crew on a finished roofStill to make/);
  assert.equal(walk(shots).find(n => n.tag === 'textarea').readOnly, true);
  btn(el, 'Copy prompt: Crew on a finished roof').click(); await settle();
  assert.deepEqual(copied, [shot.prompt]); assert.match(text(shots), /Copied/);
  cleanup();
  const broken = await mount(s, { clipboard: { writeText: async () => { throw Error('denied'); } } });
  btn(broken.el, 'Copy prompt: Crew on a finished roof').click(); await settle();
  assert.match(text(broken.el), /Couldn't copy\. Select the prompt and copy it\./); broken.cleanup();
});

test('unsafe image URLs never render', async () => {
  for (const url of ['javascript:alert(1)', 'http://example.test/a.png', 'data:text/html,<b>x</b>', 'file:///etc/passwd']) assert.equal(safeUrl(url), false, url);
  assert.equal(safeUrl('https://example.test/a.png'), true); assert.equal(safeUrl('data:image/png;base64,AAAA'), true);
  const s = await atLook(); await s.service.makeLookFrames(s.job.spaceId, s.job.id, { directions: ['bold', 'warm'] });
  const bad = ['javascript:alert(1)', 'http://example.test/a.png'];
  const service = { ...s.service, listJobAssets: async (...a) => { const out = await s.service.listJobAssets(...a); out.look.forEach((x, i) => { x.url = bad[i]; }); return out; } };
  const { el, cleanup } = await mount(s, { service });
  assert.equal(cards(el).length, 2); assert.equal(walk(el).some(n => n.tag === 'img'), false);
  assert.equal(walk(el).filter(n => text(n) === 'Image not available.').length, 2);
  cleanup();
});

test('service errors show as alerts; no directions is refused; a done stage is read-only', async () => {
  const s = await atLook();
  const soon = { ...s.service, makeLookFrames: async () => { throw Error('Coming soon with the real server.'); } };
  const a = await mount(s, { service: soon });
  btn(a.el, 'Design the look with Meridian').click(); await settle();
  assert.deepEqual(alerts(a.el), ['Coming soon with the real server.']); assert.equal(btn(a.el, 'Design the look with Meridian').disabled, false);
  for (const name of ['Bold and confident', 'Warm and trusted', 'Premium and editorial']) { const b = box(a.el, name); b.checked = false; b.events.change(); }
  btn(a.el, 'Design the look with Meridian').click(); await settle(); assert.deepEqual(alerts(a.el), ['Tick at least one direction.']);
  a.cleanup();
  await s.service.makeLookFrames(s.job.spaceId, s.job.id, { directions: ['bold'] });
  const done = { ...s.service, getJob: async (...x) => { const j = await s.service.getJob(...x); return { ...j, stages: j.stages.map(st => (st.id === 'look' ? { ...st, status: 'done' } : st)) }; } };
  const b = await mount(s, { service: done });
  assert.match(text(b.el), /The look is locked/); assert.equal(cards(b.el).length, 1);
  assert.equal(walk(b.el).some(n => n.tag === 'button' || n.tag === 'input'), false);
  b.cleanup();
});

test('reloads on look-changed for this Job; cleanup removes listeners and ignores late results', async () => {
  const s = await atLook(); let reads = 0;
  const service = { ...s.service, getLook: (...a) => { reads++; return s.service.getLook(...a); } };
  const { el, cleanup } = await mount(s, { service });
  await s.service.makeLookFrames(s.job.spaceId, s.job.id, { directions: ['bold'] }); await settle();
  assert.equal(cards(el).length, 1);   // frames made elsewhere show up here
  const controls = walk(el).filter(n => n.events.click || n.events.change); assert.ok(controls.length >= 4);
  cleanup(); assert.ok(controls.every(n => !n.events.click && !n.events.change));
  const before = reads; await s.service.makeLookFrames(s.job.spaceId, s.job.id, { directions: ['warm'] }); await settle(); assert.equal(reads, before);
});
