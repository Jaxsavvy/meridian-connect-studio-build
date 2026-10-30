'use strict';
// NO-GOOGLE 2026-10-29 (Jax: no paid Google for now): research from websites only, through Team Hub's
// POST /api/studio/spaces/{id}/research (meridian-27). Synthetic data only (example.com businesses).
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService, createServerService } = require('../../src/renderer/studio/studio-service.js');
const Research = require('../../src/renderer/studio/decks/research-model.js');
const DeckData = require('../../src/renderer/studio/decks/deck-data.js');
const Board = require('../../src/renderer/studio/tools/pitch-deck/board.js');

const PID = 'c'.repeat(32), AT = '2026-10-29T20:00:00.000Z';
const fact = (id, field, value, extra = {}) => ({ id, kind: 'website', subject: 'client', field, value, method: 'page-read',
  source: { label: 'TEST Roof Co website', url: 'https://roof.example.com/' }, fetchedAt: AT, ...extra });
function answer({ website = 'https://roof.example.com/' } = {}) {
  return { research: {
    business: { name: 'TEST Roof Co (delete me)', town: 'Exampleville, TX', kind: 'roofer', website },
    evidence: [fact('w1', 'https', true), fact('w2', 'phoneLink', true), fact('w3', 'contactForm', false), fact('w4', 'social', true),
      { id: 'c1', kind: 'census', subject: 'market', field: 'population', value: 52000, method: 'census',
        source: { label: 'US Census Bureau', url: 'https://data.census.gov/' }, fetchedAt: AT }],
    competitors: [
      { name: 'TEST Rival A (delete me)', site: 'https://rival-a.example.com', facts: { https: true, phoneLink: true, contactForm: true, adsPixel: true, social: false },
        source: { label: 'Rival A website', url: 'https://rival-a.example.com/' } },
      { name: 'TEST Rival B (delete me)', site: 'https://rival-b.example.com', facts: { https: false, phoneLink: false, contactForm: false, adsPixel: false, social: true },
        source: { label: 'Rival B website', url: 'https://rival-b.example.com/' } }],
    words: { bottomLine: { headline: 'TEST headline (delete me)' }, competitors: { headline: 'TEST rivals headline', text: 'TEST rivals text' } },
    missing: ['Website speed: no PageSpeed key yet.'],
    sources: [{ label: 'TEST Roof Co website', url: 'https://roof.example.com/' }],
  } };
}
function server(reply) {
  const calls = [], files = new Map();
  const request = async (method, endpoint, body) => {
    calls.push({ method, endpoint, body });
    if (endpoint === '/api/studio/spaces') return { success: true, status: 200, data: [{ id: PID, type: 'client', name: 'TEST Roof Co (delete me)' }] };
    if (endpoint === `/api/studio/spaces/${PID}/research`) return { success: true, status: 200, data: reply };
    if (endpoint.endsWith('/stage-approvals')) return { success: true, status: 200, data: [] };
    return { success: false, status: 404, error: 'Not found.' };
  };
  const s = createServerService({ request, local: createSampleService({ practice: false }),
    readSave: async (id, name) => (files.has(`${id}/${name}`) ? { success: true, content: files.get(`${id}/${name}`) } : { success: true, missing: true }),
    saveFile: async (id, name, content) => { files.set(`${id}/${name}`, content); return { success: true }; } });
  return { s, calls, files };
}

test('website-only score: only the Website part counts, scaled to 100; the Google parts are "not checked", never 0', () => {
  const ev = [{ id: 's', kind: 'site', subject: 'client', field: 'url', value: 'https://roof.example.com', method: 'page-read',
    source: { label: 'site', url: 'https://roof.example.com/' }, fetchedAt: AT }, fact('a', 'https', true), fact('b', 'phoneLink', true), fact('c', 'contactForm', false)];
  assert.equal(Research.validateEvidence(ev).ok, true);
  const score = Research.scoreFromEvidence(ev);
  assert.equal(score.coverage, 'website-only');
  assert.deepEqual(score.parts.map(p => [p.name, p.checked]), [['Google profile', false], ['Website', true], ['Visibility', false]]);
  assert.equal(score.value, 67, '2 of the 3 website checks made (speed wasn\'t)');
  assert.ok(score.missing.includes('Website speed'));
  assert.equal(Research.scoreFromEvidence([]).coverage, undefined, 'no evidence at all is not "website only"');
});

test('Run research stores the website research, saves it, and fills the deck: numbers from evidence, words only in blanks', async () => {
  const { s, calls, files } = server(answer());
  await s.listSpaces();
  const job = await s.startJob(PID, 'pitch-deck', 'deck', {});
  const out = await s.startResearch(PID, job.id);
  assert.equal(out.status, 'done');
  assert.deepEqual(calls.find(c => c.endpoint.endsWith('/research')).body, { jobId: job.id }, 'the business comes from the Clients record, not from here');
  const research = await s.getResearch(PID, job.id);
  assert.equal(research.source, 'web');
  assert.equal(research.score.coverage, 'website-only');
  assert.ok(research.evidence.some(e => e.kind === 'site' && e.subject === 'competitor' && e.value === 'https://rival-a.example.com'));
  assert.ok(JSON.parse(files.get(`${PID}/Pitch deck - Studio save.json`)).jobs[0].research.status === 'done', 'saved to the project');

  const mine = await s.getDeck(PID, job.id);
  mine.bottomLine.headline = 'TEST my own headline';   // the person's words stay
  await s.saveDeck(PID, job.id, mine);
  const applied = await s.applyResearchToDeck(PID, job.id, {});
  const d = applied.deck;
  assert.equal(d.bottomLine.headline, 'TEST my own headline');
  assert.equal(d.competitors.headline, 'TEST rivals headline', 'a blank field gets the research words');
  assert.equal(d.demand, null); assert.equal(d.saturation, null);
  assert.equal(d.score.coverage, 'website-only');
  assert.deepEqual(d.competitors.rows.map(r => [r.name, r.you, r.site]), [
    ['TEST Roof Co (delete me)', true, 'https://roof.example.com/'],
    ['TEST Rival A (delete me)', false, 'https://rival-a.example.com/'], ['TEST Rival B (delete me)', false, 'https://rival-b.example.com/']]);
  assert.deepEqual(d.competitors.rows[0].presence, [67, null, 100, null], 'Search not checked; no ads fact for the client: not checked');
  assert.equal(d.competitors.rows[0].visibility, null);
  assert.equal(d.market.stats[0].label, 'People living here');
  assert.ok(applied.missing.includes('Website speed: no PageSpeed key yet.'));
  assert.equal(applied.errors.some(e => /evidence|isn't in the research|Doesn't match/.test(e.message)), false, JSON.stringify(applied.errors));
});

test('a finished website-only deck passes the checker and the board says what wasn\'t checked', async () => {
  const { s } = server(answer());
  await s.listSpaces();
  const job = await s.startJob(PID, 'pitch-deck', 'deck', {});
  await s.startResearch(PID, job.id);
  const { deck } = await s.applyResearchToDeck(PID, job.id, {});
  const fill = (v, k) => (Array.isArray(v) ? v.map(x => fill(x)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([kk, x]) => [kk, fill(x, kk)]))
    : v === '' && !['url', 'prefix', 'unit', 'note', 'site'].includes(k) ? 'TEST words' : v);
  const words = fill(deck);
  words.client.preparedOn = 'October 29, 2026';
  const saved = await s.saveDeck(PID, job.id, words);
  assert.deepEqual(saved.errors, []);
  const html = Board.renderDeck(saved.deck);
  assert.match(html, /Based on the website only/);
  assert.match(html, /Not checked/);
  assert.doesNotMatch(html, /id="s-demand"|id="s-saturation"/, 'no free source: those sections are left out');
  assert.match(html, /01\. The bottom line[\s\S]*02\. Market snapshot[\s\S]*03\. Competitive landscape/, 'numbering closes up');
  assert.match(html, /Google reviews not checked/);
  assert.match(DeckData.researchSummary(saved.deck), /Demand\n\n- Not checked/);
});

test('no website found (ELM-style, Jax: "they need one"): research is done and the deck says "No website found"', async () => {
  const reply = answer({ website: null });
  reply.research.business.websiteStatus = 'not-found'; reply.research.business.elsewhere = ['elm-elsewhere.example.com'];
  reply.research.evidence = reply.research.evidence.filter(e => e.subject !== 'client');   // nothing to read on a site that isn't there
  const { s } = server(reply);
  await s.listSpaces();
  const job = await s.startJob(PID, 'pitch-deck', 'deck', {});
  assert.equal((await s.startResearch(PID, job.id)).status, 'done');
  const r = await s.getResearch(PID, job.id);
  assert.equal(r.score.coverage, 'no-website');
  assert.match(r.missing[0], /^Confirm TEST Roof Co \(delete me\) has no website \(we found elm-elsewhere\.example\.com, but that's a different business elsewhere\)\.$/);
  const { deck, errors } = await s.applyResearchToDeck(PID, job.id, {});
  assert.equal(errors.some(e => /evidence|isn't in the research|Doesn't match/.test(e.message)), false, JSON.stringify(errors));
  assert.deepEqual(deck.competitors.rows.map(x => [x.you, x.site]), [[true, null], [false, 'https://rival-a.example.com/'], [false, 'https://rival-b.example.com/']]);
  assert.deepEqual(deck.competitors.rows[0].presence, [0, null, null, null]);
  assert.deepEqual(deck.score.parts.map(p => [p.name, p.points, p.checked]), [['Google profile', 0, false], ['Website', 0, true], ['Visibility', 0, false]]);
  const fill = (v, k) => (Array.isArray(v) ? v.map(x => fill(x)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([kk, x]) => [kk, fill(x, kk)]))
    : v === '' && !['url', 'prefix', 'unit', 'note', 'site'].includes(k) ? 'TEST words' : v);
  const words = fill(deck); words.client.preparedOn = 'October 29, 2026';
  const saved = await s.saveDeck(PID, job.id, words);
  assert.deepEqual(saved.errors, []);
  const html = Board.renderDeck(saved.deck);
  assert.match(html, /NO WEBSITE/); assert.match(html, /No website found in a web search/); assert.match(html, /<strong>No website found<\/strong>/);
});

test('a website typed on Clients that can\'t be read stops research with a clear message', async () => {
  const reply = answer({ website: 'https://typo.example.com/' });
  reply.research.business.websiteStatus = 'unreadable';
  const { s } = server(reply);
  await s.listSpaces();
  const job = await s.startJob(PID, 'pitch-deck', 'deck', {});
  assert.equal((await s.startResearch(PID, job.id)).status, 'failed');
  assert.match((await s.getResearch(PID, job.id)).missing[0], /couldn't read the website on the Clients page \(https:\/\/typo\.example\.com\)/);
  await assert.rejects(s.applyResearchToDeck(PID, job.id, {}), /run the research/);
});

test('a checked part marked "not checked" (or the reverse) is caught; a website-only value must be the scaled Website part', () => {
  const base = DeckData.emptyDeck({ name: 'A' });
  base.score = { value: 60, band: 'Healthy', coverage: 'website-only', parts: [
    { name: 'Google profile', points: 0, max: 35, checked: false }, { name: 'Website', points: 21, max: 35, checked: true },
    { name: 'Visibility', points: 0, max: 30, checked: false }] };
  assert.equal(DeckData.validateDeck(base).errors.some(e => e.path.startsWith('score')), false);
  base.score.value = 21;
  assert.match(DeckData.validateDeck(base).errors.find(e => e.path === 'score.value').message, /scaled to 100 \(60\)/);
  base.score.value = 60; base.score.parts[0].points = 5;
  assert.ok(DeckData.validateDeck(base).errors.some(e => /wasn't checked scores 0/.test(e.message)));
});
