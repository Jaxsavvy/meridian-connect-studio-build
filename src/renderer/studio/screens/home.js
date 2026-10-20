'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.MeridianStudioScreenStates = api.screenStates;
    root.MeridianStudio.registerScreen('home', { render: api.render });
  }
})(typeof window === 'undefined' ? null : window, function () {
  // Shared by the three screens; no shell or panel state is changed here.
  const screenStates = {
    failure(error, subject) {
      if (error?.status === 403 || error?.code === 'NO_ACCESS') return `You no longer have access to ${subject}.`;
      return `Unable to load ${subject}. Check your connection and access, then try again.`;
    },
    panel(doc, state, message, retry) {
      const box = doc.createElement('div'); box.className = `studio-state is-${state}`;
      const text = doc.createElement('p'); text.textContent = message;
      text.setAttribute('role', state === 'failed' ? 'alert' : 'status'); box.appendChild(text);
      if (state === 'failed' && retry) {
        const button = doc.createElement('button'); button.type = 'button';
        button.className = 'studio-button is-secondary'; button.textContent = 'Try again';
        button.addEventListener('click', retry); box.appendChild(button);
      }
      return box;
    },
    focus(root) {
      let first = true, label = null;
      return () => {
        const doc = root.ownerDocument, active = doc.activeElement;
        const owned = root.contains?.(active);
        const shouldFocus = first || owned || !active;
        if (owned && active.tagName === 'BUTTON') label = active.textContent;
        else if (!owned) label = null;
        first = false;
        // Keep a selected button across service refreshes when it still exists.
        return (preferred) => {
          if (!shouldFocus) return;
          const buttons = Array.from(root.querySelectorAll?.('button') || []);
          const target = buttons.find(button => label && button.textContent === label && !button.disabled)
            || preferred || root.querySelector?.('h1');
          if (target) { target.tabIndex = target.tagName === 'BUTTON' ? 0 : -1; target.focus?.(); }
        };
      };
    },
  };
  const LAST_SPACE = 'meridian.studio.lastSpace';
  function orderSpaces(spaces) {
    const rank = { 'sandbox-personal': 0, 'sandbox-team': 1, client: 2 };
    return [...spaces].sort((a, b) => (rank[a.type] ?? 3) - (rank[b.type] ?? 3));
  }
  function createHome({ service, storage, navigate, report }) {
    let disposed = false, revision = 0, spaces = [];
    async function load() {
      if (disposed) return;
      spaces = [];
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
          report({ state: 'failed', message: screenStates.failure(error, 'Spaces') });
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
    const focus = screenStates.focus(root);
    const model = createHome({ service: studio.service, storage, navigate: studio.navigate,
      report(view) {
        const restoreFocus = focus();
        root.replaceChildren(node('h1', 'Meridian Studio'));
        root.setAttribute('aria-busy', String(view.state === 'loading'));
        if (view.state !== 'ready') {
          root.appendChild(screenStates.panel(doc, view.state, view.state === 'loading' ? 'Loading Spaces…'
            : view.state === 'empty' ? 'No Spaces are assigned to you yet.' : view.message, () => void model.load()));
          restoreFocus(); return;
        }
        if (view.previous) {
          const card = node('section', '', 'studio-card studio-home-continue');
          card.append(node('h2', 'Continue where you left off'),
            button(`Continue in ${view.previous.name}`, 'studio-button is-primary', () => model.open(view.previous.id)));
          root.appendChild(card);
        }
        root.appendChild(node('h2', 'Choose a Space'));
        const grid = node('div', '', 'studio-home-spaces');
        for (const space of view.spaces) grid.appendChild(button(space.name, 'studio-tile studio-space-card', () => model.open(space.id)));
        root.appendChild(grid); restoreFocus();
      } });
    void model.load();
    return () => { model.dispose(); root.remove(); };
  }
  return { orderSpaces, createHome, render, screenStates };
});
