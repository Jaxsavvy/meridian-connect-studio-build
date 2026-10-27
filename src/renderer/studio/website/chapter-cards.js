/* Chapter cards: the one record a Website Job is built from (#186). Core lane.
 * Pipeline (Website Build Pipeline doc, 2026-10-26): a story is pages; each page is chapters in order; each
 * chapter card fills up step by step (Story and sitemap -> Words -> Storyboard -> Look and assets), and
 * becomes exactly one section of the site at Build. stageGaps() lists what a stage's gate still needs. */
'use strict';

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianChapterCards = api;
})(typeof window === 'undefined' ? null : window, function () {
  const LAYOUTS = Object.freeze(['hero-photo', 'hero-video', 'hero-split', 'services', 'process', 'before-after', 'gallery', 'why-us',
    'service-area', 'proof', 'faq', 'booking', 'contact', 'cta-band', 'footer', 'custom']);
  const MOTION = Object.freeze(['none', 'fade-up', 'parallax', 'reveal', 'video-bg']);
  const SIZES = Object.freeze(['wide', 'tall', 'square']);
  const SHOT_TOOLS = Object.freeze(['image', 'video']);
  const GATED = Object.freeze(['plan', 'words', 'storyboard', 'look']); // in pipeline order; each gate includes the ones before it
  const LIMITS = Object.freeze({ pages: 20, chapters: 15, shots: 8, proof: 6 });
  const PLACEHOLDER = /\b(tbd|todo|lorem ipsum|placeholder|xxx)\b|\{\{|\}\}/i;
  const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

  const text = (value, field, max) => {
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string') throw new Error(`${field} must be text.`);
    if (value.length > max) throw new Error(`${field} is too long (max ${max} characters).`);
    return value.trim();
  };
  const list = (value, field, max) => {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw new Error(`${field} must be a list.`);
    if (value.length > max) throw new Error(`${field}: at most ${max}.`);
    return value;
  };
  const pick = (value, allowed) => (allowed.includes(value) ? value : '');
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  function uniqueId(wanted, fallback, used) {
    let id = typeof wanted === 'string' && ID.test(wanted) && !used.has(wanted) ? wanted : fallback;
    for (let n = 2; used.has(id); n += 1) id = `${fallback}-${n}`;
    used.add(id);
    return id;
  }

  /** Cleans a story: wrong types are refused, unknown fields dropped, missing fields left empty for the gates to list. */
  function cleanStory(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('A story must be a group of fields.');
    const pageIds = new Set();
    const pages = list(input.pages, 'Pages', LIMITS.pages).map((p, i) => {
      if (!p || typeof p !== 'object') throw new Error('Each page must be a group of fields.');
      const name = text(p.name, 'Page name', 80);
      const chapterIds = new Set();
      return { id: uniqueId(p.id, `page-${i + 1}`, pageIds), name, path: text(p.path, 'Page path', 80), purpose: text(p.purpose, 'Page purpose', 300),
        chapters: list(p.chapters, 'Chapters', LIMITS.chapters).map((c, j) => cleanCard(c, j, chapterIds)) };
    });
    return { version: 1, pages };
  }

  function cleanCard(c, j, used) {
    if (!c || typeof c !== 'object') throw new Error('Each chapter must be a group of fields.');
    const w = c.words && typeof c.words === 'object' ? c.words : {};
    const shotIds = new Set();
    return {
      id: uniqueId(c.id, `ch-${j + 1}`, used), name: text(c.name, 'Chapter name', 80), job: text(c.job, 'Chapter job', 300),
      words: { eyebrow: text(w.eyebrow, 'Eyebrow', 60), headline: text(w.headline, 'Headline', 200), body: text(w.body, 'Body', 4000), button: text(w.button, 'Button text', 60) },
      layout: pick(c.layout, LAYOUTS), motion: pick(c.motion, MOTION), phone: text(c.phone, 'Phone note', 300),
      shots: list(c.shots, 'Shots', LIMITS.shots).map((s, k) => ({ id: uniqueId(s && s.id, `shot-${k + 1}`, shotIds),
        what: text(s && s.what, 'Shot', 200), prompt: text(s && s.prompt, 'Shot prompt', 2000), size: pick(s && s.size, SIZES),
        tool: pick(s && s.tool, SHOT_TOOLS), assetId: typeof (s && s.assetId) === 'string' && s.assetId ? s.assetId : null })),
      proof: list(c.proof, 'Proof', LIMITS.proof).map(p => ({ claim: text(p && p.claim, 'Proof claim', 300), source: text(p && p.source, 'Proof source', 300) })),
    };
  }

  /** The starting story: one page per page named at Kickoff (Home first, at "/"). */
  function storyFromPages(names) {
    const wanted = (Array.isArray(names) ? names : []).filter(n => typeof n === 'string' && n.trim());
    const home = wanted.find(n => /^home$/i.test(n.trim())) || 'Home';
    const rest = wanted.filter(n => n !== home);
    return cleanStory({ pages: [home, ...rest].map(n => ({ id: slug(n) || undefined, name: n.trim(), path: n === home ? '/' : `/${slug(n)}` })) });
  }

  /** What a gate still needs, as [{ where, message }]. stageId: 'plan' | 'words' | 'storyboard' | 'look'.
   *  options: { tier: 'standard' | 'cinematic', hasAsset(assetId) -> bool }. Later gates include the earlier ones. */
  function stageGaps(story, stageId, { tier = 'standard', hasAsset = () => false } = {}) {
    const upTo = GATED.indexOf(stageId);
    if (upTo < 0) return [];
    const at = stage => GATED.indexOf(stage) <= upTo;
    const gaps = [];
    const need = (where, message) => gaps.push({ where, message });
    const pages = (story && story.pages) || [];
    if (!pages.length) need('Pages', 'Add at least one page.');
    const paths = new Set();
    if (pages.length && !pages.some(p => p.path === '/')) need('Pages', 'One page must be the home page (path "/").');
    for (const p of pages) {
      const pw = p.name || 'Untitled page';
      if (!p.name) need(pw, 'Give the page a name.');
      if (!/^\/([a-z0-9-]+\/?)*$/.test(p.path || '') || paths.has(p.path)) need(pw, 'Give the page its own path, like / or /services.');
      paths.add(p.path);
      if (!p.purpose) need(pw, 'Say what the page is for.');
      if (!p.chapters.length) need(pw, 'Add at least one chapter.');
      p.chapters.forEach((c, i) => {
        const cw = `${pw} · ${c.name || `Chapter ${i + 1}`}`;
        if (!c.name) need(cw, 'Name the chapter.');
        if (!c.job) need(cw, 'Give the chapter one job: what it makes the visitor think, feel or do.');
        if (at('words')) {
          if (!c.words.headline) need(cw, 'Write the headline.');
          if (!c.words.body) need(cw, 'Write the body text.');
          const all = `${c.words.eyebrow} ${c.words.headline} ${c.words.body} ${c.words.button}`;
          if (PLACEHOLDER.test(all)) need(cw, 'Replace the placeholder text.');
        }
        if (at('storyboard')) {
          if (!c.layout) need(cw, 'Pick a layout from the section library.');
          if (!c.motion) need(cw, 'Pick the motion (or "none").');
          if (!c.phone) need(cw, 'Add the phone note: what changes on a phone.');
          if (tier === 'standard' && c.motion && c.motion !== 'none') need(cw, 'Standard sites have no motion; pick "none".');
          c.shots.forEach((s, k) => {
            const sw = `${cw} · ${s.what || `Shot ${k + 1}`}`;
            if (!s.what || !s.prompt) need(sw, 'Say what the shot shows and write its prompt.');
            if (!s.size || !s.tool) need(sw, 'Pick the shot size and tool.');
            if (tier === 'standard' && s.tool === 'video') need(sw, 'Standard sites use photos; video is Cinematic.');
          });
          c.proof.forEach(pr => { if (!pr.claim || !pr.source) need(cw, 'Every proof needs its claim and its source.'); });
        }
        if (at('look')) c.shots.forEach((s, k) => {
          if (!s.assetId || !hasAsset(s.assetId)) need(`${cw} · ${s.what || `Shot ${k + 1}`}`, 'Make this shot and keep it.');
        });
      });
    }
    return gaps;
  }

  return Object.freeze({ LAYOUTS, MOTION, SIZES, SHOT_TOOLS, GATED, LIMITS, cleanStory, storyFromPages, stageGaps });
});
