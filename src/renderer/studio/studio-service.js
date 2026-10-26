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
    ['pitch-deck', 'Pitch deck', 'workflow', 'available'],
    ['deck-builder', 'Deck builder', 'tool', 'coming-soon'],
    ['homepage-builder', 'Home page builder', 'tool', 'coming-soon'],
    ['research', 'Research', 'tool', 'coming-soon'],
    ['auto-check', 'Auto check', 'tool', 'coming-soon'],
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
  // Stages in a group are open at the same time; the stage after the group opens when all of them are done.
  const GROUP = (group, groupName, stage) => Object.freeze({ ...stage, group, groupName });
  const WORKFLOWS = Object.freeze({
    website: Object.freeze({
      id: 'website', name: 'Website', version: 1,
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
    // Pitch deck (docs/PLAN.md): started inside a client project; the Job is locked (stages never change).
    'pitch-deck': Object.freeze({
      // version: bump when the stages change; running Jobs keep the stages they started with.
      id: 'pitch-deck', name: 'Pitch deck', version: 1, clientOnly: true, locked: true, oneAtATime: true,
      people: Object.freeze(['jax', 'tyler']), // Pitch deck project: Jax and Tyler only
      tiers: Object.freeze([
        Object.freeze({ id: 'deck', name: 'Market Opportunity', description: 'A hosted page built from the prospect\'s own numbers, plus a printed QR card.' }),
      ]),
      stages: Object.freeze([
        // Research + write: the agent finds the numbers and drafts the words; the builder checks and edits.
        STAGE('research', 'Research + write', 'Meridian finds the prospect\'s real numbers and drafts the words; the builder checks and edits.', ['research', 'deck-builder'], ['Business matched', 'Evidence gathered', 'Words drafted', 'Builder edited'], 'Deck passes the checker and the evidence guard', 'team', ['deck']),
        // Three home-page builds shown at the bottom of the board (home page only, not full sites); built side by side.
        GROUP('home', 'Home pages', STAGE('home-t1', 'Home page: Tier 1', 'The essentials: clear offer, services, one way to get in touch.', ['homepage-builder', 'image-gen'], ['Home page built', 'Desktop and phone capture', '"Concept for discussion" line'], 'Uses the prospect\'s real name and services', 'team', ['deck'])),
        GROUP('home', 'Home pages', STAGE('home-t2', 'Home page: Tier 2', 'A bolder custom concept with a stronger story and booking path.', ['homepage-builder', 'image-gen'], ['Home page built', 'Desktop and phone capture', '"Concept for discussion" line'], 'Clearly a step up from Tier 1', 'team', ['deck'])),
        GROUP('home', 'Home pages', STAGE('home-t3', 'Home page: Tier 3', 'The full immersive experience: motion and video moments.', ['homepage-builder', 'image-gen', 'video'], ['Home page built', 'Desktop and phone capture', '"Concept for discussion" line'], 'Clearly a step up from Tier 2', 'team', ['deck'])),
        STAGE('assemble', 'Assemble board', 'Meridian builds the interactive board from the deck data and the three home pages.', ['deck-builder'], ['Board built', 'Saved to project files'], 'Board opens with no errors', 'team', ['deck']),
        // Automatic: Meridian runs every check; a person only reviews what gets flagged.
        Object.freeze({ ...STAGE('check', 'Auto check', 'Meridian runs every check; a person reviews only what gets flagged.', ['auto-check'], ['Deck checker', 'Evidence guard', 'Phone screenshot', 'Link check', 'Internal-words scan'], 'No open flags', 'team', ['deck']), automatic: true }),
        STAGE('review', 'Review', 'Jax reviews before the prospect sees it.', [], ['Share link for Jax'], 'Jax approves', 'jax', ['deck']),
        STAGE('publish', 'Publish', 'Put the page live and make the QR code.', [], ['Live link', 'QR code'], 'Link opens on a phone', 'jax', ['deck']),
        STAGE('print', 'Print card', 'Make the leave-behind with the QR code.', ['deck-builder'], ['Print-ready card'], 'QR scans from print', 'team', ['deck']),
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

  // Sample team; the server supplies the real list.
  const PEOPLE = Object.freeze([['jax', 'Jax'], ['tyler', 'Tyler'], ['cassy', 'Cassy']].map(([id, name]) => Object.freeze({ id, name })));

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
    const now = typeof options.now === 'function' ? options.now : () => Date.now(); // tests pass a fake clock
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

    function startLocalJob(space, workflowId, tier, extra = {}) {
      const workflow = WORKFLOWS[workflowId];
      const stages = stagesFor(workflow, tier);
      const n = spaceJobs(space.id).filter(j => j.workflowId === workflowId).length + 1;
      const job = { id: nextId('job'), spaceId: space.id, workflowId, tier, name: `${workflow.name} v${n}`,
        stageIds: Object.freeze(stages.map(st => st.id)), stageDefs: Object.freeze(stages), templateVersion: workflow.version || 1,
        done: [], stageId: stages[0].id, waitingOnJax: false, notes: {}, needs: {}, assignees: {}, timing: {}, locked: false, template: null, ...extra };
      stampOpened(job);
      spaceJobs(space.id).push(job);
      return job;
    }

    // Who builds each stage, picked at the start. Stages Jax approves are always his.
    function checkAssignees(workflow, tier, input) {
      if (input === undefined || input === null) return {};
      if (typeof input !== 'object' || Array.isArray(input)) throw new Error('Assignments must be an object.');
      const stages = stagesFor(workflow, tier), out = {};
      for (const [stageId, personId] of Object.entries(input)) {
        const stage = stages.find(st => st.id === stageId);
        if (!stage) throw new Error('Unknown stage.');
        if (stage.approver === 'jax') throw new Error('Jax approves this stage; it stays with him.');
        if (personId !== null && !peopleFor(workflow).some(x => x.id === personId)) throw new Error('Pick someone on the team.');
        out[stageId] = personId;
      }
      return out;
    }

    function peopleFor(workflow) {
      return workflow && workflow.people ? PEOPLE.filter(x => workflow.people.includes(x.id)) : PEOPLE;
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
      /** Starts a Job (one workflow run). tier: 'standard' | 'cinematic' (Pitch deck: 'deck').
       *  options.assignees: { stageId: personId } picks who builds each stage at the start. */
      async startJob(spaceId, workflowId, tier, options = {}) {
        const space = requireSpace(spaceId);
        const workflow = WORKFLOWS[workflowId];
        if (!workflow) throw new Error('That workflow is coming soon.');
        if (!workflow.tiers.some(t => t.id === tier)) throw new Error(workflowId === 'website' ? 'Pick Standard or Cinematic.' : 'Pick a tier.');
        if (workflow.clientOnly && space.type !== 'client') throw new Error(`${workflow.name} only runs inside a client project.`);
        if (workflow.oneAtATime && spaceJobs(space.id).some(j => j.workflowId === workflowId && j.stageId !== null)) {
          throw new Error(`This project already has a ${workflow.name.toLowerCase()} in progress.`);
        }
        const assignees = checkAssignees(workflow, tier, options && options.assignees);
        const job = startLocalJob(space, workflowId, tier, { assignees,
          locked: !!workflow.locked, template: workflow.locked ? `${workflowId}-starter` : null });
        emit('jobs-changed', { spaceId: space.id });
        return clone(jobView(job));
      },
      /** Who stages can be assigned to; pass a workflowId for that workflow's team (Pitch deck: Jax and Tyler). */
      async listPeople(workflowId) { return clone(peopleFor(WORKFLOWS[workflowId])); },
      /** Assigns one stage of a Job to a person (or null to unassign). Stages Jax approves always stay with Jax. */
      async assignStage(spaceId, jobId, stageId, personId) {
        requireSpace(spaceId);
        const job = requireJob(spaceId, jobId);
        const stage = stageOf(job, stageId);
        if (!stage) throw new Error('Unknown stage.');
        if (stage.approver === 'jax') throw new Error('Jax approves this stage; it stays with him.');
        if (job.done.includes(stageId)) throw new Error('This stage is finished.');
        if (personId !== null && !peopleFor(WORKFLOWS[job.workflowId]).some(x => x.id === personId)) throw new Error('Pick someone on the team.');
        job.assignees[stageId] = personId;
        emit('jobs-changed', { spaceId });
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
      /** Marks a stage done and moves on. stageId is optional (default: the current stage); inside a group
       *  (e.g. the three home pages) any open stage can be finished. Stages Jax approves wait on him instead. */
      async completeStage(spaceId, jobId, stageId) {
        requireSpace(spaceId);
        const job = requireJob(spaceId, jobId);
        if (job.stageId === null) throw new Error('This job is finished.');
        const target = stageId === undefined || stageId === null ? job.stageId : stageId;
        if (!openStages(job).includes(target)) throw new Error('That stage isn\'t open yet.');
        const stage = stageOf(job, target);
        if (stage.approver === 'jax') {
          job.waitingOnJax = true; emit('jobs-changed', { spaceId });
          later(() => { if (job.waitingOnJax) { job.waitingOnJax = false; advance(job); emit('jobs-changed', { spaceId }); } });
          return clone(jobView(job));
        }
        advance(job, target);
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
      /** Ticks or unticks one "This stage needs" item (by index) on an open stage (default: the current one). */
      async setStageNeed(spaceId, jobId, index, checked, stageId) {
        requireSpace(spaceId);
        const job = requireJob(spaceId, jobId);
        const target = stageId === undefined || stageId === null ? job.stageId : stageId;
        const stage = openStages(job).includes(target) ? stageOf(job, target) : null;
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

    // A Job's own copy of its stages (kept from when it started, so later template changes can't break it).
    function stageOf(job, stageId) { return job.stageDefs.find(st => st.id === stageId) || null; }

    // Stages that can be worked on now: the current stage, or every unfinished stage in its group.
    function openStages(job) {
      if (job.stageId === null) return [];
      const current = stageOf(job, job.stageId);
      if (!current.group) return [job.stageId];
      return job.stageDefs.filter(st => st.group === current.group && !job.done.includes(st.id)).map(st => st.id);
    }

    function advance(job, stageId = job.stageId) {
      if (!job.done.includes(stageId)) job.done.push(stageId);
      (job.timing[stageId] || (job.timing[stageId] = {})).doneAt = now();
      job.stageId = job.stageIds.find(id => !job.done.includes(id)) || null;
      stampOpened(job);
    }

    // Stage timing: when each stage opened and finished (shown to Jax to find where the hours go).
    function stampOpened(job) {
      for (const id of openStages(job)) if (!job.timing[id]) job.timing[id] = { openedAt: now() };
    }
    function timingView(t) {
      if (!t) return null;
      const iso = ms => (Number.isFinite(ms) ? new Date(ms).toISOString() : null);
      return { openedAt: iso(t.openedAt), doneAt: iso(t.doneAt),
        minutes: Number.isFinite(t.openedAt) && Number.isFinite(t.doneAt) ? Math.round((t.doneAt - t.openedAt) / 60000) : null };
    }

    function jobView(job) {
      const open = openStages(job);
      return { id: job.id, spaceId: job.spaceId, workflowId: job.workflowId, tier: job.tier, name: job.name,
        stageId: job.stageId, openStageIds: open, waitingOnJax: job.waitingOnJax, finished: job.stageId === null,
        locked: !!job.locked, template: job.template || null, templateVersion: job.templateVersion,
        stages: job.stageDefs.map(st => ({ ...st, needsDone: job.needs[st.id] ? [...job.needs[st.id]] : st.needs.map(() => false),
          assignee: st.approver === 'jax' ? 'jax' : (job.assignees[st.id] || null), timing: timingView(job.timing[st.id]),
          hasNotes: !!job.notes[st.id], status: job.done.includes(st.id) ? 'done'
            : open.includes(st.id) ? (job.waitingOnJax ? 'waiting-on-jax' : 'current') : 'upcoming' })) };
    }

    function jobSummary(job) {
      const current = job.stageId === null ? null : stageOf(job, job.stageId);
      const group = current && current.group ? job.stageDefs.filter(st => st.group === current.group) : null;
      const label = !current ? '' : group ? `${current.groupName} (${group.filter(st => job.done.includes(st.id)).length} of ${group.length} done)` : current.name;
      return { id: job.id, name: job.name, workflowId: job.workflowId, tier: job.tier,
        stage: !current ? 'Finished' : job.waitingOnJax ? `${label} (waiting on Jax)` : label,
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

  /**
   * Real server (#48): Team Hub's /api/studio/ endpoints through Connect's main process.
   * request(method, endpoint, body) -> { success, data } | { success:false, status, error, code, uncertain }.
   * Spaces, presets, assets, image making, Review and version history are real. Workflows, Jobs and
   * stage notes still run locally (the `local` sample service) until the server has them; nothing
   * there costs money. Approvals never happen here: Jax approves from Command.
   */
  function createServerService({ request, local }) {
    if (typeof request !== 'function') throw new TypeError('Server Studio needs a request function.');
    local = local || createSampleService();
    const listeners = new Set();
    const emit = (event, detail) => { for (const fn of listeners) { try { fn(event, detail); } catch (_) { /* a listener failed */ } } };
    const enc = encodeURIComponent;
    const fail = res => {
      const error = new Error(res.error || 'Studio could not do that.');
      error.code = res.code || ''; error.status = res.status || 0; error.uncertain = Boolean(res.uncertain);
      throw error;
    };
    async function call(method, endpoint, body) {
      const res = await request(method, endpoint, body);
      if (!res || !res.success) fail(res || {});
      return res.data;
    }
    const fileUrl = a => `meridian-media://studio/${enc(a.spaceId)}/${enc(a.id)}`;
    const asset = a => ({ ...a, url: fileUrl(a) });
    // Same input -> same id, so a retry is recognised by the server and never paid twice.
    const safeRequestId = id => String(id || '').replace(/[^A-Za-z0-9_-]/g, '-').slice(-128) || `r-${Date.now().toString(36)}`;
    const notOnServerYet = () => { throw new Error('Coming soon with the real server.'); };
    const notHere = () => { throw new Error('Only Jax approves, from Command.'); };

    async function listAssets(spaceId, { query = '', includeTrash = false } = {}) {
      const q = new URLSearchParams();
      if (query) q.set('q', String(query).slice(0, 100));
      if (includeTrash) q.set('trash', '1');
      const qs = q.toString();
      return (await call('GET', `/api/studio/spaces/${enc(spaceId)}/assets${qs ? `?${qs}` : ''}`)).map(asset);
    }
    async function action(spaceId, assetId, verb, body) {
      const out = asset(await call('POST', `/api/studio/spaces/${enc(spaceId)}/assets/${enc(assetId)}/${verb}`, body));
      emit('assets-changed', { spaceId });
      return out;
    }

    return Object.freeze({
      mode: 'server',
      setProjects(list) { local.setProjects(list); emit('spaces-changed'); },
      async listSpaces() { return call('GET', '/api/studio/spaces'); },
      async getSpace(spaceId) {
        const space = await call('GET', `/api/studio/spaces/${enc(spaceId)}`);
        let jobs = [];
        try { jobs = (await local.getSpace(spaceId)).jobs || []; } catch (_) { jobs = []; }
        return { ...space, jobs };
      },
      async listTools() { return local.listTools(); },
      async listPresets(toolId) { return call('GET', `/api/studio/presets?tool=${enc(toolId)}`); },
      listAssets,
      async keepAsset(spaceId, assetId) { return action(spaceId, assetId, 'keep'); },
      async trashAsset(spaceId, assetId) { return action(spaceId, assetId, 'trash'); },
      async restoreAsset(spaceId, assetId) { return action(spaceId, assetId, 'restore'); },
      async sendToReview(spaceId, assetId, note = '') { return action(spaceId, assetId, 'review', { note: String(note).slice(0, 500) }); },
      async listReview(spaceId) { return (await call('GET', `/api/studio/spaces/${enc(spaceId)}/review`)).map(asset); },
      async listVersions(spaceId, assetId) {
        return (await call('GET', `/api/studio/spaces/${enc(spaceId)}/assets/${enc(assetId)}/versions`)).map(asset);
      },
      async generateImage(req) {
        const r = req || {};
        const out = await call('POST', `/api/studio/spaces/${enc(r.spaceId)}/generate`, {
          requestId: safeRequestId(r.requestId), presetId: r.presetId, description: r.description,
          count: [1, 2, 4].includes(r.count) ? r.count : 4, ...(r.jobId ? { jobId: r.jobId, stageId: r.stageId } : {}),
        });
        emit('assets-changed', { spaceId: r.spaceId });
        return { ...out, requestId: r.requestId || out.requestId,
          results: (out.results || []).map(x => ({ ...x, url: fileUrl({ spaceId: r.spaceId, id: x.assetId }) })) };
      },
      saveVersion: notOnServerYet,
      copyToSpace: notOnServerYet,
      listPeople: (...a) => local.listPeople(...a),
      assignStage: (...a) => local.assignStage(...a),
      approveAsset: notHere,
      approveStage: notHere,
      // Local until the server has Jobs (no cost involved).
      getWorkflow: (...a) => local.getWorkflow(...a),
      startJob: (...a) => local.startJob(...a),
      getJob: (...a) => local.getJob(...a),
      listJobs: (...a) => local.listJobs(...a),
      completeStage: (...a) => local.completeStage(...a),
      setStageNeed: (...a) => local.setStageNeed(...a),
      getStageNotes: (...a) => local.getStageNotes(...a),
      saveStageNotes: (...a) => local.saveStageNotes(...a),
      draftCopy: (...a) => local.draftCopy(...a),
      async listJobAssets(spaceId, jobId) {
        const job = await local.getJob(spaceId, jobId);
        const byStage = {};
        for (const st of job.stages) byStage[st.id] = [];
        for (const a of await listAssets(spaceId)) if (a.jobId === job.id && byStage[a.stageId]) byStage[a.stageId].push(a);
        return byStage;
      },
      on(listener) {
        if (typeof listener !== 'function') throw new TypeError('Listener must be a function.');
        listeners.add(listener);
        const offLocal = local.on((event, detail) => { if (event !== 'assets-changed') listener(event, detail); });
        return () => { listeners.delete(listener); offLocal(); };
      },
    });
  }

  return { createSampleService, createServerService };
});
