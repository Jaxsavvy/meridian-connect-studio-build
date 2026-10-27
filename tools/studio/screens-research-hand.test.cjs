'use strict';
// Tyler 21: type in research by hand on the Research screen (#164). Synthetic place IDs and sources only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { render } = require('../../src/renderer/studio/screens/research.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
const settle = async () => { for (let i = 0; i < 6; i++) await tick(); };
const ME = 'ChIJtestClient0001', RIVAL = 'ChIJtestRival00001', SRC = 'https://example.com/source';
async function started(override = s => s) {
  const service = createSampleService(); service.setProjects([{ id: 'client-a', name: 'Client A' }]);
  const job = await service.startJob('client-a', 'pitch-deck', 'deck');
  const el = dom(), cleanup = render(el, { spaceId: 'client-a', jobId: job.id }, { service: override(service), navigate() {} });
  await settle(); return { service, job, el, cleanup };
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
const field = (el, label) => walk(el).find(n => n.tag === 'label' && n.children[0]?.textContent === label)?.children[1];
function set(el, label, value) { const c = field(el, label); c.value = value; (c.events.input || c.events.change)(); }
async function addFact(el, values) {
  for (const [label, value] of Object.entries(values)) set(el, label, value);
  find(el, 'Add fact').click(); await settle();
}

test('the form only offers the allowed facts, with labels; never Google rating or review count', async () => {
  const { el, cleanup } = await started();
  const what = field(el, 'What is it?');
  assert.deepEqual(what.children.map(o => o.value), ['place', 'profile:website', 'profile:phone', 'profile:hours', 'profile:categories',
    'profile:photos', 'website:speed', 'website:https', 'website:phoneLink', 'website:contactForm', 'website:adsPixel', 'website:social',
    'census:population', 'census:households', 'demand:monthlySearches']);
  assert.doesNotMatch(what.children.map(text).join('|'), /rating|review/i);
  const form = walk(el).find(n => n.tag === 'fieldset'); assert.equal(text(form.children[0]), 'Add a fact');
  set(el, 'What is it?', 'census:population');
  assert.deepEqual(field(el, 'Who is it about?').children.map(o => o.value), ['market']);
  assert.equal(walk(el).find(n => n.tag === 'label' && n.children[0]?.textContent === 'Google place ID').hidden, true);
  set(el, 'What is it?', 'place');
  assert.deepEqual(field(el, 'Who is it about?').children.map(o => o.value), ['client', 'competitor']);
  assert.equal(walk(el).find(n => n.tag === 'label' && n.children[0]?.textContent === 'Rank in the local search').hidden, false);
  cleanup();
});

test('a typed-in fact shows as a Person row with its source link; the form keeps the source for the next one', async () => {
  const { el, cleanup } = await started();
  assert.match(text(el), /hasn't run yet/);
  await addFact(el, { 'What is it?': 'census:population', 'Source name': 'US Census Bureau', 'Source link (https://…)': 'https://data.census.gov/' });
  assert.match(text(el), /Type the number you found/);   // nothing saved without a value
  set(el, 'What is it?', 'census:population'); await addFact(el, { 'Number': '52300' });
  const row = walk(el).find(n => n.className === 'studio-research-row' && /Market: Population/.test(text(n)));
  assert.match(text(row), /52,300/); assert.match(text(row), /Person/);
  const link = walk(row).find(n => n.tag === 'a'); assert.equal(link.href, 'https://data.census.gov/'); assert.equal(link.textContent, 'US Census Bureau');
  assert.match(text(el), /Type in the facts you found\. Add the business's own Google place to confirm it\./);
  assert.equal(field(el, 'Source name').value, 'US Census Bureau');
  const source = fs.readFileSync(path.join(__dirname, '../../src/renderer/studio/screens/research.js'), 'utf8');
  assert.doesNotMatch(source, /innerHTML|insertAdjacentHTML|outerHTML/); assert.doesNotMatch(text(el), /\$|price|cost/i);
  cleanup();
});

test('a missing source or a bad link is refused and the service error shows on screen', async () => {
  const { el, service, job, cleanup } = await started();
  await addFact(el, { 'What is it?': 'website:https', 'Who is it about?': 'client', 'Yes or no': 'yes' });
  assert.ok(walk(el).some(n => n.attrs.role === 'alert' && /source name and its link/.test(text(n))));
  await addFact(el, { 'Source name': 'My notes', 'Source link (https://…)': 'ftp://example.com/x' });
  assert.ok(walk(el).some(n => n.attrs.role === 'alert' && /source with a label and a web link/.test(text(n))));
  assert.equal((await service.getResearch('client-a', job.id)).evidence.length, 0);
  cleanup();
});

test('only typed-in rows can be removed; the agent\'s rows stay', async () => {
  const { el, service, job, cleanup } = await started();
  await service.startResearch('client-a', job.id, { category: 'roofer' });
  await service.confirmMatch('client-a', job.id, 'sample-place-you-0001'); await settle();
  const agentRows = walk(el).filter(n => n.className === 'studio-research-row');
  assert.ok(agentRows.length > 5); assert.ok(agentRows.every(r => !walk(r).some(n => n.tag === 'button')));
  await addFact(el, { 'What is it?': 'demand:monthlySearches', 'Number': '2400', 'Source name': 'Keyword research', 'Source link (https://…)': SRC });
  const typed = walk(el).filter(n => n.className === 'studio-research-row' && walk(n).some(b => b.tag === 'button'));
  assert.equal(typed.length, 1); assert.match(text(typed[0]), /Monthly searches/);
  const remove = walk(typed[0]).find(n => n.tag === 'button');
  assert.equal(remove.attrs['aria-label'], 'Remove Market: Monthly searches');
  remove.click(); await settle();
  assert.ok(!walk(el).some(n => n.className === 'studio-research-row' && /Monthly searches/.test(text(n))));
  assert.equal((await service.getResearch('client-a', job.id)).evidence.filter(e => e.method === 'person').length, 0);
  cleanup();
});

test('adding the business\'s own place confirms it; competitor names reach applyResearchToDeck', async () => {
  let applied;
  const { el, service, job, cleanup } = await started(s => ({ ...s, applyResearchToDeck: (...a) => { applied = a; return s.applyResearchToDeck(...a); } }));
  const where = { 'Source name': 'Google Maps search', 'Source link (https://…)': 'https://www.google.com/maps' };
  await addFact(el, { 'What is it?': 'place', 'Who is it about?': 'competitor', 'Google place ID': RIVAL, 'Rank in the local search': '1', ...where });
  assert.match(text(el), /Add the business's own Google place/); assert.equal(find(el, 'Finish Research + write').disabled, true);
  await addFact(el, { 'What is it?': 'place', 'Who is it about?': 'client', 'Google place ID': ME, 'Rank in the local search': '2' });
  assert.equal((await service.getResearch('client-a', job.id)).status, 'done'); assert.match(text(el), /Research is done\./);
  assert.equal(field(el, 'Google place ID').value, '');   // cleared after saving
  set(el, 'Competitor at rank 1', 'Summit Roofing (sample)');
  find(el, 'Use this research').click(); await settle();
  assert.deepEqual(applied[2], { names: { [RIVAL]: 'Summit Roofing (sample)' } });
  cleanup();
});

test('real sign-in: Run research says coming soon, and the hand form stays usable', async () => {
  const { el, cleanup } = await started(s => ({ ...s, startResearch: async () => { throw Error('Coming soon with the real server.'); } }));
  set(el, 'What kind of business?', 'roofer'); find(el, 'Run research').click(); await settle();
  assert.ok(walk(el).some(n => n.attrs.role === 'alert' && /Coming soon/.test(text(n))));
  assert.equal(find(el, 'Add fact').disabled, false); assert.equal(field(el, 'Source name').disabled, false);
  await addFact(el, { 'What is it?': 'census:households', 'Number': '18100', 'Source name': 'US Census Bureau', 'Source link (https://…)': 'https://data.census.gov/' });
  assert.match(text(el), /Market: Households/);
  cleanup();
});

test('cleanup removes every listener', async () => {
  const { el, cleanup } = await started();
  const controls = walk(el).filter(n => n.events.click || n.events.input || n.events.change);
  assert.ok(controls.length > 8); cleanup();
  assert.ok(controls.every(n => !n.events.click && !n.events.input && !n.events.change));
});
