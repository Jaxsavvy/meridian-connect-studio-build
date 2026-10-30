'use strict';
// STUDIO-AI 2026-10-25: the Studio chat talks to Meridian through the server (POST /api/studio/spaces/<id>/chat).
// Network is mocked: a fake service stands in for the server. No real model or image calls.

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService, createServerService } = require('../../src/renderer/studio/studio-service.js');
const { createConversation, safeSettings } = require('../../src/renderer/studio/ai/conversation.js');
const { serverRows } = require('../../src/renderer/studio/tools/image-gen/image-gen.js');

const SETTINGS = [{ label: 'Preset', value: 'Website hero' }, { label: 'Size', value: '16:9 (1536x1024)' },
  { label: 'Count', value: '2' }, { label: 'Brand DNA', value: 'Off' }, { label: 'Model', value: 'gpt-image-1.5' }];

/** The sample service plus a fake Meridian chat that remembers what it was sent. */
function meridianService({ off = false } = {}) {
  const base = createSampleService();
  base.setProjects([{ id: 'proj_a', name: 'Sample Roofing' }]);
  const sent = [], made = [];
  let n = 0;
  const service = {
    ...base,
    async chat(spaceId, req) {
      sent.push({ spaceId, ...req });
      if (off) { const e = new Error('off'); e.code = 'studio_ai_off'; e.status = 503; throw e; }
      n += 1;
      const msg = req.message.toLowerCase();
      if (msg.includes('fuck')) return { sessionId: 'cs_1', reply: "Sorry. What's wrong with it?", suggestions: [], proposal: null, needsQuestion: true };
      return { sessionId: 'cs_1', reply: 'Here is how I would describe it.', suggestions: [{ id: 'website-hero', name: 'Website hero' }],
        proposal: { id: `p_${n}`, prompt: `A viking cat warrior, version ${n}`, presetId: req.presetId || 'website-hero',
          presetName: 'Website hero', count: 2, size: '16:9', settings: SETTINGS }, needsQuestion: false };
    },
    async generateImage(req) {
      made.push(req);
      const out = await base.generateImage(req);
      return { ...out, settings: SETTINGS, settingsUsed: { preset: 'Website hero', size: '16:9', cost: '$1', count: 2 }, proposalId: req.proposalId };
    },
  };
  return { service, sent, made };
}

function setup(opts) {
  const { service, sent, made } = meridianService(opts);
  const events = [];
  const convo = createConversation({ service, spaceId: 'proj_a', toolId: 'image-gen', report: () => {},
    emit: (name, detail) => events.push({ name, detail }) });
  return { convo, sent, made, events };
}

test('Meridian answers, the session carries on after generating, and images need an approval', async () => {
  const { convo, sent, made, events } = setup();
  await convo.start();
  assert.equal(convo.mode, 'meridian');
  assert.ok(convo.messages[0].suggestions.some(s => s.id === 'website-hero'), 'presets show as chips');
  await convo.send('i want a cat who is viking braid lining up for battle with his fellow warriors cats');
  const proposal = convo.messages.at(-1);
  assert.equal(proposal.proposal, 'A viking cat warrior, version 1');
  assert.deepEqual(proposal.actions, ['I approve', 'Generate']);
  assert.ok(proposal.settings.length >= 4);
  await convo.confirm();
  assert.equal(made.length, 0, 'Generate does nothing before "I approve"');
  convo.approve();
  await convo.confirm();
  assert.equal(made.length, 1);
  assert.equal(made[0].proposalId, 'p_1');
  const results = events.find(e => e.name === 'image-results').detail;
  assert.deepEqual(results.settings.map(r => r.label), ['Preset', 'Size', 'Count', 'Brand DNA', 'Model']);
  assert.equal(results.proposalId, 'p_1');
  assert.doesNotMatch(JSON.stringify(results), /cost|\$1/);
  const done = convo.messages.at(-1);
  assert.deepEqual(done.settings.find(([k]) => k === 'Size'), ['Size', '16:9 (1536x1024)'], 'settings bullets have values');
  assert.equal(convo.sessionId, 'cs_1');
  await convo.send('hey the rest of the people need to be cats as well');
  assert.equal(sent.at(-1).sessionId, 'cs_1', 'follow-up after generating keeps the conversation');
  assert.equal(convo.messages.at(-1).proposal, 'A viking cat warrior, version 2');
});

test('a typed yes approves and generates; a complaint never becomes a proposal', async () => {
  const { convo, made } = setup();
  await convo.start();
  await convo.send('a viking cat');
  await convo.send('yes');
  assert.equal(made.length, 1);
  await convo.send('ok what the fuck');
  assert.equal(convo.messages.at(-1).proposal, undefined);
  assert.equal(convo.hasDraft, false);
  assert.match(convo.messages.at(-1).text, /what's wrong/i);
  assert.equal(made.length, 1);
});

test('a preset chip asks Meridian with that preset', async () => {
  const { convo, sent } = setup();
  await convo.start();
  await convo.choosePreset('product-shot');
  assert.equal(sent.at(-1).presetId, 'product-shot');
  assert.equal(convo.messages.at(-1).proposal, 'A viking cat warrior, version 1');
});

test('Meridian chat off (503 studio_ai_off): says so once and the guided steps take over', async () => {
  const { convo, sent } = setup({ off: true });
  await convo.start();
  await convo.send('homepage hero, crew on a roof at sunrise');
  assert.equal(convo.mode, 'script');
  assert.ok(convo.messages.some(m => /isn't available right now/.test(m.text)));
  assert.match(convo.messages.at(-1).text, /Website hero|sharper way/);
  await convo.send('anonymous');
  assert.equal(sent.length, 1, 'no more chat calls once it is off');
});

test('settings filters: server list, raw keys, display keys; nothing about money', () => {
  assert.deepEqual(safeSettings(SETTINGS).map(([k]) => k), ['Preset', 'Size', 'Count', 'Brand DNA', 'Model']);
  assert.deepEqual(safeSettings({ Preset: 'Website hero', Size: '16:9', Options: '2', 'Brand DNA': 'On' }),
    [['Preset', 'Website hero'], ['Size', '16:9'], ['Options', '2'], ['Brand DNA', 'On']]);
  assert.deepEqual(safeSettings([{ label: 'Cost', value: '$0.30' }, { label: 'Model', value: 'about $1' }]), []);
  assert.deepEqual(serverRows(SETTINGS).length, 5);
});

test('server service: chat route, proposal id on generate, preview and thumb URLs', async () => {
  const calls = [];
  const request = async (method, endpoint, body) => {
    calls.push({ method, endpoint, body });
    if (endpoint.endsWith('/chat')) return { success: true, data: { sessionId: 'cs_9', proposal: null } };
    if (endpoint.endsWith('/generate')) return { success: true, data: { results: [{ assetId: 'a_1' }] } };
    if (endpoint.includes('/assets')) return { success: true, data: [{ id: 'a_1', spaceId: 's1', kind: 'image' }] };
    return { success: false, status: 503, code: 'studio_ai_off', error: 'off' };
  };
  const svc = createServerService({ request, fileBase: 'https://host/connect' });
  await svc.chat('s1', { sessionId: 'cs_9', message: 'hi', presetId: 'seasonal' });
  assert.deepEqual(calls[0], { method: 'POST', endpoint: '/api/studio/spaces/s1/chat',
    body: { message: 'hi', tool: 'image-gen', session_id: 'cs_9', preset_id: 'seasonal' } });
  const out = await svc.generateImage({ spaceId: 's1', requestId: 'r1', proposalId: 'p_1', count: 2 });
  assert.equal(calls[1].body.proposalId, 'p_1');
  assert.equal(out.results[0].previewUrl, 'https://host/connect/api/studio/files/s1/a_1/preview');
  const [a] = await svc.listAssets('s1');
  assert.equal(a.thumbUrl, 'https://host/connect/api/studio/files/s1/a_1/thumb');
  await assert.rejects(() => svc.listReview('s1'), e => e.code === 'studio_ai_off');
});
