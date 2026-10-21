'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.MeridianImageGen = api; root.MeridianStudio.registerTool('image-gen', { mountCanvas: api.mountCanvas }); }
})(typeof window === 'undefined' ? null : window, function () {
  let counter = 0;
  const matchesResults = (p, spaceId) => Boolean(p && p.spaceId === spaceId && p.toolId === 'image-gen' && typeof p.requestId === 'string' && p.requestId && Array.isArray(p.results));
  function settingsRows(settings = {}) {
    settings = settings && typeof settings === 'object' ? settings : {};
    const rows = [], preset = settings.preset ?? settings.Preset, size = settings.size ?? settings.Size;
    const count = settings.count ?? settings.Options, dna = settings.useBrandDna ?? settings['Brand DNA'];
    if (typeof preset === 'string' && preset.length <= 60) rows.push(['Preset', preset]);
    if (typeof size === 'string' && /^\d{1,2}:\d{1,2}$/.test(size)) rows.push(['Size', size]);
    if ([1, 2, 4, '1', '2', '4'].includes(count)) rows.push(['Options', String(count)]);
    if ([true, false, 'On', 'Off'].includes(dna)) rows.push(['Brand DNA', dna === true || dna === 'On' ? 'On' : 'Off']);
    if (typeof settings.model === 'string' && /^[A-Za-z][A-Za-z0-9._-]{0,59}$/.test(settings.model)) rows.push(['Model', settings.model]);
    return rows;
  }
  const scoped = (assets, spaceId) => {
    if (!Array.isArray(assets)) throw new Error('Invalid asset list.');
    return assets.filter(a => a && a.spaceId === spaceId && !a.trashed && typeof a.id === 'string');
  };
  const failureText = error => error?.code === 'OFFLINE' ? 'You are offline. Try again when connected.' :
    [401, 403, 404].includes(error?.status) ? 'This Space is unavailable or access has changed. Try again or choose another Space.' : 'Image gen could not finish this action. Try again.';
  function createCanvas({ spaceId, service, onChange = () => {}, onDirty = () => {}, onSend = () => {} }) {
    const state = { phase: 'loading', ready: false, presets: [], assets: [], presetId: '', description: '', count: 4,
      references: [], proposal: '', confirmed: false, results: [], settings: [], refinedDescription: '', dirty: false, error: '' };
    let closed = false, epoch = 0, assetRead = 0, assetsPending = false, request = null, retry = () => start(), space = null, queued = null;
    const snapshot = () => ({ ...state, results: [...state.results], assets: [...state.assets], references: [...state.references] });
    const notify = () => { if (!closed) onChange(snapshot()); };
    const busy = () => ['loading', 'generating', 'saving'].includes(state.phase);
    const dirty = value => { if (value !== state.dirty) { state.dirty = value; onDirty(value); } };
    function failed(error, again) { state.phase = 'failed'; state.error = failureText(error); retry = again; notify(); return false; }
    function present(payload) {
      if (closed || !matchesResults(payload, spaceId)) return false;
      state.results = payload.results.filter(r => r && typeof r.assetId === 'string' && typeof r.url === 'string')
        .map(r => ({ assetId: r.assetId, url: r.url, note: typeof r.note === 'string' ? r.note : '' }));
      state.settings = settingsRows(payload.settingsUsed || {});
      state.refinedDescription = typeof payload.refinedDescription === 'string' ? payload.refinedDescription : '';
      state.phase = 'ready'; state.error = ''; notify(); return true;
    }
    function setAssets(assets) {
      state.assets = assets;
      const references = state.references.filter(id => assets.some(a => a.id === id && a.kind === 'image'));
      if (references.length === state.references.length) return false;
      state.references = references; request = null; state.proposal = ''; state.confirmed = false;
      state.error = 'A reference is no longer available. Choose an active image and confirm again.';
      return true;
    }
    async function refreshAssets() {
      const turn = epoch, read = ++assetRead; assetsPending = false;
      try {
        const assets = scoped(await service.listAssets(spaceId), spaceId);
        if (closed || turn !== epoch || read !== assetRead) return false;
        const removed = setAssets(assets); state.phase = 'ready'; if (!removed) state.error = ''; notify(); return true;
      } catch (error) {
        if (closed || turn !== epoch || read !== assetRead) return false;
        if ([401, 403, 404].includes(error?.status)) {
          state.ready = false; state.assets = []; state.references = []; state.results = []; state.settings = [];
          state.refinedDescription = ''; state.proposal = ''; state.confirmed = false; request = null;
          return failed(error, start);
        }
        return failed(error, refreshAssets);
      }
    }
    function assetsChanged() {
      if (closed) return Promise.resolve(false);
      if (busy() || state.phase === 'failed') { assetsPending = true; return Promise.resolve(false); }
      return refreshAssets();
    }
    async function start() {
      if (closed) return false;
      const turn = ++epoch; state.phase = 'loading'; state.ready = false; state.error = ''; state.assets = []; state.results = []; state.settings = []; state.refinedDescription = ''; state.proposal = ''; space = null; request = null; state.confirmed = false; notify();
      try {
        const [info, presets, assets] = await Promise.all([service.getSpace(spaceId), service.listPresets('image-gen'), service.listAssets(spaceId)]);
        if (closed || turn !== epoch) return false;
        if (info?.id !== spaceId || !Array.isArray(presets)) throw new Error('Invalid Space.');
        space = info; state.presets = presets.filter(p => p?.toolId === 'image-gen'); state.assets = scoped(assets, spaceId);
        state.presetId = state.presets[0]?.id || ''; state.ready = true; state.phase = 'ready'; notify();
        if (queued) { const payload = queued; queued = null; receive(payload); }
        if (assetsPending) await refreshAssets(); return true;
      } catch (error) { return !closed && turn === epoch ? failed(error, start) : false; }
    }
    function update(changes) {
      if (closed || !state.ready || busy()) return false;
      if (changes.description !== undefined && typeof changes.description !== 'string') return false;
      if (changes.references !== undefined && !Array.isArray(changes.references)) return false;
      if (changes.presetId !== undefined && !state.presets.some(p => p.id === changes.presetId)) return false;
      if (changes.count !== undefined && ![1, 2, 4].includes(changes.count)) return false;
      epoch += 1;
      for (const key of ['description', 'presetId', 'count']) if (changes[key] !== undefined) state[key] = changes[key];
      if (changes.references) state.references = changes.references.filter(id => state.assets.some(a => a.id === id && a.kind === 'image'));
      request = null; state.proposal = ''; state.confirmed = false; state.error = ''; state.phase = 'ready'; dirty(Boolean(state.description.trim())); notify(); return true;
    }
    function sharpen() {
      if (closed || busy() || !state.description.trim()) return false;
      const preset = state.presets.find(p => p.id === state.presetId); if (!preset) return false;
      state.proposal = [state.description.trim(), `${preset.name} composition, ${preset.size} frame`,
        ...(space?.dna?.voice ? [`mood: ${space.dna.voice}`] : []), ...(space?.dna?.colors?.length ? [`brand colors ${space.dna.colors.join(' and ')}`] : [])].join('; ');
      request = { spaceId, requestId: `${spaceId}:${Date.now().toString(36)}:${++counter}`, presetId: state.presetId, description: state.proposal, count: state.count, references: [...state.references] };
      state.confirmed = false; dirty(true); notify(); return true;
    }
    function finish(payload) { if (!matchesResults(payload, spaceId)) return false; state.confirmed = false; request = null; dirty(false); return present(payload); }
    async function recover(before, original, turn) {
      try {
        const assets = scoped(await service.listAssets(spaceId), spaceId); if (closed || turn !== epoch) return null;
        const made = assets.filter(a => a.requestId === original.requestId || a.generationRequestId === original.requestId ||
          (service.mode === 'sample' && before && !before.has(a.id) && a.createdBy === 'image-gen'));
        state.assets = assets;
        if (!made.length) return false;
        return finish({ spaceId, toolId: 'image-gen', requestId: original.requestId, refinedDescription: original.description,
          settingsUsed: made[0].settingsUsed, results: made.map(a => ({ assetId: a.id, url: a.url, note: '' })) });
      } catch { return null; }
    }
    async function generate() {
      if (closed || busy() || !state.ready || !state.confirmed || !request) return false;
      const original = request, turn = ++epoch; let before = null, out;
      state.phase = 'generating'; state.error = ''; notify();
      try {
        const assets = scoped(await service.listAssets(spaceId), spaceId);
        if (closed || turn !== epoch) return false;
        if (setAssets(assets)) { state.phase = 'ready'; notify(); return false; }
        before = new Set(assets.map(a => a.id));
        out = await service.generateImage(original);
      } catch (error) {
        if (closed || turn !== epoch) return false;
        const again = async () => {
          if (closed || turn !== epoch) return false;
          const found = before ? await recover(before, original, turn) : false;
          if (found === null) return failed(error, again);
          return found || generate();
        };
        if (before && await recover(before, original, turn)) return true;
        if (closed || turn !== epoch) return false;
        return failed(error, again); // Reconcile first, then reuse the confirmed request ID.
      }
      if (closed || turn !== epoch) return false;
      if (!out || !finish({ ...out, spaceId: out.spaceId ?? spaceId, toolId: out.toolId ?? 'image-gen' })) {
        request = null; state.confirmed = false; return failed(new Error(), refreshAssets);
      }
      await refreshAssets(); return true; // Display/read failures never repeat a successful generation.
    }
    function receive(payload) {
      if (closed || !matchesResults(payload, spaceId)) return false;
      if (!state.ready || state.phase === 'saving') { queued = payload; return true; }
      if (state.phase === 'generating') { state.confirmed = false; request = null; }
      epoch += 1; present(payload); return true; // A chat result never clears the person's draft.
    }
    async function keep(id, restoreDirty = state.dirty) {
      if (closed || busy() || !state.results.some(r => r.assetId === id)) return false;
      const turn = ++epoch; state.phase = 'saving'; dirty(true); notify();
      try {
        const asset = await service.keepAsset(spaceId, id); if (closed || turn !== epoch) return false;
        if (asset?.spaceId !== spaceId || asset.id !== id) throw new Error('Invalid asset.');
        state.assets = [...state.assets.filter(a => a.id !== id), asset]; state.phase = 'ready'; state.error = ''; dirty(restoreDirty); notify();
        if (queued) { const payload = queued; queued = null; receive(payload); }
        if (assetsPending) await refreshAssets(); return true;
      } catch (error) { return !closed && turn === epoch ? failed(error, () => keep(id, restoreDirty)) : false; }
    }
    function variations(id) {
      if (closed || busy() || state.dirty || !state.results.some(r => r.assetId === id) || !state.assets.some(a => a.id === id && a.kind === 'image')) return false;
      const used = state.settings.find(([key]) => key === 'Preset')?.[1];
      const description = state.refinedDescription || state.description; if (!description.trim()) return false;
      update({ description, presetId: state.presets.find(p => p.name === used)?.id || state.presetId });
      state.references = [id]; sharpen(); state.proposal = request.description = description; notify(); return true;
    }
    return { snapshot, start, update, sharpen, generate, receive, keep, variations, assetsChanged, retry: () => retry(),
      confirm(value) { if (!busy() && request) { state.confirmed = Boolean(value); notify(); } },
      async addReference(id) { if (busy()) return false; if (!await refreshAssets()) return false; if (!state.assets.some(a => a.id === id && a.kind === 'image')) return failed(new Error(), () => refreshAssets()); return update({ references: [id] }); },
      send(id) { if (!closed && state.results.some(r => r.assetId === id)) onSend({ spaceId, toolId: 'asset-library', assetId: id }); },
      discard() { if (!busy()) { update({ description: '', references: [] }); dirty(false); } },
      dispose() { closed = true; epoch += 1; queued = null; dirty(false); },
    };
  }
  function mountCanvas(el, { spaceId, studio }) {
    const doc = el.ownerDocument;
    const node = (tag, text, cls = '') => { const n = doc.createElement(tag); n.className = cls; if (text !== undefined) n.textContent = text; return n; };
    const button = (label, action) => { const b = node('button', label); b.type = 'button'; b.addEventListener('click', action); return b; };
    const section = node('section', undefined, 'image-gen'); section.setAttribute('aria-label', 'Image gen');
    const chips = node('div', undefined, 'image-gen-presets'); chips.setAttribute('role', 'group'); chips.setAttribute('aria-label', 'Presets');
    const hints = node('p'), label = node('label', 'Describe the image'), description = node('textarea'); description.rows = 4; label.append(description);
    const countLabel = node('label', 'Number of images'), count = node('select');
    for (const n of [1, 2, 4]) { const option = node('option', String(n)); option.value = String(n); count.append(option); } countLabel.append(count);
    const referenceLabel = node('label', 'Reference image (or drag an asset here)'), reference = node('select'); referenceLabel.append(reference);
    const sharpen = button('Sharpen my description', () => { controller.sharpen(); confirm.focus(); });
    const proposal = node('blockquote', undefined, 'image-gen-proposal'), approve = node('label', 'I approve this description'), confirm = node('input'); confirm.type = 'checkbox'; approve.append(confirm);
    const generate = button('Generate', () => controller.generate()), discard = button('Discard description', () => controller.discard());
    const status = node('p'); status.setAttribute('aria-live', 'polite'); const retry = button('Try again', () => controller.retry());
    const refined = node('p'), drawer = node('details', undefined, 'image-gen-settings'), settings = node('dl'); drawer.append(node('summary', 'Settings used'), settings);
    const results = node('div', undefined, 'image-gen-results'); results.setAttribute('aria-label', 'Generated images');
    section.append(node('h2', 'Image gen'), chips, hints, label, countLabel, referenceLabel, sharpen, proposal, approve, generate, discard, status, retry, refined, drawer, results); el.replaceChildren(section);
    description.addEventListener('input', () => controller.update({ description: description.value }));
    count.addEventListener('change', () => controller.update({ count: Number(count.value) }));
    confirm.addEventListener('change', () => controller.confirm(confirm.checked));
    reference.addEventListener('change', () => controller.update({ references: reference.value ? [reference.value] : [] }));
    section.addEventListener('dragover', event => { if (Array.from(event.dataTransfer?.types || []).includes('application/x-meridian-asset')) event.preventDefault(); });
    section.addEventListener('drop', event => { event.preventDefault(); const id = event.dataTransfer?.getData('application/x-meridian-asset'); if (id) controller.addReference(id); });
    let actionFocus = null;
    function render(s) {
      if (section.contains(doc.activeElement) && doc.activeElement?.dataset.focus) actionFocus = doc.activeElement.dataset.focus;
      const loading = ['loading', 'generating', 'saving'].includes(s.phase), locked = !s.ready || loading;
      section.classList.toggle('is-loading', loading); section.setAttribute('aria-busy', String(loading)); chips.replaceChildren();
      for (const p of s.presets) { const b = button(p.name, () => controller.update({ presetId: p.id })); b.setAttribute('aria-pressed', String(p.id === s.presetId)); b.dataset.focus = p.id; b.disabled = locked; chips.append(b); }
      hints.textContent = s.presets.find(p => p.id === s.presetId)?.questions?.join(' ') || 'No Image gen presets are available.';
      if (description.value !== s.description) description.value = s.description;
      description.disabled = count.disabled = reference.disabled = locked; count.value = String(s.count);
      reference.replaceChildren(node('option', 'No reference')); reference.children[0].value = '';
      for (const a of s.assets.filter(a => a.kind === 'image')) { const option = node('option', a.name); option.value = a.id; reference.append(option); } reference.value = s.references[0] || '';
      sharpen.disabled = locked || !s.description.trim() || !s.presetId; generate.disabled = locked || !s.confirmed; discard.disabled = locked || !s.dirty;
      proposal.hidden = approve.hidden = !s.proposal; proposal.textContent = s.proposal; confirm.checked = s.confirmed; confirm.disabled = locked;
      status.setAttribute('role', s.error ? 'alert' : 'status'); retry.hidden = s.phase !== 'failed';
      status.textContent = s.error || (s.phase === 'generating' ? 'Generating images…' : s.phase === 'loading' ? 'Loading Image gen…' : s.phase === 'saving' ? 'Saving…' : s.results.length ? `${s.results.length} images` : 'No images yet. Describe an image, review the sharper description, then confirm.');
      refined.textContent = s.refinedDescription; settings.replaceChildren(); for (const [key, value] of s.settings) settings.append(node('dt', key), node('dd', value)); drawer.hidden = !s.settings.length;
      results.replaceChildren();
      for (const r of s.results) {
        const a = s.assets.find(item => item.id === r.assetId), card = node('article', undefined, 'image-gen-result'); card.classList.toggle('is-kept', Boolean(a?.kept));
        card.append(node('h3', a?.name || r.assetId));
        if (/^(https:\/\/|blob:|data:image\/(png|jpeg|webp|gif|svg\+xml)[;,])/i.test(r.url)) { const image = node('img'); image.src = r.url; image.alt = a?.name || r.assetId; card.append(image); }
        if (r.note) card.append(node('p', r.note));
        if (a?.kept) card.append(node('span', 'Kept', 'asset-kept-badge'));
        else { const keep = button('Keep', () => controller.keep(r.assetId)); keep.dataset.focus = `${r.assetId}:keep`; keep.disabled = locked; card.append(keep); }
        const vary = button('Variations', () => { controller.variations(r.assetId); confirm.focus(); }); vary.dataset.focus = `${r.assetId}:vary`; vary.disabled = locked || s.dirty || !a || a.kind !== 'image' || !(s.refinedDescription || s.description).trim();
        const send = node('details'); send.append(node('summary', 'Send to'), button('Asset Library', () => controller.send(r.assetId)), node('p', 'Review — Coming soon'));
        card.append(vary, node('span', 'Edit part — Coming soon', 'image-gen-coming-soon'), send); results.append(card);
      }
      if (actionFocus && !locked) { const available = Array.from(section.querySelectorAll('[data-focus]')).filter(n => !n.disabled); (available.find(n => n.dataset.focus === actionFocus) || available.find(n => n.dataset.focus.startsWith(actionFocus.split(':')[0] + ':')) || description).focus(); actionFocus = null; }
    }
    const controller = createCanvas({ spaceId, service: studio.service, onChange: render, onDirty: value => studio.setDirty(value), onSend: params => studio.navigate('work', params) });
    const off = studio.on((event, payload) => { if (event === 'image-results') controller.receive(payload); });
    const offService = studio.service.on((event, payload) => {
      if (event === 'spaces-changed') controller.start();
      else if (event === 'assets-changed' && payload?.spaceId === spaceId) controller.assetsChanged();
    }); controller.start();
    return () => { off(); offService(); controller.dispose(); el.replaceChildren(); };
  }
  return { matchesResults, settingsRows, createCanvas, mountCanvas };
});
