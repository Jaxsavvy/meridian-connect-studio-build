'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianStudio.registerScreen('research', { render: api.render });
})(typeof window === 'undefined' ? null : window, function () {
  // Research stage of a Pitch deck Job: run research, pick the business, check the evidence and score, finish.
  const FIELDS = Object.freeze({ rating: 'Google rating', reviews: 'Review count', website: 'Website listed', phone: 'Phone listed',
    hours: 'Hours listed', categories: 'Categories listed', photos: 'Photos', speed: 'Page speed', https: 'Secure site (https)',
    phoneLink: 'Tap-to-call link', contactForm: 'Contact form', adsPixel: 'Ads tracking', social: 'Social links',
    population: 'Population', households: 'Households', monthlySearches: 'Monthly searches' });
  const SUBJECTS = Object.freeze({ client: 'Business', competitor: 'Competitor', market: 'Market' });
  const METHODS = Object.freeze({ api: 'API', 'page-read': 'Page read', census: 'Census', person: 'Person', 'ai-estimate': 'Estimate' });
  const httpUrl = value => { try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch (_) { return false; } };

  /** One evidence record as plain text for a row; null when its source can't be shown (it becomes a gap). */
  function evidenceRow(e) {
    if (!e || typeof e !== 'object' || !e.source || !httpUrl(e.source.url)) return null;
    const subject = SUBJECTS[e.subject] || 'Other';
    const label = e.kind === 'place' ? `${subject} in the search` : `${subject}: ${FIELDS[e.field] || 'Detail'}`;
    const value = e.kind === 'google' ? 'Live from Google Maps' : e.kind === 'place' ? `Rank ${Number(e.rank) || '?'}`
      : typeof e.value === 'boolean' ? (e.value ? 'Yes' : 'No')
        : Number.isFinite(e.value) ? `${e.method === 'ai-estimate' ? '~' : ''}${e.value.toLocaleString('en-US')}` : '–';
    return { id: String(e.id), label, value, method: METHODS[e.method] || 'Other',
      source: String(e.source.label || 'Source').slice(0, 80), url: String(e.source.url), live: e.kind === 'google' };
  }

  function createResearch({ service, spaceId, jobId, report }) {
    let disposed = false, revision = 0, research = null, stage = null, busy = false, applied = null;
    function show(error = '') {
      const rows = (research.evidence || []).map(evidenceRow);
      // Google rating and review count are never stored; once the business is picked they always show as live.
      if (research.placeId && !rows.some(row => row?.live)) {
        rows.push(...['rating', 'reviews'].map(field => evidenceRow({ id: `live-${field}`, kind: 'google', subject: 'client', field,
          method: 'api', source: { label: 'Google Maps', url: 'https://www.google.com/maps' } })));
      }
      const gaps = [...(research.score?.missing || []), ...(rows.includes(null) ? ['A source could not be shown'] : [])];
      const done = research.status === 'done' && !!research.placeId;
      report({ state: 'ready', research, rows: rows.filter(Boolean), gaps, busy, error, applied,
        finished: stage?.status === 'done', canFinish: done && stage?.status === 'current' && !busy });
    }
    async function load() {
      if (disposed) return;
      const request = ++revision; if (!research) report({ state: 'loading' });
      try {
        const [next, job] = await Promise.all([service.getResearch(spaceId, jobId), service.getJob(spaceId, jobId)]);
        if (disposed || request !== revision) return;
        if (!next || job?.id !== jobId || job.spaceId !== spaceId) throw Error('Unable to open this research.');
        research = next; stage = job.stages.find(item => item.id === 'research') || null; show();
      } catch (error) {
        if (disposed || request !== revision) return;
        research = null;
        report({ state: 'failed', message: /coming soon/i.test(error?.message || '') ? error.message
          : 'Unable to open research. Check your connection and access, then try again.' });
      }
    }
    async function act(work) {
      if (disposed || busy || !research) return;
      busy = true; show();
      try { await work(); busy = false; await load(); } catch (error) { if (!disposed) { busy = false; show(error?.message || 'Try again.'); } }
    }
    return { load,
      run: category => act(() => { applied = null; return service.startResearch(spaceId, jobId, { category: String(category || '').trim() }); }),
      confirm: placeId => act(() => service.confirmMatch(spaceId, jobId, placeId)),
      apply: () => act(async () => {
        const result = await service.applyResearchToDeck(spaceId, jobId);
        applied = { ok: !!result?.ok, errors: Array.isArray(result?.errors) ? result.errors.length : 0 };
      }),
      finish: () => act(() => service.completeStage(spaceId, jobId, 'research')),
      dispose() { disposed = true; revision++; },
    };
  }

  function render(el, { spaceId, jobId }, studio) {
    const doc = el.ownerDocument, root = doc.createElement('section');
    root.className = 'studio-research'; root.setAttribute('aria-label', 'Research'); el.replaceChildren(root);
    const states = doc.defaultView?.MeridianStudioScreenStates || require('./home.js').screenStates;
    const focus = states.focus(root);
    let listeners = [], category = '';
    const listen = (item, type, fn) => { item.addEventListener(type, fn); listeners.push([item, type, fn]); };
    const unlisten = () => { for (const [item, type, fn] of listeners) item.removeEventListener?.(type, fn); listeners = []; };
    function node(tag, text, className) {
      const item = doc.createElement(tag); if (text) item.textContent = text;
      if (className) item.className = className; return item;
    }
    function button(text, action, primary, disabled) {
      const item = node('button', text, `studio-button ${primary ? 'is-primary' : 'is-secondary'}`);
      item.type = 'button'; item.disabled = !!disabled; listen(item, 'click', action); return item;
    }
    function list(title, items, make) {
      const box = node('section', '', 'studio-card'); box.appendChild(node('h2', title));
      const ul = node('ul', '', 'studio-research-list'); for (const item of items) ul.appendChild(make(item));
      box.appendChild(ul); return box;
    }
    const model = createResearch({ service: studio.service, spaceId, jobId,
      report(view) {
        unlisten(); const restore = focus();
        root.setAttribute('aria-busy', String(view.state === 'loading' || !!view.busy));
        root.replaceChildren(button('Back to Job', () => studio.navigate('work', { spaceId, jobId, stageId: 'research' })),
          node('h1', 'Research + write'));
        if (view.state !== 'ready') {
          root.appendChild(states.panel(doc, view.state, view.state === 'loading' ? 'Loading research…' : view.message, () => void model.load()));
          restore(); return;
        }
        const r = view.research, locked = view.busy || view.finished || r.status === 'running';
        const form = node('div', '', 'studio-research-run'), field = node('label'), input = node('input');
        input.value = category || r.category || ''; input.disabled = locked; input.placeholder = 'roofer';
        listen(input, 'input', () => { category = input.value; });
        field.append(node('span', 'What kind of business?'), input);
        form.append(field, button(r.status === 'not-started' ? 'Run research' : 'Run again', () => void model.run(input.value), true, locked));
        root.appendChild(form);
        const status = node('p', { 'not-started': 'Research hasn\'t run yet.', running: 'Research is running…',
          'needs-match': 'More than one business could match. Pick the right one.', done: 'Research is done.',
          failed: 'Research couldn\'t finish. Check the category and run it again.' }[r.status] || '');
        status.setAttribute('role', r.status === 'failed' ? 'alert' : 'status'); root.appendChild(status);
        if (r.status === 'needs-match') {
          root.appendChild(list('Which business is it?', r.candidates || [], c => {
            const li = node('li'); li.append(node('strong', c.name), node('span', c.address),
              button('This one', () => void model.confirm(c.placeId), false, view.busy)); return li;
          }));
        }
        if (view.rows.length) {
          root.appendChild(list('Evidence', view.rows, row => {
            const li = node('li', '', 'studio-research-row'), link = node('a', row.source);
            link.href = row.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
            li.append(node('strong', row.label), node('span', row.value), node('span', row.method, 'studio-chip'), link);
            if (row.live) li.appendChild(node('span', 'Google Maps', 'studio-research-credit'));
            return li;
          }));
        }
        if (r.score) {
          const score = list(`Score: ${r.score.value} of 100${r.score.band ? ` (${r.score.band})` : ''}`, r.score.parts || [],
            part => node('li', `${part.name}: ${part.points} of ${part.max}`));
          root.appendChild(score);
        }
        if (view.gaps.length) root.appendChild(list('Couldn\'t find', view.gaps, gap => node('li', gap)));
        const actions = node('div', '', 'studio-research-actions'), ready = r.status === 'done' && !view.finished;
        actions.append(button('Use this research', () => void model.apply(), false, !ready || view.busy),
          button('Finish Research + write', () => void model.finish(), true, !view.canFinish));
        root.appendChild(actions);
        if (view.applied) {
          root.appendChild(node('p', view.applied.ok ? 'Research is in the deck. Edit the words on the Pitch Deck page, then finish.'
            : `The deck still has ${view.applied.errors} thing(s) to fix on the Pitch Deck page.`));
        }
        if (view.finished) root.appendChild(node('p', 'Research + write is finished.', 'studio-chip'));
        if (view.error) { const error = node('p', view.error); error.setAttribute('role', 'alert'); root.appendChild(error); }
        restore();
      } });
    const off = studio.service.on((event, detail) => {
      if (event === 'research-changed' && detail?.spaceId === spaceId && detail?.jobId === jobId) void model.load();
    });
    void model.load(); return () => { off(); model.dispose(); unlisten(); root.remove(); };
  }
  return { evidenceRow, createResearch, render };
});
