'use strict';
// Core: chapter cards and the Website pipeline gates (#186). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const Cards = require('../../src/renderer/studio/website/chapter-cards.js');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { fillStory } = require('./helpers/website-story.cjs');

const messages = (story, stage, opts) => Cards.stageGaps(Cards.cleanStory(story), stage, opts).map(g => g.message);
const card = extra => ({ name: 'Hero', job: 'Get calls', words: { headline: 'Roofs done right', body: 'Licensed crews.' },
  layout: 'hero-photo', motion: 'none', phone: 'Stack the photo first', ...extra });
const story = c => ({ pages: [{ name: 'Home', path: '/', purpose: 'Get calls', chapters: [c] }] });

async function setup(tier = 'standard') {
  const s = createSampleService();
  s.setProjects([{ id: 'client-a', name: 'Client A' }, { id: 'client-b', name: 'Client B' }]);
  const job = await s.startJob('client-a', 'website', tier);
  return { s, job };
}

test('cleanStory keeps order, drops unknown fields, gives stable unique ids, refuses wrong types', () => {
  const out = Cards.cleanStory({ pricing: 1, pages: [{ name: 'Home', path: '/', chapters: [{ name: 'A', id: 'hero' }, { name: 'B', id: 'hero' }, { name: 'C', layout: 'spinner' }] }] });
  assert.equal(out.pricing, undefined);
  assert.deepEqual(out.pages[0].chapters.map(c => c.id), ['hero', 'ch-2', 'ch-3']);
  assert.equal(out.pages[0].chapters[2].layout, '');
  assert.throws(() => Cards.cleanStory({ pages: [{ name: 5 }] }), /must be text/);
  assert.throws(() => Cards.cleanStory({ pages: Array.from({ length: 21 }, () => ({})) }), /at most 20/);
  assert.throws(() => Cards.cleanStory(['nope']), /group of fields/);
});

test('each gate lists what is missing, and later gates include earlier ones', () => {
  assert.deepEqual(messages({ pages: [] }, 'plan'), ['Add at least one page.']);
  assert.ok(messages(story({ name: 'Hero' }), 'plan').some(m => /one job/.test(m)));
  assert.deepEqual(messages(story(card()), 'plan'), []);
  assert.ok(messages(story(card({ words: { headline: 'TBD' } })), 'words').some(m => /body/.test(m)));
  assert.ok(messages(story(card({ words: { headline: 'Lorem ipsum', body: 'x' } })), 'words').some(m => /placeholder/.test(m)));
  assert.ok(messages(story(card({ layout: '', phone: '' })), 'storyboard').some(m => /layout/.test(m)));
  assert.ok(messages(story(card({ proof: [{ claim: '500 roofs' }] })), 'storyboard').some(m => /source/.test(m)));
  assert.ok(messages(story({ name: 'Hero' }), 'storyboard').some(m => /one job/.test(m)), 'storyboard gate includes plan');
  assert.deepEqual(messages(story(card()), 'build'), [], 'stages without a gate have no gaps');
});

test('Standard has no motion or video; Cinematic allows them', () => {
  const moving = card({ motion: 'parallax', shots: [{ what: 'Drone pass', prompt: 'Synthetic drone video', size: 'wide', tool: 'video' }] });
  assert.equal(messages(story(moving), 'storyboard', { tier: 'standard' }).length, 2);
  assert.deepEqual(messages(story(moving), 'storyboard', { tier: 'cinematic' }), []);
});

test('Look and assets needs every shot made and kept', () => {
  const withShot = card({ shots: [{ what: 'Crew', prompt: 'Synthetic crew', size: 'wide', tool: 'image', assetId: 'asset-9' }] });
  assert.ok(messages(story(withShot), 'look').some(m => /keep it/.test(m)));
  assert.deepEqual(messages(story(withShot), 'look', { hasAsset: id => id === 'asset-9' }), []);
});

test('a Website Job starts its story from the Kickoff pages, Home first at /', async () => {
  const { s, job } = await setup();
  await s.saveStageNotes('client-a', job.id, 'brief', { pages: ['Services', 'Home', 'About Us'] });
  const st = await s.getStory('client-a', job.id);
  assert.deepEqual(st.pages.map(p => [p.name, p.path]), [['Home', '/'], ['Services', '/services'], ['About Us', '/about-us']]);
});

test('gates block finishing a stage until its cards are filled', async () => {
  const { s, job } = await setup();
  await s.completeStage('client-a', job.id); await s.approveStage('client-a', job.id);    // Kickoff
  await assert.rejects(s.completeStage('client-a', job.id), /Not ready yet: \d+ things? to finish/);
  const saved = await fillStory(s, 'client-a', job.id);
  assert.deepEqual(saved.gaps, []);
  for (const want of ['words', 'storyboard']) assert.equal((await s.completeStage('client-a', job.id)).stageId, want);
  await s.completeStage('client-a', job.id); await s.approveStage('client-a', job.id);    // Storyboard: Jax OKs it
  assert.equal((await s.completeStage('client-a', job.id)).stageId, 'build');
  await assert.rejects(s.saveStory('client-a', job.id, { pages: [] }), /locked/);
});

test('stories stay in their Space and Job type', async () => {
  const { s, job } = await setup();
  await assert.rejects(s.getStory('client-b', job.id), /not found/);
  const other = (await s.generateImage({ spaceId: 'client-b', description: 'Synthetic', count: 1 })).results[0].assetId;
  const bad = story(card({ shots: [{ what: 'x', prompt: 'y', size: 'wide', tool: 'image', assetId: other }] }));
  await assert.rejects(s.saveStory('client-a', job.id, bad), /not in this Space/);
  const deck = await s.startJob('client-a', 'pitch-deck', 'deck');
  await assert.rejects(s.getStory('client-a', deck.id), /Only Website Jobs/);
});
