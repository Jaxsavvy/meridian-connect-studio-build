'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const { pickPreset, sharpenDescription, chooseQuestion, safeSettings, COPY, createConversation } =
  require('../../src/renderer/studio/ai/conversation.js');

const quiet = () => {};

function sampleService() {
  const service = createSampleService();
  service.setProjects([{ id: 'proj_a', name: 'Sample Roofing' }, { id: 'proj_b', name: 'Sample Plumbing' }]);
  return service;
}

/** Wraps a service so tests can count, delay or break individual calls. */
function wrap(service, overrides = {}) {
  const calls = { generateImage: 0, requestIds: [] };
  const wrapped = { ...service };
  wrapped.generateImage = async (req) => {
    calls.generateImage += 1;
    calls.requestIds.push(req.requestId);
    return overrides.generateImage ? overrides.generateImage(req) : service.generateImage(req);
  };
  if (overrides.getSpace) wrapped.getSpace = overrides.getSpace;
  return { wrapped, calls };
}

function setup({ spaceId = 'proj_a', toolId = 'image-gen', service = sampleService(), emit } = {}) {
  const events = [];
  const convo = createConversation({ service, spaceId, toolId, report: quiet,
    emit: emit || ((name, detail) => events.push({ name, detail })) });
  return { service, events, convo };
}

async function toProposal(convo, text = 'homepage hero, crew on a roof at sunrise', answer = 'anonymous') {
  await convo.start();
  await convo.send(text);
  await convo.send(answer);
  assert.ok(convo.messages.at(-1).proposal, 'reached the proposal step');
}

test('picks a sensible preset and a non-redundant question', async () => {
  const presets = await createSampleService().listPresets('image-gen');
  const hero = pickPreset('homepage hero of a crew on a roof', presets);
  assert.equal(hero.id, 'website-hero');
  assert.equal(chooseQuestion(hero, 'homepage hero of a crew on a roof'), 'People visible or anonymous?');
  assert.equal(chooseQuestion(hero, 'hero'), 'What should the hero show?');
  assert.equal(pickPreset('before and after of the kitchen', presets).id, 'before-after');
  assert.equal(pickPreset('christmas special', presets).id, 'seasonal');
});

test('sharper description keeps the request and adds brand and preset detail', () => {
  const out = sharpenDescription('crew on a roof at sunrise.', { name: 'Website hero', size: '16:9' }, 'anonymous',
    { voice: 'Confident', colors: ['#0b1f3a', '#2bb3a3'] });
  assert.match(out, /^crew on a roof at sunrise; anonymous;/);
  assert.match(out, /#0b1f3a/);
});

test('full flow generates only on yes and tags results with their Space', async () => {
  const { service, events, convo } = setup();
  await toProposal(convo);
  assert.equal(events.length, 0);
  assert.equal((await service.listAssets('proj_a')).length, 0);
  await convo.confirm();
  assert.equal(events.length, 1);
  assert.equal(events[0].name, 'image-results');
  assert.equal(events[0].detail.spaceId, 'proj_a');
  assert.equal(events[0].detail.results.length, 4);
  assert.deepEqual(convo.messages.at(-1).settings.map(([k]) => k), ['Preset', 'Size', 'Options', 'Brand DNA']);
  assert.equal(convo.hasDraft, false);
});

test('a late result after leaving the Space is never shown anywhere else', async () => {
  const base = sampleService();
  let release;
  const gate = new Promise((r) => { release = r; });
  const { wrapped } = wrap(base, { generateImage: async (req) => { await gate; return base.generateImage(req); } });
  const a = setup({ service: wrapped });
  await toProposal(a.convo);
  const pendingConfirm = a.convo.confirm();
  a.convo.dispose();   // person navigates to another Space while generating
  const b = setup({ spaceId: 'proj_b', service: wrapped });
  await b.convo.start();
  release();
  await pendingConfirm;
  assert.equal(a.events.length, 0, 'no event from the old panel');
  assert.equal(b.events.length, 0, 'nothing reaches Space B');
  assert.equal((await base.listAssets('proj_a')).length, 4, 'results stay saved in Space A');
  assert.equal((await base.listAssets('proj_b')).length, 0);
});

test('a display failure after generation never causes a second generation', async () => {
  const base = sampleService();
  const { wrapped, calls } = wrap(base);
  const { convo } = setup({ service: wrapped, emit: () => { throw new Error('canvas exploded at X:\\private\\frame'); } });
  await toProposal(convo);
  await convo.confirm();
  assert.equal(convo.messages.at(-1).text, COPY.displayFailed);
  assert.equal(convo.hasDraft, false, 'nothing left to retry');
  await convo.confirm();
  await convo.send('yes');
  assert.equal(calls.generateImage, 1);
  assert.equal((await base.listAssets('proj_a')).length, 4);
  assert.doesNotMatch(JSON.stringify(convo.messages), /exploded|private/);
});

test('an uncertain failure reconciles instead of generating again', async () => {
  const base = sampleService();
  const events = [];
  const { wrapped, calls } = wrap(base, { generateImage: async (req) => { await base.generateImage(req); throw new Error('socket hang up'); } });
  const { convo } = setup({ service: wrapped, emit: (n, d) => events.push(d) });
  await toProposal(convo);
  await convo.confirm();
  assert.ok(convo.messages.some(m => m.text === COPY.reconciled));
  assert.equal(events.length, 1);
  assert.equal(events[0].results.length, 4);
  assert.equal(convo.hasDraft, false);
  await convo.confirm();
  assert.equal(calls.generateImage, 1);
});

test('a real failure stays retryable with the same request id', async () => {
  const base = sampleService();
  let fail = true;
  const { wrapped, calls } = wrap(base, { generateImage: async (req) => {
    if (fail) { fail = false; throw new Error('500 at /srv/router key=sk-abc'); }
    return base.generateImage(req);
  } });
  const { convo, events } = setup({ service: wrapped });
  await toProposal(convo);
  await convo.confirm();
  assert.equal(convo.messages.at(-1).text, COPY.generateFailed);
  assert.equal(convo.hasDraft, true);
  await convo.confirm();
  assert.equal(calls.generateImage, 2);
  assert.equal(calls.requestIds[0], calls.requestIds[1], 'retry reuses the same request id');
  assert.equal(events.length, 1);
  assert.doesNotMatch(JSON.stringify(convo.messages), /srv|sk-abc|500/);
});

test('only allow-listed settings are shown, whatever the service returns', async () => {
  assert.deepEqual(safeSettings({ preset: 'Website hero', size: '16:9', count: 4, useBrandDna: true,
    cost: 0.32, apiKey: 'sk-secret', path: 'X:\\private\\frame', model: 'gpt-image', size2: 'x' }),
  [['Preset', 'Website hero'], ['Size', '16:9'], ['Options', '4'], ['Brand DNA', 'On']]);
  const base = sampleService();
  const { wrapped } = wrap(base, { generateImage: async (req) => {
    const out = await base.generateImage(req);
    return { ...out, settingsUsed: { ...out.settingsUsed, cost: '$0.32', apiKey: 'sk-secret', debug: '/var/log/x' } };
  } });
  const { convo, events } = setup({ service: wrapped });
  await toProposal(convo);
  await convo.confirm();
  const shown = JSON.stringify([convo.messages, events]);
  assert.doesNotMatch(shown, /0\.32|sk-secret|var\/log|cost/i);
});

test('Send does nothing until the Space and presets have loaded', async () => {
  const base = sampleService();
  let release;
  const { wrapped, calls } = wrap(base, { getSpace: async (id) => { await new Promise((r) => { release = r; }); return base.getSpace(id); } });
  const { convo } = setup({ service: wrapped });
  const starting = convo.start();
  assert.equal(convo.ready, false);
  assert.equal(await convo.send('homepage hero'), false);
  assert.equal(convo.messages.length, 0);
  release();
  await starting;
  assert.equal(convo.ready, true);
  assert.equal(await convo.send('homepage hero, crew on a roof'), true);
  assert.equal(calls.generateImage, 0);
});

test('no access: safe message, panel stays locked, no raw error text', async () => {
  const base = sampleService();
  const { wrapped } = wrap(base, { getSpace: async () => { throw new Error('403 /internal/spaces/proj_x token expired'); } });
  const { convo } = setup({ spaceId: 'proj_x', service: wrapped });
  assert.equal(await convo.start(), false);
  assert.equal(convo.ready, false);
  assert.equal(convo.messages.at(-1).text, COPY.startFailed);
  assert.equal(await convo.send('anything'), false);
  assert.doesNotMatch(JSON.stringify(convo.messages), /403|internal|token/);
});

test('never mentions cost and is honest about other tools', async () => {
  const { convo } = setup({ toolId: 'video' });
  await convo.start();
  await convo.send('make a video');
  assert.match(JSON.stringify(convo.messages), /coming soon/i);
  const img = setup();
  await toProposal(img.convo);
  await img.convo.confirm();
  assert.doesNotMatch(JSON.stringify(img.convo.messages), /cost|price|\$\d/i);
});
