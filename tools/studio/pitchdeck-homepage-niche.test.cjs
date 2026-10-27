'use strict';
// Tyler 22: the Home page builder uses the niche styles (#181). Synthetic "Client A" only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { buildPage, createBuilder, mountCanvas } = require('../../src/renderer/studio/tools/pitch-deck/homepage-builder.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
const settle = async () => { for (let i = 0; i < 8; i++) await tick(); };
const page = (niche, tier, dna = {}) => buildPage({ tier, name: 'Client A', headline: 'Fixed fast', dna, niche });
async function started(category) {
  const service = createSampleService(); service.setProjects([{ id: 'client-a', name: 'Client A' }]);
  const job = await service.startJob('client-a', 'pitch-deck', 'deck');
  if (category) {   // the real path keeps the category the person typed
    await service.startResearch('client-a', job.id, { category });
    await service.confirmMatch('client-a', job.id, (await service.getResearch('client-a', job.id)).candidates[0].placeId);
    await service.applyResearchToDeck('client-a', job.id);
  } else await service.useSampleResearch('client-a', job.id);
  await service.completeStage('client-a', job.id, 'research');
  return { service, job };
}

test('roofer Tier 2 has the inspection and storm-damage sections in the niche order', () => {
  const html = page('roofer', 2);
  assert.match(html, /data-niche="roofer"/);
  const order = [...html.matchAll(/<section (?:id="[^"]+" )?class="([a-z-]+)(?: ([a-z-]+))?/g)].map(m => m[1] === 'trade' ? m[2] : m[1]);
  assert.deepEqual(order, ['hero', 'services', 'inspection', 'storm-damage', 'story', 'project-photos', 'booking']);
  assert.match(html, /Free roof inspection/); assert.match(html, /Storm damage help/);
  assert.doesNotMatch(page('roofer', 1), /inspection|storm-damage/);   // Tier 1 stays the essentials
});

test('HVAC Tier 3 has its video slots and motion; earlier tiers have none', () => {
  const t3 = page('hvac', 3);
  assert.equal((t3.match(/role="img" aria-label="(Video moment|Project video)"/g) || []).length, 2);
  assert.match(t3, /animation-timeline:view\(\)/); assert.match(t3, /Same-day service/);
  for (const t of [1, 2]) assert.doesNotMatch(page('hvac', t), /class="video|animation-timeline/);
});

test('Project DNA colors and fonts win; the niche fills in when the project has none', () => {
  const own = page('roofer', 2, { colors: ['#123456', '#abcdef'], fonts: ['Inter', 'Lato'] });
  assert.match(own, /color:#123456/); assert.match(own, /background:#abcdef/); assert.match(own, /font-family:"Inter"/);
  assert.doesNotMatch(own, /#1f2a36|#d9622b|Oswald/);
  const niche = page('roofer', 2);
  assert.match(niche, /color:#1f2a36/); assert.match(niche, /background:#d9622b/); assert.match(niche, /font-family:"Oswald"/);
  const bad = page('remodeler', 2, { colors: ['red;}</style>', 'x'], fonts: ['"Evil"'] });
  assert.match(bad, /color:#2b2622/); assert.match(bad, /Playfair Display/); assert.doesNotMatch(bad, /Evil|<\/style>.*<\/style>/s);
});

test('the style starts from the research category; unknown or unreadable gives General', async () => {
  for (const [category, expected] of [['Roofers', 'roofer'], ['hvac', 'hvac'], ['plumber', 'general'], [null, 'general']]) {
    const { service, job } = await started(category), views = [];
    const model = createBuilder({ service, spaceId: 'client-a', jobId: job.id, stageId: 'home-t2', report: v => views.push(v) });
    await model.load(); assert.equal(views.at(-1).niche, expected, String(category));
  }
  const { service, job } = await started('roofer'), views = [];
  const broken = { ...service, getResearch: async () => { throw Error('offline'); } };
  const model = createBuilder({ service: broken, spaceId: 'client-a', jobId: job.id, stageId: 'home-t1', report: v => views.push(v) });
  await model.load(); assert.equal(views.at(-1).state, 'ready'); assert.equal(views.at(-1).niche, 'general');
  assert.equal(model.setNiche('remodeler'), true); assert.match(views.at(-1).html, /data-niche="remodeler"/);
  assert.equal(model.setNiche('plumber'), false);
});

test('every niche and tier keeps the footer line, escapes text and shows no money', () => {
  for (const niche of ['roofer', 'hvac', 'remodeler', 'general', 'plumber']) {
    for (const tier of [1, 2, 3]) {
      const html = buildPage({ tier, name: '<script>alert(1)</script>', headline: '<img src=x>', dna: {}, niche });
      assert.match(html, /Concept for discussion, not affiliated with &lt;script&gt;alert\(1\)&lt;\/script&gt;/, `${niche} ${tier}`);
      assert.doesNotMatch(html, /<script>|<img src=x>/); assert.doesNotMatch(html, /\$|price|cost|financ/i);
    }
  }
});

test('the Style choice rebuilds the preview, and Keep and Finish save that style', async () => {
  const { service, job } = await started('roofer');
  const doc = { createElement(tag) { return { tag, ownerDocument: doc, children: [], attrs: {}, events: {},
    setAttribute(k, v) { this.attrs[k] = v; }, append(...items) { this.children.push(...items); }, appendChild(item) { this.append(item); },
    replaceChildren(...items) { this.children = items; }, addEventListener(k, fn) { this.events[k] = fn; },
    removeEventListener(k, fn) { if (this.events[k] === fn) delete this.events[k]; }, remove() {}, click() { if (!this.disabled) this.events.click?.(); } }; } };
  const el = doc.createElement('div'), walk = n => [n, ...n.children.flatMap(walk)], text = n => (n.textContent || '') + n.children.map(text).join('');
  const cleanup = mountCanvas(el, { spaceId: 'client-a', jobId: job.id, stageId: 'home-t3', studio: { service } }); await settle();
  const select = walk(el).find(n => n.tag === 'select');
  assert.deepEqual(select.children.map(text), ['Roofer', 'HVAC', 'Remodeler', 'General']); assert.equal(select.value, 'roofer');
  assert.equal(walk(el).find(n => n.tag === 'iframe').attrs.sandbox, '');
  select.value = 'hvac'; select.events.change();
  assert.match(walk(el).find(n => n.tag === 'iframe').srcdoc, /data-niche="hvac"/);
  walk(el).find(n => n.tag === 'button' && text(n) === 'Keep').click(); await settle();
  const kept = (await service.listJobAssets('client-a', job.id))['home-t3'][0];
  assert.match(kept.html, /data-niche="hvac"/); assert.match(kept.html, /not affiliated with Client A/);
  walk(el).find(n => n.tag === 'button' && text(n) === 'Finish stage').click(); await settle();
  assert.equal((await service.getJob('client-a', job.id)).stages.find(st => st.id === 'home-t3').status, 'done');
  cleanup();
});

test('a project without DNA fonts gets the niche fonts, never "undefined"', () => {
  for (const niche of ['roofer', 'general']) for (const dna of [{}, { fonts: [] }, { fonts: [null, 42] }]) assert.doesNotMatch(page(niche, 1, dna), /"undefined"|"null"|"42"/);
});
