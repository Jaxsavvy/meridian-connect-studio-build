'use strict';
// Tyler 20: niche home-page styles, roofers / HVAC / remodelers x 3 tiers (#145).
const test = require('node:test');
const assert = require('node:assert/strict');
const { nicheOf, nicheStyle, allStyles } = require('../../src/renderer/studio/tools/pitch-deck/niche-styles.js');
const { buildPage } = require('../../src/renderer/studio/tools/pitch-deck/homepage-builder.js');
const TRADES = ['roofer', 'hvac', 'remodeler'];

test('nine trade styles exist and each one is its own', () => {
  const nine = TRADES.flatMap(n => [1, 2, 3].map(t => nicheStyle(n, t)));
  assert.equal(nine.length, 9);
  assert.equal(new Set(nine.map(s => JSON.stringify(s))).size, 9);
  for (const s of nine) assert.ok(TRADES.includes(s.niche) && [1, 2, 3].includes(s.tier));
  assert.equal(allStyles().length, 12);   // plus the general fallback
  assert.notDeepEqual(nicheStyle('roofer', 2).sections, nicheStyle('hvac', 2).sections);
  assert.notDeepEqual(nicheStyle('roofer', 2).tokens.colors, nicheStyle('remodeler', 2).tokens.colors);
});

test('unknown niches fall back to the general style; plurals and trade words are understood', () => {
  for (const name of ['plumber', '', null, undefined, 42, '<script>']) assert.equal(nicheStyle(name, 2).niche, 'general');
  assert.deepEqual([nicheOf('Roofers'), nicheOf(' roofing '), nicheOf('HVAC'), nicheOf('Remodelers'), nicheOf('remodeling')],
    ['roofer', 'roofer', 'hvac', 'remodeler', 'remodeler']);
  assert.equal(nicheStyle('roofer', 9).tier, 1);   // an unknown tier gets Tier 1, never a broken style
});

test('each tier steps up from the last; Tier 3 adds motion and video slots', () => {
  for (const n of [...TRADES, 'general']) {
    const [t1, t2, t3] = [1, 2, 3].map(t => nicheStyle(n, t));
    assert.ok(t1.sections.length < t2.sections.length && t2.sections.length < t3.sections.length, n);
    assert.ok(t2.sections.includes('booking') && !t1.sections.includes('booking'), n);
    assert.ok(t2.sections.includes('story') && !t1.sections.includes('story'), n);
    assert.equal(t1.motion, false); assert.equal(t2.motion, false); assert.equal(t3.motion, true);
    assert.equal(t1.videoSlots, 0); assert.ok(t3.videoSlots >= 1);
    assert.ok(t3.sections.includes('video-hero') && t3.sections.includes('video-moments'), n);
    assert.equal(t3.heroKind, 'video'); assert.equal(t1.heroKind, 'simple');
    assert.ok(parseFloat(t1.tokens.spacing.hero) < parseFloat(t2.tokens.spacing.hero)
      && parseFloat(t2.tokens.spacing.hero) < parseFloat(t3.tokens.spacing.hero), n);
    for (const s of [t1, t2, t3]) { assert.equal(s.sections[0], 'header'); assert.equal(s.sections.at(-1), 'footer'); }
  }
});

test('every style keeps the "Concept for discussion, not affiliated" footer line', () => {
  for (const s of allStyles()) assert.equal(s.footer, 'Concept for discussion, not affiliated with {business}');
});

test('tokens are safe for the Home page builder and nothing mentions money', () => {
  for (const s of allStyles()) {
    for (const c of Object.values(s.tokens.colors)) assert.match(c, /^#[0-9a-f]{6}$/i);
    for (const f of Object.values(s.tokens.fonts)) assert.match(f, /^[A-Za-z0-9 -]{1,40}$/);
    const page = buildPage({ tier: s.tier, name: 'Client A', headline: 'Hi', dna: { colors: [s.tokens.colors.ink, s.tokens.colors.accent], fonts: [s.tokens.fonts.display, s.tokens.fonts.body] } });
    assert.ok(page.includes(s.tokens.colors.accent) && page.includes(s.tokens.fonts.display), `${s.niche} ${s.tier}`);
    assert.doesNotMatch(JSON.stringify(s), /price|cost|financ|deal|\$/i);
  }
});

test('each call returns a fresh copy, so changing one style never changes the next', () => {
  const a = nicheStyle('hvac', 3); a.sections.push('oops'); a.tokens.colors.accent = '#000000';
  assert.ok(!nicheStyle('hvac', 3).sections.includes('oops')); assert.equal(nicheStyle('hvac', 3).tokens.colors.accent, '#1e88e5');
});
