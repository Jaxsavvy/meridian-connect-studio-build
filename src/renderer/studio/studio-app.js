/* Meridian Studio app shell: connection points every lane plugs into. Core lane.
 *
 *   MeridianStudio.registerScreen(name, { render(el, params, studio) })  Tyler: 'home', 'space', 'work'
 *   MeridianStudio.registerTool(id, { mountCanvas(el, ctx) })             Cassy: 'image-gen', 'asset-library'
 *   MeridianStudio.registerPart(name, { mount(el, ctx) })                 'conversation' (Core), 'assets-strip' (Cassy)
 *   MeridianStudio.navigate(name, params) / current() / setDirty(bool) / on(fn) / emit(event, detail)
 *   setDirty is per panel: each mounted tool/part gets its own flag, so one panel can't clear another's.
 *   MeridianStudio.mountInto(el, 'tool' | 'part', id, ctx)               screens use this to fill slots
 *   MeridianStudio.service  -> studio-service.js (the only data source)
 *
 * mount/mountCanvas may return a cleanup function; it runs when the view changes.
 * Anything not registered yet shows an honest "Coming soon" placeholder. */
'use strict';

(function () {
  const screens = new Map();
  const tools = new Map();
  const parts = new Map();
  const listeners = new Set();
  let host = null;
  let active = false;
  const dirtyOwners = new Set(); // each screen/panel keeps its own unsaved flag
  let mountCount = 0;
  let view = { name: 'home', params: {} };
  let cleanups = [];

  // Sample mode: a stand-in "Jax" approves after 5 seconds so the whole Job can be clicked through.
  // The real server (Core #48) replaces this; approvals then only come from Jax's Command queue.
  const sampleService = window.MeridianStudioService.createSampleService({ simulateJaxMs: 5000 });
  let serverService = null;
  let service = sampleService;   // switched by MeridianStudioUI.useServer() at sign-in (#48)
  let syncProjects = () => {};

  // Lane files. Each Wave 1 issue creates its own file(s) from this list, so nobody
  // edits index.html or another lane's file. Files that don't exist yet are skipped.
  const LANE_FILES = [
    'studio/screens/theme.css',
    'studio/screens/home.js', 'studio/screens/home.css',
    'studio/screens/space.js', 'studio/screens/space.css',
    'studio/screens/work.js', 'studio/screens/work.css',
    'studio/screens/workflow.js', 'studio/screens/workflow.css',
    'studio/screens/stage-bar.js', 'studio/screens/stage-bar.css',
    'studio/screens/job.js', 'studio/screens/job.css',
    'studio/screens/move-to-client.js', 'studio/screens/move-to-client.css',
    'studio/screens/pitch-deck.js', 'studio/screens/pitch-deck.css',
    'studio/tools/pitch-deck/homepage-builder.js', 'studio/tools/pitch-deck/homepage-builder.css',
    'studio/tools/pitch-deck/board.js', 'studio/tools/pitch-deck/board.css',
    'studio/assets/asset-model.js',
    'studio/assets/assets-strip.js', 'studio/assets/assets-strip.css',
    'studio/assets/version-history.js', 'studio/assets/version-history.css',
    'studio/tools/asset-library/asset-library.js', 'studio/tools/asset-library/asset-library.css',
    'studio/tools/image-gen/image-gen.js', 'studio/tools/image-gen/image-gen.css',
    'studio/tools/copywriter/copywriter.js', 'studio/tools/copywriter/copywriter.css',
    'studio/tools/storyboard/storyboard.js', 'studio/tools/storyboard/storyboard.css',
    'studio/ai/conversation.js', 'studio/ai/conversation.css',
  ];

  function loadLaneFiles() {
    for (const path of LANE_FILES) {
      const node = path.endsWith('.css') ? document.createElement('link') : document.createElement('script');
      if (path.endsWith('.css')) { node.rel = 'stylesheet'; node.href = path; } else { node.src = path; }
      node.addEventListener('error', () => node.remove(), { once: true });
      document.head.appendChild(node);
    }
  }

  function emit(event, detail) { for (const fn of listeners) fn(event, detail); }

  function runCleanups() {
    for (const fn of cleanups) { try { fn(); } catch (error) { console.error('Studio cleanup failed.', error); } }
    cleanups = [];
  }

  function placeholder(el, label) {
    el.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'studio-placeholder';
    box.setAttribute('role', 'status');
    box.textContent = `${label} — coming soon`;
    el.appendChild(box);
  }

  function track(result) { if (typeof result === 'function') cleanups.push(result); }

  function render() {
    if (!host || !active) return;
    runCleanups();
    const screen = screens.get(view.name);
    if (!screen) { placeholder(host, `Studio ${view.name} screen`); return; }
    try { track(screen.render(host, { ...view.params }, api)); }
    catch (error) { console.error('Studio screen failed.', error); placeholder(host, 'This screen hit a problem and'); }
  }

  /** Called by screens: fills a slot element with a registered part or tool. */
  function mountInto(el, kind, id, ctx = {}) {
    const entry = kind === 'tool' ? tools.get(id) : parts.get(id);
    const mount = entry && (kind === 'tool' ? entry.mountCanvas : entry.mount);
    if (!mount) { placeholder(el, kind === 'tool' ? `Tool "${id}"` : `Panel "${id}"`); return; }
    const owner = `${kind}:${id}:${++mountCount}`;
    const studio = Object.freeze(Object.create(api, { setDirty: { value: value => setDirtyFor(owner, value) } }));
    track(() => dirtyOwners.delete(owner));
    try { track(mount(el, { ...ctx, studio })); }
    catch (error) { console.error(`Studio ${kind} ${id} failed.`, error); placeholder(el, 'This panel hit a problem and'); }
  }

  function register(map, kind, id, entry, fnName) {
    if (typeof id !== 'string' || !id) throw new TypeError(`Studio ${kind} needs a name.`);
    if (!entry || typeof entry[fnName] !== 'function') throw new TypeError(`Studio ${kind} "${id}" needs ${fnName}().`);
    map.set(id, entry);
    render();
  }

  const api = Object.freeze({
    get service() { return service; },
    get context() { return window.meridianStudioContext; },
    registerScreen: (name, entry) => register(screens, 'screen', name, entry, 'render'),
    registerTool: (id, entry) => register(tools, 'tool', id, entry, 'mountCanvas'),
    registerPart: (name, entry) => register(parts, 'part', name, entry, 'mount'),
    mountInto,
    current: () => ({ name: view.name, params: { ...view.params } }),
    navigate(name, params = {}) {
      guardLeave(() => {
        dirtyOwners.clear();
        view = { name, params: { ...params } };
        emit('navigate', api.current());
        render();
      }, 'leave this screen');
    },
    setDirty(value) { setDirtyFor('screen', value); },
    /** Lets parts talk to each other, e.g. emit('image-results', out) from the conversation to the Image gen canvas. */
    emit,
    on(fn) {
      if (typeof fn !== 'function') throw new TypeError('Listener must be a function.');
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  });

  function setDirtyFor(owner, value) { if (value) dirtyOwners.add(owner); else dirtyOwners.delete(owner); }

  /** Unsaved-work guard used by Connect before sign-out, project switch, or leaving Studio. */
  function guardLeave(proceed, actionLabel) {
    if (!dirtyOwners.size || window.confirm(`You have unsaved work. ${actionLabel} anyway?`)) {
      dirtyOwners.clear();
      proceed();
      return true;
    }
    return false;
  }

  window.MeridianStudio = api;
  window.MeridianStudioUI = Object.freeze({
    mount({ host: el, getProjects }) {
      host = el;
      loadLaneFiles();
      syncProjects = () => service.setProjects(getProjects ? getProjects() : []);
      syncProjects();
      if (window.meridianStudioContext) window.meridianStudioContext.subscribe(() => syncProjects());
      render();
    },
    /** Real sign-in: Studio uses Team Hub (real images, real cost). Sample sign-in: built-in sample data. */
    useServer(on) {
      const bridge = window.meridian && window.meridian.api && window.meridian.api.studio;
      const next = on && typeof bridge === 'function'
        ? (serverService = serverService || window.MeridianStudioService.createServerService({ request: bridge }))
        : sampleService;
      if (next === service) return service.mode;
      runCleanups(); dirtyOwners.clear();
      service = next;
      view = { name: 'home', params: {} };
      syncProjects();
      render();
      return service.mode;
    },
    setActive(value) { active = Boolean(value); render(); },
    guardLeave,
  });
})();
