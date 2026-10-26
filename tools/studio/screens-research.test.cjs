'use strict';
// Tyler 16: Research stage screen (#129).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { evidenceRow, createResearch, render } = require('../../src/renderer/studio/screens/research.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
async function started() {
  const service = createSampleService(); service.setProjects([{ id: 'client-a', name: 'Client A' }]);
  const job = await service.startJob('client-a', 'pitch-deck', 'deck');
  return { service, job };
}
function setup(service, jobId) {
  const views = [];
  const model = createResearch({ service, spaceId: 'client-a', jobId, report: view => views.push(view) });
  return { model, views };
}
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
const find = (el, label) => walk(el).find(n => n.tag === 'button' && text(n) === label);
const settle = async () => { for (let i = 0; i < 6; i++) await tick(); };

test('run -> needs-match -> confirm -> done -> use research -> finish', async () => {
  const { service, job } = await started(), s = setup(service, job.id);
  await s.model.load();
  assert.equal(s.views.at(-1).research.status, 'not-started'); assert.equal(s.views.at(-1).canFinish, false);
  await s.model.run('roofer');
  const match = s.views.at(-1); assert.equal(match.research.status, 'needs-match'); assert.equal(match.canFinish, false);
  assert.equal(match.research.candidates.length, 2);
  await s.model.confirm(match.research.candidates[0].placeId);
  const done = s.views.at(-1); assert.equal(done.research.status, 'done'); assert.equal(done.canFinish, true);
  assert.deepEqual(done.research.score.parts.map(p => p.name), ['Reputation', 'Google profile', 'Website', 'Visibility']);
  assert.ok(done.gaps.includes('Rating compared with competitors'));
  await s.model.apply(); assert.deepEqual(s.views.at(-1).applied, { ok: true, errors: 0 });
  await s.model.finish(); assert.equal(s.views.at(-1).finished, true); assert.equal(s.views.at(-1).canFinish, false);
  const research = (await service.getJob('client-a', job.id)).stages.find(st => st.id === 'research');
  assert.equal(research.status, 'done');
});

test('evidence rows: source links, live Google values, plain text only', async () => {
  const link = { label: 'Google Maps', url: 'https://www.google.com/maps' };
  assert.equal(evidenceRow({ id: 'g', kind: 'google', subject: 'client', field: 'rating', method: 'api', source: link }).value, 'Live from Google Maps');
  assert.equal(evidenceRow({ id: 'w', kind: 'website', subject: 'client', field: 'https', value: true, method: 'page-read', source: link }).value, 'Yes');
  assert.equal(evidenceRow({ id: 'd', kind: 'demand', subject: 'market', field: 'monthlySearches', value: 1900, method: 'ai-estimate', source: link }).value, '~1,900');
  assert.equal(evidenceRow({ id: 'x', kind: 'census', field: 'population', value: 1, source: { label: 'x', url: 'javascript:alert(1)' } }), null);
  const { service, job } = await started();
  await service.startResearch('client-a', job.id, { category: 'roofer' });
  await service.confirmMatch('client-a', job.id, 'sample-place-you-0001');
  const real = await service.getResearch('client-a', job.id);
  const tricky = { ...service, getResearch: async () => ({ ...real,
    evidence: [...real.evidence, { id: 'ev-x', kind: 'census', subject: 'market', field: 'population', value: 5, method: 'census',
      source: { label: '<script>alert(1)</script>', url: 'https://data.census.gov/' } }] }) };
  const el = dom(); const cleanup = render(el, { spaceId: 'client-a', jobId: job.id }, { service: tricky, navigate() {} });
  await settle();
  const links = walk(el).filter(n => n.tag === 'a');
  assert.equal(links.length, real.evidence.length + 3);   // + the two live Google rows
  assert.ok(links.every(a => /^https?:\/\//.test(a.href) && a.rel === 'noopener noreferrer'));
  assert.ok(links.some(a => a.textContent === '<script>alert(1)</script>'));   // shown as text, never as HTML
  assert.match(text(el), /Live from Google Maps/); assert.match(text(el), /Score: \d+ of 100/);
  assert.match(text(el), /Reputation: \d+ of 30/);
  const source = fs.readFileSync(path.join(__dirname, '../../src/renderer/studio/screens/research.js'), 'utf8');
  assert.doesNotMatch(source, /innerHTML|insertAdjacentHTML|outerHTML/);
  assert.doesNotMatch(text(el), /\$|price|cost/i); cleanup();
});

test('a failed source shows as a gap, not a broken page; a failed run shows an alert', async () => {
  const { service, job } = await started();
  await service.startResearch('client-a', job.id, { category: 'roofer' });
  await service.confirmMatch('client-a', job.id, 'sample-place-you-0001');
  const real = await service.getResearch('client-a', job.id);
  const broken = { ...service, getResearch: async () => ({ ...real, evidence: [...real.evidence, { id: 'bad', kind: 'website', source: null }] }) };
  const s = setup(broken, job.id); await s.model.load();
  assert.equal(s.views.at(-1).state, 'ready'); assert.equal(s.views.at(-1).rows.length, real.evidence.length + 2);
  assert.ok(s.views.at(-1).gaps.includes('A source could not be shown'));
  const failed = { ...service, getResearch: async () => ({ ...real, status: 'failed', evidence: [], score: null }) };
  const el = dom(); const cleanup = render(el, { spaceId: 'client-a', jobId: job.id }, { service: failed, navigate() {} });
  await settle();
  assert.ok(walk(el).some(n => n.attrs.role === 'alert' && /couldn't finish/.test(text(n))));
  assert.equal(find(el, 'Run again').disabled, false); assert.equal(find(el, 'Finish Research + write').disabled, true);
  cleanup();
});

test('rendered: Finish stays disabled until research is done and matched; real sign-in says coming soon', async () => {
  const { service, job } = await started(), el = dom();
  const cleanup = render(el, { spaceId: 'client-a', jobId: job.id }, { service, navigate() {} });
  assert.match(text(el), /Loading research/); await settle();
  assert.equal(find(el, 'Finish Research + write').disabled, true);
  const input = walk(el).find(n => n.tag === 'input'); input.value = 'roofer'; input.events.input();
  find(el, 'Run research').click(); await settle();
  assert.match(text(el), /Pick the right one/); assert.equal(find(el, 'Finish Research + write').disabled, true);
  find(el, 'This one').click(); await settle();
  assert.equal(find(el, 'Finish Research + write').disabled, false);
  find(el, 'Use this research').click(); await settle(); assert.match(text(el), /Research is in the deck/);
  find(el, 'Finish Research + write').click(); await settle(); assert.match(text(el), /Research \+ write is finished/);
  cleanup();
  const soon = { ...service, getResearch: async () => { throw Error('Coming soon with the real server.'); } };
  const other = dom(); const done = render(other, { spaceId: 'client-a', jobId: job.id }, { service: soon, navigate() {} });
  await settle(); assert.match(text(other), /Coming soon with the real server/); done();
});

test('cleanup removes listeners and stops listening for research changes', async () => {
  const { service, job } = await started(), el = dom(); let reads = 0;
  const counting = { ...service, getResearch: (...a) => { reads++; return service.getResearch(...a); } };
  const cleanup = render(el, { spaceId: 'client-a', jobId: job.id }, { service: counting, navigate() {} });
  await settle(); const controls = walk(el).filter(n => n.events.click || n.events.input);
  assert.ok(controls.length > 0); cleanup();
  assert.ok(controls.every(n => !n.events.click && !n.events.input));
  const before = reads; await service.startResearch('client-a', job.id, { category: 'roofer' }); await settle();
  assert.equal(reads, before);
});
