'use strict';
// Tyler 14: Home page builder tool, three tiers, home page only (#122).
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { buildPage, createBuilder, mountCanvas } = require('../../src/renderer/studio/tools/pitch-deck/homepage-builder.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
async function started(name = 'Client A') {
  const service = createSampleService(); service.setProjects([{ id: 'client-a', name }]);
  const job = await service.startJob('client-a', 'pitch-deck', 'deck');
  await service.completeStage('client-a', job.id, 'research');   // opens the three home pages side by side
  return { service, job };
}
function setup(service, jobId, stageId) {
  const views = [], dirty = [];
  const model = createBuilder({ service, spaceId: 'client-a', jobId, stageId, report: view => views.push(view), onDirty: v => dirty.push(v) });
  return { model, views, dirty };
}
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
const find = (el, label) => walk(el).find(n => n.tag === 'button' && text(n) === label);

test('each tier builds its own layout, each a step up, all with the concept line', () => {
  const dna = { colors: ['#112233', '#44aa88'], fonts: ['Inter', 'Inter'], audience: 'Local homeowners' };
  const [t1, t2, t3] = [1, 2, 3].map(tier => buildPage({ tier, name: 'Client A', headline: 'Fixed fast', dna }));
  for (const [i, page] of [t1, t2, t3].entries()) {
    assert.match(page, new RegExp(`data-tier="${i + 1}"`));
    assert.match(page, /Concept for discussion, not affiliated with Client A/);
    assert.match(page, /<h1>Fixed fast<\/h1>/);
  }
  assert.match(t1, /Get in touch/); assert.doesNotMatch(t1, /class="(story|booking)/);
  assert.match(t2, /class="story/); assert.match(t2, /class="booking/); assert.doesNotMatch(t2, /class="video/);
  assert.match(t3, /class="story/); assert.match(t3, /class="video/); assert.match(t3, /animation-timeline:view\(\)/);
  assert.doesNotMatch(t1 + t2, /animation-timeline/);
  assert.match(t3, /prefers-reduced-motion/);
  for (const page of [t1, t2, t3]) assert.doesNotMatch(page, /\$|price|cost/i);   // no money anywhere
});

test('project text is escaped; bad colors and fonts fall back', () => {
  const name = '<script>alert(1)</script> & "Co"';
  const page = buildPage({ tier: 2, name, headline: '<img src=x onerror=alert(1)>',
    dna: { colors: ['red;}</style><script>x()</script>'], fonts: ['"Evil"; }'], audience: '<b>Owners</b>', services: ['<i>Roofs</i>'] } });
  assert.doesNotMatch(page, /<script>alert|<img src=x|<b>|<i>Roofs|x\(\)<\/script>|"Evil"/);
  assert.match(page, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; &quot;Co&quot;/);
  assert.match(page, /&lt;i&gt;Roofs&lt;\/i&gt;/); assert.match(page, /color:#0b1f3a/);
});

test('Finish saves the page to the project folder, then completes only this tier', async () => {
  const { service, job } = await started(), calls = [];
  const spy = { ...service,
    saveToProjectFiles: (...a) => { calls.push('save'); return service.saveToProjectFiles(...a); },
    completeStage: (...a) => { calls.push('complete'); return service.completeStage(...a); } };
  const s = setup(spy, job.id, 'home-t2'); await s.model.load();
  assert.equal(s.views.at(-1).tier, 2); assert.equal(s.views.at(-1).open, true);
  await s.model.finish();
  assert.deepEqual(calls, ['save', 'complete']); assert.equal(s.views.at(-1).done, true);
  const files = await service.listProjectFiles('client-a');
  assert.ok(files.some(f => /Home page Tier 2\.html$/.test(f.name)));
  const status = Object.fromEntries((await service.getJob('client-a', job.id)).stages.map(st => [st.id, st.status]));
  assert.equal(status['home-t2'], 'done'); assert.equal(status['home-t1'], 'current'); assert.equal(status['home-t3'], 'current');
  await s.model.finish(); assert.match(s.views.at(-1).error, /isn't open/);
});

test('a failed project-folder save stops Finish before the stage completes', async () => {
  const { service, job } = await started(); let completed = false;
  const spy = { ...service, saveToProjectFiles: async () => ({ saved: [], failed: ['x'] }), completeStage: async () => { completed = true; } };
  const s = setup(spy, job.id, 'home-t1'); await s.model.load(); await s.model.finish();
  assert.equal(completed, false); assert.match(s.views.at(-1).error, /project folder/);
});

test('Meridian drafts the headline; nothing changes until the person accepts', async () => {
  const { service, job } = await started();
  const s = setup(service, job.id, 'home-t1'); await s.model.load();
  assert.equal(s.views.at(-1).headline, 'Client A');
  await s.model.draft(); assert.match(s.views.at(-1).proposal, /Client A/); assert.equal(s.views.at(-1).headline, 'Client A');
  s.model.accept(); assert.match(s.views.at(-1).headline, /done right/); assert.match(s.views.at(-1).html, /done right/);
  assert.deepEqual(s.dirty, [true]); s.model.edit('My own words'); assert.equal(s.views.at(-1).headline, 'My own words');
});

test('loading, empty, failed and offline states; upcoming stage cannot finish', async () => {
  const service = createSampleService(); service.setProjects([{ id: 'client-a', name: 'Client A' }]);
  const job = await service.startJob('client-a', 'pitch-deck', 'deck');
  const upcoming = setup(service, job.id, 'home-t3'); await upcoming.model.load();
  assert.equal(upcoming.views[0].state, 'loading'); assert.equal(upcoming.views.at(-1).open, false);
  assert.equal(upcoming.model.edit('x'), false);
  const empty = setup(service, job.id, 'research'); await empty.model.load(); assert.equal(empty.views.at(-1).state, 'empty');
  const failed = setup({ ...service, getJob: async () => { throw Error('nope'); } }, job.id, 'home-t1');
  await failed.model.load(); assert.equal(failed.views.at(-1).state, 'failed');
  const offline = setup({ ...service, getSpace: async () => { throw Object.assign(Error('x'), { code: 'OFFLINE' }); } }, job.id, 'home-t1');
  await offline.model.load(); assert.equal(offline.views.at(-1).state, 'offline'); assert.match(offline.views.at(-1).message, /offline/);
});

test('rendered tool: sandboxed preview without same-origin, Finish works, cleanup removes listeners', async () => {
  const { service, job } = await started(), el = dom(), dirty = [];
  const cleanup = mountCanvas(el, { spaceId: 'client-a', jobId: job.id, stageId: 'home-t3', studio: { service, setDirty: v => dirty.push(v) } });
  assert.match(text(el), /Loading home page/); await tick();
  const frame = walk(el).find(n => n.tag === 'iframe');
  assert.equal(frame.attrs.sandbox, 'allow-scripts'); assert.doesNotMatch(frame.attrs.sandbox, /same-origin/);
  assert.match(frame.srcdoc, /data-tier="3"/); assert.match(frame.srcdoc, /not affiliated with Client A/);
  find(el, 'Draft headline with Meridian').click(); await tick();
  find(el, 'Use this headline').click(); assert.deepEqual(dirty, [true]);
  find(el, 'Finish stage').click(); await tick(); await tick();
  assert.match(text(el), /This tier is finished/); assert.equal(find(el, 'Finish stage').disabled, true);
  const controls = walk(el).filter(n => n.events.click || n.events.change); assert.ok(controls.length > 0);
  cleanup(); assert.ok(controls.every(n => !n.events.click && !n.events.change));
});
