/* Section library + style numbers + assembler (#189). Core lane.
 * Build is assembly, not design (Website Build Pipeline doc): every chapter card's layout maps to one tested
 * section here, styled only by the client's style numbers (from Project DNA), and the finished storyboard becomes
 * a site in the site engine format. List layouts (services, process, why-us, faq, service-area) read the body one item
 * per line, "Name: detail", and show it only as the list.
 *
 * Look numbers (quality-bar.md: decide the look as numbers before code):
 *   hero       full-bleed real photo, min(92vh, 900px), shade from bottom-left, content low-left, 2 actions + trust line
 *   display    heading font 800, tracking -0.03em, line-height 1.02, max 13ch; eyebrow 0.78rem caps, tracking 0.16em
 *   body       1.0625rem / 1.65; lead 1.2rem, muted
 *   spacing    sections 120px desktop / 72px phone; content 1200px; 8px grid
 *   colour     no pure white or black: warm off-white page, client's dark colour as ink, one accent
 *   rhythm     light, light, dark band, light, photo band: the page has a beat */
'use strict';

(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./site-engine.js') : root && root.MeridianSiteEngine);
  if (node) module.exports = api;
  if (root) root.MeridianSectionLibrary = api;
})(typeof window === 'undefined' ? null : window, function (Engine) {
  // What each layout is and what its card needs. `shots` = how many images it shows (min).
  const LAYOUT_INFO = Object.freeze({
    'hero-photo': { name: 'Hero with full-bleed photo', shots: 1 }, 'hero-video': { name: 'Hero with video', shots: 1 },
    'hero-split': { name: 'Hero, words and photo side by side', shots: 1 }, services: { name: 'Services as photo tiles', shots: 0 },
    process: { name: 'Numbered steps', shots: 0 }, 'before-after': { name: 'Before and after', shots: 2 },
    gallery: { name: 'Photo gallery', shots: 3 }, 'why-us': { name: 'Why choose us (dark band)', shots: 0 },
    'service-area': { name: 'Service area', shots: 0 }, proof: { name: 'Proof with sources', shots: 0 },
    faq: { name: 'Questions and answers', shots: 0 }, booking: { name: 'Book a visit', shots: 0 },
    contact: { name: 'Contact', shots: 0 }, 'cta-band': { name: 'Call-to-action band', shots: 0 },
    footer: { name: 'Footer', shots: 0 }, custom: { name: 'Custom (Meridian writes it)', shots: 0 },
  });

  // ---- Style numbers -------------------------------------------------------------------------------------------
  const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
  const FONT = /^[A-Za-z0-9 ]{1,40}$/;
  const LIGHT = '#f8f7f3', DARK = '#0b1220';   // never pure white or pure black
  const DEFAULT_TOKENS = Object.freeze({ colors: Object.freeze({ bg: '#faf9f6', surface: '#efeee9', text: '#14202e', muted: '#4c5868',
    accent: '#1f6fd6', 'on-accent': LIGHT, light: LIGHT }), fonts: Object.freeze({ heading: 'Inter', body: 'Inter' }) });
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
    const dark = colors.find(c => contrast(c, out.colors.bg) >= 7);
    if (dark) out.colors.text = dark;
    const accent = colors.find(c => c !== dark) || dark;
    if (accent) out.colors.accent = accent;
    out.colors['on-accent'] = contrast(out.colors.accent, LIGHT) >= 4.5 ? LIGHT : DARK;
    return out;
  }

  // ---- Building blocks -----------------------------------------------------------------------------------------
  const t = text => ({ text });
  const el = (tag, attrs, ...children) => ({ tag, ...(attrs ? { attrs } : {}), ...(children.length ? { children } : {}) });
  const keep = list => list.filter(Boolean);
  const items = body => String(body || '').split('\n').map(l => l.trim()).filter(Boolean)
    .map(l => { const i = l.indexOf(': '); return i > 0 ? { name: l.slice(0, i), detail: l.slice(i + 2) } : { name: l, detail: '' }; });
  const pad2 = n => String(n).padStart(2, '0');
  const moving = c => (c.motion && c.motion !== 'none' && c.motion !== 'video-bg' ? { 'data-motion': c.motion } : {});
  const images = c => c.shots.filter(s => s.assetId);
  const img = (c, s, i, cls) => el('img', { src: `asset:${s.assetId}`, alt: s.what || '', loading: i === 0 && /^hero/.test(c.layout) ? 'eager' : 'lazy',
    'data-edit': `${c.id}-img${i + 1}`, ...(cls ? { class: cls } : {}) });
  const eyebrow = c => (c.words.eyebrow ? el('p', { class: 'eyebrow', 'data-edit': `${c.id}-eyebrow` }, t(c.words.eyebrow)) : null);
  const headline = (c, tag = 'h2') => el(tag, { 'data-edit': `${c.id}-headline`, ...moving(c) }, t(c.words.headline));
  const lead = c => (c.words.body ? el('p', { class: 'lead', 'data-edit': `${c.id}-body`, ...moving(c) }, t(c.words.body)) : null);
  const btn = (c, href, ghost) => (c.words.button && href ? el('a', { href, class: ghost ? 'btn ghost' : 'btn', 'data-edit': `${c.id}-button` }, t(c.words.button)) : null);
  const callBtn = (x, cls, key = 'call') => (x.phone ? el('a', { href: x.phone, class: cls, 'data-edit': key }, t(`Call ${x.phoneText}`)) : null);
  const wrap = (cls, ...children) => el('div', { class: cls ? `wrap ${cls}` : 'wrap' }, ...keep(children));
  const head = (c, withLead = true) => el('div', { class: 'head' }, ...keep([eyebrow(c), headline(c), withLead ? lead(c) : null]));
  const rule = (sel, decl, media) => ({ sel, decl, ...(media ? { media } : {}) });
  const PHONE = '(max-width: 760px)';
  const EASE = 'cubic-bezier(.2, .7, .2, 1)';
  const BASE = [
    rule(':scope', { padding: '120px 32px', background: 'var(--c-bg)', color: 'var(--c-text)' }),
    rule('.wrap', { 'max-width': '1200px', margin: '0 auto' }),
    rule('h1, h2, h3', { 'font-family': 'var(--f-heading), system-ui, sans-serif', color: 'inherit', margin: '0' }),
    rule('h1', { 'font-size': 'clamp(2.75rem, 6.4vw, 5.6rem)', 'font-weight': '800', 'letter-spacing': '-0.03em', 'line-height': '1.02', 'max-width': '13ch' }),
    rule('h2', { 'font-size': 'clamp(2rem, 4.2vw, 3.4rem)', 'font-weight': '800', 'letter-spacing': '-0.025em', 'line-height': '1.05', 'max-width': '18ch' }),
    rule('h1.as-h2', { 'font-size': 'clamp(2rem, 4.2vw, 3.4rem)', 'letter-spacing': '-0.025em', 'line-height': '1.05', 'max-width': '18ch' }),
    rule('h3', { 'font-size': '1.25rem', 'font-weight': '700', 'letter-spacing': '-0.01em', 'line-height': '1.25' }),
    rule('p', { margin: '0', 'font-size': '1.0625rem', 'line-height': '1.65' }),
    rule('.eyebrow', { 'font-size': '0.78rem', 'font-weight': '700', 'letter-spacing': '0.16em', 'text-transform': 'uppercase', color: 'var(--c-accent)', 'margin-bottom': '16px' }),
    rule('.lead', { 'font-size': '1.2rem', color: 'var(--c-muted)', 'max-width': '56ch', 'margin-top': '20px' }),
    rule('.head', { 'margin-bottom': '56px' }),
    rule('.btn', { display: 'inline-flex', 'align-items': 'center', gap: '8px', padding: '16px 28px', 'border-radius': '999px', background: 'var(--c-accent)',
      color: 'var(--c-on-accent)', 'text-decoration': 'none', 'font-weight': '700', 'font-size': '1rem', transition: `transform .35s ${EASE}, box-shadow .35s ${EASE}` }),
    rule('.btn:hover', { transform: 'translateY(-2px)', 'box-shadow': '0 12px 28px rgba(11, 18, 32, .22)' }),
    rule('.btn.ghost', { background: 'transparent', color: 'inherit', 'box-shadow': 'inset 0 0 0 1.5px currentColor' }),
    rule('.btn:focus-visible, a:focus-visible', { outline: '3px solid var(--c-accent)', 'outline-offset': '4px' }),
    rule('.actions', { display: 'flex', gap: '12px', 'flex-wrap': 'wrap', 'margin-top': '36px' }),
    rule('img', { display: 'block', width: '100%', height: '100%', 'object-fit': 'cover' }),
    rule(':scope', { padding: '72px 20px' }, PHONE),
    rule('.head', { 'margin-bottom': '36px' }, PHONE),
  ];
  const DARK_BAND = [rule(':scope', { background: 'var(--c-text)', color: 'var(--c-light)' }), rule('.lead', { color: 'var(--c-light)', opacity: '.78' })];
  const section = (c, tree, extra = []) => ({ id: c.id, label: c.name || LAYOUT_INFO[c.layout].name, tree, styles: [...BASE, ...extra] });
  const shade = 'linear-gradient(to top, rgba(8, 12, 20, .92) 0%, rgba(8, 12, 20, .55) 42%, rgba(8, 12, 20, .15) 75%), linear-gradient(to right, rgba(8, 12, 20, .55), transparent 70%)';
  const trust = c => (c.proof.length ? el('ul', { class: 'trust' }, ...c.proof.slice(0, 3).map(p => el('li', null, t(`✓ ${p.claim}`)))) : null);
  const HERO = [
    rule(':scope', { position: 'relative', padding: '0', 'min-height': 'min(92vh, 900px)', display: 'flex', 'align-items': 'flex-end', color: 'var(--c-light)', background: 'var(--c-text)', isolation: 'isolate', overflow: 'hidden' }),
    rule('.hero', { width: '100%' }),
    rule('.bg', { position: 'absolute', inset: '0', 'z-index': '-2' }),
    rule('.shade', { position: 'absolute', inset: '0', 'z-index': '-1', background: shade }),
    rule('.hero .wrap', { padding: '160px 32px 96px' }),
    rule('.lead', { color: 'var(--c-light)', opacity: '.86', 'max-width': '48ch' }),
    rule('.eyebrow', { color: 'var(--c-light)', opacity: '.9' }),
    rule('.trust', { display: 'flex', gap: '24px', 'flex-wrap': 'wrap', 'list-style': 'none', padding: '0', margin: '40px 0 0', 'font-size': '.95rem', opacity: '.9' }),
    rule('.hero .wrap', { padding: '120px 20px 56px' }, PHONE),
  ];
  const heroBody = (c, x) => wrap('', eyebrow(c), headline(c, 'h1'), lead(c), el('div', { class: 'actions' }, ...keep([btn(c, x.cta), callBtn(x, 'btn ghost', `${c.id}-call`)])), trust(c));

  // ---- One builder per layout ----------------------------------------------------------------------------------
  const BUILD = {
    'hero-photo': (c, x) => { const s = images(c)[0];
      return section(c, el('header', { class: 'hero' }, ...keep([s ? img(c, s, 0, 'bg') : null, el('div', { class: 'shade', 'aria-hidden': true }), heroBody(c, x)])), HERO); },
    'hero-video': (c, x) => { const v = images(c)[0];
      const media = v && v.tool === 'video' ? el('video', { src: `asset:${v.assetId}`, autoplay: true, muted: true, loop: true, playsinline: true, 'aria-hidden': true, class: 'bg', 'data-motion': 'video-bg' })
        : v ? img(c, v, 0, 'bg') : null;
      return section(c, el('header', { class: 'hero' }, ...keep([media, el('div', { class: 'shade', 'aria-hidden': true }), heroBody(c, x)])), HERO); },
    'hero-split': (c, x) => { const s = images(c)[0];
      return section(c, el('header', null, wrap('split', el('div', null, ...keep([eyebrow(c), headline(c, 'h1'), lead(c), el('div', { class: 'actions' }, ...keep([btn(c, x.cta), callBtn(x, 'btn ghost', `${c.id}-call`)]))])),
        s ? el('figure', { class: 'photo' }, img(c, s, 0)) : null)),
      [rule(':scope', { 'padding-top': '96px' }), rule('.split', { display: 'grid', gap: '64px', 'grid-template-columns': '1.05fr 1fr', 'align-items': 'center' }),
        rule('.photo', { margin: '0', 'aspect-ratio': '4 / 5', 'border-radius': '28px', overflow: 'hidden', 'box-shadow': '0 40px 80px -30px rgba(11, 18, 32, .45)' }),
        rule('.split', { 'grid-template-columns': '1fr', gap: '40px' }, PHONE)]); },
    services: c => { const pics = images(c);
      return section(c, el('section', null, wrap('', head(c, false), el('ul', { class: 'tiles' }, ...items(c.words.body).map((it, i) =>
        el('li', { class: pics[i] ? 'tile has-photo' : 'tile', ...moving(c) }, ...keep([pics[i] ? img(c, pics[i], i) : null,
          el('div', { class: 'tile-text' }, ...keep([el('span', { class: 'num' }, t(pad2(i + 1))), el('h3', null, t(it.name)), it.detail ? el('p', null, t(it.detail)) : null]))])))))),
      [rule('.tiles', { display: 'grid', gap: '20px', 'grid-template-columns': 'repeat(auto-fit, minmax(280px, 1fr))', padding: '0', margin: '0', 'list-style': 'none' }),
        rule('.tile', { position: 'relative', 'border-radius': '24px', overflow: 'hidden', background: 'var(--c-surface)', 'min-height': '260px', display: 'flex', 'align-items': 'flex-end' }),
        rule('.tile.has-photo', { 'min-height': '440px', color: 'var(--c-light)' }),
        rule('.tile img', { position: 'absolute', inset: '0', transition: `transform .9s ${EASE}` }),
        rule('.tile:hover img', { transform: 'scale(1.04)' }),
        rule('.tile.has-photo .tile-text', { background: 'linear-gradient(to top, rgba(8, 12, 20, .88), transparent)' }),
        rule('.tile-text', { position: 'relative', padding: '28px', width: '100%' }),
        rule('.tile-text p', { opacity: '.85', 'margin-top': '8px' }),
        rule('.num', { display: 'block', 'font-weight': '800', 'font-size': '.85rem', 'letter-spacing': '.12em', 'margin-bottom': '12px', opacity: '.7' })]); },
    'why-us': c => section(c, el('section', null, wrap('two', head(c, false), el('ul', { class: 'checks' }, ...items(c.words.body).map(it =>
      el('li', { ...moving(c) }, el('span', { class: 'tick', 'aria-hidden': true }, t('✓')), el('div', null, ...keep([el('h3', null, t(it.name)), it.detail ? el('p', null, t(it.detail)) : null]))))))),
      [...DARK_BAND, rule('.two', { display: 'grid', gap: '64px', 'grid-template-columns': '1fr 1.1fr', 'align-items': 'start' }),
        rule('.checks', { 'list-style': 'none', padding: '0', margin: '0', display: 'grid', gap: '28px' }),
        rule('.checks li', { display: 'grid', 'grid-template-columns': '44px 1fr', gap: '18px', 'padding-bottom': '28px', 'border-bottom': '1px solid rgba(248, 247, 243, .14)' }),
        rule('.tick', { display: 'grid', 'place-items': 'center', width: '44px', height: '44px', 'border-radius': '50%', background: 'var(--c-accent)', color: 'var(--c-on-accent)', 'font-weight': '800' }),
        rule('.checks p', { opacity: '.75', 'margin-top': '6px' }), rule('.two', { 'grid-template-columns': '1fr', gap: '24px' }, PHONE)]),
    process: c => section(c, el('section', null, wrap('', head(c, false), el('ol', { class: 'steps' }, ...items(c.words.body).map((it, i) =>
      el('li', { ...moving(c) }, ...keep([el('span', { class: 'num' }, t(pad2(i + 1))), el('h3', null, t(it.name)), it.detail ? el('p', null, t(it.detail)) : null])))))),
      [rule('.steps', { 'list-style': 'none', padding: '0', margin: '0', display: 'grid', gap: '32px', 'grid-template-columns': 'repeat(auto-fit, minmax(220px, 1fr))' }),
        rule('.steps li', { 'border-top': '2px solid var(--c-text)', 'padding-top': '24px' }),
        rule('.num', { display: 'block', 'font-family': 'var(--f-heading), system-ui, sans-serif', 'font-size': '3.5rem', 'font-weight': '800', 'letter-spacing': '-0.04em', color: 'var(--c-accent)', 'line-height': '1', 'margin-bottom': '20px' }),
        rule('.steps p', { color: 'var(--c-muted)', 'margin-top': '8px' })]),
    'before-after': c => { const [b, a] = images(c);
      return section(c, el('section', null, wrap('', head(c), el('div', { class: 'pair' }, ...keep([
        b && el('figure', null, img(c, b, 0), el('figcaption', null, t('Before'))), a && el('figure', null, img(c, a, 1), el('figcaption', null, t('After')))])))),
      [rule('.pair', { display: 'grid', gap: '20px', 'grid-template-columns': '1fr 1fr' }), rule('.pair', { 'grid-template-columns': '1fr' }, PHONE),
        rule('figure', { position: 'relative', margin: '0', 'aspect-ratio': '4 / 3', 'border-radius': '24px', overflow: 'hidden' }),
        rule('figcaption', { position: 'absolute', left: '20px', top: '20px', padding: '8px 16px', 'border-radius': '999px', background: 'rgba(8, 12, 20, .72)', color: 'var(--c-light)', 'font-weight': '700', 'font-size': '.85rem', 'letter-spacing': '.08em', 'text-transform': 'uppercase' })]); },
    gallery: c => section(c, el('section', null, wrap('', head(c), el('div', { class: 'mosaic' }, ...images(c).map((s, i) => el('figure', null, img(c, s, i)))))),
      [rule('.mosaic', { display: 'grid', gap: '16px', 'grid-template-columns': 'repeat(4, 1fr)', 'grid-auto-rows': '220px' }),
        rule('.mosaic figure', { margin: '0', 'border-radius': '20px', overflow: 'hidden' }), rule('.mosaic figure:first-child', { 'grid-column': 'span 2', 'grid-row': 'span 2' }),
        rule('.mosaic', { 'grid-template-columns': '1fr 1fr', 'grid-auto-rows': '160px' }, PHONE)]),
    'service-area': c => { const towns = items(c.words.body);
      return section(c, el('section', null, wrap('two', head(c, towns.length < 2), towns.length > 1 ? el('ul', { class: 'towns' }, ...towns.map(it => el('li', null, t(it.name)))) : null)),
        [rule(':scope', { background: 'var(--c-surface)' }), rule('.two', { display: 'grid', gap: '48px', 'grid-template-columns': '1fr 1fr', 'align-items': 'center' }),
          rule('.two', { 'grid-template-columns': '1fr' }, PHONE), rule('.head', { 'margin-bottom': '0' }),
          rule('.towns', { display: 'flex', 'flex-wrap': 'wrap', gap: '12px', padding: '0', margin: '0', 'list-style': 'none' }),
          rule('.towns li', { background: 'var(--c-bg)', padding: '12px 20px', 'border-radius': '999px', 'font-weight': '600' })]); },
    proof: c => section(c, el('section', null, wrap('', head(c), el('div', { class: 'quotes' }, ...c.proof.map(p =>
      el('blockquote', { ...moving(c) }, el('p', null, t(p.claim)), el('small', null, t(`Source: ${p.source}`))))))),
      [rule('.quotes', { display: 'grid', gap: '20px', 'grid-template-columns': 'repeat(auto-fit, minmax(300px, 1fr))' }),
        rule('blockquote', { margin: '0', padding: '36px', 'border-radius': '24px', background: 'var(--c-surface)' }),
        rule('blockquote p', { 'font-family': 'var(--f-heading), system-ui, sans-serif', 'font-size': '1.45rem', 'font-weight': '700', 'letter-spacing': '-0.01em', 'line-height': '1.3' }),
        rule('small', { display: 'block', 'margin-top': '16px', color: 'var(--c-muted)' })]),
    faq: c => section(c, el('section', null, wrap('two', head(c, false), el('div', { class: 'qas' }, ...items(c.words.body).map(it =>
      el('div', { class: 'qa' }, el('h3', null, t(it.name)), ...keep([it.detail ? el('p', null, t(it.detail)) : null])))))),
      [rule('.two', { display: 'grid', gap: '64px', 'grid-template-columns': '1fr 1.3fr' }), rule('.two', { 'grid-template-columns': '1fr', gap: '24px' }, PHONE),
        rule('.qa', { 'border-top': '1px solid var(--c-surface)', padding: '24px 0' }), rule('.qa p', { color: 'var(--c-muted)', 'margin-top': '8px' })]),
    booking: (c, x) => section(c, el('section', null, wrap('', el('div', { class: 'panel' }, el('div', null, ...keep([eyebrow(c), headline(c), lead(c)])),
      el('div', { class: 'go' }, ...keep([x.phone ? el('a', { href: x.phone, class: 'big-phone', 'data-edit': `${c.id}-phone` }, t(x.phoneText)) : null, btn(c, x.phone || x.cta)]))))),
      [rule('.panel', { display: 'grid', gap: '48px', 'grid-template-columns': '1.3fr 1fr', 'align-items': 'center', padding: '64px', 'border-radius': '32px', background: 'var(--c-text)', color: 'var(--c-light)' }),
        rule('.lead', { color: 'var(--c-light)', opacity: '.78' }), rule('.go', { display: 'grid', gap: '20px', 'justify-items': 'start' }),
        rule('.big-phone', { color: 'var(--c-light)', 'text-decoration': 'none', 'font-family': 'var(--f-heading), system-ui, sans-serif', 'font-size': 'clamp(1.8rem, 3.4vw, 2.8rem)', 'font-weight': '800', 'letter-spacing': '-0.02em' }),
        rule('.panel', { 'grid-template-columns': '1fr', padding: '36px 24px', gap: '28px' }, PHONE)]),
    contact: (c, x) => section(c, el('section', null, wrap('', head(c), el('div', { class: 'actions' }, ...keep([btn(c, x.phone || x.cta)]))))),
    'cta-band': (c, x) => { const s = images(c)[0];
      return section(c, el('section', null, ...keep([s ? img(c, s, 0, 'bg') : null, s ? el('div', { class: 'shade', 'aria-hidden': true }) : null,
        wrap('center', eyebrow(c), headline(c), lead(c), el('div', { class: 'actions' }, ...keep([btn(c, x.cta), callBtn(x, 'btn ghost', `${c.id}-call`)])))])),
      [rule(':scope', { position: 'relative', isolation: 'isolate', overflow: 'hidden', background: s ? 'var(--c-text)' : 'var(--c-accent)', color: s ? 'var(--c-light)' : 'var(--c-on-accent)', padding: '140px 32px' }),
        rule('.bg', { position: 'absolute', inset: '0', 'z-index': '-2' }), rule('.shade', { position: 'absolute', inset: '0', 'z-index': '-1', background: 'rgba(8, 12, 20, .62)' }),
        rule('.center', { 'text-align': 'center', display: 'grid', 'justify-items': 'center' }), rule('h2', { 'max-width': '20ch' }),
        rule('.lead, .eyebrow', { color: 'inherit', opacity: '.85' }), rule('.actions', { 'justify-content': 'center' }),
        ...(s ? [] : [rule('.btn:not(.ghost)', { background: 'var(--c-on-accent)', color: 'var(--c-accent)' })])]); },
    footer: (c, x) => section(c, el('footer', null, wrap('cols', el('div', null, ...keep([el('strong', { class: 'brand' }, t(x.name)), lead(c)])),
      el('nav', { 'aria-label': 'Footer' }, ...x.pages.map(p => el('a', { href: p.path }, t(p.name)))),
      el('div', { class: 'reach' }, ...keep([callBtn(x, 'link', `${c.id}-call`)]))), wrap('legal', el('small', null, t(`© ${x.year} ${x.name}`)))),
      [...DARK_BAND, rule(':scope', { 'padding-bottom': '40px' }), rule('.cols', { display: 'grid', gap: '48px', 'grid-template-columns': '2fr 1fr 1fr' }),
        rule('.cols', { 'grid-template-columns': '1fr', gap: '32px' }, PHONE),
        rule('.brand', { 'font-family': 'var(--f-heading), system-ui, sans-serif', 'font-size': '1.6rem', 'font-weight': '800', 'letter-spacing': '-0.02em' }),
        rule('nav', { display: 'grid', gap: '12px' }), rule('a', { color: 'var(--c-light)', 'text-decoration': 'none', opacity: '.85' }),
        rule('.legal', { 'margin-top': '72px', 'padding-top': '24px', 'border-top': '1px solid rgba(248, 247, 243, .14)', opacity: '.6' })]),
  };
  BUILD.custom = c => section(c, el('section', null, wrap('', head(c)))); // stand-in until Meridian writes it

  function navSection(x) {
    return { id: 'site-nav', label: 'Navigation', tree: el('nav', { 'aria-label': 'Main' }, el('div', { class: 'wrap' },
      el('a', { href: '/', class: 'name', 'data-edit': 'site-name' }, t(x.name)),
      el('div', { class: 'links' }, ...keep([...x.pages.filter(p => p.path !== '/').map(p => el('a', { href: p.path }, t(p.name))), callBtn(x, 'btn', 'nav-call')])))),
      styles: [rule(':scope', { position: 'sticky', top: '0', 'z-index': '20', padding: '14px 32px', background: 'rgba(250, 249, 246, .86)', 'backdrop-filter': 'blur(14px)', 'border-bottom': '1px solid rgba(11, 18, 32, .08)' }),
        rule('.wrap', { 'max-width': '1200px', margin: '0 auto', display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', gap: '16px', 'flex-wrap': 'wrap' }),
        rule('a', { color: 'var(--c-text)', 'text-decoration': 'none', 'font-weight': '600' }),
        rule('.name', { 'font-family': 'var(--f-heading), system-ui, sans-serif', 'font-weight': '800', 'font-size': '1.2rem', 'letter-spacing': '-0.02em' }),
        rule('.links', { display: 'flex', gap: '28px', 'align-items': 'center', 'flex-wrap': 'wrap' }),
        rule('.btn', { padding: '10px 18px', 'border-radius': '999px', background: 'var(--c-accent)', color: 'var(--c-on-accent)' }),
        rule('.links a:not(.btn)', { display: 'none' }, PHONE), rule(':scope', { padding: '10px 16px' }, PHONE),
        rule('.wrap', { 'flex-wrap': 'nowrap' }, PHONE), rule('.name', { 'font-size': '1rem' }, PHONE),
        rule('.btn', { padding: '8px 14px', 'font-size': '.875rem', 'white-space': 'nowrap' }, PHONE)] };
  }

  // Every page gets one main heading, for Google and screen readers (#206): on a page without a hero the first
  // headline becomes it, keeping its look.
  function oneMainHeading(page) {
    const all = [];
    const walk = n => { if (n && !('text' in n)) { all.push(n); (n.children || []).forEach(walk); } };
    page.sections.forEach(s => walk(s.tree));
    const first = all.some(n => n.tag === 'h1') ? null : all.find(n => n.tag === 'h2');
    if (first) { first.tag = 'h1'; first.attrs = { ...first.attrs, class: [first.attrs && first.attrs.class, 'as-h2'].filter(Boolean).join(' ') }; }
  }

  /** Turns a finished story (chapter cards) into a site. options: { name, tokens, phone?, concept?, year? }.
   *  Returns { ok, errors, site, custom: [chapter ids Meridian must still write], short: [{ chapter, needs }] }. */
  function assembleSite(story, { name, tokens = DEFAULT_TOKENS, phone, concept = false, year = new Date().getFullYear() } = {}) {
    const pages = (story && story.pages) || [];
    const booking = pages.flatMap(p => p.chapters.filter(c => c.layout === 'booking' || c.layout === 'contact').map(c => ({ p, c })))[0];
    const okPhone = typeof phone === 'string' && /^\+?[0-9 ()-]{7,20}$/.test(phone);
    const x = { name, year, phone: okPhone ? `tel:${phone.replace(/[ ()-]/g, '')}` : null, phoneText: okPhone ? phone.trim() : '',
      pages: pages.map(p => ({ name: p.name, path: p.path })) };
    x.cta = booking ? `${booking.p.path === '/' ? '' : booking.p.path}#${booking.c.id}` : x.phone || '/';
    const custom = [], short = [];
    const site = { version: 1, name, concept: !!concept, theme: { colors: { ...DEFAULT_TOKENS.colors, ...tokens.colors }, fonts: { ...tokens.fonts } },
      pages: pages.map(p => ({ id: p.id, path: p.path, title: (p.path === '/' ? name : `${p.name} | ${name}`).slice(0, 120), ...(p.purpose ? { description: p.purpose } : {}),
        sections: [navSection(x), ...p.chapters.map(c => {
          const layout = BUILD[c.layout] ? c.layout : 'custom';
          if (layout === 'custom') custom.push(c.id);
          const want = LAYOUT_INFO[layout].shots;
          if (images(c).length < want) short.push({ chapter: c.id, needs: `${want} kept image${want === 1 ? '' : 's'}` });
          return BUILD[layout]({ ...c, layout }, x);
        })] })) };
    site.pages.forEach(oneMainHeading);
    const check = Engine.validateSite(site);
    return { ...check, site, custom, short };
  }

  return Object.freeze({ LAYOUT_INFO, DEFAULT_TOKENS, tokensFromDna, contrast, assembleSite });
});
