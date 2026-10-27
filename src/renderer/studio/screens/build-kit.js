'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianStudio.registerTool('build-kit', { mountCanvas: api.mountCanvas });
})(typeof window === 'undefined' ? null : window, function () {
  // Build kit screen (#248): what Claude Code needs to build the client's site from the approved design. Never publishes.
  const NOT_YET = 'The build kit is ready once the client approves the design at Design lock.';
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  function createBuildKit({ service, spaceId, jobId, stageId, report }) {
    let disposed = false, revision = 0, kit = null, busy = false, result = null;
    const show = (error = '') => report({ state: 'ready', kit, busy, result, error });
    async function load() {
      if (disposed) return;
      const request = ++revision; if (!kit) report({ state: 'loading' });
      if (stageId !== 'build') { report({ state: 'empty', message: 'The build kit opens at the Build stage.' }); return; }
      try {
        const job = await service.getJob(spaceId, jobId);
        if (disposed || request !== revision) return;
        if (job?.id !== jobId || job.spaceId !== spaceId) throw Error('Unavailable');
        if (job.workflowId !== 'website') { report({ state: 'empty', message: 'Only Website Jobs have a build kit.' }); return; }
        if (!(job.stages || []).some(st => st.id === 'lock' && st.status === 'done')) { report({ state: 'empty', message: NOT_YET }); return; }
        const next = await service.getBuildKit(spaceId, jobId);
        if (disposed || request !== revision) return;
        kit = next; show();
      } catch (error) {
        if (disposed || request !== revision) return;
        // The service's "not yet" is a plain state, not an error.
        if (error?.message === NOT_YET) { report({ state: 'empty', message: NOT_YET }); return; }
        report(error?.code === 'OFFLINE' ? { state: 'offline', message: 'You are offline. Try again when connected.' }
          : { state: 'failed', message: 'Unable to open the build kit. Check your connection and access, then try again.' });
      }
    }
    return { load,
      async save() {
        if (disposed || busy || !kit) return false;
        busy = true; result = null; show();
        try {
          const out = await service.saveBuildKit(spaceId, jobId);
          if (disposed) return false;
          busy = false;
          result = { saved: Array.isArray(out?.saved) ? out.saved : [], failed: Array.isArray(out?.failed) ? out.failed : [] };
          await load(); return !result.failed.length;
        } catch (error) { if (!disposed) { busy = false; show(error?.message || 'The build kit could not be saved. Try again.'); } return false; }
      },
      dispose() { disposed = true; revision++; },
    };
  }

  function mountCanvas(el, ctx) {
    const studio = ctx.studio || {}, doc = el.ownerDocument, win = doc.defaultView, root = doc.createElement('section');
    root.className = 'studio-build-kit'; root.setAttribute('aria-label', 'Build kit'); el.replaceChildren(root);
    const states = win?.MeridianStudioScreenStates || require('./home.js').screenStates;
    const clipboard = ctx.clipboard || win?.navigator?.clipboard;
    const focus = states.focus(root), marked = new Map();
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
      item.disabled = !!opts.disabled; if (opts.focus) mark(item, opts.focus);
      listen(item, 'click', action); return item;
    }
    const part = (label, ...kids) => { const s = node('section', '', 'studio-card studio-build-kit-part'); s.setAttribute('aria-label', label); s.append(node('h3', label), ...kids); return s; };
    const list = items => { const ul = node('ul'); for (const t of items) ul.appendChild(node('li', t)); return ul; };
    function summary(kit) {
      const repo = node('p'); repo.append(node('span', 'Repo it will make: '), node('span', kit.repo || '–', 'studio-build-kit-code'));   // plain text, never a link
      const pages = list((kit.bundle?.pages || []).map(p => `${p.name || 'Untitled page'}: ${plural((p.chapters || []).length, 'chapter', 'chapters')}`));
      const images = list((kit.images || []).map(i => i.use || i.name || 'image'));
      return part('Summary', repo, node('h4', 'Pages'), pages, node('h4', `Images (${(kit.images || []).length})`), images);
    }
    function prompt(kit) {
      const box = mark(node('pre', kit.prompt || '', 'studio-build-kit-prompt'), 'prompt'); box.tabIndex = 0;   // focusable so the keyboard can scroll it
      box.setAttribute('aria-label', 'Build prompt');
      const status = node('span', '', 'studio-build-kit-status'); status.setAttribute('role', 'status');
      const tools = node('div', '', 'studio-build-kit-tools');
      tools.append(button('Copy prompt', async () => {
        try {
          if (typeof clipboard?.writeText !== 'function') throw Error('No clipboard');
          await clipboard.writeText(kit.prompt || ''); if (!disposed) status.textContent = 'Copied';
        } catch (_) { if (!disposed) status.textContent = 'Couldn\'t copy. Select the prompt and copy it.'; }
      }, { focus: 'copy' }), status);
      return part('The prompt', box, tools, node('p', 'Paste this into Claude Code to build the site. It never publishes; Jax decides when a site goes live.', 'studio-build-kit-help'));
    }
    function saving(view) {
      const kids = [node('p', `Saves ${plural((view.kit.files || []).length, 'file', 'files')} (the site bundle and the build prompt). Saving again replaces them.`),
        button(view.busy ? 'Saving…' : 'Save to the project folder', async () => { await model.save(); marked.get('save')?.focus?.(); }, { primary: true, focus: 'save', disabled: view.busy })];
      if (view.result?.saved.length) kids.push(node('h4', 'Saved to the project folder'), list(view.result.saved));
      for (const f of view.result?.failed || []) {
        const p = node('p', `${typeof f === 'string' ? f : f?.name || 'file'}: ${f?.error || 'Could not save.'}`); p.setAttribute('role', 'alert'); kids.push(p);
      }
      return part('Project folder', ...kids);
    }
    const model = createBuildKit({ service: studio.service, spaceId: ctx.spaceId, jobId: ctx.jobId, stageId: ctx.stageId,
      report(view) {
        const want = doc.activeElement?.getAttribute?.('data-focus');
        unlisten(); marked.clear(); const restore = focus();
        root.setAttribute('aria-busy', String(view.state === 'loading' || !!view.busy));
        const title = node('h2', 'Build kit');
        if (view.state !== 'ready') {
          root.replaceChildren(title, states.panel(doc, view.state === 'offline' ? 'failed' : view.state,
            view.state === 'loading' ? 'Loading the build kit…' : view.message, () => void model.load()));
          restore(); return;
        }
        const saved = view.kit.saved;
        const status = node('p', saved ? `Saved: design version ${saved.version}` : 'Not saved to the project folder yet', `studio-build-kit-saved${saved ? ' is-saved' : ''}`);
        status.setAttribute('role', 'status');
        const parts = [title, status];
        if (view.error) { const e = node('p', view.error); e.setAttribute('role', 'alert'); parts.push(e); }
        parts.push(summary(view.kit), prompt(view.kit), saving(view));
        root.replaceChildren(...parts);
        const keep = want && marked.get(want);
        if (keep && !keep.disabled) keep.focus?.(); else restore();
      } });
    const off = studio.service.on((event, detail) => { if (['jobs-changed', 'project-files-changed'].includes(event) && detail?.spaceId === ctx.spaceId) void model.load(); });
    void model.load();
    return () => { disposed = true; off(); model.dispose(); unlisten(); root.remove(); };
  }
  return { createBuildKit, mountCanvas };
});
