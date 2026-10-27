'use strict';
// Tyler 19: "Since your first look" panel on the board (#144). Synthetic "Client A" deck only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { renderDeck } = require('../../src/renderer/studio/tools/pitch-deck/board.js');
async function sampleDeck() {
  const s = createSampleService(); s.setProjects([{ id: 'client-a', name: 'Client A' }]);
  const job = await s.startJob('client-a', 'pitch-deck', 'deck');
  return (await s.useSampleResearch('client-a', job.id)).deck;
}
const panel = html => { const i = html.indexOf('<aside class="followup"'); return i < 0 ? '' : html.slice(i, html.indexOf('</aside>', i) + 8); };
const FOLLOW = { firstLook: '2026-09-01T15:00:00Z', items: [
  { label: 'Website speed', then: 42, now: 71, better: 'up' },
  { label: 'Page load (seconds)', then: 6.1, now: 2.4, better: 'down' },
  { label: 'Photos on the Google profile', then: 'No', now: 'Yes', better: 'up' },
  { label: 'Booking button', then: 'No', now: 'No', better: 'up' },
  { label: 'Ads tracking', then: 1, now: 0, better: 'up' },
] };

test('the panel shows each of our own measurements, then vs now, with arrows', async () => {
  const html = renderDeck(await sampleDeck(), {}, { followUp: FOLLOW }), p = panel(html);
  assert.match(p, /Since your first look on 2026-09-01/);
  assert.match(p, /<li class="better"><span>Website speed<\/span><span class="was">42<\/span><b aria-label="better">↑<\/b><strong>71<\/strong><\/li>/);
  assert.match(p, /<li class="better"><span>Page load \(seconds\)<\/span><span class="was">6\.1<\/span><b aria-label="better">↓<\/b><strong>2\.4<\/strong>/);
  assert.match(p, /<li class="changed"><span>Photos on the Google profile<\/span><span class="was">No<\/span><b aria-label="changed">→<\/b><strong>Yes<\/strong>/);
  assert.match(p, /<li class="no-change"><span>Booking button<\/span>.*?<b aria-label="no change">→<\/b>/);
  assert.match(p, /<li class="worse"><span>Ads tracking<\/span><span class="was">1<\/span><b aria-label="worse">↓<\/b>/);
  assert.match(p, /Google ratings and reviews are shown live from Google Maps\./);
  assert.ok(html.indexOf('<aside class="followup"') > html.indexOf('</header>') && html.indexOf('<aside class="followup"') < html.indexOf('<section'));
  assert.doesNotMatch(p, /\$|price|cost/i);
});

test('hidden when followUp is missing or has nothing to show', async () => {
  const deck = await sampleDeck();
  for (const options of [undefined, {}, { followUp: null }, { followUp: { items: [] } }, { followUp: { items: 'x' } }, { followUp: { items: [{ then: 1 }] } }]) {
    assert.equal(panel(renderDeck(deck, {}, options)), '', JSON.stringify(options));
  }
});

test('never shows Google ratings or review counts', async () => {
  const p = panel(renderDeck(await sampleDeck(), {}, { followUp: { items: [
    { label: 'Google rating', then: 4.1, now: 4.6, better: 'up' }, { label: 'Review count', then: 30, now: 52, better: 'up' },
    { label: 'Website speed', then: 40, now: 60, better: 'up' }] } }));
  assert.doesNotMatch(p, /<span>[^<]*(rating|review)/i); assert.doesNotMatch(p, /4\.6|52/);
  assert.match(p, /Website speed/);
});

test('every piece of follow-up text is escaped', async () => {
  const bad = '<script>alert(1)</script>';
  const html = renderDeck(await sampleDeck(), {}, { followUp: { firstLook: `2026-09-01${bad}`, items: [{ label: bad, then: bad, now: '<b>x</b>', better: 'up' }] } });
  const p = panel(html);
  assert.doesNotMatch(html, /<script|<b>x<\/b>/);
  assert.equal((p.match(/&lt;script&gt;alert\(1\)&lt;\/script&gt;/g) || []).length, 2);
  assert.match(p, /Since your first look on 2026-09-01<\/p>/);   // only the date part is used
});

test('the panel and the selling buttons share one options object', async () => {
  const html = renderDeck(await sampleDeck(), {}, { bookingUrl: 'https://booking.example.com/15', pageUrl: 'https://boards.example.com/a', followUp: FOLLOW });
  assert.equal((html.match(/Book a 15-minute call/g) || []).length, 2); assert.equal((html.match(/Text me this/g) || []).length, 2);
  const top = html.indexOf('sell-top'), aside = html.indexOf('<aside class="followup"'), score = html.indexOf('<section id="s-score"');
  assert.ok(top > 0 && top < aside && aside < score);   // buttons in the hero, then the panel, then the first section
});
