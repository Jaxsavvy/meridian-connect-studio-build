'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianStudio.registerScreen('job', { render: api.render });
})(typeof window === 'undefined' ? null : window, function () {
  const STORY_STAGES = Object.freeze(['plan', 'words', 'storyboard', 'look']);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  // What each stage decided, loaded part by part so one failure only blanks its own part.
  async function loadDecisions(service, spaceId, jobId, job) {
    const part = promise => promise.then(value => ({ ok: true, value }), () => ({ ok: false }));
    const stages = Array.isArray(job.stages) ? job.stages : [];
    const brief = stages.find(st => st.id === 'brief');
    const website = job.workflowId === 'website';   // Pitch deck Jobs have no chapter cards
    const [notes, story, ...gaps] = await Promise.all([
      brief?.hasNotes ? part(service.getStageNotes(spaceId, jobId, 'brief')) : { ok: true, value: null },
      website ? part(service.getStory(spaceId, jobId)) : null,
      ...STORY_STAGES.map(id => website && stages.some(st => st.id === id) ? part(service.getStoryGaps(spaceId, jobId, id)) : null),
    ]);
    return { notes, story, gaps: Object.fromEntries(STORY_STAGES.map((id, i) => [id, gaps[i]])) };
  }
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
        ready = true; report({ state: 'ready', job, assets, decisions: null });
        // Decisions never break the page: anything unexpected leaves the Job and its images as they are.
        const decisions = await loadDecisions(service, spaceId, jobId, job).catch(() => null);
        if (decisions && !disposed && request === revision) report({ state: 'ready', job, assets, decisions });
      } catch (_) {
        if (!disposed && request === revision) report({ state: 'failed',
          message: 'Unable to open this Job. Check your connection and access, then try again.' });
      }
    }
    const off = service.on((event, detail) => {
      if (['jobs-changed', 'assets-changed'].includes(event) && detail?.spaceId === spaceId) void load();
      else if (['stage-notes-changed', 'story-changed'].includes(event) && detail?.jobId === jobId) void load();
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
    // Read-only: every note and card goes in as text, never as HTML.
    function decided(item, stage, decisions) {
      const box = node('div', '', 'studio-job-decided'), failed = () => node('p', 'Couldn\'t load this', 'studio-job-failed');
      if (stage.id === 'brief') {
        box.appendChild(node('h3', 'Decided'));
        const notes = decisions?.notes;
        if (!decisions) box.appendChild(node('p', 'Loading…'));
        else if (!notes.ok) box.appendChild(failed());
        else if (!notes.value) box.appendChild(node('p', 'Nothing decided yet'));
        else {
          const list = node('dl');
          for (const [label, value] of [['Goal', notes.value.goal], ['Audience', notes.value.audience],
            ['Main call to action', notes.value.callToAction], ['Pages wanted', (notes.value.pages || []).join(', ')]]) list.append(node('dt', label), node('dd', value || '–'));
          box.appendChild(list);
        }
      }
      if (stage.id === 'plan' && decisions?.story) {
        box.appendChild(node('h3', 'Story so far'));
        if (!decisions.story.ok) box.appendChild(failed());
        else box.appendChild(node('p', (decisions.story.value?.pages || []).map(p => `${p.name || 'Untitled page'}: ${plural((p.chapters || []).length, 'chapter', 'chapters')}`).join(' · ') || 'No pages yet'));
      }
      const gaps = decisions?.gaps?.[stage.id];
      if (gaps) box.appendChild(gaps.ok ? node('p', gaps.value.length ? `${plural(gaps.value.length, 'thing', 'things')} left` : 'Ready', gaps.value.length ? 'studio-job-left' : 'studio-job-ready') : failed());
      if (box.children.length) item.appendChild(box);
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
          const ticked = (stage.needsDone || []).filter(Boolean).length;
          item.append(node('h3', 'This stage needs'), needs, node('p', `${ticked} of ${(stage.needs || []).length} ticked`, 'studio-job-ticked'));
          decided(item, stage, view.decisions);
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
