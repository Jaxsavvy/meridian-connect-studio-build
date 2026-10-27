'use strict';
// Tyler 18: board selling buttons, section anchors, privacy line (#143). Synthetic "Client A" deck only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { renderDeck } = require('../../src/renderer/studio/tools/pitch-deck/board.js');
async function sampleDeck() {
  const s = createSampleService(); s.setProjects([{ id: 'client-a', name: 'Client A' }]);
  const job = await s.startJob('client-a', 'pitch-deck', 'deck');
  return (await s.useSampleResearch('client-a', job.id)).deck;
}
const BOOK = 'https://booking.example.com/15-minutes', PAGE = 'https://boards.example.com/client-a';
const count = (html, re) => (html.match(re) || []).length;

test('Book a 15-minute call and Text me this show at the top and bottom with https links', async () => {
  const html = renderDeck(await sampleDeck(), {}, { bookingUrl: BOOK, pageUrl: PAGE });
  assert.equal(count(html, /<a class="btn primary" href="https:\/\/booking\.example\.com\/15-minutes" target="_blank" rel="noopener noreferrer">Book a 15-minute call<\/a>/g), 2);
  const sms = `sms:?&amp;body=${encodeURIComponent(`Here's the market report: ${PAGE}`).replace(/'/g, '&#39;')}`;
  assert.equal(count(html, new RegExp(`<a class="btn" href="${sms.replace(/[.?*+()]/g, '\\$&')}">Text me this</a>`, 'g')), 2);
  assert.ok(html.indexOf('sell-top') < html.indexOf('id="s-score"') && html.indexOf('sell-bottom') > html.indexOf('id="s-plan"'));
  assert.match(html, /\.btn\{[^}]*min-height:48px/);   // big enough to tap on a phone
  assert.match(html, /\.btn:focus-visible\{outline/);   // links work with the keyboard, with a visible focus ring
});

test('a booking or page link that is missing or not https hides its button', async () => {
  const deck = await sampleDeck();
  for (const bad of [undefined, '', 'http://booking.example.com', 'javascript:alert(1)', 'data:text/html,hi', 'not a link', 42]) {
    const html = renderDeck(deck, {}, { bookingUrl: bad, pageUrl: bad });
    assert.doesNotMatch(html, /Book a 15-minute call|Text me this|class="sell/, String(bad));
  }
  const onlyBook = renderDeck(deck, {}, { bookingUrl: BOOK });
  assert.equal(count(onlyBook, /Book a 15-minute call/g), 2); assert.doesNotMatch(onlyBook, /Text me this/);
  const onlyText = renderDeck(deck, {}, { pageUrl: PAGE });
  assert.equal(count(onlyText, /Text me this/g), 2); assert.doesNotMatch(onlyText, /Book a 15-minute call/);
  assert.doesNotMatch(renderDeck(deck), /Book a 15-minute call|Text me this/);   // options are optional
});

test('every section has its stable id, and the privacy line is at the bottom', async () => {
  const html = renderDeck(await sampleDeck());
  const ids = ['s-score', 's-market', 's-demand', 's-saturation', 's-competitors', 's-reputation', 's-visibility', 's-gaps', 's-homepages', 's-plan'];
  assert.deepEqual([...html.matchAll(/<section id="([^"]+)"/g)].map(m => m[1]), ids);
  assert.match(html, /<footer class="close">.*This page counts views so we know it was helpful\. No third-party trackers\.<\/p><\/div><\/footer>/s);
});

test('no tracking code: no scripts, beacons or third-party trackers on the board', async () => {
  const html = renderDeck(await sampleDeck(), {}, { bookingUrl: BOOK, pageUrl: PAGE });
  assert.doesNotMatch(html, /<script|sendBeacon|fetch\(|XMLHttpRequest|gtag|analytics|pixel|<iframe/i);
  assert.match(html, /default-src 'none'/);
});
