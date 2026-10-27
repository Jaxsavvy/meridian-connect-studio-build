'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianStudio.registerTool('homepage-builder', { mountCanvas: api.mountCanvas });
})(typeof window === 'undefined' ? null : window, function () {
  // Home page builder (Pitch deck): one home page per tier stage, each a clear step up from the last.
  const TIERS = Object.freeze({ 'home-t1': 1, 'home-t2': 2, 'home-t3': 3 });
  const SAMPLE_SERVICES = Object.freeze(['Repairs', 'New installs', 'Seasonal maintenance']);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[ch]);
  const color = (value, fallback) => /^#[0-9a-f]{3,8}$/i.test(String(value)) ? value : fallback;
  const font = (value, fallback) => typeof value === 'string' && /^[A-Za-z0-9 -]{1,40}$/.test(value) ? value : fallback;
  const failureText = error => error?.code === 'OFFLINE' ? 'You are offline. Try again when connected.'
    : error?.message || 'The home page builder could not finish. Try again.';

  // Niche styles (#145): section order, hero, motion and tokens per trade and tier. Lane files load in no fixed order.
  const styles = () => (typeof window !== 'undefined' && window.MeridianNicheStyles) || require('./niche-styles.js');
  const STYLE_NAMES = Object.freeze([['roofer', 'Roofer'], ['hvac', 'HVAC'], ['remodeler', 'Remodeler'], ['general', 'General']]);
  // Template words for each trade section (never prices or money); the business name is escaped where it appears.
  const TRADE = Object.freeze({
    inspection: ['Free roof inspection', 'We check every shingle, flashing and gutter, then show you photos of what we found.'],
    'storm-damage': ['Storm damage help', 'Hail or wind damage? We document it and walk you through the next steps.'],
    'same-day-banner': ['Same-day service', 'No heat or no cooling? Call before noon and we aim to be there today.'],
    'seasonal-tune-up': ['Seasonal tune-ups', 'A spring and fall check keeps your system running quietly all year.'],
    'before-after': ['Before and after', 'See the difference on real projects.'],
    'project-gallery': ['Recent projects', 'Kitchens, baths and whole-home updates.'],
    'project-photos': ['Project photos', 'Roofs we have finished nearby.'],
    'service-checklist': ['What every visit includes', 'A full system check, a clear report and a clean workspace.'],
    'process-steps': ['How it works', 'Tell us what you need, get a clear plan, and we do the work.'],
    'why-us': ['Why choose us', 'Clear plans, tidy work and answers when you call.'],
  });
  const PHOTOS = new Set(['before-after', 'project-gallery', 'project-photos']);
  const tiles = labels => `<div class="tiles">${labels.map(l => `<div class="tile" role="img" aria-label="${l}">${l}</div>`).join('')}</div>`;

  /** One home page as an HTML string, built from the niche style. Every piece of project text is escaped;
   *  Project DNA colors and fonts win over the niche's when the project has them. */
  function buildPage({ tier, name, headline, dna, niche }) {
    dna = dna && typeof dna === 'object' ? dna : {};
    const style = styles().nicheStyle(niche, tier), tk = style.tokens;
    const ink = color(dna.colors?.[0], tk.colors.ink), accent = color(dna.colors?.[1], tk.colors.accent), surface = tk.colors.surface;
    const display = font(dna.fonts?.[0], tk.fonts.display), body = font(dna.fonts?.[1], tk.fonts.body);
    const services = (Array.isArray(dna.services) && dna.services.length ? dna.services : SAMPLE_SERVICES).slice(0, 6);
    const who = escape(name), cta = tier === 1 ? 'Call us today' : 'Book a visit';
    const audience = typeof dna.audience === 'string' ? dna.audience.trim() : '';
    const intro = escape(audience ? `Trusted by ${audience.toLowerCase()}.` : 'Local, licensed and on time.');
    const items = services.map(s => tier === 1 ? `<li>${escape(s)}</li>`
      : `<li class="card"><h3>${escape(s)}</h3><p>Done right, explained in plain words.</p></li>`).join('');
    const hero = `<section class="hero hero-${style.heroKind} reveal"><div><h1>${escape(headline || name)}</h1><p>${intro}</p>`
      + `<a class="cta" href="#contact">${cta}</a></div>${style.heroKind === 'photo-split' ? tiles(['Project photo'])
        : style.heroKind === 'before-after' ? tiles(['Before', 'After']) : ''}</section>`;
    const SECTIONS = {
      header: () => `<header><strong>${who}</strong><a class="cta" href="#contact">${cta}</a></header>`,
      hero: () => hero,
      'video-hero': () => `<div class="video" role="img" aria-label="Video moment">Video moment</div>${hero}`,
      services: () => `<section class="services reveal"><h2>What we do</h2><ul>${items}</ul></section>`,
      story: () => `<section class="story reveal"><h2>Why neighbors choose ${who}</h2><ol><li>Tell us what you need</li>`
        + '<li>Get a clear plan</li><li>We do the work and clean up</li></ol></section>',
      'video-moments': () => '<section class="moments reveal"><h2>See the work</h2><div class="video small" role="img" aria-label="Project video">Project video</div></section>',
      contact: () => `<section id="contact" class="contact reveal"><h2>Get in touch</h2><p>Call or message ${who} for a free estimate.</p></section>`,
      booking: () => '<section id="contact" class="booking reveal"><h2>Book a visit</h2><form><label>Name <input></label><label>Phone <input></label>'
        + '<label>Best day <input></label><button type="button">Request a time</button></form></section>',
      footer: () => '',
    };
    const section = kind => SECTIONS[kind] ? SECTIONS[kind]() : TRADE[kind]
      ? `<section class="trade ${kind} reveal"><h2>${TRADE[kind][0]}</h2><p>${TRADE[kind][1]}</p>${PHOTOS.has(kind) ? tiles(['Photo', 'Photo', 'Photo']) : ''}</section>` : '';
    // Scroll motion driven by the browser, so nothing stays hidden in a capture or where it isn't supported.
    const motion = style.motion ? '@keyframes rise{from{opacity:.15;transform:translateY(32px)}}@media (prefers-reduced-motion: no-preference){'
      + '@supports (animation-timeline: view()){.reveal{animation:rise linear both;animation-timeline:view();animation-range:entry 0% cover 35%}}}' : '';
    const sp = tk.spacing;
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
      + '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'">'
      + `<title>${who}</title><style>body{margin:0;font-family:"${body}",sans-serif;color:${ink};background:#fff}`
      + `h1,h2,h3{font-family:"${display}",serif}header{display:flex;justify-content:space-between;align-items:center;padding:1rem 5vw}`
      + `section{padding:${sp.section} 5vw}.hero{display:grid;grid-template-columns:repeat(auto-fit,minmax(16rem,1fr));gap:2rem;align-items:center;`
      + `background:${tier === 1 ? surface : ink};color:${tier === 1 ? ink : '#fff'}}.trade:nth-of-type(odd){background:${surface}}`
      + `.hero h1{font-size:${sp.hero};margin:0 0 .5rem}.cta,button{display:inline-block;padding:.7rem 1.2rem;`
      + `background:${accent};color:#fff;border:0;border-radius:${sp.radius};text-decoration:none;font:inherit}`
      + 'ul{display:grid;grid-template-columns:repeat(auto-fit,minmax(12rem,1fr));gap:1rem;padding:0;list-style-position:inside}'
      + `.card{list-style:none;padding:1rem;border:1px solid #dde3ea;border-radius:${sp.radius}}form{display:grid;gap:.75rem;max-width:24rem}`
      + 'label{display:grid;gap:.25rem}input{padding:.5rem;font:inherit}'
      + `.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr));gap:.75rem}.tile{display:grid;place-items:center;min-height:9rem;`
      + `border-radius:${sp.radius};background:linear-gradient(135deg,${accent},${ink});color:#fff;opacity:.9}`
      + `.video{display:grid;place-items:center;min-height:16rem;background:linear-gradient(135deg,${ink},${accent});color:#fff}`
      + `.video.small{min-height:10rem;border-radius:${sp.radius}}${motion}footer{padding:1.5rem 5vw;font-size:.85rem;color:#5b6573}</style></head>`
      + `<body data-tier="${tier}" data-niche="${style.niche}">${style.sections.map(section).join('')}`
      + `<footer><p class="concept">Concept for discussion, not affiliated with ${who}</p></footer></body></html>`;
  }

  function createBuilder({ service, spaceId, jobId, stageId, report, onDirty = () => {} }) {
    const tier = TIERS[stageId] || 0;
    let disposed = false, revision = 0, space = null, stage = null, headline = '', proposal = '', busy = false, dirty = false, kept = 0, niche = 'general';
    const page = () => buildPage({ tier, name: space.name, headline, dna: space.dna, niche });
    const setDirty = value => { if (value !== dirty) { dirty = value; onDirty(value); } };
    function show(error = '') {
      report({ state: 'ready', tier, name: space.name, headline, proposal, busy, error, kept, niche,
        open: stage.status === 'current', done: stage.status === 'done', html: page() });
    }
    async function load() {
      if (disposed || busy) return;
      const request = ++revision; report({ state: 'loading' });
      if (!tier) { report({ state: 'empty', message: 'Open a home page stage to build its page.' }); return; }
      try {
        const [nextSpace, job] = await Promise.all([service.getSpace(spaceId), service.getJob(spaceId, jobId)]);
        if (disposed || request !== revision) return;
        if (nextSpace?.id !== spaceId || job?.id !== jobId || job.spaceId !== spaceId) throw Error('This Job is unavailable.');
        stage = job.stages.find(item => item.id === stageId);
        if (!stage) { report({ state: 'empty', message: 'This Job has no home page stage for this tier.' }); return; }
        // The style starts from the research category (e.g. "roofer"); research that can't be read means General.
        let category = '';
        try { category = (await service.getResearch(spaceId, jobId))?.category || ''; } catch (_) { /* General */ }
        if (disposed || request !== revision) return;
        niche = styles().nicheOf(category);
        space = nextSpace; headline = headline || space.name; show();
      } catch (error) {
        if (disposed || request !== revision) return;
        report(error?.code === 'OFFLINE' ? { state: 'offline', message: failureText(error) }
          : { state: 'failed', message: 'Unable to open this home page. Check your connection and access, then try again.' });
      }
    }
    async function act(work) {
      if (disposed || busy || !space) return;
      busy = true; show();
      try { await work(); if (!disposed) { busy = false; show(); } } catch (error) { if (!disposed) { busy = false; show(failureText(error)); } }
    }
    return { load,
      edit(value) {
        if (disposed || busy || !space || !stage || stage.status !== 'current') return false;
        headline = String(value).slice(0, 120); setDirty(true); show(); return true;
      },
      draft: () => act(async () => {
        const result = await service.draftCopy({ spaceId, kind: 'headline', input: { heading: space.name } });
        if (!disposed) proposal = typeof result?.draft === 'string' ? result.draft.slice(0, 120) : '';
      }),
      setNiche(value) {
        if (disposed || busy || !space || !STYLE_NAMES.some(([id]) => id === value)) return false;
        niche = value; show(); return true;
      },
      accept() { if (disposed || busy || !proposal) return; headline = proposal; proposal = ''; setDirty(true); show(); },
      dismiss() { if (disposed || busy) return; proposal = ''; show(); },
      // Finish: save the page into the project folder first, then complete this tier only.
      // Keep: save the page as a kept asset in this stage; keeping again makes the next version.
      keep: () => act(async () => {
        if (stage.status !== 'current') throw Error('This home page stage isn\'t open.');
        const asset = await service.savePageAsset(spaceId, jobId, stageId, { name: `Home page Tier ${tier}`, html: page() });
        if (!asset || asset.jobId !== jobId || asset.stageId !== stageId) throw Error('Could not keep this page. Try again.');
        kept = Number(asset.version) || kept + 1; setDirty(false);
      }),
      finish: () => act(async () => {
        if (stage.status !== 'current') throw Error('This home page stage isn\'t open.');
        const saved = await service.saveToProjectFiles(spaceId, jobId, [{ name: `Home page Tier ${tier}.html`, content: page() }]);
        if (!saved || (saved.failed && saved.failed.length)) throw Error('Could not save the page to the project folder. Try again.');
        const job = await service.completeStage(spaceId, jobId, stageId);
        stage = job.stages.find(item => item.id === stageId) || stage; setDirty(false);
      }),
      dispose() { disposed = true; revision++; setDirty(false); },
    };
  }

  function mountCanvas(el, ctx) {
    const studio = ctx.studio || {}, doc = el.ownerDocument, root = doc.createElement('section');
    root.className = 'studio-homepage-builder'; root.setAttribute('aria-label', 'Home page builder'); el.replaceChildren(root);
    const states = doc.defaultView?.MeridianStudioScreenStates || require('../../screens/home.js').screenStates;
    let listeners = [];
    const listen = (item, type, fn) => { item.addEventListener(type, fn); listeners.push([item, type, fn]); };
    const unlisten = () => { for (const [item, type, fn] of listeners) item.removeEventListener?.(type, fn); listeners = []; };
    function node(tag, text, className) {
      const item = doc.createElement(tag); if (text) item.textContent = text;
      if (className) item.className = className; return item;
    }
    function button(text, action, primary, disabled) {
      const item = node('button', text, `studio-button ${primary ? 'is-primary' : 'is-secondary'}`);
      item.type = 'button'; item.disabled = !!disabled; listen(item, 'click', action); return item;
    }
    const model = createBuilder({ service: studio.service, spaceId: ctx.spaceId, jobId: ctx.jobId, stageId: ctx.stageId,
      onDirty: value => studio.setDirty?.(value),
      report(view) {
        unlisten(); root.setAttribute('aria-busy', String(view.state === 'loading' || !!view.busy));
        if (view.state !== 'ready') {
          const panel = states.panel(doc, view.state === 'offline' ? 'failed' : view.state, view.state === 'loading'
            ? 'Loading home page…' : view.message, () => void model.load());
          root.replaceChildren(node('h2', 'Home page'), panel); return;
        }
        const field = node('label', '', 'studio-homepage-field'), input = node('input');
        input.value = view.headline; input.disabled = view.busy || !view.open; input.maxLength = 120;
        listen(input, 'change', () => model.edit(input.value)); field.append(node('span', 'Headline'), input);
        const tools = node('div', '', 'studio-homepage-actions');
        tools.append(button('Draft headline with Meridian', () => void model.draft(), false, view.busy || !view.open),
          button('Keep', () => void model.keep(), false, view.busy || !view.open),
          button(view.busy ? 'Working…' : 'Finish stage', () => void model.finish(), true, view.busy || !view.open));
        const pick = node('label', '', 'studio-homepage-field'), select = node('select');
        for (const [id, label] of STYLE_NAMES) { const option = node('option', label); option.value = id; select.appendChild(option); }
        select.value = view.niche; select.disabled = view.busy || !view.open;
        listen(select, 'change', () => model.setNiche(select.value)); pick.append(node('span', 'Style'), select);
        root.replaceChildren(node('h2', `Home page: Tier ${view.tier}`), pick, field, tools);
        if (view.proposal) {
          const offer = node('div', '', 'studio-card studio-homepage-proposal'); offer.setAttribute('role', 'status');
          offer.append(node('p', `Meridian suggests: ${view.proposal}`),
            button('Use this headline', () => model.accept(), true, view.busy), button('Dismiss', () => model.dismiss(), false, view.busy));
          root.appendChild(offer);
        }
        if (view.kept) { const note = node('p', `Kept as version ${view.kept} in this stage.`); note.setAttribute('role', 'status'); root.appendChild(note); }
        if (view.done) root.appendChild(node('p', 'This tier is finished and saved to the project folder.', 'studio-chip'));
        if (view.error) { const error = node('p', view.error); error.setAttribute('role', 'alert'); root.appendChild(error); }
        const frame = node('iframe', '', 'studio-homepage-preview');
        // The pages have no scripts, so the preview runs fully sandboxed.
        frame.setAttribute('sandbox', ''); frame.setAttribute('title', `Home page Tier ${view.tier} preview`);
        frame.srcdoc = view.html; root.appendChild(frame);
      } });
    void model.load(); return () => { model.dispose(); unlisten(); root.remove(); };
  }
  return { TIERS, buildPage, createBuilder, mountCanvas };
});
