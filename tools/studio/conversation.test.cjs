'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { pickPreset, sharpenDescription, createConversation } = require('../../src/renderer/studio/ai/conversation.js');

function setup(spaceId = 'proj_a', toolId = 'image-gen') {
  const service = createSampleService();
  service.setProjects([{ id: 'proj_a', name: 'Sample Roofing' }]);
  const events = [];
  const convo = createConversation({ service, emit: (name, detail) => events.push({ name, detail }), spaceId, toolId });
  return { service, events, convo };
}

test('picks a sensible preset from plain words', async () => {
  const presets = await createSampleService().listPresets('image-gen');
  assert.equal(pickPreset('homepage hero of a crew on a roof', presets).id, 'website-hero');
  assert.equal(pickPreset('before and after of the kitchen', presets).id, 'before-after');
  assert.equal(pickPreset('christmas special', presets).id, 'seasonal');
  assert.equal(pickPreset('something', presets).id, presets[0].id);
});

test('sharper description keeps the request and adds brand and preset detail', () => {
  const out = sharpenDescription('crew on a roof at sunrise.', { name: 'Website hero', size: '16:9' }, 'anonymous',
    { voice: 'Confident', colors: ['#0b1f3a', '#2bb3a3'] });
  assert.match(out, /^crew on a roof at sunrise; anonymous;/);
  assert.match(out, /website hero composition, 16:9/);
  assert.match(out, /#0b1f3a/);
  assert.match(out, /no text or fake logos/);
});

test('full flow: describe, answer, see proposal, generate only on yes', async () => {
  const { service, events, convo } = setup();
  await convo.start();
  await convo.send('homepage hero, crew on a roof at sunrise');
  assert.match(convo.messages.at(-1).text, /Website hero/);
  await convo.send('anonymous');
  const proposal = convo.messages.at(-1);
  assert.ok(proposal.proposal, 'shows a sharper description');
  assert.equal(events.length, 0, 'nothing generated before yes');
  assert.equal((await service.listAssets('proj_a')).length, 0);
  await convo.confirm();
  assert.equal(events.length, 1);
  assert.equal(events[0].name, 'image-results');
  assert.equal(events[0].detail.results.length, 4);
  assert.equal((await service.listAssets('proj_a')).length, 4);
  assert.ok(convo.messages.at(-1).settingsUsed);
  assert.equal(convo.hasDraft, false);
});

test('typing "yes" also confirms; other text revises the proposal', async () => {
  const { events, convo } = setup('sandbox-me');
  await convo.start();
  await convo.send('instagram post for a spring sale');
  await convo.send('square');
  await convo.send('make it brighter');
  assert.match(convo.messages.at(-1).proposal, /make it brighter/);
  assert.equal(events.length, 0);
  await convo.send('yes');
  assert.equal(events.length, 1);
});

test('never mentions cost and is honest about other tools', async () => {
  const { convo } = setup('proj_a', 'video');
  await convo.start();
  await convo.send('make a video');
  const all = JSON.stringify(convo.messages);
  assert.match(all, /coming soon/i);
  const img = setup();
  await img.convo.start();
  await img.convo.send('homepage hero');
  await img.convo.send('anonymous');
  await img.convo.confirm();
  assert.doesNotMatch(JSON.stringify(img.convo.messages), /cost|price|\$\d/i);
});
