'use strict';
// Tyler 17: board template (renderDeck) from the v12 design (#142).
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { renderDeck, assetUrl } = require('../../src/renderer/studio/tools/pitch-deck/board.js');
async function sampleDeck() {   // synthetic: the practice deck for a made-up "Client A"
  const s = createSampleService(); s.setProjects([{ id: 'client-a', name: 'Client A' }]);
  const job = await s.startJob('client-a', 'pitch-deck', 'deck');
  return (await s.useSampleResearch('client-a', job.id)).deck;
}
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';   // 1×1 sample
const SECTIONS = ['s-score', 's-market', 's-demand', 's-saturation', 's-competitors', 's-reputation', 's-visibility', 's-gaps', 's-homepages', 's-plan'];

test('a synthetic deck renders every section, the score total and its parts', async () => {
  const deck = await sampleDeck(), html = renderDeck(deck);
  for (const id of SECTIONS) assert.match(html, new RegExp(`<section id="${id}"`), id);
  for (const h of [deck.bottomLine.headline, deck.market.headline, deck.demand.headline, deck.saturation.headline, deck.competitors.headline,
    deck.reputation.headline, deck.visibility.headline, deck.gaps.headline, deck.homePages.headline, deck.plan.headline]) {
    assert.ok(html.includes(h.replace(/'/g, '&#39;')), h);
  }
  assert.match(html, new RegExp(`aria-label="Score ${deck.score.value} of 100`));
  for (const p of deck.score.parts) assert.ok(html.includes(`<span>${p.name}</span><strong>${p.points.toLocaleString('en-US')} of ${p.max}</strong>`), p.name);
  const demand = html.slice(html.indexOf('id="s-demand"'), html.indexOf('id="s-saturation"'));   // always a labeled estimate
  assert.match(demand, /<span class="tag">Estimate<\/span>/);
  assert.ok(demand.includes(`How it was estimated: ${deck.demand.basis.replace(/'/g, '&#39;')}`));
  const est = deck.market.stats.find(s => s.estimate);
  assert.ok(est && html.includes(`<span>${est.label}</span><em>${est.note || 'est.'}</em>`), 'estimated market stat shows its note');
  assert.ok((html.match(/Source: <a href="https?:\/\//g) || []).length >= deck.market.stats.length + 3);
  assert.match(html, /Prepared exclusively for/); assert.match(html, /Client A/);
  assert.doesNotMatch(html, /\$|price|cost|deal value/i);
});

test('<script> in any deck text renders as text, never as HTML', async () => {
  const deck = await sampleDeck(), bad = '<script>alert(1)</script>';
  deck.client.name = bad; deck.bottomLine.headline = bad; deck.bottomLine.findings[0].text = bad; deck.market.stats[0].label = bad;
  deck.market.stats[0].source.label = bad; deck.saturation.zones[0].name = bad; deck.competitors.rows[0].name = bad;
  deck.competitors.channels[0] = '<script>x</script>';   // channels are 20 characters max
  deck.gaps.lanes[1].build = bad; deck.homePages.tiers[2].name = bad; deck.plan.moves[0].detail = bad;
  const html = renderDeck(deck);
  assert.doesNotMatch(html, /<script/i); assert.match(html, /<th>&lt;script&gt;x&lt;\/script&gt;<\/th>/);
  assert.ok((html.match(/&lt;script&gt;alert\(1\)&lt;\/script&gt;/g) || []).length >= 10);
});

test('a rating that is not there yet is left out (no placeholder); rows keep their place ID; no numbers stored', async () => {
  const deck = await sampleDeck(), html = renderDeck(deck);
  const reviews = html.slice(html.indexOf('id="s-reputation"'), html.indexOf('id="s-visibility"'));
  assert.doesNotMatch(html, /Live from Google Maps|data-field=/);
  assert.equal((reviews.match(/<li[^>]* data-place-id="[^"]+">/g) || []).length, deck.competitors.rows.filter(r => r.placeId).length);
  assert.equal((reviews.match(/Not on Google Maps/g) || []).length, deck.competitors.rows.filter(r => !r.placeId).length);
  assert.match(html, /<p class="credit">Google Maps<\/p>/);
  assert.doesNotMatch(html, /★|\d\.\d\s*stars?/i);
});

test('tiers sit at the bottom with captures and links; a missing tier says "In progress"', async () => {
  const deck = await sampleDeck();
  deck.homePages.tiers[0] = { ...deck.homePages.tiers[0], url: 'https://example.com/tier-1', desktopAsset: 'cap-1', phoneAsset: 'cap-1p' };
  deck.homePages.tiers[1] = { ...deck.homePages.tiers[1], url: '', desktopAsset: 'nowhere', phoneAsset: null };
  deck.homePages.tiers[2] = { ...deck.homePages.tiers[2], url: '', desktopAsset: null, phoneAsset: null };
  const html = renderDeck(deck, { 'cap-1': 'https://cdn.example.com/t1.jpg', 'cap-1p': { url: 'captures/t1-phone.jpg' } });
  const tiers = html.slice(html.indexOf('id="s-homepages"'), html.indexOf('id="s-plan"'));
  assert.ok(html.indexOf('id="s-homepages"') > html.indexOf('id="s-gaps"'));
  assert.match(tiers, /<img class="cap" src="https:\/\/cdn\.example\.com\/t1\.jpg"/);
  assert.match(tiers, /<img class="cap-phone" src="captures\/t1-phone\.jpg"/);
  assert.match(tiers, /href="https:\/\/example\.com\/tier-1"/);
  assert.equal((tiers.match(/In progress/g) || []).length, 2);   // unknown asset and no asset both wait
});

test('images come only from assets; SVG, other data: types and script URLs are refused', async () => {
  for (const bad of ['data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html;base64,PGI+', 'data:image/png,raw', 'data:image/png;base64,AA"A',
    'data:image/png;base64,' + 'A'.repeat(10000000), 'javascript:alert(1)', '//evil.example/x.png', '../secret.png', 'a b.png']) {
    assert.equal(assetUrl({ hero: bad }, 'hero'), '', bad.slice(0, 40));
  }
  assert.equal(assetUrl({ hero: 'https://cdn.example.com/hero.jpg' }, 'hero'), 'https://cdn.example.com/hero.jpg');
  assert.equal(assetUrl({ hero: { url: PNG } }, 'hero'), PNG);
  const html = renderDeck(await sampleDeck(), { hero: 'data:image/svg+xml;base64,PHN2Zz4=', closing: 'https://cdn.example.com/close.jpg', logo: 'logo.png' });
  assert.doesNotMatch(html, /svg\+xml/);
  assert.match(html, /<img class="bg" src="https:\/\/cdn\.example\.com\/close\.jpg"/); assert.match(html, /<img class="logo" src="logo\.png"/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.match(html, /@media \(max-width:760px\)/);
});

test('self-contained for the decks site: embedded pictures, no outside images, fonts or styles, no placeholder (#283)', async () => {
  const deck = await sampleDeck(), assets = { hero: PNG, logo: PNG, closing: PNG };
  deck.homePages.tiers.forEach((t, i) => { t.desktopAsset = `cap-${i}`; t.phoneAsset = `cap-${i}p`; assets[`cap-${i}`] = PNG; assets[`cap-${i}p`] = { url: PNG }; });
  const html = renderDeck(deck, assets);
  // hero, closing, the logo at the top and bottom, and each tier on a computer and a phone
  assert.equal((html.match(/<img [^>]*src="data:image\/png;base64,/g) || []).length, 4 + 2 * deck.homePages.tiers.length);
  assert.doesNotMatch(html, /<img [^>]*src="(?!data:)/);
  assert.doesNotMatch(html, /<link\b|@import|@font-face|url\(|fonts\.g|Figtree|Newsreader/i);
  assert.doesNotMatch(html, /\s(?:src|srcset|poster)="https?:/i);
  assert.match(html, /img-src data: /); assert.doesNotMatch(html, /fonts\.googleapis|font-src/);
  assert.doesNotMatch(html, /Live from Google Maps|In progress/);
});

test('a deck that fails the checker is refused', async () => {
  const deck = await sampleDeck(); deck.score.value = 99; deck.secret = 'pipeline';
  assert.throws(() => renderDeck(deck), /thing\(s\) to fix/);
  assert.throws(() => renderDeck(null), /thing\(s\) to fix/);
});
