/* Storyboard frames (#231): one ChatGPT frame per chapter, a wide still of how that chapter will look, from its card and
 * the concept (Website Build Pipeline: One System, 2026-10-27). Kept in order, the frames read like a film strip of the
 * site, start to finish. Core lane, pure: this file only writes the prompt; images come from Image gen (ChatGPT images). */
'use strict';

(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./section-library.js') : root && root.MeridianSectionLibrary);
  if (node) module.exports = api;
  if (root) root.MeridianStoryboardFrames = api;
})(typeof window === 'undefined' ? null : window, function (Lib) {
  const MAX_PROMPT = 3800;
  const RULES = 'Rules: show the exact words given, spelled correctly; no lorem ipsum or placeholder text; no star ratings, review counts, '
    + 'testimonials or prices; no other company names or logos; no watermarks.';
  const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
  const quote = s => `"${String(s || '').replace(/"/g, '\'')}"`;

  /** The ChatGPT image prompt for one chapter's storyboard frame (desktop, wide 3:2). */
  function framePrompt(concept, page, chapter, { name, dna, tier = 'standard' } = {}) {
    if (!page || !chapter) throw new Error('Pick a chapter on the cards first.');
    const c = concept || {}, w = chapter.words || {};
    const layout = (Lib.LAYOUT_INFO[chapter.layout] || Lib.LAYOUT_INFO.custom).name;
    const words = [w.eyebrow && `label ${quote(w.eyebrow)}`, w.headline && `headline ${quote(w.headline)}`,
      w.body && `body ${quote(clip(w.body, 300))}`, w.button && `button ${quote(w.button)}`].filter(Boolean).join(', ');
    const shots = (chapter.shots || []).map(s => s.what).filter(Boolean);
    const colours = ((dna && dna.colors) || []).filter(x => /^#[0-9a-f]{3,6}$/i.test(x));
    const fonts = ((dna && dna.fonts) || []).filter(f => typeof f === 'string');
    const parts = [
      `Storyboard frame for one section of the "${name}" website: the "${chapter.name || layout}" section of the ${page.name || 'home'} page, desktop, wide 3:2.`,
      chapter.job ? `Its one job: ${chapter.job}.` : '',
      `Layout: ${layout}.`,
      words ? `Words: ${words}.` : '',
      shots.length ? `Photos: ${shots.join(', ')}.` : '',
      c.line ? `The big idea for the whole site: ${quote(c.line)}.` : '',
      c.mood && c.mood.length ? `Mood: ${c.mood.join(', ')}.` : '',
      c.audience ? `For: ${c.audience}.` : '',
      colours.length ? `Brand colours: ${colours.join(', ')}.` : '',
      fonts.length ? `Type in the spirit of ${fonts.join(' and ')}.` : '',
      tier === 'cinematic' ? 'Cinematic tier: layered depth and a sense of motion.' : 'Standard tier: clean and fast, no motion effects.',
      'A storyboard frame, not the final design: show the layout, the words and the feel clearly.',
      RULES,
    ].filter(Boolean);
    return clip(parts.join(' '), MAX_PROMPT);
  }

  return Object.freeze({ MAX_PROMPT, framePrompt });
});
