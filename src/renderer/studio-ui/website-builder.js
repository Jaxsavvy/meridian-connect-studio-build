(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MeridianWebsiteBuilder = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const SCHEMA = 'meridian.website-project.v1';
  const SECTION_TYPES = new Set(['hero', 'content', 'features', 'cta']);
  const SHARED_FIELDS = ['type','heading','body','action','bodyFormat','actionPageId'];
  const FONTS = Object.freeze({ 'system-ui': 'system-ui,sans-serif', serif: 'Georgia,serif', monospace: 'ui-monospace,monospace' });

  function copy(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function cleanText(value, limit = 4000) {
    return String(value == null ? '' : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, limit);
  }

  function safeId(value, fallback = 'item') {
    const cleaned = cleanText(value, 120).toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return cleaned || fallback;
  }

  function escapeHtml(value) {
    return cleanText(value, 20000).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[character]));
  }

  function pageFilename(page) {
    const slug = page.slug || 'index';
    return `${/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(slug) ? 'page-' : ''}${slug}.html`;
  }

  function uniquePageSlug(project, title) {
    const base = safeId(title, 'page');
    let slug = base, suffix = 2;
    while (project.pages.some(page => pageFilename(page) === pageFilename({ slug }))) {
      const ending = `-${suffix++}`;
      slug = base.slice(0, 120 - ending.length).replace(/-+$/, '') + ending;
    }
    return slug;
  }

  function accentInk(hex) {
    const channels = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    const luminance = channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    return (luminance + .05) / .05 >= 1.05 / (luminance + .05) ? '#000' : '#fff';
  }

  function sharedSections(project) {
    const groups = new Map();
    for (const page of project.pages) for (const section of page.sections) {
      if (!section.sharedId) continue;
      if (!groups.has(section.sharedId)) groups.set(section.sharedId, { id: section.sharedId, label: cleanText(section.heading || 'Untitled shared section', 120), copies: 0 });
      groups.get(section.sharedId).copies += 1;
    }
    return [...groups.values()];
  }

  function synchronizeSharedSection(project, source) {
    if (!source.sharedId) return;
    for (const page of project.pages) for (const section of page.sections) {
      if (section.sharedId !== source.sharedId || section === source) continue;
      for (const field of SHARED_FIELDS) {
        if (Object.hasOwn(source, field)) section[field] = copy(source[field]);
        else delete section[field];
      }
    }
  }

  function navigationRows(project) {
    const pages = project.pages;
    if (!Array.isArray(pages) || !pages.length || pages.length > 50) throw new Error('Page hierarchy is invalid.');
    const byId = new Map(pages.map(page => [page.id, page]));
    for (const page of pages) {
      if (page.parentPageId !== undefined && typeof page.parentPageId !== 'string') throw new Error('Page parent must be from this website.');
      if (!page.slug && page.parentPageId) throw new Error('Keep the home page at the top navigation level.');
      const seen = new Set([page.id]);
      let parent = page.parentPageId, depth = 0;
      while (parent) {
        if (!byId.has(parent) || seen.has(parent)) throw new Error('Page hierarchy contains an unknown parent or cycle.');
        seen.add(parent); depth += 1;
        if (depth > 2) throw new Error('Navigation supports up to three levels.');
        parent = byId.get(parent).parentPageId;
      }
    }
    const rows = [];
    function visit(parent, depth) {
      for (const page of pages.filter(item => (item.parentPageId || '') === parent)) {
        rows.push({ id: page.id, title: page.title, slug: page.slug, parentPageId: parent, depth });
        visit(page.id, depth + 1);
      }
    }
    visit('', 0);
    return rows;
  }

  function pageParentOptions(project, pageId) {
    const page = project.pages.find(item => item.id === pageId);
    if (!page || !page.slug) return [];
    return navigationRows(project).filter(candidate => {
      const draft = copy(project);
      draft.pages.find(item => item.id === pageId).parentPageId = candidate.id;
      try { navigationRows(draft); return true; } catch (_) { return false; }
    });
  }

  function validateProject(input, expectedProjectId, expectedWebsiteId) {
    if (!input || input.schema !== SCHEMA || typeof input.id !== 'string' || !input.id) throw new Error('Invalid website project.');
    if (expectedWebsiteId !== undefined && input.id !== expectedWebsiteId) throw new Error('Website identity does not match the requested record.');
    if (input.meridianProjectId !== expectedProjectId) throw new Error('Website project does not belong to the selected Meridian project.');
    if (!Array.isArray(input.pages) || input.pages.length < 1 || input.pages.length > 50) throw new Error('Website project pages are invalid.');
    if (typeof input.name !== 'string' || input.name.length > 160 || !Number.isSafeInteger(input.revision) || input.revision < 0 || !input.brief || ['audience','goal','tone','offer'].some(field => typeof input.brief[field] !== 'string' || input.brief[field].length > 4000)) throw new Error('Website draft fields are invalid.');
    const pageIds = new Set();
    const slugs = new Set();
    const filenames = new Set();
    for (const page of input.pages) {
      if (!page || typeof page.id !== 'string' || !page.id || pageIds.has(page.id)) throw new Error('Website page identity is invalid.');
      if (typeof page.slug !== 'string' || page.slug.length > 120 || !/^([a-z0-9]+(?:-[a-z0-9]+)*)?$/.test(page.slug) || slugs.has(page.slug)) throw new Error('Website page slug is invalid.');
      if (typeof page.title !== 'string' || page.title.length > 120) throw new Error('Website page title is invalid.');
      if (!Array.isArray(page.sections) || page.sections.length > 100) throw new Error('Website page sections are invalid.');
      if (filenames.has(pageFilename(page))) throw new Error('Each page needs a unique export filename.');
      filenames.add(pageFilename(page));
      if (page.source && (page.source.kind !== 'synthetic-storyboard' || page.source.projectId !== expectedProjectId || typeof page.source.sceneId !== 'string' || !page.source.sceneId)) throw new Error('Website page source does not match this project.');
      pageIds.add(page.id);
      slugs.add(page.slug || '');
      const sectionIds = new Set();
      for (const section of page.sections) {
        if (!section || typeof section.id !== 'string' || !section.id || sectionIds.has(section.id) || !SECTION_TYPES.has(section.type)) throw new Error('Website section is invalid.');
        sectionIds.add(section.id);
        if (['heading','body','action'].some(field => typeof section[field] !== 'string' || section[field].length > (field === 'body' ? 8000 : 200))) throw new Error('Website section content is invalid.');
        if (section.bodyFormat !== undefined && !['plain', 'formatted'].includes(section.bodyFormat)) throw new Error('Website body format is invalid.');
      }
    }
    for (const page of input.pages) for (const section of page.sections) {
      if (section.actionPageId !== undefined && (typeof section.actionPageId !== 'string' || (section.actionPageId && !pageIds.has(section.actionPageId)))) throw new Error('Action destination must be a page in this website.');
    }
    const shared = new Map();
    for (const page of input.pages) for (const section of page.sections) {
      if (section.sharedId === undefined) continue;
      if (typeof section.sharedId !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(section.sharedId)) throw new Error('Shared section identity is invalid.');
      const shape = JSON.stringify(SHARED_FIELDS.map(field => section[field] ?? (field === 'bodyFormat' ? 'plain' : '')));
      if (shared.has(section.sharedId) && shared.get(section.sharedId) !== shape) throw new Error('Shared section copies disagree. Reopen a valid saved draft.');
      shared.set(section.sharedId, shape);
    }
    navigationRows(input);
    return copy(input);
  }

  function createMemoryStorage() {
    const values = new Map();
    return {
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) { values.set(String(key), String(value)); },
      removeItem(key) { values.delete(String(key)); },
      key(index) { return [...values.keys()][index] ?? null; },
      get length() { return values.size; },
    };
  }

  function createRepository(storage, meridianProjectId) {
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') throw new TypeError('Website storage is required.');
    const scope = encodeURIComponent(String(meridianProjectId));
    const prefix = `meridian.website.${scope}.`;
    const indexKey = `${prefix}index`;

    function parse(raw, projectId) {
      if (!raw) return null;
      return validateProject(JSON.parse(raw), meridianProjectId, projectId);
    }

    function readIndex() {
      let indexed = [];
      try {
        const value = JSON.parse(storage.getItem(indexKey) || '[]');
        if (Array.isArray(value)) indexed = value.filter(id => typeof id === 'string' && id);
      } catch (_) { /* Recover the index from validated primary records below. */ }
      const recovered = [];
      for (let index = 0; index < Number(storage.length || 0); index += 1) {
        const key = storage.key(index);
        if (!key || !key.startsWith(prefix) || key === indexKey || key.endsWith('.backup') || key.endsWith('.pending')) continue;
        try { recovered.push(decodeURIComponent(key.slice(prefix.length))); } catch (_) { /* Ignore malformed storage keys. */ }
      }
      return [...new Set([...indexed, ...recovered])];
    }

    function writeIndex(ids) {
      storage.setItem(indexKey, JSON.stringify([...new Set(ids)].slice(0, 100)));
    }

    function keys(id) {
      const clean = encodeURIComponent(String(id));
      return { primary: `${prefix}${clean}`, backup: `${prefix}${clean}.backup`, pending: `${prefix}${clean}.pending` };
    }

    function save(project) {
      const valid = validateProject(project, meridianProjectId);
      const target = keys(valid.id);
      const serialized = JSON.stringify(valid);
      const previous = storage.getItem(target.primary);
      storage.setItem(target.pending, serialized);
      if (previous) storage.setItem(target.backup, previous);
      storage.setItem(target.primary, serialized);
      storage.removeItem(target.pending);
      writeIndex(readIndex().concat(valid.id));
      return copy(valid);
    }

    function open(id) {
      const target = keys(id);
      const candidates = [target.primary, target.backup, target.pending];
      let lastError = null;
      for (const key of candidates) {
        try {
          const value = parse(storage.getItem(key), id);
          if (!value) continue;
          if (key !== target.primary) storage.setItem(target.primary, JSON.stringify(value));
          return value;
        } catch (error) { lastError = error; }
      }
      if (lastError) throw new Error(`Website project could not be recovered: ${lastError.message}`);
      return null;
    }

    function list() {
      return readIndex().map(id => {
        try {
          const project = open(id);
          return project && { id: project.id, name: project.name, updatedAt: project.updatedAt, pageCount: project.pages.length };
        } catch (_) { return null; }
      }).filter(Boolean).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    }

    function checkpointKey(id) { return `meridian.website-checkpoints.${scope}.${encodeURIComponent(String(id))}`; }
    function readCheckpoints(id) {
      const raw = storage.getItem(checkpointKey(id));
      if (!raw) return [];
      if (raw.length > 6 * 1024 * 1024) throw new Error('Checkpoint history exceeds the local size limit.');
      const record = JSON.parse(raw);
      if (record.schema !== 'meridian.website-checkpoints.v1' || record.meridianProjectId !== meridianProjectId || record.websiteId !== id || !Array.isArray(record.checkpoints) || record.checkpoints.length > 10) throw new Error('Checkpoint history identity or format is invalid.');
      const ids = new Set();
      return record.checkpoints.map(item => {
        if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.label !== 'string' || item.label.length > 120 || typeof item.createdAt !== 'string') throw new Error('Checkpoint metadata is invalid.');
        ids.add(item.id);
        const project = validateProject(item.project, meridianProjectId, id);
        if (!Number.isSafeInteger(project.revision) || project.revision < 0 || typeof project.name !== 'string' || !project.brief || !project.design || ['audience','goal','tone','offer'].some(field => typeof project.brief[field] !== 'string') || project.pages.some(page => typeof page.title !== 'string' || page.sections.some(section => !/^[a-zA-Z0-9_-]+$/.test(section.id) || ['heading','body','action'].some(field => typeof section[field] !== 'string')))) throw new Error('Checkpoint draft fields are invalid.');
        return { id: item.id, label: item.label, createdAt: item.createdAt, project };
      });
    }
    function checkpointMeta(item) { return { id: item.id, label: item.label, createdAt: item.createdAt, revision: item.project.revision, pageCount: item.project.pages.length }; }
    function listCheckpoints(id) { return readCheckpoints(id).map(checkpointMeta).reverse(); }
    function saveCheckpoint(project, { id, label, createdAt }) {
      const persisted = open(project.id);
      if (!persisted || JSON.stringify(persisted) !== JSON.stringify(project)) throw new Error('Website changed elsewhere. Reopen it before making a checkpoint.');
      const checkpoints = readCheckpoints(project.id);
      if (checkpoints.length >= 10) throw new Error('The 10-checkpoint limit is reached. Existing checkpoints are kept.');
      if (checkpoints.some(item => item.id === id)) throw new Error('Checkpoint identity already exists.');
      checkpoints.push({ id, label: cleanText(label || `Saved revision ${project.revision}`, 120), createdAt, project: copy(project) });
      const serialized = JSON.stringify({ schema: 'meridian.website-checkpoints.v1', meridianProjectId, websiteId: project.id, checkpoints });
      if (serialized.length > 6 * 1024 * 1024) throw new Error('Checkpoint history exceeds the local size limit.');
      storage.setItem(checkpointKey(project.id), serialized);
      return checkpoints.map(checkpointMeta).reverse();
    }
    function removeCheckpoint(websiteId, checkpointId) {
      const checkpoints = readCheckpoints(websiteId);
      if (!checkpoints.some(item => item.id === checkpointId)) throw new Error('Checkpoint was not found for this website.');
      const retained = checkpoints.filter(item => item.id !== checkpointId);
      storage.setItem(checkpointKey(websiteId), JSON.stringify({ schema: 'meridian.website-checkpoints.v1', meridianProjectId, websiteId, checkpoints: retained }));
      return retained.map(checkpointMeta).reverse();
    }
    function checkpointProject(websiteId, checkpointId) {
      const checkpoint = readCheckpoints(websiteId).find(item => item.id === checkpointId);
      if (!checkpoint) throw new Error('Checkpoint was not found for this website.');
      return copy(checkpoint.project);
    }
    return Object.freeze({ save, open, list, listCheckpoints, saveCheckpoint, checkpointProject, removeCheckpoint });
  }

  function initialProject({ id, meridianProjectId, name, now }) {
    const homeId = `${id}-home`;
    return {
      schema: SCHEMA,
      id,
      meridianProjectId,
      name: cleanText(name || 'Untitled website', 160),
      createdAt: now,
      updatedAt: now,
      revision: 0,
      brief: { audience: '', goal: '', tone: '', offer: '' },
      design: { accent: '#1f6fd6', font: 'system-ui' },
      pages: [{
        id: homeId,
        title: 'Home',
        slug: '',
        sections: [
          { id: `${homeId}-hero`, type: 'hero', heading: cleanText(name || 'A clear promise for your customer', 160), body: 'Explain the outcome your customer can expect.', action: 'Get started' },
          { id: `${homeId}-content`, type: 'content', heading: 'Built around real needs', body: 'Use this section to explain the service, process, or product in plain language.', action: '' },
        ],
      }],
    };
  }

  // Deliberately limited text formatting: escape every user fragment, then emit
  // only fixed semantic tags. No HTML, links, images, CSS or executable markup.
  function renderBody(section) {
    if (section.bodyFormat !== 'formatted') return `<p>${escapeHtml(section.body)}</p>`;
    const text = cleanText(section.body, 8000).replace(/\r\n?/g, '\n');
    function inline(line) {
      const pattern = /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g;
      let result = '', offset = 0;
      for (const match of line.matchAll(pattern)) {
        result += escapeHtml(line.slice(offset, match.index));
        result += match[1] !== undefined ? `<strong>${escapeHtml(match[1])}</strong>` : `<em>${escapeHtml(match[2])}</em>`;
        offset = match.index + match[0].length;
      }
      return result + escapeHtml(line.slice(offset));
    }
    let output = '', kind = '', lines = [];
    function flush() {
      if (lines.length) output += kind === 'p' ? `<p>${lines.join('<br>')}</p>` : `<${kind}>${lines.map(line => `<li>${line}</li>`).join('')}</${kind}>`;
      kind = ''; lines = [];
    }
    for (const line of text.split('\n')) {
      if (!line.trim()) { flush(); continue; }
      const bullet = /^[-] (.+)$/.exec(line), numbered = /^\d+[.] (.+)$/.exec(line);
      const next = bullet ? 'ul' : numbered ? 'ol' : 'p';
      if (kind && kind !== next) flush();
      kind = next; lines.push(inline(bullet ? bullet[1] : numbered ? numbered[1] : line));
    }
    flush();
    return output;
  }

  function renderPage(project, pageId, { preview = false } = {}) {
    const page = project.pages.find(item => item.id === pageId) || project.pages[0];
    const accent = /^#[0-9a-f]{6}$/i.test(project.design?.accent) ? project.design.accent : '#1f6fd6';
    const font = Object.hasOwn(FONTS, project.design?.font) ? FONTS[project.design.font] : FONTS['system-ui'];
    const rows = navigationRows(project);
    function navigationGroup(parent = '') {
      const items = rows.filter(item => item.parentPageId === parent);
      if (!items.length) return '';
      return `<ul>${items.map(item => {
        const current = item.id === page.id ? ' aria-current="page"' : '';
        const label = preview ? `<span${current}>${escapeHtml(item.title)}</span>` : `<a href="${escapeHtml(pageFilename(item))}"${current}>${escapeHtml(item.title)}</a>`;
        return `<li>${label}${navigationGroup(item.id)}</li>`;
      }).join('')}</ul>`;
    }
    const navigation = navigationGroup();
    const sections = page.sections.map(section => {
      const target = project.pages.find(item => item.id === section.actionPageId);
      const action = !section.action || !target ? '' : preview ? `<span class="action">${escapeHtml(section.action)}</span>` : `<a class="action" href="${escapeHtml(pageFilename(target))}">${escapeHtml(section.action)}</a>`;
      return `<section class="section section-${escapeHtml(section.type)}"><div><p class="eyebrow">${escapeHtml(project.name)}</p><h1>${escapeHtml(section.heading)}</h1>${renderBody(section)}${action}</div></section>`;
    }).join('');
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(page.title)} · ${escapeHtml(project.name)}</title><style>:root{--accent:${accent};color-scheme:light}*{box-sizing:border-box}body{overflow-wrap:anywhere;margin:0;color:#122033;background:#f7f9fc;font:16px/1.6 ${font}}header{display:flex;justify-content:space-between;gap:24px;align-items:center;padding:20px clamp(20px,6vw,88px);background:#fff;border-bottom:1px solid #dce4ee}header strong{min-width:0;font-size:18px}nav{min-width:0}nav ul{list-style:none;margin:0;padding:0}nav>ul{display:flex;flex-wrap:wrap;gap:18px}nav li{min-width:0;overflow-wrap:anywhere}nav li>ul{display:grid;gap:6px;margin-top:6px;padding-left:12px;border-left:1px solid #6f838c}nav li>ul :is(a,span){font-size:14px}nav :is(a,span){color:#29415f;text-decoration:none}nav [aria-current]{color:#122033;font-weight:700;border-bottom:2px solid var(--accent)}.section{display:grid;place-items:center;min-height:360px;padding:64px clamp(20px,9vw,140px)}.section>div{min-width:0;width:min(820px,100%)}.section:nth-child(even){background:#fff}.section-hero{min-height:560px;color:#fff;background:linear-gradient(135deg,#07101d,#17385d)}.eyebrow{color:#29415f;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.section-hero .eyebrow{color:#c7e4fb}h1{max-width:18ch;margin:.25em 0;font-size:clamp(38px,7vw,76px);line-height:1.04}.section:not(.section-hero) h1{font-size:clamp(30px,5vw,54px)}.action{display:inline-block;max-width:100%;margin-top:18px;padding:12px 18px;border-radius:8px;color:${accentInk(accent)};background:var(--accent);font-weight:700;text-decoration:none}@media(max-width:620px){header{align-items:flex-start;flex-direction:column}.section{min-height:300px;padding-block:48px}}</style></head><body><header><strong>${escapeHtml(project.name)}</strong><nav aria-label="Primary">${navigation}</nav></header><main>${sections}</main></body></html>`;
  }

  function exportSite(project) {
    validateProject(project, project.meridianProjectId);
    const files = {};
    for (const page of project.pages) files[pageFilename(page)] = renderPage(project, page.id);
    return { name: `${safeId(project.name, 'website')}-site`, files };
  }

  // ZIP STORE: no dependencies, scripts, external resources or filesystem access.
  // Only validated page filenames are included. UTF-8 flag and CRC-32 are standard ZIP.
  function exportArchive(project) {
    const bundle = exportSite(project);
    const encoder = new TextEncoder();
    const entries = Object.entries(bundle.files).map(([name, html]) => ({ name: encoder.encode(name), body: encoder.encode(html) }));
    const localSize = entries.reduce((size, entry) => size + 30 + entry.name.length + entry.body.length, 0);
    const centralSize = entries.reduce((size, entry) => size + 46 + entry.name.length, 0);
    if (localSize + centralSize + 22 > 64 * 1024 * 1024) throw new Error('Website download exceeds the 64 MiB local export limit.');
    const bytes = new Uint8Array(localSize + centralSize + 22);
    const view = new DataView(bytes.buffer);
    const u16 = (at, value) => view.setUint16(at, value, true);
    const u32 = (at, value) => view.setUint32(at, value, true);
    let offset = 0;
    let central = localSize;
    for (const entry of entries) {
      let crc = 0xffffffff;
      for (const byte of entry.body) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
      }
      crc = (crc ^ 0xffffffff) >>> 0;
      u32(offset, 0x04034b50); u16(offset + 4, 20); u16(offset + 6, 0x0800);
      u16(offset + 12, 33); // Deterministic DOS date: 1980-01-01.
      u32(offset + 14, crc); u32(offset + 18, entry.body.length); u32(offset + 22, entry.body.length); u16(offset + 26, entry.name.length);
      bytes.set(entry.name, offset + 30); bytes.set(entry.body, offset + 30 + entry.name.length);
      u32(central, 0x02014b50); u16(central + 4, 20); u16(central + 6, 20); u16(central + 8, 0x0800); u16(central + 14, 33);
      u32(central + 16, crc); u32(central + 20, entry.body.length); u32(central + 24, entry.body.length); u16(central + 28, entry.name.length); u32(central + 42, offset);
      bytes.set(entry.name, central + 46);
      offset += 30 + entry.name.length + entry.body.length;
      central += 46 + entry.name.length;
    }
    u32(central, 0x06054b50); u16(central + 8, entries.length); u16(central + 10, entries.length); u32(central + 12, centralSize); u32(central + 16, localSize);
    return { name: `${bundle.name}.zip`, bytes };
  }

  function createController({ storage, onChange = () => {}, now = () => new Date().toISOString(), idFactory } = {}) {
    let contextProject = null;
    let repository = null;
    let state = { phase: 'no-context', projects: [], project: null, selectedPageId: null, dirty: false, error: null, status: 'Choose a Meridian project.' };
    let history = [];
    let future = [];
    let counter = 0;
    let checkpoints = [];
    let savedBaseline = null;
    const makeId = idFactory || (prefix => `${prefix}-${Date.now().toString(36)}-${(++counter).toString(36)}`);

    function emit() { onChange(snapshot()); }
    function snapshot() { return copy({ ...state, checkpoints }); }
    function refreshList() { state.projects = repository ? repository.list() : []; }
    function refreshCheckpoints() {
      checkpoints = [];
      if (!repository || !state.project) return;
      try { checkpoints = repository.listCheckpoints(state.project.id); }
      catch (error) { state = { ...state, error: `Checkpoint history unavailable: ${error.message}`, status: 'The website opened; its checkpoint history needs attention.' }; }
    }

    function selectContext(project) {
      contextProject = project && project.id ? { id: String(project.id), name: cleanText(project.name, 160) } : null;
      repository = contextProject ? createRepository(storage, contextProject.id) : null;
      history = []; future = [];
      savedBaseline = null;
      checkpoints = [];
      state = contextProject
        ? { phase: 'list', projects: repository.list(), project: null, selectedPageId: null, dirty: false, error: null, status: `Website projects for ${contextProject.name}.` }
        : { phase: 'no-context', projects: [], project: null, selectedPageId: null, dirty: false, error: null, status: 'Choose a Meridian project.' };
      emit();
    }

    function createProject(name) {
      if (!contextProject) return false;
      const id = makeId('website');
      const project = initialProject({ id, meridianProjectId: contextProject.id, name, now: now() });
      try { repository.save(project); }
      catch (error) {
        state = { ...state, error: error.message || 'Website creation failed.', status: 'Website could not be created. Existing projects are unchanged.' };
        emit(); return false;
      }
      history = []; future = [];
      savedBaseline = JSON.stringify(project);
      refreshList();
      state = { ...state, phase: 'editing', project, selectedPageId: project.pages[0].id, dirty: false, error: null, status: 'Website project created and saved locally.' };
      checkpoints = [];
      emit();
      return true;
    }

    function openProject(id) {
      if (!repository) return false;
      try {
        const project = repository.open(id);
        if (!project) throw new Error('Website project was not found.');
        history = []; future = [];
        savedBaseline = JSON.stringify(project);
        state = { ...state, phase: 'editing', project, selectedPageId: project.pages[0].id, dirty: false, error: null, status: 'Saved website project reopened.' };
        refreshCheckpoints();
        emit(); return true;
      } catch (error) {
        state = { ...state, error: error.message, status: 'Website project could not be opened.' }; emit(); return false;
      }
    }

    function mutate(mutator, message) {
      if (!state.project) return false;
      const previous = { project: copy(state.project), selectedPageId: state.selectedPageId };
      const project = copy(state.project);
      try {
        mutator(project);
        project.updatedAt = now();
        validateProject(project, contextProject.id, state.project.id);
        history.push(previous);
        if (history.length > 50) history.shift();
        future = [];
        state = { ...state, project, dirty: true, error: null, status: message };
        emit(); return true;
      } catch (error) {
        state = { ...state, selectedPageId: previous.selectedPageId, error: error.message || 'Website edit failed.', status: 'Website edit was not applied.' };
        emit(); return false;
      }
    }

    function updateBrief(field, value) {
      if (!['audience', 'goal', 'tone', 'offer'].includes(field)) return false;
      return mutate(project => { project.brief[field] = cleanText(value); }, 'Brief updated. Save to keep this change.');
    }

    function updateDesign(field, value) {
      if (!['accent', 'font'].includes(field)) return false;
      return mutate(project => {
        if (field === 'accent' ? !/^#[0-9a-f]{6}$/i.test(value) : !Object.hasOwn(FONTS, value)) throw new Error('Choose a supported font or a six-digit hex color.');
        project.design = { ...project.design, [field]: value };
      }, 'Website-wide style updated. Save to keep this change.');
    }

    function moveItem(items, id, direction) {
      const index = items.findIndex(item => item.id === id);
      const target = index + direction;
      if (![1, -1].includes(direction) || index < 0 || target < 0 || target >= items.length) throw new Error('That item cannot move further in this direction.');
      [items[index], items[target]] = [items[target], items[index]];
    }

    function movePage(id, direction) {
      return mutate(project => {
        const page = project.pages.find(item => item.id === id);
        if (!page) throw new Error('Page was not found.');
        const siblings = project.pages.filter(item => (item.parentPageId || '') === (page.parentPageId || ''));
        const index = siblings.findIndex(item => item.id === id), target = index + direction;
        if (![1, -1].includes(direction) || target < 0 || target >= siblings.length) throw new Error('That page cannot move further among its siblings.');
        const from = project.pages.indexOf(page), to = project.pages.indexOf(siblings[target]);
        [project.pages[from], project.pages[to]] = [project.pages[to], project.pages[from]];
      }, 'Navigation order updated within this parent.');
    }

    function dropIsUnchanged(items, id, targetId, placement) {
      const from = items.findIndex(item => item.id === id), to = items.findIndex(item => item.id === targetId);
      return from >= 0 && to >= 0 && (from === to || (placement === 'before' ? from + 1 === to : from === to + 1));
    }

    function reorderByDrop(items, id, targetId, placement) {
      const from = items.findIndex(item => item.id === id);
      if (from < 0 || !items.some(item => item.id === targetId)) throw new Error('The dragged item is no longer in this workspace.');
      const [item] = items.splice(from, 1);
      const to = items.findIndex(candidate => candidate.id === targetId) + (placement === 'after' ? 1 : 0);
      items.splice(to, 0, item);
    }

    function movePageTo(id, targetId, placement) {
      if (!state.project || !['before', 'after'].includes(placement)) return false;
      const page = state.project.pages.find(item => item.id === id);
      const siblings = page ? state.project.pages.filter(item => (item.parentPageId || '') === (page.parentPageId || '')) : [];
      if (dropIsUnchanged(siblings, id, targetId, placement)) return false;
      return mutate(project => {
        const source = project.pages.find(item => item.id === id), target = project.pages.find(item => item.id === targetId);
        if (!source || !target || (source.parentPageId || '') !== (target.parentPageId || '')) throw new Error('Drag pages within one parent. Use Navigation parent to change groups.');
        reorderByDrop(project.pages, id, targetId, placement);
      }, 'Page moved by drag and drop. Undo restores its previous order.');
    }

    function moveSectionTo(id, targetId, placement) {
      if (!state.project || !['before', 'after'].includes(placement)) return false;
      const sections = state.project.pages.find(page => page.id === state.selectedPageId)?.sections || [];
      if (dropIsUnchanged(sections, id, targetId, placement)) return false;
      return mutate(project => {
        const page = project.pages.find(item => item.id === state.selectedPageId);
        if (!page) throw new Error('Choose a page before moving sections.');
        reorderByDrop(page.sections, id, targetId, placement);
      }, 'Section moved by drag and drop. Undo restores its previous order.');
    }

    function removePage(id) {
      return mutate(project => {
        const index = project.pages.findIndex(page => page.id === id);
        if (index < 0) throw new Error('Page was not found.');
        if (project.pages.length === 1) throw new Error('Keep at least one page in the website.');
        if (!project.pages[index].slug) throw new Error('Keep the home page. Its content can be edited or its sections removed.');
        const parent = project.pages[index].parentPageId || '';
        for (const page of project.pages) if (page.parentPageId === id) page.parentPageId = parent;
        project.pages.splice(index, 1);
        for (const page of project.pages) for (const section of page.sections) if (section.actionPageId === id) section.actionPageId = '';
        if (state.selectedPageId === id) state.selectedPageId = project.pages[Math.min(index, project.pages.length - 1)].id;
      }, 'Page removed; its children move up one level. Actions pointing to it need a new destination. Undo restores the hierarchy and links.');
    }

    function moveSection(id, direction) {
      return mutate(project => moveItem(project.pages.find(page => page.id === state.selectedPageId).sections, id, direction), 'Section order updated.');
    }

    function removeSection(id) {
      return mutate(project => {
        const sections = project.pages.find(page => page.id === state.selectedPageId).sections;
        const index = sections.findIndex(section => section.id === id);
        if (index < 0) throw new Error('Section was not found.');
        sections.splice(index, 1);
      }, 'Section removed. Undo restores it.');
    }

    function addPage(title) {
      const label = cleanText(title || 'New page', 120);
      return mutate(project => {
        if (project.pages.length >= 50) throw new Error('This website already has 50 pages.');
        const slug = uniquePageSlug(project, label);
        const id = makeId('page');
        project.pages.push({ id, title: label, slug, sections: [{ id: makeId('section'), type: 'content', heading: label, body: 'Add the content this page needs.', action: '' }] });
        state.selectedPageId = id;
      }, `${label} added to the sitemap.`);
    }

    function addScenePage(scene) {
      if (!contextProject || !scene || scene.projectId !== contextProject.id || typeof scene.sceneId !== 'string' || !scene.sceneId) return false;
      return mutate(project => {
        if (project.pages.length >= 50) throw new Error('This website already has 50 pages.');
        const title = cleanText(scene.title || 'Storyboard scene', 120);
        const slug = uniquePageSlug(project, title);
        const id = makeId('page');
        project.pages.push({ id, title, slug,
          source: { kind: 'synthetic-storyboard', projectId: contextProject.id, sceneId: scene.sceneId },
          sections: [{ id: makeId('section'), type: 'content', heading: title, body: cleanText(scene.notes, 8000), action: '' }] });
        state.selectedPageId = id;
      }, 'Synthetic scene copied to a local page. Save the website to keep it.');
    }

    function selectPage(id) {
      if (!state.project || !state.project.pages.some(page => page.id === id)) return false;
      state = { ...state, selectedPageId: id, status: 'Page opened.' }; emit(); return true;
    }

    function updatePage(field, value) {
      if (!['title', 'slug', 'parentPageId'].includes(field)) return false;
      return mutate(project => {
        const page = project.pages.find(item => item.id === state.selectedPageId);
        if (!page) return;
        if (field === 'title') page.title = cleanText(value, 120);
        else if (field === 'parentPageId') {
          if (typeof value !== 'string') throw new Error('Choose a parent from this website.');
          page.parentPageId = value; navigationRows(project);
        } else {
          if (!page.slug) throw new Error('Keep the home URL empty so the website opens at index.html.');
          const slug = safeId(value, 'page');
          if (project.pages.some(item => item.id !== page.id && pageFilename(item) === pageFilename({ slug }))) throw new Error('Each page needs a unique URL slug and export filename.');
          page.slug = slug;
        }
      }, 'Page settings updated.');
    }

    function addSection(type = 'content') {
      if (!SECTION_TYPES.has(type)) return false;
      return mutate(project => {
        const page = project.pages.find(item => item.id === state.selectedPageId);
        if (page.sections.length >= 100) throw new Error('This page already has 100 sections.');
        page.sections.push({ id: makeId('section'), type, heading: type === 'cta' ? 'Ready to take the next step?' : 'New section', body: 'Write clear, useful content for this section.', action: type === 'cta' ? 'Contact us' : '' });
      }, 'Section added.');
    }

    function makeSectionShared(sectionId) {
      return mutate(project => {
        const source = project.pages.find(page => page.id === state.selectedPageId)?.sections.find(section => section.id === sectionId);
        if (!source || source.sharedId) throw new Error('Choose an independent section to share.');
        const sharedId = makeId('shared-section');
        if (project.pages.some(page => page.sections.some(section => section.sharedId === sharedId))) throw new Error('Shared section identity already exists.');
        source.sharedId = sharedId;
      }, 'Section is now shared within this website. Insert linked copies from the shared section list.');
    }

    function addSharedSection(sharedId) {
      if (typeof sharedId !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(sharedId)) return false;
      return mutate(project => {
        const source = project.pages.flatMap(page => page.sections).find(section => section.sharedId === sharedId);
        const page = project.pages.find(item => item.id === state.selectedPageId);
        if (!source || !page) throw new Error('Shared section was not found in this website.');
        if (page.sections.length >= 100) throw new Error('This page already has 100 sections.');
        page.sections.push({ ...copy(source), id: makeId('section') });
      }, 'Linked section inserted. Editing its content updates every linked copy in this website.');
    }

    function detachSection(sectionId) {
      return mutate(project => {
        const source = project.pages.find(page => page.id === state.selectedPageId)?.sections.find(section => section.id === sectionId);
        if (!source?.sharedId) throw new Error('Choose a shared section to detach.');
        delete source.sharedId;
      }, 'Section detached. Its content now changes independently; Undo links it again.');
    }

    function updateSection(sectionId, field, value) {
      if (!['heading', 'body', 'action', 'bodyFormat', 'actionPageId'].includes(field)) return false;
      if (field === 'bodyFormat' && !['plain', 'formatted'].includes(value)) return false;
      return mutate(project => {
        const page = project.pages.find(item => item.id === state.selectedPageId);
        const section = page && page.sections.find(item => item.id === sectionId);
        if (!section) throw new Error('Section was not found.');
        if (field === 'actionPageId' && (typeof value !== 'string' || (value && !project.pages.some(item => item.id === value)))) throw new Error('Choose an action destination from this website.');
        section[field] = field === 'actionPageId' ? value : cleanText(value, field === 'body' ? 8000 : 200);
        synchronizeSharedSection(project, section);
      }, 'Page content updated.');
    }

    function formatSectionText(sectionId, command, start, end) {
      if (!['bold', 'italic', 'bullets', 'numbered'].includes(command)) return false;
      return mutate(project => {
        const section = project.pages.find(page => page.id === state.selectedPageId)?.sections.find(item => item.id === sectionId);
        if (!section) throw new Error('Section was not found.');
        const body = cleanText(section.body, 8000);
        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > body.length) throw new Error('Select text in this section before formatting.');
        let selection = body.slice(start, end);
        if (command === 'bold' || command === 'italic') {
          const marker = command === 'bold' ? '**' : '*';
          selection = (selection || 'Text').split('\n').map(line => line ? marker + line + marker : '').join('\n');
        } else {
          // List commands operate on complete lines even for a partial selection.
          start = start === 0 ? 0 : body.lastIndexOf('\n', start - 1) + 1;
          const nextLine = body.indexOf('\n', Math.max(start, end - 1));
          end = nextLine < 0 ? body.length : nextLine;
          selection = body.slice(start, end).split('\n').map((line, index) => `${command === 'bullets' ? '-' : index + 1 + '.'} ${line || 'List item'}`).join('\n');
        }
        const next = body.slice(0, start) + selection + body.slice(end);
        if (next.length > 8000) throw new Error('Formatting would exceed the 8,000-character body limit. Shorten this section first.');
        section.body = next; section.bodyFormat = 'formatted';
        synchronizeSharedSection(project, section);
      }, 'Text formatting inserted. Preview shows the result; Undo reverses this edit.');
    }

    function save() {
      if (!repository || !state.project) return false;
      let attemptedSave = null;
      try {
        const persisted = repository.open(state.project.id);
        if (JSON.stringify(persisted) !== savedBaseline) throw new Error('Website changed elsewhere. Your edits remain here; reopen the saved website before applying them again.');
        const project = copy(state.project);
        project.revision += 1;
        project.updatedAt = now();
        attemptedSave = JSON.stringify(project);
        repository.save(project);
        savedBaseline = JSON.stringify(project);
        state = { ...state, project, dirty: false, error: null, status: 'Website project saved to durable local application storage.' };
        refreshList(); emit(); return true;
      } catch (error) {
        // A primary write may succeed before the index/cleanup fails. Recognize
        // only this exact attempted content so an explicit retry stays possible.
        if (attemptedSave) {
          try { if (JSON.stringify(repository.open(state.project.id)) === attemptedSave) savedBaseline = attemptedSave; }
          catch (_) { /* Preserve the original save failure and unsaved work. */ }
        }
        state = { ...state, dirty: true, error: error.message || 'Save failed.', status: 'Save failed. Your edits remain in this window.' }; emit(); return false;
      }
    }

    function createCheckpoint(label) {
      if (!repository || !state.project) return false;
      try {
        if (state.dirty) throw new Error('Save this website before making a checkpoint.');
        checkpoints = repository.saveCheckpoint(state.project, { id: makeId('checkpoint'), label, createdAt: now() });
        state = { ...state, error: null, status: 'Saved checkpoint created on this device. It is not an approved revision.' };
        emit(); return true;
      } catch (error) { state = { ...state, error: error.message, status: 'Checkpoint was not created. The website and existing checkpoints are unchanged.' }; emit(); return false; }
    }

    function removeCheckpoint(id) {
      if (!repository || !state.project) return false;
      try {
        checkpoints = repository.removeCheckpoint(state.project.id, id);
        state = { ...state, error: null, status: 'Checkpoint removed from this device. The website and current edits are unchanged.' };
        emit(); return true;
      } catch (error) { state = { ...state, error: error.message, status: 'Checkpoint was not removed. Current work and previous checkpoints are unchanged.' }; emit(); return false; }
    }

    function restoreCheckpoint(id) {
      if (!repository || !state.project) return false;
      try {
        if (state.dirty) throw new Error('Save or discard current edits before restoring a checkpoint.');
        const restored = repository.checkpointProject(state.project.id, id);
        return mutate(project => {
          const revision = project.revision, createdAt = project.createdAt;
          for (const key of Object.keys(project)) delete project[key];
          Object.assign(project, restored, { revision, createdAt });
          if (!project.pages.some(page => page.id === state.selectedPageId)) state.selectedPageId = project.pages[0].id;
        }, 'Checkpoint restored as an unsaved draft. Undo returns to the previous draft; Save project keeps this version.');
      } catch (error) { state = { ...state, error: `Checkpoint restore failed: ${error.message}`, status: 'Checkpoint was not restored. Current work is unchanged.' }; emit(); return false; }
    }

    function readiness() {
      const project = state.project;
      const hasText = value => typeof value === 'string' && Boolean(value.trim());
      return {
        websiteOpen: Boolean(project), canApprove: false, canPublish: false,
        checks: [
          { id: 'saved', label: 'No unsaved website edits', passed: Boolean(project && !state.dirty) },
          { id: 'brief', label: 'Audience, goal, tone and offer filled in', passed: Boolean(project && ['audience','goal','tone','offer'].every(field => typeof project.brief?.[field] === 'string' && project.brief[field].trim())) },
          { id: 'content', label: 'Every page has a title and nonempty section content', passed: Boolean(project && project.pages.every(page => hasText(page.title) && page.sections.length && page.sections.every(section => hasText(section.heading) && hasText(section.body)))) },
          { id: 'actions', label: 'Every action label has a page destination', passed: Boolean(project && project.pages.every(page => page.sections.every(section => !hasText(section.action) || project.pages.some(target => target.id === section.actionPageId)))) },
          { id: 'home', label: 'Home export entry exists', passed: Boolean(project && project.pages.some(page => !page.slug)) },
        ],
        limit: 'Authoritative review, approval and publish services are not connected. Local checks never grant authority.',
      };
    }

    function undo() {
      if (!history.length || !state.project) return false;
      future.push({ project: copy(state.project), selectedPageId: state.selectedPageId });
      state = { ...state, ...history.pop(), dirty: true, error: null, status: 'Last website edit undone.' }; emit(); return true;
    }

    function redo() {
      if (!future.length || !state.project) return false;
      history.push({ project: copy(state.project), selectedPageId: state.selectedPageId });
      state = { ...state, ...future.pop(), dirty: true, error: null, status: 'Website edit restored.' }; emit(); return true;
    }

    function close() {
      if (state.dirty) return false;
      refreshList();
      state = { ...state, phase: 'list', project: null, selectedPageId: null, status: 'Website project list opened.' }; checkpoints = []; emit(); return true;
    }

    function discard() {
      if (!repository || !state.project) return false;
      try {
        const project = repository.open(state.project.id);
        if (!project) throw new Error('The last saved website project could not be found.');
        history = []; future = [];
        savedBaseline = JSON.stringify(project);
        state = { ...state, project, selectedPageId: project.pages.some(page => page.id === state.selectedPageId) ? state.selectedPageId : project.pages[0].id, dirty: false, error: null, status: 'Unsaved website changes discarded.' };
        emit(); return true;
      } catch (error) {
        state = { ...state, error: error.message, status: 'Website changes could not be discarded safely.' };
        emit(); return false;
      }
    }

    return Object.freeze({ snapshot, selectContext, createProject, openProject, updateBrief, updateDesign, addPage, addScenePage, selectPage,
      updatePage, movePage, movePageTo, removePage, addSection, makeSectionShared, addSharedSection, detachSection, updateSection, moveSection, moveSectionTo, removeSection, formatSectionText, save, createCheckpoint, restoreCheckpoint, removeCheckpoint, readiness, undo, redo, close, discard,
      preview() { return state.project ? renderPage(state.project, state.selectedPageId, { preview: true }) : ''; },
      exportSite() { return state.project ? exportSite(state.project) : null; },
      exportArchive() {
        if (!state.project) return null;
        try { return exportArchive(state.project); }
        catch (error) { state = { ...state, error: error.message, status: 'Website download failed. Your edits are unchanged.' }; emit(); return null; }
      } });
  }

  return Object.freeze({ SCHEMA, createMemoryStorage, createRepository, createController, pageFilename, navigationRows, pageParentOptions, sharedSections, renderPage, exportSite, exportArchive, validateProject });
});
