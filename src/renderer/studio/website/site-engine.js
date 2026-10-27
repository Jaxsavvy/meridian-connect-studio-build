/* Site engine: one format for every site Meridian builds (#157). Core lane.
 * Used by the Pitch deck home page builder (one-page concept sites, 3 tiers) and the full Website builder.
 * A site is pages of custom sections. Each section is a JSON element tree plus CSS rules, written by Meridian.
 * There is no raw HTML and no AI-written JavaScript: only listed tags, attributes and links pass the checker,
 * section CSS is scoped to its own section, and motion comes from a few named effects run by our own script. */
'use strict';

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianSiteEngine = api;
})(typeof window === 'undefined' ? null : window, function () {
  const TAGS = new Set(['section', 'div', 'header', 'footer', 'nav', 'article', 'aside', 'h1', 'h2', 'h3', 'h4', 'p', 'span',
    'strong', 'em', 'small', 'br', 'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption', 'blockquote', 'video']);
  const VOID = new Set(['br', 'img']);
  const COMMON = new Set(['class', 'data-edit', 'data-motion', 'aria-label', 'aria-hidden']);
  const PER_TAG = { a: ['href'], img: ['src', 'alt', 'width', 'height', 'loading'], video: ['src', 'poster', 'autoplay', 'muted', 'loop', 'playsinline'] };
  const MOTION = Object.freeze(['fade-up', 'parallax', 'reveal', 'video-bg']);
  const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
  const ASSET = /^asset:[A-Za-z0-9_-]{1,128}$/;
  const HEX = /^#[0-9a-f]{3,8}$/i;
  const FONT = /^[A-Za-z0-9 ]{1,40}$/;
  const LIMITS = { pages: 30, sections: 40, nodes: 2000, depth: 20, rules: 200, text: 5000 };

  const fail = (errors, path, message) => { errors.push({ path, message }); };
  const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const onlyKeys = (obj, keys, path, errors) => {
    for (const k of Object.keys(obj)) if (!keys.includes(k)) fail(errors, `${path}.${k}`, 'Not allowed in a site.');
  };
  const text = (v, max, path, errors, optional = false) => {
    if (v === undefined || v === '') { if (!optional) fail(errors, path, 'Required.'); return; }
    if (typeof v !== 'string') return fail(errors, path, 'Must be text.');
    if (v.length > max) fail(errors, path, `Too long (max ${max} characters).`);
  };

  function checkUrl(attr, value) {
    if (attr === 'src' || attr === 'poster') return ASSET.test(value);
    if (ASSET.test(value)) return true;
    if (/^#[A-Za-z0-9_-]{0,60}$/.test(value)) return true;
    if (/^\/[A-Za-z0-9/_-]{0,120}(#[A-Za-z0-9_-]{1,60})?$/.test(value)) return true;
    if (/^(mailto:[^\s<>"]{3,200}|tel:\+?[0-9 ()-]{3,30})$/.test(value)) return true;
    return /^https:\/\/[A-Za-z0-9.-]+(\/[^\s<>"]*)?$/.test(value);
  }

  function checkNode(node, path, errors, state, depth) {
    if (++state.nodes > LIMITS.nodes) return fail(errors, path, 'Section is too big.');
    if (depth > LIMITS.depth) return fail(errors, path, 'Nested too deep.');
    if (!plain(node)) return fail(errors, path, 'Must be an element or text.');
    if ('text' in node) { onlyKeys(node, ['text'], path, errors); return text(node.text, LIMITS.text, `${path}.text`, errors); }
    onlyKeys(node, ['tag', 'attrs', 'children'], path, errors);
    if (!TAGS.has(node.tag)) return fail(errors, `${path}.tag`, `Tag "${node.tag}" is not allowed.`);
    const attrs = node.attrs || {};
    if (!plain(attrs)) return fail(errors, `${path}.attrs`, 'Must be an object.');
    const allowed = PER_TAG[node.tag] || [];
    for (const [name, value] of Object.entries(attrs)) {
      const at = `${path}.attrs.${name}`;
      if (!COMMON.has(name) && !allowed.includes(name)) { fail(errors, at, `Attribute "${name}" is not allowed on ${node.tag}.`); continue; }
      if (typeof value === 'boolean' && ['autoplay', 'muted', 'loop', 'playsinline', 'aria-hidden'].includes(name)) continue;
      if (typeof value !== 'string' || value.length > 500) { fail(errors, at, 'Must be short text.'); continue; }
      if (['href', 'src', 'poster'].includes(name) && !checkUrl(name, value)) fail(errors, at, 'Link is not allowed (use https:, a page path, or an asset).');
      if (name === 'class' && !/^[A-Za-z0-9_ -]{0,200}$/.test(value)) fail(errors, at, 'Class names: letters, numbers, - and _ only.');
      if (name === 'data-motion' && !MOTION.includes(value)) fail(errors, at, `Motion must be one of: ${MOTION.join(', ')}.`);
      if (name === 'data-edit') {
        if (!ID.test(value)) fail(errors, at, 'Edit key: lowercase letters, numbers and dashes.');
        else if (state.keys.has(value)) fail(errors, at, `Edit key "${value}" is used twice on this page.`);
        else state.keys.add(value);
      }
    }
    if (node.tag === 'img' && typeof attrs.alt !== 'string') fail(errors, `${path}.attrs.alt`, 'Images need alt text.');
    if (node.children === undefined) return;
    if (VOID.has(node.tag)) return fail(errors, `${path}.children`, `${node.tag} can't have children.`);
    if (!Array.isArray(node.children)) return fail(errors, `${path}.children`, 'Must be a list.');
    node.children.forEach((c, i) => checkNode(c, `${path}.children[${i}]`, errors, state, depth + 1));
  }

  // image-set() and friends take plain-string URLs, so they'd load outside images; images come from assets only.
  const BAD_CSS = /[{};<>\\\u0000-\u001f]|expression\s*\(|javascript:|@import|behavior\s*:|-moz-binding|image-set|\b(image|src)\s*\(/i;
  // Every bracket and quote must close inside its own selector, value or media query, so nothing runs on into
  // the next rule or out of the section's scope. Brackets inside quotes don't count (backslashes are refused).
  function balanced(str) {
    const open = [];
    let quote = '';
    for (const ch of str) {
      if (quote) { if (ch === quote) quote = ''; } else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '(' || ch === '[') open.push(ch === '(' ? ')' : ']');
      else if ((ch === ')' || ch === ']') && open.pop() !== ch) return false;
    }
    return !quote && !open.length;
  }
  function checkValue(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 300 || BAD_CSS.test(value) || !balanced(value)) return false;
    const urls = value.match(/url\s*\(([^)]*)\)/gi) || [];
    return urls.every(u => ASSET.test(u.replace(/^url\s*\(\s*["']?|["']?\s*\)$/gi, '')));
  }

  function checkStyles(styles, path, errors) {
    if (styles === undefined) return;
    if (!Array.isArray(styles)) return fail(errors, path, 'Must be a list of rules.');
    if (styles.length > LIMITS.rules) fail(errors, path, 'Too many rules.');
    styles.forEach((rule, i) => {
      const at = `${path}[${i}]`;
      if (!plain(rule)) return fail(errors, at, 'Must be a rule.');
      onlyKeys(rule, ['sel', 'decl', 'media'], at, errors);
      if (typeof rule.sel !== 'string' || !rule.sel.trim() || rule.sel.length > 200 || /[{};<>@\\\u0000-\u001f]/.test(rule.sel) || !balanced(rule.sel)) fail(errors, `${at}.sel`, 'Bad selector.');
      if (rule.media !== undefined && (typeof rule.media !== 'string' || !/^[a-z0-9 ():,.-]{1,120}$/i.test(rule.media) || !balanced(rule.media))) fail(errors, `${at}.media`, 'Bad media query.');
      if (!plain(rule.decl) || !Object.keys(rule.decl).length) return fail(errors, `${at}.decl`, 'Needs at least one property.');
      for (const [prop, value] of Object.entries(rule.decl)) {
        if (!/^(--[a-z0-9-]{1,40}|-?[a-z][a-z-]{0,40})$/.test(prop)) fail(errors, `${at}.decl.${prop}`, 'Bad property name.');
        else if (!checkValue(value)) fail(errors, `${at}.decl.${prop}`, 'Value not allowed (no url() except assets).');
      }
    });
  }

  function validateSite(site) {
    const errors = [];
    if (!plain(site)) return { ok: false, errors: [{ path: 'site', message: 'Must be a site.' }] };
    onlyKeys(site, ['version', 'name', 'concept', 'theme', 'pages', 'origin'], 'site', errors);
    if (site.version !== 1) fail(errors, 'site.version', 'Must be 1.');
    text(site.name, 120, 'site.name', errors);
    if (site.concept !== undefined && typeof site.concept !== 'boolean') fail(errors, 'site.concept', 'Must be true or false.');
    const theme = site.theme;
    if (!plain(theme)) fail(errors, 'site.theme', 'Required.');
    else {
      onlyKeys(theme, ['colors', 'fonts'], 'site.theme', errors);
      for (const [k, v] of Object.entries(theme.colors || {})) if (!ID.test(k) || !HEX.test(v)) fail(errors, `site.theme.colors.${k}`, 'Colors are #hex values.');
      for (const k of ['heading', 'body']) if (!FONT.test((theme.fonts || {})[k] || '')) fail(errors, `site.theme.fonts.${k}`, 'Font name required (letters, numbers, spaces).');
      if (theme.fonts) onlyKeys(theme.fonts, ['heading', 'body'], 'site.theme.fonts', errors);
    }
    if (site.origin !== undefined) {
      const o = site.origin;
      if (!plain(o) || o.from !== 'pitch-deck' || ![1, 2, 3].includes(o.tier)) fail(errors, 'site.origin', 'Origin is { from: "pitch-deck", tier: 1-3, jobId }.');
      else { onlyKeys(o, ['from', 'tier', 'jobId'], 'site.origin', errors); text(o.jobId, 128, 'site.origin.jobId', errors, true); }
    }
    if (!Array.isArray(site.pages) || !site.pages.length) fail(errors, 'site.pages', 'Needs at least one page.');
    else {
      if (site.pages.length > LIMITS.pages) fail(errors, 'site.pages', 'Too many pages.');
      const ids = new Set(); const paths = new Set();
      site.pages.forEach((page, p) => {
        const at = `site.pages[${p}]`;
        if (!plain(page)) return fail(errors, at, 'Must be a page.');
        onlyKeys(page, ['id', 'path', 'title', 'description', 'sections'], at, errors);
        if (!ID.test(page.id || '') || ids.has(page.id)) fail(errors, `${at}.id`, 'Page IDs: unique, lowercase, dashes.');
        ids.add(page.id);
        if (typeof page.path !== 'string' || !/^\/([a-z0-9-]+\/)*([a-z0-9-]+)?$/.test(page.path) || paths.has(page.path)) fail(errors, `${at}.path`, 'Paths look like / or /services (unique).');
        paths.add(page.path);
        text(page.title, 120, `${at}.title`, errors);
        text(page.description, 300, `${at}.description`, errors, true);
        if (!Array.isArray(page.sections) || !page.sections.length) return fail(errors, `${at}.sections`, 'Needs at least one section.');
        if (page.sections.length > LIMITS.sections) fail(errors, `${at}.sections`, 'Too many sections.');
        const sids = new Set(); const state = { nodes: 0, keys: new Set() };
        page.sections.forEach((s, i) => {
          const sat = `${at}.sections[${i}]`;
          if (!plain(s)) return fail(errors, sat, 'Must be a section.');
          onlyKeys(s, ['id', 'label', 'tree', 'styles'], sat, errors);
          if (!ID.test(s.id || '') || sids.has(s.id)) fail(errors, `${sat}.id`, 'Section IDs: unique on the page, lowercase, dashes.');
          sids.add(s.id);
          text(s.label, 80, `${sat}.label`, errors);
          state.nodes = 0;
          checkNode(s.tree, `${sat}.tree`, errors, state, 0);
          checkStyles(s.styles, `${sat}.styles`, errors);
        });
      });
      if (!paths.has('/')) fail(errors, 'site.pages', 'One page must be the home page (path "/").');
    }
    return { ok: errors.length === 0, errors };
  }

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const assetUrl = (value, assets) => (ASSET.test(value) ? assets[value.slice(6)] || '' : value);

  function renderNode(node, assets) {
    if ('text' in node) return esc(node.text);
    let out = `<${node.tag}`;
    for (const [name, value] of Object.entries(node.attrs || {})) {
      if (value === false) continue;
      if (value === true) { out += ` ${name}`; continue; }
      const v = ['href', 'src', 'poster'].includes(name) ? assetUrl(value, assets) : value;
      if (v === '') continue;
      out += ` ${name}="${esc(v)}"`;
    }
    if (VOID.has(node.tag)) return `${out}>`;
    return `${out}>${(node.children || []).map(c => renderNode(c, assets)).join('')}</${node.tag}>`;
  }

  function splitSelectors(sel) {
    const parts = []; let depth = 0; let cur = '';
    for (const ch of sel) {
      if (ch === '(') depth++; else if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
    }
    return parts.concat(cur).map(s => s.trim()).filter(Boolean);
  }

  function renderStyles(section, assets) {
    const scope = `[data-s="${section.id}"]`;
    return (section.styles || []).map(rule => {
      const sel = splitSelectors(rule.sel).map(s => (s === ':scope' ? scope : s.startsWith(':scope') ? scope + s.slice(6) : `${scope} ${s}`)).join(', ');
      const decl = Object.entries(rule.decl).map(([p, v]) => `${p}:${v.replace(/url\s*\(\s*["']?(asset:[A-Za-z0-9_-]+)["']?\s*\)/gi, (_, a) => `url("${esc(assetUrl(a, assets))}")`)}`).join(';');
      return rule.media ? `@media ${rule.media}{${sel}{${decl}}}` : `${sel}{${decl}}`;
    }).join('\n');
  }

  const MOTION_CSS = '[data-motion="fade-up"]{opacity:0;transform:translateY(24px);transition:opacity .9s cubic-bezier(.2,.7,.2,1),transform .9s cubic-bezier(.2,.7,.2,1)}'
    + '[data-motion="reveal"]{clip-path:inset(0 0 100% 0);transition:clip-path 1.1s cubic-bezier(.2,.7,.2,1)}'
    + '[data-motion].in{opacity:1;transform:none;clip-path:inset(0)}'
    + '[data-motion="video-bg"]{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-1}'
    + '@media (prefers-reduced-motion:reduce){[data-motion]{opacity:1!important;transform:none!important;clip-path:none!important;transition:none!important}}';
  const MOTION_JS = '(function(){var r=matchMedia("(prefers-reduced-motion: reduce)").matches;var els=document.querySelectorAll("[data-motion]");'
    + 'if(r||!("IntersectionObserver" in window)){els.forEach(function(e){e.classList.add("in")});return}'
    + 'var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}})},{threshold:.15});'
    + 'els.forEach(function(e){if(e.dataset.motion!=="parallax"&&e.dataset.motion!=="video-bg")io.observe(e)});'
    + 'var p=document.querySelectorAll("[data-motion=parallax]");if(p.length)addEventListener("scroll",function(){p.forEach(function(e){'
    + 'var b=e.getBoundingClientRect();e.style.transform="translateY("+(b.top*-0.15).toFixed(1)+"px)"})},{passive:true})})();';

  const hasMotion = node => !('text' in node) && ((node.attrs && node.attrs['data-motion']) || (node.children || []).some(hasMotion));

  function renderPage(site, pageId, { assets = {} } = {}) {
    const check = validateSite(site);
    if (!check.ok) throw new Error(`Site has problems: ${check.errors.slice(0, 3).map(e => `${e.path} ${e.message}`).join('; ')}`);
    const page = site.pages.find(p => p.id === pageId);
    if (!page) throw new Error(`No page "${pageId}".`);
    const { colors = {}, fonts } = site.theme;
    const vars = Object.entries(colors).map(([k, v]) => `--c-${k}:${v}`).concat(`--f-heading:"${fonts.heading}"`, `--f-body:"${fonts.body}"`).join(';');
    const families = [...new Set([fonts.heading, fonts.body])].map(f => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;600;800`).join('&');
    const motion = page.sections.some(s => hasMotion(s.tree));
    // Each section's id doubles as its anchor, so a button can link to "#booking" (ids are checked: lowercase, digits, dashes).
    const body = page.sections.map(s => `<div id="${s.id}" data-s="${s.id}" data-section="${esc(s.label)}">${renderNode(s.tree, assets)}</div>`).join('\n');
    const concept = site.concept ? `<p class="concept-note">Concept for discussion, not affiliated with ${esc(site.name)}.</p>` : '';
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src https: data: blob:; media-src https: data: blob:; style-src \'unsafe-inline\' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src \'unsafe-inline\'">'
      + `<title>${esc(page.title)}</title>${page.description ? `<meta name="description" content="${esc(page.description)}">` : ''}`
      + `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${families}&display=swap">`
      + `<style>:root{${vars}}*{box-sizing:border-box}body{margin:0;font-family:var(--f-body),system-ui,sans-serif;background:var(--c-bg,#faf9f6);color:var(--c-text,#14202e)}`
      + 'h1,h2,h3,h4{font-family:var(--f-heading),system-ui,sans-serif}img,video{max-width:100%;height:auto}'
      + '.concept-note{margin:0;padding:12px 16px;font-size:12px;text-align:center;opacity:.7}'
      + `${motion ? MOTION_CSS : ''}\n${page.sections.map(s => renderStyles(s, assets)).join('\n')}</style></head>`
      + `<body>${body}${concept}${motion ? `<script>${MOTION_JS}</script>` : ''}</body></html>`;
  }

  function renderSite(site, options) {
    const files = {};
    for (const page of site.pages) files[page.path === '/' ? 'index.html' : `${page.path.replace(/^\/|\/$/g, '')}/index.html`] = renderPage(site, page.id, options);
    return files;
  }

  const clone = v => JSON.parse(JSON.stringify(v));

  /** Starts a client's full site from the pitch deck tier home page they picked. The concept line drops: they're the client now. */
  function fromHomePage(homeSite, { tier, jobId } = {}) {
    const site = clone(homeSite);
    site.concept = false;
    site.origin = { from: 'pitch-deck', tier, ...(jobId ? { jobId } : {}) };
    site.pages = site.pages.filter(p => p.path === '/');
    const check = validateSite(site);
    return { ...check, site: check.ok ? site : null };
  }

  /** Click-to-edit: finds the element a person clicked by its data-edit key. */
  function findEditable(site, pageId, key) {
    const page = (site.pages || []).find(p => p.id === pageId);
    if (!page) return null;
    const walk = (node, path) => {
      if (!node || 'text' in node) return null;
      if (node.attrs && node.attrs['data-edit'] === key) return { node, path };
      for (let i = 0; i < (node.children || []).length; i++) { const hit = walk(node.children[i], path.concat(i)); if (hit) return hit; }
      return null;
    };
    for (const s of page.sections) { const hit = walk(s.tree, []); if (hit) return { sectionId: s.id, path: hit.path, node: clone(hit.node) }; }
    return null;
  }

  /** Replaces or adds one section (Meridian rewrites only the section that was clicked). Never changes the original site. */
  function replaceSection(site, pageId, section, { after } = {}) {
    const next = clone(site);
    const page = next.pages.find(p => p.id === pageId);
    if (!page) return { ok: false, errors: [{ path: 'pageId', message: `No page "${pageId}".` }], site: null };
    const at = page.sections.findIndex(s => s.id === section.id);
    if (at >= 0) page.sections[at] = clone(section);
    else { const i = page.sections.findIndex(s => s.id === after); page.sections.splice(i >= 0 ? i + 1 : page.sections.length, 0, clone(section)); }
    const check = validateSite(next);
    return { ...check, site: check.ok ? next : null };
  }

  return Object.freeze({ MOTION, validateSite, renderPage, renderSite, fromHomePage, findEditable, replaceSection });
});
