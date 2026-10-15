(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MeridianWebsiteBuilder = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const SCHEMA = 'meridian.website-project.v1';
  const SECTION_TYPES = new Set(['hero', 'content', 'features', 'cta']);

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

  function validateProject(input, expectedProjectId) {
    if (!input || input.schema !== SCHEMA || typeof input.id !== 'string' || !input.id) throw new Error('Invalid website project.');
    if (input.meridianProjectId !== expectedProjectId) throw new Error('Website project does not belong to the selected Meridian project.');
    if (!Array.isArray(input.pages) || input.pages.length < 1 || input.pages.length > 50) throw new Error('Website project pages are invalid.');
    const pageIds = new Set();
    const slugs = new Set();
    for (const page of input.pages) {
      if (!page || typeof page.id !== 'string' || !page.id || pageIds.has(page.id)) throw new Error('Website page identity is invalid.');
      if (!/^([a-z0-9]+(?:-[a-z0-9]+)*)?$/.test(page.slug || '') || slugs.has(page.slug || '')) throw new Error('Website page slug is invalid.');
      if (!Array.isArray(page.sections) || page.sections.length > 100) throw new Error('Website page sections are invalid.');
      pageIds.add(page.id);
      slugs.add(page.slug || '');
      for (const section of page.sections) {
        if (!section || typeof section.id !== 'string' || !SECTION_TYPES.has(section.type)) throw new Error('Website section is invalid.');
      }
    }
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
      try {
        const value = JSON.parse(storage.getItem(indexKey) || '[]');
        if (Array.isArray(value)) return value.filter(id => typeof id === 'string' && id);
      } catch (_) { /* Recover the index from validated primary records below. */ }
      const recovered = [];
      for (let index = 0; index < Number(storage.length || 0); index += 1) {
        const key = storage.key(index);
        if (!key || !key.startsWith(prefix) || key === indexKey || key.endsWith('.backup') || key.endsWith('.pending')) continue;
        try { recovered.push(decodeURIComponent(key.slice(prefix.length))); } catch (_) { /* Ignore malformed storage keys. */ }
      }
      return recovered;
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

    return Object.freeze({ save, open, list });
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

  function renderPage(project, pageId) {
    const page = project.pages.find(item => item.id === pageId) || project.pages[0];
    const accent = /^#[0-9a-f]{6}$/i.test(project.design.accent) ? project.design.accent : '#1f6fd6';
    const navigation = project.pages.map(item => `<a href="${item.slug ? `${escapeHtml(item.slug)}.html` : 'index.html'}"${item.id === page.id ? ' aria-current="page"' : ''}>${escapeHtml(item.title)}</a>`).join('');
    const sections = page.sections.map(section => {
      const action = section.action ? `<a class="action" href="#contact">${escapeHtml(section.action)}</a>` : '';
      return `<section class="section section-${escapeHtml(section.type)}"><div><p class="eyebrow">${escapeHtml(project.name)}</p><h1>${escapeHtml(section.heading)}</h1><p>${escapeHtml(section.body)}</p>${action}</div></section>`;
    }).join('');
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(page.title)} · ${escapeHtml(project.name)}</title><style>:root{--accent:${accent};color-scheme:light}*{box-sizing:border-box}body{margin:0;color:#122033;background:#f7f9fc;font:16px/1.6 system-ui,sans-serif}header{display:flex;justify-content:space-between;gap:24px;align-items:center;padding:20px clamp(20px,6vw,88px);background:#fff;border-bottom:1px solid #dce4ee}header strong{font-size:18px}nav{display:flex;flex-wrap:wrap;gap:18px}nav a{color:#29415f;text-decoration:none}nav a[aria-current]{color:var(--accent);font-weight:700}.section{display:grid;place-items:center;min-height:360px;padding:64px clamp(20px,9vw,140px)}.section>div{width:min(820px,100%)}.section:nth-child(even){background:#fff}.section-hero{min-height:560px;color:#fff;background:linear-gradient(135deg,#07101d,#17385d)}.eyebrow{color:var(--accent);font-weight:800;letter-spacing:.1em;text-transform:uppercase}h1{max-width:18ch;margin:.25em 0;font-size:clamp(38px,7vw,76px);line-height:1.04}.section:not(.section-hero) h1{font-size:clamp(30px,5vw,54px)}.action{display:inline-block;margin-top:18px;padding:12px 18px;border-radius:8px;color:#fff;background:var(--accent);font-weight:700;text-decoration:none}@media(max-width:620px){header{align-items:flex-start;flex-direction:column}.section{min-height:300px;padding-block:48px}}</style></head><body><header><strong>${escapeHtml(project.name)}</strong><nav aria-label="Primary">${navigation}</nav></header><main>${sections}</main></body></html>`;
  }

  function exportSite(project) {
    validateProject(project, project.meridianProjectId);
    const files = {};
    for (const page of project.pages) files[page.slug ? `${page.slug}.html` : 'index.html'] = renderPage(project, page.id);
    return { name: `${safeId(project.name, 'website')}-site`, files };
  }

  function createController({ storage, onChange = () => {}, now = () => new Date().toISOString(), idFactory } = {}) {
    let contextProject = null;
    let repository = null;
    let state = { phase: 'no-context', projects: [], project: null, selectedPageId: null, dirty: false, error: null, status: 'Choose a Meridian project.' };
    let history = [];
    let future = [];
    let counter = 0;
    const makeId = idFactory || (prefix => `${prefix}-${Date.now().toString(36)}-${(++counter).toString(36)}`);

    function emit() { onChange(snapshot()); }
    function snapshot() { return copy(state); }
    function refreshList() { state.projects = repository ? repository.list() : []; }

    function selectContext(project) {
      contextProject = project && project.id ? { id: String(project.id), name: cleanText(project.name, 160) } : null;
      repository = contextProject ? createRepository(storage, contextProject.id) : null;
      history = []; future = [];
      state = contextProject
        ? { phase: 'list', projects: repository.list(), project: null, selectedPageId: null, dirty: false, error: null, status: `Website projects for ${contextProject.name}.` }
        : { phase: 'no-context', projects: [], project: null, selectedPageId: null, dirty: false, error: null, status: 'Choose a Meridian project.' };
      emit();
    }

    function createProject(name) {
      if (!contextProject) return false;
      const id = makeId('website');
      const project = initialProject({ id, meridianProjectId: contextProject.id, name, now: now() });
      repository.save(project);
      refreshList();
      state = { ...state, phase: 'editing', project, selectedPageId: project.pages[0].id, dirty: false, error: null, status: 'Website project created and saved locally.' };
      emit();
      return true;
    }

    function openProject(id) {
      if (!repository) return false;
      try {
        const project = repository.open(id);
        if (!project) throw new Error('Website project was not found.');
        history = []; future = [];
        state = { ...state, phase: 'editing', project, selectedPageId: project.pages[0].id, dirty: false, error: null, status: 'Saved website project reopened.' };
        emit(); return true;
      } catch (error) {
        state = { ...state, error: error.message, status: 'Website project could not be opened.' }; emit(); return false;
      }
    }

    function mutate(mutator, message) {
      if (!state.project) return false;
      history.push(copy(state.project));
      if (history.length > 50) history.shift();
      future = [];
      const project = copy(state.project);
      try {
        mutator(project);
        project.updatedAt = now();
        state = { ...state, project, dirty: true, error: null, status: message };
        emit(); return true;
      } catch (error) {
        history.pop();
        state = { ...state, error: error.message || 'Website edit failed.', status: 'Website edit was not applied.' };
        emit(); return false;
      }
    }

    function updateBrief(field, value) {
      if (!['audience', 'goal', 'tone', 'offer'].includes(field)) return false;
      return mutate(project => { project.brief[field] = cleanText(value); }, 'Brief updated. Save to keep this change.');
    }

    function addPage(title) {
      const label = cleanText(title || 'New page', 120);
      return mutate(project => {
        const base = safeId(label, 'page');
        let slug = base; let suffix = 2;
        while (project.pages.some(page => page.slug === slug || (!slug && !page.slug))) slug = `${base}-${suffix++}`;
        const id = makeId('page');
        project.pages.push({ id, title: label, slug, sections: [{ id: makeId('section'), type: 'content', heading: label, body: 'Add the content this page needs.', action: '' }] });
        state.selectedPageId = id;
      }, `${label} added to the sitemap.`);
    }

    function selectPage(id) {
      if (!state.project || !state.project.pages.some(page => page.id === id)) return false;
      state = { ...state, selectedPageId: id, status: 'Page opened.' }; emit(); return true;
    }

    function updatePage(field, value) {
      if (!['title', 'slug'].includes(field)) return false;
      return mutate(project => {
        const page = project.pages.find(item => item.id === state.selectedPageId);
        if (!page) return;
        if (field === 'title') page.title = cleanText(value, 120);
        else {
          const slug = safeId(value, 'page');
          if (project.pages.some(item => item.id !== page.id && item.slug === slug)) throw new Error('Each page needs a unique URL slug.');
          page.slug = slug;
        }
      }, 'Page settings updated.');
    }

    function addSection(type = 'content') {
      if (!SECTION_TYPES.has(type)) return false;
      return mutate(project => {
        const page = project.pages.find(item => item.id === state.selectedPageId);
        page.sections.push({ id: makeId('section'), type, heading: type === 'cta' ? 'Ready to take the next step?' : 'New section', body: 'Write clear, useful content for this section.', action: type === 'cta' ? 'Contact us' : '' });
      }, 'Section added.');
    }

    function updateSection(sectionId, field, value) {
      if (!['heading', 'body', 'action'].includes(field)) return false;
      return mutate(project => {
        const page = project.pages.find(item => item.id === state.selectedPageId);
        const section = page && page.sections.find(item => item.id === sectionId);
        if (!section) throw new Error('Section was not found.');
        section[field] = cleanText(value, field === 'body' ? 8000 : 200);
      }, 'Page content updated.');
    }

    function save() {
      if (!repository || !state.project) return false;
      try {
        const project = copy(state.project);
        project.revision += 1;
        project.updatedAt = now();
        repository.save(project);
        state = { ...state, project, dirty: false, error: null, status: 'Website project saved to durable local application storage.' };
        refreshList(); emit(); return true;
      } catch (error) {
        state = { ...state, dirty: true, error: error.message || 'Save failed.', status: 'Save failed. Your edits remain in this window.' }; emit(); return false;
      }
    }

    function undo() {
      if (!history.length || !state.project) return false;
      future.push(copy(state.project));
      state = { ...state, project: history.pop(), dirty: true, status: 'Last website edit undone.' }; emit(); return true;
    }

    function redo() {
      if (!future.length || !state.project) return false;
      history.push(copy(state.project));
      state = { ...state, project: future.pop(), dirty: true, status: 'Website edit restored.' }; emit(); return true;
    }

    function close() {
      if (state.dirty) return false;
      refreshList();
      state = { ...state, phase: 'list', project: null, selectedPageId: null, status: 'Website project list opened.' }; emit(); return true;
    }

    function discard() {
      if (!repository || !state.project) return false;
      try {
        const project = repository.open(state.project.id);
        if (!project) throw new Error('The last saved website project could not be found.');
        history = []; future = [];
        state = { ...state, project, selectedPageId: project.pages.some(page => page.id === state.selectedPageId) ? state.selectedPageId : project.pages[0].id, dirty: false, error: null, status: 'Unsaved website changes discarded.' };
        emit(); return true;
      } catch (error) {
        state = { ...state, error: error.message, status: 'Website changes could not be discarded safely.' };
        emit(); return false;
      }
    }

    return Object.freeze({ snapshot, selectContext, createProject, openProject, updateBrief, addPage, selectPage,
      updatePage, addSection, updateSection, save, undo, redo, close, discard,
      preview() { return state.project ? renderPage(state.project, state.selectedPageId) : ''; },
      exportSite() { return state.project ? exportSite(state.project) : null; } });
  }

  return Object.freeze({ SCHEMA, createMemoryStorage, createRepository, createController, renderPage, exportSite, validateProject });
});
