'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const root = join(__dirname, '../..');

function harness({ fallback = false, saveDraft = null, writeBlocked = false, stored = [] } = {}) {
  const listeners = {};
  const values = new Map(stored);
  const windowListeners = {};
  const storage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => { if (writeBlocked) throw Error('Synthetic storage full'); values.set(key, value); },
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
    addEventListener: (name, callback) => { windowListeners[name] = callback; },
    removeEventListener: (name, callback) => { if (windowListeners[name] === callback) delete windowListeners[name]; },
    MeridianStudioFixtures: { createSyntheticAdapter: () => ({}) },
    MeridianStudioWorkspace: {
      createWorkspace({ onChange }) {
        notify = onChange;
        return { destroy() {}, snapshot: () => state,
          openSurface(surface) { state = { ...state, surface }; notify(state); },
          async saveDraft() {
            const saved = saveDraft ? await saveDraft() : true;
            if (saved) { state = { ...state, unsaved: false, saveState: 'Saved' }; notify(state); }
            return saved;
          },
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
  return { host, click, input, select, visiblePanels, instance, values, unload() { const event = { prevented: false, preventDefault() { this.prevented = true; } }; windowListeners.beforeunload?.(event); return event; }, windowListeners, makeStudioDirty() { state = { ...state, unsaved: true, saveState: 'Unsaved' }; notify(state); } };
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

test('saved website catalogue failures show retry rather than an empty list and recover after storage returns', async () => {
  const h=harness();h.select('synthetic-alpha');await h.click('website-create');
  const keys=h.values.keys;h.values.keys=()=>{throw Error('Storage enumeration denied');};
  await h.click('website-list');
  assert.match(h.host.innerHTML,/Saved website list unavailable/);
  assert.match(h.host.innerHTML,/Retry saved website list/);
  assert.doesNotMatch(h.host.innerHTML,/No website projects have been saved|0 saved projects/);
  await h.click('website-refresh');assert.match(h.host.innerHTML,/Saved website list unavailable/);
  h.values.keys=keys;await h.click('website-refresh');
  assert.doesNotMatch(h.host.innerHTML,/Saved website list unavailable/);
  assert.match(h.host.innerHTML,/data-action="website-open"/);
});

test('Keep editing cancels a leave request even when its asynchronous save later succeeds', async () => {
  let finish;
  const h=harness({saveDraft:()=>new Promise(resolve=>{finish=resolve;})});h.select('synthetic-alpha');h.makeStudioDirty();
  let navigated=0;
  assert.equal(h.instance.guardLeave(()=>navigated++,'leave Studio'),false);
  const saving=h.click('save-leave');await h.click('keep-editing');finish(true);await saving;
  assert.equal(navigated,0,'A save acknowledgement must not revive cancelled navigation');
  assert.doesNotMatch(h.host.innerHTML,/id="studio-leave-title"/);
});

test('a late save acknowledgement cannot clear or accept a newer leave dialog', async () => {
  let finish;const completion=new Promise(resolve=>{finish=resolve;});
  const h=harness({saveDraft:()=>completion});h.select('synthetic-alpha');h.makeStudioDirty();
  let oldTarget=0,newTarget=0;
  h.instance.guardLeave(()=>oldTarget++,'old target');const saving=h.click('save-leave');await h.click('keep-editing');
  assert.equal(h.instance.guardLeave(()=>newTarget++,'new target'),false);
  finish(true);await saving;
  assert.equal(oldTarget,0);assert.equal(newTarget,0);assert.match(h.host.innerHTML,/id="studio-leave-title"/);
  await h.click('save-leave');assert.equal(oldTarget,0);assert.equal(newTarget,1);
});

test('retained section identities are escaped in every editor label and input attribute', async () => {
  const h=harness();h.select('synthetic-alpha');await h.click('website-create');
  const key=[...h.values.keys()].find(key=>key.startsWith('meridian.website.')&&!key.endsWith('.index')&&!key.endsWith('.pending')&&!key.endsWith('.backup'));
  const project=JSON.parse(h.values.get(key));project.pages[0].sections[0].id='section" data-preview-injection="yes';h.values.set(key,JSON.stringify(project));
  await h.click('website-list');await h.click('website-open',project.id);await h.click('website-step','edit');
  assert.doesNotMatch(h.host.innerHTML,/data-preview-injection="yes/,'A stored identity must not introduce an HTML attribute');
  assert.match(h.host.innerHTML,/id="website-section&quot; data-preview-injection=&quot;yes-heading"/);
  assert.match(h.host.innerHTML,/for="website-section&quot; data-preview-injection=&quot;yes-action"/);
});


test('full storage at mount preserves readable saved websites and reports failed saves without a session fallback', async () => {
  const Builder = require('../../src/renderer/studio-ui/website-builder.js');
  const storage = Builder.createMemoryStorage();
  const controller = Builder.createController({ storage, idFactory: () => 'website-quota' });
  controller.selectContext({ id: 'synthetic-alpha', name: 'Alpha' });
  controller.createProject('Retained readable website');
  const stored = Array.from({ length: storage.length }, (_, i) => [storage.key(i), storage.getItem(storage.key(i))]);
  const h = harness({ writeBlocked: true, stored }); h.select('synthetic-alpha');
  assert.match(h.host.innerHTML, /Retained readable website/);
  assert.doesNotMatch(h.host.innerHTML, /Websites are session only/);
  await h.click('website-open', 'website-quota'); h.input('audience', 'Keep my edits');
  await h.click('website-save');
  assert.match(h.host.innerHTML, /Save failed/);
  assert.match(h.host.innerHTML, /Keep my edits/);
  assert.deepEqual([...h.values.entries()], stored, 'Read-only opening and failed save preserve saved bytes');
});

test('Website unload guard keeps edits until explicit save and removes its listener on disposal', async () => {
  const h = harness(); h.select('synthetic-alpha'); await h.click('website-create');
  assert.equal(h.unload().prevented, false);
  h.input('audience', 'Unsaved close guard');
  assert.equal(h.unload().prevented, true);
  assert.match(h.host.innerHTML, /then close or reload the window again/);
  await h.click('keep-editing'); assert.match(h.host.innerHTML, /Unsaved close guard/);
  assert.equal(h.unload().returnValue, false);
  await h.click('save-leave'); assert.equal(h.unload().prevented, false);
  h.instance.destroy(); assert.equal(h.windowListeners.beforeunload, undefined);
});

test('campaign unload guard protects in-flight unsaved work and releases after save acknowledgement', async () => {
  let finish; const result = new Promise(resolve => { finish = resolve; });
  const h = harness({ saveDraft: () => result }); h.select('synthetic-alpha'); h.makeStudioDirty();
  assert.equal(h.unload().prevented, true);
  const saving = h.click('save-leave'); assert.equal(h.unload().prevented, true);
  finish(true); await saving; assert.equal(h.unload().prevented, false);
});
