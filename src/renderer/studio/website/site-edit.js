/* Website builder edit helpers (#198), used by the builder screen. Core lane.
 * Each helper copies the site, changes the copy and checks it with the site engine, returning { ok, errors, site }.
 * The site passed in is never changed. The navigation section ('site-nav') always stays first. */
'use strict';

(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./site-engine.js') : root && root.MeridianSiteEngine);
  if (node) module.exports = api;
  if (root) root.MeridianSiteEdit = api;
})(typeof window === 'undefined' ? null : window, function (Engine) {
  const NAV = 'site-nav';
  const clone = v => JSON.parse(JSON.stringify(v));
  const refuse = (path, message) => ({ ok: false, errors: [{ path, message }], site: null });
  const checked = site => { const check = Engine.validateSite(site); return { ...check, site: check.ok ? site : null }; };
  const pageOf = (site, pageId) => ((site && site.pages) || []).find(p => p.id === pageId);
  // An element whose children are all text: its words can change (headings, paragraphs, buttons, links).
  const wordsOnly = n => Array.isArray(n.children) && n.children.length > 0 && n.children.every(c => c && 'text' in c);
  const walk = (n, fn) => { if (n && !('text' in n)) { fn(n); for (const c of n.children || []) walk(c, fn); } };
  const keyOf = n => n.attrs && n.attrs['data-edit'];

  /** Everything on the page whose words can change, in page order: [{ key, sectionId, sectionLabel, tag, text }]. */
  function editableList(site, pageId) {
    const page = pageOf(site, pageId), out = [];
    for (const s of page ? page.sections : []) {
      walk(s.tree, n => { if (keyOf(n) && wordsOnly(n)) out.push({ key: keyOf(n), sectionId: s.id, sectionLabel: s.label, tag: n.tag, text: n.children.map(c => c.text).join('') }); });
    }
    return out;
  }

  function setText(site, pageId, key, text) {
    if (typeof text !== 'string' || !text.trim()) return refuse('text', 'Text can\'t be empty.');
    const next = clone(site), page = pageOf(next, pageId);
    if (!page) return refuse('pageId', `No page "${pageId}".`);
    let hit = null;
    for (const s of page.sections) walk(s.tree, n => { if (!hit && keyOf(n) === key && wordsOnly(n)) hit = n; });
    if (!hit) return refuse('key', 'That part of the page can\'t be edited.');
    hit.children = [{ text: text.trim() }];
    return checked(next);
  }

  function moveSection(site, pageId, sectionId, by) {
    const next = clone(site), page = pageOf(next, pageId);
    if (!page) return refuse('pageId', `No page "${pageId}".`);
    const at = page.sections.findIndex(s => s.id === sectionId), to = at + by;
    if (at < 0) return refuse('sectionId', 'No such section on this page.');
    if (sectionId === NAV || !Number.isInteger(by) || to < 0 || to >= page.sections.length || page.sections[to].id === NAV) {
      return refuse('by', 'That section can\'t move there.');
    }
    [page.sections[at], page.sections[to]] = [page.sections[to], page.sections[at]];
    return checked(next);
  }

  function removeSection(site, pageId, sectionId) {
    const next = clone(site), page = pageOf(next, pageId);
    if (!page) return refuse('pageId', `No page "${pageId}".`);
    const at = page.sections.findIndex(s => s.id === sectionId);
    if (at < 0) return refuse('sectionId', 'No such section on this page.');
    if (sectionId === NAV) return refuse('sectionId', 'The navigation always stays.');
    if (page.sections.filter(s => s.id !== NAV).length === 1) return refuse('sectionId', 'A page needs at least one section.');
    page.sections.splice(at, 1);
    return checked(next);
  }

  /** Title (max 120) and description (max 300): the words Google shows. An empty description removes it. */
  function setPageInfo(site, pageId, { title, description } = {}) {
    const next = clone(site), page = pageOf(next, pageId);
    if (!page) return refuse('pageId', `No page "${pageId}".`);
    const trim = v => (typeof v === 'string' ? v.trim() : v);
    if (title !== undefined) page.title = trim(title);
    if (description !== undefined) { if (trim(description) === '') delete page.description; else page.description = trim(description); }
    return checked(next);
  }

  /** Removes a page (never the home page) and every link to it, so no button or menu item points nowhere. */
  function removePage(site, pageId) {
    const next = clone(site), at = (next.pages || []).findIndex(p => p.id === pageId);
    if (at < 0) return refuse('pageId', `No page "${pageId}".`);
    if (next.pages[at].path === '/') return refuse('pageId', 'The home page always stays.');
    const [gone] = next.pages.splice(at, 1);
    const linksThere = c => c && c.tag === 'a' && c.attrs && (c.attrs.href === gone.path || String(c.attrs.href).startsWith(`${gone.path}#`));
    for (const p of next.pages) for (const s of p.sections) walk(s.tree, n => { if (n.children) n.children = n.children.filter(c => !linksThere(c)); });
    return checked(next);
  }

  return Object.freeze({ editableList, setText, moveSection, removeSection, setPageInfo, removePage });
});
