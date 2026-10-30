'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { orderSpaces, createHome } = require('../../src/renderer/studio/screens/home.js');
const spaces = [{ id: 'client-a', type: 'client', name: 'A' },
  { id: 'team', type: 'sandbox-team', name: 'Team' }, { id: 'me', type: 'sandbox-personal', name: 'Me' }];
function setup(overrides = {}, storage) {
  const views = [], routes = [];
  let listener, removed = false;
  const service = { listSpaces: async () => spaces, on(fn) { listener = fn; return () => { removed = true; }; }, ...overrides };
  const model = createHome({ service, storage, report: v => views.push(v), navigate: (...v) => routes.push(v) });
  return { model, views, routes, emit: event => listener(event), removed: () => removed };
}
test('personal and team sandboxes precede assigned clients without mutating input', () => {
  assert.deepEqual(orderSpaces(spaces).map(s => s.id), ['me', 'team', 'client-a']);
  assert.equal(spaces[0].id, 'client-a');
});
test('continue only appears for a still-assigned Space; opening stores id and routes through guard', async () => {
  const saved = [];
  const s = setup({}, { getItem: () => 'client-a', setItem: (...v) => saved.push(v) });
  await s.model.load();
  assert.equal(s.views[0].state, 'loading');
  assert.equal(s.views.at(-1).previous.id, 'client-a');
  assert.equal(s.model.open('unassigned'), false);
  assert.equal(s.model.open('team'), true);
  assert.deepEqual(saved, [['meridian.studio.lastSpace', 'team']]);
  assert.deepEqual(s.routes, [['space', { spaceId: 'team' }]]);
  const revoked = setup({}, { getItem: () => 'unassigned' });
  await revoked.model.load();
  assert.equal(revoked.views.at(-1).previous, undefined);
});
test('blocked storage does not block loading or navigation', async () => {
  const s = setup({}, { getItem() { throw Error(); }, setItem() { throw Error(); } });
  await s.model.load(); s.model.open('me');
  assert.equal(s.routes.length, 1);
});
test('empty and failed loads are safe and retry succeeds without leaking errors', async () => {
  let fail = true;
  const s = setup({ listSpaces: async () => { if (fail) throw Error('private server details'); return []; } });
  await s.model.load();
  assert.equal(s.views.at(-1).state, 'failed');
  assert.doesNotMatch(s.views.at(-1).message, /private/);
  fail = false; await s.model.load();
  assert.equal(s.views.at(-1).state, 'empty');
});
test('a service event during a load waits for it, then refreshes once; cleanup ignores late results', async () => {
  const releases = [];
  const s = setup({ listSpaces: () => new Promise(r => releases.push(r)) });
  const first = s.model.load(); s.emit('spaces-changed'); s.emit('spaces-changed');
  assert.equal(releases.length, 1);   // SPACES-FIX 2026-10-25: the load in flight is not thrown away
  releases[0]([]); await new Promise(r => setImmediate(r));
  assert.equal(releases.length, 2);   // one follow-up for both events
  releases[1](spaces); await first;
  assert.equal(s.views.at(-1).state, 'ready');
  const late = s.model.load(); const count = s.views.length;
  s.model.dispose(); releases[2](spaces); await late;
  assert.equal(s.views.length, count); assert.equal(s.removed(), true);
  assert.equal(s.model.open('me'), false);
});
