'use strict';
// Core: section library, style numbers and the assembler (#189). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const Lib = require('../../src/renderer/studio/website/section-library.js');
const Engine = require('../../src/renderer/studio/website/site-engine.js');
const Cards = require('../../src/renderer/studio/website/chapter-cards.js');

const shot = (id, tool = 'image') => ({ what: `Synthetic ${id}`, prompt: 'Synthetic', size: 'wide', tool, assetId: id });
const ch = (id, layout, words, extra = {}) => ({ id, name: id, job: 'A job', layout, motion: 'none', phone: 'Stack', words, ...extra });
function storyAll() {
  return Cards.cleanStory({ pages: [
    { id: 'home', name: 'Home', path: '/', purpose: 'Get estimate calls', chapters: [
      ch('hero', 'hero-photo', { headline: 'Roofs done <right>', body: 'Licensed crews.', button: 'Book a visit' }, { shots: [shot('a1')] }),
      ch('services', 'services', { headline: 'What we do', body: 'Repairs: Fast fixes\nNew roofs: Full replacement' }, { shots: [shot('a2')] }),
      ch('steps', 'process', { headline: 'How it works', body: 'Call: We listen\nInspect: Free\nBuild: On time' }, { motion: 'fade-up' }),
      ch('ba', 'before-after', { headline: 'Before and after', body: 'A recent job.' }, { shots: [shot('a3'), shot('a4')] }),
      ch('why', 'why-us', { headline: 'Why us', body: 'Licensed\nInsured' }),
      ch('proof', 'proof', { headline: 'Proof', body: 'What we can show.' }, { proof: [{ claim: 'Licensed contractor', source: 'State license lookup' }] }),
      ch('band', 'cta-band', { headline: 'Ready?', body: 'Free estimate.', button: 'Book now' }),
      ch('foot', 'footer', { headline: 'Footer', body: 'Serving the valley.' })] },
    { id: 'more', name: 'More', path: '/more', purpose: 'Everything else', chapters: [
      ch('split', 'hero-split', { headline: 'About us', body: 'Family run.' }, { shots: [shot('a5')] }),
      ch('video', 'hero-video', { headline: 'See us work', body: 'Watch.' }, { shots: [shot('v1', 'video')] }),
      ch('pics', 'gallery', { headline: 'Gallery', body: 'Recent work.' }, { shots: [shot('a6'), shot('a7')] }),
      ch('area', 'service-area', { headline: 'Where we work', body: 'Eugene\nSpringfield' }),
      ch('faq', 'faq', { headline: 'Questions', body: 'Do you give free estimates?: Yes' }),
      ch('book', 'booking', { headline: 'Book a visit', body: 'Pick a time.', button: 'Call us' }),
      ch('contact', 'contact', { headline: 'Contact', body: 'Say hello.', button: 'Call' }),
      ch('odd', 'custom', { headline: 'Something special', body: 'Meridian writes this one.' })] }] });
}

test('every layout in the cards has a builder and a name', () => {
  for (const id of Cards.LAYOUTS) assert.ok(Lib.LAYOUT_INFO[id], id);
});

test('a story using every layout assembles into a site that passes the engine checker', () => {
  const out = Lib.assembleSite(storyAll(), { name: 'Sample Roofing Co', tokens: Lib.tokensFromDna({ colors: ['#0b1f3a', '#2bb3a3'], fonts: ['Figtree', 'Inter'] }), phone: '(541) 555-0100' });
  assert.deepEqual(out.errors, []);
  assert.deepEqual(out.custom, ['odd']);
  assert.deepEqual(out.short, [{ chapter: 'pics', needs: '3 kept images' }]);
  assert.deepEqual(out.site.pages.map(p => p.sections[0].id), ['site-nav', 'site-nav']);
  const files = Engine.renderSite(out.site, { assets: { a1: 'https://cdn.example.com/a1.jpg' } });
  assert.deepEqual(Object.keys(files).sort(), ['index.html', 'more/index.html']);
  const home = files['index.html'];
  assert.match(home, /Roofs done &lt;right&gt;/);
  assert.match(home, /href="\/more#book"/, 'call-to-action links to the booking chapter');
  assert.match(home, /<img src="https:\/\/cdn\.example\.com\/a1\.jpg" alt="Synthetic a1" loading="eager"[^>]*class="bg">/, 'hero photo is a real image, loaded first');
  assert.doesNotMatch(home, /class="trust"/, 'no trust line when the hero card has no proof');
  assert.doesNotMatch(home, /#ffffff|#000000/i, 'no pure white or black');
  assert.match(files['more/index.html'], /href="tel:5415550100"/, 'booking button calls the business');
  assert.match(files['more/index.html'], /<video[^>]* autoplay muted loop playsinline/);
  assert.doesNotMatch(home, /Concept for discussion/);
});

test('the hero shows its own sourced proof as a trust line', () => {
  const st = storyAll(); st.pages[0].chapters[0].proof = [{ claim: 'Licensed and insured', source: 'State license lookup' }];
  const out = Lib.assembleSite(st, { name: 'Sample Roofing Co' });
  assert.match(Engine.renderPage(out.site, 'home'), /<ul class="trust"><li>✓ Licensed and insured<\/li><\/ul>/);
});

test('style numbers come from Project DNA and stay readable', () => {
  const tk = Lib.tokensFromDna({ colors: ['#0b1f3a', '#2bb3a3'], fonts: ['Figtree', 'Inter'] });
  assert.equal(tk.colors.text, '#0b1f3a'); assert.equal(tk.colors.accent, '#2bb3a3');
  assert.deepEqual(tk.fonts, { heading: 'Figtree', body: 'Inter' });
  assert.ok(Lib.contrast(tk.colors.accent, tk.colors['on-accent']) >= 4.5);
  const light = Lib.tokensFromDna({ colors: ['#ffe680'], fonts: ['Bad<Font>'] });
  assert.equal(light.colors.text, Lib.DEFAULT_TOKENS.colors.text, 'a pale color never becomes body text');
  assert.equal(light.colors['on-accent'], '#0b1220');
  assert.deepEqual(light.fonts, { heading: 'Inter', body: 'Inter' });
  assert.deepEqual(Lib.tokensFromDna(null), { colors: { ...Lib.DEFAULT_TOKENS.colors }, fonts: { heading: 'Inter', body: 'Inter' } });
});

test('a concept site keeps the concept line, and edit keys let click-to-edit find each chapter', () => {
  const out = Lib.assembleSite(storyAll(), { name: 'Sample Roofing Co', concept: true });
  assert.match(Engine.renderPage(out.site, 'home'), /Concept for discussion, not affiliated with Sample Roofing Co\./);
  assert.equal(Engine.findEditable(out.site, 'home', 'hero-headline').sectionId, 'hero');
  assert.equal(Engine.findEditable(out.site, 'more', 'book-button').sectionId, 'book');
});
