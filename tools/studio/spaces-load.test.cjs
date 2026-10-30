'use strict';
// SPACES-FIX 2026-10-25: the Studio Spaces load path, end to end in the renderer: createServerService + createHome.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createServerService } = require('../../src/renderer/studio/studio-service.js');
const { createHome } = require('../../src/renderer/studio/screens/home.js');

const LIST = [{ id: 'afterglow', type: 'client', name: 'Afterglow' },
  { id: 'sandbox-team', type: 'sandbox-team', name: 'Team sandbox' }, { id: 'sandbox-me', type: 'sandbox-personal', name: 'My sandbox' }];
const ok = data => ({ success: true, status: 200, data });
const wait = ms => new Promise(r => setTimeout(r, ms));
const settle = async () => { for (let i = 0; i < 10; i++) await new Promise(r => setImmediate(r)); };

// A stand-in Team Hub: answer(n) decides the n-th /api/studio/spaces reply; delay = how slow home base is.
function hub({ answer = () => ok(LIST), delay = 0 } = {}) {
  const hub = { calls: 0, token: 'session-1' };
  hub.request = async (method, endpoint) => {
    assert.equal(endpoint, '/api/studio/spaces');
    const n = ++hub.calls;
    if (delay) await wait(delay);
    return answer(n, hub);
  };
  return hub;
}
function home(service) {
  const views = [];
  const model = createHome({ service, storage: null, navigate() {}, report: v => views.push(v) });
  return { model, views, last: () => views.at(-1), states: () => views.map(v => v.state) };
}

test('repeated spaces-changed / setProjects during an in-flight load still ends ready, without restarting it', async () => {
  const h = hub({ delay: 40 });
  const service = createServerService({ request: h.request, retryDelays: [] });
  service.setProjects([{ id: 'afterglow', name: 'Afterglow' }]);
  const ui = home(service);
  const first = ui.model.load();
  for (let i = 0; i < 25; i++) {   // what a busy data sync looks like
    service.setProjects([{ id: 'afterglow', name: 'Afterglow' }]);
    if (i < 3) service.refresh();   // several reload requests while the first load is still out
    await wait(2);
  }
  await first; await wait(120); await settle();
  assert.equal(ui.last().state, 'ready');
  assert.deepEqual(ui.last().spaces.map(s => s.id), ['sandbox-me', 'sandbox-team', 'afterglow']);
  assert.equal(h.calls, 2, `Spaces fetched ${h.calls} times`);   // the load in flight + one coalesced refresh
  assert.equal(ui.states().filter(s => s === 'loading').length, 1, 'the list is never cleared for a background refresh');
  ui.model.dispose();
});

test('identical project syncs do not announce anything; a real assignment change does, once', async () => {
  const service = createServerService({ request: hub().request, retryDelays: [] });
  const events = []; service.on(e => events.push(e));
  service.setProjects([{ id: 'a' }, { id: 'b' }]);
  service.setProjects([{ id: 'b' }, { id: 'a' }]);
  await service.listSpaces();   // the local copy changing must not echo back as a reload
  assert.deepEqual(events, []);
  service.setProjects([{ id: 'a' }]);
  assert.deepEqual(events, ['spaces-changed']);
});

test('slow home base: Home waits and ends ready', async () => {
  const h = hub({ delay: 300 });
  const ui = home(createServerService({ request: h.request, retryDelays: [] }));
  await ui.model.load();
  assert.deepEqual(ui.states(), ['loading', 'ready']);
  assert.equal(h.calls, 1);
});

test('expired sign-in: 401 shows "sign in again" and tells Connect; after a new sign-in Spaces load', async () => {
  const h = hub({ answer: (n, s) => (s.token === 'expired'
    ? { success: false, status: 401, error: 'Sign in to use Studio.', code: 'signed-out' } : ok(LIST)) });
  h.token = 'expired';
  const service = createServerService({ request: h.request, retryDelays: [0, 0] });
  let signedOut = 0; service.on(e => { if (e === 'signed-out') signedOut++; });
  const ui = home(service);
  await ui.model.load();
  assert.equal(ui.last().state, 'failed');
  assert.match(ui.last().message, /sign-in has expired/i);
  assert.equal(signedOut, 1);
  assert.equal(h.calls, 1, 'a 401 is never retried');
  h.token = 'session-2';   // Jax signs in again; studio-app starts Studio again / refresh() reloads open screens
  service.refresh(); await settle();
  assert.equal(ui.last().state, 'ready');
  assert.equal(ui.last().spaces.length, 3);
});

test('passing failures are retried before Home gives up; a lasting failure offers Try again', async () => {
  const flaky = hub({ answer: n => (n === 1 ? { success: false, status: 0, offline: true, error: 'offline' }
    : n === 2 ? { success: false, status: 503, error: 'busy', code: 'spaces-unavailable' } : ok(LIST)) });
  const ui = home(createServerService({ request: flaky.request, retryDelays: [5, 5] }));
  await ui.model.load();
  assert.deepEqual(ui.states(), ['loading', 'ready']);
  assert.equal(flaky.calls, 3);

  const down = hub({ answer: () => ({ success: false, status: 503, error: 'secret db detail', code: 'spaces-unavailable' }) });
  const ui2 = home(createServerService({ request: down.request, retryDelays: [1, 1] }));
  await ui2.model.load();
  assert.equal(ui2.last().state, 'failed');
  assert.doesNotMatch(ui2.last().message, /secret/);
  assert.equal(down.calls, 3);
});

test('a background refresh that fails keeps the Spaces already shown', async () => {
  let up = true;
  const h = hub({ answer: () => (up ? ok(LIST) : { success: false, status: 0, offline: true, error: 'offline' }) });
  const service = createServerService({ request: h.request, retryDelays: [] });
  const ui = home(service);
  await ui.model.load();
  up = false; service.refresh(); await settle();
  assert.equal(ui.last().state, 'ready');
  assert.equal(ui.views.length, 2);
});
