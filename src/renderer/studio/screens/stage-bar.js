'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianStudio.registerPart('stage-bar', { mount: api.mount });
})(typeof window === 'undefined' ? null : window, function () {
  function createStageBar({ service, spaceId, jobId, report, onStage = () => {} }) {
    let disposed = false, revision = 0, job = null, busy = false, saving = null;
    function show(error = '') { report({ state: 'ready', job, busy, saving, error }); }
    async function load() {
      if (disposed) return;
      // Reloads keep the screen (and the box someone just ticked) instead of flashing "Loading".
      const request = ++revision; if (!job) report({ state: 'loading', busy });
      try {
        const next = await service.getJob(spaceId, jobId);
        if (disposed || request !== revision) return;
        if (!next || next.spaceId !== spaceId || next.id !== jobId) throw Error('Job unavailable');
        job = next; show(); onStage(job);
      } catch (_) {
        if (!disposed && request === revision) job = null;
        if (!disposed && request === revision) report({ state: 'failed', message: 'Unable to load this Job. Check your connection and access, then try again.' });
      }
    }
    const off = service.on((event, detail) => { if (event === 'jobs-changed' && detail?.spaceId === spaceId) void load(); });
    return { load,
      /** Saves one "This stage needs" tick on the Job; on failure the box shows its saved value again. */
      async tick(index, checked) {
        if (disposed || !job || busy || saving !== null || job.waitingOnJax || job.finished) return false;
        saving = index; show();
        try { await service.setStageNeed(spaceId, jobId, index, !!checked); if (!disposed) { saving = null; await load(); } return true; }
        catch (error) { if (!disposed) { saving = null; show(error?.message || 'Unable to save this tick. Try again.'); } return false; }
      },
      async complete() {
        if (disposed || busy || !job || job.waitingOnJax || job.finished) return;
        busy = true; show();
        try { await service.completeStage(spaceId, jobId); if (!disposed) { busy = false; await load(); } }
        catch (_) {
          if (!disposed) {
            busy = false;
            if (!job) await load();
            if (job && !disposed) show('Unable to mark this stage done. Try again.');
          }
        }
      },
      dispose() { disposed = true; revision++; job = null; off(); },
    };
  }
  function mount(el, { spaceId, jobId, studio, onStage, viewing = null }) {
    const owner = studio.isOwner === true;   // OWNER-JUMP 2026-10-29: Jax opens any stage and can skip ticks
    const doc = el.ownerDocument, root = doc.createElement('div'); root.className = 'studio-stage-bar'; el.replaceChildren(root);
    const states = doc.defaultView?.MeridianStudioScreenStates || require('./home.js').screenStates;
    const focus = states.focus(root);
    let ticked = null;   // { stageId, index } of the box last ticked, so focus stays on it across redraws
    function node(tag, text) { const item = doc.createElement(tag); if (text) item.textContent = text; return item; }
    const model = createStageBar({ service: studio.service, spaceId, jobId, onStage,
      report(view) {
        const restore = focus(); root.replaceChildren(); root.setAttribute('aria-busy', String(view.state === 'loading' || !!view.busy));
        if (view.state !== 'ready') {
          root.appendChild(states.panel(doc, view.state, view.state === 'loading' ? 'Loading stages…' : view.message, () => void model.load()));
          restore(); return;
        }
        const { job } = view, list = node('ol'); list.className = 'studio-stage-list';
        const labels = { done: 'Done', current: 'Current', 'waiting-on-jax': 'Waiting on Jax', upcoming: 'Upcoming' };
        for (const stage of job.stages) {
          const item = node('li', `${stage.name} — ${labels[stage.status] || 'Upcoming'}`);
          if (stage.id === job.stageId) item.setAttribute('aria-current', 'step');
          if (owner) {   // a click opens that stage (the tools work on it; the Job itself stays where it is)
            item.tabIndex = 0; item.setAttribute('role', 'button'); item.dataset.jump = stage.id; item.title = `Open ${stage.name}`;
            if (stage.id === (viewing || job.stageId)) item.dataset.viewing = '1';
            const go = () => studio.navigate('work', { spaceId, jobId, stageId: stage.id });
            item.addEventListener('click', go);
            item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
          }
          list.appendChild(item);
        }
        root.appendChild(list);
        const current = job.stages.find(stage => stage.id === job.stageId);
        let focusOn = null;
        const allTicked = !current || (current.needsDone || []).length >= current.needs.length && current.needs.every((_, i) => current.needsDone[i]);
        if (current) {
          const title = node('h2', current.name); title.tabIndex = -1;
          root.append(title, node('p', current.goal));
          const needs = node('fieldset'); needs.appendChild(node('legend', 'This stage needs'));
          current.needs.forEach((need, index) => {
            const label = node('label'), input = node('input');
            input.type = 'checkbox'; input.checked = !!current.needsDone?.[index];
            input.disabled = view.saving !== null || view.busy || job.waitingOnJax || job.finished;
            input.addEventListener('change', () => { ticked = { stageId: current.id, index }; void model.tick(index, input.checked); });
            label.append(input, node('span', need)); needs.appendChild(label);
            if (ticked?.stageId === current.id && ticked.index === index && !input.disabled) focusOn = input;
          });
          root.append(needs, node('p', `Quality check: ${current.check}`),
            node('p', current.approver === 'jax' ? 'Approved by Jax' : 'Team marks this done'));
        }
        const button = node('button', job.finished ? 'Job finished' : job.waitingOnJax ? 'Waiting on Jax'
          : view.busy ? 'Saving stage…' : 'Mark stage done');
        button.type = 'button'; button.className = 'studio-button is-secondary';
        button.disabled = !!(view.busy || job.finished || job.waitingOnJax || (!allTicked && !owner));
        button.addEventListener('click', () => void model.complete()); root.appendChild(button);
        if (!allTicked && !job.finished && !job.waitingOnJax) root.appendChild(node('p', owner ? 'You can mark it done without every tick.' : 'Tick everything this stage needs first'));
        const win = doc.defaultView;
        if (owner && job.waitingOnJax && win && typeof win.switchView === 'function') {   // his approval lives on Review
          const review = node('button', 'Approve on Review'); review.type = 'button'; review.className = 'studio-button is-primary';
          review.addEventListener('click', () => win.switchView('owner-studio')); root.appendChild(review);
        }
        const jobPage = node('button', 'Job page'); jobPage.type = 'button'; jobPage.className = 'studio-button is-secondary';
        jobPage.addEventListener('click', () => studio.navigate('job', { spaceId, jobId })); root.appendChild(jobPage);
        if (job.finished || job.waitingOnJax) {
          const status = node('p', job.finished ? 'Job finished' : 'Waiting on Jax'); status.setAttribute('role', 'status'); root.appendChild(status);
        }
        if (view.error) { const error = node('p', view.error); error.setAttribute('role', 'alert'); root.appendChild(error); }
        if (focusOn) focusOn.focus?.(); else restore(root.querySelector?.('h2'));
      } });
    void model.load(); return () => { model.dispose(); ticked = null; root.remove(); };
  }
  return { createStageBar, mount };
});
