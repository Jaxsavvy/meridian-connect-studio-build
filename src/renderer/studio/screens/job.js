'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianStudio.registerScreen('job', { render: api.render });
})(typeof window === 'undefined' ? null : window, function () {
  const safeUrl = url => typeof url === 'string' && /^(https:\/\/|blob:|data:image\/(png|jpeg|webp|gif|svg\+xml)[;,])/i.test(url);
  function createJob({ service, spaceId, jobId, navigate, report }) {
    let disposed = false, revision = 0, ready = false;
    async function load() {
      if (disposed) return;
      const request = ++revision; ready = false; report({ state: 'loading' });
      try {
        const [job, assets] = await Promise.all([service.getJob(spaceId, jobId), service.listJobAssets(spaceId, jobId)]);
        if (disposed || request !== revision) return;
        if (!job || job.spaceId !== spaceId || job.id !== jobId) throw Error('Job unavailable');
        ready = true; report({ state: 'ready', job, assets });
      } catch (_) {
        if (!disposed && request === revision) report({ state: 'failed',
          message: 'Unable to open this Job. Check your connection and access, then try again.' });
      }
    }
    const off = service.on((event, detail) => {
      if (['jobs-changed', 'assets-changed'].includes(event) && detail?.spaceId === spaceId) void load();
    });
    return { load,
      openWork() { if (!disposed && ready) navigate('work', { spaceId, jobId }); },
      back() { if (!disposed) navigate('space', { spaceId }); },
      dispose() { disposed = true; revision++; ready = false; off(); },
    };
  }
  function render(el, { spaceId, jobId }, studio) {
    const doc = el.ownerDocument, root = doc.createElement('section');
    root.className = 'studio-job'; root.setAttribute('aria-label', 'Job page'); el.replaceChildren(root);
    const states = doc.defaultView?.MeridianStudioScreenStates || require('./home.js').screenStates;
    const focus = states.focus(root);
    function node(tag, text, className) {
      const item = doc.createElement(tag); if (text) item.textContent = text;
      if (className) item.className = className; return item;
    }
    function button(text, action) {
      const item = node('button', text, 'studio-button is-secondary'); item.type = 'button';
      item.addEventListener('click', action); return item;
    }
    const model = createJob({ service: studio.service, spaceId, jobId, navigate: studio.navigate,
      report(view) {
        const restore = focus();
        root.replaceChildren(button('Back', () => model.back()), node('h1', view.job?.name || 'Job'));
        root.setAttribute('aria-busy', String(view.state === 'loading'));
        if (view.state !== 'ready') {
          root.appendChild(states.panel(doc, view.state, view.state === 'loading' ? 'Loading Job…' : view.message,
            () => void model.load())); restore(); return;
        }
        const { job, assets } = view;
        root.append(node('p', ({ standard: 'Standard', cinematic: 'Cinematic' })[job.tier] || 'Tier unavailable'),
          node('p', `${job.stages.filter(stage => stage.status === 'done').length} of ${job.stages.length} stages done`));
        if (job.waitingOnJax || job.finished) {
          const status = node('p', job.waitingOnJax ? 'Waiting on Jax' : 'Job finished');
          status.setAttribute('role', 'status'); root.appendChild(status);
        }
        root.appendChild(button('Open in Work', () => model.openWork()));
        const list = node('ol', '', 'studio-job-stages');
        const labels = { done: 'done', current: 'current', 'waiting-on-jax': 'waiting on Jax', upcoming: 'upcoming' };
        for (const stage of job.stages) {
          const item = node('li', '', 'studio-card');
          if (stage.id === job.stageId) item.setAttribute('aria-current', 'step');
          item.append(node('h2', stage.name), node('p', labels[stage.status] || 'upcoming'), node('p', stage.goal));
          const needs = node('ul');
          for (const need of stage.needs || []) needs.appendChild(node('li', need));
          item.append(node('h3', 'This stage needs'), needs);
          const thumbnails = node('div', '', 'studio-job-assets');
          const images = (assets[stage.id] || []).filter(asset => asset.kind === 'image' && safeUrl(asset.url));
          for (const asset of images) {
            const image = node('img'); image.src = asset.url; image.alt = asset.name; image.loading = 'lazy';
            image.addEventListener('error', () => image.replaceWith(node('p', 'Preview unavailable')), { once: true });
            thumbnails.appendChild(image);
          }
          item.appendChild(images.length ? thumbnails : node('p', 'Nothing made here yet')); list.appendChild(item);
        }
        root.appendChild(list); restore();
      } });
    void model.load(); return () => { model.dispose(); root.remove(); };
  }
  return { safeUrl, createJob, render };
});
