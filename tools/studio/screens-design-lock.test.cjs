'use strict';
// Tyler 35: Design lock screen (#241). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { fillStory } = require('./helpers/website-story.cjs');
const { mountCanvas, safeUrl } = require('../../src/renderer/studio/screens/design-lock.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
const settle = async () => { for (let i = 0; i < 12; i++) await tick(); };
function dom(answer = true) {
  const win = { asked: [], confirm(m) { this.asked.push(m); return answer; } };
  const doc = { activeElement: null, defaultView: win, createElement(tag) { return { tag, ownerDocument: doc, children: [], attrs: {}, events: {},
    setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; }, append(...items) { this.children.push(...items); },
    appendChild(item) { this.append(item); }, replaceChildren(...items) { this.children = items; },
    addEventListener(k, fn) { this.events[k] = fn; }, removeEventListener(k, fn) { if (this.events[k] === fn) delete this.events[k]; },
    focus() { doc.activeElement = this; }, remove() {}, click() { if (!this.disabled) this.events.click?.(); } }; } };
  return { el: doc.createElement('div'), win };
}
const walk = el => [el, ...el.children.flatMap(walk)];
const text = el => (el.textContent || '') + el.children.map(text).join('');
const btn = (el, label) => walk(el).find(n => n.tag === 'button' && text(n) === label);
const part = (el, label) => walk(el).find(n => n.tag === 'section' && n.attrs['aria-label'] === label);
const alerts = el => walk(el).filter(n => n.attrs.role === 'alert').map(text);
const status = el => text(walk(el).find(n => n.className === 'studio-design-lock-status'));
// A Website Job at Design lock with two chapters (both with kept storyboard frames).
async function atLock() {
  const service = createSampleService(), job = await service.startJob('sample-client', 'website', 'standard'), sp = job.spaceId;
  await fillStory(service, sp, job.id);
  const story = await service.getStory(sp, job.id), first = story.pages[0].chapters[0];
  story.pages[0].chapters.push({ ...first, id: 'services', name: 'Services' }); await service.saveStory(sp, job.id, story);
  for (let guard = 0; guard < 12; guard++) {
    const j = await service.getJob(sp, job.id); if (j.stageId === 'lock') break;
    if (j.stageId === 'storyboard' && !j.waitingOnJax) {
      const b = await service.makeStoryboardFrame(sp, job.id, { pageId: 'home', chapterId: 'services' });
      await service.keepStoryboardFrame(sp, job.id, { pageId: 'home', chapterId: 'services', frameId: b.chapters[1].frames[0].id });
    }
    if (j.waitingOnJax) await service.approveStage(sp, job.id); else await service.completeStage(sp, job.id);
  }
  return { service, job };
}
async function mount(s, { stageId = 'lock', service = s.service, answer } = {}) {
  const d = dom(answer), cleanup = mountCanvas(d.el, { spaceId: s.job.spaceId, jobId: s.job.id, stageId, studio: { service } });
  await settle(); return { ...d, cleanup };
}

test('outside Design lock, or for a non-Website Job, it shows a plain empty state', async () => {
  const s = await atLock(), a = await mount(s, { stageId: 'build' });
  assert.match(text(a.el), /Design lock opens at the Design lock stage/); a.cleanup();
  const deck = createSampleService(); deck.setProjects([{ id: 'client-a', name: 'Client A' }]);
  const dj = await deck.startJob('client-a', 'pitch-deck', 'deck'), b = await mount({ service: deck, job: dj });
  assert.match(text(b.el), /Only Website Jobs have a design to lock/); b.cleanup();
});

test('the design shows the concept, the frames in order, the look frame and the swatches; ready to send', async () => {
  const s = await atLock(), { el, cleanup } = await mount(s);
  assert.equal(status(el), 'With the team'); assert.match(text(el), /Ready to send to Jax/);
  assert.match(text(part(el, 'Concept')), /A roof that shrugs off the rainMood: calm, sturdy, local/);
  assert.deepEqual(walk(part(el, 'Film strip')).filter(n => n.tag === 'figcaption').map(text), ['Hero', 'Services']);
  assert.deepEqual(walk(part(el, 'Film strip')).filter(n => n.tag === 'img').map(n => n.attrs.alt), ['Storyboard frame: Hero', 'Storyboard frame: Services']);
  assert.ok(walk(part(el, 'Look frame')).some(n => n.tag === 'img' && n.attrs.alt === 'Chosen look frame'));
  const swatches = walk(part(el, 'Style numbers')).filter(n => n.className === 'studio-design-lock-swatch');
  assert.ok(swatches.length >= 3); assert.match(swatches[0].attrs.style, /^background-color: #[0-9a-f]{6}$/i);
  assert.match(text(part(el, 'Style numbers')), /accent #[0-9a-f]{6}.*Headings: .+ · Body: .+/i);
  assert.doesNotMatch(text(el), /\$|price|cost/i);
  cleanup();
});

test('sent: approve as the client moves the Job to Build; history and Approved show', async () => {
  const s = await atLock(); await s.service.completeStage(s.job.spaceId, s.job.id);
  const { el, cleanup } = await mount(s);
  assert.equal(status(el), 'With the client · Version 1'); assert.ok(part(el, 'Practice: answer as the client'));
  btn(el, 'Approve the design').click(); await settle();
  assert.equal((await s.service.getJob(s.job.spaceId, s.job.id)).stageId, 'build');
  assert.equal(status(el), 'Approved by the client'); assert.equal(btn(el, 'Approve the design'), undefined);
  assert.match(text(part(el, 'History')), /Version 1 · Approved · Client/);
  cleanup();
});

test('ask for changes needs a note; with one it comes back to the team, and Send back reopens the stage picked', async () => {
  const s = await atLock(); await s.service.completeStage(s.job.spaceId, s.job.id);
  const m = await mount(s);
  btn(m.el, 'Ask for changes').click(); await settle();
  assert.deepEqual(alerts(m.el), ['Say what the client wants changed.']); assert.equal((await s.service.getJob(s.job.spaceId, s.job.id)).waitingOnJax, true);
  const note = walk(m.el).find(n => n.attrs['data-focus'] === 'note'); assert.equal(note.maxLength, 1000);
  note.value = 'Warmer photos, please.'; note.events.input(); btn(m.el, 'Ask for changes').click(); await settle();
  assert.match(text(part(m.el, 'The client asked for changes')), /Warmer photos, please\./);
  assert.match(text(part(m.el, 'History')), /Version 1 · Changes asked · Warmer photos, please\. · Client/);
  const select = walk(m.el).find(n => n.tag === 'select');
  assert.deepEqual(select.children.map(o => o.value), ['brief', 'concept', 'plan', 'words', 'storyboard', 'look']);
  select.value = 'look'; select.events.change(); m.cleanup();
  const no = await mount(s, { answer: false }); const sel = walk(no.el).find(n => n.tag === 'select'); sel.value = 'look'; sel.events.change();
  btn(no.el, 'Send back').click(); await settle();
  assert.match(no.win.asked[0], /^Send the Job back to Look and assets\?/); assert.equal((await s.service.getJob(s.job.spaceId, s.job.id)).stageId, 'lock'); no.cleanup();
  const yes = await mount(s); const sel2 = walk(yes.el).find(n => n.tag === 'select'); sel2.value = 'look'; sel2.events.change();
  btn(yes.el, 'Send back').click(); await settle();
  assert.equal((await s.service.getJob(s.job.spaceId, s.job.id)).stageId, 'look');
  yes.cleanup();
});

test('unsafe image URLs never render; cleanup removes listeners and ignores late results', async () => {
  for (const url of ['javascript:alert(1)', 'http://example.test/a.png', 'data:text/html,x']) assert.equal(safeUrl(url), false, url);
  const s = await atLock();
  const bad = { ...s.service, listJobAssets: async (...a) => { const out = await s.service.listJobAssets(...a); [...out.storyboard, ...out.look].forEach(x => { x.url = 'javascript:alert(1)'; }); return out; } };
  const a = await mount(s, { service: bad });
  assert.equal(walk(a.el).some(n => n.tag === 'img'), false); assert.ok(walk(a.el).filter(n => text(n) === 'No frame yet').length >= 3); a.cleanup();
  let reads = 0, release;
  const late = { ...s.service, getDesignLock: (...x) => { reads++; return reads === 1 ? s.service.getDesignLock(...x) : new Promise(r => { release = () => r(s.service.getDesignLock(...x)); }); } };
  const m = await mount(s, { service: late }); const shown = text(m.el);
  await s.service.completeStage(s.job.spaceId, s.job.id); await settle();   // jobs-changed + design-changed start a reload…
  const controls = walk(m.el).filter(n => n.events.click || n.events.change || n.events.input);
  m.cleanup(); release(); await settle();   // …that finishes after cleanup
  assert.equal(text(m.el), shown); assert.ok(controls.every(n => !n.events.click && !n.events.change && !n.events.input));
});
