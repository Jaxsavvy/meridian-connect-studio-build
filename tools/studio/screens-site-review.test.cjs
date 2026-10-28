'use strict';
// Tyler 29: Website Review screen (#218). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { fillStory, startSiteAtBuild } = require('./helpers/website-story.cjs');
const { mountCanvas } = require('../../src/renderer/studio/screens/site-review.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
const settle = async () => { for (let i = 0; i < 12; i++) await tick(); };
function dom() {
  const win = { listeners: {}, addEventListener(k, fn) { (this.listeners[k] ||= []).push(fn); },
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
const byFocus = (el, id) => walk(el).find(n => n.attrs['data-focus'] === id);
const type = (field, value) => { field.value = value; field.events.input(); };
const alerts = el => walk(el).filter(n => n.attrs.role === 'alert').map(text);
const summary = el => text(byFocus(el, 'summary'));
const send = (win, source, data) => { for (const fn of win.listeners.message || []) fn({ source, data }); };
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
async function mount(s, { stageId = 'review', service = s.service } = {}) {
  const d = dom(), cleanup = mountCanvas(d.el, { spaceId: s.job.spaceId, jobId: s.job.id, stageId, studio: { service } });
  await settle();
  const frame = walk(d.el).find(n => n.tag === 'iframe'); if (frame) frame.contentWindow = { name: 'preview' };
  return { ...d, frame, cleanup };
}
const good = { type: 'meridian-select', key: 'hero-headline', sectionId: 'hero' };

test('outside Review, or for a non-Website Job, it shows a plain empty state', async () => {
  const s = await atReview(), a = await mount(s, { stageId: 'check' });
  assert.match(text(a.el), /opens at the Review stage/); a.cleanup();
  const deck = createSampleService(); deck.setProjects([{ id: 'client-a', name: 'Client A' }]);
  const dj = await deck.startJob('client-a', 'pitch-deck', 'deck'), b = await mount({ service: deck, job: dj });
  assert.match(text(b.el), /Only Website Jobs have a site to review/); b.cleanup();
});

test('messages from another window, of the wrong type, with a bad ID or an unknown key do nothing; the sandbox is exactly allow-scripts', async () => {
  const s = await atReview(), m = await mount(s);
  assert.equal(m.frame.attrs.sandbox, 'allow-scripts');
  send(m.win, { name: 'other' }, good);
  send(m.win, m.frame.contentWindow, { ...good, type: 'meridian-open' });
  send(m.win, m.frame.contentWindow, { ...good, key: 'Hero-Headline' });
  send(m.win, m.frame.contentWindow, { ...good, sectionId: '../hero' });
  send(m.win, m.frame.contentWindow, { ...good, key: 'no-such-key' });
  send(m.win, m.frame.contentWindow, Object.assign(Object.create({ evil: true }), good));
  send(m.win, m.frame.contentWindow, 'meridian-select');
  assert.equal(byFocus(m.el, 'comment'), undefined); assert.deepEqual(alerts(m.el), []);
  send(m.win, m.frame.contentWindow, good);
  assert.match(text(m.el), /Comment on: Hero · Roofs done right/); assert.equal(m.doc.activeElement, byFocus(m.el, 'comment'));
  m.cleanup();
});

test('a selected item takes a comment; an empty comment is refused; the keyboard list selects too', async () => {
  const s = await atReview(), m = await mount(s);
  btn(m.el, 'Heading: Roofs done right').click(); assert.equal(m.doc.activeElement, byFocus(m.el, 'comment'));
  assert.equal(byFocus(m.el, 'comment').maxLength, 1000);
  type(byFocus(m.el, 'comment'), '   '); btn(m.el, 'Add comment').click(); await settle();
  assert.deepEqual(alerts(m.el), ['Write the comment first.']);
  assert.equal((await s.service.getReview(s.job.spaceId, s.job.id)).comments.length, 0);
  type(byFocus(m.el, 'comment'), 'Make the headline bigger.'); btn(m.el, 'Add comment').click(); await settle();
  const [c] = (await s.service.getReview(s.job.spaceId, s.job.id)).comments;
  assert.deepEqual({ pageId: c.pageId, sectionId: c.sectionId, key: c.key, text: c.text }, { pageId: 'home', sectionId: 'hero', key: 'hero-headline', text: 'Make the headline bigger.' });
  assert.match(summary(m.el), /^1 open · 0 answered$/); assert.equal(byFocus(m.el, 'comment').value, '');
  assert.match(text(walk(m.el).find(n => n.attrs['aria-label'] === 'Home · Hero')), /Make the headline bigger\./);
  assert.doesNotMatch(text(m.el), /\$|price|cost/i);
  m.cleanup();
});

test('Fixed and Keep as is need a note; check comments are labelled; the summary ends at Ready: send to Jax', async () => {
  const s = await atReview(), sp = s.job.spaceId, id = s.job.id;
  const a = await s.service.addReviewComment(sp, id, { pageId: 'home', sectionId: 'hero', key: 'hero-headline', text: 'Bigger headline' });
  const b = await s.service.addReviewComment(sp, id, { pageId: 'home', sectionId: 'hero', key: 'hero-body', text: 'Shorter body' });
  const check = { id: 'comment-x', source: 'check', pageId: null, sectionId: null, key: null, where: 'Home', text: 'The automatic check found: no description', resolved: null };
  const service = { ...s.service, getReview: async (...x) => { const r = await s.service.getReview(...x); return { ...r, comments: [...r.comments, check] }; } };
  const m = await mount(s, { service });
  assert.match(summary(m.el), /^3 open · 0 answered$/);
  assert.match(text(walk(m.el).find(n => n.attrs['aria-label'] === 'Home')), /no descriptionFrom the automatic check/);
  btn(m.el, 'Fixed: Bigger headline').click(); await settle();
  assert.deepEqual(alerts(m.el), ['Say what changed before marking it Fixed.']);
  type(byFocus(m.el, `note:${a.id}`), 'Raised it to the hero size.'); btn(m.el, 'Fixed: Bigger headline').click(); await settle();
  assert.match(summary(m.el), /^2 open · 1 answered$/); assert.equal(m.doc.activeElement, byFocus(m.el, `note:${b.id}`));
  assert.match(text(m.el), /Bigger headlineFixedNote: Raised it to the hero size\./);
  type(byFocus(m.el, `note:${b.id}`), 'The client wrote it.'); btn(m.el, 'Keep as is: Shorter body').click(); await settle();
  assert.match(text(m.el), /Shorter bodyKept as isNote: The client wrote it\./);
  m.cleanup();
  const done = await mount(s);   // without the extra check comment, nothing is open
  assert.match(summary(done.el), /^0 open · 2 answered$/); assert.match(text(done.el), /Ready: send to Jax/); done.cleanup();
});

test('service errors show as alerts; while waiting on Jax everything is read-only', async () => {
  const s = await atReview(), sp = s.job.spaceId, id = s.job.id;
  const c = await s.service.addReviewComment(sp, id, { pageId: 'home', sectionId: 'hero', key: 'hero-headline', text: 'Bigger' });
  const refuse = { ...s.service, resolveReviewComment: async () => { throw Error('The check still finds this: fix it and save the site, or choose Keep as is.'); } };
  const a = await mount(s, { service: refuse }); type(byFocus(a.el, `note:${c.id}`), 'Done'); btn(a.el, 'Fixed: Bigger').click(); await settle();
  assert.deepEqual(alerts(a.el), ['The check still finds this: fix it and save the site, or choose Keep as is.']); a.cleanup();
  await s.service.resolveReviewComment(sp, id, c.id, { kind: 'keep', note: 'Fine' }); await s.service.completeStage(sp, id);
  assert.equal((await s.service.getJob(sp, id)).waitingOnJax, true);
  const b = await mount(s);
  assert.match(text(b.el), /With Jax for review\./); assert.doesNotMatch(text(b.el), /Ready: send to Jax/);
  assert.equal(walk(b.el).some(n => n.tag === 'input' || n.tag === 'textarea'), false);
  assert.equal(btn(b.el, 'Heading: Roofs done right'), undefined);
  send(b.win, b.frame.contentWindow, good); assert.equal(byFocus(b.el, 'comment'), undefined);
  b.cleanup();
});

test('reloads on review-changed for this Job, ignores stale loads, and cleanup removes both listeners', async () => {
  const s = await atReview(); let reads = 0, release;
  const service = { ...s.service, getReview: (...a) => { reads++; return reads === 2 ? new Promise(r => { release = () => r(s.service.getReview(...a)); }) : s.service.getReview(...a); } };
  const m = await mount(s, { service }), sp = s.job.spaceId, id = s.job.id;
  await s.service.addReviewComment(sp, id, { pageId: 'home', sectionId: 'hero', key: 'hero-headline', text: 'First' }); await settle();   // load 2 hangs
  await s.service.addReviewComment(sp, id, { pageId: 'home', sectionId: 'hero', key: 'hero-body', text: 'Second' }); await settle();    // load 3 shows both
  assert.match(summary(m.el), /^2 open/); release(); await settle(); assert.match(summary(m.el), /^2 open/);
  const controls = walk(m.el).filter(n => n.events.click || n.events.input); assert.ok(controls.length >= 4);
  assert.equal(m.win.listeners.message.length, 1); m.cleanup();
  assert.equal(m.win.listeners.message.length, 0); assert.ok(controls.every(n => !n.events.click && !n.events.input));
  const before = reads; await s.service.addReviewComment(sp, id, { pageId: 'home', sectionId: 'hero', key: 'hero-button', text: 'Third' }); await settle();
  assert.equal(reads, before);
});

// The real site (#266): Review on the preview link.
const REAL = { ID: 'sample-home', REPO: 'site-sample-home-services', PREVIEW: 'https://3-abc.site-sample-home-services.pages.dev' };
async function atRealReview(opened) {
  const service = createSampleService({ practice: false, openWindow: async (url, title) => { opened.push([url, title]); return opened.answer || { success: true }; } });
  service.setProjects([{ id: REAL.ID, name: 'Sample Home Services' }]);
  const job = await service.startJob(REAL.ID, 'website', 'standard');
  await fillStory(service, REAL.ID, job.id);
  for (let guard = 0; guard < 20 && (await service.getJob(REAL.ID, job.id)).stageId !== 'lock'; guard++) {
    if ((await service.getJob(REAL.ID, job.id)).waitingOnJax) await service.approveStage(REAL.ID, job.id); else await service.completeStage(REAL.ID, job.id);
  }
  await service.completeStage(REAL.ID, job.id); await service.answerDesign(REAL.ID, job.id, { approved: true });
  await service.setBuildLinks(REAL.ID, job.id, { pr: `https://github.com/Jaxsavvy/${REAL.REPO}/pull/3`, preview: REAL.PREVIEW });
  await service.completeStage(REAL.ID, job.id);
  service.addPreviewChecks(REAL.ID, job.id, { flags: [], ran: ['site-screenshots', 'links-open'] });
  for (const f of (await service.getChecks(REAL.ID, job.id)).flags) await service.resolveFlag(REAL.ID, job.id, f.id, 'Checked.');
  await service.completeStage(REAL.ID, job.id);
  return { service, job };
}

test('the real site: pages, the preview link as text with Copy link and Open the preview, page and section comments, answers', async () => {
  const opened = [], s = await atRealReview(opened), copied = [];
  const d = dom(), cleanup = mountCanvas(d.el, { spaceId: REAL.ID, jobId: s.job.id, stageId: 'review', clipboard: { writeText: async t => { copied.push(t); } }, studio: { service: s.service } });
  await settle();
  const { el } = d, url = `${REAL.PREVIEW}/`;
  assert.equal(walk(el).some(n => n.tag === 'iframe' || n.tag === 'a'), false);
  assert.equal(btn(el, 'Desktop'), undefined);
  assert.deepEqual(walk(walk(el).find(n => n.tag === 'nav')).filter(n => n.tag === 'button').map(text), ['Home']);
  assert.match(text(el), new RegExp(`Preview link: ${url.replace(/[.]/g, '\\.')}`));
  btn(el, 'Copy link').click(); await settle(); assert.deepEqual(copied, [url]); assert.match(text(el), /Copied/);
  btn(el, 'Open the preview').click(); await settle(); assert.deepEqual(opened, [[url, 'Sample Home Services: Home']]);
  opened.answer = { success: false }; btn(el, 'Open the preview').click(); await settle();
  assert.match(alerts(el)[0], /couldn't open\. Copy the link/);
  const part = walk(el).find(n => n.tag === 'select');
  assert.deepEqual(part.children.map(o => [o.value, text(o)]), [['', 'The whole page'], ['hero', 'Hero']]);
  type(byFocus(el, 'comment'), 'The page feels long on a phone.'); btn(el, 'Add comment').click(); await settle();
  const again = walk(el).find(n => n.tag === 'select'); again.value = 'hero'; again.events.change();   // the screen redrew after the first comment
  type(byFocus(el, 'comment'), 'Make the call button bigger.'); btn(el, 'Add comment').click(); await settle();
  const comments = (await s.service.getReview(REAL.ID, s.job.id)).comments;
  assert.deepEqual(comments.map(c => [c.where, c.sectionId, c.text]), [['Home', null, 'The page feels long on a phone.'], ['Home · Hero', 'hero', 'Make the call button bigger.']]);
  assert.match(summary(el), /^2 open · 0 answered$/); assert.equal(byFocus(el, 'comment').value, '');
  assert.ok(walk(el).some(n => n.attrs['aria-label'] === 'Home · Hero'));
  const refuse = { ...s.service, addReviewComment: async () => { throw Error('That part of the site isn\'t on this page.'); } };
  cleanup();
  const r = dom(), off = mountCanvas(r.el, { spaceId: REAL.ID, jobId: s.job.id, stageId: 'review', studio: { service: refuse } }); await settle();
  type(byFocus(r.el, 'comment'), 'Keep this text.'); btn(r.el, 'Add comment').click(); await settle();
  assert.deepEqual(alerts(r.el), ['That part of the site isn\'t on this page.']); assert.equal(byFocus(r.el, 'comment').value, 'Keep this text.');
  off();
  const a = dom(), done = mountCanvas(a.el, { spaceId: REAL.ID, jobId: s.job.id, stageId: 'review', studio: { service: s.service } }); await settle();
  type(byFocus(a.el, `note:${comments[0].id}`), 'The client wants every section.'); btn(a.el, 'Keep as is: The page feels long on a phone.').click(); await settle();
  type(byFocus(a.el, `note:${comments[1].id}`), 'Bigger button, pushed to the PR.'); btn(a.el, 'Fixed: Make the call button bigger.').click(); await settle();
  assert.match(summary(a.el), /^0 open · 2 answered$/); assert.match(text(a.el), /Ready: send to Jax/);
  assert.doesNotMatch(text(a.el), /\$|price|cost/i);
  done();
});
