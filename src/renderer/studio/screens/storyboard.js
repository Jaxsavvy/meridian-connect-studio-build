'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianStudio.registerTool('storyboard', { mountCanvas: api.mountCanvas });
})(typeof window === 'undefined' ? null : window, function () {
  // Storyboard film strip (#233): one ChatGPT frame per chapter, kept in the cards' order, read start to finish.
  const safeUrl = url => typeof url === 'string' && /^(https:\/\/|blob:|data:image\/(png|jpeg|webp|gif|svg\+xml)[;,])/i.test(url);
  const keyOf = c => `${c.pageId}:${c.chapterId}`;

  function createFilmStrip({ service, spaceId, jobId, stageId, report }) {
    let disposed = false, revision = 0, board = null, images = {}, locked = false, busy = false, openKey = null;
    const show = (error = '') => report({ state: 'ready', board, images, locked, busy, openKey, error });
    const opened = () => board?.chapters.find(c => keyOf(c) === openKey) || null;
    async function load() {
      if (disposed) return;
      const request = ++revision; if (!board) report({ state: 'loading' });
      if (stageId !== 'storyboard') { report({ state: 'empty', message: 'The film strip opens at the Storyboard stage.' }); return; }
      try {
        const job = await service.getJob(spaceId, jobId);
        if (disposed || request !== revision) return;
        if (job?.id !== jobId || job.spaceId !== spaceId) throw Error('Unavailable');
        if (job.workflowId !== 'website') { report({ state: 'empty', message: 'Only Website Jobs have a storyboard.' }); return; }
        const [next, assets] = await Promise.all([service.getStoryboard(spaceId, jobId), service.listJobAssets(spaceId, jobId)]);
        if (disposed || request !== revision) return;
        locked = job.stageId === null || (job.stages || []).some(st => st.id === 'storyboard' && ['waiting-on-jax', 'done'].includes(st.status));
        const chapters = Array.isArray(next?.chapters) ? next.chapters : [];
        board = { chapters, kept: Number(next?.kept) || 0, total: Number(next?.total) || chapters.length };
        images = Object.fromEntries((Array.isArray(assets?.storyboard) ? assets.storyboard : []).filter(a => a?.id && safeUrl(a.url)).map(a => [a.id, a.url]));
        if (!opened()) openKey = null;
        show();
      } catch (error) {
        if (disposed || request !== revision) return;
        report(error?.code === 'OFFLINE' ? { state: 'offline', message: 'You are offline. Try again when connected.' }
          : { state: 'failed', message: 'Unable to open the storyboard. Check your connection and access, then try again.' });
      }
    }
    async function act(work) {
      const c = opened();
      if (disposed || busy || !c || locked) return false;
      busy = true; show();
      try { await work(c); busy = false; await load(); return !disposed; } catch (error) {
        if (!disposed) { busy = false; show(error?.message || 'Try again.'); }
        return false;
      }
    }
    return { load,
      open(key) { if (!disposed && board?.chapters.some(c => keyOf(c) === key)) { openKey = key; show(); } },
      make: () => act(c => service.makeStoryboardFrame(spaceId, jobId, { pageId: c.pageId, chapterId: c.chapterId })),
      keep: frameId => act(c => service.keepStoryboardFrame(spaceId, jobId, { pageId: c.pageId, chapterId: c.chapterId, frameId })),
      dispose() { disposed = true; revision++; },
    };
  }

  function mountCanvas(el, ctx) {
    const studio = ctx.studio || {}, doc = el.ownerDocument, win = doc.defaultView, root = doc.createElement('section');
    root.className = 'studio-storyboard'; root.setAttribute('aria-label', 'Storyboard film strip'); el.replaceChildren(root);
    const states = win?.MeridianStudioScreenStates || require('./home.js').screenStates;
    const clipboard = ctx.clipboard || win?.navigator?.clipboard;
    const focus = states.focus(root), marked = new Map();
    let listeners = [], disposed = false, active = 0;   // active: the strip's one tab stop
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
      if (opts.focus) mark(item, opts.focus);
      listen(item, 'click', action); return item;
    }
    const focusTo = id => marked.get(id)?.focus?.();
    function picture(url, name, className) {
      if (!url) return node('span', 'No frame yet', `${className} is-empty`);
      const img = node('img', '', className); img.setAttribute('src', url); img.setAttribute('alt', `Storyboard frame: ${name}`); return img;
    }
    function strip(view) {
      const list = node('ol', '', 'studio-storyboard-strip'); list.setAttribute('aria-label', 'Film strip');
      const chapters = view.board.chapters; active = Math.min(active, Math.max(chapters.length - 1, 0));
      chapters.forEach((c, i) => {
        const li = node('li', '', 'studio-storyboard-cell');
        if (i === 0 || chapters[i - 1].pageId !== c.pageId) li.appendChild(node('span', c.pageName || 'Untitled page', 'studio-storyboard-page'));
        const name = c.chapterName || `Chapter ${i + 1}`, kept = c.frames.find(f => f.id === c.keptId);
        const tile = mark(node('button', '', `studio-storyboard-tile${keyOf(c) === view.openKey ? ' is-open' : ''}`), `tile:${i}`);
        tile.type = 'button'; tile.tabIndex = i === active ? 0 : -1; tile.setAttribute('aria-pressed', String(keyOf(c) === view.openKey));
        tile.append(picture(kept && view.images[kept.assetId], name, 'studio-storyboard-still'), node('strong', name), node('span', c.job || '', 'studio-storyboard-job'));
        listen(tile, 'click', () => { active = i; model.open(keyOf(c)); focusTo(`tile:${i}`); });
        listen(tile, 'keydown', event => {
          const to = event.key === 'ArrowRight' ? i + 1 : event.key === 'ArrowLeft' ? i - 1 : null;
          if (to === null || to < 0 || to >= chapters.length) return;
          event.preventDefault?.();
          marked.get(`tile:${i}`).tabIndex = -1; active = to; const next = marked.get(`tile:${to}`); next.tabIndex = 0; next.focus?.();
        });
        li.appendChild(tile); list.appendChild(li);
      });
      return list;
    }
    function chapterPanel(view) {
      const c = view.board.chapters.find(x => keyOf(x) === view.openKey);
      if (!c) return node('p', 'Pick a tile to see and make its frames.', 'studio-storyboard-hint');
      const name = c.chapterName || 'this chapter', box = node('section', '', 'studio-card studio-storyboard-chapter');
      box.setAttribute('aria-label', `Frames for ${c.where}`);
      box.append(node('h3', c.where), node('p', c.job || ''));
      const tools = node('div', '', 'studio-storyboard-tools'), status = node('span', '', 'studio-storyboard-status'); status.setAttribute('role', 'status');
      if (!view.locked) tools.appendChild(button(view.busy ? 'Making…' : 'Make a frame', async () => { if (await model.make()) focusTo('make'); }, { primary: true, focus: 'make', disabled: view.busy }));
      tools.append(button('Copy prompt', async () => {
        try {
          if (typeof clipboard?.writeText !== 'function') throw Error('No clipboard');
          await clipboard.writeText(c.prompt || ''); if (!disposed) status.textContent = 'Copied';
        } catch (_) { if (!disposed) status.textContent = 'Couldn\'t copy. Try again.'; }
      }, { label: `Copy prompt: ${name}` }), status);
      box.appendChild(tools);
      if (!c.frames.length) { box.appendChild(node('p', 'No frames made yet.')); return box; }
      const list = node('ul', '', 'studio-storyboard-frames');
      c.frames.forEach((f, i) => {
        const li = mark(node('li', '', f.id === c.keptId ? 'is-kept' : ''), `frame:${f.id}`); li.tabIndex = -1;
        li.appendChild(picture(view.images[f.assetId], name, 'studio-storyboard-thumb'));
        if (f.id === c.keptId) li.appendChild(node('span', 'Kept', 'studio-chip studio-storyboard-kept'));
        else if (!view.locked) {
          li.appendChild(button('Keep this frame', async () => { if (await model.keep(f.id)) focusTo(`frame:${f.id}`); },
            { label: `Keep frame ${i + 1} of ${name}`, disabled: view.busy }));
        }
        list.appendChild(li);
      });
      box.appendChild(list); return box;
    }
    const model = createFilmStrip({ service: studio.service, spaceId: ctx.spaceId, jobId: ctx.jobId, stageId: ctx.stageId,
      report(view) {
        const want = doc.activeElement?.getAttribute?.('data-focus');
        unlisten(); marked.clear(); const restore = focus();
        root.setAttribute('aria-busy', String(view.state === 'loading' || !!view.busy));
        const title = node('h2', 'Storyboard');
        if (view.state !== 'ready') {
          root.replaceChildren(title, states.panel(doc, view.state === 'offline' ? 'failed' : view.state,
            view.state === 'loading' ? 'Loading the storyboard…' : view.message, () => void model.load()));
          restore(); return;
        }
        const parts = [title, node('p', `${view.board.kept} of ${view.board.total} chapters have a frame`, 'studio-storyboard-count')];
        if (view.locked) parts.push(node('p', 'With Jax: the storyboard is locked.', 'studio-storyboard-locked'));
        if (view.error) { const e = node('p', view.error); e.setAttribute('role', 'alert'); parts.push(e); }
        parts.push(view.board.chapters.length ? strip(view) : node('p', 'No chapters on the cards yet.'), chapterPanel(view));
        root.replaceChildren(...parts);
        const keep = want && marked.get(want);
        if (keep && !keep.disabled) keep.focus?.(); else restore();
      } });
    const off = studio.service.on((event, detail) => {
      if ((['storyboard-changed', 'story-changed'].includes(event) && detail?.jobId === ctx.jobId) || (event === 'assets-changed' && detail?.spaceId === ctx.spaceId)) void model.load();
    });
    void model.load();
    return () => { disposed = true; off(); model.dispose(); unlisten(); root.remove(); };
  }
  return { safeUrl, createFilmStrip, mountCanvas };
});
