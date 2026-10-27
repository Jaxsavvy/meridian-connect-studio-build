/* Look frames: ChatGPT designs the look, the site engine builds it (#191). Core lane.
 * Jax, 2026-10-26: ChatGPT does visual design much better, so in Look and assets it designs 2-3 full-page
 * "look frames" from the finished chapter cards + Project DNA; Jax picks one; every shot is then made in that
 * frame's style; the frame's colours, type and section choices become the site's style numbers. The build still
 * goes through the section library and the engine, so the site stays fast, safe and click-to-edit.
 * This file only writes prompts and checks what comes back; images come from Image gen (ChatGPT images). */
'use strict';

(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./section-library.js') : root && root.MeridianSectionLibrary);
  if (node) module.exports = api;
  if (root) root.MeridianLookFrames = api;
})(typeof window === 'undefined' ? null : window, function (Lib) {
  // Three directions, so the frames are real choices, not three of the same.
  const DIRECTIONS = Object.freeze([
    Object.freeze({ id: 'bold', name: 'Bold and confident', brief: 'Bold and confident: oversized tight headlines, full-bleed photography, high-contrast dark bands, one strong accent colour.' }),
    Object.freeze({ id: 'warm', name: 'Warm and trusted', brief: 'Warm and trustworthy: softer natural palette, rounded photo cards, friendly photography of real crews at work, relaxed spacing.' }),
    Object.freeze({ id: 'premium', name: 'Premium and editorial', brief: 'Premium and editorial: refined headline type, generous white space, cinematic golden-hour photography, restrained colour.' }),
  ]);
  const MAX_PROMPT = 3800;
  const RULES = 'Rules: show the exact words given, spelled correctly; no lorem ipsum or placeholder text; no star ratings, review counts, '
    + 'testimonials or prices; no other company names or logos; no watermarks. Realistic, professional, premium local-business website.';
  const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
  const quote = s => `"${String(s || '').replace(/"/g, '\'')}"`;

  /** The ChatGPT image prompt for one full-page look frame of the home page (desktop, top to bottom). */
  function framePrompt(story, { name, dna, tier = 'standard', direction = 'bold' } = {}) {
    const dir = DIRECTIONS.find(d => d.id === direction) || DIRECTIONS[0];
    const home = ((story && story.pages) || []).find(p => p.path === '/') || ((story && story.pages) || [])[0];
    if (!home || !home.chapters.length) throw new Error('The home page needs chapters before Meridian can design it.');
    const colours = ((dna && dna.colors) || []).filter(c => /^#[0-9a-f]{3,6}$/i.test(c));
    const fonts = ((dna && dna.fonts) || []).filter(f => typeof f === 'string');
    const sections = home.chapters.map((c, i) => {
      const layout = (Lib.LAYOUT_INFO[c.layout] || Lib.LAYOUT_INFO.custom).name;
      const words = [c.words.eyebrow && `label ${quote(c.words.eyebrow)}`, c.words.headline && `headline ${quote(c.words.headline)}`,
        c.words.button && `button ${quote(c.words.button)}`].filter(Boolean).join(', ');
      const pics = c.shots.length ? `; photo: ${c.shots.map(s => s.what).filter(Boolean).join(', ')}` : '';
      return `${i + 1}. ${layout}${words ? `: ${words}` : ''}${pics}`;
    });
    const parts = [
      `Full-page website home page design mockup for "${name}", desktop 1440px wide, the whole page shown top to bottom in one tall image.`,
      dna && dna.audience ? `Audience: ${dna.audience}.` : '',
      dna && dna.voice ? `Voice: ${dna.voice}.` : '',
      colours.length ? `Brand colours: ${colours.join(', ')}.` : '',
      fonts.length ? `Type in the spirit of ${fonts.join(' and ')}.` : '',
      `Design direction: ${dir.brief}`,
      tier === 'cinematic' ? 'Cinematic tier: layered depth, video-still hero, sense of motion.' : 'Standard tier: clean and fast, no motion effects.',
      `Sections in this exact order: ${sections.join(' | ')}.`,
      RULES,
    ].filter(Boolean);
    return clip(parts.join(' '), MAX_PROMPT);
  }

  /** The ChatGPT image prompt for one shot on a card, made in the chosen frame's style so every photo matches. */
  function shotPrompt(shot, { direction = 'bold', dna, tier = 'standard' } = {}) {
    const dir = DIRECTIONS.find(d => d.id === direction) || DIRECTIONS[0];
    const colours = ((dna && dna.colors) || []).filter(c => /^#[0-9a-f]{3,6}$/i.test(c));
    return clip([`${shot.prompt || shot.what}.`, `Photographic style to match the chosen site design: ${dir.brief}`,
      colours.length ? `Let the brand colours ${colours.join(', ')} appear naturally in the scene, never as overlays.` : '',
      shot.size === 'tall' ? 'Portrait framing.' : shot.size === 'square' ? 'Square framing.' : 'Wide framing with room for a headline on the left.',
      tier === 'cinematic' && shot.tool === 'video' ? 'A still that will become a short looping video.' : '',
      'Photorealistic, natural light, no text, no logos, no watermarks, no people\'s faces in sharp focus unless the card asks for them.'].filter(Boolean).join(' '), MAX_PROMPT);
  }

  /** What the vision read of the chosen frame may set: colours, fonts and a layout per chapter (only from the library).
   *  Anything else is dropped; colours that would make text unreadable are fixed by the library's contrast rules. */
  function tokensFromFrame(read, story, fallbackDna) {
    const r = read && typeof read === 'object' ? read : {};
    const hex = v => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null);
    const colours = [hex(r.colors && r.colors.text), hex(r.colors && r.colors.accent)].filter(Boolean);
    const fonts = [r.fonts && r.fonts.heading, r.fonts && r.fonts.body].filter(f => typeof f === 'string' && /^[A-Za-z0-9 ]{1,40}$/.test(f));
    const tokens = Lib.tokensFromDna({ colors: colours.length ? colours : (fallbackDna && fallbackDna.colors) || [], fonts: fonts.length ? fonts : (fallbackDna && fallbackDna.fonts) || [] });
    const bg = hex(r.colors && r.colors.bg), surface = hex(r.colors && r.colors.surface);
    if (bg && Lib.contrast(bg, tokens.colors.text) >= 7) tokens.colors.bg = bg;
    if (surface && Lib.contrast(surface, tokens.colors.text) >= 4.5) tokens.colors.surface = surface;
    const ids = new Set(((story && story.pages) || []).flatMap(p => p.chapters.map(c => c.id)));
    const layouts = {};
    for (const [id, layout] of Object.entries((r && r.layouts) || {})) if (ids.has(id) && Lib.LAYOUT_INFO[layout] && layout !== 'custom') layouts[id] = layout;
    return { tokens, layouts };
  }

  return Object.freeze({ DIRECTIONS, framePrompt, shotPrompt, tokensFromFrame });
});
