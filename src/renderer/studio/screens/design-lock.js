'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianStudio.registerTool('design-lock', { mountCanvas: api.mountCanvas });
})(typeof window === 'undefined' ? null : window, function () {
  // Design lock screen (#241): the one bundle the client approves before Build, or sends back for changes.
  const safeUrl = url => typeof url === 'string' && /^(https:\/\/|blob:|data:image\/(png|jpeg|webp|gif|svg\+xml)[;,])/i.test(url);
  const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
  const WHO = { client: 'Client', jax: 'Jax' };

  function createDesignLock({ service, spaceId, jobId, stageId, report }) {
    let disposed = false, revision = 0, view = null, busy = false;
    const show = (error = '') => report({ state: 'ready', ...view, busy, error });
    async function load() {
      if (disposed) return;
      const request = ++revision; if (!view) report({ state: 'loading' });
      if (stageId !== 'lock') { report({ state: 'empty', message: 'Design lock opens at the Design lock stage.' }); return; }
      try {
        const job = await service.getJob(spaceId, jobId);
        if (disposed || request !== revision) return;
        if (job?.id !== jobId || job.spaceId !== spaceId) throw Error('Unavailable');
        if (job.workflowId !== 'website') { report({ state: 'empty', message: 'Only Website Jobs have a design to lock.' }); return; }
        const [design, assets] = await Promise.all([service.getDesignLock(spaceId, jobId), service.listJobAssets(spaceId, jobId)]);
        if (disposed || request !== revision) return;
        const stages = Array.isArray(job.stages) ? job.stages : [], at = stages.findIndex(st => st.id === 'lock');
        const lockDone = stages[at]?.status === 'done';
        // Three phases: with the team, waiting on the client (sent and with Jax), or approved.
        const phase = design?.answer?.approved && lockDone ? 'approved' : design?.sent && job.waitingOnJax && job.stageId === 'lock' ? 'client' : 'team';
        const images = {};
        for (const a of [...(assets?.storyboard || []), ...(assets?.look || [])]) if (a?.id && safeUrl(a.url)) images[a.id] = a.url;
        view = { phase, design, images, earlier: at > 0 ? stages.slice(0, at).map(st => ({ id: st.id, name: st.name })) : [] };
        show();
      } catch (error) {
        if (disposed || request !== revision) return;
        report(error?.code === 'OFFLINE' ? { state: 'offline', message: 'You are offline. Try again when connected.' }
          : { state: 'failed', message: 'Unable to open Design lock. Check your connection and access, then try again.' });
      }
    }
    async function act(work) {
      if (disposed || busy || !view) return false;
      busy = true; show();
      try { await work(); busy = false; await load(); return !disposed; } catch (error) {
        if (!disposed) { busy = false; show(error?.message || 'Try again.'); }
        return false;
      }
    }
    return { load,
      approve: () => (view?.phase === 'client' ? act(() => service.answerDesign(spaceId, jobId, { approved: true })) : Promise.resolve(false)),
      askChanges(note) {
        const text = String(note || '').trim();
        if (view?.phase !== 'client') return Promise.resolve(false);
        if (!text) { show('Say what the client wants changed.'); return Promise.resolve(false); }
        return act(() => service.answerDesign(spaceId, jobId, { approved: false, note: text }));
      },
      sendBack(target) {
        if (view?.phase !== 'team' || !view.earlier.some(st => st.id === target)) return Promise.resolve(false);
        return act(() => service.sendBack(spaceId, jobId, target));
      },
      dispose() { disposed = true; revision++; },
    };
  }

  function mountCanvas(el, ctx) {
    const studio = ctx.studio || {}, doc = el.ownerDocument, win = doc.defaultView, root = doc.createElement('section');
    root.className = 'studio-design-lock'; root.setAttribute('aria-label', 'Design lock'); el.replaceChildren(root);
    const states = win?.MeridianStudioScreenStates || require('./home.js').screenStates;
    const ask = message => typeof win?.confirm === 'function' && win.confirm(message);
    const directions = (win?.MeridianLookFrames || require('../website/look-frames.js')).DIRECTIONS;
    const focus = states.focus(root), marked = new Map();
    let listeners = [], note = '', target = null;
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
    const section = (label, ...kids) => { const s = node('section', '', 'studio-card studio-design-lock-part'); s.setAttribute('aria-label', label); s.append(node('h3', label), ...kids); return s; };
    function figure(url, alt, caption) {
      const f = node('figure', '', 'studio-design-lock-figure');
      if (url) { const img = node('img'); img.setAttribute('src', url); img.setAttribute('alt', alt); f.appendChild(img); }
      else f.appendChild(node('span', 'No frame yet', 'studio-design-lock-missing'));
      f.appendChild(node('figcaption', caption)); return f;
    }
    // The design as the client sees it: concept, film strip, look frame and style numbers. Always read-only.
    function design(view) {
      const b = view.design?.bundle || {}, parts = [];
      const concept = node('div'); concept.append(node('p', b.concept?.line || 'No concept line yet', 'studio-design-lock-line'),
        node('p', `Mood: ${(b.concept?.mood || []).join(', ') || '–'}`));
      parts.push(section('Concept', concept));
      const strip = node('div', '', 'studio-design-lock-pages');
      for (const p of b.pages || []) {
        const page = node('div'), list = node('ol', '', 'studio-design-lock-strip');
        for (const c of p.chapters || []) { const li = node('li'); li.appendChild(figure(view.images[c.frame], `Storyboard frame: ${c.name || 'chapter'}`, c.name || 'Chapter')); list.appendChild(li); }
        page.append(node('h4', p.name || 'Untitled page'), list); strip.appendChild(page);
      }
      parts.push(section('Film strip', strip));
      parts.push(section('Look frame', figure(view.images[b.look?.frame], 'Chosen look frame', b.look?.direction ? `Direction: ${directions.find(d => d.id === b.look.direction)?.name || b.look.direction}` : 'No look chosen yet')));
      const swatches = node('ul', '', 'studio-design-lock-swatches');
      for (const [name, hex] of Object.entries(b.style?.colors || {})) {
        const li = node('li'), chip = node('span', '', 'studio-design-lock-swatch');
        if (HEX.test(hex)) chip.setAttribute('style', `background-color: ${hex}`);   // checked hex only, never HTML
        li.append(chip, node('span', `${name} ${hex}`)); swatches.appendChild(li);
      }
      const fonts = b.style?.fonts || {};
      parts.push(section('Style numbers', swatches, node('p', `Headings: ${fonts.heading || '–'} · Body: ${fonts.body || '–'}`)));
      return parts;
    }
    function team(view) {
      const d = view.design || {}, parts = [];
      if (d.answer && !d.answer.approved) {
        const box = node('section', '', 'studio-card studio-design-lock-changes'); box.setAttribute('aria-label', 'The client asked for changes');
        box.append(node('h3', 'The client asked for changes'), node('p', d.answer.note || ''));
        if (view.earlier.length) {
          if (!view.earlier.some(st => st.id === target)) target = view.earlier[view.earlier.length - 1].id;
          const label = node('label', '', 'studio-design-lock-field'), select = mark(node('select'), 'send-to'); select.disabled = view.busy;
          for (const st of view.earlier) { const o = node('option', st.name); o.value = st.id; o.selected = st.id === target; select.appendChild(o); }
          select.value = target; listen(select, 'change', () => { target = select.value; });
          label.append(node('span', 'Send back to'), select);
          box.append(label, button(view.busy ? 'Sending back…' : 'Send back', () => {
            const name = view.earlier.find(st => st.id === target)?.name || 'that stage';
            if (ask(`Send the Job back to ${name}? It and every stage after it open again.`)) void model.sendBack(target);
          }, { focus: 'send-back', disabled: view.busy }));
        }
        parts.push(box);
      }
      if (d.gaps?.length) {
        const ul = node('ul'); for (const g of d.gaps) ul.appendChild(node('li', `${g.where}: ${g.message}`));
        const box = section('Still needed', ul); box.className += ' is-needed'; parts.push(box);
      } else { const ready = node('p', 'Ready to send to Jax', 'studio-design-lock-ready'); ready.setAttribute('role', 'status'); parts.push(ready); }
      return parts;
    }
    function client(view) {
      const label = node('label', '', 'studio-design-lock-field'), field = mark(node('textarea'), 'note');
      field.maxLength = 1000; field.rows = 3; field.value = note; field.disabled = view.busy;
      listen(field, 'input', () => { note = field.value; });
      label.append(node('span', 'What should change? (needed to ask for changes)'), field);
      const tools = node('div', '', 'studio-design-lock-tools');
      tools.append(button('Approve the design', () => void model.approve(), { primary: true, focus: 'approve', disabled: view.busy }),
        button('Ask for changes', async () => { if (await model.askChanges(note)) note = ''; }, { focus: 'ask', disabled: view.busy }));
      return [section('Practice: answer as the client', label, tools)];
    }
    function history(view) {
      const list = view.design?.history || [];
      if (!list.length) return [];
      const ol = node('ol');
      for (const h of list) ol.appendChild(node('li', `Version ${h.version} · ${h.approved ? 'Approved' : 'Changes asked'}${h.note ? ` · ${h.note}` : ''} · ${WHO[h.by] || 'Client'}`));
      return [section('History', ol)];
    }
    const model = createDesignLock({ service: studio.service, spaceId: ctx.spaceId, jobId: ctx.jobId, stageId: ctx.stageId,
      report(view) {
        const want = doc.activeElement?.getAttribute?.('data-focus');
        unlisten(); marked.clear(); const restore = focus();
        root.setAttribute('aria-busy', String(view.state === 'loading' || !!view.busy));
        const title = node('h2', 'Design lock');
        if (view.state !== 'ready') {
          root.replaceChildren(title, states.panel(doc, view.state === 'offline' ? 'failed' : view.state,
            view.state === 'loading' ? 'Loading the design…' : view.message, () => void model.load()));
          restore(); return;
        }
        const d = view.design || {}, parts = [title];
        const status = node('p', '', 'studio-design-lock-status'); status.setAttribute('role', 'status');
        if (view.phase === 'approved') status.textContent = `Approved by ${d.answer?.by === 'jax' ? 'Jax' : 'the client'}`;
        else if (view.phase === 'client') status.textContent = `With the client · Version ${d.sent?.version || 1}`;
        else status.textContent = d.sent ? 'With the team: make the changes, then send it again' : 'With the team';
        parts.push(status);
        if (view.error) { const e = node('p', view.error); e.setAttribute('role', 'alert'); parts.push(e); }
        if (view.phase === 'team') parts.push(...team(view));
        if (view.phase === 'client') parts.push(...client(view));
        parts.push(...design(view), ...history(view));
        root.replaceChildren(...parts);
        const keep = want && marked.get(want);
        if (keep && !keep.disabled) keep.focus?.(); else restore();
      } });
    const off = studio.service.on((event, detail) => {
      if ((event === 'design-changed' && detail?.jobId === ctx.jobId) || (['jobs-changed', 'assets-changed'].includes(event) && detail?.spaceId === ctx.spaceId)) void model.load();
    });
    void model.load();
    return () => { off(); model.dispose(); unlisten(); root.remove(); };
  }
  return { safeUrl, createDesignLock, mountCanvas };
});
