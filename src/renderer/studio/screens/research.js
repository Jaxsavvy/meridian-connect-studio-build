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
  // What a person can type in (research-model.js). Never Google rating or review count: those show live from Google Maps.
  const BOTH = Object.freeze(['client', 'competitor']), MARKET = Object.freeze(['market']);
  const fact = (kind, field, label, subjects, type) => Object.freeze({ id: field ? `${kind}:${field}` : kind, kind, field, label, subjects, type });
  const HAND_FACTS = Object.freeze([
    fact('place', undefined, 'A business in the local search (place ID + rank)', BOTH, 'place'),
    ...['website', 'phone', 'hours', 'categories', 'photos'].map(f => fact('profile', f, `Google profile: ${FIELDS[f]}`, BOTH, 'yes-no')),
    fact('website', 'speed', 'Website: Page speed (0-100)', BOTH, 'number'),
    ...['https', 'phoneLink', 'contactForm', 'adsPixel', 'social'].map(f => fact('website', f, `Website: ${FIELDS[f]}`, BOTH, 'yes-no')),
    ...['population', 'households'].map(f => fact('census', f, `Census: ${FIELDS[f]}`, MARKET, 'number')),
    fact('demand', 'monthlySearches', 'Demand: Monthly searches', MARKET, 'number'),
  ]);

  /** A typed-in fact from the form, ready for addEvidence; throws a plain message when something is missing. */
  function buildFact(draft) {
    const what = HAND_FACTS.find(f => f.id === draft.what);
    if (!what || !what.subjects.includes(draft.subject)) throw Error('Pick what the fact is and who it\'s about.');
    const label = String(draft.label || '').trim(), url = String(draft.url || '').trim();
    if (!label || !url) throw Error('Add the source name and its link.');
    const out = { kind: what.kind, subject: draft.subject, source: { label, url } };
    if (what.type === 'place' || draft.subject === 'competitor') out.placeId = String(draft.placeId || '').trim();
    if (what.type === 'place') return { ...out, rank: Number(draft.rank) };
    if (what.type === 'yes-no') return { ...out, field: what.field, value: draft.yes !== 'no' };
    const value = String(draft.value || '').trim() === '' ? NaN : Number(draft.value);
    if (!Number.isFinite(value)) throw Error('Type the number you found.');
    return { ...out, field: what.field, value };
  }

  /** One evidence record as plain text for a row; null when its source can't be shown (it becomes a gap). */
  function evidenceRow(e) {
    if (!e || typeof e !== 'object' || !e.source || !httpUrl(e.source.url)) return null;
    const subject = SUBJECTS[e.subject] || 'Other';
    const label = e.kind === 'place' ? `${subject} in the search` : `${subject}: ${FIELDS[e.field] || 'Detail'}`;
    const value = e.kind === 'google' ? 'Live from Google Maps' : e.kind === 'place' ? `Rank ${Number(e.rank) || '?'}`
      : typeof e.value === 'boolean' ? (e.value ? 'Yes' : 'No')
        : Number.isFinite(e.value) ? `${e.method === 'ai-estimate' ? '~' : ''}${e.value.toLocaleString('en-US')}` : '–';
    return { id: String(e.id), label, value, method: METHODS[e.method] || 'Other', removable: e.method === 'person',
      source: String(e.source.label || 'Source').slice(0, 80), url: String(e.source.url), live: e.kind === 'google' };
  }

  function createResearch({ service, spaceId, jobId, report }) {
    let disposed = false, revision = 0, research = null, stage = null, busy = false, applied = null, names = {};
    function show(error = '') {
      const rows = (research.evidence || []).map(evidenceRow);
      // Google rating and review count are never stored; once the business is picked they always show as live.
      if (research.placeId && !rows.some(row => row?.live)) {
        rows.push(...['rating', 'reviews'].map(field => evidenceRow({ id: `live-${field}`, kind: 'google', subject: 'client', field,
          method: 'api', source: { label: 'Google Maps', url: 'https://www.google.com/maps' } })));
      }
      // NO-GOOGLE: what the website research couldn't check (meridian-27's missing list) shows with the rest.
      const gaps = [...(research.missing || []), ...(research.score?.missing || []), ...(rows.includes(null) ? ['A source could not be shown'] : [])];
      const done = research.status === 'done' && (!!research.placeId || research.source === 'web');   // web research: the business is known by its website
      // Google names aren't stored, so a person types each competitor's name for the deck.
      const competitors = (research.evidence || []).filter(e => e?.kind === 'place' && e.subject === 'competitor' && e.placeId)
        .map(e => ({ placeId: String(e.placeId), rank: Number(e.rank) || 0 })).sort((a, b) => a.rank - b.rank);
      report({ state: 'ready', research, rows: rows.filter(Boolean), gaps, busy, error, applied, competitors, names: { ...names },
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
      if (disposed || busy || !research) return false;
      busy = true; show();
      try { await work(); busy = false; await load(); return true; } catch (error) {
        if (!disposed) { busy = false; show(error?.message || 'Try again.'); }
        return false;
      }
    }
    return { load,
      run: category => act(() => { applied = null; return service.startResearch(spaceId, jobId, { category: String(category || '').trim() }); }),
      confirm: placeId => act(() => service.confirmMatch(spaceId, jobId, placeId)),
      // onSaved runs after the service accepts the fact and before the screen redraws.
      addFact: (draft, onSaved) => act(async () => { await service.addEvidence(spaceId, jobId, buildFact(draft)); onSaved?.(); }),
      removeFact: id => act(() => service.removeEvidence(spaceId, jobId, id)),
      setName(placeId, name) { if (!disposed) names[placeId] = String(name).slice(0, 60); },
      apply: () => act(async () => {
        const typed = Object.fromEntries(Object.entries(names).map(([id, name]) => [id, name.trim()]).filter(([, name]) => name));
        const result = await service.applyResearchToDeck(spaceId, jobId, { names: typed });
        applied = { ok: !!result?.ok, errors: Array.isArray(result?.errors) ? result.errors.length : 0 };
      }),
      finish: () => act(() => service.completeStage(spaceId, jobId, 'research')),
      dispose() { disposed = true; revision++; },
    };
  }

  function render(el, { spaceId, jobId }, studio) {
    const doc = el.ownerDocument, root = doc.createElement('section');
    const soon = id => Array.isArray(studio.service?.soon) && studio.service.soon.includes(id);   // AUDIT 2026-10-29: not on the real server yet: greyed, says soon
    root.className = 'studio-research'; root.setAttribute('aria-label', 'Research'); el.replaceChildren(root);
    const states = doc.defaultView?.MeridianStudioScreenStates || require('./home.js').screenStates;
    const focus = states.focus(root);
    let listeners = [], category = '';
    // The "Add a fact" draft lives here so typing survives each redraw; the source stays for the next fact.
    const draft = { what: 'place', subject: 'client', value: '', yes: 'yes', placeId: '', rank: '', label: '', url: '' };
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
    function control(tag, label, key, attrs = {}) {
      const wrap = node('label', '', 'studio-research-field'), item = node(tag);
      Object.assign(item, attrs); if (tag !== 'select') item.value = draft[key];
      listen(item, tag === 'select' ? 'change' : 'input', () => { draft[key] = item.value; sync(); });
      wrap.append(node('span', label), item); return { wrap, item };
    }
    let sync = () => {};
    function factForm(locked) {
      const box = node('fieldset', '', 'studio-card studio-research-form'); box.appendChild(node('legend', 'Add a fact'));
      const what = control('select', 'What is it?', 'what'), subject = control('select', 'Who is it about?', 'subject');
      for (const f of HAND_FACTS) { const option = node('option', f.label); option.value = f.id; what.item.appendChild(option); }
      const yes = control('select', 'Yes or no', 'yes'), value = control('input', 'Number', 'value', { type: 'number', min: 0, step: 'any' });
      for (const [v, t] of [['yes', 'Yes'], ['no', 'No']]) { const option = node('option', t); option.value = v; yes.item.appendChild(option); }
      const placeId = control('input', 'Google place ID', 'placeId'), rank = control('input', 'Rank in the local search', 'rank', { type: 'number', min: 1, step: 1 });
      const label = control('input', 'Source name', 'label', { maxLength: 120 }), url = control('input', 'Source link (https://…)', 'url', { type: 'url' });
      const fields = [what, subject, yes, value, placeId, rank, label, url];
      for (const f of fields) f.item.disabled = locked;
      sync = () => {
        const kind = HAND_FACTS.find(f => f.id === draft.what) || HAND_FACTS[0];
        if (!kind.subjects.includes(draft.subject)) draft.subject = kind.subjects[0];
        subject.item.replaceChildren(...kind.subjects.map(s => { const o = node('option', SUBJECTS[s]); o.value = s; return o; }));
        what.item.value = kind.id; subject.item.value = draft.subject; yes.item.value = draft.yes;
        yes.wrap.hidden = kind.type !== 'yes-no'; value.wrap.hidden = kind.type !== 'number';
        value.item.max = kind.field === 'speed' ? 100 : '';
        placeId.wrap.hidden = !(kind.type === 'place' || draft.subject === 'competitor'); rank.wrap.hidden = kind.type !== 'place';
      };
      sync();
      box.append(...fields.map(f => f.wrap), button('Add fact', () => void model.addFact({ ...draft },
        () => Object.assign(draft, { value: '', placeId: '', rank: '' })), true, locked));
      return box;
    }
    function namesForm(view, locked) {
      const box = node('section', '', 'studio-card'), ul = node('ul', '', 'studio-research-list');
      box.append(node('h2', 'Competitor names'), node('p', 'Type each name as it shows on Google. Google names aren\'t saved, so the deck uses yours.'), ul);
      for (const c of view.competitors) {
        const li = node('li'), field = node('label', '', 'studio-research-field'), input = node('input');
        input.value = view.names[c.placeId] || ''; input.maxLength = 60; input.disabled = locked;
        listen(input, 'input', () => model.setName(c.placeId, input.value));
        field.append(node('span', `Competitor at rank ${c.rank || '?'}`), input); li.appendChild(field); ul.appendChild(li);
      }
      return box;
    }
    const model = createResearch({ service: studio.service, spaceId, jobId,
      report(view) {
        unlisten(); const restore = focus();
        root.setAttribute('aria-busy', String(view.state === 'loading' || !!view.busy));
        // U-D7: Research only belongs to a Pitch deck Job, so "Back to Job" returns to its own Job screen.
        root.replaceChildren(button('Back to Job', () => studio.navigate('pitch-deck', { spaceId, jobId, open: 'research' })),
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
        form.append(field, button((view.busy ? 'Researching… (up to a minute)' : ['not-started', 'by-hand'].includes(r.status) ? 'Run research' : 'Run again') + (soon('startResearch') ? ' (soon)' : ''), () => void model.run(input.value), true, locked || soon('startResearch')));
        root.appendChild(form);
        const status = node('p', { 'not-started': 'Research hasn\'t run yet.', running: 'Research is running…',
          'needs-match': 'More than one business could match. Pick the right one.', done: 'Research is done.',
          'by-hand': 'Type in the facts you found. Add the business\'s own Google place to confirm it.',
          failed: 'Research couldn\'t finish. Check the category and run it again.' }[r.status] || '');
        status.setAttribute('role', r.status === 'failed' ? 'alert' : 'status'); root.appendChild(status);
        if (r.status === 'needs-match') {
          root.appendChild(list('Which business is it?', r.candidates || [], c => {
            const li = node('li'); li.append(node('strong', c.name), node('span', c.address),
              button('This one', () => void model.confirm(c.placeId), false, view.busy || soon('confirmMatch'))); return li;
          }));
        }
        if (view.rows.length) {
          root.appendChild(list('Evidence', view.rows, row => {
            const li = node('li', '', 'studio-research-row'), link = node('a', row.source);
            link.href = row.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
            li.append(node('strong', row.label), node('span', row.value), node('span', row.method, 'studio-chip'), link);
            if (row.live) li.appendChild(node('span', 'Google Maps', 'studio-research-credit'));
            if (row.removable) {   // only facts a person typed in; the agent's stay
              const remove = button('Remove', () => void model.removeFact(row.id), false, view.busy || view.finished);
              remove.setAttribute('aria-label', `Remove ${row.label}`); li.appendChild(remove);
            }
            return li;
          }));
        }
        const handLocked = view.busy || view.finished || ['running', 'needs-match'].includes(r.status);
        root.appendChild(factForm(handLocked));
        if (view.competitors.length) root.appendChild(namesForm(view, view.busy || view.finished));
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
