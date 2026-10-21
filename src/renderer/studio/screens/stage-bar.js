'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianStudio.registerPart('stage-bar', { mount: api.mount });
})(typeof window === 'undefined' ? null : window, function () {
  function createStageBar({ service, spaceId, jobId, report, onStage = () => {} }) {
    let disposed = false, revision = 0, job = null, busy = false;
    function show(error = '') { report({ state: 'ready', job, busy, error }); }
    async function load() {
      if (disposed) return;
      const request = ++revision; job = null; report({ state: 'loading', busy });
      try {
        const next = await service.getJob(spaceId, jobId);
        if (disposed || request !== revision) return;
        if (!next || next.spaceId !== spaceId || next.id !== jobId) throw Error('Job unavailable');
        job = next; show(); onStage(job);
      } catch (_) {
        if (!disposed && request === revision) report({ state: 'failed', message: 'Unable to load this Job. Check your connection and access, then try again.' });
      }
    }
    const off = service.on((event, detail) => { if (event === 'jobs-changed' && detail?.spaceId === spaceId) void load(); });
    return { load,
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
  function mount(el, { spaceId, jobId, studio, onStage }) {
    const doc = el.ownerDocument, root = doc.createElement('div'); root.className = 'studio-stage-bar'; el.replaceChildren(root);
    const states = doc.defaultView?.MeridianStudioScreenStates || require('./home.js').screenStates;
    const focus = states.focus(root), checked = new Set();
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
          list.appendChild(item);
        }
        root.appendChild(list);
        const current = job.stages.find(stage => stage.id === job.stageId);
        if (current) {
          const title = node('h2', current.name); title.tabIndex = -1;
          root.append(title, node('p', current.goal));
          const needs = node('fieldset'); needs.appendChild(node('legend', 'This stage needs'));
          current.needs.forEach((need, index) => {
            const label = node('label'), input = node('input'), key = `${current.id}:${index}`;
            input.type = 'checkbox'; input.checked = checked.has(key);
            input.addEventListener('change', () => { if (input.checked) checked.add(key); else checked.delete(key); });
            label.append(input, node('span', need)); needs.appendChild(label);
          });
          root.append(needs, node('p', `Quality check: ${current.check}`),
            node('p', current.approver === 'jax' ? 'Approved by Jax' : 'Team marks this done'));
        }
        const button = node('button', job.finished ? 'Job finished' : job.waitingOnJax ? 'Waiting on Jax'
          : view.busy ? 'Saving stage…' : 'Mark stage done');
        button.type = 'button'; button.className = 'studio-button is-secondary';
        button.disabled = !!(view.busy || job.finished || job.waitingOnJax);
        button.addEventListener('click', () => void model.complete()); root.appendChild(button);
        const jobPage = node('button', 'Job page'); jobPage.type = 'button'; jobPage.className = 'studio-button is-secondary';
        jobPage.addEventListener('click', () => studio.navigate('job', { spaceId, jobId })); root.appendChild(jobPage);
        if (job.finished || job.waitingOnJax) {
          const status = node('p', job.finished ? 'Job finished' : 'Waiting on Jax'); status.setAttribute('role', 'status'); root.appendChild(status);
        }
        if (view.error) { const error = node('p', view.error); error.setAttribute('role', 'alert'); root.appendChild(error); }
        restore(root.querySelector?.('h2'));
      } });
    void model.load(); return () => { model.dispose(); checked.clear(); root.remove(); };
  }
  return { createStageBar, mount };
});
