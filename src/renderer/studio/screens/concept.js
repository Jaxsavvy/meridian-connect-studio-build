'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianStudio.registerTool('concept', { mountCanvas: api.mountCanvas });
})(typeof window === 'undefined' ? null : window, function () {
  // Concept screen (#232): the big idea the site is built around. Draft with Meridian, Save, then the stage bar sends it to Jax.
  const MOOD = /^[A-Za-z][A-Za-z -]*$/;
  const blank = () => ({ line: '', audience: '', goal: '', references: [0, 1, 2].map(() => ({ url: '', note: '' })), mood: [] });
  // The form always has three reference rows, whatever the service holds.
  const toForm = c => ({ ...blank(), ...c, references: [0, 1, 2].map(i => ({ url: c?.references?.[i]?.url || '', note: c?.references?.[i]?.note || '' })),
    mood: Array.isArray(c?.mood) ? [...c.mood] : [] });

  function createConceptForm({ service, spaceId, jobId, stageId, report, onDirty = () => {}, gapsOf = () => [] }) {
    let disposed = false, revision = 0, form = null, gaps = [], locked = null, busy = false, dirty = false, note = '', saved = false;
    const setDirty = value => { if (value !== dirty) { dirty = value; onDirty(value); } };
    const show = (error = '') => report({ state: 'ready', form, gaps, locked, busy, dirty, note, saved, error });
    async function load() {
      if (disposed || dirty) return;   // never replace unsaved work
      const request = ++revision; if (!form) report({ state: 'loading' });
      if (stageId !== 'concept') { report({ state: 'empty', message: 'The Concept opens at the Concept stage.' }); return; }
      try {
        const job = await service.getJob(spaceId, jobId);
        if (disposed || request !== revision) return;
        if (job?.id !== jobId || job.spaceId !== spaceId) throw Error('Unavailable');
        if (job.workflowId !== 'website') { report({ state: 'empty', message: 'Only Website Jobs have a concept.' }); return; }
        const concept = await service.getConcept(spaceId, jobId);
        if (disposed || request !== revision || dirty) return;
        const stage = (job.stages || []).find(st => st.id === 'concept');
        locked = stage?.status === 'done' ? 'Approved' : stage?.status === 'waiting-on-jax' ? 'With Jax' : null;
        form = toForm(concept); gaps = gapsOf(concept); show();
      } catch (error) {
        if (disposed || request !== revision) return;
        report(error?.code === 'OFFLINE' ? { state: 'offline', message: 'You are offline. Try again when connected.' }
          : { state: 'failed', message: 'Unable to open the Concept. Check your connection and access, then try again.' });
      }
    }
    const editable = () => !disposed && !busy && !locked && !!form;
    return { load,
      /** Typing changes the form without a redraw, so the cursor stays put. */
      edit(change) { if (!editable()) return false; change(form); saved = false; setDirty(true); return true; },
      addMood(word) {
        const w = String(word || '').trim().toLowerCase();
        if (!editable() || !w) return false;
        if (!MOOD.test(w)) { show('Mood words: letters, spaces and dashes only.'); return false; }
        if (form.mood.length >= 6) { show('Six mood words at most.'); return false; }
        if (!form.mood.includes(w)) form.mood.push(w);
        saved = false; setDirty(true); show(); return true;
      },
      removeMood(word) { if (editable()) { form.mood = form.mood.filter(w => w !== word); saved = false; setDirty(true); show(); } },
      async draft() {
        if (!editable()) return false;
        busy = true; note = ''; show();
        try {
          const result = await service.draftConcept(spaceId, jobId);
          if (disposed) return false;
          busy = false;
          const d = result?.draft || {};
          // Fills the form only; nothing is saved. Meridian leaves the reference sites empty, so the lead's rows stay.
          form = { ...form, line: d.line || '', audience: d.audience || '', goal: d.goal || '', mood: Array.isArray(d.mood) ? d.mood.slice(0, 6) : form.mood,
            references: d.references?.length ? toForm(d).references : form.references };
          note = 'Meridian\'s draft: check it, add the reference sites, then Save.'; saved = false; setDirty(true); show(); return true;
        } catch (error) { if (!disposed) { busy = false; show(error?.message || 'Meridian couldn\'t draft this. Try again.'); } return false; }
      },
      async save() {
        if (!editable()) return false;
        busy = true; show();
        try {
          const result = await service.saveConcept(spaceId, jobId, {
            line: form.line, audience: form.audience, goal: form.goal, mood: form.mood, references: form.references.filter(r => r.url.trim() || r.note.trim()) });
          if (disposed) return false;
          busy = false;
          if (!result?.ok) { show(result?.errors?.[0]?.message || 'The concept could not be saved. Try again.'); return false; }
          form = toForm(result.concept); gaps = Array.isArray(result.errors) ? result.errors : []; note = ''; saved = true; setDirty(false); show(); return true;
        } catch (error) { if (!disposed) { busy = false; show(error?.message || 'The concept could not be saved. Try again.'); } return false; }
      },
      dispose() { disposed = true; revision++; setDirty(false); },
    };
  }

  function mountCanvas(el, ctx) {
    const studio = ctx.studio || {}, doc = el.ownerDocument, win = doc.defaultView, root = doc.createElement('section');
    root.className = 'studio-concept'; root.setAttribute('aria-label', 'Concept'); el.replaceChildren(root);
    const states = win?.MeridianStudioScreenStates || require('./home.js').screenStates;
    const Concept = win?.MeridianConcept || require('../website/concept.js'), LIMITS = Concept.LIMITS;
    const focus = states.focus(root), marked = new Map();
    let listeners = [], focusNext = null;
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
    // A labelled one-line field; typing edits the model without a redraw.
    function field(view, name, value, max, id, onInput, hint) {
      const label = node('label', '', 'studio-concept-field'), input = mark(node('input'), id);
      input.value = value; input.maxLength = max; input.disabled = !!view.busy;
      listen(input, 'input', () => model.edit(f => onInput(f, input.value)));
      label.append(node('span', name), input);
      if (hint) label.appendChild(node('span', hint, 'studio-concept-hint'));
      return label;
    }
    const needed = (gaps, key) => gaps.filter(g => g.field === key).map(g => node('p', `Still needed: ${g.message}`, 'studio-concept-needed'));
    function readOnly(view) {
      const f = view.form, list = node('dl', '', 'studio-concept-read');
      list.append(node('dt', 'Concept line'), node('dd', f.line || '–'), node('dt', 'Audience'), node('dd', f.audience || '–'),
        node('dt', 'One goal'), node('dd', f.goal || '–'), node('dt', 'Reference sites'));
      const refs = node('dd'), ul = node('ul');
      for (const r of f.references.filter(x => x.url || x.note)) { const li = node('li'); li.append(node('span', r.url, 'studio-concept-url'), node('span', r.note)); ul.appendChild(li); }
      refs.appendChild(ul.children.length ? ul : node('span', '–')); list.append(refs, node('dt', 'Mood words'), node('dd', f.mood.join(', ') || '–'));
      return list;
    }
    function form(view) {
      const f = view.form, parts = [];
      parts.push(field(view, 'Concept line', f.line, LIMITS.line, 'line', (c, v) => { c.line = v; }, 'Name it as a place or feeling, like \'a roof that shrugs off the rain\'.'), ...needed(view.gaps, 'line'));
      parts.push(field(view, 'Audience', f.audience, LIMITS.audience, 'audience', (c, v) => { c.audience = v; }), ...needed(view.gaps, 'audience'));
      parts.push(field(view, 'One goal', f.goal, LIMITS.goal, 'goal', (c, v) => { c.goal = v; }), ...needed(view.gaps, 'goal'));
      const refs = node('fieldset', '', 'studio-concept-refs'); refs.appendChild(node('legend', '3 reference sites'));
      f.references.forEach((r, i) => {
        const row = node('div', '', 'studio-concept-ref');
        row.append(field(view, `Site ${i + 1} link (https://)`, r.url, LIMITS.url, `ref-url-${i}`, (c, v) => { c.references[i].url = v; }),
          field(view, `What we like about site ${i + 1}`, r.note, LIMITS.note, `ref-note-${i}`, (c, v) => { c.references[i].note = v; }));
        refs.appendChild(row);
      });
      parts.push(refs, ...needed(view.gaps, 'references'));
      const mood = node('fieldset', '', 'studio-concept-mood'); mood.appendChild(node('legend', 'Mood words (3 to 6)'));
      const words = node('ul');
      for (const w of f.mood) {
        const li = node('li'); li.append(node('span', w), button('Remove', () => { focusNext = 'mood-input'; model.removeMood(w); }, { label: `Remove ${w}`, disabled: view.busy, focus: `remove-${f.mood.indexOf(w)}` }));
        words.appendChild(li);
      }
      const add = node('label', '', 'studio-concept-field'), input = mark(node('input'), 'mood-input');
      input.maxLength = LIMITS.word; input.disabled = view.busy || f.mood.length >= 6;
      listen(input, 'keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault?.(); focusNext = 'mood-input'; if (model.addMood(input.value)) input.value = '';
      });
      add.append(node('span', 'Add a mood word, then press Enter'), input);
      mood.append(words, add); parts.push(mood, ...needed(view.gaps, 'mood'));
      return parts;
    }
    const model = createConceptForm({ service: studio.service, spaceId: ctx.spaceId, jobId: ctx.jobId, stageId: ctx.stageId,
      onDirty: value => studio.setDirty?.(value), gapsOf: concept => Concept.conceptGaps(concept),
      report(view) {
        const want = focusNext || doc.activeElement?.getAttribute?.('data-focus'); focusNext = null;
        unlisten(); marked.clear(); const restore = focus();
        root.setAttribute('aria-busy', String(view.state === 'loading' || !!view.busy));
        const title = node('h2', 'Concept');
        if (view.state !== 'ready') {
          root.replaceChildren(title, states.panel(doc, view.state === 'offline' ? 'failed' : view.state,
            view.state === 'loading' ? 'Loading the concept…' : view.message, () => void model.load()));
          restore(); return;
        }
        const parts = [title, node('p', 'The big idea the whole site is built around. Jax approves it before Story starts.')];
        if (view.locked) {
          const status = node('p', view.locked, 'studio-concept-locked'); status.setAttribute('role', 'status');
          parts.push(status, readOnly(view));
        } else {
          parts.push(button(view.busy ? 'Working…' : 'Draft with Meridian', async () => { if (await model.draft()) focusTo('line'); }, { focus: 'draft', disabled: view.busy }));
          if (view.note) { const n = node('p', view.note, 'studio-concept-note'); n.setAttribute('role', 'status'); parts.push(n); }
          parts.push(...form(view));
          const actions = node('div', '', 'studio-concept-actions'), status = node('span', view.dirty ? 'Unsaved changes' : '', 'studio-concept-status');
          status.setAttribute('role', 'status');
          actions.append(button(view.busy ? 'Saving…' : 'Save', async () => { await model.save(); focusTo('save'); }, { primary: true, focus: 'save', disabled: view.busy }), status);
          parts.push(actions);
          if (!view.gaps.length) { const ready = node('p', 'Ready to send to Jax', 'studio-concept-ready'); ready.setAttribute('role', 'status'); parts.push(ready); }
          else if (view.saved) {
            const box = node('section', '', 'studio-card studio-concept-gaps'); box.setAttribute('aria-label', 'Still needed');
            const ul = node('ul'); for (const g of view.gaps) ul.appendChild(node('li', g.message));
            box.append(node('h3', 'Still needed'), ul); parts.push(box);
          }
        }
        if (view.error) { const e = node('p', view.error); e.setAttribute('role', 'alert'); parts.push(e); }
        root.replaceChildren(...parts);
        // With six words the box is full and disabled, so focus goes to the newest word's Remove button.
        const keep = want && marked.get(want), fallback = want === 'mood-input' ? marked.get(`remove-${view.form ? view.form.mood.length - 1 : 0}`) : null;
        if (keep && !keep.disabled) keep.focus?.(); else if (fallback) fallback.focus?.(); else restore();
      } });
    const focusTo = id => { const t = marked.get(id); if (t && !t.disabled) t.focus?.(); };
    const off = studio.service.on((event, detail) => { if (event === 'concept-changed' && detail?.jobId === ctx.jobId) void model.load(); });
    void model.load();
    return () => { off(); model.dispose(); unlisten(); root.remove(); };
  }
  return { createConceptForm, mountCanvas };
});
