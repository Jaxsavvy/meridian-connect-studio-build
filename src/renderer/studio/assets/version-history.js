'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.MeridianVersionHistory = api; root.MeridianStudio.registerPart('version-history', { mount: api.mount }); }
})(typeof window === 'undefined' ? null : window, function () {
  const safePreview = url => typeof url === 'string' && /^(https:\/\/|blob:|data:image\/(png|jpeg|webp|gif|svg\+xml)[;,])/i.test(url);
  function createHistory({ spaceId, assetId, service, onChange = () => {} }) {
    let closed = false, epoch = 0, saving = false;
    let state = { phase: 'loading', error: '', versions: [], a: null, b: null };
    const snapshot = () => structuredClone(state);
    const report = () => { if (!closed) onChange(snapshot()); };
    async function load() {
      if (closed || saving) return false;
      const turn = ++epoch; state.phase = 'loading'; state.error = ''; report();
      try {
        const rows = await service.listVersions(spaceId, assetId);
        if (closed || turn !== epoch) return false;
        const versions = rows.filter(a => a?.spaceId === spaceId).sort((a, b) => a.version - b.version);
        if (rows.length && !versions.some(a => a.id === assetId)) throw new Error('Asset not found in this Space.');
        state.versions = versions;
        if (!versions.some(v => v.id === state.a)) state.a = versions[0]?.id || null;
        if (!versions.some(v => v.id === state.b)) state.b = versions.at(-1)?.id || null;
        state.phase = 'ready'; report(); return true;
      } catch (error) {
        if (closed || turn !== epoch) return false;
        state = { ...state, phase: 'failed', error: error.message || 'Could not load version history.', versions: [], a: null, b: null };
        report(); return false;
      }
    }
    async function restore(id) {
      if (closed || saving || state.phase !== 'ready' || !state.versions.slice(0, -1).some(v => v.id === id)) return false;
      saving = true; ++epoch; state.phase = 'saving'; state.error = ''; report();
      try {
        const made = await service.saveVersion(spaceId, id);
        if (closed) return false;
        if (made?.spaceId !== spaceId) throw new Error('Could not restore in this Space.');
      } catch (error) {
        if (closed) return false;
        saving = false; state.phase = 'ready'; state.error = error.message || 'Could not restore this version.'; report(); return false;
      }
      saving = false; return load(); // A failed read retries only the read, never a successful restore.
    }
    const off = service.on((event, payload) => {
      if (event === 'assets-changed' && payload?.spaceId === spaceId && !saving) load();
    });
    return { snapshot, load, restore,
      pick(side, id) {
        if (closed || state.phase !== 'ready' || !['a', 'b'].includes(side) || !state.versions.some(v => v.id === id)) return false;
        state[side] = id; report(); return true;
      },
      dispose() { closed = true; ++epoch; off(); state.versions = []; },
    };
  }
  function mount(el, { spaceId, assetId, studio }) {
    el.disposeVersionHistory?.();
    const doc = el.ownerDocument;
    const node = (tag, text, cls = '') => { const n = doc.createElement(tag); n.className = cls; if (text !== undefined) n.textContent = text; return n; };
    const section = node('section', undefined, 'version-history studio-card'); section.setAttribute('aria-label', 'Version history');
    const heading = node('h3', 'Version history'); heading.tabIndex = -1;
    const status = node('p'); status.setAttribute('aria-live', 'polite');
    const button = (text, action) => { const b = node('button', text, 'studio-button'); b.type = 'button'; b.addEventListener('click', action); return b; };
    const retry = button('Try again', () => controller.load());
    const list = node('ol'), compare = node('div', undefined, 'version-history-compare');
    compare.setAttribute('aria-label', 'Compare A and B'); section.append(heading, status, retry, list, compare); el.replaceChildren(section);
    const preview = (v, target) => {
      if (v.kind !== 'image' || !safePreview(v.url)) { target.append(node('p', 'Preview unavailable.')); return; }
      const img = node('img'); img.src = v.url; img.alt = v.name;
      img.addEventListener('error', () => { img.hidden = true; target.append(node('p', 'Preview unavailable.')); }); target.append(img);
    };
    let disposed = false;
    function render(s) {
      if (disposed) return;
      const focus = section.contains(doc.activeElement) ? doc.activeElement?.dataset.focus : null;
      const busy = ['loading', 'saving'].includes(s.phase);
      section.setAttribute('aria-busy', String(busy)); status.setAttribute('role', s.error ? 'alert' : 'status');
      status.textContent = s.error || (s.phase === 'loading' ? 'Loading versions…' : s.phase === 'saving' ? 'Restoring…' : s.versions.length ? s.versions.length + ' versions' : 'No versions yet.');
      retry.hidden = s.phase !== 'failed'; list.replaceChildren(); compare.replaceChildren();
      for (const v of s.versions) {
        const row = node('li', undefined, 'studio-card'); row.append(node('h4', v.name + ' · v' + v.version));
        if (v.parentId === null) row.append(node('span', 'Original', 'studio-chip'));
        preview(v, row);
        for (const side of ['a', 'b']) {
          const b = button('Compare ' + side.toUpperCase(), () => controller.pick(side, v.id));
          b.setAttribute('aria-label', 'Compare ' + side.toUpperCase() + ': ' + v.name + ' v' + v.version);
          b.setAttribute('aria-pressed', String(s[side] === v.id)); b.dataset.focus = v.id + ':' + side; b.disabled = busy; row.append(b);
        }
        if (v.id !== s.versions.at(-1).id) {
          const b = button('Restore', () => controller.restore(v.id)); b.disabled = busy; b.dataset.focus = v.id + ':restore'; row.append(b);
        }
        list.append(row);
      }
      for (const side of ['a', 'b']) {
        const v = s.versions.find(item => item.id === s[side]); if (!v) continue;
        const card = node('article', undefined, 'studio-card'); card.append(node('h4', side.toUpperCase() + ': ' + v.name + ' · v' + v.version)); preview(v, card); compare.append(card);
      }
      if (focus && !busy) Array.from(section.querySelectorAll('[data-focus]')).find(n => n.dataset.focus === focus)?.focus();
    }
    const controller = createHistory({ spaceId, assetId, service: studio.service, onChange: render });
    // mountInto tracks screen cleanup; this hook also releases a closed Library detail immediately.
    const cleanup = () => { if (disposed) return; disposed = true; controller.dispose(); el.replaceChildren(); delete el.disposeVersionHistory; };
    el.disposeVersionHistory = cleanup; controller.load(); heading.focus();
    return cleanup;
  }
  return { safePreview, createHistory, mount };
});
