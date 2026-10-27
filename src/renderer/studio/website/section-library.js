/* Section library + style numbers + assembler (#189). Core lane.
 * Build is assembly, not design (Website Build Pipeline doc): every chapter card's layout maps to one tested
 * section here, styled only by the client's style numbers (from Project DNA), and the finished storyboard becomes
 * a site in the site engine format. List layouts read the body one item per line: "Name: detail". */
'use strict';

(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./site-engine.js') : root && root.MeridianSiteEngine);
  if (node) module.exports = api;
  if (root) root.MeridianSectionLibrary = api;
})(typeof window === 'undefined' ? null : window, function (Engine) {
  // What each layout is and what its card needs. `shots` = how many images it shows (min).
  const LAYOUT_INFO = Object.freeze({
    'hero-photo': { name: 'Hero with photo', shots: 1 }, 'hero-video': { name: 'Hero with video', shots: 1 },
    'hero-split': { name: 'Hero, words and photo side by side', shots: 1 }, services: { name: 'Services grid', shots: 0 },
    process: { name: 'Numbered steps', shots: 0 }, 'before-after': { name: 'Before and after', shots: 2 },
    gallery: { name: 'Photo gallery', shots: 3 }, 'why-us': { name: 'Why choose us', shots: 0 },
    'service-area': { name: 'Service area', shots: 0 }, proof: { name: 'Proof with sources', shots: 0 },
    faq: { name: 'Questions and answers', shots: 0 }, booking: { name: 'Book a visit', shots: 0 },
    contact: { name: 'Contact', shots: 0 }, 'cta-band': { name: 'Call-to-action band', shots: 0 },
    footer: { name: 'Footer', shots: 0 }, custom: { name: 'Custom (Meridian writes it)', shots: 0 },
  });

  // ---- Style numbers -------------------------------------------------------------------------------------------
  const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
  const FONT = /^[A-Za-z0-9 ]{1,40}$/;
  const DEFAULT_TOKENS = Object.freeze({ colors: Object.freeze({ bg: '#ffffff', surface: '#f3f5f8', text: '#14202e', muted: '#4f5d6e',
    accent: '#1f6fd6', 'on-accent': '#ffffff' }), fonts: Object.freeze({ heading: 'Inter', body: 'Inter' }) });
  const full = h => (h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h).toLowerCase();
  function luminance(hex) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(full(hex).slice(i, i + 2), 16) / 255)
      .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

  /** Style numbers from Project DNA ({ colors: [hex...], fonts: [heading, body] }). Text always readable (4.5:1). */
  function tokensFromDna(dna) {
    const colors = ((dna && dna.colors) || []).filter(c => typeof c === 'string' && HEX.test(c)).map(full);
    const fonts = ((dna && dna.fonts) || []).filter(f => typeof f === 'string' && FONT.test(f));
    const out = { colors: { ...DEFAULT_TOKENS.colors }, fonts: { heading: fonts[0] || 'Inter', body: fonts[1] || fonts[0] || 'Inter' } };
    const dark = colors.find(c => contrast(c, out.colors.bg) >= 4.5);
    if (dark) out.colors.text = dark;
    const accent = colors.find(c => c !== dark) || dark;
    if (accent) out.colors.accent = accent;
    out.colors['on-accent'] = contrast(out.colors.accent, '#ffffff') >= 4.5 ? '#ffffff' : '#0b1220';
    return out;
  }

  // ---- Building blocks -----------------------------------------------------------------------------------------
  const t = text => ({ text });
  const el = (tag, attrs, ...children) => ({ tag, ...(attrs ? { attrs } : {}), ...(children.length ? { children } : {}) });
  const items = body => String(body || '').split('\n').map(l => l.trim()).filter(Boolean)
    .map(l => { const i = l.indexOf(': '); return i > 0 ? { name: l.slice(0, i), detail: l.slice(i + 2) } : { name: l, detail: '' }; });
  const moving = c => (c.motion && c.motion !== 'none' && c.motion !== 'video-bg' ? { 'data-motion': c.motion } : {});
  const images = c => c.shots.filter(s => s.assetId);
  const img = (c, s, i) => el('img', { src: `asset:${s.assetId}`, alt: s.what || '', loading: i === 0 && /^hero/.test(c.layout) ? 'eager' : 'lazy', 'data-edit': `${c.id}-img${i + 1}` });
  const headline = (c, tag = 'h2') => el(tag, { 'data-edit': `${c.id}-headline`, ...moving(c) }, t(c.words.headline));
  const body = c => (c.words.body ? el('p', { class: 'lead', 'data-edit': `${c.id}-body`, ...moving(c) }, t(c.words.body)) : null);
  const button = (c, href) => (c.words.button && href ? el('a', { href, class: 'btn', 'data-edit': `${c.id}-button` }, t(c.words.button)) : null);
  const keep = list => list.filter(Boolean);
  const wrap = (...children) => el('div', { class: 'wrap' }, ...keep(children));
  const rule = (sel, decl, media) => ({ sel, decl, ...(media ? { media } : {}) });
  const BASE = [
    rule(':scope', { padding: '72px 24px' }), rule('.wrap', { 'max-width': '1120px', margin: '0 auto' }),
    rule('h1, h2', { margin: '0 0 16px', 'line-height': '1.15', color: 'var(--c-text)' }),
    rule('h1', { 'font-size': 'clamp(2.2rem, 5vw, 3.8rem)' }), rule('h2', { 'font-size': 'clamp(1.7rem, 3.5vw, 2.6rem)' }),
    rule('h3', { margin: '0 0 8px', 'font-size': '1.2rem' }), rule('p', { margin: '0 0 16px', 'line-height': '1.6' }),
    rule('.lead', { 'font-size': '1.15rem', color: 'var(--c-muted)', 'max-width': '60ch' }),
    rule('.btn', { display: 'inline-block', padding: '14px 24px', 'border-radius': '10px', background: 'var(--c-accent)',
      color: 'var(--c-on-accent)', 'text-decoration': 'none', 'font-weight': '600' }),
    rule('.btn:focus-visible', { outline: '3px solid var(--c-text)', 'outline-offset': '3px' }),
    rule('.grid', { display: 'grid', gap: '24px', 'grid-template-columns': 'repeat(auto-fit, minmax(240px, 1fr))', padding: '0', 'list-style': 'none' }),
    rule('.card', { background: 'var(--c-surface)', 'border-radius': '12px', padding: '24px' }),
    rule('img', { display: 'block', width: '100%', 'border-radius': '12px', 'object-fit': 'cover' }),
    rule('.card img', { 'margin-bottom': '16px', 'aspect-ratio': '3 / 2' }),
    rule(':scope', { padding: '48px 20px' }, '(max-width: 700px)'),
  ];
  const section = (c, tree, extra = []) => ({ id: c.id, label: c.name || LAYOUT_INFO[c.layout].name, tree, styles: [...BASE, ...extra] });
  const cards = (c, list, withImages) => el('ul', { class: 'grid' }, ...list.map((it, i) => el('li', { class: 'card', ...moving(c) },
    ...keep([withImages && images(c)[i] ? img(c, images(c)[i], i) : null, el('h3', null, t(it.name)), it.detail ? el('p', null, t(it.detail)) : null]))));

  // ---- One builder per layout ----------------------------------------------------------------------------------
  const BUILD = {
    'hero-photo': (c, x) => { const s = images(c)[0]; return section(c, el('header', { class: 'hero' }, wrap(headline(c, 'h1'), body(c), button(c, x.cta))),
      [rule(':scope', { 'min-height': '72vh', display: 'flex', 'align-items': 'center', color: '#ffffff', 'background-size': 'cover', 'background-position': 'center',
        'background-image': s ? `linear-gradient(90deg, rgba(5,10,20,.78), rgba(5,10,20,.25)), url(asset:${s.assetId})` : 'linear-gradient(135deg, var(--c-text), var(--c-accent))' }),
      rule('h1, .lead', { color: '#ffffff' }), rule('.hero', { width: '100%' })]); },
    'hero-video': (c, x) => { const v = images(c)[0]; const video = v && v.tool === 'video'
      ? el('video', { src: `asset:${v.assetId}`, autoplay: true, muted: true, loop: true, playsinline: true, 'aria-hidden': true, 'data-motion': 'video-bg' }) : null;
      return section(c, el('header', { class: 'hero' }, ...keep([video, wrap(headline(c, 'h1'), body(c), button(c, x.cta))])),
        [rule(':scope', { position: 'relative', overflow: 'hidden', 'min-height': '80vh', display: 'flex', 'align-items': 'center',
          background: 'linear-gradient(135deg, var(--c-text), var(--c-accent))', isolation: 'isolate' }),
        rule('.hero', { width: '100%' }), rule('.wrap', { position: 'relative' }), rule('h1, .lead', { color: '#ffffff' })]); },
    'hero-split': (c, x) => { const s = images(c)[0]; return section(c, el('header', { class: 'split' }, wrap(...keep([el('div', null, ...keep([headline(c, 'h1'), body(c), button(c, x.cta)])), s ? img(c, s, 0) : null]))),
      [rule('.wrap', { display: 'grid', gap: '40px', 'grid-template-columns': '1.1fr 1fr', 'align-items': 'center' }),
        rule('.wrap', { 'grid-template-columns': '1fr' }, '(max-width: 800px)')]); },
    services: c => section(c, el('section', null, wrap(headline(c), cards(c, items(c.words.body), true)))),
    'why-us': c => section(c, el('section', null, wrap(headline(c), cards(c, items(c.words.body), false))), [rule(':scope', { background: 'var(--c-surface)' }), rule('.card', { background: 'var(--c-bg)' })]),
    process: c => section(c, el('section', null, wrap(headline(c), el('ol', { class: 'grid steps' }, ...items(c.words.body).map(it =>
      el('li', { class: 'card', ...moving(c) }, ...keep([el('h3', null, t(it.name)), it.detail ? el('p', null, t(it.detail)) : null])))))),
      [rule('.steps', { 'counter-reset': 'step' }), rule('.steps li', { 'counter-increment': 'step' }),
        rule('.steps li::before', { content: 'counter(step)', display: 'block', 'font-size': '2rem', 'font-weight': '800', color: 'var(--c-accent)' })]),
    'before-after': c => { const [b, a] = images(c); return section(c, el('section', null, wrap(headline(c), body(c), el('div', { class: 'grid' },
      ...keep([b && el('figure', null, img(c, b, 0), el('figcaption', null, t('Before'))), a && el('figure', null, img(c, a, 1), el('figcaption', null, t('After')))])))),
      [rule('figure', { margin: '0' }), rule('figcaption', { 'margin-top': '8px', 'font-weight': '600' })]); },
    gallery: c => section(c, el('section', null, wrap(headline(c), body(c), el('div', { class: 'grid' }, ...images(c).map((s, i) => img(c, s, i)))))),
    'service-area': c => { const towns = items(c.words.body); return section(c, el('section', null, wrap(headline(c),
      towns.length > 1 ? el('ul', { class: 'towns' }, ...towns.map(it => el('li', null, t(it.name)))) : body(c))),
      [rule('.towns', { display: 'flex', 'flex-wrap': 'wrap', gap: '12px', padding: '0', 'list-style': 'none' }),
        rule('.towns li', { background: 'var(--c-surface)', padding: '8px 14px', 'border-radius': '99px' })]); },
    proof: c => section(c, el('section', null, wrap(headline(c), body(c), el('div', { class: 'grid' }, ...c.proof.map(p =>
      el('blockquote', { class: 'card', ...moving(c) }, el('p', null, t(p.claim)), el('small', null, t(`Source: ${p.source}`))))))),
      [rule('blockquote', { margin: '0' }), rule('small', { color: 'var(--c-muted)' })]),
    faq: c => section(c, el('section', null, wrap(headline(c), ...items(c.words.body).map(it =>
      el('div', { class: 'qa' }, el('h3', null, t(it.name)), ...keep([it.detail ? el('p', null, t(it.detail)) : null]))))),
      [rule('.qa', { 'border-top': '1px solid var(--c-surface)', 'padding-top': '16px', 'max-width': '72ch' })]),
    booking: (c, x) => section(c, el('section', null, wrap(headline(c), body(c), button(c, x.phone || x.cta))), [rule(':scope', { background: 'var(--c-surface)', 'text-align': 'center' }), rule('.lead', { margin: '0 auto 24px' })]),
    contact: (c, x) => section(c, el('section', null, wrap(headline(c), body(c), button(c, x.phone || x.cta)))),
    'cta-band': (c, x) => section(c, el('section', null, wrap(headline(c), body(c), button(c, x.cta))),
      [rule(':scope', { background: 'var(--c-accent)', 'text-align': 'center' }), rule('h2, .lead', { color: 'var(--c-on-accent)', margin: '0 auto 16px' }),
        rule('.btn', { background: 'var(--c-on-accent)', color: 'var(--c-accent)' })]),
    footer: (c, x) => section(c, el('footer', null, wrap(el('strong', null, t(x.name)), body(c),
      el('nav', { 'aria-label': 'Footer' }, ...x.pages.map(p => el('a', { href: p.path }, t(p.name)))))),
      [rule(':scope', { background: 'var(--c-text)', color: 'var(--c-bg)' }), rule('.lead', { color: 'var(--c-bg)' }),
        rule('nav', { display: 'flex', gap: '16px', 'flex-wrap': 'wrap' }), rule('a', { color: 'var(--c-bg)' })]),
  };
  BUILD.custom = c => section(c, el('section', null, wrap(headline(c), body(c)))); // stand-in until Meridian writes it

  function navSection(x, pageName) {
    return { id: 'site-nav', label: 'Navigation', tree: el('nav', { 'aria-label': 'Main' }, el('div', { class: 'wrap' },
      el('a', { href: '/', class: 'name', 'data-edit': 'site-name' }, t(x.name)),
      el('div', { class: 'links' }, ...x.pages.map(p => el('a', { href: p.path, ...(p.name === pageName ? { 'aria-label': `${p.name} (this page)` } : {}) }, t(p.name)))))),
      styles: [rule(':scope', { padding: '16px 24px', background: 'var(--c-bg)', 'border-bottom': '1px solid var(--c-surface)' }),
        rule('.wrap', { 'max-width': '1120px', margin: '0 auto', display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', gap: '16px', 'flex-wrap': 'wrap' }),
        rule('a', { color: 'var(--c-text)', 'text-decoration': 'none' }), rule('.name', { 'font-weight': '800', 'font-size': '1.15rem' }),
        rule('.links', { display: 'flex', gap: '20px', 'flex-wrap': 'wrap' })] };
  }

  /** Turns a finished story (chapter cards) into a site. options: { name, tokens, phone?, concept? }.
   *  Returns { ok, errors, site, custom: [chapter ids Meridian must still write], short: [{ chapter, needs }] }. */
  function assembleSite(story, { name, tokens = DEFAULT_TOKENS, phone, concept = false } = {}) {
    const pages = (story && story.pages) || [];
    const booking = pages.flatMap(p => p.chapters.filter(c => c.layout === 'booking' || c.layout === 'contact').map(c => ({ p, c })))[0];
    const tel = typeof phone === 'string' && /^\+?[0-9 ()-]{7,20}$/.test(phone) ? `tel:${phone.replace(/[ ()-]/g, '')}` : null;
    const x = { name, phone: tel, cta: booking ? `${booking.p.path === '/' ? '' : booking.p.path}#${booking.c.id}` : tel || '/',
      pages: pages.map(p => ({ name: p.name, path: p.path })) };
    const custom = [], short = [];
    const site = { version: 1, name, concept: !!concept, theme: { colors: { ...tokens.colors }, fonts: { ...tokens.fonts } },
      pages: pages.map(p => ({ id: p.id, path: p.path, title: (p.path === '/' ? name : `${p.name} | ${name}`).slice(0, 120), ...(p.purpose ? { description: p.purpose } : {}),
        sections: [navSection(x, p.name), ...p.chapters.map(c => {
          const layout = BUILD[c.layout] ? c.layout : 'custom';
          if (layout === 'custom') custom.push(c.id);
          const want = LAYOUT_INFO[layout].shots;
          if (images(c).length < want) short.push({ chapter: c.id, needs: `${want} kept image${want === 1 ? '' : 's'}` });
          return BUILD[layout]({ ...c, layout }, x);
        })] })) };
    const check = Engine.validateSite(site);
    return { ...check, site, custom, short };
  }

  return Object.freeze({ LAYOUT_INFO, DEFAULT_TOKENS, tokensFromDna, contrast, assembleSite });
});
