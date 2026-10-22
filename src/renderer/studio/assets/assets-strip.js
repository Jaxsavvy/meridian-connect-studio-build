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

  const reviewStatus = a => a?.approved ? 'Approved' : a?.review?.status === 'waiting' ? 'Waiting on Jax' : '';
  const canReview = a => Boolean(a && !a.trashed && !reviewStatus(a));
  function createReviewUI(onDirty) {
    const notes = new Map(), inputs = new Map(), menus = new Map(); let mutationDirty = false, closed = false;
    const report = () => { if (!closed) onDirty(mutationDirty || notes.size > 0); };
    return {
      hasDrafts: () => notes.size > 0,
      dirty(value) { mutationDirty = value; report(); },
      discard() { notes.clear(); for (const input of inputs.values()) input.value = ''; report(); },
      append(target, asset, locked, submit, menu) {
        const doc = target.ownerDocument, make = (tag, text) => { const n = doc.createElement(tag); if (text) n.textContent = text; return n; };
        const status = reviewStatus(asset);
        if (status && notes.delete(asset.id)) report();
        if (status) { const chip = make('span', status); chip.className = 'studio-chip asset-review-status'; chip.tabIndex = -1; chip.dataset.focus = asset.id + ':review'; target.append(chip); }
        if (asset.trashed) return;
        const send = menu || make('details'), summary = make('summary', 'Send to'), label = make('label', 'Review note (optional)');
        const note = make('textarea'); note.rows = 2; note.maxLength = 500; note.value = notes.get(asset.id) || '';
        note.dataset.focus = asset.id + ':review-note'; note.disabled = locked || !canReview(asset);
        note.addEventListener('input', () => { if (note.value) notes.set(asset.id, note.value); else notes.delete(asset.id); report(); });
        inputs.set(asset.id, note); label.append(note);
        send.open = Boolean(menus.get(asset.id)?.open || note.value); menus.set(asset.id, send);
        const button = make('button', 'Review'); button.type = 'button'; button.className = 'studio-button';
        button.dataset.focus = asset.id + ':review'; button.disabled = locked || !canReview(asset);
        let sending = false;
        button.addEventListener('click', async () => {
          if (button.disabled || closed || sending) return;
          sending = true;
          const ok = await submit(note.value); sending = false;
          if (closed) return;
          if (ok) { notes.delete(asset.id); const current = inputs.get(asset.id); if (current) current.value = ''; report(); }
          else button.disabled = locked || !canReview(asset);
        });
        if (!menu) send.append(summary); send.append(label, button); if (!menu) target.append(send);
      },
      dispose() { closed = true; notes.clear(); inputs.clear(); menus.clear(); onDirty(false); },
    };
  }
  function errorMessage(error) {
    if (/approved/i.test(error?.message || '')) return 'Approved work can only be moved to trash by Jax.';
    if ([401, 403, 404].includes(error?.status)) return 'This Space is unavailable or access has changed. Try again or choose another Space.';
    if (error?.code === 'OFFLINE') return 'You are offline. Your change has not been saved. Try again when connected.';
    return 'Assets could not be updated. Try again.';
  }
  function createController({ spaceId, service, reviewOnly = false, onChange = () => {}, onDirty = () => {} }) {
    const state = { phase: 'loading', assets: [], query: '', trash: false, error: '', busy: false, dirty: false };
    let closed = false, epoch = 0, retry = () => load();
    const snapshot = () => ({ ...state, assets: [...state.assets] });
    const notify = () => { if (!closed) onChange(snapshot()); };
    function dirty(value) { if (state.dirty !== value) { state.dirty = value; onDirty(value); } }
    async function load() {
      if (closed || state.busy) return false;
      const request = ++epoch;
      state.phase = 'loading'; state.error = ''; state.assets = []; notify();
      try {
        const assets = await (reviewOnly ? service.listReview(spaceId) : service.listAssets(spaceId, { query: state.query, includeTrash: state.trash }));
        if (closed || request !== epoch) return false;
        state.assets = visibleAssets(assets, spaceId, state.query, state.trash).filter(a => !reviewOnly || a.review?.status === 'waiting');
        state.phase = 'ready'; notify(); return true;
      } catch (error) {
        if (closed || request !== epoch) return false;
        state.phase = 'failed'; state.error = errorMessage(error); retry = () => load(); notify(); return false;
      }
    }
    async function act(action, id, note = '') {
      if (closed || state.busy) return false;
      const asset = state.assets.find(a => a.id === id && a.spaceId === spaceId);
      if (!asset || !(action === 'review' ? canReview(asset) && typeof note === 'string' && note.length <= 500 : actionsFor(asset).includes(action))) return false;
      ++epoch; state.busy = true; state.phase = 'saving'; state.error = ''; dirty(true); notify();
      try {
        const method = { keep: 'keepAsset', trash: 'trashAsset', restore: 'restoreAsset', review: 'sendToReview' }[action];
        const saved = await service[method](spaceId, id, ...(action === 'review' ? [note] : []));
        if (action === 'review' && (saved?.spaceId !== spaceId || saved.id !== id)) throw new Error('Could not confirm Review in this Space.');
        if (closed) return false;
        state.busy = false; dirty(false); return await load();
      } catch (error) {
        if (closed) return false;
        state.busy = false; state.phase = 'failed'; state.error = action === 'review' ? error?.message || 'Could not send to Review.' : errorMessage(error);
        retry = () => act(action, id, note); notify(); return false;
      }
    }
    const off = service.on((event, detail) => {
      if (!state.busy && !state.dirty && ((event === 'assets-changed' && detail?.spaceId === spaceId) || event === 'spaces-changed')) load();
    });
    return {
      snapshot, load, act, retry: () => retry(),
      filter(query, trash = state.trash, inReview = reviewOnly) {
        if (closed || state.dirty) return Promise.resolve(false);
        state.query = String(query); state.trash = Boolean(trash); reviewOnly = Boolean(inReview); return load();
      },
      discard() { if (!state.busy) { dirty(false); return load(); } },
      dispose() { closed = true; epoch += 1; off(); dirty(false); state.assets = []; },
    };
  }

  function mount(el, { spaceId, studio }) {
    const doc = el.ownerDocument, reviews = createReviewUI(value => { studio.setDirty(value); discard.hidden = !value || controller.snapshot().busy; });
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
    const retry = button('Try again', async () => { if (await controller.retry()) query.focus(); });
    const discard = button('Discard unsaved change', () => { reviews.discard(); controller.discard(); });
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
      retention.hidden = !state.trash; retry.hidden = state.phase !== 'failed'; discard.hidden = (!state.dirty && !reviews.hasDrafts()) || state.busy;
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
        reviews.append(row, asset, state.dirty, note => controller.act('review', asset.id, note));
        list.append(row);
      }
      if (actionFocus && !['loading', 'saving'].includes(state.phase)) {
        const controls = Array.from(section.querySelectorAll('[data-focus]')).filter(n => !n.disabled);
        (controls.find(n => n.dataset.focus === actionFocus) || controls.find(n => n.dataset.focus.startsWith(actionFocus.split(':')[0] + ':')) || (state.error ? retry : trash)).focus();
        actionFocus = null;
      }
    }
    const controller = createController({ spaceId, service: studio.service, onChange: render, onDirty: value => reviews.dirty(value) });
    controller.load();
    return () => { reviews.dispose(); controller.dispose(); el.replaceChildren(); };
  }
  return { reviewStatus, canReview, createReviewUI, visibleAssets, actionsFor, errorMessage, createController, mount };
});
