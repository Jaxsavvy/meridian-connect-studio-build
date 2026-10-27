'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianStudio.registerTool('look-frames', { mountCanvas: api.mountCanvas });
})(typeof window === 'undefined' ? null : window, function () {
  // Look frame picker (#211): Meridian designs full-page looks, a person picks one, and the shot list follows it.
  const safeUrl = url => typeof url === 'string' && /^(https:\/\/|blob:|data:image\/(png|jpeg|webp|gif|svg\+xml)[;,])/i.test(url);

  function createLookPicker({ service, spaceId, jobId, stageId, report }) {
    let disposed = false, revision = 0, look = null, images = {}, shots = null, locked = false, busy = false;
    const show = (error = '') => report({ state: 'ready', look, images, shots, locked, busy, error });
    async function load() {
      if (disposed) return;
      const request = ++revision; if (!look) report({ state: 'loading' });
      if (stageId !== 'look') { report({ state: 'empty', message: 'Look frames open at the Look and assets stage.' }); return; }
      try {
        const job = await service.getJob(spaceId, jobId);
        if (disposed || request !== revision) return;
        if (job?.id !== jobId || job.spaceId !== spaceId) throw Error('Unavailable');
        if (job.workflowId !== 'website') { report({ state: 'empty', message: 'Only Website Jobs have a look to pick.' }); return; }
        const [next, assets] = await Promise.all([service.getLook(spaceId, jobId), service.listJobAssets(spaceId, jobId)]);
        const frames = Array.isArray(next?.frames) ? next.frames : [];
        let list = null;
        if (frames.some(f => f.id === next.chosenId)) list = await service.getShotPrompts(spaceId, jobId);
        if (disposed || request !== revision) return;
        locked = job.stageId === null || (job.stages || []).some(st => st.id === 'look' && st.status === 'done');
        look = { frames, chosenId: next?.chosenId || null };
        images = Object.fromEntries((Array.isArray(assets?.look) ? assets.look : []).filter(a => a?.id && safeUrl(a.url)).map(a => [a.id, a.url]));
        shots = Array.isArray(list) ? list : null;
        show();
      } catch (error) {
        if (disposed || request !== revision) return;
        report(error?.code === 'OFFLINE' ? { state: 'offline', message: 'You are offline. Try again when connected.' }
          : { state: 'failed', message: 'Unable to open the look frames. Check your connection and access, then try again.' });
      }
    }
    async function act(work) {
      if (disposed || busy || !look || locked) return false;
      busy = true; show();
      try { await work(); busy = false; await load(); return !disposed; } catch (error) {
        if (!disposed) { busy = false; show(error?.message || 'Try again.'); }
        return false;
      }
    }
    return { load,
      make(directions) {
        if (!directions.length) { if (!disposed && look) show('Tick at least one direction.'); return Promise.resolve(false); }
        return act(() => service.makeLookFrames(spaceId, jobId, { directions }));
      },
      choose: frameId => act(() => service.chooseLookFrame(spaceId, jobId, frameId)),
      dispose() { disposed = true; revision++; },
    };
  }

  function mountCanvas(el, ctx) {
    const studio = ctx.studio || {}, doc = el.ownerDocument, win = doc.defaultView, root = doc.createElement('section');
    root.className = 'studio-look-frames'; root.setAttribute('aria-label', 'Look frames'); el.replaceChildren(root);
    const states = win?.MeridianStudioScreenStates || require('./home.js').screenStates;
    const DIRECTIONS = (win?.MeridianLookFrames || require('../website/look-frames.js')).DIRECTIONS;
    const clipboard = ctx.clipboard || win?.navigator?.clipboard;
    const focus = states.focus(root), marked = new Map(), ticked = new Set(DIRECTIONS.map(d => d.id));
    let listeners = [], disposed = false;
    const listen = (item, type, fn) => { item.addEventListener(type, fn); listeners.push([item, type, fn]); };
    const unlisten = () => { for (const [item, type, fn] of listeners) item.removeEventListener?.(type, fn); listeners = []; };
    function node(tag, text, className) {
      const item = doc.createElement(tag); if (text) item.textContent = text;
      if (className) item.className = className; return item;
    }
    const mark = (item, id) => { item.setAttribute('data-focus', id); marked.set(id, item); return item; };
    function button(text, action, opts = {}) {
      const item = node('button', text, `studio-button ${opts.primary ? 'is-primary' : 'is-secondary'}`); item.type = 'button';
      item.disabled = !!opts.disabled; if (opts.label) item.setAttribute('aria-label', opts.label);
      if (opts.pressed !== undefined) item.setAttribute('aria-pressed', String(opts.pressed));
      if (opts.focus) mark(item, opts.focus);
      listen(item, 'click', action); return item;
    }
    const nameOf = id => DIRECTIONS.find(d => d.id === id)?.name || id;
    async function copy(shot, status) {
      try {
        if (typeof clipboard?.writeText !== 'function') throw Error('No clipboard');
        await clipboard.writeText(shot.prompt);
        if (!disposed) status.textContent = 'Copied';
      } catch (_) { if (!disposed) status.textContent = 'Couldn\'t copy. Select the prompt and copy it.'; }
    }
    function designer(view) {
      const box = node('div', '', 'studio-card studio-look-frames-make'), set = node('fieldset');
      set.appendChild(node('legend', 'Design directions'));
      for (const d of DIRECTIONS) {
        const label = node('label'), input = node('input'); input.type = 'checkbox'; input.checked = ticked.has(d.id); input.disabled = view.busy;
        listen(input, 'change', () => { if (input.checked) ticked.add(d.id); else ticked.delete(d.id); });
        label.append(input, node('span', d.name)); set.appendChild(label);
      }
      box.append(set, button(view.busy ? 'Designing…' : 'Design the look with Meridian', async () => {
        if (await model.make(DIRECTIONS.map(d => d.id).filter(id => ticked.has(id)))) marked.get('make')?.focus?.();
      }, { primary: true, focus: 'make', disabled: view.busy }));
      return box;
    }
    function frameCard(f, view) {
      const chosen = f.id === view.look.chosenId, name = nameOf(f.direction);
      const card = node('li', '', `studio-card studio-look-frames-card${chosen ? ' is-chosen' : ''}`), figure = node('figure');
      if (view.images[f.assetId]) {
        const img = node('img'); img.setAttribute('src', view.images[f.assetId]); img.setAttribute('alt', `Look frame: ${name}`); figure.appendChild(img);
      } else figure.appendChild(node('p', 'Image not available.', 'studio-look-frames-missing'));
      figure.appendChild(node('figcaption', name)); card.appendChild(figure);
      if (chosen) card.appendChild(node('span', 'Chosen', 'studio-chip studio-look-frames-chosen'));
      if (!view.locked) {
        card.appendChild(button(chosen ? 'Picked' : 'Pick this look', async () => {
          if (chosen) return;
          if (await model.choose(f.id)) marked.get(`pick:${f.id}`)?.focus?.();   // focus stays on the frame you picked
        }, { focus: `pick:${f.id}`, label: `Pick this look: ${name}`, pressed: chosen, disabled: view.busy }));
      }
      return card;
    }
    function shotList(view) {
      const box = node('section', '', 'studio-card studio-look-frames-shots'), list = node('ul');
      box.setAttribute('aria-label', 'Shot list');
      for (const s of view.shots) {
        const li = node('li'), status = node('span', '', 'studio-look-frames-status'); status.setAttribute('role', 'status');
        const label = node('label'), prompt = node('textarea'); prompt.readOnly = true; prompt.value = s.prompt || ''; prompt.rows = 4;
        label.append(node('span', `Prompt for ${s.what || 'this shot'}`), prompt);
        li.append(node('strong', s.what || 'Shot'), node('span', s.made ? 'Made' : 'Still to make', `studio-chip ${s.made ? 'is-made' : 'is-todo'}`), label,
          button('Copy prompt', () => void copy(s, status), { label: `Copy prompt: ${s.what || 'shot'}` }), status);
        list.appendChild(li);
      }
      box.append(node('h3', 'Shot list'), node('p', 'Each photo is made to match the chosen look.'),
        view.shots.length ? list : node('p', 'No shots on the cards.'));
      return box;
    }
    const model = createLookPicker({ service: studio.service, spaceId: ctx.spaceId, jobId: ctx.jobId, stageId: ctx.stageId,
      report(view) {
        const want = doc.activeElement?.getAttribute?.('data-focus');
        unlisten(); marked.clear(); const restore = focus();
        root.setAttribute('aria-busy', String(view.state === 'loading' || !!view.busy));
        const title = node('h2', 'Look frames');
        if (view.state !== 'ready') {
          root.replaceChildren(title, states.panel(doc, view.state === 'offline' ? 'failed' : view.state,
            view.state === 'loading' ? 'Loading the look…' : view.message, () => void model.load()));
          restore(); return;
        }
        const parts = [title, node('p', 'Meridian designs the whole home page in a few directions. Pick one, and every photo is made to match it.')];
        if (view.locked) parts.push(node('p', 'The look is locked: Look and assets is done.', 'studio-look-frames-locked'));
        else parts.push(designer(view));
        if (view.error) { const e = node('p', view.error); e.setAttribute('role', 'alert'); parts.push(e); }
        if (view.look.frames.length) {
          const list = node('ul', '', 'studio-look-frames-list'); list.setAttribute('aria-label', 'Look frames');
          for (const f of view.look.frames) list.appendChild(frameCard(f, view));
          parts.push(list);
        } else parts.push(node('p', 'No look frames yet.'));
        if (view.shots) parts.push(shotList(view));
        root.replaceChildren(...parts);
        const keep = want && marked.get(want);
        if (keep && !keep.disabled) keep.focus?.(); else restore();
      } });
    const off = studio.service.on((event, detail) => {
      if ((event === 'look-changed' && detail?.jobId === ctx.jobId) || (event === 'assets-changed' && detail?.spaceId === ctx.spaceId)) void model.load();
    });
    void model.load();
    return () => { disposed = true; off(); model.dispose(); unlisten(); root.remove(); };
  }
  return { safeUrl, createLookPicker, mountCanvas };
});
