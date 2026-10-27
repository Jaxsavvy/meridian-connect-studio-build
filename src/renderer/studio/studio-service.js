/* Meridian Studio service: the ONE place screens and tools get data from.
 * Core lane. Today it runs on built-in SAMPLE data so Tyler and Cassy can build
 * screens and tools without the cloud server. In Wave 1 the same methods will
 * call the server instead; screens and tools must not change when that happens.
 * Rules (docs/PLAN.md): no costs anywhere, no keys, no client mixing. */
'use strict';

(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  // Pitch deck format (#114), research model (#124), chapter cards (#186), site engine (#157), section library (#189),
  // site checker (#206), look frames (#202), site edit helpers (#198), concept (#229), storyboard frames (#231), design bundle (#238),
  // build prompt (#246):
  // index.html loads them before this file.
  const api = factory(node ? require('./decks/deck-data.js') : root && root.MeridianDeckData,
    node ? require('./decks/research-model.js') : root && root.MeridianResearchModel,
    node ? require('./website/chapter-cards.js') : root && root.MeridianChapterCards,
    node ? require('./website/site-engine.js') : root && root.MeridianSiteEngine,
    node ? require('./website/section-library.js') : root && root.MeridianSectionLibrary,
    node ? require('./website/site-check.js') : root && root.MeridianSiteCheck,
    node ? require('./website/look-frames.js') : root && root.MeridianLookFrames,
    node ? require('./website/site-edit.js') : root && root.MeridianSiteEdit,
    node ? require('./website/concept.js') : root && root.MeridianConcept,
    node ? require('./website/storyboard-frames.js') : root && root.MeridianStoryboardFrames,
    node ? require('./website/design-bundle.js') : root && root.MeridianDesignBundle,
    node ? require('./website/build-prompt.js') : root && root.MeridianBuildPrompt);
  if (node) module.exports = api;
  if (root) root.MeridianStudioService = api;
})(typeof window === 'undefined' ? null : window, function (DeckData, Research, Cards, Engine, Library, SiteCheck, Look, SiteEdit, Concept, Frames, Bundle, BuildPrompt) {
  const TOOLS = [
    ['image-gen', 'Image gen', 'tool', 'available'],
    ['asset-library', 'Asset Library', 'tool', 'available'],
    ['video', 'Video', 'tool', 'coming-soon'],
    ['storyboard', 'Storyboard', 'tool', 'available'],
    ['logo', 'Logo', 'tool', 'coming-soon'],
    ['copywriter', 'Copywriter', 'tool', 'available'],
    ['chapter-cards', 'Chapter cards', 'tool', 'available'], // Website pipeline board (#186, screen: Tyler)
    ['site-check', 'Site check', 'tool', 'available'],       // Website Check stage results (#206, screen: Tyler)
    ['look-frames', 'Look frames', 'tool', 'available'],     // pick ChatGPT's look for the site (#202, screen: Tyler)
    ['site-review', 'Site review', 'tool', 'available'],     // team comments on the site in Review (#216, screen: Tyler)
    ['concept', 'Concept', 'tool', 'available'],             // the big idea, before Story (#229, screen: Tyler)
    ['design-lock', 'Design lock', 'tool', 'available'],     // the bundle and the client's approval (#238, screen: Tyler)
    ['build-kit', 'Build kit', 'tool', 'available'],         // the approved bundle + Claude Code prompt (#246, screen: Tyler)
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
  // Internal: a full-page website design from ChatGPT images (#202). Not in Image gen's list; only the Website pipeline uses it.
  const LOOK_PRESET = Object.freeze({ id: 'look-frame', toolId: 'image-gen', name: 'Website look frame', size: '2:3', questions: Object.freeze([]) });
  const FRAME_PRESET = Object.freeze({ id: 'storyboard-frame', toolId: 'image-gen', name: 'Website storyboard frame', size: '3:2', questions: Object.freeze([]) });   // #231
  const SAMPLE_DNA = Object.freeze({ status: 'draft', brief: 'Sample brief', colors: Object.freeze(['#0b1f3a', '#2bb3a3']), fonts: Object.freeze(['Source Serif 4', 'Inter']),
    voice: 'Confident, plain-spoken', audience: 'Local homeowners' });

  // Website workflow (docs/PLAN.md). approver 'jax' means the stage waits on Jax; the team can't mark it done.
  const STAGE = (id, name, goal, tools, needs, check, approver = 'team', tiers = ['standard', 'cinematic']) =>
    Object.freeze({ id, name, goal, tools: Object.freeze(tools), needs: Object.freeze(needs), check, approver, tiers: Object.freeze(tiers) });
  // Stages in a group are open at the same time; the stage after the group opens when all of them are done.
  const GROUP = (group, groupName, stage) => Object.freeze({ ...stage, group, groupName });
  const WORKFLOWS = Object.freeze({
    // The one website pipeline (Website Build Pipeline doc, #186). Chapter cards carry the work from Story to Look.
    website: Object.freeze({
      id: 'website', name: 'Website', version: 4,   // 3: Concept before Story (#229); 4: Design lock before Build (#238)
      tiers: Object.freeze([
        Object.freeze({ id: 'standard', name: 'Standard', description: 'Clean, fast site. Strong photos, clear pages, no motion.' }),
        Object.freeze({ id: 'cinematic', name: 'Cinematic', description: 'Everything in Standard plus video and scroll motion, planned on the chapter cards.' }),
      ]),
      stages: Object.freeze([
        STAGE('brief', 'Kickoff', 'Agree the goal, audience, main call to action and tier, from Project DNA and the pitch deck.', ['copywriter'], ['Goal', 'Audience', 'Main call to action', 'Pages wanted'], 'Jax approves the DNA and the goal', 'jax'),
        STAGE('concept', 'Concept', 'The big idea in one line, named as a place or feeling, plus the audience, one goal, 3 reference sites and mood words.', ['concept'], ['Concept line', 'Audience and one goal', '3 reference sites', 'Mood words'], 'Jax approves the concept', 'jax'),
        STAGE('plan', 'Story and sitemap', 'List the pages and the chapters on each, in order, each with one job.', ['copywriter', 'chapter-cards'], ['Every page has a purpose', 'Every chapter has one job'], 'Nothing is there "just because"'),
        STAGE('words', 'Words', 'Write final-draft words for every chapter.', ['copywriter', 'chapter-cards'], ['Headline and body for every chapter'], 'No placeholder text'),
        STAGE('storyboard', 'Storyboard', 'Fill every chapter card (layout, shots, motion, phone note) and keep one ChatGPT frame per chapter.', ['storyboard', 'image-gen', 'chapter-cards'], ['Layout for every chapter', 'Shot list', 'Phone notes', 'A kept frame for every chapter'], 'Every card complete, and the frames read start to finish', 'jax'),
        STAGE('look', 'Look and assets', 'Make every shot on the cards and set the style numbers.', ['image-gen', 'video', 'asset-library', 'chapter-cards', 'look-frames'], ['Every shot kept', 'Style numbers set'], 'Every shot on every card is kept'),
        STAGE('motion', 'Motion test', 'Cinematic only: try the key motion and video moments on a real phone before the build.', ['video'], ['Motion tried on a phone', 'Video loops kept'], 'Smooth on a real phone, not distracting', 'team', ['cinematic']),
        STAGE('lock', 'Design lock', 'One bundle: concept, cards, storyboard, chosen look, assets and style numbers. Jax sends it to the client, who approves the design.', ['design-lock'], ['Bundle checked', 'Sent to the client', 'Client approved'], 'The client approves the design', 'jax'),
        STAGE('build', 'Build', 'Meridian assembles the site from the cards, style numbers and section library.', ['website', 'build-kit'], ['Every page renders'], 'Runs on desktop and phone'),
        STAGE('check', 'Check', 'Automatic: links, phone layout, speed, accessibility, SEO tags, forms.', ['site-check'], ['Phone', 'Speed', 'Links', 'Accessibility', 'SEO tags'], 'All pass, or each failure explained'),
        STAGE('review', 'Review', 'One round: team, then Jax, then the client link. Every comment at once.', ['site-review', 'website'], ['Share link for Jax', 'Client link'], 'Jax and the client approve', 'jax'),
        STAGE('launch', 'Launch', 'Publish on Cloudflare Pages, connect the domain, GA4 and Search Console.', [], ['Domain ready', 'GA4 and Search Console'], 'Live and verified', 'jax'),
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
  });

  // Sample team; the server supplies the real list.
  const PEOPLE = Object.freeze([['jax', 'Jax'], ['tyler', 'Tyler'], ['cassy', 'Cassy']].map(([id, name]) => Object.freeze({ id, name })));

  // Auto check (#131): words that must never reach a prospect's board: pricing, money signs, team names, internal notes.
  // The "$" prefix on a market stat is allowed (Jax, 2026-10-26); links, ids and assets aren't board text.
  const INTERNAL_WORDS = Object.freeze([/\bpric(?:e|es|ing)\b/i, /[$€£]/, /\bno clients\b/i, /\binternal\b/i, /\bdraft\b/i, /\btbd\b/i,
    new RegExp(`\\b(?:${PEOPLE.map(p => p.name).join('|')})\\b`, 'i')]);
  const NOT_BOARD_TEXT = Object.freeze(['prefix', 'url', 'placeId', 'desktopAsset', 'phoneAsset']);
  const CHECKS_NOT_RUN = Object.freeze(['phone-screenshot', 'links-open']);   // run by Connect on the finished board (#131 part 2)
  const BOARD_CHECKS = Object.freeze(['phone', 'links-open']);   // flag kinds those two checks add
  const CHECKED = Object.freeze(['pitch-deck', 'website']);      // workflows with an automatic Check stage (#131, #206)
  // Every link on the board, with the deck field it's in, for the live link check.
  const deckLinks = deck => deckText(deck).filter(([, key, value]) => key === 'url' && value).map(([where, , url]) => ({ url, where }));
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
  const sampleDna = space => (space.type === 'client' ? clone(SAMPLE_DNA) : null);
  // Finish saves a whole site; the project folder takes up to 10 files per save.
  async function saveInBatches(save, files) {
    const saved = [], failed = [];
    for (let i = 0; i < files.length; i += 10) {
      const out = await save(files.slice(i, i + 10));
      saved.push(...(out.saved || [])); failed.push(...(out.failed || []));
    }
    return { saved, failed };
  }
  // What a Job keeps in the project's save file (pitch deck #171, website #226); the stages always come from the current template.
  const COMMON_FIELDS = ['id', 'workflowId', 'tier', 'name', 'templateVersion', 'done', 'stageId', 'waitingOnJax', 'needs', 'assignees', 'timing', 'checks', 'checkLog'];
  // Older templates a saved Job can still be on, as a filter over today's stages: running Jobs keep the stages they started with.
  const OLDER_TEMPLATES = Object.freeze({ website: Object.freeze({ 2: st => !['concept', 'lock'].includes(st.id), 3: st => st.id !== 'lock' }) });   // v2: no Concept (#229); v3: no Design lock (#238)
  const SAVED_FIELDS = Object.freeze({
    'pitch-deck': Object.freeze([...COMMON_FIELDS, 'deck', 'evidence', 'research']),
    website: Object.freeze([...COMMON_FIELDS, 'notes', 'concept', 'story', 'storyboard', 'look', 'design', 'buildKit', 'site', 'review', 'siteFilesSaved']),
  });

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
        deck: null, evidence: [], research: null, checks: null, checkLog: [], // Pitch deck only (#119, #125, #131)
        story: null, look: null, review: null, concept: null, storyboard: null, design: null, buildKit: null, ...extra }; // Website only: chapter cards (#186), look frames (#202), review (#216), concept (#229), storyboard frames (#231), design lock (#238), build kit (#246)
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

    async function saveProjectFiles(spaceId, jobId, files) {
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
    }

    const self = Object.freeze({
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
        const dna = sampleDna(space);
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
      /** Core only: the real service keeps pitch deck (#171) and Website (#226) Jobs in the project's folder. Plain data out... */
      exportJobs(spaceId, workflowId = 'pitch-deck') {
        requireSpace(spaceId);
        const fields = SAVED_FIELDS[workflowId] || [];
        return clone(spaceJobs(spaceId).filter(j => j.workflowId === workflowId).map(j => Object.fromEntries(fields.map(k => [k, j[k]]))));
      },
      /** ...and back in, every field checked; a Job that doesn't check out is left out. Replaces this project's Jobs of that workflow. */
      importJobs(spaceId, list, workflowId = 'pitch-deck') {
        const space = requireSpace(spaceId);
        if (!SAVED_FIELDS[workflowId]) return 0;
        const restored = (Array.isArray(list) ? list : []).filter(s => s && s.workflowId === workflowId).map(s => restoredJob(space, s)).filter(Boolean);
        jobs.set(space.id, [...spaceJobs(space.id).filter(j => j.workflowId !== workflowId), ...restored]);
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
        if (CHECKED.includes(job.workflowId) && target === 'check') checksClear(job);
        if (job.workflowId === 'website' && target === 'concept') {
          const gaps = Concept.conceptGaps(job.concept);
          if (gaps.length) throw new Error(`The concept isn't ready: ${gaps[0].message}`);
        }
        if (job.workflowId === 'website' && Cards.GATED.includes(target)) storyReady(space, job, target);
        if (job.workflowId === 'website' && target === 'lock') {   // sending freezes the bundle (#238)
          if (job.waitingOnJax) throw new Error('The design is already with Jax.');
          const gaps = designGaps(space, job, designBundle(space, job, frameDna(space)));
          if (gaps.length) throw new Error(`The design isn't ready to lock: ${gaps[0].where}: ${gaps[0].message}`);
          const d = job.design || { history: [] }, dna = frameDna(space) || {};
          job.design = { ...d, answer: null, sent: { version: (d.sent ? d.sent.version : 0) + 1, at: new Date(now()).toISOString(),
            dna: { colors: [...(dna.colors || [])], fonts: [...(dna.fonts || [])] } } };
          emit('design-changed', { spaceId: space.id, jobId: job.id });
        }
        if (job.workflowId === 'website' && target === 'build' && !job.site) throw new Error('Build the site first: start it from the chapter cards.');
        if (job.workflowId === 'website' && target === 'review') {
          const open = reviewOf(job).comments.filter(c => !c.resolved).length;
          if (open) throw new Error(`Review isn't done: ${open} ${open === 1 ? 'comment needs' : 'comments need'} an answer.`);
          if (job.siteFilesSaved === false) throw new Error('The site files in the project folder are out of date: save the site again.');
        }
        if (stage.approver === 'jax') {
          job.waitingOnJax = true; emit('jobs-changed', { spaceId });
          // The stand-in leaves Design lock for the client: in practice, the approval screen answers as the client (#238).
          later(() => { if (job.waitingOnJax && job.stageId !== 'lock') { jaxApproves(job); emit('jobs-changed', { spaceId }); } });
          return clone(jobView(job));
        }
        advance(job, target);
        if (job.workflowId === 'pitch-deck' && target === 'assemble') runDeckChecks(space, job);   // Auto check runs by itself
        if (job.workflowId === 'website' && target === 'build') runSiteChecks(space, job);         // so does the site Check
        emit('jobs-changed', { spaceId });
        return clone(jobView(job));
      },
      /** Sample-mode stand-in for Jax approving a stage (the server does this for real). */
      async approveStage(spaceId, jobId) {
        requireSpace(spaceId);
        const job = requireJob(spaceId, jobId);
        if (!job.waitingOnJax) throw new Error('This stage is not waiting on Jax.');
        jaxApproves(job);
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
      /** What Kickoff decided ('brief'). Empty notes until someone saves. Later Website stages use the chapter cards (getStory). */
      async getStageNotes(spaceId, jobId, stageId) {
        requireSpace(spaceId);
        const job = requireJob(spaceId, jobId);
        if (!NOTES[stageId] || !job.stageIds.includes(stageId)) throw new Error('This stage has no notes.');
        return clone(job.notes[stageId] || NOTES[stageId]({}));
      },
      /** Saves a stage's notes (replaces them). */
      async saveStageNotes(spaceId, jobId, stageId, notes) {
        requireSpace(spaceId);
        const job = requireJob(spaceId, jobId);
        if (!NOTES[stageId] || !job.stageIds.includes(stageId)) throw new Error('This stage has no notes.');
        if (!notes || typeof notes !== 'object' || Array.isArray(notes)) throw new Error('Notes must be an object.');
        if (job.done.includes(stageId) || (job.stageId === stageId && job.waitingOnJax)) throw new Error('This stage is finished; its notes are locked.');
        const clean = NOTES[stageId](notes);
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
      /** Meridian drafts one chapter card's words (#193): { draft: { headline, body, button }, settingsUsed }.
       *  input: { page?, name?, job? } as typed on the card (may be unsaved). Never saves; the person accepts it on the board. */
      async draftChapter(spaceId, jobId, input) {
        const { space, job } = websiteJob(spaceId, jobId);
        const i = input && typeof input === 'object' ? input : {};
        const page = text(i.page, 'Page name', 80), name = text(i.name, 'Chapter name', 80), aim = text(i.job, 'Chapter job', 300);
        const cta = text((job.notes.brief || {}).callToAction, 'Main call to action', 200);
        const topic = name || page || 'This chapter';
        const draft = {
          headline: `${topic}, done right the first time`,
          body: `${aim ? `${aim.replace(/[.!?]+$/, '')}. ` : ''}We show up on time, explain the work in plain words, and leave the place cleaner than we found it.`,
          button: (cta || 'Get a free estimate').slice(0, 60),
        };
        return clone({ draft, settingsUsed: { voice: space.type === 'client' ? 'Confident, plain-spoken' : 'Friendly', model: 'sample', useBrandDna: space.type === 'client' } });
      },
      async listPresets(toolId) { return clone(PRESETS.filter(p => p.toolId === toolId)); },
      /** Saves a Job's outputs into the client project's folder (Files tab, Docs), named "<Job name> - <file>".
       *  files: [{ name: 'Research summary.md', content: '...' }]. Saving the same name again replaces it. */
      saveToProjectFiles: saveProjectFiles,
      /** Files saved to the project folder in this session (the Files tab shows the real folder). */
      async listProjectFiles(spaceId) { requireSpace(spaceId); return clone(projectFiles.get(spaceId) || []); },
      /** Concept (#229): the big idea for a Website Job, or an empty one until someone saves. */
      async getConcept(spaceId, jobId) {
        const { job } = websiteJob(spaceId, jobId);
        return clone(job.concept || Concept.cleanConcept({}));
      },
      /** Saves the concept (replaces it): { ok, errors: [{ field, message }], concept }. From Kickoff until Jax approves it. */
      async saveConcept(spaceId, jobId, concept) {
        const { space, job } = websiteJob(spaceId, jobId);
        if (job.done.includes('concept') || job.stageId === null || (job.stageId === 'concept' && job.waitingOnJax)) throw new Error('The concept is locked once it goes to Jax.');
        let clean;
        try { clean = Concept.cleanConcept(concept); } catch (error) { return { ok: false, errors: [{ field: 'concept', message: error.message }], concept: null }; }
        job.concept = clean;
        emit('concept-changed', { spaceId: space.id, jobId: job.id });
        return clone({ ok: true, errors: Concept.conceptGaps(clean), concept: clean });
      },
      /** Meridian drafts a concept from Kickoff and Project DNA for the lead to accept or change. Never saves.
       *  Reference sites are left for the lead: Meridian doesn't invent links. Real sign-in: "Coming soon" (server). */
      async draftConcept(spaceId, jobId) {
        const { space, job } = websiteJob(spaceId, jobId);
        const brief = job.notes.brief || {}, dna = sampleDna(space) || {};
        const audience = brief.audience || dna.audience || 'Local homeowners';
        const draft = Concept.cleanConcept({
          line: `${space.name}: the calm after one phone call`.slice(0, 140),
          audience: audience.slice(0, 200),
          goal: (brief.goal || brief.callToAction || 'Get a call booked').slice(0, 200),
          references: [],
          mood: ['calm', 'trustworthy', 'local', ...String(dna.voice || '').toLowerCase().split(/[^a-z-]+/).filter(w => w.length > 3)].slice(0, 5),
        });
        return clone({ draft, settingsUsed: { model: 'sample', useBrandDna: space.type === 'client' } });
      },
      /** Website Job's chapter cards (#186): the saved story, or one page per page named at Kickoff. */
      async getStory(spaceId, jobId) {
        const { job } = websiteJob(spaceId, jobId);
        return clone(storyOf(job));
      },
      /** Saves the whole story (replaces it) and returns { story, gaps } for the stage the Job is on.
       *  Locked once Look and assets is done: Build reads the cards from then on. Shots may only use this Space's assets. */
      async saveStory(spaceId, jobId, story) {
        const { space, job } = websiteJob(spaceId, jobId);
        if (job.done.includes('look') || job.stageId === null) throw new Error('The chapter cards are locked once Look and assets is done.');
        const clean = Cards.cleanStory(story);
        for (const p of clean.pages) for (const c of p.chapters) for (const sh of c.shots) {
          if (sh.assetId && !hasAsset(space.id, sh.assetId)) throw new Error('A shot points at an asset that is not in this Space.');
        }
        job.story = clean;
        emit('story-changed', { spaceId: space.id, jobId: job.id });
        return clone({ story: clean, gaps: gapsFor(space, job, job.stageId) });
      },
      /** What a Website stage's gate still needs: [{ where, message }]. Empty = ready to finish. Default: the current stage. */
      async getStoryGaps(spaceId, jobId, stageId) {
        const { space, job } = websiteJob(spaceId, jobId);
        return clone(gapsFor(space, job, stageId || job.stageId));
      },
      /** Build runner, part 1 (#246): the approved bundle, its images and the Claude Code prompt that builds the client's
       *  site from the house starter kit: { repo, bundle, images, prompt, files, saved }. Once Design lock is done. */
      async getBuildKit(spaceId, jobId) {
        const { space, job } = websiteJob(spaceId, jobId);
        return clone(buildKitOf(space, job));
      },
      /** Saves the build kit's two files to the project folder: { saved, failed }. */
      async saveBuildKit(spaceId, jobId) {
        const { space, job } = websiteJob(spaceId, jobId);
        const out = await saveProjectFiles(space.id, job.id, buildKitOf(space, job).files);
        self.markBuildKit(space.id, job.id, out);
        return out;
      },
      /** Core only: how saving the build kit went (real sign-in saves it through Connect). Records the design version on success. */
      markBuildKit(spaceId, jobId, result) {
        const { job } = websiteJob(spaceId, jobId);
        if (result && Array.isArray(result.failed) && !result.failed.length && job.design && job.design.sent) {
          job.buildKit = { version: job.design.sent.version, at: new Date(now()).toISOString() };
        }
        return clone(job.buildKit || null);
      },
      /** Design lock (#238): the bundle (frozen once sent), what's missing, the version sent and the client's answers. */
      async getDesignLock(spaceId, jobId) {
        const { space, job } = websiteJob(spaceId, jobId);
        return clone(designView(space, job));
      },
      /** The client's answer: approve, or ask for changes with a note. Only while the design waits on the client.
       *  Practice: Tyler's approval screen answers as the client. Real sign-in: the client answers through the server's link. */
      async answerDesign(spaceId, jobId, { approved, note } = {}) {
        const { space, job } = websiteJob(spaceId, jobId);
        if (job.stageId !== 'lock' || !job.waitingOnJax || !job.design || !job.design.sent) throw new Error('The design isn\'t waiting on the client.');
        const text = typeof note === 'string' ? note.trim() : '';
        if (text.length > 1000) throw new Error('The note is too long (max 1000 characters).');
        if (approved !== true && !text) throw new Error('Say what the client wants changed.');
        const answer = { approved: approved === true, note: text, at: new Date(now()).toISOString(), by: 'client' };
        job.design.answer = answer;
        job.design.history = [...(job.design.history || []), { version: job.design.sent.version, ...answer }];
        job.waitingOnJax = false;
        if (answer.approved) advance(job);   // approved: on to Build; changes: back with the team
        emit('design-changed', { spaceId: space.id, jobId: job.id });
        emit('jobs-changed', { spaceId: space.id });
        return clone(designView(space, job));
      },
      /** Reopens an earlier stage, and every stage after it, so the team can make the client's changes; their gates run
       *  again on the way forward. From Design lock only, while it's with the team. */
      async sendBack(spaceId, jobId, stageId) {
        const { space, job } = websiteJob(spaceId, jobId);
        if (job.stageId !== 'lock' || job.waitingOnJax) throw new Error('A Job goes back only from Design lock, while it\'s with the team.');
        const at = job.stageIds.indexOf(stageId);
        if (at < 0 || at >= job.stageIds.indexOf('lock')) throw new Error('Pick an earlier stage to send it back to.');
        const reopened = job.stageIds.slice(at);
        job.done = job.done.filter(id => !reopened.includes(id));
        for (const id of reopened) if (job.timing[id]) delete job.timing[id].doneAt;
        job.stageId = job.stageIds.find(id => !job.done.includes(id));
        stampOpened(job);
        emit('design-changed', { spaceId: space.id, jobId: job.id });
        emit('jobs-changed', { spaceId: space.id });
        return clone(jobView(job));
      },
      /** Storyboard frames (#231): one entry per chapter, in the cards' order, with its frames, the kept one and its prompt. */
      async getStoryboard(spaceId, jobId) {
        const { space, job } = websiteJob(spaceId, jobId);
        return clone(storyboardOf(space, job));
      },
      /** Meridian asks ChatGPT images for one more frame of a chapter (old ones are kept). Until Storyboard goes to Jax. */
      async makeStoryboardFrame(spaceId, jobId, { pageId, chapterId } = {}) {
        const { space, job } = boardJob(spaceId, jobId);
        const { page, chapter } = chapterOf(job, pageId, chapterId);
        const prompt = Frames.framePrompt(job.concept, page, chapter, { name: space.name, dna: frameDna(space), tier: job.tier });
        const out = await self.generateImage({ spaceId: space.id, presetId: FRAME_PRESET.id, description: prompt, count: 1, jobId: job.id, stageId: 'storyboard' });
        await self.keepAsset(space.id, out.results[0].assetId);
        const board = job.storyboard || { frames: [] };
        board.frames.push({ id: nextId('frame'), pageId: page.id, chapterId: chapter.id, assetId: out.results[0].assetId, prompt, kept: false });
        job.storyboard = board;
        emit('storyboard-changed', { spaceId: space.id, jobId: job.id });
        return clone(storyboardOf(space, job));
      },
      /** The one frame a chapter keeps (replaces the last one kept). Until Storyboard goes to Jax. */
      async keepStoryboardFrame(spaceId, jobId, { pageId, chapterId, frameId } = {}) {
        const { space, job } = boardJob(spaceId, jobId);
        const { page, chapter } = chapterOf(job, pageId, chapterId);
        const mine = ((job.storyboard || {}).frames || []).filter(f => f.pageId === page.id && f.chapterId === chapter.id);
        if (!mine.some(f => f.id === frameId)) throw new Error('That frame is not on this chapter.');
        for (const f of mine) f.kept = f.id === frameId;
        emit('storyboard-changed', { spaceId: space.id, jobId: job.id });
        return clone(storyboardOf(space, job));
      },
      /** Look frames (#202): ChatGPT's full-page designs for this Website Job, and which one Jax picked. */
      async getLook(spaceId, jobId) {
        const { job } = websiteJob(spaceId, jobId);
        return clone(lookOf(job));
      },
      /** Meridian asks ChatGPT images for one full-page look frame per direction (default all three), from the finished
       *  storyboard and Project DNA. Needs a complete storyboard; making new frames keeps the old ones. */
      async makeLookFrames(spaceId, jobId, { directions } = {}) {
        const { space, job } = websiteJob(spaceId, jobId);
        if (job.done.includes('look') || job.stageId === null) throw new Error('The look is locked once Look and assets is done.');
        const missing = Cards.stageGaps(storyOf(job), 'storyboard', { tier: job.tier });
        if (missing.length) throw new Error(`Finish the storyboard first: ${missing[0].where}: ${missing[0].message}`);
        const wanted = Array.isArray(directions) && directions.length ? directions : Look.DIRECTIONS.map(d => d.id);
        const look = lookOf(job);
        for (const direction of wanted) {
          if (!Look.DIRECTIONS.some(d => d.id === direction)) throw new Error('Unknown design direction.');
          const prompt = Look.framePrompt(storyOf(job), { name: space.name, dna: SAMPLE_DNA, tier: job.tier, direction });
          const out = await self.generateImage({ spaceId: space.id, presetId: LOOK_PRESET.id, description: prompt, count: 1, jobId: job.id, stageId: 'look' });
          await self.keepAsset(space.id, out.results[0].assetId);
          look.frames.push({ id: nextId('frame'), direction, assetId: out.results[0].assetId, prompt });
        }
        job.look = look;
        emit('look-changed', { spaceId: space.id, jobId: job.id });
        return clone(look);
      },
      /** Jax picks the look. Locked once Look and assets is done. */
      async chooseLookFrame(spaceId, jobId, frameId) {
        const { space, job } = websiteJob(spaceId, jobId);
        if (job.done.includes('look') || job.stageId === null) throw new Error('The look is locked once Look and assets is done.');
        const look = lookOf(job);
        if (!look.frames.some(f => f.id === frameId)) throw new Error('That look frame is not on this Job.');
        look.chosenId = frameId;
        job.look = look;
        emit('look-changed', { spaceId: space.id, jobId: job.id });
        return clone(look);
      },
      /** One ChatGPT prompt per shot on the cards, written to match the chosen frame, for Image gen to make. */
      async getShotPrompts(spaceId, jobId) {
        const { job } = websiteJob(spaceId, jobId);
        const look = lookOf(job), frame = look.frames.find(f => f.id === look.chosenId);
        if (!frame) throw new Error('Pick a look frame first.');
        return clone(storyOf(job).pages.flatMap(p => p.chapters.flatMap(c => c.shots.map(sh => ({ pageId: p.id, chapterId: c.id, shotId: sh.id, what: sh.what,
          made: !!sh.assetId, prompt: Look.shotPrompt(sh, { direction: frame.direction, dna: SAMPLE_DNA, tier: job.tier }) })))));
      },
      /** Website builder (#198): the Job's site (site engine format), or null until Build starts it. */
      async getSite(spaceId, jobId) {
        const { job } = websiteJob(spaceId, jobId);
        return job.site ? clone(job.site) : null;
      },
      /** Assembles the site from the locked chapter cards, once: { ok, errors, site, report: { custom, short } }.
       *  Build must be open. options.dna: the project's DNA (real sign-in passes it; practice uses the sample DNA). */
      async startSite(spaceId, jobId, { from, dna } = {}) {
        const { space, job } = buildJob(spaceId, jobId);
        if (from !== 'cards') throw new Error('For now a site starts from the chapter cards.');
        if (job.site) throw new Error('The site is already started.');
        const out = Library.assembleSite(storyOf(job), { name: space.name, tokens: Library.tokensFromDna(dna === undefined ? sampleDna(space) : dna) });
        if (out.ok) { job.site = out.site; emit('site-changed', { spaceId: space.id, jobId: job.id }); }
        return clone({ ok: out.ok, errors: out.errors, site: out.ok ? out.site : null, report: { custom: out.custom, short: out.short } });
      },
      /** Saves the whole site (replaces it) while Build or Review is open: { ok, errors, site }. Refuses anything the engine
       *  refuses. During Review (#219) the checks run again (new problems become Review comments) and the project folder's
       *  site files are saved again: { ..., files: { saved, failed } } (real sign-in: Connect saves them, see the server). */
      async saveSite(spaceId, jobId, site) {
        const { space, job } = siteJob(spaceId, jobId);
        const check = Engine.validateSite(site);
        if (!check.ok) return clone({ ok: false, errors: check.errors, site: null });
        if (siteAssetIds(site).some(id => !hasAsset(space.id, id))) {
          return { ok: false, errors: [{ path: 'site', message: 'An image points at an asset that is not in this Space.' }], site: null };
        }
        job.site = clone(site);
        let files = null;
        if (openStages(job).includes('review')) {
          recheckInReview(space, job);
          job.siteFilesSaved = false;
          if (practice) files = await saveSiteFilesFor(space, job, list => saveProjectFiles(space.id, job.id, list));
        }
        emit('site-changed', { spaceId: space.id, jobId: job.id });
        return clone({ ok: true, errors: [], site: job.site, ...(files ? { files } : {}) });
      },
      /** Core only (#219): real sign-in reports how saving the site files through Connect went. */
      markSiteFiles(spaceId, jobId, result) {
        const { job } = websiteJob(spaceId, jobId);
        job.siteFilesSaved = !!result && Array.isArray(result.failed) && !result.failed.length;
        return job.siteFilesSaved;
      },
      /** One page as HTML for the builder's sandboxed preview: the saved site, or an unsaved draft (checked, never saved).
       *  Only this Space's assets resolve, and the preview script reports clicks (site-engine.js). */
      async previewPage(spaceId, jobId, pageId, { site } = {}) {
        const { space, job } = websiteJob(spaceId, jobId);
        const shown = site === undefined ? job.site : site;
        if (!shown) throw new Error('Start the site first.');
        return { html: Engine.renderPage(shown, pageId, { assets: assetUrls(space.id), preview: true }) };
      },
      /** What Finish saves (Build open): "site.json" plus "Site - <page>.html" for every page, with no preview script. */
      async getSiteFiles(spaceId, jobId) { return siteFiles(spaceId, jobId); },
      /** Review (#216): the team's comments on the site: { comments: [{ id, pageId, sectionId, key, where, text, at, resolved }], open }. */
      async getReview(spaceId, jobId) {
        const { job } = websiteJob(spaceId, jobId);
        const comments = reviewOf(job).comments;
        return clone({ comments, open: comments.filter(c => !c.resolved).length });
      },
      /** A team comment on one part of the site, while Review is open: { pageId, sectionId, key?, text }. */
      async addReviewComment(spaceId, jobId, comment) {
        const { space, job } = reviewJob(spaceId, jobId);
        const c = comment && typeof comment === 'object' ? comment : {};
        const page = job.site.pages.find(p => p.id === c.pageId);
        const section = page && page.sections.find(s => s.id === c.sectionId);
        if (!section) throw new Error('That part of the site isn\'t on this page.');
        const key = c.key === undefined || c.key === null || c.key === '' ? null : c.key;
        if (key !== null && !SiteEdit.editableList(job.site, page.id).some(i => i.key === key && i.sectionId === section.id)) throw new Error('That item isn\'t in this section.');
        const words = text(c.text, 'Comment', 1000);
        if (!words) throw new Error('Write the comment first.');
        const review = reviewOf(job);
        const added = { id: nextId('comment'), source: 'team', pageId: page.id, sectionId: section.id, key, where: `${SiteCheck.pageLabel(page)} · ${section.label}`,
          text: words, at: new Date(now()).toISOString(), resolved: null };
        review.comments.push(added);
        job.review = review;
        emit('review-changed', { spaceId: space.id, jobId: job.id });
        return clone(added);
      },
      /** Answers a comment: { kind: 'fixed' | 'keep', note } (the note says what changed, or why it stays). */
      async resolveReviewComment(spaceId, jobId, commentId, { kind, note } = {}) {
        const { space, job } = reviewJob(spaceId, jobId);
        const found = reviewOf(job).comments.find(c => c.id === commentId);
        if (!found) throw new Error('Comment not found.');
        if (found.resolved) throw new Error('This comment already has an answer.');
        if (!['fixed', 'keep'].includes(kind)) throw new Error('Answer with fixed or keep.');
        // A real fix answers a check comment by itself on the next save; while it's open, the check still finds the problem.
        if (found.source === 'check' && kind === 'fixed') throw new Error('The check still finds this: fix it and save the site, or choose Keep as is.');
        const why = text(note, 'Note', 500);
        if (!why) throw new Error(kind === 'fixed' ? 'Say what changed.' : 'Say why it stays.');
        found.resolved = { kind, note: why, at: new Date(now()).toISOString() };
        if (found.source === 'check') answerFlag(job, found.flagKey, why, found.resolved.at);
        emit('review-changed', { spaceId: space.id, jobId: job.id });
        return clone(found);
      },
      /** Core only (#206): each page as a still page (no motion) for Connect's phone check, plus the site's outside links. */
      async getCheckPages(spaceId, jobId) {
        const { space, job } = websiteJob(spaceId, jobId);
        if (!job.site) throw new Error('Build the site first.');
        const assets = assetUrls(space.id);
        return clone({ links: SiteCheck.siteLinks(job.site), pages: job.site.pages.map(p => ({ label: SiteCheck.pageLabel(p),
          html: Engine.renderPage(job.site, p.id, { assets, still: true }),
          fileName: `${job.name} - Site ${p.path === '/' ? 'home' : p.path.slice(1).replace(/\//g, '-')} on a phone.png` })) });
      },
      /** Finish: saves the site's files to the project folder: { saved, failed }. Then the screen completes Build. */
      async finishSite(spaceId, jobId) {
        buildJob(spaceId, jobId);
        const files = siteFiles(spaceId, jobId);
        return saveInBatches(list => saveProjectFiles(spaceId, jobId, list), files);
      },
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
       *  Runs by itself when Assemble board finishes. The phone screenshot and live link check come with the board.
       *  Website Jobs (#206): runs when Build finishes; check is 'seo' | 'accessibility' | 'links' | 'speed' (site-check.js). */
      async runChecks(spaceId, jobId) {
        const { space, job } = checkedJob(spaceId, jobId);
        if (job.done.includes('check')) throw new Error('Auto check is finished.');
        return clone((job.workflowId === 'website' ? runSiteChecks(space, job) : runDeckChecks(space, job)).flags.map(flagView));
      },
      /** The last Auto check: { ranAt, flags, notRun, log } (log: every flag a person resolved, with their note). */
      async getChecks(spaceId, jobId) {
        const { job } = checkedJob(spaceId, jobId);
        const last = job.checks || { ranAt: null, flags: [] };
        return clone({ ranAt: last.ranAt, flags: last.flags.map(flagView), notRun: last.notRun || CHECKS_NOT_RUN, log: job.checkLog });
      },
      /** Core only: what Connect found on the finished board ({ flags, ran }: phone width, live links). Replaces the last
       *  board flags; one a person resolved stays resolved when the same thing is found again. */
      addBoardChecks(spaceId, jobId, result) {
        const { space, job } = checkedJob(spaceId, jobId);
        if (!job.checks || job.done.includes('check') || !result || typeof result !== 'object') return null;
        const ran = (Array.isArray(result.ran) ? result.ran : []).filter(x => CHECKS_NOT_RUN.includes(x));
        const before = new Map(job.checks.flags.map(f => [f.key, f]));
        const fresh = (Array.isArray(result.flags) ? result.flags : []).filter(f => f && BOARD_CHECKS.includes(f.check)).slice(0, 50).map(f => {
          const clean = { check: f.check, message: String(f.message || '').slice(0, 300), where: String(f.where || '').slice(0, 200) };
          const key = `${clean.check}|${clean.where}|${clean.message}`;
          return before.get(key) || { id: nextId('flag'), key, ...clean, resolved: null };
        });
        job.checks = { ...job.checks, notRun: CHECKS_NOT_RUN.filter(x => !ran.includes(x)),
          flags: [...job.checks.flags.filter(f => !BOARD_CHECKS.includes(f.check)), ...fresh] };
        emit('checks-changed', { spaceId: space.id, jobId: job.id });
        return clone(job.checks.flags.map(flagView));
      },
      /** A person marks a flag OK with a note saying why; the note is logged. It stays resolved when checks re-run. */
      async resolveFlag(spaceId, jobId, flagId, note) {
        const { space, job } = checkedJob(spaceId, jobId);
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
        const preset = [...PRESETS, LOOK_PRESET, FRAME_PRESET].find(p => p.id === request.presetId) || PRESETS[0];
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
    return self;

    function spaceJobs(spaceId) {
      if (!jobs.has(spaceId)) jobs.set(spaceId, []);
      return jobs.get(spaceId);
    }

    function requireJob(spaceId, jobId) {
      const job = spaceJobs(spaceId).find(j => j.id === jobId);
      if (!job) throw new Error('Job not found in this space.');
      return job;
    }

    // A saved Job read back from the project folder (pitch deck #171, website #226): nothing in the file is trusted as-is.
    function restoredJob(space, s) {
      const kind = s && typeof s === 'object' ? s.workflowId : null, workflow = SAVED_FIELDS[kind] ? WORKFLOWS[kind] : null;
      if (!workflow || !SAFE_ID.test(String(s.id))) return null;
      const older = (OLDER_TEMPLATES[kind] || {})[s.templateVersion];
      if ((s.templateVersion !== workflow.version && !older) || !workflow.tiers.some(t => t.id === s.tier)) return null;
      const stages = stagesFor(workflow, s.tier).filter(older || Boolean), ids = stages.map(st => st.id);
      const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {}), str = (v, max = 500) => (typeof v === 'string' ? v.slice(0, max) : '');
      const done = ids.filter(id => Array.isArray(s.done) && s.done.includes(id)), timing = {}, needs = {}, assignees = {};
      for (const st of stages) {
        const tm = obj(obj(s.timing)[st.id]), need = obj(s.needs)[st.id], who = obj(s.assignees)[st.id];
        if (Number.isFinite(tm.openedAt)) timing[st.id] = { openedAt: tm.openedAt, ...(Number.isFinite(tm.doneAt) ? { doneAt: tm.doneAt } : {}) };
        if (Array.isArray(need) && need.length === st.needs.length) needs[st.id] = need.map(Boolean);
        if (st.approver !== 'jax' && peopleFor(workflow).some(x => x.id === who)) assignees[st.id] = who;
      }
      const stageId = ids.find(id => !done.includes(id)) || null, c = obj(s.checks);
      const flag = f => ({ id: str(f.id, 40), key: str(f.key), check: str(f.check, 40), message: str(f.message), where: str(f.where, 200),
        resolved: f.resolved && typeof f.resolved === 'object' ? { note: str(f.resolved.note), at: str(f.resolved.at, 40) } : null });
      const entries = list => (Array.isArray(list) ? list : []).filter(x => x && typeof x === 'object');
      for (const m of JSON.stringify(s).matchAll(/"(?:job|fact|flag|run|comment|frame)-(\d+)"/g)) counter = Math.max(counter, Number(m[1]));   // new ids never clash
      const common = { id: String(s.id), spaceId: space.id, workflowId: kind, tier: s.tier, name: str(s.name, 80) || workflow.name,
        stageIds: Object.freeze(ids), stageDefs: Object.freeze(stages), templateVersion: s.templateVersion, done, stageId,
        waitingOnJax: !!s.waitingOnJax && stageId !== null && stages.find(st => st.id === stageId).approver === 'jax', needs, assignees, timing,
        checks: Array.isArray(c.flags) ? { ranAt: str(c.ranAt, 40), flags: entries(c.flags).map(flag),
          notRun: Array.isArray(c.notRun) ? CHECKS_NOT_RUN.filter(x => c.notRun.includes(x)) : CHECKS_NOT_RUN } : null,
        checkLog: entries(s.checkLog).map(x => ({ at: str(x.at, 40), flagId: str(x.flagId, 40), check: str(x.check, 40), where: str(x.where, 200),
          message: str(x.message), note: str(x.note) })),
        deck: null, evidence: [], research: null, story: null, look: null, review: null };
      if (kind === 'pitch-deck') {
        const r = obj(s.research);
        return { ...common, notes: {}, locked: true, template: 'pitch-deck-starter',
          deck: s.deck && typeof s.deck === 'object' ? DeckData.validateDeck(s.deck).deck : null,
          evidence: Array.isArray(s.evidence) && Research.validateEvidence(s.evidence).ok ? s.evidence : [],
          research: ['by-hand', 'done', 'failed'].includes(r.status) ? { runId: str(r.runId, 40), category: str(r.category, 60), status: r.status,
            candidates: [], placeId: /^[A-Za-z0-9_-]{10,300}$/.test(String(r.placeId)) ? r.placeId : null, byHand: !!r.byHand } : null };
      }
      // Website (#226): every part is checked again; a part that doesn't check out comes back empty, never half-trusted.
      const tryOr = (fn, fallback) => { try { return fn(); } catch (_) { return fallback; } };
      const notes = {};
      if (s.notes && s.notes.brief) { const brief = tryOr(() => NOTES.brief(obj(s.notes.brief)), null); if (brief) notes.brief = brief; }
      const story = s.story ? tryOr(() => Cards.cleanStory(s.story), null) : null;
      const site = s.site && Engine.validateSite(s.site).ok ? s.site : null;
      const lk = obj(s.look), dirs = Look.DIRECTIONS.map(d => d.id);
      const frames = entries(lk.frames).filter(f => SAFE_ID.test(String(f.id)) && dirs.includes(f.direction) && SAFE_ID.test(String(f.assetId)))
        .map(f => ({ id: f.id, direction: f.direction, assetId: f.assetId, prompt: str(f.prompt, 3800) }));
      const look = frames.length ? { frames, chosenId: frames.some(f => f.id === lk.chosenId) ? lk.chosenId : null, tokens: null, layouts: {} } : null;
      const PART = /^[a-z0-9][a-z0-9-]{0,39}$/, part = v => (typeof v === 'string' && PART.test(v) ? v : null);
      const comments = entries(obj(s.review).comments).filter(x => SAFE_ID.test(String(x.id)) && str(x.text, 1000)).map(x => ({
        id: x.id, source: x.source === 'check' ? 'check' : 'team', ...(x.source === 'check' ? { flagKey: str(x.flagKey) } : {}),
        pageId: part(x.pageId), sectionId: part(x.sectionId), key: part(x.key), where: str(x.where, 200), text: str(x.text, 1000), at: str(x.at, 40),
        resolved: x.resolved && ['fixed', 'keep'].includes(x.resolved.kind) && str(x.resolved.note)
          ? { kind: x.resolved.kind, note: str(x.resolved.note), at: str(x.resolved.at, 40) } : null }));
      const concept = s.concept ? tryOr(() => Concept.cleanConcept(s.concept), null) : null;
      const keptOnce = new Set(), boardFrames = entries(obj(s.storyboard).frames)
        .filter(f => SAFE_ID.test(String(f.id)) && part(f.pageId) && part(f.chapterId) && SAFE_ID.test(String(f.assetId)))
        .map(f => ({ id: f.id, pageId: f.pageId, chapterId: f.chapterId, assetId: f.assetId, prompt: str(f.prompt, Frames.MAX_PROMPT), kept: f.kept === true }));
      for (const f of boardFrames) { const k = `${f.pageId}/${f.chapterId}`; if (f.kept && keptOnce.has(k)) f.kept = false; else if (f.kept) keptOnce.add(k); }   // one kept per chapter
      const storyboard = boardFrames.length ? { frames: boardFrames } : null;
      const dz = obj(s.design), sent = obj(dz.sent), dnaIn = obj(sent.dna);
      const strs = (v, n) => (Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, n).map(x => x.slice(0, 60)) : []);
      const answerOf = a => (a && typeof a === 'object' && typeof a.approved === 'boolean' && ['client', 'jax'].includes(a.by)
        ? { approved: a.approved, note: str(a.note, 1000), at: str(a.at, 40), by: a.by } : null);
      const design = Number.isInteger(sent.version) && sent.version > 0 ? { answer: answerOf(dz.answer),
        sent: { version: sent.version, at: str(sent.at, 40), dna: { colors: strs(dnaIn.colors, 10), fonts: strs(dnaIn.fonts, 4) } },
        history: entries(dz.history).map(h => (answerOf(h) ? { version: Number.isInteger(h.version) ? h.version : 0, ...answerOf(h) } : null)).filter(Boolean) } : null;
      const bk = obj(s.buildKit), buildKit = Number.isInteger(bk.version) && bk.version > 0 ? { version: bk.version, at: str(bk.at, 40) } : null;
      return { ...common, notes, locked: false, template: null, concept, story, storyboard, look, design, buildKit, site, review: comments.length ? { comments } : null,
        ...(typeof s.siteFilesSaved === 'boolean' ? { siteFilesSaved: s.siteFilesSaved } : {}) };
    }

    // Pitch deck data (#119): each Job keeps its own deck and the evidence its numbers come from.
    function websiteJob(spaceId, jobId) {
      const space = requireSpace(spaceId);
      const job = requireJob(space.id, jobId);
      if (job.workflowId !== 'website') throw new Error('Only Website Jobs have chapter cards.');
      return { space, job };
    }
    function reviewOf(job) { return job.review || { comments: [] }; }
    function reviewJob(spaceId, jobId) {
      const found = websiteJob(spaceId, jobId);
      if (!openStages(found.job).includes('review') || found.job.waitingOnJax) throw new Error('Comments can only be added while Review is open.');
      if (!found.job.site) throw new Error('Build the site first.');
      return found;
    }
    // The site can change while Build is open, and during Review until it goes to Jax (#219).
    function siteJob(spaceId, jobId) {
      const found = websiteJob(spaceId, jobId), open = openStages(found.job);
      if (!open.includes('build') && !(open.includes('review') && !found.job.waitingOnJax)) throw new Error('The site can only change while Build or Review is open.');
      return found;
    }
    // A save during Review runs the checks again: each new problem becomes a Review comment, and an open check comment
    // whose problem is gone answers itself.
    function recheckInReview(space, job) {
      const flags = runSiteChecks(space, job).flags.filter(f => !f.resolved && !BOARD_CHECKS.includes(f.check));
      const review = reviewOf(job), keys = new Set(flags.map(f => f.key)), at = new Date(now()).toISOString();
      for (const c of review.comments) {
        if (c.source === 'check' && !c.resolved && !keys.has(c.flagKey)) c.resolved = { kind: 'fixed', note: 'The automatic check passes now.', at };
      }
      for (const f of flags) {
        if (review.comments.some(c => c.flagKey === f.key && !c.resolved)) continue;
        review.comments.push({ id: nextId('comment'), source: 'check', flagKey: f.key, pageId: null, sectionId: null, key: null,
          where: f.where, text: `The automatic check found: ${f.message}`, at, resolved: null });
      }
      job.review = review;
      emit('review-changed', { spaceId: space.id, jobId: job.id });
    }
    function answerFlag(job, key, note, at) {
      const flag = job.checks && job.checks.flags.find(f => f.key === key);
      if (!flag || flag.resolved) return;
      flag.resolved = { note, at };
      job.checkLog.push({ at, flagId: flag.id, check: flag.check, where: flag.where, message: flag.message, note });
    }
    async function saveSiteFilesFor(space, job, save) {
      const result = await saveInBatches(save, siteFiles(space.id, job.id));
      job.siteFilesSaved = !result.failed.length;
      return result;
    }
    function buildJob(spaceId, jobId) {
      const found = websiteJob(spaceId, jobId);
      if (!openStages(found.job).includes('build')) throw new Error('The site can only change while Build is open.');
      return found;
    }
    // Only this Space's kept images resolve; anything else renders without its src.
    function assetUrls(spaceId) {
      return Object.fromEntries(spaceAssets(spaceId).filter(a => !a.trashed && typeof a.url === 'string').map(a => [a.id, a.url]));
    }
    function siteAssetIds(site) {
      const ids = [];
      const walk = n => {
        if (!n || 'text' in n) return;
        for (const v of Object.values(n.attrs || {})) if (typeof v === 'string' && v.startsWith('asset:')) ids.push(v.slice(6));
        (n.children || []).forEach(walk);
      };
      for (const p of site.pages) for (const sec of p.sections) {
        walk(sec.tree);
        for (const rule of sec.styles || []) for (const v of Object.values(rule.decl)) for (const m of String(v).matchAll(/asset:([A-Za-z0-9_-]+)/g)) ids.push(m[1]);
      }
      return ids;
    }
    function siteFiles(spaceId, jobId) {
      const { space, job } = siteJob(spaceId, jobId);
      if (!job.site) throw new Error('Start the site first.');
      const pages = Object.entries(Engine.renderSite(job.site, { assets: assetUrls(space.id) }))
        .map(([file, html]) => ({ name: `Site - ${file === 'index.html' ? 'home' : file.replace(/\/index\.html$/, '').replace(/\//g, '-')}.html`, content: html }));
      return [{ name: 'site.json', content: JSON.stringify(job.site, null, 2) }, ...pages];
    }
    function storyOf(job) { return job.story || Cards.storyFromPages(job.notes.brief ? job.notes.brief.pages : []); }
    function hasAsset(spaceId, assetId) { return spaceAssets(spaceId).some(a => a.id === assetId && !a.trashed); }
    function gapsFor(space, job, stageId) {
      const gaps = Cards.stageGaps(storyOf(job), stageId, { tier: job.tier, hasAsset: id => hasAsset(space.id, id) });
      if (stageId === 'look' && !(job.look && job.look.chosenId)) gaps.unshift({ where: 'Look frame', message: 'Pick a look frame (Meridian designs them with ChatGPT).' });
      // Only Storyboard's own gate: the cards stay open until Look is done, and a chapter added then can't get a frame (#231).
      if (stageId === 'storyboard') for (const c of storyboardOf(space, job).chapters) {
        const kept = c.frames.find(f => f.id === c.keptId);   // like a shot at Look: the kept image must still be in the Space
        if (!kept || !hasAsset(space.id, kept.assetId)) gaps.push({ where: c.where, message: 'Keep a storyboard frame for this chapter.' });
      }
      return gaps;
    }
    // Storyboard frames (#231): the view follows the cards' order; a frame for a chapter no longer on the cards drops out.
    function storyboardOf(space, job) {
      const frames = (job.storyboard || {}).frames || [];
      const chapters = storyOf(job).pages.flatMap(p => p.chapters.map((c, i) => {
        const mine = frames.filter(f => f.pageId === p.id && f.chapterId === c.id), kept = mine.find(f => f.kept);
        return { pageId: p.id, pageName: p.name, chapterId: c.id, chapterName: c.name, job: c.job, where: `${p.name || 'Untitled page'} · ${c.name || `Chapter ${i + 1}`}`,
          prompt: Frames.framePrompt(job.concept, p, c, { name: space.name, dna: frameDna(space), tier: job.tier }),
          frames: mine.map(f => ({ id: f.id, assetId: f.assetId })), keptId: kept ? kept.id : null };
      }));
      return { chapters, kept: chapters.filter(c => c.keptId).length, total: chapters.length };
    }
    function boardJob(spaceId, jobId) {
      const { space, job } = websiteJob(spaceId, jobId);
      if (job.done.includes('storyboard') || job.stageId === null || (job.stageId === 'storyboard' && job.waitingOnJax)) throw new Error('The storyboard is locked once it goes to Jax.');
      return { space, job };
    }
    function chapterOf(job, pageId, chapterId) {
      const page = storyOf(job).pages.find(p => p.id === pageId), chapter = page && page.chapters.find(c => c.id === chapterId);
      if (!chapter) throw new Error('That chapter is not on the cards.');
      return { page, chapter };
    }
    // Real sign-in never sends the sample brand to ChatGPT; the project's real DNA comes with the server.
    function frameDna(space) { return practice ? sampleDna(space) : null; }
    // Design lock (#238). While it waits on the client, or once approved, everything upstream is locked, so the bundle is
    // rebuilt from it the same way every time; only the DNA could drift, so sending keeps the DNA it was sent with.
    function designBundle(space, job, dna) {
      const frames = {}, look = lookOf(job), chosen = look.frames.find(f => f.id === look.chosenId);
      for (const c of storyboardOf(space, job).chapters) {
        const kept = c.frames.find(f => f.id === c.keptId);
        if (kept) frames[`${c.pageId}/${c.chapterId}`] = kept.assetId;
      }
      return Bundle.buildBundle({ name: space.name, tier: job.tier, concept: job.concept, story: storyOf(job), frames,
        look: chosen ? { direction: chosen.direction, assetId: chosen.assetId } : null, style: Library.tokensFromDna(dna) });
    }
    function designGaps(space, job, bundle) {
      const has = id => hasAsset(space.id, id), seen = new Set();
      return [...Concept.conceptGaps(job.concept).map(g => ({ where: 'Concept', message: g.message })),
        ...Cards.stageGaps(storyOf(job), 'look', { tier: job.tier, hasAsset: has }), ...Bundle.bundleGaps(bundle, { hasAsset: has })]
        .filter(g => { const k = `${g.where}\n${g.message}`; if (seen.has(k)) return false; seen.add(k); return true; });
    }
    function designView(space, job) {
      const d = job.design || {}, frozen = !!d.sent && (job.done.includes('lock') || (job.stageId === 'lock' && job.waitingOnJax));
      const bundle = designBundle(space, job, frozen ? d.sent.dna : frameDna(space));
      return { bundle, gaps: frozen ? [] : designGaps(space, job, bundle), sent: d.sent ? { version: d.sent.version, at: d.sent.at } : null,
        answer: d.answer || null, history: d.history || [] };
    }
    function buildKitOf(space, job) {
      if (!job.done.includes('lock') || !job.design || !job.design.sent) throw new Error('The build kit is ready once the client approves the design at Design lock.');
      const view = designView(space, job), { bundle } = view, uses = {};
      const use = (id, what) => { if (id && !uses[id]) uses[id] = what; };
      if (bundle.look) use(bundle.look.frame, 'look frame');
      for (const p of bundle.pages) for (const c of p.chapters) {
        use(c.frame, `storyboard frame, ${p.name} · ${c.name}`);
        for (const s of c.shots) use(s.assetId, `${s.tool === 'video' ? 'video' : 'photo'}, ${p.name} · ${c.name}: ${s.what}`);
      }
      const images = bundle.assets.map(id => ({ id, name: ((spaceAssets(space.id).find(a => a.id === id) || {}).name) || '', use: uses[id] || '' }));
      const design = { version: view.sent.version, approvedAt: view.answer ? view.answer.at : '', approvedBy: view.answer ? view.answer.by : '' };
      const prompt = BuildPrompt.buildPrompt(bundle, { bundleFile: `${job.name} - site bundle.json`, images, version: design.version });
      return { repo: BuildPrompt.repoName(space.name), bundle, images, prompt, saved: job.buildKit || null,
        files: [{ name: 'site bundle.json', content: `${JSON.stringify({ ...bundle, design, images }, null, 2)}\n` }, { name: 'build prompt.md', content: `${prompt}\n` }] };
    }
    // Jax approving Design lock means the client said yes (through the link, or to Jax himself); it's recorded as his.
    function jaxApproves(job) {
      const d = job.design;
      if (job.stageId === 'lock' && d && d.sent && !(d.answer && d.answer.approved)) {
        d.answer = { approved: true, note: 'Jax approved it for the client.', at: new Date(now()).toISOString(), by: 'jax' };
        d.history = [...(d.history || []), { version: d.sent.version, ...d.answer }];
      }
      job.waitingOnJax = false; advance(job);
    }
    function lookOf(job) { return job.look || { frames: [], chosenId: null, tokens: null, layouts: {} }; }
    function storyReady(space, job, stageId) {
      const gaps = gapsFor(space, job, stageId);
      if (gaps.length) throw new Error(`Not ready yet: ${gaps.length} thing${gaps.length === 1 ? '' : 's'} to finish. First: ${gaps[0].where}: ${gaps[0].message}`);
    }
    function checkedJob(spaceId, jobId) {
      const space = requireSpace(spaceId);
      const job = requireJob(space.id, jobId);
      if (!CHECKED.includes(job.workflowId)) throw new Error('Only Pitch deck and Website Jobs have an automatic check.');
      return { space, job };
    }
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
      // A flag a person already resolved stays resolved when the same thing is found again. The board checks
      // (phone, live links) keep their last result until Connect runs them again (addBoardChecks).
      return storeChecks(space, job, found);
    }
    // Website Check (#206): the site checker on the finished site. Connect adds the phone and live-link checks.
    function runSiteChecks(space, job) {
      if (!job.site) throw new Error('Build the site first.');
      const assets = assetUrls(space.id);
      const sizes = Object.fromEntries(job.site.pages.map(p => [p.id, new TextEncoder().encode(Engine.renderPage(job.site, p.id, { assets })).length]));
      return storeChecks(space, job, SiteCheck.checkSite(job.site, { sizes }));
    }
    function storeChecks(space, job, found) {
      const last = job.checks || { flags: [], notRun: CHECKS_NOT_RUN };
      const before = new Map(last.flags.map(f => [f.key, f]));
      job.checks = { ranAt: new Date(now()).toISOString(), notRun: last.notRun || CHECKS_NOT_RUN, flags: [...found.map(f => {
        const key = `${f.check}|${f.where}|${f.message}`;
        return before.get(key) || { id: nextId('flag'), key, ...f, resolved: null };
      }), ...last.flags.filter(f => BOARD_CHECKS.includes(f.check))] };
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
  function createServerService({ request, local, saveFile, readSave, checkBoard, board }) {
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

    // Pitch deck (#171) and Website (#226) Jobs live in each client project's folder (Docs) until the server has Jobs (#120),
    // so they survive a restart and everyone sees the same Job. One file per workflow, each with a revision number that stops
    // one person's save from silently replacing another's; a change only ever saves its own workflow's file.
    const SAVE_FILES = Object.freeze({ 'pitch-deck': 'Pitch deck - Studio save.json', website: 'Website - Studio save.json' });
    const KINDS = Object.keys(SAVE_FILES), WHAT = { 'pitch-deck': 'this deck', website: 'this website' };
    const saves = new Map(); // `${kind}|${spaceId}` -> { revision, loading, dirty }
    const keeps = async spaceId => typeof readSave === 'function' && typeof saveFile === 'function'
      && (await local.listSpaces()).some(s => s.id === spaceId && s.type === 'client');
    async function readSaved(spaceId, kind) {
      const res = await readSave(spaceId, SAVE_FILES[kind]);
      if (res && res.missing) return { revision: 0, jobs: [] };
      if (!res || !res.success) throw new Error('Couldn\'t reach the project folder. Check your connection, then try again.');
      let data = null;
      try { data = JSON.parse(res.content); } catch (_) { /* checked below */ }
      if (!data || data.version !== 1 || !Array.isArray(data.jobs)) throw new Error(`The saved ${kind === 'website' ? 'website' : 'pitch deck'} in the project folder can't be read. Ask Jax before changing it.`);
      return { revision: Number(data.revision) || 0, jobs: data.jobs };
    }
    async function loadOne(spaceId, kind) {
      const entry = saves.get(`${kind}|${spaceId}`) || { revision: 0, loading: null, dirty: false };
      saves.set(`${kind}|${spaceId}`, entry);
      if (!entry.loading) {
        // No save file yet (revision 0): keep what this computer has; the next change writes the first save.
        entry.loading = readSaved(spaceId, kind).then(data => { entry.revision = data.revision; if (data.revision > 0) local.importJobs(spaceId, data.jobs, kind); })
          .catch(error => { entry.loading = null; throw error; });
      }
      await entry.loading;
      return entry;
    }
    async function loadSaved(spaceId) {
      if (!(await keeps(spaceId))) return null;
      for (const kind of KINDS) await loadOne(spaceId, kind);
      return true;
    }
    // When the project's Jobs are listed, pick up a newer save (e.g. Tyler's), unless this computer has a change still to save.
    async function refreshSaved(spaceId) {
      if (!(await loadSaved(spaceId))) return;
      for (const kind of KINDS) {
        const entry = saves.get(`${kind}|${spaceId}`);
        if (entry.dirty) continue;
        const remote = await readSaved(spaceId, kind);
        if (remote.revision > entry.revision) { entry.revision = remote.revision; local.importJobs(spaceId, remote.jobs, kind); }
      }
    }
    async function saveJobs(spaceId, kind = 'pitch-deck') {
      if (!SAVE_FILES[kind] || !(await loadSaved(spaceId))) return;
      const entry = saves.get(`${kind}|${spaceId}`);
      const remote = await readSaved(spaceId, kind);
      if (remote.revision !== entry.revision) {   // someone else saved first: take theirs, so nothing is silently lost
        entry.revision = remote.revision; entry.dirty = false; local.importJobs(spaceId, remote.jobs, kind);
        throw new Error(`Someone else saved ${WHAT[kind]} a moment ago. Studio loaded their version; please do your last change again.`);
      }
      const revision = entry.revision + 1;
      const res = await saveFile(spaceId, SAVE_FILES[kind], JSON.stringify({ version: 1, revision, savedAt: new Date().toISOString(), jobs: local.exportJobs(spaceId, kind) }));
      if (!res || !res.success) { entry.dirty = true; throw new Error('Couldn\'t save to the project folder. Your change is kept on this computer and saves with your next change.'); }
      entry.revision = revision; entry.dirty = false;
    }
    async function kindOf(spaceId, jobId) {
      try { const job = await local.getJob(spaceId, jobId); return SAVE_FILES[job.workflowId] ? job.workflowId : null; } catch (_) { return null; }
    }
    const loaded = method => async (spaceId, ...rest) => { await loadSaved(spaceId); return local[method](spaceId, ...rest); };
    // Saves the file of the Job the call changed (startJob: the Job it started).
    const saved = method => async (spaceId, ...rest) => {
      await loadSaved(spaceId);
      const out = await local[method](spaceId, ...rest);
      const kind = await kindOf(spaceId, method === 'startJob' ? out && out.id : rest[0]);
      if (kind) await saveJobs(spaceId, kind);
      return out;
    };
    // Auto check part 2 (#131): Connect's main process opens the finished board at phone width (screenshot to the
    // project's Docs) and tries every link. If it can't run (offline, a deck that doesn't render yet), those stay "not run".
    async function boardChecks(spaceId, jobId) {
      const Board = board || (typeof window === 'undefined' ? null : window.MeridianPitchBoard);
      if (typeof checkBoard !== 'function' || !Board) return;
      try {
        const [deck, job] = await Promise.all([local.getDeck(spaceId, jobId), local.getJob(spaceId, jobId)]);
        const res = await checkBoard({ projectId: spaceId, html: Board.renderDeck(deck), links: deckLinks(deck),
          fileName: `${job.name} - Board on a phone.png` });
        if (res && res.success) local.addBoardChecks(spaceId, jobId, res);
      } catch (_) { /* the deck checker already flags a deck that can't render */ }
    }
    // Website Check (#206): Connect checks every page at phone width (a screenshot of each goes to Docs) and every
    // outside link once. The phone check counts as run only when every page ran.
    async function siteBoardChecks(spaceId, jobId) {
      if (typeof checkBoard !== 'function') return;
      try {
        const { pages, links } = await local.getCheckPages(spaceId, jobId);
        const flags = [], phoneRan = [];
        for (const [i, page] of pages.entries()) {
          const res = await checkBoard({ projectId: spaceId, html: page.html, links: i === 0 ? links : [], fileName: page.fileName });
          if (!res || !res.success) { phoneRan.push(false); continue; }
          phoneRan.push((res.ran || []).includes('phone-screenshot'));
          for (const f of res.flags || []) flags.push(f.check === 'phone' ? { ...f, where: page.label, message: String(f.message || '').replace('the board is', 'the page is') } : f);
        }
        const ran = [...(phoneRan.length && phoneRan.every(Boolean) ? ['phone-screenshot'] : []), ...(phoneRan[0] !== false ? ['links-open'] : [])];
        local.addBoardChecks(spaceId, jobId, { flags, ran });
      } catch (_) { /* the phone and link checks stay "not run" */ }
    }

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

    async function saveProjectFiles(spaceId, jobId, files) {
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
      assignStage: saved('assignStage'),
      approveAsset: notHere,
      approveStage: notHere,
      // Local until the server has Jobs (no cost involved).
      getWorkflow: (...a) => local.getWorkflow(...a),
      // Pitch deck Jobs are saved to the project folder after every change (#171).
      startJob: saved('startJob'),
      getJob: loaded('getJob'),
      async listJobs(spaceId) { await refreshSaved(spaceId); return local.listJobs(spaceId); },
      async completeStage(spaceId, jobId, stageId) {
        await loadSaved(spaceId);
        const out = await local.completeStage(spaceId, jobId, stageId);
        if (out && out.workflowId === 'pitch-deck') {
          if (out.stageId === 'check') await boardChecks(spaceId, jobId);   // Assemble board just finished
          await saveJobs(spaceId);
        }
        if (out && out.workflowId === 'website') {
          if (out.stageId === 'check') await siteBoardChecks(spaceId, jobId);   // Build just finished
          await saveJobs(spaceId, 'website');
        }
        return out;
      },
      setStageNeed: saved('setStageNeed'),
      getStageNotes: loaded('getStageNotes'),
      // Website Jobs are saved to the project folder after every change (#226), like pitch decks.
      getBuildKit: loaded('getBuildKit'),
      async saveBuildKit(spaceId, jobId) {   // Connect writes the files; the Job remembers which design version went out (#246)
        await loadSaved(spaceId);
        const kit = await local.getBuildKit(spaceId, jobId);
        let files;
        try { files = await saveProjectFiles(spaceId, jobId, kit.files); } catch (error) { files = { saved: [], failed: [{ name: 'build kit', error: error.message }] }; }
        local.markBuildKit(spaceId, jobId, files);
        await saveJobs(spaceId, 'website');
        return files;
      },
      getDesignLock: loaded('getDesignLock'),
      sendBack: saved('sendBack'),
      answerDesign: async () => notOnServerYet(),   // the client answers through a link the server hosts
      getStoryboard: loaded('getStoryboard'),
      keepStoryboardFrame: saved('keepStoryboardFrame'),
      makeStoryboardFrame: async () => notOnServerYet(),   // ChatGPT images come with the server, like look frames
      getConcept: loaded('getConcept'),
      saveConcept: saved('saveConcept'),
      // Real drafting comes with Meridian on the server; sample words must never reach a real client's site.
      draftConcept: async () => notOnServerYet(),
      getStory: loaded('getStory'),
      saveStory: saved('saveStory'),
      getStoryGaps: loaded('getStoryGaps'),
      getLook: loaded('getLook'),
      getShotPrompts: loaded('getShotPrompts'),
      // Real look frames need Website Jobs on the server (their images live there); until then, say so.
      makeLookFrames: async () => notOnServerYet(),
      chooseLookFrame: async () => notOnServerYet(),
      // The builder's site stays local with the cards (#198); it starts from the project's real DNA, never the sample one.
      getSite: loaded('getSite'),
      async startSite(spaceId, jobId, options = {}) {
        await loadSaved(spaceId);
        const space = await call('GET', `/api/studio/spaces/${enc(spaceId)}`);
        const out = await local.startSite(spaceId, jobId, { ...options, dna: (space && space.dna) || null });
        if (out && out.ok) await saveJobs(spaceId, 'website');
        return out;
      },
      async saveSite(spaceId, jobId, site) {
        await loadSaved(spaceId);
        const out = await local.saveSite(spaceId, jobId, site);
        if (!out || !out.ok) return out;
        let result = out;
        if ((await local.getJob(spaceId, jobId)).stageId === 'review') {   // during Review (#219) the project folder's files follow every save
          let files;
          try { files = await saveInBatches(list => saveProjectFiles(spaceId, jobId, list), await local.getSiteFiles(spaceId, jobId)); }
          catch (error) { files = { saved: [], failed: [{ name: 'site files', error: error.message }] }; }
          local.markSiteFiles(spaceId, jobId, files);
          result = { ...out, files };
        }
        await saveJobs(spaceId, 'website');
        return result;
      },
      previewPage: loaded('previewPage'),
      getSiteFiles: loaded('getSiteFiles'),
      getReview: loaded('getReview'),
      addReviewComment: saved('addReviewComment'),
      resolveReviewComment: saved('resolveReviewComment'),
      async finishSite(spaceId, jobId) {
        await loadSaved(spaceId);
        const files = await local.getSiteFiles(spaceId, jobId);
        return saveInBatches(list => saveProjectFiles(spaceId, jobId, list), files);
      },
      saveStageNotes: saved('saveStageNotes'),
      draftCopy: (...a) => local.draftCopy(...a),
      // Real drafting comes with Meridian on the server; sample words must never reach a real client's site.
      draftChapter: async () => notOnServerYet(),
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
      async runChecks(spaceId, jobId) {
        await loadSaved(spaceId);
        await local.runChecks(spaceId, jobId);
        const kind = (await local.getJob(spaceId, jobId)).workflowId;
        if (kind === 'website') await siteBoardChecks(spaceId, jobId); else await boardChecks(spaceId, jobId);
        await saveJobs(spaceId, kind);
        return (await local.getChecks(spaceId, jobId)).flags;
      },
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
      saveToProjectFiles: saveProjectFiles,
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
