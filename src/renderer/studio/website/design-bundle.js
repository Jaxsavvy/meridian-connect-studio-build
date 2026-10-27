/* Design lock (#238): the one bundle the front half settles (Website Build Pipeline: One System, 2026-10-27): the concept,
 * the cards, the storyboard, the chosen look, the assets and the style numbers. The client approves it, and the build is
 * made from it with nothing left to guess. Core lane, pure: buildBundle() puts it together, bundleGaps() lists what's missing. */
'use strict';

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianDesignBundle = api;
})(typeof window === 'undefined' ? null : window, function () {
  const FORMAT = 'meridian-site-bundle', VERSION = 1;

  /** frames: { 'pageId/chapterId': assetId } (the kept storyboard frames); look: { direction, assetId } (the chosen look
   *  frame); style: the style numbers. Every image the bundle uses is listed once in `assets`, look frame first. */
  function buildBundle({ name, tier, concept, story, frames = {}, look = null, style }) {
    const assets = [];
    const use = id => { if (id && !assets.includes(id)) assets.push(id); return id || null; };
    const lookPart = look ? { direction: look.direction, frame: use(look.assetId) } : null;
    const pages = ((story && story.pages) || []).map(p => ({ id: p.id, name: p.name, path: p.path, purpose: p.purpose,
      chapters: p.chapters.map(c => ({ id: c.id, name: c.name, job: c.job, words: { ...c.words }, layout: c.layout, motion: c.motion, phone: c.phone,
        proof: c.proof.map(pr => ({ claim: pr.claim, source: pr.source })), frame: use(frames[`${p.id}/${c.id}`]),
        shots: c.shots.map(s => ({ id: s.id, what: s.what, size: s.size, tool: s.tool, assetId: use(s.assetId) })) })) }));
    return { format: FORMAT, version: VERSION, business: { name }, tier,
      concept: concept ? { line: concept.line, audience: concept.audience, goal: concept.goal,
        references: concept.references.map(r => ({ url: r.url, note: r.note })), mood: [...concept.mood] } : null,
      look: lookPart, style, pages, assets };
  }

  /** What the bundle still lacks: [{ where, message }]. hasAsset(assetId) says whether an image is still kept. */
  function bundleGaps(bundle, { hasAsset = () => true } = {}) {
    const gaps = [], need = (where, message) => gaps.push({ where, message });
    if (!bundle.concept || !bundle.concept.line) need('Concept', 'Write the concept and have Jax approve it.');
    if (!bundle.look || !bundle.look.frame || !hasAsset(bundle.look.frame)) need('Look frame', 'Pick a look frame (Meridian designs them with ChatGPT).');
    if (!bundle.pages.length) need('Pages', 'Add at least one page.');
    for (const p of bundle.pages) p.chapters.forEach((c, i) => {
      const where = `${p.name || 'Untitled page'} · ${c.name || `Chapter ${i + 1}`}`;
      if (!c.frame || !hasAsset(c.frame)) need(where, 'Keep a storyboard frame for this chapter.');
      c.shots.forEach((s, k) => { if (!s.assetId || !hasAsset(s.assetId)) need(`${where} · ${s.what || `Shot ${k + 1}`}`, 'Make this shot and keep it.'); });
    });
    return gaps;
  }

  return Object.freeze({ FORMAT, VERSION, buildBundle, bundleGaps });
});
