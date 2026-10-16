'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const root = join(__dirname, '../..');

function harness({ fallback = false } = {}) {
  const listeners = {};
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
    key: index => [...values.keys()][index] || null,
    get length() { return values.size; },
  };
  let state = { project: null, surface: 'website', phase: 'ready', unsaved: false, data: {} };
  let notify;
  const host = {
    innerHTML: '', hidden: false,
    contains: () => false,
    querySelector: selector => selector === '#website-new-name' ? { value: 'Synthetic site' } : null,
    addEventListener: (event, fn) => { listeners[event] = fn; },
    replaceChildren: () => {},
  };
  const context = { snapshot: () => ({ tools: [] }) };
  const sandbox = {
    document: { activeElement: null }, CSS: { escape: value => value },
    requestAnimationFrame: fn => fn(), setTimeout: () => 0, clearTimeout: () => {},
    localStorage: storage,
    MeridianStudioFixtures: { createSyntheticAdapter: () => ({}) },
    MeridianStudioWorkspace: {
      createWorkspace({ onChange }) {
        notify = onChange;
        return { destroy() {}, snapshot: () => state,
          openSurface(surface) { state = { ...state, surface }; notify(state); },
        };
      },
    },
  };
  if (fallback) Object.defineProperty(sandbox, 'localStorage', { get() { throw Error('Unavailable'); } });
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(root, 'src/renderer/studio-ui/website-builder.js'), 'utf8'), sandbox);
  vm.runInContext(readFileSync(join(root, 'src/renderer/studio-ui/studio-shell.js'), 'utf8'), sandbox);
  const instance = sandbox.MeridianStudioUI.mount({ host, context, getProjects: () => [] });
  function select(id) {
    state = { ...state, project: { id, name: id } };
    notify(state);
  }
  async function click(action, value) {
    const target = { dataset: { action, value }, closest() { return this; } };
    const contains = host.contains;
    host.contains = () => true;
    try { await listeners.click({ target }); } finally { host.contains = contains; }
  }
  function input(field, value) {
    listeners.input({ target: { dataset: { websiteBrief: field }, value } });
  }
  function visiblePanels() {
    return [...host.innerHTML.matchAll(/<(?:section|aside) [^>]*data-website-panel="([^"]+)"([^>]*)>/g)]
      .filter(match => !/\bhidden\b/.test(match[2])).map(match => match[1]);
  }
  return { host, click, input, select, visiblePanels, instance, values };
}

test('guided steps preserve unsaved edits and expose one panel', async () => {
  const h = harness(); h.select('synthetic-alpha');
  await h.click('website-create');
  assert.deepEqual(h.visiblePanels(), ['brief']);
  h.input('audience', 'Local businesses');
  for (const step of ['pages', 'edit', 'preview', 'brief']) {
    await h.click('website-step', step);
    assert.deepEqual(h.visiblePanels(), [step]);
    assert.match(h.host.innerHTML, /Local businesses/);
    assert.match(h.host.innerHTML, /Unsaved changes/);
  }
  await h.click('website-step', 'invalid-step');
  assert.deepEqual(h.visiblePanels(), ['brief']);
});

test('saved website list guards dirty work and resets the next opened workflow', async () => {
  const h = harness(); h.select('synthetic-alpha'); await h.click('website-create');
  h.input('goal', 'Get inquiries');
  await h.click('website-list');
  assert.match(h.host.innerHTML, /id="studio-leave-title"/);
  await h.click('keep-editing');
  assert.match(h.host.innerHTML, /Get inquiries/);
  await h.click('website-save');
  await h.click('website-step', 'preview');
  await h.click('website-list');
  assert.doesNotMatch(h.host.innerHTML, /data-website-panel=/);
  const id = h.host.innerHTML.match(/data-action="website-open" data-value="([^"]+)"/)[1];
  await h.click('website-open', id);
  assert.deepEqual(h.visiblePanels(), ['brief']);
  assert.match(h.host.innerHTML, /Get inquiries/);
});

test('fallback and project switches do not imply durable or shared saves', async () => {
  const h = harness({ fallback: true }); h.select('synthetic-alpha');
  assert.match(h.host.innerHTML, /session only/);
  await h.click('website-create');
  assert.match(h.host.innerHTML, /Session only/);
  assert.doesNotMatch(h.host.innerHTML, /Saved in this app/);
  h.input('audience', 'Alpha-only content');
  await h.click('website-step', 'preview');
  h.select('synthetic-beta'); await h.click('website-create');
  assert.deepEqual(h.visiblePanels(), ['brief']);
  assert.doesNotMatch(h.host.innerHTML, /Alpha-only content/);
});

test('device controls update the sandboxed preview without changing save state', async () => {
  const h = harness(); h.select('synthetic-alpha'); await h.click('website-create');
  await h.click('website-step', 'preview');
  await h.click('website-device', 'phone');
  assert.match(h.host.innerHTML, /class="website-device-phone"/);
  assert.match(h.host.innerHTML, /data-value="phone" aria-pressed="true"/);
  assert.match(h.host.innerHTML, /sandbox=""/);
  assert.match(h.host.innerHTML, /Saved in this app/);
  assert.doesNotMatch(h.host.innerHTML, /Unsaved changes/);
});

test('internal Studio navigation cannot bypass dirty Website work', async () => {
  const h = harness(); h.select('synthetic-alpha'); await h.click('website-create');
  h.input('goal', 'Keep this website edit');
  await h.click('surface', 'states');
  assert.match(h.host.innerHTML, /id="studio-leave-title"/);
  await h.click('keep-editing');
  assert.match(h.host.innerHTML, /Keep this website edit/);
  await h.click('surface', 'states');
  await h.click('save-leave');
  assert.doesNotMatch(h.host.innerHTML, /id="studio-leave-title"/);
  await h.click('surface', 'website');
  assert.match(h.host.innerHTML, /Keep this website edit/);
  assert.match(h.host.innerHTML, /Saved in this app/);
});

test('handoff preserves the session-only label when persistent storage is unavailable', async () => {
  const h = harness({ fallback: true }); h.select('synthetic-alpha'); await h.click('website-create');
  await h.click('surface', 'handoff');
  assert.match(h.host.innerHTML, /Session only/);
  assert.doesNotMatch(h.host.innerHTML, /Saved locally/);
  assert.match(h.host.innerHTML, /Submit to reviewer — unavailable/);
});
