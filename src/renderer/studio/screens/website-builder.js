'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianStudio.registerTool('website', { mountCanvas: api.mountCanvas });
})(typeof window === 'undefined' ? null : window, function () {
  // Website builder: start the site from the chapter cards and preview each page (#199);
  // select, edit text, move and remove sections in an unsaved draft, then Save site (#200).
  const WIDTHS = Object.freeze({ desktop: 1280, phone: 390 });
  const ID = /^[a-z0-9][a-z0-9-]{0,39}$/, NAV = 'site-nav';
  const KINDS = { h1: 'Heading', h2: 'Heading', h3: 'Heading', h4: 'Heading', a: 'Link', button: 'Button', li: 'List item' };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const pageName = p => p.title || p.path || 'Untitled page';
  const short = t => (t.length > 60 ? `${t.slice(0, 59)}…` : t);
  const messages = r => (r?.errors || []).map(e => e.message).join(' ');

  function createBuilder({ service, edit, spaceId, jobId, stageId, report, onDirty = () => {} }) {
    let disposed = false, revision = 0, previewTurn = 0, site = null, draft = null, dirty = false, selected = null;
    let pageId = null, html = '', preview = 'loading', mode = 'desktop', busy = false, warnings = null;
    const setDirty = value => { if (value !== dirty) { dirty = value; onDirty(value); } };
    const items = () => (draft ? edit.editableList(draft, pageId) : []);
    const show = (error = '') => {
      const list = items();
      report({ state: 'ready', site: draft, pageId, html, preview, mode, busy, warnings, error, dirty, items: list, selected: list.find(i => i.key === selected) || null });
    };
    async function loadPreview() {
      if (disposed || !draft) return;
      const turn = ++previewTurn; preview = 'loading'; show();
      try {
        const result = await service.previewPage(spaceId, jobId, pageId, { site: draft });
        if (disposed || turn !== previewTurn) return;
        html = typeof result?.html === 'string' ? result.html : ''; preview = 'ready'; show();
      } catch (_) { if (!disposed && turn === previewTurn) { preview = 'failed'; show(); } }
    }
    // A helper's { ok: false, errors } leaves the draft exactly as it was.
    function change(result) {
      if (disposed) return false;
      if (!result?.ok) { show(messages(result) || 'That change didn\'t work.'); return false; }
      draft = result.site; setDirty(true);
      if (!items().some(i => i.key === selected)) selected = null;
      void loadPreview(); return true;
    }
    async function load() {
      if (disposed || dirty) return;   // never replace unsaved work
      const request = ++revision; if (!site) report({ state: 'loading' });
      if (stageId !== 'build') { report({ state: 'empty', message: 'The Website builder opens at the Build stage.' }); return; }
      try {
        const job = await service.getJob(spaceId, jobId);
        if (disposed || request !== revision) return;
        if (job?.id !== jobId || job.spaceId !== spaceId) throw Error('Unavailable');
        if (job.workflowId !== 'website') { report({ state: 'empty', message: 'Only Website Jobs have a site to build.' }); return; }
        const next = await service.getSite(spaceId, jobId);
        if (disposed || request !== revision || dirty) return;
        site = draft = next && Array.isArray(next.pages) ? next : null;
        if (!site) { show(); return; }
        if (!site.pages.some(p => p.id === pageId)) pageId = site.pages[0]?.id || null;
        if (!items().some(i => i.key === selected)) selected = null;
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
          if (!result?.ok) { show(messages(result) || 'The site could not be built. Try again.'); return; }
          warnings = result.report || null; site = draft = result.site; pageId = site.pages[0]?.id || null; await loadPreview();
        } catch (error) { if (!disposed) { busy = false; show(error?.message || 'The site could not be built. Try again.'); } }
      },
      selectPage(id) {
        if (!disposed && draft?.pages.some(p => p.id === id) && id !== pageId) { pageId = id; selected = null; void loadPreview(); }
      },
      /** Selects an editable item on this page; anything else is ignored. */
      select(key, sectionId) {
        if (disposed || !items().some(i => i.key === key && i.sectionId === sectionId)) return false;
        selected = key; show(); return true;
      },
      apply(text) { return !disposed && !busy && !!selected && change(edit.setText(draft, pageId, selected, text)); },
      move(sectionId, by) { return !disposed && !busy && change(edit.moveSection(draft, pageId, sectionId, by)); },
      remove(sectionId) { return !disposed && !busy && change(edit.removeSection(draft, pageId, sectionId)); },
      async save() {
        if (disposed || busy || !dirty) return;
        busy = true; show();
        try {
          const result = await service.saveSite(spaceId, jobId, draft);
          if (disposed) return;
          busy = false;
          if (!result?.ok) { show(messages(result) || 'The site could not be saved. Try again.'); return; }
          site = draft = result.site; setDirty(false); show();
        } catch (error) { if (!disposed) { busy = false; show(error?.message || 'The site could not be saved. Try again.'); } }
      },
      setMode(next) { if (!disposed && WIDTHS[next] && next !== mode) { mode = next; show(); } },
      reload: () => loadPreview(),
      dispose() { disposed = true; revision++; previewTurn++; setDirty(false); },
    };
  }

  function mountCanvas(el, ctx) {
    const studio = ctx.studio || {}, doc = el.ownerDocument, win = doc.defaultView, root = doc.createElement('section');
    root.className = 'studio-website-builder'; root.setAttribute('aria-label', 'Website builder'); el.replaceChildren(root);
    const states = win?.MeridianStudioScreenStates || require('./home.js').screenStates;
    const edit = win?.MeridianSiteEdit || require('../website/site-edit.js');
    const ask = message => typeof win?.confirm === 'function' && win.confirm(message);
    const focus = states.focus(root), marked = new Map();
    let listeners = [], layout = null, typed = null, focusNext = null;
    const listen = (item, type, fn) => { item.addEventListener(type, fn); listeners.push([item, type, fn]); };
    const unlisten = () => { for (const [item, type, fn] of listeners) item.removeEventListener?.(type, fn); listeners = []; };
    function node(tag, text, className) {
      const item = doc.createElement(tag); if (text) item.textContent = text;
      if (className) item.className = className; return item;
    }
    // data-focus names a control across re-renders, so focus stays on the item being edited.
    const mark = (item, id) => { item.setAttribute('data-focus', id); marked.set(id, item); return item; };
    function button(text, action, opts = {}) {
      const item = node('button', text, `studio-button ${opts.primary ? 'is-primary' : 'is-secondary'}`); item.type = 'button';
      item.disabled = !!opts.disabled; if (opts.pressed !== undefined) item.setAttribute('aria-pressed', String(opts.pressed));
      if (opts.label) item.setAttribute('aria-label', opts.label);
      if (opts.focus) mark(item, opts.focus);
      listen(item, 'click', action); return item;
    }
    // The site view keeps its containers (and the preview frame) between renders, so a selection doesn't reload the preview.
    function shell() {
      if (layout) return layout;
      const l = { title: node('h2', 'Website builder'), notes: node('div'), body: node('div', '', 'studio-website-body'),
        pages: node('nav', '', 'studio-card studio-website-pages'), middle: node('div', '', 'studio-website-preview'),
        bar: node('div', '', 'studio-website-bar'), slot: node('div'), panel: node('aside', '', 'studio-card studio-website-edit'),
        alerts: node('div'), frame: null, html: null };
      l.pages.setAttribute('aria-label', 'Pages'); l.panel.setAttribute('aria-label', 'Edit');
      l.middle.append(l.bar, l.slot); l.body.append(l.pages, l.middle, l.panel);
      root.replaceChildren(l.title, l.notes, l.body, l.alerts); return (layout = l);
    }
    function showPreview(l, view, page) {
      if (view.preview === 'failed') {
        const f = node('p', 'Couldn\'t load this preview. Try Reload preview.'); f.setAttribute('role', 'alert');
        l.frame = l.html = null; l.slot.replaceChildren(f);
      } else if (view.preview === 'ready' && view.html !== l.html) {
        // Sandbox is exactly "allow-scripts" (the preview script reports clicks); never allow-same-origin or any other flag.
        const frame = node('iframe');
        frame.setAttribute('sandbox', 'allow-scripts'); frame.srcdoc = view.html;
        const scroller = node('div', '', 'studio-website-scroll'); scroller.appendChild(frame);
        l.frame = frame; l.html = view.html; l.slot.replaceChildren(scroller);
      } else if (view.preview === 'loading' && !l.frame) l.slot.replaceChildren(node('p', 'Loading preview…'));
      if (!l.frame) return;
      l.frame.className = `studio-website-frame is-${view.mode}`; l.frame.setAttribute('width', String(WIDTHS[view.mode]));
      if (view.preview === 'ready') l.frame.setAttribute('title', `Preview: ${page ? pageName(page) : 'page'}`);
    }
    function editPanel(view, page) {
      const sel = view.selected, parts = [node('h3', 'Edit')];
      if (sel) {
        const field = mark(node('textarea'), 'text'); field.rows = 4;
        field.value = typed?.key === sel.key ? typed.value : sel.text;
        listen(field, 'input', () => { typed = { key: sel.key, value: field.value }; });
        const label = node('label', '', 'studio-website-field'); label.append(node('span', 'Text'), field);
        parts.push(node('p', `Section: ${sel.sectionLabel}`), label, button('Apply', () => {
          typed = { key: sel.key, value: field.value }; focusNext = 'apply';
          if (model.apply(field.value)) typed = null;
        }, { primary: true, focus: 'apply', disabled: view.busy }));
      } else parts.push(node('p', 'Click something in the preview to edit it, or pick it from the sections below.'));
      const tell = node('textarea'); tell.disabled = true;
      const tellLabel = node('label', '', 'studio-website-field'); tellLabel.append(node('span', 'Tell Meridian'), tell);
      parts.push(tellLabel, node('p', 'Meridian\'s rewrites arrive with the server.', 'studio-website-hint'));
      const head = mark(node('h3', 'Sections on this page'), 'sections'); head.tabIndex = -1;
      const list = node('ol', '', 'studio-website-sections'), sections = page ? page.sections : [];
      const movable = sections.filter(s => s.id !== NAV);
      for (const s of sections) {
        const li = node('li'), name = s.label || s.id; li.appendChild(node('strong', name));
        for (const it of view.items.filter(i => i.sectionId === s.id)) {
          li.appendChild(button(`${KINDS[it.tag] || 'Text'}: ${short(it.text)}`, () => { focusNext = 'text'; model.select(it.key, it.sectionId); },
            { pressed: it.key === sel?.key, focus: `item:${it.key}` }));
        }
        if (s.id !== NAV) {
          const at = movable.indexOf(s), tools = node('div', '', 'studio-website-tools');
          tools.append(
            button('Move up', () => { focusNext = `up:${s.id}`; model.move(s.id, -1); }, { focus: `up:${s.id}`, label: `Move ${name} up`, disabled: view.busy || at === 0 }),
            button('Move down', () => { focusNext = `down:${s.id}`; model.move(s.id, 1); }, { focus: `down:${s.id}`, label: `Move ${name} down`, disabled: view.busy || at === movable.length - 1 }),
            button('Remove section', () => { if (ask('Remove this section?')) { focusNext = `remove:${s.id}`; model.remove(s.id); } },
              { focus: `remove:${s.id}`, label: `Remove ${name}`, disabled: view.busy }));
          li.appendChild(tools);
        }
        list.appendChild(li);
      }
      parts.push(head, list); return parts;
    }
    const model = createBuilder({ service: studio.service, edit, spaceId: ctx.spaceId, jobId: ctx.jobId, stageId: ctx.stageId,
      onDirty: value => studio.setDirty?.(value),
      report(view) {
        const want = focusNext || doc.activeElement?.getAttribute?.('data-focus'); focusNext = null;
        unlisten(); marked.clear(); const restore = focus();
        root.setAttribute('aria-busy', String(view.state === 'loading' || !!view.busy));
        if (view.state !== 'ready' || !view.site) {
          layout = null; const title = node('h2', 'Website builder');
          if (view.state !== 'ready') {
            root.replaceChildren(title, states.panel(doc, view.state === 'offline' ? 'failed' : view.state,
              view.state === 'loading' ? 'Loading the site…' : view.message, () => void model.load()));
            restore(); return;
          }
          const parts = [title, node('p', 'Meridian builds the site from the finished chapter cards: one section per card, in the cards\' order. You can preview every page right after.'),
            button(view.busy ? 'Building…' : 'Build the site from the chapter cards', () => void model.start(), { primary: true, disabled: view.busy })];
          if (view.error) { const e = node('p', view.error); e.setAttribute('role', 'alert'); parts.push(e); }
          root.replaceChildren(...parts); restore(); return;
        }
        const l = shell(), w = view.warnings, notes = [];
        if (w?.custom?.length) notes.push(`${plural(w.custom.length, 'chapter', 'chapters')} still marked custom`);
        for (const s of w?.short || []) notes.push(`${s.chapter} is short on images (needs ${s.needs})`);
        if (notes.length) {
          const box = node('div', '', 'studio-card studio-website-notes'); box.setAttribute('role', 'status');
          const list = node('ul'); for (const n of notes) list.appendChild(node('li', n));
          box.append(node('h3', 'Worth a look (not errors)'), list); l.notes.replaceChildren(box);
        } else l.notes.replaceChildren();
        l.pages.replaceChildren(node('h3', 'Pages'));
        for (const p of view.site.pages) l.pages.appendChild(button(`${pageName(p)} ${p.path || ''}`.trim(), () => model.selectPage(p.id), { pressed: p.id === view.pageId }));
        const status = node('span', view.busy ? 'Saving…' : view.dirty ? 'Unsaved changes' : '', 'studio-website-status'); status.setAttribute('role', 'status');
        l.bar.replaceChildren(button('Desktop', () => model.setMode('desktop'), { pressed: view.mode === 'desktop' }),
          button('Phone', () => model.setMode('phone'), { pressed: view.mode === 'phone' }),
          button('Reload preview', () => void model.reload(), { disabled: view.preview === 'loading' }),
          button('Save site', () => void model.save(), { primary: true, focus: 'save', disabled: view.busy || !view.dirty }), status);
        const page = view.site.pages.find(p => p.id === view.pageId);
        showPreview(l, view, page); l.panel.replaceChildren(...editPanel(view, page));
        if (view.error) { const e = node('p', view.error); e.setAttribute('role', 'alert'); l.alerts.replaceChildren(e); } else l.alerts.replaceChildren();
        // Focus stays on what was used; a removed section's controls hand focus to the section list.
        const usable = id => { const t = marked.get(id); return t && !t.disabled ? t : null; };
        const [kind, sid] = String(want || '').split(':'), other = { up: 'down', down: 'up' }[kind];
        const target = want && (usable(want) || (other && usable(`${other}:${sid}`)) || (sid ? marked.get('sections') : null));
        if (target) target.focus?.(); else restore();
      } });
    // Only a 'meridian-select' from this preview frame, with well-formed ids for an editable item, selects anything.
    function onMessage(event) {
      const frame = layout?.frame, data = event?.data;
      if (!frame?.contentWindow || event.source !== frame.contentWindow) return;
      if (!data || typeof data !== 'object' || Object.getPrototypeOf(data) !== Object.prototype || data.type !== 'meridian-select') return;
      if (typeof data.key !== 'string' || typeof data.sectionId !== 'string' || !ID.test(data.key) || !ID.test(data.sectionId)) return;
      focusNext = 'text'; if (!model.select(data.key, data.sectionId)) focusNext = null;
    }
    win?.addEventListener('message', onMessage);
    const off = studio.service.on((event, detail) => { if (event === 'site-changed' && detail?.jobId === ctx.jobId) void model.load(); });
    void model.load();
    return () => { off(); win?.removeEventListener('message', onMessage); model.dispose(); unlisten(); root.remove(); };
  }
  return { WIDTHS, createBuilder, mountCanvas };
});
