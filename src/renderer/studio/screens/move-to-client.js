'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianStudio.registerPart('move-to-client', { mount: api.mount });
})(typeof window === 'undefined' ? null : window, function () {
  function createMove({ service, spaceId, assetId, report, navigate, onDone }) {
    let disposed = false, revision = 0, asset = null, clients = [], target = null, busy = false, copied = false;
    const show = (error = '') => report({ state: copied ? 'copied' : target ? 'confirm' : 'select', asset, clients, target, busy, error });
    async function load() {
      if (disposed || busy) return;
      const request = ++revision; asset = null; clients = []; target = null; report({ state: 'loading' });
      try {
        const [spaces, assets, source] = await Promise.all([service.listSpaces(), service.listAssets(spaceId), service.getSpace(spaceId)]);
        if (disposed || request !== revision) return;
        asset = assets.find(a => a.id === assetId && a.spaceId === spaceId && !a.trashed);
        if (!asset || source?.id !== spaceId || !source.type.startsWith('sandbox')) throw Error('Only sandbox work can be moved to a client.');
        clients = spaces.filter(s => s.type === 'client' && s.id !== spaceId); show();
      } catch (error) {
        if (!disposed && request === revision) report({ state: 'failed', error: error.message || 'Unable to load client Spaces.' });
      }
    }
    return { load,
      choose(id) {
        if (disposed || busy || copied || !asset) return;
        target = clients.find(s => s.id === id) || null; show();
      },
      async copy() {
        if (disposed || busy || copied || !target || !asset) return;
        busy = true; show();
        try {
          await service.copyToSpace(spaceId, assetId, target.id);
          if (!disposed) { busy = false; copied = true; show(); }
        } catch (error) { if (!disposed) { busy = false; show(error.message || 'Unable to copy. Try again.'); } }
      },
      open() { if (!disposed && copied) navigate('space', { spaceId: target.id }); },
      done() { if (!disposed && !busy) onDone(); },
      dispose() { disposed = true; revision++; },
    };
  }
  function mount(el, { spaceId, assetId, onDone, studio, signal }) {
    const doc = el.ownerDocument, root = doc.createElement('section');
    root.className = 'studio-move-to-client studio-card'; root.setAttribute('aria-label', 'Move to client'); el.replaceChildren(root);
    const states = doc.defaultView?.MeridianStudioScreenStates || require('./home.js').screenStates;
    const focus = states.focus(root);
    function node(tag, text) { const item = doc.createElement(tag); if (text) item.textContent = text; return item; }
    function button(label, action, busy) {
      const item = node('button', label); item.type = 'button'; item.className = 'studio-button is-secondary';
      item.disabled = !!busy; item.addEventListener('click', action); return item;
    }
    function cleanup() { model.dispose(); signal?.removeEventListener('abort', cleanup); root.remove(); }
    const model = createMove({ service: studio.service, spaceId, assetId, navigate: studio.navigate,
      onDone() { cleanup(); onDone(); },
      report(view) {
        const restore = focus(), title = node('h2', 'Move to client');
        root.replaceChildren(title); root.setAttribute('aria-busy', String(view.state === 'loading' || !!view.busy));
        if (view.state === 'loading') root.appendChild(states.panel(doc, 'loading', 'Loading client Spaces…'));
        else if (view.state === 'failed') root.appendChild(states.panel(doc, 'failed', view.error, () => void model.load()));
        else if (view.state === 'select') {
          if (!view.clients.length) root.appendChild(node('p', "You don't have any client Spaces yet"));
          for (const client of view.clients) root.appendChild(button(client.name, () => model.choose(client.id)));
        } else if (view.state === 'confirm') {
          root.append(node('p', `Copy ${view.asset.name} into ${view.target.name}? Your sandbox keeps its copy.`),
            button(view.busy ? 'Copying…' : 'Copy', () => void model.copy(), view.busy));
          if (view.error) { const error = node('p', view.error); error.setAttribute('role', 'alert'); root.appendChild(error); }
        } else {
          const status = node('p', `Copied to ${view.target.name}`); status.setAttribute('role', 'status');
          root.append(status, button(`Open ${view.target.name}`, () => model.open()));
        }
        root.appendChild(button(view.state === 'copied' ? 'Done' : 'Cancel', () => model.done(), view.busy));
        title.tabIndex = -1; restore(title);
      } });
    signal?.addEventListener('abort', cleanup, { once: true });
    if (signal?.aborted) cleanup(); else void model.load();
    return cleanup;
  }
  return { createMove, mount };
});
