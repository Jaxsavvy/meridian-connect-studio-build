/* Meridian Studio service: the ONE place screens and tools get data from.
 * Core lane. Today it runs on built-in SAMPLE data so Tyler and Cassy can build
 * screens and tools without the cloud server. In Wave 1 the same methods will
 * call the server instead; screens and tools must not change when that happens.
 * Rules (docs/PLAN.md): no costs anywhere, no keys, no client mixing. */
'use strict';

(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  // Pitch deck format (#114) and research model (#124): index.html loads them before this file.
  const api = factory(node ? require('./decks/deck-data.js') : root && root.MeridianDeckData,
    node ? require('./decks/research-model.js') : root && root.MeridianResearchModel);
  if (node) module.exports = api;
  if (root) root.MeridianStudioService = api;
})(typeof window === 'undefined' ? null : window, function (DeckData, Research) {
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

  // Auto check (#131): words that must never reach a prospect's board: pricing, money signs, team names, internal notes.
  // The "$" prefix on a market stat is allowed (Jax, 2026-10-26); links, ids and assets aren't board text.
  const INTERNAL_WORDS = Object.freeze([/\bpric(?:e|es|ing)\b/i, /[$€£]/, /\bno clients\b/i, /\binternal\b/i, /\bdraft\b/i, /\btbd\b/i,
    new RegExp(`\\b(?:${PEOPLE.map(p => p.name).join('|')})\\b`, 'i')]);
  const NOT_BOARD_TEXT = Object.freeze(['prefix', 'url', 'placeId', 'desktopAsset', 'phoneAsset']);
  const CHECKS_NOT_RUN = Object.freeze(['phone-screenshot', 'links-open']);   // on the server, with the board (#131 part 2)
  // Every text field in a deck as [path, key, text].
  function deckText(value, path = '', out = []) {
    if (Array.isArray(value)) value.forEach((v, i) => deckText(v, `${path}.${i}`, out));
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) {
      if (typeof v === 'string') out.push([path ? `${path}.${k}` : k, k, v]); else deckText(v, path ? `${path}.${k}` : k, out);
    }
    return out;
  }

  const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
  // Files saved into a project's folder (Files tab, Docs section): text only, safe names, named after the Job.
  const FILE_NAME = /^[A-Za-z0-9 ._()-]{1,140}\.(md|json|html|txt)$/;
  const MAX_FILE = 5 * 1024 * 1024;
  function projectFileList(jobName, files) {
    if (!Array.isArray(files) || !files.length || files.length > 10) throw new Error('Save 1 to 10 files at a time.');
    return files.map(f => {
      const base = String((f && f.name) || '').trim();
      const name = `${jobName} - ${base}`;
      if (!FILE_NAME.test(name) || name.includes('..')) throw new Error('Use a normal file name ending in .md, .json, .html or .txt.');
      if (typeof f.content !== 'string') throw new Error('File content must be text.');
      if (new TextEncoder().encode(f.content).length > MAX_FILE) throw new Error('A file can be 5 MB at most.');
      return { name, content: f.content };
    });
  }
  const clone = value => JSON.parse(JSON.stringify(value));
  // What a pitch deck Job keeps in the project's save file (#171); the stages always come from the current template.
  const SAVED_FIELDS = Object.freeze(['id', 'workflowId', 'tier', 'name', 'templateVersion', 'done', 'stageId', 'waitingOnJax', 'needs',
    'assignees', 'timing', 'deck', 'evidence', 'research', 'checks', 'checkLog']);

  function sampleImage(label, hue) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="hsl(${hue},45%,22%)"/>` +
      `<text x="50%" y="50%" fill="#e8eef7" font-family="sans-serif" font-size="22" text-anchor="middle">${label.replace(/[<>&"]/g, '')}</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  // Practice research (sample mode only): made-up evidence for a made-up market, never real Google data.
  const SAMPLE_RIVALS = Object.freeze({ 'sample-place-rival-1': 'Summit Services (sample)',
    'sample-place-rival-2': 'Valley Pros (sample)', 'sample-place-rival-3': 'Northside Crew (sample)' });
  // Two lookalike businesses, so the person confirms which one is the prospect.
  const sampleCandidates = name => [
    { placeId: 'sample-place-you-0001', name, address: '100 Main St, Sample Town' },
    { placeId: 'sample-place-you-0002', name: `${name} (other location)`, address: '9 Oak Ave, Sample Town' },
  ];
  function sampleEvidence(fetchedAt, you = 'sample-place-you-0001') {
    const maps = { label: 'Google Maps', url: 'https://www.google.com/maps' };
    let n = 0;
    const fact = (kind, subject, field, value, method = 'api', source = maps) => ({ id: `ev-${++n}`, kind, subject, field, value, method, source, fetchedAt });
    const place = (subject, placeId, rank) => ({ id: `ev-${++n}`, kind: 'place', subject, placeId, rank, method: 'api', source: maps, fetchedAt });
    const site = { label: 'Website check (sample)', url: 'https://pagespeed.web.dev/' };
    const census = { label: 'US Census Bureau (sample)', url: 'https://data.census.gov/' };
    return [
      place('client', you, 2),
      ...Object.keys(SAMPLE_RIVALS).map((id, i) => place('competitor', id, [1, 3, 4][i])),
      ...[['website', true], ['phone', true], ['hours', true], ['categories', true], ['photos', false]].map(([f, v]) => fact('profile', 'client', f, v)),
      ...[['speed', 58], ['https', true], ['phoneLink', true], ['contactForm', false], ['social', true], ['adsPixel', false]]
        .map(([f, v]) => fact('website', 'client', f, v, 'page-read', site)),
      fact('census', 'market', 'population', 48200, 'census', census),
      fact('census', 'market', 'households', 18100, 'census', census),
      fact('demand', 'market', 'monthlySearches', 1900, 'api', { label: 'Google Ads Keyword Planner (sample)', url: 'https://ads.google.com/' }),
    ];
  }
  // Meridian's draft words fill only what the person left blank; anything they wrote stays.
  function fillBlanks(mine, draft) {
    if (typeof draft === 'string') return typeof mine === 'string' && mine.trim() ? mine : draft;
    if (Array.isArray(draft)) {
      if (!Array.isArray(mine) || !mine.length) return draft;
      if (draft.every(x => !x || typeof x !== 'object')) return mine;   // a list of numbers or words: theirs, not mixed
      return draft.map((d, i) => (i < mine.length ? fillBlanks(mine[i], d) : d)).concat(mine.slice(draft.length));
    }
    if (draft && typeof draft === 'object') {
      const out = { ...(mine && typeof mine === 'object' ? mine : {}) };
      for (const [key, value] of Object.entries(draft)) out[key] = fillBlanks(out[key], value);
      return out;
    }
    return mine === undefined || mine === null ? draft : mine;
  }
  // A finished practice deck: numbers from the evidence (the research model), words made up.
  function sampleDeck(name, evidence, preparedOn) {
    const town = 'Sample Town';
    const draft = Research.draftDeckFromEvidence(evidence, { name, town, preparedOn, names: SAMPLE_RIVALS });
    const three = (make) => [0, 1, 2].map(make);
    const demandSource = (evidence.find(e => e.kind === 'demand') || {}).source || { label: 'Google Ads Keyword Planner (sample)', url: 'https://ads.google.com/' };
    return DeckData.validateDeck({ ...DeckData.emptyDeck({ name, town, preparedOn }), client: draft.client, score: draft.score,
      bottomLine: { headline: 'Customers are looking; most find someone else first', text: 'A practice summary of what the research found.',
        findings: three(i => ({ icon: ['search', 'star', 'window'][i], title: `Practice finding ${i + 1}`, text: 'What the numbers show, in one line.' })) },
      market: { headline: 'A large local market', stats: draft.market.stats.map((s, i) => ({ ...s, label: ['People in the area', 'Households', 'Searches a month'][i] })) },
      demand: { headline: 'Demand is steady', change: '+12%', text: 'Searches over the last year.', series: [140, 150, 145, 160, 170, 165, 175, 180],
        basis: 'Estimated from Google Ads Keyword Planner search ranges (sample).', source: demandSource },
      saturation: { headline: 'Room to grow', level: 0.4, band: 'Medium', zones: [{ name: 'North side', density: 35, open: true }, { name: 'Downtown', density: 70, open: false }],
        source: { label: 'Google Maps', url: 'https://www.google.com/maps' } },
      competitors: { ...draft.competitors, headline: 'Three businesses get most of the calls', text: 'How each one shows up online.' },
      reputation: { headline: 'Reviews matter here', text: 'Ratings and review counts show live from Google Maps.' },
      visibility: { headline: 'Second in the local search', text: 'Where the business ranks for its main search.' },
      gaps: { headline: 'Three openings', text: 'Where the business can win.',
        lanes: three(i => ({ icon: ['window', 'search', 'people'][i], title: `Opening ${i + 1}`, problem: 'What is missing today.', build: 'What we would build.', effect: 'What it changes.' })) },
      homePages: { headline: 'Three home pages', text: 'Each one a step up.',
        tiers: three(i => ({ name: `Tier ${i + 1}`, description: 'Practice home page.', url: '', desktopAsset: null, phoneAsset: null })) },
      plan: { headline: 'The first 90 days', moves: three(i => ({ name: `Move ${i + 1}`, goal: 'The goal.', detail: 'How we get there.' })),
        timeline: three(i => ({ when: `${(i + 1) * 30} days`, label: `Step ${i + 1}` })) },
    }).deck;
  }

  /** options.simulateJaxMs: in the app's sample mode only, "Jax" approves waiting stages and Review items
   *  after this many ms, so the whole flow can be clicked through without a server. Tests leave it off.
   *  options.practice: false when this backs the real server; then nothing made-up (research, words, names) is offered. */
  function createSampleService(options = {}) {
    const simulateJaxMs = Number.isFinite(options.simulateJaxMs) && options.simulateJaxMs > 0 ? options.simulateJaxMs : 0;
    const practice = options.practice !== false;
    const practiceOnly = () => { if (!practice) throw new Error('Practice research only runs in practice mode.'); };
    const now = typeof options.now === 'function' ? options.now : () => Date.now(); // tests pass a fake clock
    const later = fn => { if (simulateJaxMs) setTimeout(() => { try { fn(); } catch (_) { /* already handled */ } }, simulateJaxMs); };
    let projects = [];
    let counter = 0;
    const assets = new Map();
    const projectFiles = new Map(); // spaceId -> files saved to the project folder (sample stand-in)
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
        done: [], stageId: stages[0].id, waitingOnJax: false, notes: {}, needs: {}, assignees: {}, timing: {}, locked: false, template: null,
        deck: null, evidence: [], research: null, checks: null, checkLog: [], ...extra }; // Pitch deck only (#119, #125, #131)
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
      /** Core only: the real service keeps pitch deck Jobs in the project's folder (#171). Plain data out... */
      exportJobs(spaceId) {
        requireSpace(spaceId);
        return clone(spaceJobs(spaceId).filter(j => j.workflowId === 'pitch-deck').map(j => Object.fromEntries(SAVED_FIELDS.map(k => [k, j[k]]))));
      },
      /** ...and back in, every field checked; a Job that doesn't check out is left out. Replaces this project's pitch deck Jobs. */
      importJobs(spaceId, list) {
        const space = requireSpace(spaceId);
        const restored = (Array.isArray(list) ? list : []).map(s => restoredJob(space, s)).filter(Boolean);
        jobs.set(space.id, [...spaceJobs(space.id).filter(j => j.workflowId !== 'pitch-deck'), ...restored]);
        emit('jobs-changed', { spaceId: space.id });
        return restored.length;
      },
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
       *  (e.g. the three home pages) any open stage can be finished. Stages Jax approves wait on him instead.
       *  Pitch deck: Research + write finishes only when the deck passes the checker and the evidence guard. */
      async completeStage(spaceId, jobId, stageId) {
        const space = requireSpace(spaceId);
        const job = requireJob(spaceId, jobId);
        if (job.stageId === null) throw new Error('This job is finished.');
        const target = stageId === undefined || stageId === null ? job.stageId : stageId;
        if (!openStages(job).includes(target)) throw new Error('That stage isn\'t open yet.');
        const stage = stageOf(job, target);
        if (job.workflowId === 'pitch-deck' && target === 'research') { researchDone(job); passingDeck(space, job); }
        if (job.workflowId === 'pitch-deck' && target === 'check') checksClear(job);
        if (stage.approver === 'jax') {
          job.waitingOnJax = true; emit('jobs-changed', { spaceId });
          later(() => { if (job.waitingOnJax) { job.waitingOnJax = false; advance(job); emit('jobs-changed', { spaceId }); } });
          return clone(jobView(job));
        }
        advance(job, target);
        if (job.workflowId === 'pitch-deck' && target === 'assemble') runDeckChecks(space, job);   // Auto check runs by itself
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
      /** Saves a Job's outputs into the client project's folder (Files tab, Docs), named "<Job name> - <file>".
       *  files: [{ name: 'Research summary.md', content: '...' }]. Saving the same name again replaces it. */
      async saveToProjectFiles(spaceId, jobId, files) {
        const space = requireSpace(spaceId);
        if (space.type !== 'client') throw new Error('Only client projects have a project folder.');
        const job = requireJob(spaceId, jobId);
        const list = projectFileList(job.name, files);
        const saved = projectFiles.get(space.id) || [];
        for (const f of list) {
          const i = saved.findIndex(x => x.name === f.name);
          const row = { name: f.name, section: 'Docs', size: new TextEncoder().encode(f.content).length, jobId: job.id };
          if (i >= 0) saved[i] = row; else saved.push(row);
        }
        projectFiles.set(space.id, saved);
        emit('project-files-changed', { spaceId: space.id });
        return clone({ saved: list.map(f => f.name), failed: [] });
      },
      /** Files saved to the project folder in this session (the Files tab shows the real folder). */
      async listProjectFiles(spaceId) { requireSpace(spaceId); return clone(projectFiles.get(spaceId) || []); },
      /** The Job's pitch deck: the saved one, or a blank deck with the project name until someone saves. */
      async getDeck(spaceId, jobId) {
        const { space, job } = deckJob(spaceId, jobId);
        return clone(deckOf(space, job));
      },
      /** Saves the deck, even unfinished, and lists every field still to fix: { ok, errors: [{ path, message }], deck }.
       *  errors cover the format (deck-data.js) and the evidence guard (no number the research doesn't back). */
      async saveDeck(spaceId, jobId, deck) {
        const { space, job } = deckJob(spaceId, jobId);
        if (job.done.includes('research')) throw new Error('The deck is locked once Research + write is done.');
        if (!deck || typeof deck !== 'object' || Array.isArray(deck)) throw new Error('A deck must be a group of fields.');
        const checked = checkDeck(job, deck);
        job.deck = checked.deck;
        emit('deck-changed', { spaceId: space.id, jobId: job.id });
        return clone({ ok: checked.errors.length === 0, ...checked });
      },
      /** Markdown list of every number on the board and its source. Only for a deck that passes. */
      async getResearchSummary(spaceId, jobId) {
        const { space, job } = deckJob(spaceId, jobId);
        return DeckData.researchSummary(passingDeck(space, job));
      },
      /** What Research + write leaves in the project folder. The screen passes these to saveToProjectFiles,
       *  then finishes the stage. */
      async getResearchFiles(spaceId, jobId) {
        const { space, job } = deckJob(spaceId, jobId);
        const deck = passingDeck(space, job);
        return clone([
          { name: 'Research summary.md', content: DeckData.researchSummary(deck) },
          { name: 'Evidence.json', content: JSON.stringify(job.evidence, null, 2) },
          { name: 'Deck data.json', content: JSON.stringify(deck, null, 2) },
        ]);
      },
      /** Sample-mode stand-in for the research agent and the builder: made-up evidence and a finished deck that
       *  pass the check, so the rest of the pipeline can be clicked through. Not in real mode. */
      async useSampleResearch(spaceId, jobId) {
        practiceOnly();
        const { space, job } = deckJob(spaceId, jobId);
        if (job.done.includes('research')) throw new Error('The deck is locked once Research + write is done.');
        const today = new Date(now()).toISOString();
        job.research = { runId: nextId('run'), category: 'sample', status: 'done', candidates: sampleCandidates(space.name), placeId: 'sample-place-you-0001' };
        job.evidence = sampleEvidence(today);
        job.deck = sampleDeck(space.name, job.evidence, today.slice(0, 10));
        emit('research-changed', { spaceId: space.id, jobId: job.id });
        emit('deck-changed', { spaceId: space.id, jobId: job.id });
        return clone({ evidence: job.evidence, deck: job.deck });
      },
      /** Starts research on the deck's business (its name comes from the project). category: e.g. 'plumber'.
       *  Practice mode finds two lookalike businesses, so the person confirms the right one. Returns { runId, status }. */
      async startResearch(spaceId, jobId, { category } = {}) {
        practiceOnly();   // real research comes from the agent on the server (#126)
        const { space, job } = deckJob(spaceId, jobId);
        if (job.done.includes('research')) throw new Error('The deck is locked once Research + write is done.');
        if (job.research && job.research.status === 'running') throw new Error('Research is already running.');
        const kind = text(category, 'Category', 60);
        if (!kind || /[\u0000-\u001f\u007f]/.test(kind)) throw new Error('Say what kind of business it is (for example, plumber).');
        const run = { runId: nextId('run'), category: kind, status: 'running', candidates: [], placeId: null };
        const found = () => { run.status = 'needs-match'; run.candidates = sampleCandidates(space.name); };
        job.research = run; job.evidence = []; // a new run replaces the old evidence
        if (simulateJaxMs) later(() => { if (job.research === run && run.status === 'running') { found(); emit('research-changed', { spaceId: space.id, jobId: job.id }); } });
        else found();
        emit('research-changed', { spaceId: space.id, jobId: job.id });
        return clone({ runId: run.runId, status: run.status });
      },
      /** Where research stands. status: 'not-started' | 'running' | 'needs-match' | 'by-hand' | 'done' | 'failed'; candidates
       *  (businesses that could match), evidence, score (parts + what couldn't be found) and, once the deck passes, the summary. */
      async getResearch(spaceId, jobId) {
        const { space, job } = deckJob(spaceId, jobId);
        const run = job.research || { runId: null, category: '', status: 'not-started', candidates: [], placeId: null };
        const done = run.status === 'done';
        let summary = null;
        if (done) { try { summary = DeckData.researchSummary(passingDeck(space, job)); } catch (_) { /* the deck still needs work */ } }
        return clone({ ...run, evidence: job.evidence, score: done ? Research.scoreFromEvidence(job.evidence, {}) : null, summary });
      },
      /** The person picks which business is the prospect; then the research is done. */
      async confirmMatch(spaceId, jobId, placeId) {
        practiceOnly();
        const { space, job } = deckJob(spaceId, jobId);
        if (job.done.includes('research')) throw new Error('The deck is locked once Research + write is done.');
        const run = job.research;
        if (!run || run.status !== 'needs-match') throw new Error('There\'s no match to confirm.');
        if (!run.candidates.some(c => c.placeId === placeId)) throw new Error('Pick one of the businesses found.');
        run.placeId = placeId; run.status = 'done';
        job.evidence = sampleEvidence(new Date(now()).toISOString(), placeId);
        emit('research-changed', { spaceId: space.id, jobId: job.id });
        return clone({ runId: run.runId, status: run.status });
      },
      /** Hand-entered research: one fact a person found, with its source (method 'person', dated now). fact:
       *  { kind, subject, field, value, placeId?, rank?, source: { label, url } }; kinds and fields as in research-model.js.
       *  The same fact again replaces it. The prospect's own Google place (kind 'place', subject 'client', with its rank)
       *  confirms the business, so research is done. Google ratings and review counts are never typed in. */
      async addEvidence(spaceId, jobId, fact) {
        const { space, job } = deckJob(spaceId, jobId);
        if (job.done.includes('research')) throw new Error('The deck is locked once Research + write is done.');
        let run = job.research;
        if (run && (run.status === 'running' || run.status === 'needs-match')) throw new Error('Finish the research run first (pick the business).');
        if (!fact || typeof fact !== 'object' || Array.isArray(fact)) throw new Error('A fact must be a group of fields.');
        if (fact.kind === 'google') throw new Error('Google ratings and review counts come live from Google Maps; don\'t type them in.');
        if (typeof fact.value === 'number' && !(Number.isFinite(fact.value) && fact.value >= 0)) throw new Error('Use a number of 0 or more.');
        const source = fact.source || {};
        const record = { id: nextId('fact'), kind: fact.kind, subject: fact.subject, method: 'person',
          source: { label: text(source.label, 'Source name', 120), url: String(source.url || '') }, fetchedAt: new Date(now()).toISOString() };
        if (fact.kind === 'place') Object.assign(record, { placeId: fact.placeId, rank: fact.rank });
        else Object.assign(record, { field: fact.field, value: fact.value }, fact.subject === 'competitor' ? { placeId: fact.placeId } : {});
        const same = e => e.kind === record.kind && (record.kind === 'place'
          ? (record.subject === 'client' ? e.subject === 'client' : e.placeId === record.placeId)
          : e.field === record.field && e.subject === record.subject && e.placeId === record.placeId);
        const next = [...job.evidence.filter(e => !same(e)), record];
        const bad = Research.validateEvidence(next).errors.find(e => e.index === next.length - 1);
        if (bad) throw new Error(bad.message);
        if (!run || run.status === 'failed') run = job.research = { runId: nextId('run'), category: '', status: 'by-hand', candidates: [], placeId: null, byHand: true };
        job.evidence = next;
        if (record.kind === 'place' && record.subject === 'client') { run.placeId = record.placeId; run.status = 'done'; }
        emit('research-changed', { spaceId: space.id, jobId: job.id });
        return clone(record);
      },
      /** Removes a fact a person typed in. Facts the research agent found stay. */
      async removeEvidence(spaceId, jobId, evidenceId) {
        const { space, job } = deckJob(spaceId, jobId);
        if (job.done.includes('research')) throw new Error('The deck is locked once Research + write is done.');
        const fact = job.evidence.find(e => e.id === evidenceId);
        if (!fact || fact.method !== 'person') throw new Error('Only facts a person typed in can be removed.');
        job.evidence = job.evidence.filter(e => e !== fact);
        const run = job.research;
        if (run && run.byHand && fact.kind === 'place' && fact.subject === 'client') { run.placeId = null; run.status = 'by-hand'; }
        emit('research-changed', { spaceId: space.id, jobId: job.id });
        return clone({ removed: fact.id });
      },
      /** Puts the research into the deck: the numbers from the evidence (score, market stats, competitor rows) and
       *  Meridian's draft words in every blank field, keeping every word the person wrote. Practice words in practice
       *  mode only; in real mode just the numbers (the server agent drafts real words, #126).
       *  names: { placeId: name } typed by the person (Places names aren't stored).
       *  Returns { ok, errors, deck, missing }: missing is what research couldn't find; it's never saved in the deck. */
      async applyResearchToDeck(spaceId, jobId, { names = {} } = {}) {
        const { space, job } = deckJob(spaceId, jobId);
        if (job.done.includes('research')) throw new Error('The deck is locked once Research + write is done.');
        researchDone(job);
        const words = practice ? sampleDeck(space.name, job.evidence, new Date(now()).toISOString().slice(0, 10)) : null;
        const current = words ? fillBlanks(deckOf(space, job), words) : deckOf(space, job);
        const known = Object.fromEntries(current.competitors.rows.filter(r => r.placeId && r.name).map(r => [r.placeId, r.name]));
        const { missing, ...draft } = Research.draftDeckFromEvidence(job.evidence,
          { ...current.client, names: { ...(words ? SAMPLE_RIVALS : {}), ...known, ...(names && typeof names === 'object' ? names : {}) } }, {});
        const label = i => (current.market.stats[i] || {}).label || ((words && words.market.stats[i]) || {}).label || '';
        const checked = checkDeck(job, { ...current, client: { ...current.client, placeId: draft.client.placeId }, score: draft.score,
          market: { ...current.market, stats: draft.market.stats.map((s, i) => ({ ...s, label: label(i) })) },
          competitors: { ...current.competitors, channels: draft.competitors.channels, rows: draft.competitors.rows, source: draft.competitors.source } });
        job.deck = checked.deck;
        emit('deck-changed', { spaceId: space.id, jobId: job.id });
        return clone({ ok: checked.errors.length === 0, ...checked, missing });
      },
      /** Auto check: runs every check on the deck by itself; a person only reviews what gets flagged. Returns the
       *  flags [{ id, check, message, where, resolved }]; check is 'deck' | 'evidence' | 'links' | 'internal-words'.
       *  Runs by itself when Assemble board finishes. The phone screenshot and live link check come with the board. */
      async runChecks(spaceId, jobId) {
        const { space, job } = deckJob(spaceId, jobId);
        if (job.done.includes('check')) throw new Error('Auto check is finished.');
        return clone(runDeckChecks(space, job).flags.map(flagView));
      },
      /** The last Auto check: { ranAt, flags, notRun, log } (log: every flag a person resolved, with their note). */
      async getChecks(spaceId, jobId) {
        const { job } = deckJob(spaceId, jobId);
        const last = job.checks || { ranAt: null, flags: [] };
        return clone({ ranAt: last.ranAt, flags: last.flags.map(flagView), notRun: CHECKS_NOT_RUN, log: job.checkLog });
      },
      /** A person marks a flag OK with a note saying why; the note is logged. It stays resolved when checks re-run. */
      async resolveFlag(spaceId, jobId, flagId, note) {
        const { space, job } = deckJob(spaceId, jobId);
        if (job.done.includes('check')) throw new Error('Auto check is finished.');
        const flag = job.checks && job.checks.flags.find(f => f.id === flagId);
        if (!flag) throw new Error('Flag not found.');
        if (flag.resolved) throw new Error('This flag is already resolved.');
        const why = text(note, 'Note', 500);
        if (!why) throw new Error('Say why this is OK.');
        const at = new Date(now()).toISOString();
        flag.resolved = { note: why, at };
        job.checkLog.push({ at, flagId: flag.id, check: flag.check, where: flag.where, message: flag.message, note: why });
        emit('checks-changed', { spaceId: space.id, jobId: job.id });
        return clone(flagView(flag));
      },
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
      /** Keep for a page a tool built (e.g. Home page: Tier 1): a kept asset in an open stage of the Job.
       *  page: { name, html }. Keeping again in the same stage makes the next version of that page.
       *  Show the html only in a sandboxed iframe (never allow-same-origin), never inside Studio itself. */
      async savePageAsset(spaceId, jobId, stageId, page) {
        const space = requireSpace(spaceId);
        const job = requireJob(space.id, jobId);
        if (!openStages(job).includes(stageId) || job.waitingOnJax) throw new Error('That stage isn\'t open.');
        const name = text(page && page.name, 'Page name', 80).replace(/__v\d+$/, '');
        if (!name || /[\u0000-\u001f\u007f]/.test(name)) throw new Error('Give the page a plain name.');
        const html = page && page.html;
        if (typeof html !== 'string' || !html.trim()) throw new Error('The page is empty.');
        if (new TextEncoder().encode(html).length > MAX_FILE) throw new Error('A page can be 5 MB at most.');
        const list = spaceAssets(space.id);
        const latest = list.filter(a => a.kind === 'page' && a.jobId === job.id && a.stageId === stageId)
          .reduce((top, a) => (!top || a.version > top.version ? a : top), null);
        const version = latest ? latest.version + 1 : 1;
        const asset = { id: nextId('asset'), spaceId: space.id, name: `${name}__v${version}`, kind: 'page', html,
          url: sampleImage(name, 160), version, parentId: latest ? latest.id : null, kept: true, approved: false,
          review: null, trashed: false, createdBy: stageOf(job, stageId).tools[0] || 'studio', jobId: job.id, stageId };
        if (latest) asset.rootId = latest.rootId || latest.id;
        list.push(asset);
        emit('assets-changed', { spaceId: space.id });
        return clone(asset);
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

    // A saved pitch deck Job read back from the project folder (#171): nothing in the file is trusted as-is.
    function restoredJob(space, s) {
      const workflow = WORKFLOWS['pitch-deck'];
      if (!s || typeof s !== 'object' || s.workflowId !== 'pitch-deck' || !SAFE_ID.test(String(s.id))) return null;
      if (s.templateVersion !== workflow.version || !workflow.tiers.some(t => t.id === s.tier)) return null;
      const stages = stagesFor(workflow, s.tier), ids = stages.map(st => st.id);
      const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {}), str = (v, max = 500) => (typeof v === 'string' ? v.slice(0, max) : '');
      const done = ids.filter(id => Array.isArray(s.done) && s.done.includes(id)), timing = {}, needs = {}, assignees = {};
      for (const st of stages) {
        const tm = obj(obj(s.timing)[st.id]), need = obj(s.needs)[st.id], who = obj(s.assignees)[st.id];
        if (Number.isFinite(tm.openedAt)) timing[st.id] = { openedAt: tm.openedAt, ...(Number.isFinite(tm.doneAt) ? { doneAt: tm.doneAt } : {}) };
        if (Array.isArray(need) && need.length === st.needs.length) needs[st.id] = need.map(Boolean);
        if (st.approver !== 'jax' && peopleFor(workflow).some(x => x.id === who)) assignees[st.id] = who;
      }
      const stageId = ids.find(id => !done.includes(id)) || null, r = obj(s.research), c = obj(s.checks);
      const research = ['by-hand', 'done', 'failed'].includes(r.status) ? { runId: str(r.runId, 40), category: str(r.category, 60), status: r.status,
        candidates: [], placeId: /^[A-Za-z0-9_-]{10,300}$/.test(String(r.placeId)) ? r.placeId : null, byHand: !!r.byHand } : null;
      const flag = f => ({ id: str(f.id, 40), key: str(f.key), check: str(f.check, 40), message: str(f.message), where: str(f.where, 200),
        resolved: f.resolved && typeof f.resolved === 'object' ? { note: str(f.resolved.note), at: str(f.resolved.at, 40) } : null });
      const entries = list => (Array.isArray(list) ? list : []).filter(x => x && typeof x === 'object');
      for (const m of JSON.stringify(s).matchAll(/"(?:job|fact|flag|run)-(\d+)"/g)) counter = Math.max(counter, Number(m[1]));   // new ids never clash
      return { id: String(s.id), spaceId: space.id, workflowId: 'pitch-deck', tier: s.tier, name: str(s.name, 80) || workflow.name,
        stageIds: Object.freeze(ids), stageDefs: Object.freeze(stages), templateVersion: workflow.version, done, stageId,
        waitingOnJax: !!s.waitingOnJax && stageId !== null && stages.find(st => st.id === stageId).approver === 'jax',
        notes: {}, needs, assignees, timing, locked: true, template: 'pitch-deck-starter',
        deck: s.deck && typeof s.deck === 'object' ? DeckData.validateDeck(s.deck).deck : null,
        evidence: Array.isArray(s.evidence) && Research.validateEvidence(s.evidence).ok ? s.evidence : [], research,
        checks: Array.isArray(c.flags) ? { ranAt: str(c.ranAt, 40), flags: entries(c.flags).map(flag) } : null,
        checkLog: entries(s.checkLog).map(x => ({ at: str(x.at, 40), flagId: str(x.flagId, 40), check: str(x.check, 40), where: str(x.where, 200),
          message: str(x.message), note: str(x.note) })) };
    }

    // Pitch deck data (#119): each Job keeps its own deck and the evidence its numbers come from.
    function deckJob(spaceId, jobId) {
      const space = requireSpace(spaceId);
      const job = requireJob(space.id, jobId);
      if (job.workflowId !== 'pitch-deck') throw new Error('Only pitch deck Jobs have a deck.');
      return { space, job };
    }
    function deckOf(space, job) {
      if (!DeckData || !Research) throw new Error('The pitch deck tools aren\'t loaded.');
      return job.deck || DeckData.emptyDeck({ name: space.name });
    }
    // Every field still to fix: the format check plus the evidence guard. Live Google values come with #127.
    function checkDeck(job, input) {
      const { deck, errors } = DeckData.validateDeck(input);
      return { deck, errors: [...errors, ...Research.checkDeckAgainstEvidence(deck, job.evidence, {})] };
    }
    function researchDone(job) {
      if (!job.research || job.research.status !== 'done') {
        throw new Error('Research + write isn\'t done yet: run the research and confirm the business first.');
      }
    }
    function passingDeck(space, job) {
      const deck = deckOf(space, job);
      const n = checkDeck(job, deck).errors.length;
      if (n) throw new Error(`Research + write isn't done yet: ${n} ${n === 1 ? 'field still needs' : 'fields still need'} work.`);
      return deck;
    }

    // Auto check (#131 part 1): the deck checker, the evidence guard, secure links and the internal-words scan.
    function runDeckChecks(space, job) {
      const deck = deckOf(space, job), found = [];
      const flag = (check, message, where) => found.push({ check, message, where });
      for (const e of DeckData.validateDeck(deck).errors) flag('deck', e.message, e.path);
      for (const e of Research.checkDeckAgainstEvidence(deck, job.evidence, {})) flag('evidence', e.message, e.path);
      for (const [where, key, value] of deckText(deck)) {
        if (key === 'url') { if (value && !value.startsWith('https://')) flag('links', 'Use a secure https:// link.', where); continue; }
        if (NOT_BOARD_TEXT.includes(key)) continue;
        const hit = INTERNAL_WORDS.map(word => value.match(word)).find(Boolean);
        if (hit) flag('internal-words', `Internal word on the board: "${hit[0]}".`, where);
      }
      // A flag a person already resolved stays resolved when the same thing is found again.
      const before = new Map(((job.checks && job.checks.flags) || []).map(f => [f.key, f]));
      job.checks = { ranAt: new Date(now()).toISOString(), flags: found.map(f => {
        const key = `${f.check}|${f.where}|${f.message}`;
        return before.get(key) || { id: nextId('flag'), key, ...f, resolved: null };
      }) };
      emit('checks-changed', { spaceId: space.id, jobId: job.id });
      return job.checks;
    }
    function checksClear(job) {
      if (!job.checks) throw new Error('Auto check hasn\'t run yet.');
      const n = job.checks.flags.filter(f => !f.resolved).length;
      if (n) throw new Error(`Auto check isn't done: ${n} ${n === 1 ? 'flag' : 'flags'} to review.`);
    }
    function flagView(f) { return { id: f.id, check: f.check, message: f.message, where: f.where, resolved: f.resolved }; }

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
  function createServerService({ request, local, saveFile, readSave }) {
    if (typeof request !== 'function') throw new TypeError('Server Studio needs a request function.');
    local = local || createSampleService({ practice: false });   // nothing made-up in real mode
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

    // Pitch deck Jobs live in each client project's folder (Docs) until the server has Jobs (#120), so they survive a restart
    // and Jax and Tyler see the same deck. A revision number stops one person's save from silently replacing another's.
    const SAVE_FILE = 'Pitch deck - Studio save.json';
    const saves = new Map(); // spaceId -> { revision, loading, dirty }
    const keeps = async spaceId => typeof readSave === 'function' && typeof saveFile === 'function'
      && (await local.listSpaces()).some(s => s.id === spaceId && s.type === 'client');
    async function readSaved(spaceId) {
      const res = await readSave(spaceId);
      if (res && res.missing) return { revision: 0, jobs: [] };
      if (!res || !res.success) throw new Error('Couldn\'t reach the project folder. Check your connection, then try again.');
      let data = null;
      try { data = JSON.parse(res.content); } catch (_) { /* checked below */ }
      if (!data || data.version !== 1 || !Array.isArray(data.jobs)) throw new Error('The saved pitch deck in the project folder can\'t be read. Ask Jax before changing it.');
      return { revision: Number(data.revision) || 0, jobs: data.jobs };
    }
    async function loadSaved(spaceId) {
      if (!(await keeps(spaceId))) return null;
      const entry = saves.get(spaceId) || { revision: 0, loading: null, dirty: false };
      saves.set(spaceId, entry);
      if (!entry.loading) {
        entry.loading = readSaved(spaceId).then(data => { entry.revision = data.revision; local.importJobs(spaceId, data.jobs); })
          .catch(error => { entry.loading = null; throw error; });
      }
      await entry.loading;
      return entry;
    }
    // When the project's Jobs are listed, pick up a newer save (e.g. Tyler's), unless this computer has a change still to save.
    async function refreshSaved(spaceId) {
      const entry = await loadSaved(spaceId);
      if (!entry || entry.dirty) return;
      const remote = await readSaved(spaceId);
      if (remote.revision > entry.revision) { entry.revision = remote.revision; local.importJobs(spaceId, remote.jobs); }
    }
    async function saveJobs(spaceId) {
      const entry = await loadSaved(spaceId);
      if (!entry) return;
      const remote = await readSaved(spaceId);
      if (remote.revision !== entry.revision) {   // someone else saved first: take theirs, so nothing is silently lost
        entry.revision = remote.revision; entry.dirty = false; local.importJobs(spaceId, remote.jobs);
        throw new Error('Someone else saved this deck a moment ago. Studio loaded their version; please do your last change again.');
      }
      const revision = entry.revision + 1;
      const res = await saveFile(spaceId, SAVE_FILE, JSON.stringify({ version: 1, revision, savedAt: new Date().toISOString(), jobs: local.exportJobs(spaceId) }));
      if (!res || !res.success) { entry.dirty = true; throw new Error('Couldn\'t save to the project folder. Your change is kept on this computer and saves with your next change.'); }
      entry.revision = revision; entry.dirty = false;
    }
    const loaded = method => async (spaceId, ...rest) => { await loadSaved(spaceId); return local[method](spaceId, ...rest); };
    // Saves after the change; pitchDeckOnly: only when the Job the call returns is a pitch deck (Website Jobs stay local for now).
    const saved = (method, pitchDeckOnly = false) => async (spaceId, ...rest) => {
      await loadSaved(spaceId);
      const out = await local[method](spaceId, ...rest);
      if (!pitchDeckOnly || (out && out.workflowId === 'pitch-deck')) await saveJobs(spaceId);
      return out;
    };

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
        try { await refreshSaved(spaceId); jobs = (await local.getSpace(spaceId)).jobs || []; } catch (_) { jobs = []; }
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
      savePageAsset: notOnServerYet, // until Team Hub stores pages; Finish still saves them to the project folder
      listPeople: (...a) => local.listPeople(...a),
      assignStage: saved('assignStage', true),
      approveAsset: notHere,
      approveStage: notHere,
      // Local until the server has Jobs (no cost involved).
      getWorkflow: (...a) => local.getWorkflow(...a),
      // Pitch deck Jobs are saved to the project folder after every change (#171).
      startJob: saved('startJob', true),
      getJob: loaded('getJob'),
      async listJobs(spaceId) { await refreshSaved(spaceId); return local.listJobs(spaceId); },
      completeStage: saved('completeStage', true),
      setStageNeed: saved('setStageNeed', true),
      getStageNotes: (...a) => local.getStageNotes(...a),
      saveStageNotes: (...a) => local.saveStageNotes(...a),
      draftCopy: (...a) => local.draftCopy(...a),
      getDeck: loaded('getDeck'),
      saveDeck: saved('saveDeck'),
      getResearchSummary: loaded('getResearchSummary'),
      getResearchFiles: loaded('getResearchFiles'),
      // Real decks get their evidence from the research agent on the server (#126), never from practice data.
      async useSampleResearch() { throw new Error('Practice research only runs in practice mode.'); },
      startResearch: async () => notOnServerYet(),
      confirmMatch: async () => notOnServerYet(),
      // Hand-entered research works now (local, like Jobs); the numbers go into the deck, never practice words.
      getResearch: loaded('getResearch'),
      addEvidence: saved('addEvidence'),
      removeEvidence: saved('removeEvidence'),
      applyResearchToDeck: saved('applyResearchToDeck'),
      runChecks: saved('runChecks'),
      getChecks: loaded('getChecks'),
      resolveFlag: saved('resolveFlag'),
      async listJobAssets(spaceId, jobId) {
        await loadSaved(spaceId);
        const job = await local.getJob(spaceId, jobId);
        const byStage = {};
        for (const st of job.stages) byStage[st.id] = [];
        for (const a of await listAssets(spaceId)) if (a.jobId === job.id && byStage[a.stageId]) byStage[a.stageId].push(a);
        return byStage;
      },
      /** Saves a Job's outputs into the real project folder (Files tab, Docs section) through Connect. */
      async saveToProjectFiles(spaceId, jobId, files) {
        if (typeof saveFile !== 'function') throw new Error('Saving to the project folder isn\'t available here.');
        await loadSaved(spaceId);
        const job = await local.getJob(spaceId, jobId);
        const list = projectFileList(job.name, files);
        const saved = [], failed = [];
        for (const f of list) {
          const res = await saveFile(spaceId, f.name, f.content);
          if (res && res.success) saved.push(f.name); else failed.push({ name: f.name, error: (res && res.error) || 'Could not save.' });
        }
        emit('project-files-changed', { spaceId });
        return { saved, failed };
      },
      async listProjectFiles() { throw new Error('Open the project\'s Files tab to see its folder.'); },
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
