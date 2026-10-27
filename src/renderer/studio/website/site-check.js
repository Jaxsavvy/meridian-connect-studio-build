/* Website Check stage (#206): what Meridian checks on a finished site by itself. Core lane, pure.
 * Google basics, accessibility, links inside the site and a speed estimate. Connect's main process adds the phone width
 * and live outside-link checks (board-check.js), the same way it checks a pitch deck board. */
'use strict';

(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./section-library.js') : root && root.MeridianSectionLibrary);
  if (node) module.exports = api;
  if (root) root.MeridianSiteCheck = api;
})(typeof window === 'undefined' ? null : window, function (Library) {
  const LIMITS = Object.freeze({ title: 60, description: 160, pageKb: 150, images: 15 });
  const HEX6 = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
  const pageLabel = p => (p.path === '/' ? 'Home' : String(p.title || p.path).split(' | ')[0]);
  const words = n => ('text' in n ? n.text : (n.children || []).map(words).join('')).trim();

  // Every element on a page in reading order, with the section it's in.
  function elements(page) {
    const out = [];
    const walk = (n, section) => { if (n && !('text' in n)) { out.push({ n, section }); (n.children || []).forEach(c => walk(c, section)); } };
    for (const s of page.sections) walk(s.tree, s);
    return out;
  }

  /** Flags for a site in the engine format: [{ check, message, where }]. options.sizes: { pageId: rendered bytes }. */
  function checkSite(site, { sizes = {} } = {}) {
    const flags = [], titles = new Map();
    const flag = (check, message, where) => flags.push({ check, message, where });
    const anchors = new Map(site.pages.map(p => [p.path, new Set(p.sections.map(s => s.id))]));

    for (const page of site.pages) {
      const at = pageLabel(page), here = s => `${at} · ${s.label}`, all = elements(page);
      // Google basics
      if (page.title.length > LIMITS.title) flag('seo', `The page title is ${page.title.length} characters; Google shows about ${LIMITS.title}.`, at);
      if (titles.has(page.title)) flag('seo', `Same title as ${titles.get(page.title)}; each page needs its own.`, at);
      else titles.set(page.title, at);
      if (!page.description) flag('seo', 'Add a description: it\'s the line Google shows under the title.', at);
      else if (page.description.length > LIMITS.description) flag('seo', `The description is ${page.description.length} characters; Google shows about ${LIMITS.description}.`, at);
      const mains = all.filter(x => x.n.tag === 'h1').length;
      if (mains !== 1) flag('seo', mains ? `This page has ${mains} main headings; keep one.` : 'This page has no main heading.', at);

      // Easy for everyone to use
      let level = 0;
      for (const { n, section } of all) {
        const a = n.attrs || {};
        if (n.tag === 'img' && !a.alt && !a['aria-hidden']) flag('accessibility', 'Describe this image for people using screen readers.', here(section));
        if (n.tag === 'a' && !words(n) && !a['aria-label']) flag('accessibility', 'This link has no words, so a screen reader can\'t say where it goes.', here(section));
        const h = /^h([1-4])$/.exec(n.tag);
        if (h) {
          if (level && Number(h[1]) > level + 1) flag('accessibility', `The headings jump from level ${level} to ${h[1]}.`, here(section));
          level = Number(h[1]);
        }
        // Links inside the site go to a real page, and to a real section on it.
        const href = n.tag === 'a' && typeof a.href === 'string' ? a.href : '';
        if (href.startsWith('/') || href.startsWith('#')) {
          const [path, hash] = href.startsWith('#') ? [page.path, href.slice(1)] : href.split('#');
          if (!anchors.has(path)) flag('links', `This link goes to a page that doesn't exist: ${href}`, here(section));
          else if (hash && !anchors.get(path).has(hash)) flag('links', `This link goes to a section that isn't on that page: ${href}`, here(section));
        }
      }

      // Speed (an estimate from the page itself)
      const kb = Math.round((sizes[page.id] || 0) / 1024);
      if (kb > LIMITS.pageKb) flag('speed', `This page is about ${kb} KB before images; aim for under ${LIMITS.pageKb} KB.`, at);
      const images = all.filter(x => x.n.tag === 'img');
      if (images.length > LIMITS.images) flag('speed', `This page has ${images.length} images; more than ${LIMITS.images} makes it slow on a phone.`, at);
      const first = images.filter(x => (x.n.attrs || {}).loading !== 'lazy').length;
      if (first > 1) flag('speed', `${first} images load right away; only the first big photo should.`, at);
    }

    // Readable colours (the style numbers keep 4.5:1, this catches anything edited by hand).
    const c = site.theme.colors || {};
    for (const [fg, bg, what] of [['text', 'bg', 'Text on the page'], ['on-accent', 'accent', 'Text on buttons'], ['light', 'text', 'Text on dark bands']]) {
      if (HEX6.test(c[fg] || '') && HEX6.test(c[bg] || '') && Library.contrast(c[fg], c[bg]) < 4.5) {
        flag('accessibility', `${what} is hard to read (contrast ${Library.contrast(c[fg], c[bg]).toFixed(1)}:1; it needs 4.5:1).`, 'Style numbers');
      }
    }
    return flags;
  }

  /** Every outside https link on the site once, with where it first appears, for Connect's live link check. */
  function siteLinks(site) {
    const seen = new Set(), out = [];
    for (const page of site.pages) for (const { n, section } of elements(page)) {
      const href = n.tag === 'a' && n.attrs && n.attrs.href;
      if (typeof href === 'string' && href.startsWith('https://') && !seen.has(href)) { seen.add(href); out.push({ url: href, where: `${pageLabel(page)} · ${section.label}` }); }
    }
    return out;
  }

  return Object.freeze({ LIMITS, checkSite, siteLinks, pageLabel });
});
