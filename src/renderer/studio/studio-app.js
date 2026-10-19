/* Meridian Studio app shell: connection points every lane plugs into. Core lane.
 *
 *   MeridianStudio.registerScreen(name, { render(el, params, studio) })  Tyler: 'home', 'space', 'work'
 *   MeridianStudio.registerTool(id, { mountCanvas(el, ctx) })             Cassy: 'image-gen', 'asset-library'
 *   MeridianStudio.registerPart(name, { mount(el, ctx) })                 'conversation' (Core), 'assets-strip' (Cassy)
 *   MeridianStudio.navigate(name, params) / current() / setDirty(bool) / on(fn)
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
  let dirty = false;
  let view = { name: 'home', params: {} };
  let cleanups = [];

  const service = window.MeridianStudioService.createSampleService();

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
    try { track(mount(el, { ...ctx, studio: api })); }
    catch (error) { console.error(`Studio ${kind} ${id} failed.`, error); placeholder(el, 'This panel hit a problem and'); }
  }

  function register(map, kind, id, entry, fnName) {
    if (typeof id !== 'string' || !id) throw new TypeError(`Studio ${kind} needs a name.`);
    if (!entry || typeof entry[fnName] !== 'function') throw new TypeError(`Studio ${kind} "${id}" needs ${fnName}().`);
    map.set(id, entry);
    render();
  }

  const api = Object.freeze({
    service,
    get context() { return window.meridianStudioContext; },
    registerScreen: (name, entry) => register(screens, 'screen', name, entry, 'render'),
    registerTool: (id, entry) => register(tools, 'tool', id, entry, 'mountCanvas'),
    registerPart: (name, entry) => register(parts, 'part', name, entry, 'mount'),
    mountInto,
    current: () => ({ name: view.name, params: { ...view.params } }),
    navigate(name, params = {}) {
      guardLeave(() => {
        dirty = false;
        view = { name, params: { ...params } };
        emit('navigate', api.current());
        render();
      }, 'leave this screen');
    },
    setDirty(value) { dirty = Boolean(value); },
    on(fn) {
      if (typeof fn !== 'function') throw new TypeError('Listener must be a function.');
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  });

  /** Unsaved-work guard used by Connect before sign-out, project switch, or leaving Studio. */
  function guardLeave(proceed, actionLabel) {
    if (!dirty || window.confirm(`You have unsaved work. ${actionLabel} anyway?`)) {
      dirty = false;
      proceed();
      return true;
    }
    return false;
  }

  window.MeridianStudio = api;
  window.MeridianStudioUI = Object.freeze({
    mount({ host: el, getProjects }) {
      host = el;
      const sync = () => service.setProjects(getProjects ? getProjects() : []);
      sync();
      if (window.meridianStudioContext) window.meridianStudioContext.subscribe(sync);
      render();
    },
    setActive(value) { active = Boolean(value); render(); },
    guardLeave,
  });
})();
