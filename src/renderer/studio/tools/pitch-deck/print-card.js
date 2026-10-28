'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianStudio.registerTool('print-card', { mountCanvas: api.mountCanvas });
})(typeof window === 'undefined' ? null : window, function () {
  // Print card (Pitch deck, #123): the one-page leave-behind with the prospect's name, their score as a hook,
  // the QR code to their own live link (only once Jax approved Publish) and BV's line. Letter and 4x6 layouts.
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[ch]);
  const LAYOUTS = Object.freeze({
    letter: Object.freeze({ name: 'Letter page', file: 'Print card - letter.html', page: 'letter', margin: '0.75in', qr: '2in', title: '30pt', hook: '18pt' }),
    card: Object.freeze({ name: '4x6 card', file: 'Print card - 4x6.html', page: '4in 6in', margin: '0.3in', qr: '1.5in', title: '18pt', hook: '12pt' }),
  });
  // Only the QR code decks/qr-code.js makes: one white square and one black path, no text anywhere.
  const QR_SVG = /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 (\d{2,3}) \1" shape-rendering="crispEdges"><rect width="\1" height="\1" fill="#fff"\/><path fill="#000" d="[MHVhvz0-9 .-]*"\/><\/svg>$/;
  const httpsUrl = value => { try { const u = new URL(String(value)); return u.protocol === 'https:' ? u.href : ''; } catch (_) { return ''; } };
  const failureText = error => error?.code === 'OFFLINE' ? 'You are offline. Try again when connected.'
    : error?.message || 'The print card could not finish. Try again.';

  /** One print-ready card page. Refuses a link that isn't https or a QR code that isn't ours; every piece of text is escaped. */
  function buildCard({ layout = 'letter', name, score, url, qrSvg }) {
    const L = LAYOUTS[layout] || LAYOUTS.letter, link = httpsUrl(url);
    if (!link) throw Error('The print card needs the live https link from Publish.');
    if (!QR_SVG.test(String(qrSvg))) throw Error('The print card needs the QR code from Publish.');
    const value = Number.isInteger(score) && score >= 0 && score <= 100 ? score : null;
    const hook = value === null ? 'Scan to see your market report.' : `Your business score: ${value} of 100. Scan to see why.`;
    return '<!doctype html><html lang="en"><head><meta charset="utf-8">'
      + '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'">'
      + `<title>Print card · ${escape(name)}</title><style>@page{size:${L.page};margin:${L.margin}}`
      + '*{box-sizing:border-box}html,body{margin:0;background:#fff;color:#0b1526;font-family:Georgia,"Times New Roman",serif}'
      + 'body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.25in;min-height:100vh;text-align:center}'
      + `.who{margin:0;font-size:${L.title};line-height:1.15}.hook{margin:0;font-size:${L.hook};font-family:Arial,sans-serif}`
      // The QR keeps its own quiet zone and never shrinks below 1 inch, so it scans from print.
      + `.qr{width:${L.qr};height:${L.qr};min-width:1in;min-height:1in}.qr svg{display:block;width:100%;height:100%}`
      + '.link{margin:0;font:9pt Arial,sans-serif;word-break:break-all;color:#33435f}.bv{margin:0;font:10pt Arial,sans-serif;letter-spacing:.08em}</style></head>'
      + `<body data-layout="${layout === 'card' ? 'card' : 'letter'}"><p class="who">Prepared for ${escape(name)}</p><p class="hook">${escape(hook)}</p>`
      + `<div class="qr" role="img" aria-label="QR code to your market report">${qrSvg}</div><p class="link">${escape(link)}</p>`
      + '<p class="bv">Prepared by Breakthrough Ventures</p></body></html>';
  }

  function createPrintCard({ service, spaceId, jobId, report, onDirty = () => {} }) {
    let disposed = false, revision = 0, busy = false, stage = null, card = null, layout = 'letter';
    const page = which => buildCard({ layout: which, ...card });
    function show(error = '') {
      report({ state: 'ready', layout, busy, error, name: card.name, url: card.url,
        open: stage.status === 'current', done: stage.status === 'done', html: page(layout) });
    }
    async function load() {
      if (disposed || busy) return;
      const request = ++revision; if (!card) report({ state: 'loading' });
      try {
        const [space, job, published] = await Promise.all([service.getSpace(spaceId), service.getJob(spaceId, jobId), service.getPublished(spaceId, jobId)]);
        if (disposed || request !== revision) return;
        if (space?.id !== spaceId || job?.id !== jobId || job.spaceId !== spaceId) throw Error('This Job is unavailable.');
        stage = job.stages.find(item => item.id === 'print');
        if (!stage) { report({ state: 'empty', message: 'This Job has no Print card stage.' }); return; }
        // Nothing prints before Jax approves Publish: no live link means no card.
        if (!published) { card = null; report({ state: 'empty', message: 'Waiting for Publish. The card shows once Jax approves the live link.' }); return; }
        let score = null;
        try { score = (await service.getDeck(spaceId, jobId))?.score?.value ?? null; } catch (_) { /* the hook falls back to plain words */ }
        if (disposed || request !== revision) return;
        card = { name: space.name, score, url: published.url, qrSvg: published.qrSvg };
        page('letter'); show();
      } catch (error) {
        if (disposed || request !== revision) return;
        card = null;
        report(error?.code === 'OFFLINE' ? { state: 'offline', message: failureText(error) }
          : { state: 'failed', message: 'Unable to open the print card. Check your connection and access, then try again.' });
      }
    }
    return { load,
      setLayout(value) {
        if (disposed || busy || !card || !LAYOUTS[value]) return false;
        layout = value; show(); return true;
      },
      // Finish: save both layouts into the project folder first, then complete the Print card stage.
      async finish() {
        if (disposed || busy || !card) return;
        busy = true; onDirty(true); show();
        try {
          if (stage.status !== 'current') throw Error('The Print card stage isn\'t open.');
          const saved = await service.saveToProjectFiles(spaceId, jobId, Object.keys(LAYOUTS).map(k => ({ name: LAYOUTS[k].file, content: page(k) })));
          if (!saved || (saved.failed && saved.failed.length)) throw Error('Could not save the card to the project folder. Try again.');
          const job = await service.completeStage(spaceId, jobId, 'print');
          stage = job.stages.find(item => item.id === 'print') || stage;
          if (!disposed) { busy = false; onDirty(false); show(); }
        } catch (error) { if (!disposed) { busy = false; onDirty(false); show(failureText(error)); } }
      },
      dispose() { disposed = true; revision++; onDirty(false); },
    };
  }

  function mountCanvas(el, ctx) {
    const studio = ctx.studio || {}, doc = el.ownerDocument, root = doc.createElement('section');
    root.className = 'studio-print-card'; root.setAttribute('aria-label', 'Print card'); el.replaceChildren(root);
    const states = doc.defaultView?.MeridianStudioScreenStates || require('../../screens/home.js').screenStates;
    // Keeps focus on the control being used across redraws (marks are fixed words, never project text).
    const focused = () => { const a = doc.activeElement; return root.contains?.(a) ? a.getAttribute?.('data-focus') : null; };
    const refocus = mark => { if (mark) root.querySelector?.(`[data-focus="${mark}"]`)?.focus?.(); };
    let listeners = [];
    const listen = (item, type, fn) => { item.addEventListener(type, fn); listeners.push([item, type, fn]); };
    const unlisten = () => { for (const [item, type, fn] of listeners) item.removeEventListener?.(type, fn); listeners = []; };
    function node(tag, text, className) {
      const item = doc.createElement(tag); if (text) item.textContent = text;
      if (className) item.className = className; return item;
    }
    function button(text, action, primary, disabled, mark) {
      const item = node('button', text, `studio-button ${primary ? 'is-primary' : 'is-secondary'}`);
      item.type = 'button'; item.disabled = !!disabled; item.setAttribute('data-focus', mark); listen(item, 'click', action); return item;
    }
    const model = createPrintCard({ service: studio.service, spaceId: ctx.spaceId, jobId: ctx.jobId,
      onDirty: value => studio.setDirty?.(value),
      report(view) {
        unlisten(); const mark = focused();
        root.setAttribute('aria-busy', String(view.state === 'loading' || !!view.busy));
        if (view.state !== 'ready') {
          const panel = states.panel(doc, view.state === 'offline' ? 'failed' : view.state, view.state === 'loading'
            ? 'Loading print card…' : view.message, () => void model.load());
          root.replaceChildren(node('h2', 'Print card'), panel); return;
        }
        const pick = node('label', '', 'studio-print-card-field'), select = node('select');
        for (const [id, L] of Object.entries(LAYOUTS)) { const option = node('option', L.name); option.value = id; select.appendChild(option); }
        select.value = view.layout; select.disabled = view.busy; select.setAttribute('data-focus', 'layout');
        listen(select, 'change', () => model.setLayout(select.value)); pick.append(node('span', 'Layout'), select);
        const tools = node('div', '', 'studio-print-card-actions');
        tools.appendChild(button(view.busy ? 'Working…' : 'Finish stage', () => void model.finish(), true, view.busy || !view.open, 'finish'));
        root.replaceChildren(node('h2', 'Print card'), node('p', `Links to ${view.url}`), pick, tools);
        if (view.done) root.appendChild(node('p', 'The print card is finished and saved to the project folder.', 'studio-chip'));
        if (view.error) { const error = node('p', view.error); error.setAttribute('role', 'alert'); root.appendChild(error); }
        const frame = node('iframe', '', 'studio-print-card-preview');
        frame.setAttribute('sandbox', 'allow-scripts'); frame.setAttribute('title', 'Print card preview');   // never allow-same-origin
        frame.srcdoc = view.html; root.appendChild(frame);
        refocus(mark);
      } });
    // Publish approved or the stage finished elsewhere: show the card (or lock it) without a reload.
    const off = studio.service?.on?.((event, detail) => {
      if (event === 'jobs-changed' && detail?.spaceId === ctx.spaceId) void model.load();
    });
    void model.load();
    return () => { off?.(); model.dispose(); unlisten(); root.remove(); };
  }
  return { LAYOUTS, buildCard, createPrintCard, mountCanvas };
});
