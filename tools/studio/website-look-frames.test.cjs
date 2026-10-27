'use strict';
// Core: look frames, ChatGPT designs the look and the engine builds it (#202). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const Look = require('../../src/renderer/studio/website/look-frames.js');
const Cards = require('../../src/renderer/studio/website/chapter-cards.js');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { fillStory } = require('./helpers/website-story.cjs');

const story = () => Cards.cleanStory({ pages: [{ id: 'home', name: 'Home', path: '/', purpose: 'Calls', chapters: [
  { id: 'hero', name: 'Hero', job: 'Calls', layout: 'hero-photo', motion: 'none', phone: 'Stack',
    words: { eyebrow: 'Eugene roofing', headline: 'Roofs done "right"', body: 'Licensed crews.', button: 'Book a visit' },
    shots: [{ what: 'Crew on a finished roof', prompt: 'A roofing crew at golden hour', size: 'wide', tool: 'image' }] },
  { id: 'services', name: 'Services', job: 'Show range', layout: 'services', motion: 'none', phone: 'One column', words: { headline: 'What we do', body: 'Repair: Fast' } }] }] });
const dna = { colors: ['#0b1f3a', '#2bb3a3'], fonts: ['Figtree', 'Inter'], voice: 'Plain-spoken', audience: 'Local homeowners' };

test('the frame prompt carries the cards in order, the brand, the direction and the honesty rules', () => {
  const p = Look.framePrompt(story(), { name: 'Sample Roofing Co', dna, direction: 'warm' });
  assert.match(p, /"Sample Roofing Co"/);
  assert.match(p, /1\. Hero with full-bleed photo: label "Eugene roofing", headline "Roofs done 'right'", button "Book a visit"; photo: Crew on a finished roof \| 2\. Services as photo tiles: headline "What we do"/);
  assert.match(p, /#0b1f3a, #2bb3a3/); assert.match(p, /Warm and trustworthy/);
  assert.match(p, /no star ratings, review counts, testimonials or prices/);
  assert.ok(p.length <= 3800);
  const withFooter = story(); withFooter.pages[0].chapters.push({ ...withFooter.pages[0].chapters[1], id: 'foot', layout: 'footer', words: { headline: 'internal', body: '', button: '', eyebrow: '' } });
  assert.doesNotMatch(Look.framePrompt(withFooter, { name: 'X' }), /internal/, 'footer headline stays out');
  assert.notEqual(Look.framePrompt(story(), { name: 'X', direction: 'bold' }), Look.framePrompt(story(), { name: 'X', direction: 'premium' }));
  assert.throws(() => Look.framePrompt({ pages: [] }, { name: 'X' }), /needs chapters/);
});

test('shot prompts match the chosen direction and never ask for text or logos', () => {
  const p = Look.shotPrompt(story().pages[0].chapters[0].shots[0], { direction: 'premium', dna });
  assert.match(p, /A roofing crew at golden hour\./); assert.match(p, /Premium and editorial/);
  assert.match(p, /room for a headline on the left/); assert.match(p, /no text, no logos, no watermarks/);
});

test('reading the chosen frame only sets safe colours, fonts and library layouts for real chapters', () => {
  const out = Look.tokensFromFrame({ colors: { text: '#101820', accent: '#e07a2f', bg: '#ffffe0', surface: 'red' }, fonts: { heading: 'DM Sans', body: '<script>' },
    layouts: { hero: 'hero-split', services: 'custom', ghost: 'gallery', 'not-a-chapter': 'faq' } }, story(), dna);
  assert.equal(out.tokens.colors.text, '#101820'); assert.equal(out.tokens.colors.accent, '#e07a2f');
  assert.equal(out.tokens.colors.bg, '#ffffe0'); assert.notEqual(out.tokens.colors.surface, 'red');
  assert.deepEqual(out.tokens.fonts, { heading: 'DM Sans', body: 'DM Sans' });
  assert.deepEqual(out.layouts, { hero: 'hero-split' });
  assert.equal(Look.tokensFromFrame(null, story(), dna).tokens.colors.text, '#0b1f3a', 'nothing read: falls back to Project DNA');
});

test('Meridian makes one frame per direction, Jax picks one, and Look and assets waits for that pick', async () => {
  const s = createSampleService();
  s.setProjects([{ id: 'client-a', name: 'Client A' }]);
  const job = await s.startJob('client-a', 'website', 'standard');
  await assert.rejects(s.makeLookFrames('client-a', job.id), /Finish the storyboard first/);
  await fillStory(s, 'client-a', job.id);
  const look = await s.makeLookFrames('client-a', job.id);
  assert.deepEqual(look.frames.map(f => f.direction), ['bold', 'bold', 'warm', 'premium']);   // the helper made one bold frame first
  assert.ok((await s.listJobAssets('client-a', job.id)).look.length >= 4, 'frames are kept Look assets on the Job');
  await assert.rejects(s.chooseLookFrame('client-a', job.id, 'frame-x'), /not on this Job/);
  await s.chooseLookFrame('client-a', job.id, look.frames[2].id);
  const prompts = await s.getShotPrompts('client-a', job.id);
  assert.equal(prompts.length, 1); assert.match(prompts[0].prompt, /Warm and trustworthy/); assert.equal(prompts[0].made, true);
  assert.equal((await s.listPresets()).some(p => p.id === 'look-frame'), false, 'look frames stay out of Image gen\'s list');
});

test('without a pick, the Look gate says so first', async () => {
  const s = createSampleService();
  s.setProjects([{ id: 'client-a', name: 'Client A' }]);
  const job = await s.startJob('client-a', 'website', 'standard');
  await fillStory(s, 'client-a', job.id);
  await s.makeLookFrames('client-a', job.id, { directions: ['warm'] });
  const look = await s.getLook('client-a', job.id);
  assert.ok(look.chosenId, 'helper already picked one');
  const fresh = await s.startJob('client-a', 'website', 'cinematic');
  assert.equal((await s.getStoryGaps('client-a', fresh.id, 'look'))[0].where, 'Look frame');
  await assert.rejects(s.makeLookFrames('client-a', job.id, { directions: ['neon'] }), /Unknown design direction/);
});
