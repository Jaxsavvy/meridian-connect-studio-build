'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianStudio.registerTool('site-check', { mountCanvas: api.mountCanvas });
})(typeof window === 'undefined' ? null : window, function () {
  // Website Check screen (#207): what Meridian found on the finished site, grouped by kind; a person explains each flag.
  // The real site (#258): its pull request, its preview link and the screenshots Connect takes come first.
  const KINDS = Object.freeze({ pr: 'The pull request', preview: 'Preview link', 'site-screenshots': 'Desktop and phone screenshots',
    seo: 'Google basics', accessibility: 'Easy for everyone to use', links: 'Links inside the site',
    'links-open': 'Outside links', speed: 'Speed (estimate)', phone: 'On a phone', 'phone-screenshot': 'On a phone' });
  // How each kind is answered: the PR is checked on GitHub; the preview flag clears by itself, so it takes no note.
  const ANSWER = { pr: { label: 'What the checks showed on GitHub', button: 'Mark as checked' } };
  const SELF_CLEARING = { preview: 'Paste the preview link on the Build kit. This clears by itself.' };
  const kindName = check => KINDS[check] || check;
  /** Flags grouped by kind, in KINDS order (any other kind after): [{ check, name, flags }]. */
  function groups(flags) {
    const order = Object.keys(KINDS), out = new Map();
    for (const f of [...flags].sort((a, b) => (order.indexOf(a.check) + 1 || 99) - (order.indexOf(b.check) + 1 || 99))) {
      if (!out.has(f.check)) out.set(f.check, { check: f.check, name: kindName(f.check), flags: [] });
      out.get(f.check).flags.push(f);
    }
    return [...out.values()];
  }
  function when(at) {
    const d = new Date(at);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  function createSiteCheck({ service, spaceId, jobId, stageId, report }) {
    let disposed = false, revision = 0, checks = null, locked = false, busy = false;
    const show = (error = '') => report({ state: 'ready', checks, locked, busy, error });
    async function load() {
      if (disposed) return;
      const request = ++revision; if (!checks) report({ state: 'loading' });
      if (stageId !== 'check') { report({ state: 'empty', message: 'The Website Check opens at the Check stage.' }); return; }
      try {
        const job = await service.getJob(spaceId, jobId);
        if (disposed || request !== revision) return;
        if (job?.id !== jobId || job.spaceId !== spaceId) throw Error('Unavailable');
        if (job.workflowId !== 'website') { report({ state: 'empty', message: 'Only Website Jobs have a site to check.' }); return; }
        const next = await service.getChecks(spaceId, jobId);
        if (disposed || request !== revision) return;
        locked = (job.stages || []).some(st => st.id === 'check' && st.status === 'done');
        checks = { ranAt: next?.ranAt || null, flags: Array.isArray(next?.flags) ? next.flags : [],
          notRun: Array.isArray(next?.notRun) ? next.notRun : [], log: Array.isArray(next?.log) ? next.log : [] };
        show();
      } catch (error) {
        if (disposed || request !== revision) return;
        report(error?.code === 'OFFLINE' ? { state: 'offline', message: 'You are offline. Try again when connected.' }
          : { state: 'failed', message: 'Unable to open the Website Check. Check your connection and access, then try again.' });
      }
    }
    async function act(work) {
      if (disposed || busy || !checks || locked) return false;
      busy = true; show();
      try { await work(); busy = false; await load(); return !disposed; } catch (error) {
        if (!disposed) { busy = false; show(error?.message || 'Try again.'); }
        return false;
      }
    }
    return { load,
      runAgain: () => act(() => service.runChecks(spaceId, jobId)),
      resolve(flagId, note) {
        const why = String(note || '').trim();
        if (!why) { if (!disposed && checks) show('Say why this flag is OK before marking it.'); return Promise.resolve(false); }
        return act(() => service.resolveFlag(spaceId, jobId, flagId, why));
      },
      dispose() { disposed = true; revision++; },
    };
  }

  function mountCanvas(el, ctx) {
    const studio = ctx.studio || {}, doc = el.ownerDocument, root = doc.createElement('section');
    root.className = 'studio-site-check'; root.setAttribute('aria-label', 'Website Check'); el.replaceChildren(root);
    const states = doc.defaultView?.MeridianStudioScreenStates || require('./home.js').screenStates;
    const focus = states.focus(root), marked = new Map(), notes = {};   // notes being typed, kept across redraws
    let listeners = [];
    const listen = (item, type, fn) => { item.addEventListener(type, fn); listeners.push([item, type, fn]); };
    const unlisten = () => { for (const [item, type, fn] of listeners) item.removeEventListener?.(type, fn); listeners = []; };
    function node(tag, text, className) {
      const item = doc.createElement(tag); if (text) item.textContent = text;
      if (className) item.className = className; return item;
    }
    // data-focus names a control across redraws, so focus isn't lost when the list reloads.
    const mark = (item, id) => { item.setAttribute('data-focus', id); marked.set(id, item); return item; };
    function button(text, action, opts = {}) {
      const item = node('button', text, `studio-button ${opts.primary ? 'is-primary' : 'is-secondary'}`); item.type = 'button';
      item.disabled = !!opts.disabled; if (opts.label) item.setAttribute('aria-label', opts.label);
      listen(item, 'click', action); return item;
    }
    // After a flag is resolved, focus moves to the next one still to review (or the Ready line).
    async function resolve(flag, order) {
      const open = order.filter(f => !f.resolved), at = open.indexOf(flag);
      const next = open.slice(at + 1).concat(open.slice(0, at))[0];
      if (await model.resolve(flag.id, notes[flag.id])) {
        delete notes[flag.id];
        (marked.get(next ? `note:${next.id}` : 'ready') || marked.get('summary'))?.focus?.();
      }
    }
    function flagItem(f, view, order) {
      const li = node('li', '', `studio-site-check-flag ${f.resolved ? 'is-explained' : 'is-open'}`);
      li.append(node('strong', f.message), node('span', f.where || '', 'studio-site-check-where'));
      if (f.resolved) {
        li.append(node('span', 'Explained', 'studio-chip'), node('p', `Note: ${f.resolved.note}`));
      } else if (SELF_CLEARING[f.check]) {
        li.appendChild(node('p', SELF_CLEARING[f.check], 'studio-site-check-self'));
      } else if (!view.locked) {
        const words = ANSWER[f.check] || { label: 'Why it\'s OK', button: 'Mark as OK' };
        const label = node('label', '', 'studio-site-check-note'), input = mark(node('input'), `note:${f.id}`);
        input.value = notes[f.id] || ''; input.disabled = view.busy; input.maxLength = 500;
        listen(input, 'input', () => { notes[f.id] = input.value; });
        label.append(node('span', words.label), input);
        li.append(label, mark(button(words.button, () => void resolve(f, order), { disabled: view.busy, label: `${words.button}: ${f.message}` }), `ok:${f.id}`));
      }
      return li;
    }
    const model = createSiteCheck({ service: studio.service, spaceId: ctx.spaceId, jobId: ctx.jobId, stageId: ctx.stageId,
      report(view) {
        const want = doc.activeElement?.getAttribute?.('data-focus');
        unlisten(); marked.clear(); const restore = focus();
        root.setAttribute('aria-busy', String(view.state === 'loading' || !!view.busy));
        const title = node('h2', 'Website Check');
        if (view.state !== 'ready') {
          root.replaceChildren(title, states.panel(doc, view.state === 'offline' ? 'failed' : view.state,
            view.state === 'loading' ? 'Loading the checks…' : view.message, () => void model.load()));
          restore(); return;
        }
        const c = view.checks, grouped = groups(c.flags), order = grouped.flatMap(g => g.flags);
        const open = c.flags.filter(f => !f.resolved).length, explained = c.flags.length - open;
        const top = node('div', '', 'studio-card studio-site-check-top');
        top.appendChild(node('p', c.ranAt ? `Checked ${when(c.ranAt)}` : 'Not checked yet.'));
        const summary = mark(node('p', '', 'studio-site-check-summary'), 'summary'); summary.tabIndex = -1;
        summary.append(node('span', `${open} to review`, 'studio-site-check-open'), node('span', ' · '),
          node('span', `${explained} explained`, 'studio-site-check-explained'));
        top.appendChild(summary);
        if (!view.locked) top.appendChild(mark(button(view.busy ? 'Checking…' : 'Run checks again', async () => {
          if (await model.runAgain()) marked.get('run')?.focus?.();
        }, { disabled: view.busy }), 'run'));
        const parts = [title, top];
        if (c.ranAt && !open) {
          const ready = mark(node('p', 'Ready: mark the stage done', 'studio-card studio-site-check-ready'), 'ready');
          ready.setAttribute('role', 'status'); ready.tabIndex = -1; parts.push(ready);
        }
        for (const g of grouped) {
          const box = node('section', '', 'studio-card studio-site-check-group'); box.setAttribute('aria-label', g.name);
          const list = node('ul'); for (const f of g.flags) list.appendChild(flagItem(f, view, order));
          box.append(node('h3', g.name), list); parts.push(box);
        }
        if (c.notRun.length) {
          const box = node('section', '', 'studio-card studio-site-check-group'), list = node('ul');
          for (const name of new Set(c.notRun.map(kindName))) list.appendChild(node('li', name));
          box.append(node('h3', 'Not run yet'), list, node('p', 'These run in Connect after a real sign-in.')); parts.push(box);
        }
        if (view.error) { const e = node('p', view.error); e.setAttribute('role', 'alert'); parts.push(e); }
        const history = node('section', '', 'studio-card studio-site-check-history'), log = node('ol');
        for (const entry of c.log) {
          const li = node('li'); li.append(node('strong', `${kindName(entry.check)} · ${entry.where || ''}`), node('span', entry.message),
            node('span', `Note: ${entry.note}`), node('span', when(entry.at), 'studio-site-check-where'));
          log.appendChild(li);
        }
        history.append(node('h3', 'History'), c.log.length ? log : node('p', 'Nothing explained yet.')); parts.push(history);
        root.replaceChildren(...parts);
        const keep = want && marked.get(want);
        if (keep && !keep.disabled) keep.focus?.(); else restore();
      } });
    const off = studio.service.on((event, detail) => { if (event === 'checks-changed' && detail?.jobId === ctx.jobId) void model.load(); });
    void model.load();
    return () => { off(); model.dispose(); unlisten(); root.remove(); };
  }
  return { KINDS, groups, createSiteCheck, mountCanvas };
});
