'use strict';
// Copywriter (#105, Kickoff): the Website Job's first stage gets its brief form. Goal, Audience, Main call to action,
// Pages wanted (add/remove) and Must-have content; Save stores them on the Job (service.saveStageNotes); "Ask Meridian
// for a summary" shows Meridian's draft (service.draftCopy: the server in real mode, sample words only in practice) and
// changes Goal only on "Use this". Read-only once the stage is finished or waiting on Jax. Data only through the service.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.MeridianStudio) { root.MeridianCopywriter = api; root.MeridianStudio.registerTool('copywriter', { mountCanvas: api.mountCanvas }); }
})(typeof window === 'undefined' ? null : window, function () {
  const FIELDS = [['goal', 'Goal', 'What should the site get people to do, and why?'], ['audience', 'Audience', 'Who is it for?'],
    ['callToAction', 'Main call to action', 'e.g. Book a free estimate'], ['mustHave', 'Must-have content', 'Services, proof, photos, anything that has to be there']];
  const OUTSIDE = 'Open Copywriter from a Website Job\'s Kickoff stage.';
  const empty = () => ({ goal: '', audience: '', callToAction: '', pages: [], mustHave: '' });
  const clean = n => ({ goal: String(n?.goal || ''), audience: String(n?.audience || ''), callToAction: String(n?.callToAction || ''),
    pages: Array.isArray(n?.pages) ? n.pages.map(String) : [], mustHave: String(n?.mustHave || '') });
  const asText = n => [n.goal, n.audience, n.callToAction, n.pages.join(', '), n.mustHave].filter(Boolean).join('\n');
  const failure = error => (error && error.message ? error.message : 'Copywriter could not do that. Try again.');

  /** The logic, without the page (tests drive this). onChange(snapshot) after every change; onDirty(bool). */
  function createCopywriter({ spaceId, jobId, stageId, service, onChange = () => {}, onDirty = () => {} }) {
    const state = { phase: 'loading', notes: empty(), dirty: false, saving: false, drafting: false, draft: null, error: '', message: '' };
    let closed = false, load = 0, off = null;
    const snapshot = () => ({ ...state, notes: { ...state.notes, pages: [...state.notes.pages] } });
    const notify = () => { if (!closed) onChange(snapshot()); };
    const setDirty = value => { if (state.dirty !== value) { state.dirty = value; onDirty(value); } };
    const locked = job => Boolean(job && (job.done?.includes('brief') || (job.stageId === 'brief' && job.waitingOnJax)));

    async function start() {
      if (!jobId || stageId !== 'brief') { state.phase = 'outside'; state.message = OUTSIDE; return notify(); }
      const at = ++load;
      state.phase = state.phase === 'ready' || state.phase === 'locked' ? state.phase : 'loading'; state.error = ''; notify();
      try {
        const [job, notes] = await Promise.all([service.getJob(spaceId, jobId), service.getStageNotes(spaceId, jobId, 'brief')]);
        if (closed || at !== load) return;
        if (job.workflowId && job.workflowId !== 'website') { state.phase = 'outside'; state.message = OUTSIDE; return notify(); }
        state.notes = clean(notes);
        state.phase = locked(job) ? 'locked' : 'ready';
        state.message = state.phase === 'locked' ? 'This stage is finished.' : '';
        setDirty(false);
      } catch (error) {
        if (closed || at !== load) return;
        state.phase = 'failed'; state.error = failure(error);
      }
      notify();
    }
    function edit(field, value) {
      if (state.phase !== 'ready' || !['goal', 'audience', 'callToAction', 'mustHave'].includes(field)) return;
      state.notes[field] = String(value); setDirty(true); notify();
    }
    function addPage(name) {
      const page = String(name || '').trim();
      if (state.phase !== 'ready' || !page || state.notes.pages.length >= 20 || state.notes.pages.includes(page)) return false;
      state.notes.pages.push(page.slice(0, 80)); setDirty(true); notify(); return true;
    }
    function removePage(index) {
      if (state.phase !== 'ready' || !state.notes.pages[index]) return;
      state.notes.pages.splice(index, 1); setDirty(true); notify();
    }
    async function save() {
      if (state.phase !== 'ready' || state.saving) return false;
      state.saving = true; state.error = ''; notify();
      try {
        state.notes = clean(await service.saveStageNotes(spaceId, jobId, 'brief', snapshot().notes));
        setDirty(false); state.message = 'Saved.';
        return true;
      } catch (error) {
        state.error = failure(error);
        return false;
      } finally { state.saving = false; notify(); }
    }
    async function askSummary() {
      if (state.phase !== 'ready' || state.drafting) return;
      state.drafting = true; state.error = ''; state.draft = null; notify();
      try {
        const out = await service.draftCopy({ spaceId, jobId, kind: 'brief-summary', input: { notes: asText(state.notes) } });
        if (!closed) state.draft = typeof out?.draft === 'string' ? out.draft : null;
      } catch (error) {
        state.error = failure(error);
      } finally { state.drafting = false; notify(); }
    }
    function useDraft() {
      if (state.phase !== 'ready' || typeof state.draft !== 'string') return;
      state.notes.goal = state.draft.slice(0, 2000); state.draft = null; setDirty(true); notify();
    }
    function discardDraft() { state.draft = null; notify(); }
    if (typeof service.on === 'function') {
      off = service.on((event, detail) => {   // someone else saved: reload, unless there are unsaved edits here
        if (event === 'stage-notes-changed' && detail && detail.jobId === jobId && detail.stageId === 'brief' && !state.dirty && !state.saving) start();
        if (event === 'jobs-changed' && !state.dirty) start();
      });
    }
    function dispose() { closed = true; if (off) off(); off = null; }
    return { start, edit, addPage, removePage, save, askSummary, useDraft, discardDraft, dispose, snapshot };
  }

  /** The page: plain labelled fields (screens/theme.css classes); Jax and Claude style it later. */
  function mountCanvas(el, { spaceId, jobId, stageId, studio }) {
    const doc = el.ownerDocument;
    const node = (tag, text, cls) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
    const button = (label, action, cls) => { const b = node('button', label, cls); b.type = 'button'; b.addEventListener('click', action); return b; };
    const section = node('section', undefined, 'copywriter'); section.setAttribute('aria-label', 'Copywriter');
    el.replaceChildren(section);
    const model = createCopywriter({ spaceId, jobId, stageId, service: studio.service, onDirty: v => studio.setDirty(v), onChange: render });
    let focusField = null;
    function field(key, label, hint, value, readOnly) {
      const wrap = node('label', undefined, 'copywriter-field'), title = node('span', label), input = node(key === 'goal' || key === 'mustHave' ? 'textarea' : 'input');
      input.value = value; input.placeholder = hint; input.disabled = readOnly; input.dataset.field = key;
      if (input.tagName === 'TEXTAREA') input.rows = 3;
      input.addEventListener('input', () => { focusField = key; model.edit(key, input.value); });
      wrap.append(title, input); return wrap;
    }
    function render(s) {
      const parts = [node('h2', 'Kickoff brief')];
      if (s.phase === 'loading') parts.push(node('p', 'Loading the brief…'));
      else if (s.phase === 'outside') parts.push(node('p', s.message));
      else if (s.phase === 'failed') parts.push(node('p', s.error, 'copywriter-error'), button('Try again', () => model.start()));
      else {
        const readOnly = s.phase === 'locked' || s.saving;
        if (s.phase === 'locked') parts.push(node('p', s.message, 'copywriter-note'));
        for (const [key, label, hint] of FIELDS.slice(0, 3)) parts.push(field(key, label, hint, s.notes[key], readOnly));
        const pages = node('fieldset', undefined, 'copywriter-pages'); pages.append(node('legend', 'Pages wanted'));
        const list = node('ul');
        s.notes.pages.forEach((p, i) => { const li = node('li'); li.append(node('span', p)); if (!readOnly) li.append(button('Remove', () => model.removePage(i))); list.append(li); });
        pages.append(list);
        if (!readOnly) {
          const add = node('input'); add.placeholder = 'Add a page (e.g. Services)'; add.setAttribute('aria-label', 'Page name');
          const go = () => { if (model.addPage(add.value)) { add.value = ''; focusField = 'add-page'; } };
          add.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
          add.dataset.field = 'add-page'; pages.append(add, button('Add page', go));
        }
        parts.push(pages, field('mustHave', FIELDS[3][1], FIELDS[3][2], s.notes.mustHave, readOnly));
        if (s.phase === 'ready') {
          const actions = node('div', undefined, 'copywriter-actions');
          const save = button(s.saving ? 'Saving…' : 'Save', () => model.save(), 'primary'); save.disabled = s.saving || !s.dirty;
          const ask = button(s.drafting ? 'Asking Meridian…' : 'Ask Meridian for a summary', () => model.askSummary()); ask.disabled = s.drafting;
          actions.append(save, ask); parts.push(actions);
          if (typeof s.draft === 'string') {
            const box = node('div', undefined, 'copywriter-draft'); box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Meridian\'s summary');
            box.append(node('p', 'Meridian suggests this Goal:'), node('blockquote', s.draft), button('Use this', () => model.useDraft(), 'primary'), button('Discard', () => model.discardDraft()));
            parts.push(box);
          }
        }
        const status = node('p', s.error || (s.dirty ? 'Unsaved changes' : s.message || ''), s.error ? 'copywriter-error' : 'copywriter-status');
        status.setAttribute('role', s.error ? 'alert' : 'status'); parts.push(status);
      }
      section.replaceChildren(...parts);
      if (focusField) { const again = section.querySelector(`[data-field="${focusField}"]`); if (again) { again.focus(); if (again.value !== undefined && again.setSelectionRange) again.setSelectionRange(again.value.length, again.value.length); } }
    }
    model.start();
    return () => { model.dispose(); studio.setDirty(false); el.replaceChildren(); };
  }

  return { createCopywriter, mountCanvas, OUTSIDE };
});
