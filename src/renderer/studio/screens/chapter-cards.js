'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianStudio.registerTool('chapter-cards', { mountCanvas: api.mountCanvas });
})(typeof window === 'undefined' ? null : window, function () {
  // Chapter cards board (#188): pages on the left, the selected page's chapters in the middle, gaps on the right.
  const STAGES = Object.freeze(['plan', 'words', 'storyboard', 'look']);
  const STAGE_NAMES = Object.freeze({ plan: 'Story and sitemap', words: 'Words', storyboard: 'Storyboard', look: 'Look and assets' });
  const cards = () => (typeof window !== 'undefined' && window.MeridianChapterCards) || require('../website/chapter-cards.js');
  const blankChapter = () => ({ name: '', job: '', words: { headline: '', body: '', button: '' }, layout: '', motion: '', phone: '', shots: [], proof: [] });
  const chapterName = (c, i) => c.name || `Chapter ${i + 1}`;

  function createBoard({ service, spaceId, jobId, stageId, report, onDirty = () => {} }) {
    let disposed = false, revision = 0, story = null, job = null, gaps = [], assets = [], busy = false, dirty = false, page = 0, open = 0;
    let draft = null, drafting = false, draftTurn = 0;   // Meridian's proposal for the open chapter (Words); never saved by itself
    const setDirty = value => { if (value !== dirty) { dirty = value; onDirty(value); } };
    const locked = () => !!job && (job.finished || job.stages.some(st => st.id === 'look' && st.status === 'done'));
    const show = (error = '', message = '') => report({ state: 'ready', stageId, story, gaps, assets, page, open, busy, dirty, error, message, draft, drafting,
      locked: locked(), tier: job.tier, structure: stageId === 'plan' && !locked() });
    async function load() {
      if (disposed) return;
      const request = ++revision; if (!story) report({ state: 'loading' });
      if (!STAGES.includes(stageId)) { report({ state: 'empty', message: 'Open a Website story stage to work on the chapter cards.' }); return; }
      try {
        const [nextJob, nextStory, nextGaps, list] = await Promise.all([service.getJob(spaceId, jobId), service.getStory(spaceId, jobId),
          service.getStoryGaps(spaceId, jobId, stageId), stageId === 'look' ? service.listAssets(spaceId) : []]);
        if (disposed || request !== revision) return;
        if (nextJob?.id !== jobId || nextJob.spaceId !== spaceId) throw Error('Unavailable');
        // Only this Space's kept assets can fill a shot.
        job = nextJob; story = nextStory; gaps = Array.isArray(nextGaps) ? nextGaps : [];
        assets = (Array.isArray(list) ? list : []).filter(a => a && a.spaceId === spaceId && a.kept && !a.trashed);
        page = Math.min(page, Math.max(story.pages.length - 1, 0)); setDirty(false); show();
      } catch (error) {
        if (!disposed && request === revision) report({ state: 'failed', message: /only website|coming soon/i.test(error?.message || '')
          ? error.message : 'Unable to open the chapter cards. Check your connection and access, then try again.' });
      }
    }
    // Structure (pages and chapter order) is Story and sitemap work; later stages fill the cards in.
    const change = (fn, needsStructure = true) => {
      if (disposed || busy || !story || locked() || (needsStructure && stageId !== 'plan')) return false;
      fn(); setDirty(true); show(); return true;
    };
    const chapters = () => story.pages[page]?.chapters || [];
    return { load,
      selectPage: i => { if (story?.pages[i]) { page = i; open = 0; draft = null; draftTurn++; show(); } },
      openChapter: i => { if (chapters()[i]) { open = i; draft = null; draftTurn++; show(); } },
      // Draft with Meridian (Words): uses the page and chapter as they are on screen, even unsaved.
      async draft() {
        const c = chapters()[open];
        if (disposed || busy || drafting || stageId !== 'words' || locked() || !c) return;
        const turn = ++draftTurn; drafting = true; draft = null; show();
        try {
          const result = await service.draftChapter(spaceId, jobId, { page: story.pages[page].name, name: c.name, job: c.job });
          if (disposed || turn !== draftTurn) return;   // another chapter was opened meanwhile
          const d = result?.draft || {}, str = v => typeof v === 'string' ? v : '';
          drafting = false; draft = { headline: str(d.headline), body: str(d.body), button: str(d.button) }; show();
        } catch (error) { if (!disposed && turn === draftTurn) { drafting = false; show(error?.message || 'Meridian couldn\'t draft this. Try again.'); } }
      },
      useDraft() {
        const c = chapters()[open];
        if (disposed || !draft || !c || locked()) return false;
        c.words = { ...c.words, ...draft }; draft = null; setDirty(true); show(); return true;
      },
      discardDraft() { if (draft) { draft = null; show(); } },
      addPage: () => change(() => { story.pages.push({ name: '', path: '', purpose: '', chapters: [] }); page = story.pages.length - 1; open = 0; }),
      removePage: i => story?.pages[i]?.path !== '/' && change(() => { story.pages.splice(i, 1); page = Math.min(page, story.pages.length - 1); }),
      addChapter: () => change(() => { chapters().push(blankChapter()); open = chapters().length - 1; }),
      removeChapter: i => change(() => { chapters().splice(i, 1); open = Math.max(0, Math.min(open, chapters().length - 1)); }),
      moveChapter: (i, by) => change(() => {
        const list = chapters(), to = i + by; if (to < 0 || to >= list.length) return;
        [list[i], list[to]] = [list[to], list[i]]; open = to;
      }),
      addItem: (key, item) => change(() => chapters()[open][key].push(item), false),
      removeItem: (key, index) => change(() => chapters()[open][key].splice(index, 1), false),
      // Typing changes the draft without a redraw, so focus stays put.
      edit(target, value) { if (disposed || busy || !story || locked()) return false; target(value); setDirty(true); return true; },
      // "Home · Hero · Crew photo" -> that page and chapter.
      openGap(gap) {
        if (!story) return false;
        const [pageName, chapter] = String(gap?.where || '').split(' · ');
        const p = story.pages.findIndex(pg => (pg.name || 'Untitled page') === pageName);
        if (p < 0) return false;
        const c = story.pages[p].chapters.findIndex((ch, i) => chapterName(ch, i) === chapter);
        page = p; open = Math.max(c, 0); show(); return true;
      },
      async save() {
        if (disposed || busy || !story || locked()) return;
        busy = true; show();
        try {
          const result = await service.saveStory(spaceId, jobId, story);
          if (disposed) return;
          story = result.story; gaps = result.gaps || []; busy = false; setDirty(false); show('', 'Saved.');
        } catch (error) { if (!disposed) { busy = false; show(error?.message || 'Unable to save. Try again.'); } }
      },
      dispose() { disposed = true; revision++; setDirty(false); },
      isDirty: () => dirty,
    };
  }

  function mountCanvas(el, ctx) {
    const studio = ctx.studio || {}, doc = el.ownerDocument, root = doc.createElement('section');
    root.className = 'studio-chapter-cards'; root.setAttribute('aria-label', 'Chapter cards'); el.replaceChildren(root);
    const states = doc.defaultView?.MeridianStudioScreenStates || require('./home.js').screenStates;
    const focus = states.focus(root), C = cards();
    let listeners = [];
    const listen = (item, type, fn) => { item.addEventListener(type, fn); listeners.push([item, type, fn]); };
    const unlisten = () => { for (const [item, type, fn] of listeners) item.removeEventListener?.(type, fn); listeners = []; };
    function node(tag, text, className) {
      const item = doc.createElement(tag); if (text) item.textContent = text;
      if (className) item.className = className; return item;
    }
    function button(text, action, opts = {}) {
      const item = node('button', text, `studio-button ${opts.primary ? 'is-primary' : 'is-secondary'}`); item.type = 'button';
      item.disabled = !!opts.disabled; if (opts.label) item.setAttribute('aria-label', opts.label);
      if (opts.pressed !== undefined) item.setAttribute('aria-pressed', String(opts.pressed));
      listen(item, 'click', action); return item;
    }
    // One labelled field; read-only fields show as text so earlier stages can't be changed here.
    function field(label, value, set, { editable, long, options } = {}) {
      const wrap = node('label', '', 'studio-chapter-field');
      if (!editable) { wrap.append(node('span', label), node('p', value || '–', 'studio-chapter-readonly')); return wrap; }
      const input = node(options ? 'select' : long ? 'textarea' : 'input');
      if (options) for (const [v, t] of [['', 'Choose…'], ...options.map(o => Array.isArray(o) ? o : [o, o])]) { const o = node('option', t); o.value = v; input.appendChild(o); }
      input.value = value || ''; input.disabled = view.locked || view.busy;
      listen(input, options ? 'change' : 'input', () => model.edit(set, input.value));
      wrap.append(node('span', label), input); return wrap;
    }
    let view = {}, focusTo = null, focusOn = null, hadDraft = false;   // focus: to the draft when it appears, back to the button after
    function editor(c) {
      const at = STAGES.indexOf(view.stageId), can = s => STAGES.indexOf(s) === at, seen = s => STAGES.indexOf(s) <= at;
      const box = node('div', '', 'studio-card studio-chapter-editor'), standard = view.tier !== 'cinematic';
      box.append(node('h3', `Editing: ${chapterName(c, view.open)}`),
        field('Chapter name', c.name, v => { c.name = v; }, { editable: can('plan') }),
        field('Its one job', c.job, v => { c.job = v; }, { editable: can('plan'), long: true }));
      if (seen('words')) {
        box.append(field('Headline', c.words.headline, v => { c.words.headline = v; }, { editable: can('words') }),
          field('Body', c.words.body, v => { c.words.body = v; }, { editable: can('words'), long: true }),
          field('Button text', c.words.button, v => { c.words.button = v; }, { editable: can('words') }));
        if (can('words') && !view.locked && !view.busy) {
          const ask = button(view.drafting ? 'Drafting…' : 'Draft with Meridian', () => void model.draft(), { disabled: view.drafting });
          box.appendChild(ask); if (focusTo === 'ask') focusOn = ask;
        }
        if (can('words') && view.draft) {
          const offer = node('div', '', 'studio-card studio-chapter-draft'); offer.tabIndex = -1;
          offer.setAttribute('role', 'region'); offer.setAttribute('aria-label', 'Meridian\'s draft');
          const list = node('dl');
          for (const [label, value] of [['Headline', view.draft.headline], ['Body', view.draft.body], ['Button text', view.draft.button]]) list.append(node('dt', label), node('dd', value || '–'));
          offer.append(node('h4', 'Meridian suggests'), list,
            button('Use this', () => { focusTo = 'ask'; model.useDraft(); }, { primary: true }),
            button('Discard', () => { focusTo = 'ask'; model.discardDraft(); }));
          box.appendChild(offer); if (focusTo === 'draft') focusOn = offer;
        }
      }
      if (seen('storyboard')) {
        const sb = can('storyboard');
        box.append(field('Layout', c.layout, v => { c.layout = v; }, { editable: sb, options: C.LAYOUTS }),
          field('Motion', c.motion, v => { c.motion = v; }, { editable: sb, options: standard ? ['none'] : C.MOTION }),
          field('Phone note', c.phone, v => { c.phone = v; }, { editable: sb, long: true }));
        c.shots.forEach((s, k) => {
          const shot = node('fieldset', '', 'studio-chapter-group'); shot.appendChild(node('legend', `Shot ${k + 1}`));
          shot.append(field('What it shows', s.what, v => { s.what = v; }, { editable: sb }),
            field('Prompt', s.prompt, v => { s.prompt = v; }, { editable: sb, long: true }),
            field('Size', s.size, v => { s.size = v; }, { editable: sb, options: C.SIZES }),
            field('Tool', s.tool, v => { s.tool = v; }, { editable: sb, options: standard ? ['image'] : C.SHOT_TOOLS }));
          if (seen('look')) {
            shot.appendChild(field('Kept asset', s.assetId, v => { s.assetId = v || null; },
              { editable: can('look'), options: view.assets.map(a => [a.id, a.name || a.id]) }));
          }
          if (sb) shot.appendChild(button('Remove shot', () => model.removeItem('shots', k), { disabled: view.locked, label: `Remove shot ${k + 1}` }));
          box.appendChild(shot);
        });
        if (sb) box.appendChild(button('Add shot', () => model.addItem('shots', { what: '', prompt: '', size: '', tool: '', assetId: null }), { disabled: view.locked }));
        c.proof.forEach((p, k) => {
          const proof = node('fieldset', '', 'studio-chapter-group'); proof.appendChild(node('legend', `Proof ${k + 1}`));
          proof.append(field('Claim', p.claim, v => { p.claim = v; }, { editable: sb }), field('Source', p.source, v => { p.source = v; }, { editable: sb }));
          if (sb) proof.appendChild(button('Remove proof', () => model.removeItem('proof', k), { disabled: view.locked, label: `Remove proof ${k + 1}` }));
          box.appendChild(proof);
        });
        if (sb) box.appendChild(button('Add proof', () => model.addItem('proof', { claim: '', source: '' }), { disabled: view.locked }));
      }
      return box;
    }
    const model = createBoard({ service: studio.service, spaceId: ctx.spaceId, jobId: ctx.jobId, stageId: ctx.stageId,
      onDirty: value => studio.setDirty?.(value),
      report(next) {
        view = next; unlisten(); const restore = focus(); focusOn = null;
        if (next.draft && !hadDraft) focusTo = 'draft';
        hadDraft = !!next.draft;
        root.setAttribute('aria-busy', String(next.state === 'loading' || !!next.busy));
        const title = node('h2', `Chapter cards: ${STAGE_NAMES[next.stageId] || 'Website'}`);
        if (next.state !== 'ready') {
          root.replaceChildren(title, states.panel(doc, next.state, next.state === 'loading' ? 'Loading chapter cards…' : next.message, () => void model.load()));
          restore(); return;
        }
        const pages = node('nav', '', 'studio-card studio-chapter-pages'); pages.setAttribute('aria-label', 'Pages');
        pages.appendChild(node('h3', 'Pages'));
        next.story.pages.forEach((p, i) => pages.appendChild(button(`${p.name || 'Untitled page'} ${p.path || ''}`.trim(), () => model.selectPage(i), { pressed: i === next.page })));
        const current = next.story.pages[next.page];
        if (next.structure) {
          pages.appendChild(button('Add page', () => model.addPage()));
          if (current) {
            pages.append(field('Page name', current.name, v => { current.name = v; }, { editable: true }),
              field('Path', current.path, v => { current.path = v; }, { editable: true }),
              field('What the page is for', current.purpose, v => { current.purpose = v; }, { editable: true, long: true }));
            if (current.path !== '/') pages.appendChild(button('Remove page', () => model.removePage(next.page), { label: `Remove page ${current.name || 'Untitled page'}` }));
          }
        } else if (current) pages.appendChild(node('p', current.purpose || '', 'studio-chapter-readonly'));
        const middle = node('div', '', 'studio-chapter-middle'), list = node('ol', '', 'studio-chapter-list');
        const withGaps = new Set(next.gaps.map(g => g.where.split(' · ').slice(0, 2).join(' · ')));
        (current?.chapters || []).forEach((c, i) => {
          const li = node('li', '', `studio-card${i === next.open ? ' is-open' : ''}`);
          li.appendChild(button(chapterName(c, i), () => model.openChapter(i), { pressed: i === next.open }));
          if (withGaps.has(`${current.name || 'Untitled page'} · ${chapterName(c, i)}`)) li.appendChild(node('span', 'Needs work', 'studio-chip is-gap'));
          if (next.structure) {
            const n = chapterName(c, i);
            li.append(button('Up', () => model.moveChapter(i, -1), { disabled: i === 0, label: `Move ${n} up` }),
              button('Down', () => model.moveChapter(i, 1), { disabled: i === current.chapters.length - 1, label: `Move ${n} down` }),
              button('Remove', () => model.removeChapter(i), { label: `Remove ${n}` }));
          }
          list.appendChild(li);
        });
        middle.append(node('h3', current ? `Chapters on ${current.name || 'Untitled page'}` : 'Chapters'), list);
        if (next.structure && current) middle.appendChild(button('Add chapter', () => model.addChapter()));
        if (current?.chapters[next.open]) middle.appendChild(editor(current.chapters[next.open]));
        const side = node('aside', '', 'studio-card studio-chapter-gaps'); side.setAttribute('aria-label', 'What\'s left');
        side.appendChild(node('h3', 'What\'s left before this stage is done'));
        if (!next.gaps.length) side.appendChild(node('p', 'Ready: mark the stage done', 'studio-chip is-ready'));
        else { const ul = node('ul'); for (const g of next.gaps) { const li = node('li'); li.appendChild(button(`${g.where}: ${g.message}`, () => model.openGap(g))); ul.appendChild(li); } side.appendChild(ul); }
        const bar = node('div', '', 'studio-chapter-bar');
        bar.appendChild(button(next.busy ? 'Saving…' : 'Save cards', () => void model.save(), { primary: true, disabled: next.busy || next.locked }));
        if (next.dirty) bar.appendChild(node('span', 'Unsaved changes', 'studio-chip'));
        if (next.locked) bar.appendChild(node('p', 'The chapter cards are locked: Look and assets is done.'));
        if (next.message) { const m = node('p', next.message); m.setAttribute('role', 'status'); bar.appendChild(m); }
        if (next.error) { const e = node('p', next.error); e.setAttribute('role', 'alert'); bar.appendChild(e); }
        const body = node('div', '', 'studio-chapter-body'); body.append(pages, middle, side);
        root.replaceChildren(title, bar, body);
        if (focusOn) { focusOn.focus?.(); focusTo = null; } else restore();
      } });
    const off = studio.service.on((event, detail) => {
      if (['story-changed', 'jobs-changed'].includes(event) && detail?.spaceId === ctx.spaceId && !model.isDirty()) void model.load();
    });
    void model.load(); return () => { off(); model.dispose(); unlisten(); root.remove(); };
  }
  return { createBoard, mountCanvas };
});
