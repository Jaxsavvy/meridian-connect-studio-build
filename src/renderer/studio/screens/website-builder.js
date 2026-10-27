'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianStudio.registerTool('website', { mountCanvas: api.mountCanvas });
})(typeof window === 'undefined' ? null : window, function () {
  // Website builder, part 1 (#199): start the site from the chapter cards, then preview each page.
  const WIDTHS = Object.freeze({ desktop: 1280, phone: 390 });
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const pageName = p => p.title || p.path || 'Untitled page';

  function createBuilder({ service, spaceId, jobId, stageId, report }) {
    let disposed = false, revision = 0, previewTurn = 0, site = null, pageId = null, html = '', preview = 'loading';
    let mode = 'desktop', busy = false, warnings = null;
    const show = (error = '') => report({ state: 'ready', site, pageId, html, preview, mode, busy, warnings, error });
    async function loadPreview() {
      if (disposed || !site) return;
      const turn = ++previewTurn; preview = 'loading'; show();
      try {
        const result = await service.previewPage(spaceId, jobId, pageId);
        if (disposed || turn !== previewTurn) return;
        html = typeof result?.html === 'string' ? result.html : ''; preview = 'ready'; show();
      } catch (_) { if (!disposed && turn === previewTurn) { preview = 'failed'; show(); } }
    }
    async function load() {
      if (disposed) return;
      const request = ++revision; if (!site) report({ state: 'loading' });
      if (stageId !== 'build') { report({ state: 'empty', message: 'The Website builder opens at the Build stage.' }); return; }
      try {
        const job = await service.getJob(spaceId, jobId);
        if (disposed || request !== revision) return;
        if (job?.id !== jobId || job.spaceId !== spaceId) throw Error('Unavailable');
        if (job.workflowId !== 'website') { report({ state: 'empty', message: 'Only Website Jobs have a site to build.' }); return; }
        const next = await service.getSite(spaceId, jobId);
        if (disposed || request !== revision) return;
        site = next && Array.isArray(next.pages) ? next : null;
        if (!site) { show(); return; }
        if (!site.pages.some(p => p.id === pageId)) pageId = site.pages[0]?.id || null;
        await loadPreview();
      } catch (error) {
        if (disposed || request !== revision) return;
        report(error?.code === 'OFFLINE' ? { state: 'offline', message: 'You are offline. Try again when connected.' }
          : { state: 'failed', message: 'Unable to open the Website builder. Check your connection and access, then try again.' });
      }
    }
    return { load,
      // Works once: the service refuses a second start, and the button is gone once there is a site.
      async start() {
        if (disposed || busy || site) return;
        busy = true; show();
        try {
          const result = await service.startSite(spaceId, jobId, { from: 'cards' });
          if (disposed) return;
          busy = false;
          if (!result?.ok) { show((result?.errors || []).map(e => e.message).join(' ') || 'The site could not be built. Try again.'); return; }
          warnings = result.report || null; site = result.site; pageId = site.pages[0]?.id || null; await loadPreview();
        } catch (error) { if (!disposed) { busy = false; show(error?.message || 'The site could not be built. Try again.'); } }
      },
      selectPage(id) { if (!disposed && site?.pages.some(p => p.id === id) && id !== pageId) { pageId = id; void loadPreview(); } },
      setMode(next) { if (!disposed && WIDTHS[next] && next !== mode) { mode = next; show(); } },
      reload: () => loadPreview(),
      dispose() { disposed = true; revision++; previewTurn++; },
    };
  }

  function mountCanvas(el, ctx) {
    const studio = ctx.studio || {}, doc = el.ownerDocument, root = doc.createElement('section');
    root.className = 'studio-website-builder'; root.setAttribute('aria-label', 'Website builder'); el.replaceChildren(root);
    const states = doc.defaultView?.MeridianStudioScreenStates || require('./home.js').screenStates;
    const focus = states.focus(root);
    let listeners = [];
    const listen = (item, type, fn) => { item.addEventListener(type, fn); listeners.push([item, type, fn]); };
    const unlisten = () => { for (const [item, type, fn] of listeners) item.removeEventListener?.(type, fn); listeners = []; };
    function node(tag, text, className) {
      const item = doc.createElement(tag); if (text) item.textContent = text;
      if (className) item.className = className; return item;
    }
    function button(text, action, opts = {}) {
      const item = node('button', text, `studio-button ${opts.primary ? 'is-primary' : 'is-secondary'}`); item.type = 'button';
      item.disabled = !!opts.disabled; if (opts.pressed !== undefined) item.setAttribute('aria-pressed', String(opts.pressed));
      listen(item, 'click', action); return item;
    }
    const model = createBuilder({ service: studio.service, spaceId: ctx.spaceId, jobId: ctx.jobId, stageId: ctx.stageId,
      report(view) {
        unlisten(); const restore = focus();
        root.setAttribute('aria-busy', String(view.state === 'loading' || !!view.busy));
        const title = node('h2', 'Website builder');
        if (view.state !== 'ready') {
          root.replaceChildren(title, states.panel(doc, view.state === 'offline' ? 'failed' : view.state,
            view.state === 'loading' ? 'Loading the site…' : view.message, () => void model.load()));
          restore(); return;
        }
        const parts = [title];
        if (!view.site) {
          parts.push(node('p', 'Meridian builds the site from the finished chapter cards: one section per card, in the cards\' order. You can preview every page right after.'),
            button(view.busy ? 'Building…' : 'Build the site from the chapter cards', () => void model.start(), { primary: true, disabled: view.busy }));
        } else {
          const w = view.warnings, notes = [];
          if (w?.custom?.length) notes.push(`${plural(w.custom.length, 'chapter', 'chapters')} still marked custom`);
          for (const s of w?.short || []) notes.push(`${s.chapter} is short on images (needs ${s.needs})`);
          if (notes.length) {
            const box = node('div', '', 'studio-card studio-website-notes'); box.setAttribute('role', 'status');
            const list = node('ul'); for (const n of notes) list.appendChild(node('li', n));
            box.append(node('h3', 'Worth a look (not errors)'), list); parts.push(box);
          }
          const pages = node('nav', '', 'studio-card studio-website-pages'); pages.setAttribute('aria-label', 'Pages');
          pages.appendChild(node('h3', 'Pages'));
          for (const p of view.site.pages) pages.appendChild(button(`${pageName(p)} ${p.path || ''}`.trim(), () => model.selectPage(p.id), { pressed: p.id === view.pageId }));
          const middle = node('div', '', 'studio-website-preview'), bar = node('div', '', 'studio-website-bar');
          bar.append(button('Desktop', () => model.setMode('desktop'), { pressed: view.mode === 'desktop' }),
            button('Phone', () => model.setMode('phone'), { pressed: view.mode === 'phone' }),
            button('Reload preview', () => void model.reload(), { disabled: view.preview === 'loading' }));
          middle.appendChild(bar);
          const page = view.site.pages.find(p => p.id === view.pageId);
          if (view.preview === 'failed') { const f = node('p', 'Couldn\'t load this preview. Try Reload preview.'); f.setAttribute('role', 'alert'); middle.appendChild(f); }
          else if (view.preview === 'loading') middle.appendChild(node('p', 'Loading preview…'));
          else {
            // Sandbox is exactly "allow-scripts" (the preview script reports clicks); never allow-same-origin or any other flag.
            const frame = node('iframe', '', `studio-website-frame is-${view.mode}`);
            frame.setAttribute('sandbox', 'allow-scripts'); frame.setAttribute('title', `Preview: ${page ? pageName(page) : 'page'}`);
            frame.setAttribute('width', String(WIDTHS[view.mode])); frame.srcdoc = view.html;
            const scroller = node('div', '', 'studio-website-scroll'); scroller.appendChild(frame); middle.appendChild(scroller);
          }
          const body = node('div', '', 'studio-website-body'); body.append(pages, middle); parts.push(body);
        }
        if (view.error) { const e = node('p', view.error); e.setAttribute('role', 'alert'); parts.push(e); }
        root.replaceChildren(...parts); restore();
      } });
    const off = studio.service.on((event, detail) => { if (event === 'site-changed' && detail?.jobId === ctx.jobId) void model.load(); });
    void model.load(); return () => { off(); model.dispose(); unlisten(); root.remove(); };
  }
  return { WIDTHS, createBuilder, mountCanvas };
});
