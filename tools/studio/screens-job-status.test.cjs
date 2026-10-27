'use strict';
// Tyler 31: the Job page shows where the site stands (#224). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { fillStory, startSiteAtBuild } = require('./helpers/website-story.cjs');
const { render } = require('../../src/renderer/studio/screens/job.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
const settle = async () => { for (let i = 0; i < 10; i++) await tick(); };
function dom() {
  const doc = { createElement(tag) { return { tag, ownerDocument: doc, children: [], attrs: {}, events: {},
    setAttribute(k, v) { this.attrs[k] = v; }, append(...items) { this.children.push(...items); },
    appendChild(item) { this.append(item); }, replaceChildren(...items) { this.children = items; },
    addEventListener(k, fn) { this.events[k] = fn; }, remove() {}, click() { this.events.click?.(); } }; } };
  return doc.createElement('main');
}
const walk = el => [el, ...el.children.flatMap(walk)];
const text = el => (el.textContent || '') + el.children.map(text).join('');
// The "Where it stands" lines of one stage card, by the card's heading.
const standing = (el, name) => {
  const card = walk(el).find(n => n.tag === 'li' && n.children[0]?.tag === 'h2' && n.children[0].textContent === name);
  return card ? walk(card).filter(n => n.className === 'studio-job-standing' || n.className === 'studio-job-failed').map(text) : null;
};
async function show(service, job) {
  const el = dom(), cleanup = render(el, { spaceId: job.spaceId, jobId: job.id }, { service, navigate() {} });
  await settle(); return { el, cleanup };
}
async function walkTo(service, job, stageId) {
  for (let guard = 0; guard < 14; guard++) {
    const j = await service.getJob(job.spaceId, job.id); if (j.stageId === stageId) return;
    await startSiteAtBuild(service, job.spaceId, job.id);
    if (j.waitingOnJax) await service.approveStage(job.spaceId, job.id); else await service.completeStage(job.spaceId, job.id);
  }
}

test('each later stage shows where the site stands, before and after', async () => {
  const service = createSampleService(), job = await service.startJob('sample-client', 'website', 'standard'), sp = job.spaceId;
  const a = await show(service, job);
  assert.deepEqual(standing(a.el, 'Look and assets'), ['No look chosen yet']);
  assert.deepEqual(standing(a.el, 'Build'), ['Not built yet']);
  assert.deepEqual(standing(a.el, 'Check'), ['Not checked yet', 'Phone and outside links run in Connect after a real sign-in']);
  assert.deepEqual(standing(a.el, 'Review'), ['No comments yet']);
  a.cleanup();
  await fillStory(service, sp, job.id); await walkTo(service, job, 'review');   // fillStory picks the Bold look
  const b = await show(service, job);
  assert.deepEqual(standing(b.el, 'Look and assets'), ['Look: Bold and confident']);
  assert.deepEqual(standing(b.el, 'Build'), ['Site: 1 page']);
  assert.equal(standing(b.el, 'Check')[0], 'All clear');
  await service.addReviewComment(sp, job.id, { pageId: 'home', sectionId: 'hero', key: 'hero-headline', text: 'Bigger' });
  const c = await service.addReviewComment(sp, job.id, { pageId: 'home', sectionId: 'hero', key: 'hero-body', text: 'Shorter' });
  await settle(); assert.deepEqual(standing(b.el, 'Review'), ['2 of 2 still open']);   // reloads on review-changed
  const all = (await service.getReview(sp, job.id)).comments;
  for (const x of all) await service.resolveReviewComment(sp, job.id, x.id, { kind: 'keep', note: 'Fine' });
  await settle(); assert.deepEqual(standing(b.el, 'Review'), ['2 comments · all answered']); assert.ok(c);
  assert.doesNotMatch(text(b.el), /\$|price|cost/i);
  b.cleanup();
});

test('Check shows flags to review and explained', async () => {
  const service = createSampleService(), job = await service.startJob('sample-client', 'website', 'standard');
  const stub = { ...service, getChecks: async () => ({ ranAt: '2026-10-27T10:00:00Z', notRun: [],
    flags: [{ id: 'a', resolved: null }, { id: 'b', resolved: null }, { id: 'c', resolved: { note: 'ok' } }] }) };
  const { el, cleanup } = await show(stub, job);
  assert.deepEqual(standing(el, 'Check'), ['2 to review · 1 explained']); cleanup();
});

test('a Pitch deck Job only asks for its checks', async () => {
  const service = createSampleService(); service.setProjects([{ id: 'client-a', name: 'Client A' }]);
  const job = await service.startJob('client-a', 'pitch-deck', 'deck'), asked = [];
  const spy = { ...service };
  for (const name of ['getChecks', 'getSite', 'getReview', 'getLook']) spy[name] = (...a) => { asked.push(name); return service[name](...a); };
  const { el, cleanup } = await show(spy, job);
  assert.deepEqual([...new Set(asked)], ['getChecks']);
  assert.equal(standing(el, 'Review').length, 0);   // a deck's Review card has no site status
  assert.deepEqual(standing(el, 'Auto check'), ['Not checked yet', 'Phone and outside links run in Connect after a real sign-in']);
  cleanup();
});

test('one failing part says so in its own card and the page still works; cleanup stops reloads', async () => {
  const service = createSampleService(), job = await service.startJob('sample-client', 'website', 'standard'); let jobs = 0;
  const broken = { ...service, getSite: async () => { throw Error('down'); }, getJob: (...a) => { jobs++; return service.getJob(...a); } };
  const { el, cleanup } = await show(broken, job);
  assert.deepEqual(standing(el, 'Build'), ['Couldn\'t load this']);
  assert.deepEqual(standing(el, 'Look and assets'), ['No look chosen yet']); assert.deepEqual(standing(el, 'Review'), ['No comments yet']);
  assert.match(text(el), /Open in Work/);
  cleanup(); const before = jobs;
  await fillStory(service, job.spaceId, job.id); await settle(); assert.equal(jobs, before);
});
