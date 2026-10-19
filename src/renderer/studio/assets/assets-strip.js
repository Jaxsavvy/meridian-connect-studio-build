'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.MeridianAssetsStrip = api;
    root.MeridianStudio.registerPart('assets-strip', { mount: api.mount });
  }
})(typeof window === 'undefined' ? null : window, function () {
  function visibleAssets(assets, spaceId, query = '', trash = false) {
    if (!Array.isArray(assets)) throw new Error('Invalid asset list.');
    return assets.map((asset, index) => ({ asset, index }))
      .filter(({ asset: a }) => a && a.spaceId === spaceId && typeof a.id === 'string' && typeof a.name === 'string'
        && Boolean(a.trashed) === trash && a.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => ((Date.parse(b.asset.createdAt) || 0) - (Date.parse(a.asset.createdAt) || 0)) || b.index - a.index)
      .map(({ asset }) => asset);
  }
  const actionsFor = a => a.trashed ? ['restore'] : [...(a.kept ? [] : ['keep']), ...(a.approved ? [] : ['trash'])];
  function errorMessage(error) {
    if (/approved/i.test(error?.message || '')) return 'Approved work can only be moved to trash by Jax.';
    if ([401, 403, 404].includes(error?.status)) return 'This Space is unavailable or access has changed. Try again or choose another Space.';
    if (error?.code === 'OFFLINE') return 'You are offline. Your change has not been saved. Try again when connected.';
    return 'Assets could not be updated. Try again.';
  }
  function createController({ spaceId, service, onChange = () => {}, onDirty = () => {} }) {
    const state = { phase: 'loading', assets: [], query: '', trash: false, error: '', busy: false, dirty: false };
    let closed = false, epoch = 0, retry = () => load();
    const snapshot = () => ({ ...state, assets: [...state.assets] });
    const notify = () => { if (!closed) onChange(snapshot()); };
    function dirty(value) { if (state.dirty !== value) { state.dirty = value; onDirty(value); } }
    async function load() {
      if (closed) return false;
      const request = ++epoch;
      state.phase = 'loading'; state.error = ''; state.assets = []; notify();
      try {
        const assets = await service.listAssets(spaceId, { query: state.query, includeTrash: state.trash });
        if (closed || request !== epoch) return false;
        state.assets = visibleAssets(assets, spaceId, state.query, state.trash);
        state.phase = 'ready'; notify(); return true;
      } catch (error) {
        if (closed || request !== epoch) return false;
        state.phase = 'failed'; state.error = errorMessage(error); retry = () => load(); notify(); return false;
      }
    }
    async function act(action, id) {
      if (closed || state.busy) return false;
      const asset = state.assets.find(a => a.id === id && a.spaceId === spaceId);
      if (!asset || !actionsFor(asset).includes(action)) return false;
      state.busy = true; state.phase = 'saving'; state.error = ''; dirty(true); notify();
      try {
        const method = { keep: 'keepAsset', trash: 'trashAsset', restore: 'restoreAsset' }[action];
        await service[method](spaceId, id);
        if (closed) return false;
        state.busy = false; dirty(false); return await load();
      } catch (error) {
        if (closed) return false;
        state.busy = false; state.phase = 'failed'; state.error = errorMessage(error);
        retry = () => act(action, id); notify(); return false;
      }
    }
    const off = service.on((event, detail) => {
      if (!state.busy && !state.dirty && ((event === 'assets-changed' && detail?.spaceId === spaceId) || event === 'spaces-changed')) load();
    });
    return {
      snapshot, load, act, retry: () => retry(),
      filter(query, trash = state.trash) {
        if (closed || state.dirty) return Promise.resolve(false);
        state.query = String(query); state.trash = Boolean(trash); return load();
      },
      discard() { if (!state.busy) { dirty(false); return load(); } },
      dispose() { closed = true; epoch += 1; off(); dirty(false); state.assets = []; },
    };
  }

  function mount(el, { spaceId, studio }) {
    const doc = el.ownerDocument;
    const node = (tag, text, className = '') => {
      const n = doc.createElement(tag); n.className = className;
      if (text !== undefined) n.textContent = text;
      return n;
    };
    const button = (label, action) => {
      const b = node('button', label); b.type = 'button'; b.addEventListener('click', action); return b;
    };
    const section = node('section', undefined, 'assets-strip'); section.setAttribute('aria-label', 'Space assets');
    const form = node('form', undefined, 'assets-strip-controls');
    const label = node('label', 'Search assets');
    const query = node('input'); query.type = 'search'; label.append(query);
    const search = button('Search', () => controller.filter(query.value));
    const trash = button('Trash', () => controller.filter(query.value, !controller.snapshot().trash));
    form.addEventListener('submit', event => { event.preventDefault(); controller.filter(query.value); });
    form.append(label, search, trash);
    const status = node('p'); status.setAttribute('aria-live', 'polite');
    const retry = button('Try again', () => controller.retry());
    const discard = button('Discard unsaved change', () => controller.discard());
    const retention = node('p', 'Trash empties after 30 days.');
    const list = node('ul', undefined, 'assets-strip-items'); list.setAttribute('aria-label', 'Assets');
    section.append(node('h2', 'Assets'), form, status, retry, discard, retention, list); el.replaceChildren(section);
    let actionFocus = null;
    function render(state) {
      // Preserve action focus across service-driven refreshes, as in the archived view.
      const focus = section.contains(doc.activeElement) ? doc.activeElement?.dataset.focus : null;
      if (focus) actionFocus = focus;
      section.classList.toggle('is-loading', ['loading', 'saving'].includes(state.phase));
      section.setAttribute('aria-busy', String(['loading', 'saving'].includes(state.phase)));
      query.disabled = search.disabled = trash.disabled = state.dirty;
      trash.textContent = state.trash ? 'Back to assets' : 'Trash'; trash.setAttribute('aria-pressed', String(state.trash));
      retention.hidden = !state.trash; retry.hidden = state.phase !== 'failed'; discard.hidden = !state.dirty || state.busy;
      status.setAttribute('role', state.error ? 'alert' : 'status');
      status.textContent = state.error || (state.phase === 'loading' ? 'Loading assets…' : state.busy ? 'Saving…' : state.assets.length ? `${state.assets.length} assets` :
        state.trash ? 'Trash is empty.' : state.query ? 'No assets match your search.' : 'Nothing here yet. Things you make in this Space show up here.');
      list.replaceChildren();
      for (const asset of state.assets) {
        const row = node('li', undefined, 'asset-thumb');
        row.classList.toggle('is-kept', Boolean(asset.kept)); row.classList.toggle('is-trashed', Boolean(asset.trashed));
        if (typeof asset.url === 'string' && /^(https:\/\/|blob:|data:image\/(png|jpeg|webp|gif|svg\+xml)[;,])/i.test(asset.url)) {
          const image = node('img'); image.src = asset.url; image.alt = asset.name;
          image.addEventListener('error', () => { image.hidden = true; }); row.append(image);
        }
        row.draggable = !asset.trashed;
        row.addEventListener('dragstart', event => {
          if (asset.trashed || !event.dataTransfer) { event.preventDefault(); return; }
          event.dataTransfer.setData('application/x-meridian-asset', asset.id); event.dataTransfer.effectAllowed = 'copy';
        });
        row.append(node('h3', asset.name));
        if (asset.kept) row.append(node('span', 'Kept', 'asset-kept-badge'));
        if (asset.approved) row.append(node('p', 'Approved work can only be moved to trash by Jax.'));
        for (const action of actionsFor(asset)) {
          const b = button({ keep: 'Keep', trash: 'Move to trash', restore: 'Restore' }[action], () => controller.act(action, asset.id));
          b.dataset.focus = `${asset.id}:${action}`; b.disabled = state.dirty; row.append(b);
        }
        list.append(row);
      }
      if (actionFocus && !['loading', 'saving'].includes(state.phase)) {
        const controls = Array.from(section.querySelectorAll('[data-focus]')).filter(n => !n.disabled);
        (controls.find(n => n.dataset.focus === actionFocus) || controls.find(n => n.dataset.focus.startsWith(actionFocus.split(':')[0] + ':')) || (state.error ? retry : trash)).focus();
        actionFocus = null;
      }
    }
    const controller = createController({ spaceId, service: studio.service, onChange: render, onDirty: value => studio.setDirty(value) });
    controller.load();
    return () => { controller.dispose(); el.replaceChildren(); };
  }
  return { visibleAssets, actionsFor, errorMessage, createController, mount };
});
