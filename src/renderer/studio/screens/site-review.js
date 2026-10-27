'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianStudio.registerTool('site-review', { mountCanvas: api.mountCanvas });
})(typeof window === 'undefined' ? null : window, function () {
  // Website Review screen (#218): click the preview (or pick from the list) to comment; every comment gets
  // Fixed or Keep as is with a note before Review goes to Jax.
  const WIDTHS = Object.freeze({ desktop: 1280, phone: 390 });
  const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
  const KINDS = { h1: 'Heading', h2: 'Heading', h3: 'Heading', h4: 'Heading', a: 'Link', button: 'Button', li: 'List item' };
  const ANSWERS = { fixed: 'Fixed', keep: 'Kept as is' };
  const pageName = p => p.title || p.path || 'Untitled page';
  const short = t => (t.length > 60 ? `${t.slice(0, 59)}…` : t);

  function createSiteReview({ service, edit, spaceId, jobId, stageId, report }) {
    let disposed = false, revision = 0, previewTurn = 0, site = null, comments = null, locked = false, busy = false;
    let pageId = null, html = '', preview = 'loading', mode = 'desktop', selected = null;
    const items = () => (site ? edit.editableList(site, pageId) : []);
    const show = (error = '') => {
      const list = items();
      report({ state: 'ready', site, pageId, html, preview, mode, comments, locked, busy, error, items: list,
        selected: list.find(i => i.key === selected?.key && i.sectionId === selected?.sectionId) || null });
    };
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
      const request = ++revision; if (!comments) report({ state: 'loading' });
      if (stageId !== 'review') { report({ state: 'empty', message: 'The Website Review opens at the Review stage.' }); return; }
      try {
        const job = await service.getJob(spaceId, jobId);
        if (disposed || request !== revision) return;
        if (job?.id !== jobId || job.spaceId !== spaceId) throw Error('Unavailable');
        if (job.workflowId !== 'website') { report({ state: 'empty', message: 'Only Website Jobs have a site to review.' }); return; }
        const [next, review] = await Promise.all([service.getSite(spaceId, jobId), service.getReview(spaceId, jobId)]);
        if (disposed || request !== revision) return;
        locked = !!job.waitingOnJax || (job.stages || []).some(st => st.id === 'review' && st.status === 'done');
        site = next && Array.isArray(next.pages) ? next : null;
        comments = (Array.isArray(review?.comments) ? review.comments : []).map(c => ({ ...c, source: c.source === 'check' ? 'check' : 'team' }));
        if (!site) { report({ state: 'empty', message: 'Build the site first.' }); return; }
        if (!site.pages.some(p => p.id === pageId)) pageId = site.pages[0]?.id || null;
        if (!items().some(i => i.key === selected?.key && i.sectionId === selected?.sectionId)) selected = null;
        await loadPreview();
      } catch (error) {
        if (disposed || request !== revision) return;
        report(error?.code === 'OFFLINE' ? { state: 'offline', message: 'You are offline. Try again when connected.' }
          : { state: 'failed', message: 'Unable to open the Website Review. Check your connection and access, then try again.' });
      }
    }
    async function act(work) {
      if (disposed || busy || !comments || locked) return false;
      busy = true; show();
      try { await work(); busy = false; await load(); return !disposed; } catch (error) {
        if (!disposed) { busy = false; show(error?.message || 'Try again.'); }
        return false;
      }
    }
    return { load,
      selectPage(id) { if (!disposed && site?.pages.some(p => p.id === id) && id !== pageId) { pageId = id; selected = null; void loadPreview(); } },
      /** Selects an item on this page; anything not in editableList is ignored. */
      select(key, sectionId) {
        if (disposed || locked || !items().some(i => i.key === key && i.sectionId === sectionId)) return false;
        selected = { key, sectionId }; show(); return true;
      },
      add(text) {
        const words = String(text || '').trim();
        if (!selected) return Promise.resolve(false);
        if (!words) { if (!disposed) show('Write the comment first.'); return Promise.resolve(false); }
        return act(() => service.addReviewComment(spaceId, jobId, { pageId, sectionId: selected.sectionId, key: selected.key, text: words }));
      },
      answer(id, kind, note) {
        const why = String(note || '').trim();
        if (!why) { if (!disposed && comments) show(kind === 'fixed' ? 'Say what changed before marking it Fixed.' : 'Say why it stays before choosing Keep as is.'); return Promise.resolve(false); }
        return act(() => service.resolveReviewComment(spaceId, jobId, id, { kind, note: why }));
      },
      setMode(next) { if (!disposed && WIDTHS[next] && next !== mode) { mode = next; show(); } },
      dispose() { disposed = true; revision++; previewTurn++; },
    };
  }

  function mountCanvas(el, ctx) {
    const studio = ctx.studio || {}, doc = el.ownerDocument, win = doc.defaultView, root = doc.createElement('section');
    root.className = 'studio-site-review'; root.setAttribute('aria-label', 'Website Review'); el.replaceChildren(root);
    const states = win?.MeridianStudioScreenStates || require('./home.js').screenStates;
    const edit = win?.MeridianSiteEdit || require('../website/site-edit.js');
    const focus = states.focus(root), marked = new Map(), notes = {};
    let listeners = [], layout = null, draft = { key: null, text: '' };
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
    const focusTo = (...ids) => { for (const id of ids) { const t = marked.get(id); if (t && !t.disabled) { t.focus?.(); return; } } };
    // The preview frame stays mounted between redraws (only new HTML replaces it), so a click doesn't reload it.
    function shell() {
      if (layout) return layout;
      const l = { title: node('h2', 'Website Review'), top: node('div', '', 'studio-card studio-site-review-top'), body: node('div', '', 'studio-site-review-body'),
        side: node('div', '', 'studio-site-review-side'), middle: node('div', '', 'studio-site-review-preview'), bar: node('div', '', 'studio-site-review-bar'),
        slot: node('div'), panel: node('aside', '', 'studio-card studio-site-review-comments'), alerts: node('div'), frame: null, html: null };
      l.panel.setAttribute('aria-label', 'Comments'); l.middle.append(l.bar, l.slot); l.body.append(l.side, l.middle, l.panel);
      root.replaceChildren(l.title, l.top, l.alerts, l.body); return (layout = l);
    }
    function showPreview(l, view, page) {
      if (view.preview === 'failed') {
        const f = node('p', 'Couldn\'t load this preview. Pick the page again to retry.'); f.setAttribute('role', 'alert');
        l.frame = l.html = null; l.slot.replaceChildren(f);
      } else if (view.preview === 'ready' && view.html !== l.html) {
        // Sandbox is exactly "allow-scripts" (the preview script reports clicks); never allow-same-origin or any other flag.
        const frame = node('iframe'); frame.setAttribute('sandbox', 'allow-scripts'); frame.srcdoc = view.html;
        const scroller = node('div', '', 'studio-site-review-scroll'); scroller.appendChild(frame);
        l.frame = frame; l.html = view.html; l.slot.replaceChildren(scroller);
      } else if (view.preview === 'loading' && !l.frame) l.slot.replaceChildren(node('p', 'Loading preview…'));
      if (!l.frame) return;
      l.frame.className = `studio-site-review-frame is-${view.mode}`; l.frame.setAttribute('width', String(WIDTHS[view.mode]));
      if (view.preview === 'ready') l.frame.setAttribute('title', `Preview: ${page ? pageName(page) : 'page'}`);
    }
    function side(view, page) {
      const pages = node('nav', '', 'studio-card studio-site-review-pages'); pages.setAttribute('aria-label', 'Pages');
      pages.appendChild(node('h3', 'Pages'));
      for (const p of view.site.pages) pages.appendChild(button(`${pageName(p)} ${p.path || ''}`.trim(), () => model.selectPage(p.id), { pressed: p.id === view.pageId }));
      const parts = [pages];
      if (view.locked) return parts;
      const box = node('section', '', 'studio-card studio-site-review-sections'); box.setAttribute('aria-label', 'Sections on this page');
      box.appendChild(node('h3', 'Sections on this page'));
      for (const s of page ? page.sections : []) {
        const its = view.items.filter(i => i.sectionId === s.id);
        if (!its.length) continue;
        box.appendChild(node('strong', s.label || s.id));
        for (const it of its) {
          box.appendChild(button(`${KINDS[it.tag] || 'Text'}: ${short(it.text)}`, () => { if (model.select(it.key, it.sectionId)) focusTo('comment'); },
            { pressed: it.key === view.selected?.key && it.sectionId === view.selected?.sectionId, focus: `item:${it.sectionId}:${it.key}` }));
        }
      }
      parts.push(box); return parts;
    }
    function commentBox(view) {
      const sel = view.selected, parts = [node('h3', 'Add a comment')];
      if (!sel) { parts.push(node('p', 'Click something in the preview, or pick it from the sections list, to comment on it.')); return parts; }
      if (draft.key !== `${sel.sectionId}:${sel.key}`) draft = { key: `${sel.sectionId}:${sel.key}`, text: '' };
      const field = mark(node('textarea'), 'comment'); field.maxLength = 1000; field.rows = 3; field.value = draft.text; field.disabled = view.busy;
      listen(field, 'input', () => { draft.text = field.value; });
      const label = node('label', '', 'studio-site-review-field'); label.append(node('span', `Comment on: ${sel.sectionLabel} · ${short(sel.text)}`), field);
      parts.push(label, button(view.busy ? 'Saving…' : 'Add comment', async () => {
        if (await model.add(draft.text)) {
          draft.text = ''; const box = marked.get('comment'); if (box) box.value = '';
          focusTo('comment');
        }
      }, { primary: true, focus: 'add', disabled: view.busy }));
      return parts;
    }
    function commentItem(c, view, order) {
      const li = node('li', '', `studio-site-review-comment ${c.resolved ? 'is-answered' : 'is-open'}`);
      li.appendChild(node('p', c.text));
      if (c.source === 'check') li.appendChild(node('span', 'From the automatic check', 'studio-chip'));
      if (c.resolved) {
        li.append(node('span', ANSWERS[c.resolved.kind] || 'Answered', 'studio-chip studio-site-review-answer'), node('p', `Note: ${c.resolved.note}`));
      } else if (!view.locked) {
        const label = node('label', '', 'studio-site-review-field'), input = mark(node('input'), `note:${c.id}`);
        input.maxLength = 500; input.value = notes[c.id] || ''; input.disabled = view.busy;
        listen(input, 'input', () => { notes[c.id] = input.value; });
        label.append(node('span', 'Note (what changed, or why it stays)'), input);
        const answer = kind => async () => {
          const open = order.filter(x => !x.resolved), at = open.indexOf(c), next = open.slice(at + 1).concat(open.slice(0, at))[0];
          if (await model.answer(c.id, kind, notes[c.id])) { delete notes[c.id]; focusTo(next ? `note:${next.id}` : 'ready', 'summary'); }
        };
        const tools = node('div', '', 'studio-site-review-tools');
        tools.append(button('Fixed', answer('fixed'), { label: `Fixed: ${short(c.text)}`, disabled: view.busy }),
          button('Keep as is', answer('keep'), { label: `Keep as is: ${short(c.text)}`, disabled: view.busy }));
        li.append(label, tools);
      }
      return li;
    }
    function commentList(view) {
      const groups = new Map();
      for (const c of view.comments) { if (!groups.has(c.where)) groups.set(c.where, []); groups.get(c.where).push(c); }
      const order = [...groups.values()].flat(), parts = [node('h3', 'Comments')];
      if (!order.length) parts.push(node('p', 'No comments yet.'));
      for (const [where, list] of groups) {
        const ul = node('ul'); for (const c of list) ul.appendChild(commentItem(c, view, order));
        const group = node('section', '', 'studio-site-review-group'); group.setAttribute('aria-label', where || 'Site');
        group.append(node('h4', where || 'Site'), ul); parts.push(group);
      }
      return parts;
    }
    const model = createSiteReview({ service: studio.service, edit, spaceId: ctx.spaceId, jobId: ctx.jobId, stageId: ctx.stageId,
      report(view) {
        const want = doc.activeElement?.getAttribute?.('data-focus');
        unlisten(); marked.clear(); const restore = focus();
        root.setAttribute('aria-busy', String(view.state === 'loading' || !!view.busy));
        if (view.state !== 'ready') {
          layout = null;
          root.replaceChildren(node('h2', 'Website Review'), states.panel(doc, view.state === 'offline' ? 'failed' : view.state,
            view.state === 'loading' ? 'Loading the review…' : view.message, () => void model.load()));
          restore(); return;
        }
        const l = shell(), open = view.comments.filter(c => !c.resolved).length, page = view.site.pages.find(p => p.id === view.pageId);
        const summary = mark(node('p', '', 'studio-site-review-summary'), 'summary'); summary.tabIndex = -1;
        summary.append(node('span', `${open} open`, 'studio-site-review-open'), node('span', ' · '),
          node('span', `${view.comments.length - open} answered`, 'studio-site-review-answered'));
        const top = [summary];
        if (view.locked) top.push(node('p', 'With Jax for review.', 'studio-site-review-locked'));
        else if (!open) { const ready = mark(node('p', 'Ready: send to Jax', 'studio-site-review-ready'), 'ready'); ready.setAttribute('role', 'status'); ready.tabIndex = -1; top.push(ready); }
        l.top.replaceChildren(...top);
        if (view.error) { const e = node('p', view.error); e.setAttribute('role', 'alert'); l.alerts.replaceChildren(e); } else l.alerts.replaceChildren();
        l.side.replaceChildren(...side(view, page));
        l.bar.replaceChildren(button('Desktop', () => model.setMode('desktop'), { pressed: view.mode === 'desktop' }),
          button('Phone', () => model.setMode('phone'), { pressed: view.mode === 'phone' }));
        showPreview(l, view, page);
        l.panel.replaceChildren(...(view.locked ? [] : commentBox(view)), ...commentList(view));
        const keep = want && marked.get(want);
        if (keep && !keep.disabled) keep.focus?.(); else restore();
      } });
    // Only a 'meridian-select' from this preview frame, with well-formed ids for an editable item, selects anything.
    function onMessage(event) {
      const frame = layout?.frame, data = event?.data;
      if (!frame?.contentWindow || event.source !== frame.contentWindow) return;
      if (!data || typeof data !== 'object' || Object.getPrototypeOf(data) !== Object.prototype || data.type !== 'meridian-select') return;
      if (typeof data.key !== 'string' || typeof data.sectionId !== 'string' || !ID.test(data.key) || !ID.test(data.sectionId)) return;
      if (model.select(data.key, data.sectionId)) focusTo('comment');
    }
    win?.addEventListener('message', onMessage);
    const off = studio.service.on((event, detail) => {
      if ((event === 'review-changed' || event === 'site-changed') && detail?.jobId === ctx.jobId) void model.load();
    });
    void model.load();
    return () => { off(); win?.removeEventListener('message', onMessage); model.dispose(); unlisten(); root.remove(); };
  }
  return { WIDTHS, createSiteReview, mountCanvas };
});
