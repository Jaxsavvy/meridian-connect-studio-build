'use strict';
// Core: pitch deck data format, checker and research summary (#114 part 1). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateDeck, emptyDeck, researchSummary } = require('../../src/renderer/studio/decks/deck-data.js');

function sample() {
  const src = { label: 'Sample source', url: 'https://example.com/source' };
  const three = make => [0, 1, 2].map(make);
  return {
    version: 1,
    client: { name: 'Sample Roofing Co', town: 'Exampleville', preparedOn: 'October 2026' },
    score: { value: 64, band: 'Healthy' },
    bottomLine: { headline: 'A healthy market with room to grow.', text: 'Demand is steady; visibility holds back share.',
      findings: three(i => ({ icon: ['search', 'people', 'trend'][i], title: `Finding ${i + 1}`, text: 'What it means.' })) },
    market: { headline: 'Demand is growing.', stats: [
      { icon: 'people', value: 120, unit: 'K', label: 'Service-area population', source: { ...src } },
      { icon: 'search', value: 6.2, unit: 'K', prefix: '~', label: 'Monthly local searches', note: 'est.', estimate: true, source: { ...src } }] },
    demand: { headline: 'Local demand up 14%.', change: '+14%', text: 'Up each quarter.', series: [100, 101, 103, 105, 108, 114], source: { ...src } },
    saturation: { headline: 'One side of town is underserved.', level: 0.6, band: 'High',
      zones: [{ name: 'North', density: 70 }, { name: 'South', density: 30, open: true }], source: { ...src } },
    competitors: { headline: 'Two competitors lead online.', text: 'Presence across four channels.', channels: ['Website', 'Search', 'Social', 'Ads'],
      rows: [{ name: 'Sample Roofing Co', you: true, presence: [50, 40, 60, 10], rating: 4.8, reviews: 90, visibility: 40 },
        { name: 'Rival One', presence: [80, 75, 60, 70], rating: 4.6, reviews: 300, visibility: 78 }], source: { ...src } },
    reputation: { headline: 'Customers trust you.', text: 'Strong reviews, low volume.' },
    visibility: { headline: 'Rivals show up first.', text: 'The gap is being seen first.' },
    gaps: { headline: 'Three open lanes.', text: 'Each is within reach.',
      lanes: three(i => ({ icon: ['search', 'window', 'star'][i], title: `Lane ${i + 1}`, problem: 'Problem.', build: 'Build.', effect: 'Effect.' })) },
    homePages: { headline: 'From ordinary to extraordinary.', text: 'Three ways your home page could go.',
      tiers: three(i => ({ name: `Tier ${i + 1}`, description: 'What this tier is.', url: i < 2 ? `https://example.com/t${i + 1}` : '', desktopAsset: i < 2 ? `asset-${i + 1}` : null })) },
    plan: { headline: 'Capture, convert, compound.',
      moves: three(i => ({ name: ['Capture', 'Convert', 'Compound'][i], goal: 'Goal.', detail: 'Detail.' })),
      timeline: three(i => ({ when: `${(i + 1) * 30} days`, label: ['Foundation', 'Launch', 'Optimization'][i] })) },
  };
}
const paths = result => result.errors.map(e => e.path);

test('a complete sample deck passes and comes back cleaned', () => {
  const r = validateDeck(sample());
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.deck.client.name, 'Sample Roofing Co');
  assert.equal(r.deck.homePages.tiers.length, 3);
  assert.equal(r.deck.homePages.tiers[2].desktopAsset, null);
});

test('every number needs a source; errors name the field', () => {
  const d = sample();
  delete d.market.stats[0].source;
  d.demand.source.url = 'not a link';
  const r = validateDeck(d);
  assert.equal(r.ok, false);
  assert.ok(paths(r).includes('market.stats.0.source'));
  assert.ok(paths(r).includes('demand.source.url'));
});

test('unknown fields are refused, so pricing or team info can never get in', () => {
  const d = sample();
  d.price = 2500; d.client.dealValue = 1500; d.market.stats[0].internalNote = 'x';
  const r = validateDeck(d);
  assert.deepEqual(paths(r).filter(p => /price|dealValue|internalNote/.test(p)), ['price', 'client.dealValue', 'market.stats.0.internalNote']);
});

test('wrong types, ranges and counts are caught', () => {
  const d = sample();
  d.score.value = 140; d.score.band = 'Amazing';
  d.bottomLine.findings.pop();
  d.homePages.tiers.push({ name: 'Tier 4', description: 'Extra' });
  d.competitors.rows[1].reviews = 2.5;
  d.saturation.level = 'high';
  d.market.stats[0].icon = 'rocket';
  const p = paths(validateDeck(d));
  for (const want of ['score.value', 'score.band', 'bottomLine.findings', 'homePages.tiers', 'competitors.rows.1.reviews', 'saturation.level', 'market.stats.0.icon']) {
    assert.ok(p.includes(want), want);
  }
});

test('placeholder text and a missing "this is the prospect" row are caught', () => {
  const d = sample();
  d.gaps.lanes[0].title = 'TBD';
  d.reputation.text = 'Lorem ipsum dolor';
  d.competitors.rows[0].you = false;
  const p = paths(validateDeck(d));
  assert.ok(p.includes('gaps.lanes.0.title'));
  assert.ok(p.includes('reputation.text'));
  assert.ok(p.includes('competitors.rows'));
});

test('home-page links must be web links; assets must be asset ids', () => {
  const d = sample();
  d.homePages.tiers[0].url = 'javascript:alert(1)';
  d.homePages.tiers[1].phoneAsset = '../../etc/passwd';
  const p = paths(validateDeck(d));
  assert.ok(p.includes('homePages.tiers.0.url'));
  assert.ok(p.includes('homePages.tiers.1.phoneAsset'));
});

test('empty deck has the right shape and fails only on missing content', () => {
  const blank = emptyDeck({ name: 'Sample Roofing Co', town: 'Exampleville' });
  assert.equal(blank.client.name, 'Sample Roofing Co');
  assert.equal(blank.homePages.tiers.length, 3);
  const r = validateDeck(blank);
  assert.equal(r.ok, false);
  assert.ok(r.errors.every(e => e.message !== 'Unknown field.'));
  assert.ok(r.errors.every(e => e.message !== 'Mark exactly one row as the prospect.'));   // already marked
});

test('research summary lists every number with its source, escaped', () => {
  const d = sample();
  d.market.stats[0].label = 'Population <b>bold</b>';
  const { deck } = validateDeck(d);
  const md = researchSummary(deck);
  assert.match(md, /^# Research summary: Sample Roofing Co, Exampleville/);
  assert.match(md, /Monthly local searches: ~6\.2K \(estimate\)\. Source: \[Sample source\]\(https:\/\/example\.com\/source\)/);
  assert.match(md, /Rival One: rating 4\.6 from 300 reviews/);
  assert.match(md, /Tier 3: no live link yet/);
  assert.ok(!md.includes('<b>'));
});
