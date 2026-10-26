'use strict';
// Tyler 12: pick who builds each stage when starting a workflow (#115).
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { createWorkflow, render } = require('../../src/renderer/studio/screens/workflow.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
function service() {
  const s = createSampleService(); s.setProjects([{ id: 'client-a', name: 'Client A' }]); return s;
}
function setup(workflowId, s = service()) {
  const views = [], routes = [];
  const model = createWorkflow({ service: s, spaceId: 'client-a', workflowId,
    report: view => views.push(view), navigate: (...route) => routes.push(route) });
  return { model, views, routes, service: s };
}
function dom() {
  const doc = { activeElement: null, createElement(tag) { return { tag, ownerDocument: doc, children: [], attrs: {}, events: {},
    setAttribute(k, v) { this.attrs[k] = v; }, append(...items) { this.children.push(...items); },
    appendChild(item) { this.append(item); }, replaceChildren(...items) { this.children = items; },
    addEventListener(k, fn) { this.events[k] = fn; }, removeEventListener(k, fn) { if (this.events[k] === fn) delete this.events[k]; },
    remove() {}, focus() { doc.activeElement = this; },
    click() { if (!this.disabled) this.events.click?.(); } }; } };
  return doc.createElement('main');
}
const walk = el => [el, ...el.children.flatMap(walk)];
const text = el => (el.textContent || '') + el.children.map(text).join('');
const pickers = el => walk(el).filter(n => n.tag === 'select');
const picker = (el, stageId) => pickers(el).find(n => n.name === `workflow-assign-${stageId}`);
const choose = (select, value) => { select.value = value; select.events.change(); };

test('picks reach startJob and show on the Job stages; unpicked stages stay unassigned', async () => {
  const s = setup('pitch-deck'); let sent;
  const startJob = s.service.startJob;
  s.model = createWorkflow({ service: { ...s.service, startJob: (...args) => { sent = args; return startJob(...args); } },
    spaceId: 'client-a', workflowId: 'pitch-deck', report: v => s.views.push(v), navigate: (...r) => s.routes.push(r) });
  await s.model.load();
  assert.deepEqual(s.views.at(-1).people.map(p => p.id), ['jax', 'tyler']);
  assert.equal(s.model.pick('research', 'tyler'), true); assert.equal(s.model.pick('home-t2', 'jax'), true);
  assert.equal(s.model.pick('home-t3', 'cassy'), false);   // not on the Pitch deck team
  s.model.pick('home-t2', ''); s.model.pick('home-t2', 'tyler');
  await s.model.start();
  assert.deepEqual(sent[3], { assignees: { research: 'tyler', 'home-t2': 'tyler' } });
  const [route, params] = s.routes[0]; assert.equal(route, 'work');
  const who = Object.fromEntries((await s.service.getJob('client-a', params.jobId)).stages.map(st => [st.id, st.assignee]));
  assert.equal(who.research, 'tyler'); assert.equal(who['home-t2'], 'tyler'); assert.equal(who['home-t1'], null);
});

test('Jax stages show Jax, disabled, and can\'t be changed', async () => {
  const s = setup('pitch-deck'); await s.model.load();
  assert.equal(s.model.pick('review', 'tyler'), false); assert.equal(s.model.pick('publish', 'tyler'), false);
  assert.deepEqual(s.views.at(-1).picks, {});
  const el = dom(); const cleanup = render(el, { spaceId: 'client-a', workflowId: 'pitch-deck' }, { service: service(), navigate() {} });
  await tick();
  for (const id of ['review', 'publish']) {
    const select = picker(el, id);
    assert.equal(select.disabled, true); assert.equal(select.value, 'jax'); assert.equal(text(select), 'Jax');
    assert.equal(select.events.change, undefined);
  }
  const research = picker(el, 'research');
  assert.deepEqual(research.children.map(text), ['Unassigned', 'Jax', 'Tyler']);   // never anyone else
  assert.equal(research.attrs['aria-label'], 'Who builds Research + write');
  assert.equal(pickers(el).length, 9); cleanup();
});

test('a second pitch deck in the same project shows the service error on screen', async () => {
  const s = service(); await s.startJob('client-a', 'pitch-deck', 'deck');
  const el = dom(), routes = [];
  const cleanup = render(el, { spaceId: 'client-a', workflowId: 'pitch-deck' }, { service: s, navigate: (...r) => routes.push(r) });
  await tick(); walk(el).find(n => n.tag === 'button' && text(n) === 'Start job').click(); await tick();
  const alert = walk(el).find(n => n.attrs.role === 'alert');
  assert.match(text(alert), /already has a pitch deck in progress/); assert.equal(routes.length, 0);
  assert.equal(picker(el, 'research').disabled, false); cleanup();
});

test('tier change keeps picks for stages that still exist and drops the rest', async () => {
  const s = setup('website'); await s.model.load(); s.model.choose('cinematic');
  s.model.pick('motion', 'cassy'); s.model.pick('plan', 'tyler');
  s.model.choose('standard'); assert.deepEqual(s.views.at(-1).picks, { plan: 'tyler' });
  s.model.choose('cinematic'); assert.deepEqual(s.views.at(-1).picks, { plan: 'tyler' });
  const el = dom(); const cleanup = render(el, { spaceId: 'client-a', workflowId: 'website' }, { service: service(), navigate() {} });
  await tick(); choose(picker(el, 'plan'), 'jax');
  const radio = walk(el).find(n => n.value === 'cinematic'); radio.checked = true; radio.events.change();
  assert.equal(picker(el, 'plan').value, 'jax'); assert.equal(picker(el, 'motion').value, '');
  cleanup();
});

test('busy state disables pickers and Start; focus stays on the changed picker', async () => {
  let release; const s = service();
  const busy = { ...s, startJob: () => new Promise(resolve => { release = resolve; }) };
  const el = dom(); const cleanup = render(el, { spaceId: 'client-a', workflowId: 'pitch-deck' }, { service: busy, navigate() {} });
  await tick(); const research = picker(el, 'research'); research.focus(); choose(research, 'tyler');
  assert.equal(el.ownerDocument.activeElement.name, 'workflow-assign-research');
  assert.equal(picker(el, 'research').value, 'tyler');
  walk(el).find(n => n.tag === 'button' && text(n) === 'Start job').click();
  assert.ok(pickers(el).every(n => n.disabled));
  assert.equal(walk(el).find(n => text(n) === 'Starting Job…').disabled, true);
  release(null); await tick(); cleanup();
});

test('cleanup removes listeners and late changes do nothing', async () => {
  const el = dom(), s = service();
  const cleanup = render(el, { spaceId: 'client-a', workflowId: 'pitch-deck' }, { service: s, navigate() {} });
  await tick(); const controls = walk(el).filter(n => n.events.change || n.events.click);
  assert.ok(controls.length > 0); cleanup();
  assert.ok(controls.every(n => !n.events.change && !n.events.click));
  assert.doesNotMatch(text(el), /\$|price|cost|deal value/i);
});
