'use strict';
// Core #48: Studio on the real server (Team Hub /api/studio/) and the main-process request guard.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createSampleService, createServerService } = require('../../src/renderer/studio/studio-service.js');

function fakeServer(routes = {}) {
  const calls = [];
  const request = async (method, endpoint, body) => {
    calls.push({ method, endpoint, body });
    const key = `${method} ${endpoint.split('?')[0]}`;
    const handler = routes[key];
    if (!handler) return { success: false, status: 404, error: 'Not found.' };
    return handler(endpoint, body);
  };
  return { request, calls };
}
const ok = data => ({ success: true, status: 200, data });

test('generate: stable safe request id, job tags, image urls through meridian-media, assets-changed event', async () => {
  const srv = fakeServer({
    'POST /api/studio/spaces/afterglow/generate': (e, body) => ok({ requestId: body.requestId, refinedDescription: 'x',
      settingsUsed: { preset: 'Website hero' }, results: [{ assetId: 'a_1', url: '/api/studio/files/afterglow/a_1', note: '' }] }),
  });
  const s = createServerService({ request: srv.request });
  const events = []; s.on((ev, d) => events.push([ev, d]));
  const out = await s.generateImage({ spaceId: 'afterglow', requestId: 'afterglow:k3x:1', presetId: 'website-hero',
    description: 'Stage', count: 2, jobId: 'job-1', stageId: 'look', references: ['ignored'] });
  const sent = srv.calls[0].body;
  assert.equal(sent.requestId, 'afterglow-k3x-1');
  assert.equal(sent.count, 2); assert.equal(sent.jobId, 'job-1'); assert.equal(sent.stageId, 'look');
  assert.equal(out.requestId, 'afterglow:k3x:1');                       // the caller's id comes back unchanged
  assert.equal(out.results[0].url, 'meridian-media://studio/afterglow/a_1');
  assert.deepEqual(events.at(-1), ['assets-changed', { spaceId: 'afterglow' }]);
  await s.generateImage({ spaceId: 'afterglow', requestId: 'afterglow:k3x:1', presetId: 'website-hero', description: 'Stage', count: 2 });
  assert.equal(srv.calls[1].body.requestId, sent.requestId);             // a retry is recognised: same id
});

test('server errors keep their safe message and code; offline POST is marked uncertain', async () => {
  const s = createServerService({ request: async () => ({ success: false, status: 402, error: 'This Space is waiting on Jax before more images can be made.', code: 'waiting-on-jax' }) });
  await assert.rejects(s.generateImage({ spaceId: 'a', requestId: 'r', description: 'x' }),
    e => e.code === 'waiting-on-jax' && /waiting on Jax/.test(e.message) && !/\$/.test(e.message));
  const off = createServerService({ request: async () => ({ success: false, status: 0, offline: true, uncertain: true, error: 'Studio could not reach home base.' }) });
  await assert.rejects(off.generateImage({ spaceId: 'a', requestId: 'r', description: 'x' }), e => e.uncertain === true);
});

test('assets, actions, review and versions map to the right endpoints; urls never expose the server path', async () => {
  const a = { id: 'a_1', spaceId: 'afterglow', name: 'hero__v1', url: '/api/studio/files/afterglow/a_1', kept: false };
  const srv = fakeServer({
    'GET /api/studio/spaces/afterglow/assets': () => ok([a]),
    'POST /api/studio/spaces/afterglow/assets/a_1/review': (e, b) => ok({ ...a, kept: true, review: { status: 'waiting', note: b.note } }),
    'POST /api/studio/spaces/afterglow/assets/a_1/keep': () => ok({ ...a, kept: true }),
    'GET /api/studio/spaces/afterglow/review': () => ok([a]),
    'GET /api/studio/spaces/afterglow/assets/a_1/versions': () => ok([a]),
  });
  const s = createServerService({ request: srv.request });
  const list = await s.listAssets('afterglow', { query: 'hero', includeTrash: true });
  assert.equal(srv.calls[0].endpoint, '/api/studio/spaces/afterglow/assets?q=hero&trash=1');
  assert.equal(list[0].url, 'meridian-media://studio/afterglow/a_1');
  assert.equal((await s.sendToReview('afterglow', 'a_1', 'Hero option')).review.status, 'waiting');
  assert.equal(srv.calls[1].body.note, 'Hero option');
  assert.equal((await s.keepAsset('afterglow', 'a_1')).kept, true);
  assert.equal((await s.listReview('afterglow')).length, 1);
  assert.equal((await s.listVersions('afterglow', 'a_1')).length, 1);
  assert.ok(srv.calls.every(c => !/admin|files/.test(c.endpoint)));
});

test('approvals never happen from Connect; unbuilt server features say so instead of faking', async () => {
  const s = createServerService({ request: fakeServer().request });
  assert.throws(() => s.approveAsset('a', 'b'), /Only Jax approves/);
  assert.throws(() => s.approveStage('a', 'b'), /Only Jax approves/);
  assert.throws(() => s.copyToSpace('a', 'b', 'c'), /Coming soon/);
  assert.throws(() => s.saveVersion('a', 'b'), /Coming soon/);
});

test('Jobs stay local (no cost) and list the real images made inside them', async () => {
  const local = createSampleService();
  local.setProjects([{ id: 'afterglow', name: 'Afterglow' }]);
  const job = await local.startJob('afterglow', 'website', 'standard');
  const srv = fakeServer({
    'GET /api/studio/spaces/afterglow/assets': () => ok([
      { id: 'a_1', spaceId: 'afterglow', jobId: job.id, stageId: 'look' },
      { id: 'a_2', spaceId: 'afterglow', jobId: 'other', stageId: 'look' },
    ]),
    'GET /api/studio/spaces/afterglow': () => ok({ id: 'afterglow', type: 'client', name: 'Afterglow', dna: null, jobs: [] }),
  });
  const s = createServerService({ request: srv.request, local });
  const byStage = await s.listJobAssets('afterglow', job.id);
  assert.deepEqual(byStage.look.map(a => a.id), ['a_1']);
  const space = await s.getSpace('afterglow');
  assert.equal(space.jobs[0].name, 'Website v1');
});

test('main-process guard: only employee Studio routes, base derived from the Connect server address', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-settings-'));
  const settings = path.join(dir, 'settings.json');
  fs.writeFileSync(settings, JSON.stringify({ serverUrl: 'https://home-base.example.ts.net/connect' }));
  process.env.MERIDIAN_CONNECT_SETTINGS = settings;
  delete require.cache[require.resolve('../../src/api.js')];
  const api = require('../../src/api.js');
  const seen = [];
  const realFetch = global.fetch;
  global.fetch = async (url, opts) => { seen.push({ url, opts }); return { ok: true, status: 200, json: async () => ({ fine: true }) }; };
  try {
    for (const bad of ['/api/studio/admin/log', '/api/studio/files/a/b', '/api/studio/../connect/api/x', '/connect/api/projects', '/api/studio/spaces?x=<y>', 42]) {
      assert.equal((await api.studioRequest('GET', bad)).error, 'Not allowed', String(bad));
    }
    assert.equal(seen.length, 0);
    const res = await api.studioRequest('POST', '/api/studio/spaces/afterglow/generate', { requestId: 'r' });
    assert.equal(res.success, true);
    assert.equal(seen[0].url, 'https://home-base.example.ts.net/api/studio/spaces/afterglow/generate');
    assert.equal(seen[0].opts.method, 'POST');
    assert.deepEqual(api.studioFileRequest('afterglow', 'a_1').url, 'https://home-base.example.ts.net/api/studio/files/afterglow/a_1');
  } finally {
    global.fetch = realFetch;
    delete process.env.MERIDIAN_CONNECT_SETTINGS;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
