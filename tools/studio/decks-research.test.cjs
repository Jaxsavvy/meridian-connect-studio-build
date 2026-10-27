'use strict';
// Core: research evidence model, score formula and number guard (#124). Synthetic evidence only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateEvidence, scoreFromEvidence, draftDeckFromEvidence, checkDeckAgainstEvidence } = require('../../src/renderer/studio/decks/research-model.js');

const ME = 'ChIJsampleClient01', R1 = 'ChIJsampleRival001', R2 = 'ChIJsampleRival002', R3 = 'ChIJsampleRival003';
let n = 0;
const rec = (kind, subject, extra) => ({ id: `e${++n}`, kind, subject, method: 'api', fetchedAt: '2026-10-26T20:00:00Z',
  source: { label: 'Sample source', url: 'https://example.com/source' }, ...extra });
function evidence() {
  n = 0;
  return [
    rec('place', 'client', { placeId: ME, rank: 3 }),
    rec('place', 'competitor', { placeId: R1, rank: 1 }),
    rec('place', 'competitor', { placeId: R2, rank: 2 }),
    rec('place', 'competitor', { placeId: R3, rank: 4 }),
    rec('google', 'client', { field: 'rating', placeId: ME }),
    rec('google', 'client', { field: 'reviews', placeId: ME }),
    ...['website', 'phone', 'hours', 'categories'].map(f => rec('profile', 'client', { field: f, value: true })),
    rec('profile', 'client', { field: 'photos', value: false }),
    rec('website', 'client', { field: 'speed', value: 62, method: 'api' }),
    rec('website', 'client', { field: 'https', value: true, method: 'page-read' }),
    rec('website', 'client', { field: 'phoneLink', value: true, method: 'page-read' }),
    rec('website', 'client', { field: 'contactForm', value: false, method: 'page-read' }),
    rec('website', 'client', { field: 'social', value: true, method: 'page-read' }),
    rec('website', 'competitor', { field: 'speed', value: 88, placeId: R1 }),
    rec('website', 'competitor', { field: 'adsPixel', value: true, placeId: R1, method: 'page-read' }),
    rec('census', 'market', { field: 'population', value: 176654, method: 'census', source: { label: 'US Census ACS', url: 'https://data.census.gov/' } }),
    rec('demand', 'market', { field: 'monthlySearches', value: 8400, method: 'ai-estimate' }),
  ];
}
const live = { [ME]: { rating: 4.8, reviews: 90 }, [R1]: { rating: 4.6, reviews: 300 }, [R2]: { rating: 4.7, reviews: 200 }, [R3]: { rating: 4.4, reviews: 100 } };

test('valid evidence passes; broken records are named by index', () => {
  assert.deepEqual(validateEvidence(evidence()).errors, []);
  const ev = evidence();
  ev[4].value = 4.8;                                     // a Google rating stored: not allowed
  ev[6].source = { label: 'x', url: 'javascript:1' };
  ev[7].kind = 'gossip';
  ev[1].id = ev[0].id;
  ev[2].rank = 0;
  const msgs = validateEvidence(ev).errors.map(e => `${e.index}:${e.message}`);
  assert.ok(msgs.some(m => m.startsWith('4:') && /live; never store/.test(m)));
  assert.ok(msgs.some(m => m.startsWith('6:') && /source/.test(m)));
  assert.ok(msgs.some(m => m.startsWith('7:') && /Unknown kind/.test(m)));
  assert.ok(msgs.some(m => m.startsWith('1:') && /unique id/.test(m)));
  assert.ok(msgs.some(m => m.startsWith('2:') && /rank/.test(m)));
  assert.equal(validateEvidence('nope').ok, false);
});

test('score: four visible parts that add up, with the formula applied', () => {
  const s = scoreFromEvidence(evidence(), live);
  assert.deepEqual(s.parts.map(p => [p.name, p.max]), [['Reputation', 30], ['Google profile', 25], ['Website', 25], ['Visibility', 20]]);
  // Reputation: rating 4.8 vs avg 4.567 -> 7.5 + 0.233*15 = 11; reviews 90 vs avg 200 -> 3.375. Total 14.4
  assert.equal(s.parts[0].points, 14.4);
  assert.equal(s.parts[1].points, 20);                   // 4 of 5 profile items
  assert.equal(s.parts[2].points, 16.2);                 // speed 6.2 + https 5 + phone link 5
  assert.equal(s.parts[3].points, 10);                   // rank 3 of 4 -> 50 -> 10 of 20
  assert.equal(s.value, Math.round(14.4 + 20 + 16.2 + 10));
  assert.equal(s.band, 'Healthy');
  assert.deepEqual(s.missing, []);
});

test('missing data scores zero and is listed, never guessed', () => {
  const s = scoreFromEvidence(evidence(), {});           // live Google values unavailable
  assert.equal(s.parts[0].points, 0);
  assert.ok(s.missing.includes('Rating compared with competitors'));
  const bare = scoreFromEvidence([], {});
  assert.equal(bare.value, 0); assert.equal(bare.band, 'Weak');
  assert.ok(bare.missing.includes('Search rank') && bare.missing.includes('Website speed'));
});

test('draft deck: numbers come from evidence, words are left empty, Google values are not stored', () => {
  const d = draftDeckFromEvidence(evidence(), { name: 'Sample Roofing Co', town: 'Exampleville', names: { [R1]: 'Rival One' } }, live);
  assert.equal(d.client.placeId, ME);
  assert.equal(d.score.value, scoreFromEvidence(evidence(), live).value);
  assert.deepEqual(d.market.stats.map(s => [s.value, s.unit, s.estimate]), [[176.7, 'K', false], [8.4, 'K', true]]);
  assert.equal(d.market.stats[1].prefix, '~');
  const ads = evidence().map(e => (e.kind === 'demand' ? { ...e, method: 'api' } : e));   // from Google Ads data: still an estimate
  const fromAds = draftDeckFromEvidence(ads, { name: 'Sample Roofing Co' }, live).market.stats[1];
  assert.deepEqual([fromAds.estimate, fromAds.note, fromAds.prefix], [true, 'est.', '']);
  assert.equal(d.market.headline, '');
  assert.deepEqual(d.competitors.rows.map(r => [r.placeId, r.you, r.visibility]), [[R1, false, 100], [R2, false, 75], [ME, true, 50], [R3, false, 25]]);
  assert.deepEqual(d.competitors.rows[0].presence, [88, 100, 0, 100]);       // speed, rank, social, ads pixel
  assert.equal(d.competitors.rows[0].name, 'Rival One');
  assert.equal(d.competitors.rows[1].name, '');                              // a person types or confirms it
  const dump = JSON.stringify(d);
  assert.ok(!dump.includes('4.8') && !dump.includes('"rating"') && !dump.includes('"reviews"'));
});

test('the guard flags any number the evidence does not back', () => {
  const ev = evidence();
  const d = draftDeckFromEvidence(ev, { name: 'Sample Roofing Co' }, live);
  assert.deepEqual(checkDeckAgainstEvidence(d, ev, live), []);
  d.score.value += 10;                                      // an AI "rounded up"
  d.market.stats[0].value = 250;                            // a made-up population
  d.competitors.rows[0].visibility = 40;
  d.competitors.rows.push({ placeId: 'ChIJmadeUpBusiness', presence: [1, 2, 3, 4], visibility: 9 });
  d.demand = { series: [1, 2, 3, 4, 5, 6] };
  const p = checkDeckAgainstEvidence(d, ev.filter(e => e.kind !== 'demand'), live).map(x => x.path);
  for (const want of ['score.value', 'market.stats.0.value', 'competitors.rows.0.visibility', 'competitors.rows.4', 'demand.series']) {
    assert.ok(p.includes(want), want);
  }
});
