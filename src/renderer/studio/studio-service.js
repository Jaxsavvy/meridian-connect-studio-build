/* Meridian Studio service: the ONE place screens and tools get data from.
 * Core lane. Today it runs on built-in SAMPLE data so Tyler and Cassy can build
 * screens and tools without the cloud server. In Wave 1 the same methods will
 * call the server instead; screens and tools must not change when that happens.
 * Rules (docs/PLAN.md): no costs anywhere, no keys, no client mixing. */
'use strict';

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianStudioService = api;
})(typeof window === 'undefined' ? null : window, function () {
  const TOOLS = [
    ['image-gen', 'Image gen', 'tool', 'available'],
    ['asset-library', 'Asset Library', 'tool', 'available'],
    ['video', 'Video', 'tool', 'coming-soon'],
    ['storyboard', 'Storyboard', 'tool', 'available'],
    ['logo', 'Logo', 'tool', 'coming-soon'],
    ['copywriter', 'Copywriter', 'tool', 'available'],
    ['website', 'Website', 'workflow', 'available'],
    ['landing-page', 'Landing page', 'workflow', 'coming-soon'],
    ['seo', 'SEO', 'workflow', 'coming-soon'],
    ['ad-campaign', 'Ad campaign', 'workflow', 'coming-soon'],
    ['social', 'Social content', 'workflow', 'coming-soon'],
    ['brand-kit', 'Brand kit', 'workflow', 'coming-soon'],
    ['pitch-deck', 'Pitch deck', 'workflow', 'coming-soon'],
  ].map(([id, name, kind, state]) => Object.freeze({ id, name, kind, state }));

  const PRESETS = [
    ['website-hero', 'Website hero', '16:9', ['What should the hero show?', 'People visible or anonymous?']],
    ['page-header', 'Page header', '21:9', ['Which page is it for?']],
    ['service-in-action', 'Service in action', '3:2', ['Which service?', 'Indoor or outdoor?']],
    ['before-after', 'Before/after', '3:2', ['What changed between before and after?']],
    ['team-portrait', 'Team/crew portrait', '4:5', ['How many people?', 'Faces visible?']],
    ['product-shot', 'Clean product shot', '1:1', ['Which product?', 'Background color?']],
    ['social-promo', 'Social promo', '1:1', ['What is being promoted?', 'Square or story?']],
    ['ad-creative', 'Ad creative', '1:1', ['What is the offer?', 'Where does the headline go?']],
    ['seasonal', 'Seasonal promo', '4:5', ['Which season or holiday?']],
  ].map(([id, name, size, questions]) => Object.freeze({ id, toolId: 'image-gen', name, size, questions: Object.freeze(questions) }));

  // Website workflow (docs/PLAN.md). approver 'jax' means the stage waits on Jax; the team can't mark it done.
  const STAGE = (id, name, goal, tools, needs, check, approver = 'team', tiers = ['standard', 'cinematic']) =>
    Object.freeze({ id, name, goal, tools: Object.freeze(tools), needs: Object.freeze(needs), check, approver, tiers: Object.freeze(tiers) });
  const WORKFLOWS = Object.freeze({
    website: Object.freeze({
      id: 'website', name: 'Website',
      tiers: Object.freeze([
        Object.freeze({ id: 'standard', name: 'Standard', description: 'Clean, fast site. Strong photos, clear pages, no motion pieces.' }),
        Object.freeze({ id: 'cinematic', name: 'Cinematic', description: 'Everything in Standard plus scroll motion and video moments.' }),
      ]),
      stages: Object.freeze([
        STAGE('brief', 'Brief', 'Agree what the site must do and for whom.', ['copywriter'], ['Goals', 'Audience', 'Pages wanted', 'Must-have content'], 'Brief matches Project DNA', 'jax'),
        STAGE('plan', 'Plan', 'Map every page and section.', ['copywriter'], ['Sitemap', 'Sections per page'], 'Every page has a purpose'),
        STAGE('storyboard', 'Storyboard', 'Sketch each page top to bottom.', ['storyboard', 'image-gen'], ['Frame per section'], 'Flows in order, nothing missing'),
        STAGE('look', 'Look', 'Make the images and visual style.', ['image-gen', 'asset-library'], ['Hero image', 'Section images', 'Style sample'], 'On-brand colors and fonts', 'jax'),
        STAGE('motion', 'Motion', 'Add scroll motion and video moments.', ['video'], ['Motion plan', 'Video clips'], 'Smooth, not distracting', 'team', ['cinematic']),
        STAGE('build', 'Build', 'Meridian builds the site from the plan.', ['website'], ['All assets kept'], 'Every page renders'),
        STAGE('check', 'Check', 'Test speed, mobile, links and spelling.', ['seo'], ['Mobile check', 'Speed check', 'Link check'], 'All checks pass'),
        STAGE('review', 'Review', 'Jax reviews before the client sees it.', [], ['Share link for Jax'], 'Jax approves', 'jax'),
        STAGE('launch', 'Launch', 'Publish the site.', [], ['Domain ready'], 'Live and checked', 'jax'),
      ]),
    }),
  });
  const stagesFor = (workflow, tier) => workflow.stages.filter(st => st.tiers.includes(tier));

  // Stage notes: what the Brief, Plan and Storyboard stages decided, saved per Job. Plain text only.
  const SECTION_KINDS = Object.freeze(['hero', 'services', 'proof', 'reviews', 'about', 'faq', 'contact', 'other']);
  const text = (value, field, max = 2000) => {
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string') throw new Error(`${field} must be text.`);
    if (value.length > max) throw new Error(`${field} is too long (max ${max} characters).`);
    return value.trim();
  };
  const list = (value, field, max) => {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw new Error(`${field} must be a list.`);
    if (value.length > max) throw new Error(`${field} can have at most ${max} items.`);
    return value;
  };
  const NOTES = Object.freeze({
    brief: n => ({ goal: text(n.goal, 'Goal'), audience: text(n.audience, 'Audience'), callToAction: text(n.callToAction, 'Main call to action', 200),
      pages: list(n.pages, 'Pages wanted', 20).map(p => text(p, 'Page name', 80)).filter(Boolean), mustHave: text(n.mustHave, 'Must-have content') }),
    plan: n => ({ pages: list(n.pages, 'Pages', 20).map(p => ({ name: text(p?.name, 'Page name', 80), purpose: text(p?.purpose, 'Page purpose', 300),
      sections: list(p?.sections, 'Sections', 12).map(sec => {
        const kind = SECTION_KINDS.includes(sec?.kind) ? sec.kind : 'other';
        return { kind, heading: text(sec?.heading, 'Section heading', 200), copy: text(sec?.copy, 'Section copy', 4000) };
      }) })) }),
    storyboard: n => ({ frames: list(n.frames, 'Frames', 120).map(f => ({ page: text(f?.page, 'Frame page', 80),
      section: Number.isInteger(f?.section) && f.section >= 0 && f.section < 12 ? f.section : 0,
      sketch: text(f?.sketch, 'Frame sketch'), assetId: typeof f?.assetId === 'string' && f.assetId ? f.assetId : null })) }),
  });

  const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
  const clone = value => JSON.parse(JSON.stringify(value));

  function sampleImage(label, hue) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="hsl(${hue},45%,22%)"/>` +
      `<text x="50%" y="50%" fill="#e8eef7" font-family="sans-serif" font-size="22" text-anchor="middle">${label.replace(/[<>&"]/g, '')}</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  /** options.simulateJaxMs: in the app's sample mode only, "Jax" approves waiting stages and Review items
   *  after this many ms, so the whole flow can be clicked through without a server. Tests leave it off. */
  function createSampleService(options = {}) {
    const simulateJaxMs = Number.isFinite(options.simulateJaxMs) && options.simulateJaxMs > 0 ? options.simulateJaxMs : 0;
    const later = fn => { if (simulateJaxMs) setTimeout(() => { try { fn(); } catch (_) { /* already handled */ } }, simulateJaxMs); };
    let projects = [];
    let counter = 0;
    const assets = new Map();
    const jobs = new Map(); // spaceId -> started jobs
    const listeners = new Set();
    const nextId = prefix => `${prefix}-${++counter}`;
    const emit = (event, detail) => { for (const fn of listeners) fn(event, detail); };

    function spaceList() {
      return [
        { id: 'sandbox-me', type: 'sandbox-personal', name: 'My sandbox' },
        { id: 'sandbox-team', type: 'sandbox-team', name: 'Team sandbox' },
        ...(projects.length ? projects : [{ id: 'sample-client', name: 'Sample Client (demo)' }])
          .map(p => ({ id: p.id, type: 'client', name: p.name })),
      ];
    }

    function requireSpace(spaceId) {
      const space = spaceList().find(s => s.id === spaceId);
      if (!space) throw new Error('Space not found or not assigned to you.');
      return space;
    }

    function spaceAssets(spaceId) {
      if (!assets.has(spaceId)) assets.set(spaceId, []);
      return assets.get(spaceId);
    }

    return Object.freeze({
      mode: 'sample',
      /** Called by Connect with the projects the signed-in person is assigned to. */
      setProjects(list) {
        projects = (Array.isArray(list) ? list : [])
          .filter(p => p && SAFE_ID.test(String(p.id)))
          .map(p => ({ id: String(p.id), name: String(p.name || 'Untitled project') }));
        emit('spaces-changed');
      },
      async listSpaces() { return clone(spaceList()); },
      async getSpace(spaceId) {
        const space = requireSpace(spaceId);
        const dna = space.type === 'client'
          ? { status: 'draft', brief: 'Sample brief', colors: ['#0b1f3a', '#2bb3a3'], fonts: ['Source Serif 4', 'Inter'], voice: 'Confident, plain-spoken', audience: 'Local homeowners' }
          : null;
        const started = spaceJobs(space.id).map(jobSummary);
        const jobList = space.type === 'client' && !started.length
          ? [{ id: `${space.id}-job-1`, name: 'Website v1', stage: 'Not started', progress: 0 }] : started;
        return clone({ ...space, dna, jobs: jobList });
      },
      async listTools() { return clone(TOOLS); },
      /** Workflow definition with its stages; null if that workflow isn't built yet. */
      async getWorkflow(workflowId) { return WORKFLOWS[workflowId] ? clone(WORKFLOWS[workflowId]) : null; },
      /** Starts a Job (one workflow run). tier: 'standard' | 'cinematic'. */
      async startJob(spaceId, workflowId, tier) {
        const space = requireSpace(spaceId);
        const workflow = WORKFLOWS[workflowId];
        if (!workflow) throw new Error('That workflow is coming soon.');
        if (!workflow.tiers.some(t => t.id === tier)) throw new Error('Pick Standard or Cinematic.');
        const stages = stagesFor(workflow, tier);
        const n = spaceJobs(space.id).filter(j => j.workflowId === workflowId).length + 1;
        const job = { id: nextId('job'), spaceId: space.id, workflowId, tier, name: `${workflow.name} v${n}`,
          stageIds: stages.map(st => st.id), done: [], stageId: stages[0].id, waitingOnJax: false, notes: {}, needs: {} };
        spaceJobs(space.id).push(job);
        emit('jobs-changed', { spaceId: space.id });
        return clone(jobView(job));
      },
      async getJob(spaceId, jobId) { requireSpace(spaceId); return clone(jobView(requireJob(spaceId, jobId))); },
      /** Started Jobs in this Space (not the placeholder shown on a fresh client). */
      async listJobs(spaceId) { requireSpace(spaceId); return clone(spaceJobs(spaceId).map(jobSummary)); },
      /** Assets made inside a Job (kept or not, never trashed), grouped by stage id. */
      async listJobAssets(spaceId, jobId) {
        requireSpace(spaceId);
        const job = requireJob(spaceId, jobId);
        const byStage = {};
        for (const id of job.stageIds) byStage[id] = [];
        for (const a of spaceAssets(spaceId)) if (a.jobId === job.id && !a.trashed && byStage[a.stageId]) byStage[a.stageId].push(a);
        return clone(byStage);
      },
      /** Marks the current stage done and moves on. Stages Jax approves wait on him instead. */
      async completeStage(spaceId, jobId) {
        requireSpace(spaceId);
        const job = requireJob(spaceId, jobId);
        const stage = WORKFLOWS[job.workflowId].stages.find(st => st.id === job.stageId);
        if (stage.approver === 'jax') {
          job.waitingOnJax = true; emit('jobs-changed', { spaceId });
          later(() => { if (job.waitingOnJax) { job.waitingOnJax = false; advance(job); emit('jobs-changed', { spaceId }); } });
          return clone(jobView(job));
        }
        advance(job);
        emit('jobs-changed', { spaceId });
        return clone(jobView(job));
      },
      /** Sample-mode stand-in for Jax approving a stage (the server does this for real). */
      async approveStage(spaceId, jobId) {
        requireSpace(spaceId);
        const job = requireJob(spaceId, jobId);
        if (!job.waitingOnJax) throw new Error('This stage is not waiting on Jax.');
        job.waitingOnJax = false; advance(job);
        emit('jobs-changed', { spaceId });
        return clone(jobView(job));
      },
      /** Ticks or unticks one "This stage needs" item (by index) on the Job's current stage. */
      async setStageNeed(spaceId, jobId, index, checked) {
        requireSpace(spaceId);
        const job = requireJob(spaceId, jobId);
        const stage = WORKFLOWS[job.workflowId].stages.find(st => st.id === job.stageId);
        if (!stage || job.waitingOnJax) throw new Error('This stage can no longer be changed.');
        if (!Number.isInteger(index) || index < 0 || index >= stage.needs.length) throw new Error('Unknown checklist item.');
        const ticks = job.needs[stage.id] || (job.needs[stage.id] = stage.needs.map(() => false));
        ticks[index] = !!checked;
        emit('jobs-changed', { spaceId });
        return clone(jobView(job));
      },
      /** What a stage decided: 'brief' | 'plan' | 'storyboard'. Empty notes until someone saves. */
      async getStageNotes(spaceId, jobId, stageId) {
        requireSpace(spaceId);
        const job = requireJob(spaceId, jobId);
        if (!NOTES[stageId] || !job.stageIds.includes(stageId)) throw new Error('This stage has no notes.');
        return clone(job.notes[stageId] || NOTES[stageId]({}));
      },
      /** Saves a stage's notes (replaces them). Storyboard frames may only point at this Space's assets. */
      async saveStageNotes(spaceId, jobId, stageId, notes) {
        requireSpace(spaceId);
        const job = requireJob(spaceId, jobId);
        if (!NOTES[stageId] || !job.stageIds.includes(stageId)) throw new Error('This stage has no notes.');
        if (!notes || typeof notes !== 'object' || Array.isArray(notes)) throw new Error('Notes must be an object.');
        if (job.done.includes(stageId) || (job.stageId === stageId && job.waitingOnJax)) throw new Error('This stage is finished; its notes are locked.');
        const clean = NOTES[stageId](notes);
        if (stageId === 'storyboard') {
          for (const frame of clean.frames) {
            if (frame.assetId && !spaceAssets(spaceId).some(a => a.id === frame.assetId && !a.trashed)) throw new Error('A frame points at an asset that is not in this Space.');
          }
        }
        job.notes[stageId] = clean;
        emit('stage-notes-changed', { spaceId, jobId: job.id, stageId });
        return clone(clean);
      },
      /** Meridian drafts copy for the person to accept or change. Never saves anything by itself.
       *  request: { spaceId, kind: 'section' | 'headline' | 'brief-summary', input: { heading?, kind?, notes? } } */
      async draftCopy(request) {
        const space = requireSpace(request && request.spaceId);
        const kind = ['section', 'headline', 'brief-summary'].includes(request.kind) ? request.kind : 'section';
        const input = request.input && typeof request.input === 'object' ? request.input : {};
        const topic = text(input.heading, 'Heading', 200) || text(input.notes, 'Notes', 2000).slice(0, 80) || 'this section';
        const voice = space.type === 'client' ? 'Confident, plain-spoken' : 'Friendly';
        const draft = kind === 'headline' ? `${topic}: done right, the first time`
          : kind === 'brief-summary' ? `A site that turns visitors into calls. Focus: ${topic}.`
            : `${topic}. We show up on time, explain the work in plain words, and leave the place cleaner than we found it. Call today for a free estimate.`;
        return clone({ draft, settingsUsed: { kind, voice, model: 'sample', useBrandDna: space.type === 'client' } });
      },
      async listPresets(toolId) { return clone(PRESETS.filter(p => p.toolId === toolId)); },
      async listAssets(spaceId, { query = '', includeTrash = false } = {}) {
        requireSpace(spaceId);
        const q = String(query).toLowerCase();
        return clone(spaceAssets(spaceId).filter(a => (includeTrash || !a.trashed) && a.name.toLowerCase().includes(q)));
      },
      async keepAsset(spaceId, assetId) { return update(spaceId, assetId, a => { a.kept = true; }); },
      async trashAsset(spaceId, assetId) {
        return update(spaceId, assetId, a => {
          if (a.approved) throw new Error('Approved work can only be removed by Jax.');
          a.trashed = true;
        });
      },
      async restoreAsset(spaceId, assetId) { return update(spaceId, assetId, a => { a.trashed = false; }); },
      /** Send to Review: Jax sees it in his queue. note is optional. */
      async sendToReview(spaceId, assetId, note = '') {
        return update(spaceId, assetId, a => {
          if (a.trashed) throw new Error('Restore this asset before sending it to Review.');
          if (a.review && a.review.status === 'waiting') throw new Error('Already waiting on Jax.');
          a.kept = true; a.review = { status: 'waiting', note: String(note).slice(0, 500) };
          later(() => { if (a.review && a.review.status === 'waiting') { a.review = { ...a.review, status: 'approved' }; a.approved = true; emit('assets-changed', { spaceId }); } });
        });
      },
      async listReview(spaceId) {
        requireSpace(spaceId);
        return clone(spaceAssets(spaceId).filter(a => a.review && a.review.status === 'waiting'));
      },
      /** Sample-mode stand-in for Jax approving (the server does this for real). Approved assets are locked. */
      async approveAsset(spaceId, assetId) {
        return update(spaceId, assetId, a => {
          if (!a.review || a.review.status !== 'waiting') throw new Error('This asset is not waiting on Jax.');
          a.review = { ...a.review, status: 'approved' }; a.approved = true;
        });
      },
      /** New version of an asset. The original never changes. changes: { name?, url? } */
      async saveVersion(spaceId, parentId, changes = {}) {
        requireSpace(spaceId);
        const list = spaceAssets(spaceId);
        const parent = list.find(a => a.id === parentId);
        if (!parent) throw new Error('Asset not found in this space.');
        const family = list.filter(a => (a.rootId || a.id) === (parent.rootId || parent.id));
        const version = Math.max(...family.map(a => a.version)) + 1;
        const base = String(changes.name || parent.name).replace(/__v\d+$/, '');
        const asset = { ...parent, id: nextId('asset'), name: `${base}__v${version}`, version, parentId: parent.id,
          rootId: parent.rootId || parent.id, url: typeof changes.url === 'string' ? changes.url : parent.url,
          kept: true, approved: false, review: null, trashed: false };
        list.push(asset);
        emit('assets-changed', { spaceId });
        return clone(asset);
      },
      /** Move to client: copies a sandbox asset into another Space as a new original (v1). The sandbox copy
       *  stays. Never from a client Space: one client's work is never used in another client's Space. */
      async copyToSpace(fromSpaceId, assetId, toSpaceId) {
        const from = requireSpace(fromSpaceId);
        const to = requireSpace(toSpaceId);
        if (from.type === 'client') throw new Error('Only sandbox work can be moved to a client.');
        if (from.id === to.id) throw new Error('Pick a different Space.');
        const source = spaceAssets(from.id).find(a => a.id === assetId && !a.trashed);
        if (!source) throw new Error('Asset not found in this space.');
        const base = String(source.name).replace(/__v\d+$/, '');
        const asset = { ...source, id: nextId('asset'), spaceId: to.id, name: `${base}__v1`, version: 1, parentId: null,
          rootId: undefined, kept: true, approved: false, review: null, trashed: false, jobId: undefined, stageId: undefined,
          copiedFrom: { spaceId: from.id, assetId: source.id } };
        delete asset.rootId; delete asset.jobId; delete asset.stageId;
        spaceAssets(to.id).push(asset);
        emit('assets-changed', { spaceId: to.id });
        return clone(asset);
      },
      /** Every version of an asset's family, oldest first. */
      async listVersions(spaceId, assetId) {
        requireSpace(spaceId);
        const list = spaceAssets(spaceId);
        const asset = list.find(a => a.id === assetId);
        if (!asset) throw new Error('Asset not found in this space.');
        const root = asset.rootId || asset.id;
        return clone(list.filter(a => (a.rootId || a.id) === root).sort((a, b) => a.version - b.version));
      },
      /** request: { spaceId, presetId, description, count (1|2|4), references: [assetId], jobId?, stageId? }
       *  jobId/stageId (from the Work view inside a Job) tag the results so the Job page can list them. */
      async generateImage(request) {
        const space = requireSpace(request && request.spaceId);
        const preset = PRESETS.find(p => p.id === request.presetId) || PRESETS[0];
        const description = String(request.description || '').trim();
        if (!description) throw new Error('Describe the image first.');
        const count = [1, 2, 4].includes(request.count) ? request.count : 4;
        const refinedDescription = `${description} — ${preset.name.toLowerCase()} composition, on-brand colors, natural light`;
        const settingsUsed = { preset: preset.name, size: preset.size, count, model: 'sample', useBrandDna: space.type === 'client' };
        let tag = {};
        if (request.jobId) {
          const job = requireJob(space.id, request.jobId);
          tag = { jobId: job.id, stageId: job.stageIds.includes(request.stageId) ? request.stageId : job.stageId };
        }
        const results = [];
        for (let i = 0; i < count; i += 1) {
          const asset = { id: nextId('asset'), spaceId: space.id, name: `${preset.id}-sample-${i + 1}__v1`, kind: 'image',
            url: sampleImage(`${preset.name} ${i + 1}`, 200 + i * 25), version: 1, parentId: null,
            kept: false, approved: false, trashed: false, createdBy: 'image-gen', settingsUsed, ...tag };
          spaceAssets(space.id).push(asset);
          results.push({ assetId: asset.id, url: asset.url, note: i === 0 ? 'Best fit for the brief' : '' });
        }
        emit('assets-changed', { spaceId: space.id });
        return clone({ requestId: nextId('req'), refinedDescription, settingsUsed, results });
      },
      on(listener) {
        if (typeof listener !== 'function') throw new TypeError('Listener must be a function.');
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    });

    function spaceJobs(spaceId) {
      if (!jobs.has(spaceId)) jobs.set(spaceId, []);
      return jobs.get(spaceId);
    }

    function requireJob(spaceId, jobId) {
      const job = spaceJobs(spaceId).find(j => j.id === jobId);
      if (!job) throw new Error('Job not found in this space.');
      return job;
    }

    function advance(job) {
      job.done.push(job.stageId);
      const next = job.stageIds[job.stageIds.indexOf(job.stageId) + 1];
      job.stageId = next || null;
    }

    function jobView(job) {
      const workflow = WORKFLOWS[job.workflowId];
      return { id: job.id, spaceId: job.spaceId, workflowId: job.workflowId, tier: job.tier, name: job.name,
        stageId: job.stageId, waitingOnJax: job.waitingOnJax, finished: job.stageId === null,
        stages: stagesFor(workflow, job.tier).map(st => ({ ...st, needsDone: job.needs[st.id] ? [...job.needs[st.id]] : st.needs.map(() => false),
          hasNotes: !!job.notes[st.id], status: job.done.includes(st.id) ? 'done'
            : st.id === job.stageId ? (job.waitingOnJax ? 'waiting-on-jax' : 'current') : 'upcoming' })) };
    }

    function jobSummary(job) {
      const current = WORKFLOWS[job.workflowId].stages.find(st => st.id === job.stageId);
      return { id: job.id, name: job.name, workflowId: job.workflowId, tier: job.tier,
        stage: job.stageId === null ? 'Finished' : job.waitingOnJax ? `${current.name} (waiting on Jax)` : current.name,
        progress: Math.round((job.done.length / job.stageIds.length) * 100) };
    }

    async function update(spaceId, assetId, change) {
      requireSpace(spaceId);
      const asset = spaceAssets(spaceId).find(a => a.id === assetId);
      if (!asset) throw new Error('Asset not found in this space.');
      change(asset);
      emit('assets-changed', { spaceId });
      return clone(asset);
    }
  }

  return { createSampleService };
});
