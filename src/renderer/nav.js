/* Meridian Connect: "take me to…" navigation (2026-10-08)
 * Typed or spoken: "take me to Roof Co", "open the Roof Co storyboards", "show my tasks", "go to messages",
 * "open the spring special storyboard". Handled instantly in Connect (no AI call); anything else goes to Meridian.
 *
 * Built to survive pages being added or removed: nothing is hard-coded.
 *  - Pages are read live from the sidebar (every visible .nav-link[data-view]); its label and data-view are the names.
 *    A page can add spoken aliases with data-nav-aliases="inbox, chat with jax".
 *  - Project tabs are read live from the project workspace (window.meridianWorkspace.tabs()).
 *  - Projects and storyboards are read live from home base.
 *  - Anything else can plug in with window.meridianNav.register({ id, label, aliases: [...], go: () => {} }).
 */
'use strict';

(function () {
  // The "go somewhere" phrase can come after a few lead-in words ("okay so can you take me to…", "alright now go to…"),
  // which is how people talk, especially by voice.
  const VERB = /(?:^|[\s,.!?])(?:take (?:me|us) (?:back )?to|bring (?:me|us) (?:back )?to|get (?:me|us) to|go (?:back |over )?to|going to go to|navigate to|switch (?:over )?to|jump (?:over )?to|head (?:over |back )?to|open(?: up)?|show(?: me| us)?|pull up|bring up|back to|i want to see|i'?d like to see|let me see|where(?:'s| is| are)(?: my| the)?)\s+(.+)$/i;
  const LEAD_MAX = 8;
  const LEAD_OK = /^(?:(?:hey|hi|ok|okay|alright|all right|right|so|um|uh|hmm|now|then|please|can|could|would|will|you|meridian|let'?s|lets|i|i'?d|want|wanna|like|to|just|go|ahead|and|quickly|real|quick|actually|yeah|yes|cool|great|thanks|thank)\s*)+$/i;   // at most this many words before the phrase, so "can you show me how to…" style questions stay with the AI
  const FILLER = /\b(the|my|our|a|an|please|page|tab|section|screen|view|for me|now|up|real quick|quickly|thanks|thank you)\b/gi;
  const extra = [];   // registered destinations
  let cache = { at: 0, projects: [], boards: {} };

  const norm = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  const squash = (s) => norm(s).replace(/\s+/g, '');
  const words = (s) => norm(s).split(' ').filter((w) => w.length > 1);

  // how well does `name` appear in `text` (0..1)
  function score(text, name) {
    const t = norm(text), n = norm(name);
    if (!n) return 0;
    if ((' ' + t + ' ').includes(' ' + n + ' ')) return 1;
    if (squash(t).includes(squash(n)) && squash(n).length >= 4) return 0.92;
    const tw = words(t).filter((w) => w.length > 2), nw = words(n).filter((w) => w.length > 2);
    if (!nw.length || !tw.length) return 0;
    const near = (a, b) => a === b || (a.length > 3 && b.length > 3 && (a.startsWith(b) || b.startsWith(a)));
    const nameCovered = nw.filter((w) => tw.some((x) => near(w, x))).length / nw.length;   // all of the name was said
    const saidCovered = tw.filter((w) => nw.some((x) => near(w, x))).length / tw.length;   // everything said is in the name
    return Math.max(nameCovered * 0.85, tw.some((w) => w.length > 3) ? saidCovered * 0.8 : 0);
  }

  function pages() {
    const out = [];
    document.querySelectorAll('.nav-link[data-view]').forEach((b) => {
      if (getComputedStyle(b).display === 'none') return;   // hidden pages are not destinations
      const label = (b.getAttribute('aria-label') || b.textContent || '').replace(/\d+/g, ' ').trim();
      const aliases = (b.dataset.navAliases || '').split(',').map((x) => x.trim()).filter(Boolean);
      const view = b.dataset.view;
      out.push({ id: 'page:' + view, label, names: [label, view].concat(aliases).concat(DEFAULT_ALIASES[view] || []),
        go: () => { if (typeof switchView === 'function') switchView(view); else b.click(); } });
    });
    return out.concat(extra.map((x) => ({ id: x.id, label: x.label, names: [x.label].concat(x.aliases || []), go: x.go })));
  }
  // Friendly words people say for the pages that exist today; harmless if a page is removed.
  const DEFAULT_ALIASES = { overview: ['home', 'dashboard', 'start'], tasks: ['my tasks', 'to do', 'todo', 'to-do list'],
    messages: ['messages', 'inbox', 'chat with jax', 'dms', 'channels'], chat: ['meridian', 'meridian ai', 'ai chat'],
    projects: ['projects', 'project list'], send: ['send to jax'], tools: ['tools', 'services'] };

  function tabs() {
    const ws = window.meridianWorkspace;
    const list = ws && typeof ws.tabs === 'function' ? ws.tabs() : [];
    const syn = { storyboards: ['storyboard', 'story board', 'boards'], files: ['file', 'documents', 'docs'], tasks: ['task', 'to dos'],
      notes: ['note'], deliverables: ['deliverable', 'drafts'], toolkit: ['tools', 'tool kit'], ai: ['meridian', 'ai', 'assistant'], overview: ['summary'] };
    return list.map(([id, label]) => ({ id, label, names: [label, id].concat(syn[id] || []) }));
  }

  async function projects() {
    if (Date.now() - cache.at < 60000 && cache.projects.length) return cache.projects;
    const r = await window.meridian.api.getProjects();
    cache.projects = (r && r.success && r.data) || []; cache.at = Date.now();
    return cache.projects;
  }
  async function boards(pid) {
    const c = cache.boards[pid];
    if (c && Date.now() - c.at < 60000) return c.list;
    const r = await window.meridian.api.ws('GET', `/api/projects/${pid}/storyboards`);
    const list = (r && r.success && r.storyboards) || [];
    cache.boards[pid] = { at: Date.now(), list };
    return list;
  }

  const best = (items, text, min) => {
    let top = null, s = 0;
    items.forEach((it) => { const v = Math.max(...it.names.map((n) => score(text, n))); if (v > s) { s = v; top = it; } });
    return s >= min ? top : null;
  };

  async function openProject(pid, tab, boardId) {
    if (typeof switchView === 'function') switchView('projects');
    document.dispatchEvent(new Event('bv-pick'));
    const ws = window.meridianWorkspace;
    if (!ws) return;
    if (tab && typeof ws.openTab === 'function') await ws.openTab(pid, tab, boardId);
    else await ws.open(pid);
  }

  /** Returns a short reply ("Opening Roof Co, Storyboards.") if the text was a navigation request, else null. */
  async function handle(text) {
    const said = String(text || '').trim().replace(/[.!?]+$/, '');
    const m = said.match(VERB);
    if (!m) return null;
    const lead = said.slice(0, m.index).replace(/[,.!?]/g, ' ').trim();
    if (lead && (lead.split(/\s+/).length > LEAD_MAX || !LEAD_OK.test(lead))) return null;   // "write a caption and show me…" is a task, not a trip
    if (/^(how|what|why|when|who|which)\b/i.test(m[1].trim())) return null;   // "show me how to…" is a question
    const target = m[1].replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
    if (!target) return null;
    let projs = [];
    try { projs = await projects(); } catch (e) { projs = []; }
    const proj = best(projs.map((p) => ({ id: p.id, label: p.name, names: [p.name, p.client || ''].filter(Boolean), p })), target, 0.6);
    const withoutProj = proj ? norm(target).replace(new RegExp('\\b(' + words(proj.label).join('|') + ')\\b', 'g'), ' ') : target;
    const tab = best(tabs(), withoutProj, 0.75);
    if (proj) {
      // a named storyboard inside the project?
      if (tab && tab.id === 'storyboards') {
        try {
          const rest = norm(target).replace(new RegExp('\\b(' + words(proj.label).concat(['storyboards?', 'story', 'boards?']).join('|') + ')\\b', 'g'), ' ').trim();
          if (rest.length > 2) {
            const b = best((await boards(proj.id)).map((x) => ({ id: x.id, label: x.title, names: [x.title] })), rest, 0.6);
            if (b) { await openProject(proj.id, 'storyboards', b.id); return `Opening the ${b.label} storyboard.`; }
          }
        } catch (e) { /* fall back to the tab */ }
      }
      await openProject(proj.id, tab ? tab.id : null);
      return tab ? `Opening ${proj.label}, ${tab.label}.` : `Opening ${proj.label}.`;
    }
    // a storyboard by name in any project ("open the spring special storyboard")
    if (/\bstory ?boards?\b/i.test(target)) {
      const name = norm(target).replace(/\bstory ?boards?\b/g, ' ').trim();
      if (name.length > 2) {
        for (const p of projs) {
          try {
            const b = best((await boards(p.id)).map((x) => ({ id: x.id, label: x.title, names: [x.title] })), name, 0.65);
            if (b) { await openProject(p.id, 'storyboards', b.id); return `Opening the ${b.label} storyboard in ${p.name}.`; }
          } catch (e) { /* keep looking */ }
        }
      }
    }
    const page = best(pages(), target, 0.75);
    if (page) { page.go(); return `Opening ${page.label}.`; }
    // a tab without a project: use the project that's open
    if (tab && window.meridianWorkspace && typeof window.meridianWorkspace.current === 'function' && window.meridianWorkspace.current()) {
      const pid = window.meridianWorkspace.current();
      await openProject(pid, tab.id);
      return `Opening ${tab.label}.`;
    }
    return null;   // not something we can navigate to: let Meridian answer
  }

  window.meridianNav = {
    handle,
    register(dest) { if (dest && dest.id && dest.go) { const i = extra.findIndex((x) => x.id === dest.id); if (i >= 0) extra.splice(i, 1); extra.push(dest); } },
    unregister(id) { const i = extra.findIndex((x) => x.id === id); if (i >= 0) extra.splice(i, 1); },
    destinations: () => ({ pages: pages().map((p) => p.label), tabs: tabs().map((t) => t.label) }),
    refresh() { cache = { at: 0, projects: [], boards: {} }; }
  };
})();
