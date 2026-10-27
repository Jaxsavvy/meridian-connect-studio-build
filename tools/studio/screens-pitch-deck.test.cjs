'use strict';
// Tyler 13 part 1: Pitch Deck page, the locked stage list (#116). Synthetic "Client A" only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { render } = require('../../src/renderer/studio/screens/pitch-deck.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
const settle = async () => { for (let i = 0; i < 8; i++) await tick(); };
function dom() {
  const doc = { createElement(tag) { return { tag, ownerDocument: doc, children: [], attrs: {}, events: {},
    setAttribute(k, v) { this.attrs[k] = v; }, append(...items) { this.children.push(...items); },
    appendChild(item) { this.append(item); }, replaceChildren(...items) { this.children = items; },
    addEventListener(k, fn) { this.events[k] = fn; }, removeEventListener(k, fn) { if (this.events[k] === fn) delete this.events[k]; },
    remove() {}, click() { if (!this.disabled) this.events.click?.(); } }; } };
  return doc.createElement('main');
}
const walk = el => [el, ...el.children.flatMap(walk)];
const text = el => (el.textContent || '') + el.children.map(text).join('');
const find = (el, label) => walk(el).find(n => n.tag === 'button' && (n.attrs['aria-label'] || text(n)) === label);
const stageItem = (el, name) => walk(el).find(n => n.tag === 'li' && n.children[0]?.children?.[0]?.textContent === name);
const status = (el, name) => text(stageItem(el, name).children[0].children[1]);
async function setup({ override = s => s, params = {}, clock } = {}) {
  const service = createSampleService(clock ? { now: () => clock.t } : {}); service.setProjects([{ id: 'client-a', name: 'Client A' }]);
  const job = await service.startJob('client-a', 'pitch-deck', 'deck');
  const el = dom(), routes = [], mounts = [];
  const studio = { service: override(service), navigate: (...r) => routes.push(r), mountInto: (...m) => mounts.push(m) };
  const cleanup = render(el, { spaceId: 'client-a', jobId: job.id, ...params }, studio);
  await settle(); return { service, job, el, routes, mounts, cleanup };
}

test('the stage list is locked, with builders: Jax and Tyler only; Jax stages fixed', async () => {
  const { el, service, job, cleanup } = await setup();
  const list = walk(el).find(n => n.tag === 'ol');
  assert.equal(list.children.length, 9); assert.equal(walk(list).filter(n => n.tag === 'button' && /move|up|down|edit|delete/i.test(text(n))).length, 0);
  const picker = name => walk(stageItem(el, name)).find(n => n.tag === 'select');
  assert.deepEqual(picker('Research + write').children.map(text), ['Unassigned', 'Jax', 'Tyler']);   // never Cassy
  for (const name of ['Review', 'Publish']) { assert.equal(picker(name).disabled, true); assert.equal(picker(name).value, 'jax'); }
  const p = picker('Home page: Tier 2'); p.value = 'tyler'; p.events.change(); await settle();
  assert.equal((await service.getJob('client-a', job.id)).stages.find(st => st.id === 'home-t2').assignee, 'tyler');
  assert.equal(picker('Home page: Tier 2').value, 'tyler');
  assert.doesNotMatch(text(el), /\$|price|cost|deal|pipeline|approve/i);
  cleanup();
});

test('Research + write can\'t finish until the deck passes; the service message shows', async () => {
  const { el, service, job, routes, cleanup } = await setup();
  assert.equal(status(el, 'Research + write'), 'Open');
  find(el, 'Open research').click(); assert.deepEqual(routes[0], ['research', { spaceId: 'client-a', jobId: job.id }]);
  find(el, 'Finish Research + write').click(); await settle();
  assert.ok(walk(el).some(n => n.attrs.role === 'alert' && /Research \+ write isn't done yet/.test(text(n))));
  assert.equal(status(el, 'Research + write'), 'Open');
  await service.useSampleResearch('client-a', job.id); find(el, 'Finish Research + write').click(); await settle();
  assert.equal(status(el, 'Research + write'), 'Done');
  cleanup();
});

test('the three home pages open together and finish separately; Assemble opens after all three', async () => {
  const clock = { t: Date.parse('2026-10-27T09:00:00Z') };
  const { el, service, job, routes, cleanup } = await setup({ clock });
  await service.useSampleResearch('client-a', job.id); clock.t += 7 * 60000;
  await service.completeStage('client-a', job.id, 'research'); await settle();
  assert.match(text(stageItem(el, 'Research + write')), /Took 7 min/);
  for (const n of [1, 2, 3]) assert.equal(status(el, `Home page: Tier ${n}`), 'Open');
  find(el, 'Open Home page: Tier 2').click(); assert.deepEqual(routes.at(-1), ['pitch-deck', { spaceId: 'client-a', jobId: job.id, open: 'home-t2' }]);
  find(el, 'Finish Home page: Tier 2').click(); await settle();
  assert.equal(status(el, 'Home page: Tier 2'), 'Done'); assert.equal(status(el, 'Home page: Tier 1'), 'Open');
  assert.equal(status(el, 'Assemble board'), 'Not open yet');
  find(el, 'Finish Home page: Tier 1').click(); await settle(); find(el, 'Finish Home page: Tier 3').click(); await settle();
  assert.equal(status(el, 'Assemble board'), 'Open');
  cleanup();
});

test('Open mounts the Home page builder for that tier in the workspace', async () => {
  const { mounts, job, el, cleanup } = await setup({ params: { open: 'home-t3' } });
  assert.equal(mounts.length, 1); const [, kind, id, ctx] = mounts[0];
  assert.deepEqual([kind, id, ctx], ['tool', 'homepage-builder', { spaceId: 'client-a', jobId: job.id, stageId: 'home-t3' }]);
  assert.match(text(el), /Home page: Tier 3/);
  const plain = await setup({ params: { open: 'research' } }); assert.equal(plain.mounts.length, 0); plain.cleanup();
  cleanup();
});

test('Review shows Send to Review; Publish stays with Jax; no approve buttons', async () => {
  const fakeJob = async (service, jobId, current) => {
    const real = await service.getJob('client-a', jobId);
    return { ...real, openStageIds: [current], stages: real.stages.map(st => ({ ...st, status: st.id === current ? 'current' : 'upcoming' })) };
  };
  let finished;
  const { el, cleanup } = await setup({ override: s => ({ ...s, getJob: (sp, id) => fakeJob(s, id, 'review'),
    completeStage: async (...a) => { finished = a; } }) });
  find(el, 'Send to Review').click(); await settle(); assert.equal(finished[2], 'review');
  assert.equal(walk(el).some(n => n.tag === 'button' && /approve/i.test(text(n))), false);
  cleanup();
  const pub = await setup({ override: s => ({ ...s, getJob: (sp, id) => fakeJob(s, id, 'publish') }) });
  assert.match(text(stageItem(pub.el, 'Publish')), /Jax publishes it\./);
  assert.equal(walk(stageItem(pub.el, 'Publish')).some(n => n.tag === 'button'), false);
  pub.cleanup();
});

test('Auto check flags show on the Auto check stage; Mark OK sends the note', async () => {
  const flags = [{ id: 'f1', check: 'links', message: 'A link didn\'t open', where: 'market.stats.0.source.url', resolved: false },
    { id: 'f2', check: 'deck', message: 'Checked already', where: 'demand', resolved: true }];
  let resolved;
  const { el, cleanup } = await setup({ override: s => ({ ...s, getChecks: async () => ({ ranAt: null, flags, notRun: [], log: [] }),
    resolveFlag: async (...a) => { resolved = a; } }) });
  const check = stageItem(el, 'Auto check');
  assert.match(text(check), /A link didn't open/); assert.match(text(check), /Resolved/);
  const note = walk(check).find(n => n.tag === 'input'); note.value = 'Opens in a browser'; note.events.input();
  find(el, 'Mark OK: A link didn\'t open').click(); await settle();
  assert.deepEqual(resolved.slice(2), ['f1', 'Opens in a browser']);
  cleanup();
});

test('a Job that isn\'t a pitch deck shows a message; cleanup removes listeners and the subscription', async () => {
  const other = await setup({ override: s => ({ ...s, getJob: async (sp, id) => ({ ...(await s.getJob(sp, id)), workflowId: 'website' }) }) });
  assert.match(text(other.el), /isn't a pitch deck/); other.cleanup();
  let reads = 0;
  const { el, service, job, cleanup } = await setup({ override: s => ({ ...s, getJob: (...a) => { reads++; return s.getJob(...a); } }) });
  const controls = walk(el).filter(n => n.events.click || n.events.change || n.events.input);
  assert.ok(controls.length > 5); cleanup();
  assert.ok(controls.every(n => !n.events.click && !n.events.change && !n.events.input));
  const before = reads; await service.assignStage('client-a', job.id, 'research', 'jax'); await settle();
  assert.equal(reads, before);
});
