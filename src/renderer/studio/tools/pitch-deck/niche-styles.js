'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianNicheStyles = api;
})(typeof window === 'undefined' ? null : window, function () {
  // The look half of the niche packs (#138): per trade, three home-page tiers, each a clear step up from the last.
  const FOOTER = 'Concept for discussion, not affiliated with {business}';
  const NICHES = Object.freeze({
    roofer: { colors: { ink: '#1f2a36', accent: '#d9622b', surface: '#f5f1ec' }, fonts: { display: 'Oswald', body: 'Inter' },
      heroKind: 'photo-split', trade: ['inspection', 'storm-damage'], proof: 'project-photos' },
    hvac: { colors: { ink: '#0f2a44', accent: '#1e88e5', surface: '#eef5fb' }, fonts: { display: 'Montserrat', body: 'Inter' },
      heroKind: 'photo-split', trade: ['same-day-banner', 'seasonal-tune-up'], proof: 'service-checklist' },
    remodeler: { colors: { ink: '#2b2622', accent: '#b8893b', surface: '#f7f4ef' }, fonts: { display: 'Playfair Display', body: 'Lato' },
      heroKind: 'before-after', trade: ['before-after', 'project-gallery'], proof: 'process-steps' },
    general: { colors: { ink: '#0b1f3a', accent: '#2bb3a3', surface: '#f4f6f8' }, fonts: { display: 'Georgia', body: 'Arial' },
      heroKind: 'photo-split', trade: ['why-us'], proof: 'process-steps' },
  });
  const ALIASES = Object.freeze({ roofer: 'roofer', roofing: 'roofer', hvac: 'hvac', heating: 'hvac', cooling: 'hvac',
    remodeler: 'remodeler', remodeling: 'remodeler', remodel: 'remodeler' });
  // Section words match what the Home page builder builds: hero, services, story, booking, contact.
  const SPACING = Object.freeze({ 1: { section: '2.5rem', radius: '6px', hero: '2.2rem' },
    2: { section: '3.5rem', radius: '10px', hero: '3rem' }, 3: { section: '4.5rem', radius: '14px', hero: '3.6rem' } });

  /** Which niche a name means: 'roofer' | 'hvac' | 'remodeler', or 'general' for anything else. */
  function nicheOf(name) {
    const key = String(name || '').trim().toLowerCase().replace(/s$/, '');
    return ALIASES[key] || 'general';
  }

  /** Layout, section order and style tokens for one niche and tier (1-3). Tier 3 adds motion and video slots. */
  function nicheStyle(niche, tier) {
    const id = nicheOf(niche), n = NICHES[id], t = [1, 2, 3].includes(Number(tier)) ? Number(tier) : 1;
    const sections = t === 1 ? ['header', 'hero', 'services', 'contact', 'footer']
      : ['header', t === 3 ? 'video-hero' : 'hero', 'services', ...n.trade, 'story', n.proof,
        ...(t === 3 ? ['video-moments'] : []), 'booking', 'footer'];
    return {
      niche: id, tier: t, sections,
      heroKind: t === 1 ? 'simple' : t === 2 ? n.heroKind : 'video',
      motion: t === 3, videoSlots: t === 3 ? 2 : 0,
      tokens: { colors: { ...n.colors, hero: t === 1 ? n.colors.surface : n.colors.ink }, fonts: { ...n.fonts }, spacing: { ...SPACING[t] } },
      footer: FOOTER,
    };
  }

  /** All nine trade styles plus the general fallback, for previews and checks. */
  function allStyles() {
    return ['roofer', 'hvac', 'remodeler', 'general'].flatMap(n => [1, 2, 3].map(t => nicheStyle(n, t)));
  }
  return { FOOTER, nicheOf, nicheStyle, allStyles };
});
