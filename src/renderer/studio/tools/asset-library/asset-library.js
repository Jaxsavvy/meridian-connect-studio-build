'use strict';
(function (root, factory) {
  // Resolve browser dependencies at mount time: lane scripts may finish loading out of order.
  const api = factory(
    () => root ? root.MeridianAssetModel : require('../../assets/asset-model.js'),
    () => root ? root.MeridianAssetsStrip : require('../../assets/assets-strip.js'),
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.MeridianAssetLibrary = api; root.MeridianStudio.registerTool('asset-library', { mountCanvas: api.mountCanvas }); }
})(typeof window === 'undefined' ? null : window, function (getRules, getStrip) {
  function suggestedName(asset) {
    const rules = getRules();
    const stem = rules.safeName(asset.name).replace(/__v[1-9][0-9]*$/u, '');
    const parts = stem.split('-'), patterned = parts.length >= 3;
    return rules.suggestName({ subject: patterned ? parts.slice(0, -2).join('-') : stem,
      purpose: patterned ? parts.at(-2) : asset.kind, variant: patterned ? parts.at(-1) : 'main', version: asset.version });
  }
  function settingsRows(settings) {
    const s = settings && typeof settings === 'object' ? settings : {}, rows = [];
    const preset = s.preset ?? s.Preset, size = s.size ?? s.Size, count = s.count ?? s.Options, dna = s.useBrandDna ?? s['Brand DNA'];
    if (typeof preset === 'string' && preset.length <= 60) rows.push(['Preset', preset]);
    if (typeof size === 'string' && /^\d{1,2}:\d{1,2}$/.test(size)) rows.push(['Size', size]);
    if ([1, 2, 4, '1', '2', '4'].includes(count)) rows.push(['Options', String(count)]);
    if ([true, false, 'On', 'Off'].includes(dna)) rows.push(['Brand DNA', dna === true || dna === 'On' ? 'On' : 'Off']);
    if (typeof s.model === 'string' && /^[A-Za-z][A-Za-z0-9._-]{0,59}$/.test(s.model)) rows.push(['Model', s.model]);
    return rows;
  }
  function createLibrary({ spaceId, service, selectedId = null, onChange = () => {}, onDirty = () => {} }) {
    const strip = getStrip();
    if (!strip?.createController || !getRules()?.suggestName) throw new Error('Asset helpers are still loading.');
    let filter = 'all', closed = false, core;
    function snapshot() {
      const state = core.snapshot(), assets = filter === 'kept' ? state.assets.filter(a => a.kept) : state.assets;
      return { ...state, filter, assets, selected: assets.find(a => a.id === selectedId) || null };
    }
    const report = () => { if (!closed) onChange(snapshot()); };
    core = strip.createController({ spaceId, service, onDirty, onChange: report });
    return {
      snapshot, load: () => core.load(), retry: () => core.retry(), discard: () => core.discard(),
      filter(query, mode) {
        if (closed || core.snapshot().dirty || !['all', 'kept', 'trash'].includes(mode)) return Promise.resolve(false);
        filter = mode; return core.filter(query, mode === 'trash');
      },
      select(id) {
        const state = snapshot();
        if (closed || state.dirty || state.busy || !state.assets.some(a => a.id === id)) return false;
        selectedId = id; report(); return true;
      },
      close() { if (closed || core.snapshot().dirty) return false; selectedId = null; report(); return true; },
      act(action) { return closed || !snapshot().selected ? Promise.resolve(false) : core.act(action, selectedId); },
      actionsFor: asset => strip.actionsFor(asset),
      dispose() { closed = true; core.dispose(); selectedId = null; },
    };
  }
  function mountCanvas(el, { spaceId, studio }) {
    const doc = el.ownerDocument;
    const node = (tag, text, cls = '') => { const n = doc.createElement(tag); n.className = cls; if (text !== undefined) n.textContent = text; return n; };
    const button = (text, action) => { const b = node('button', text); b.type = 'button'; b.addEventListener('click', action); return b; };
    const section = node('section', undefined, 'asset-library'); section.setAttribute('aria-label', 'Asset Library');
    const form = node('form', undefined, 'asset-library-controls'), searchLabel = node('label', 'Search assets'), query = node('input');
    query.type = 'search'; query.dataset.focus = 'search'; searchLabel.append(query);
    const filterLabel = node('label', 'Show assets'), filter = node('select'); filter.dataset.focus = 'filter';
    for (const [value, text] of [['all', 'All'], ['kept', 'Kept'], ['trash', 'Trash']]) { const option = node('option', text); option.value = value; filter.append(option); } filterLabel.append(filter);
    let controller = null, disposed = false, actionFocus = null, detailHeading = null;
    const search = button('Search', () => controller?.filter(query.value, filter.value));
    form.addEventListener('submit', event => { event.preventDefault(); controller?.filter(query.value, filter.value); });
    query.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); controller?.filter(query.value, filter.value); } });
    filter.addEventListener('change', () => controller?.filter(query.value, filter.value)); form.append(searchLabel, filterLabel, search);
    const status = node('p'); status.setAttribute('aria-live', 'polite');
    const retry = button('Try again', () => controller ? controller.retry() : boot());
    const discard = button('Discard unsaved change', () => controller?.discard());
    const retention = node('p', 'Trash empties after 30 days.');
    const layout = node('div', undefined, 'asset-library-layout'), grid = node('ul', undefined, 'asset-library-grid'); grid.setAttribute('aria-label', 'Space assets');
    const details = node('section', undefined, 'asset-library-details'); details.setAttribute('aria-label', 'Asset details');
    layout.append(grid, details); section.append(node('h2', 'Asset Library'), form, status, retry, discard, retention, layout); el.replaceChildren(section);
    const preview = (asset, target, className) => {
      if (asset.kind !== 'image' || typeof asset.url !== 'string' || !/^(https:\/\/|blob:|data:image\/(png|jpeg|webp|gif|svg\+xml)[;,])/i.test(asset.url)) return;
      const image = node('img', undefined, className); image.src = asset.url; image.alt = asset.name;
      const unavailable = node('span', 'Preview unavailable.'); unavailable.hidden = true;
      const again = button('Try preview again', () => controller.load()); again.hidden = true;
      image.addEventListener('error', () => { image.hidden = true; unavailable.hidden = again.hidden = false; }); target.append(image, unavailable, again);
    };
    function render(state) {
      if (disposed) return;
      if (section.contains(doc.activeElement) && doc.activeElement?.dataset.focus) actionFocus = doc.activeElement.dataset.focus;
      const loading = ['loading', 'saving'].includes(state.phase);
      section.classList.toggle('is-loading', loading); section.setAttribute('aria-busy', String(loading));
      query.disabled = search.disabled = filter.disabled = state.dirty; filter.value = state.filter;
      retry.hidden = state.phase !== 'failed'; discard.hidden = !state.dirty || state.busy; retention.hidden = state.filter !== 'trash';
      status.setAttribute('role', state.error ? 'alert' : 'status');
      status.textContent = state.error || (state.phase === 'loading' ? 'Loading assets…' : state.busy ? 'Saving…' : state.assets.length ? `${state.assets.length} assets` :
        state.query ? 'No assets match your search.' : state.filter === 'trash' ? 'Trash is empty.' : state.filter === 'kept' ? 'No kept assets yet.' : 'Nothing here yet. Things you make in this Space show up here.');
      grid.replaceChildren(); details.replaceChildren(); details.hidden = !state.selected;
      for (const asset of state.assets) {
        const row = node('li', undefined, 'asset-thumb'); row.classList.toggle('is-kept', Boolean(asset.kept)); row.classList.toggle('is-trashed', Boolean(asset.trashed));
        row.classList.toggle('is-selected', asset.id === state.selected?.id);
        const pick = button(asset.name, () => { if (controller.select(asset.id)) detailHeading?.focus(); }); pick.className = 'asset-library-select';
        pick.dataset.focus = `${asset.id}:select`; pick.setAttribute('aria-pressed', String(asset.id === state.selected?.id)); pick.disabled = state.dirty;
        preview(asset, row, 'asset-library-thumbnail'); row.append(pick);
        if (asset.kept) row.append(node('span', 'Kept', 'asset-kept-badge')); grid.append(row);
      }
      const asset = state.selected;
      if (asset) {
        detailHeading = node('h3', asset.name); detailHeading.tabIndex = -1; details.append(detailHeading);
        const close = button('Close details', () => {
          if (controller.close()) Array.from(section.querySelectorAll('[data-focus]')).find(n => n.dataset.focus === `${asset.id}:select`)?.focus();
        }); close.disabled = state.dirty; details.append(close); preview(asset, details, 'asset-library-preview');
        if (asset.kind !== 'image') details.append(node('p', 'Preview is unavailable for this file.'));
        const metadata = node('dl');
        for (const [key, value] of [['Version', asset.version], ['Parent', asset.parentId === null ? 'None (original)' : asset.parentId], ['Made by', asset.createdBy]]) {
          metadata.append(node('dt', key), node('dd', value === undefined ? 'Not provided' : String(value)));
        }
        details.append(metadata, node('h4', 'Suggested clean name'));
        try { details.append(node('p', suggestedName(asset), 'asset-library-suggested-name')); }
        catch { details.append(node('p', 'This name is too long or invalid. No shortened suggestion was made.')); }
        const settings = node('dl'); for (const [key, value] of settingsRows(asset.settingsUsed)) settings.append(node('dt', key), node('dd', value));
        details.append(node('h4', 'Settings used'), settings);
        if (!settings.children.length) details.append(node('p', 'No settings were supplied.'));
        if (asset.approved) details.append(node('p', 'Approved work can only be moved to trash by Jax.'));
        for (const action of controller.actionsFor(asset)) {
          const b = button({ keep: 'Keep', trash: 'Move to trash', restore: 'Restore' }[action], () => controller.act(action));
          b.dataset.focus = `${asset.id}:${action}`; b.disabled = state.dirty; details.append(b);
        }
        if (asset.kept) details.append(node('span', 'Kept', 'asset-kept-badge'));
      }
      if (actionFocus && !loading) {
        const controls = Array.from(section.querySelectorAll('[data-focus]')).filter(n => !n.disabled);
        (controls.find(n => n.dataset.focus === actionFocus) || controls.find(n => n.dataset.focus.startsWith(actionFocus.split(':')[0] + ':')) || (state.error ? retry : query)).focus(); actionFocus = null;
      }
    }
    function boot() {
      if (disposed) return;
      try {
        controller = createLibrary({ spaceId, service: studio.service, selectedId: studio.current?.()?.params?.assetId,
          onChange: render, onDirty: value => studio.setDirty(value) });
        controller.load();
      } catch {
        query.disabled = search.disabled = filter.disabled = true; discard.hidden = retention.hidden = details.hidden = true;
        status.textContent = 'Asset Library helpers are still loading. Try again.'; status.setAttribute('role', 'alert'); retry.hidden = false;
      }
    }
    boot();
    return () => { disposed = true; controller?.dispose(); el.replaceChildren(); };
  }
  return { suggestedName, settingsRows, createLibrary, mountCanvas };
});
