'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianStudio.registerScreen('home', { render: api.render });
})(typeof window === 'undefined' ? null : window, function () {
  const LAST_SPACE = 'meridian.studio.lastSpace';
  function orderSpaces(spaces) {
    const rank = { 'sandbox-personal': 0, 'sandbox-team': 1, client: 2 };
    return [...spaces].sort((a, b) => (rank[a.type] ?? 3) - (rank[b.type] ?? 3));
  }
  function createHome({ service, storage, navigate, report }) {
    let disposed = false, revision = 0, spaces = [];
    async function load() {
      const request = ++revision;
      report({ state: 'loading' });
      try {
        const next = orderSpaces(await service.listSpaces());
        if (disposed || request !== revision) return;
        spaces = next;
        let last;
        try { last = storage?.getItem(LAST_SPACE); } catch (_) { /* Storage is optional. */ }
        report({ state: spaces.length ? 'ready' : 'empty', spaces,
          previous: spaces.find(space => space.id === last) });
      } catch (error) {
        if (!disposed && request === revision) {
          spaces = [];
          report({ state: 'failed', message: error.status === 403 || error.code === 'NO_ACCESS'
            ? 'You no longer have access to these Spaces.' : 'Unable to load Spaces. Check your connection and try again.' });
        }
      }
    }
    const off = service.on(event => { if (event === 'spaces-changed') void load(); });
    return {
      load,
      open(spaceId) {
        if (disposed || !spaces.some(space => space.id === spaceId)) return false;
        try { storage?.setItem(LAST_SPACE, spaceId); } catch (_) { /* Navigation still works. */ }
        navigate('space', { spaceId });
        return true;
      },
      dispose() { disposed = true; revision++; off(); },
    };
  }
  function render(el, params, studio) {
    const doc = el.ownerDocument;
    const root = doc.createElement('section');
    root.className = 'studio-home';
    root.setAttribute('aria-label', 'Studio home');
    el.replaceChildren(root);
    let storage;
    try { storage = doc.defaultView.localStorage; } catch (_) { /* Private browsing. */ }
    function node(tag, text, className) {
      const item = doc.createElement(tag);
      if (text) item.textContent = text;
      if (className) item.className = className;
      return item;
    }
    function button(text, className, action) {
      const item = node('button', text, className);
      item.type = 'button'; item.addEventListener('click', action);
      return item;
    }
    const model = createHome({ service: studio.service, storage, navigate: studio.navigate,
      report(view) {
        root.replaceChildren(node('h1', 'Meridian Studio'));
        const state = node('p', view.state === 'loading' ? 'Loading Spaces…' : '', 'studio-state');
        state.setAttribute('role', view.state === 'failed' ? 'alert' : 'status');
        root.appendChild(state);
        root.setAttribute('aria-busy', String(view.state === 'loading'));
        if (view.state === 'failed') {
          state.textContent = view.message;
          root.appendChild(button('Try again', 'studio-button is-secondary', () => void model.load()));
          return;
        }
        if (view.state === 'empty') { state.textContent = 'No Spaces are assigned to you yet.'; return; }
        if (view.state !== 'ready') return;
        if (view.previous) {
          const card = node('section', '', 'studio-card studio-home-continue');
          card.append(node('h2', 'Continue where you left off'),
            button(`Continue in ${view.previous.name}`, 'studio-button is-primary', () => model.open(view.previous.id)));
          root.appendChild(card);
        }
        root.appendChild(node('h2', 'Choose a Space'));
        const grid = node('div', '', 'studio-home-spaces');
        for (const space of view.spaces) grid.appendChild(button(space.name, 'studio-tile studio-space-card', () => model.open(space.id)));
        root.appendChild(grid);
      } });
    void model.load();
    return () => { model.dispose(); root.remove(); };
  }
  return { orderSpaces, createHome, render };
});
