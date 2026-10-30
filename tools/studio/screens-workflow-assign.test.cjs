'use strict';
// Tyler 12: pick who builds each stage when starting a workflow (#115). ASSIGN-MANY 2026-10-29 (Jax): up to three
// people per stage, a checkbox each, and the stages Jax approves can be handed off too (he still approves them).
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
const boxes = el => walk(el).filter(n => n.tag === 'input' && n.type === 'checkbox');
const box = (el, stageId, personId) => boxes(el).find(n => n.name === `workflow-assign-${stageId}-${personId}`);
const tickBox = (input, on) => { input.checked = on; input.events.change(); };

test('picks reach startJob and show on the Job stages; unpicked stages stay unassigned', async () => {
  const s = setup('pitch-deck'); let sent;
  const startJob = s.service.startJob;
  s.model = createWorkflow({ service: { ...s.service, startJob: (...args) => { sent = args; return startJob(...args); } },
    spaceId: 'client-a', workflowId: 'pitch-deck', report: v => s.views.push(v), navigate: (...r) => s.routes.push(r) });
  await s.model.load();
  assert.deepEqual(s.views.at(-1).people.map(p => p.id), ['jax', 'tyler', 'cassy']);
  assert.equal(s.model.pick('research', 'tyler'), true); assert.equal(s.model.pick('home-t2', 'jax'), true);
  assert.equal(s.model.pick('home-t3', 'stranger'), false);   // not on the Pitch deck team
  s.model.pick('home-t2', ''); s.model.pick('home-t2', 'tyler');
  assert.equal(s.model.pick('research', 'jax', true), true);   // two people on one stage
  await s.model.start();
  assert.deepEqual(sent[3], { assignees: { research: ['tyler', 'jax'], 'home-t2': ['tyler'] } });
  const [route, params] = s.routes[0]; assert.equal(route, 'pitch-deck', 'a new deck opens its own Job screen');
  const stages = (await s.service.getJob('client-a', params.jobId)).stages, of = id => stages.find(st => st.id === id);
  assert.deepEqual(of('research').assignees, ['tyler', 'jax']); assert.equal(of('research').assignee, 'tyler');
  assert.deepEqual(of('home-t2').assignees, ['tyler']); assert.equal(of('home-t1').assignee, null); assert.deepEqual(of('home-t1').assignees, []);
  assert.deepEqual(of('review').assignees, ['jax'], 'a Jax stage nobody picked is his');
});

test('stages Jax approves can be handed off; he still approves them', async () => {
  const s = setup('website'); await s.model.load();
  for (const id of ['brief', 'concept', 'storyboard', 'lock']) assert.equal(s.model.pick(id, 'tyler'), true, id);
  s.model.pick('brief', 'cassy');
  assert.deepEqual(s.views.at(-1).picks.brief, ['tyler', 'cassy']);
  const el = dom(); const cleanup = render(el, { spaceId: 'client-a', workflowId: 'website' }, { service: service(), navigate() {} });
  await tick();
  const kickoff = box(el, 'brief', 'tyler');
  assert.equal(kickoff.disabled, false); assert.equal(kickoff.checked, false);
  assert.match(text(walk(el).find(n => n.tag === 'fieldset' && n.attrs['aria-label'] === 'Who builds Kickoff')), /Jax, unless you pick someone/);
  tickBox(kickoff, true); tickBox(box(el, 'brief', 'cassy'), true);
  assert.equal(box(el, 'brief', 'tyler').checked, true); assert.equal(box(el, 'brief', 'cassy').checked, true);
  assert.match(text(el), /Jax approves/);
  cleanup();
});

test('up to three people per stage; the pitch deck team is Jax, Tyler and Cassy', async () => {
  const s = setup('website'); await s.model.load();
  for (const id of ['jax', 'tyler', 'cassy']) assert.equal(s.model.pick('plan', id), true);
  assert.deepEqual(s.views.at(-1).picks.plan, ['jax', 'tyler', 'cassy']);
  assert.equal(s.model.pick('plan', 'tyler'), true, 'picking again takes them off');
  assert.deepEqual(s.views.at(-1).picks.plan, ['jax', 'cassy']);
  await assert.rejects(s.service.startJob('client-a', 'website', 'standard', { assignees: { plan: ['jax', 'tyler', 'cassy', 'jax'] } }), /up to 3/);
  const el = dom(); const cleanup = render(el, { spaceId: 'client-a', workflowId: 'pitch-deck' }, { service: service(), navigate() {} });
  await tick();
  assert.deepEqual(boxes(el).filter(n => n.name.startsWith('workflow-assign-research-')).map(n => n.value), ['jax', 'tyler', 'cassy']);   // never anyone else
  assert.equal(boxes(el).length, 9 * 3); cleanup();
});

test('a second pitch deck in the same project shows the service error on screen', async () => {
  const s = service(); await s.startJob('client-a', 'pitch-deck', 'deck');
  const el = dom(), routes = [];
  const cleanup = render(el, { spaceId: 'client-a', workflowId: 'pitch-deck' }, { service: s, navigate: (...r) => routes.push(r) });
  await tick(); walk(el).find(n => n.tag === 'button' && text(n) === 'Start job').click(); await tick();
  const alert = walk(el).find(n => n.attrs.role === 'alert');
  assert.match(text(alert), /already has a pitch deck in progress/); assert.equal(routes.length, 0);
  assert.equal(box(el, 'research', 'tyler').disabled, false); cleanup();
});

test('tier change keeps picks for stages that still exist and drops the rest', async () => {
  const s = setup('website'); await s.model.load(); s.model.choose('cinematic');
  s.model.pick('motion', 'cassy'); s.model.pick('plan', 'tyler');
  s.model.choose('standard'); assert.deepEqual(s.views.at(-1).picks, { plan: ['tyler'] });
  s.model.choose('cinematic'); assert.deepEqual(s.views.at(-1).picks, { plan: ['tyler'] });
  const el = dom(); const cleanup = render(el, { spaceId: 'client-a', workflowId: 'website' }, { service: service(), navigate() {} });
  await tick(); tickBox(box(el, 'plan', 'jax'), true);
  const radio = walk(el).find(n => n.value === 'cinematic'); radio.checked = true; radio.events.change();
  assert.equal(box(el, 'plan', 'jax').checked, true); assert.equal(box(el, 'motion', 'cassy').checked, false);
  cleanup();
});

test('busy state disables pickers and Start; focus stays on the changed picker', async () => {
  let release; const s = service();
  const busy = { ...s, startJob: () => new Promise(resolve => { release = resolve; }) };
  const el = dom(); const cleanup = render(el, { spaceId: 'client-a', workflowId: 'pitch-deck' }, { service: busy, navigate() {} });
  await tick(); const research = box(el, 'research', 'tyler'); research.focus(); tickBox(research, true);
  assert.equal(el.ownerDocument.activeElement.name, 'workflow-assign-research-tyler');
  assert.equal(box(el, 'research', 'tyler').checked, true);
  walk(el).find(n => n.tag === 'button' && text(n) === 'Start job').click();
  assert.ok(boxes(el).every(n => n.disabled));
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
