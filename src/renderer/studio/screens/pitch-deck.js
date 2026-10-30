'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianStudio.registerScreen('pitch-deck', { render: api.render });
})(typeof window === 'undefined' ? null : window, function () {
  // Pitch Deck page: the locked stage list with builders, timing and actions; the workspace shows the open tool.
  const STATUS = Object.freeze({ done: 'Done', current: 'Open', 'waiting-on-jax': 'Waiting on Jax', upcoming: 'Not open yet' });
  const HOME = Object.freeze(['home-t1', 'home-t2', 'home-t3']);
  const PRINT = 'print';   // the Print card stage opens its tool (#279); the tool's Finish stage completes it
  // Deck form helpers: the form is built from the deck itself (decks/deck-data.js), so it always matches the format.
  const LONG = new Set(['text', 'problem', 'build', 'effect', 'detail', 'description', 'basis']);
  const NAMES = Object.freeze({ url: 'Link', placeId: 'Google place ID', bookingUrl: 'Booking link' });
  const nameOf = key => NAMES[key] || (/^\d+$/.test(key) ? `#${Number(key) + 1}` : String(key).replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()));
  function setAt(obj, path, value) { const keys = path.split('.'), last = keys.pop(); keys.reduce((o, k) => o[k], obj)[last] = value; }
  const getAt = (obj, path) => path.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
  /** The checked deck, but every field with a problem shows what the person typed (so nothing they wrote disappears). */
  function keepTyped(checked, typed, errors) {
    const out = JSON.parse(JSON.stringify(checked || typed));
    for (const e of errors) {
      const was = getAt(typed, e.path);
      if (was === undefined || (was !== null && typeof was === 'object')) continue;
      try { setAt(out, e.path, was); } catch (_) { /* the checked deck has no such field */ }
    }
    return out;
  }

  function createPitchDeck({ service, spaceId, jobId, report }) {
    let disposed = false, revision = 0, job = null, people = [], checks = null, busy = false, published = null;
    const show = (error = '') => report({ state: 'ready', job, people, checks, busy, error, published });
    async function load() {
      if (disposed) return;
      const request = ++revision; if (!job) report({ state: 'loading' });
      try {
        const [next, team] = await Promise.all([service.getJob(spaceId, jobId), service.listPeople('pitch-deck')]);
        if (disposed || request !== revision) return;
        if (next?.id !== jobId || next.spaceId !== spaceId) throw Error('Unable to open this Job.');
        if (next.workflowId !== 'pitch-deck') { report({ state: 'empty', message: 'This Job isn\'t a pitch deck.' }); return; }
        let found = null;
        try { found = await service.getChecks(spaceId, jobId); } catch (_) { /* no checks yet */ }
        let live = null;   // U-D3 2026-10-29: the deck's live link and QR, once Jax has published it
        try { live = await service.getPublished(spaceId, jobId); } catch (_) { /* not published */ }
        if (disposed || request !== revision) return;
        job = next; people = (Array.isArray(team) ? team : []).filter(p => p?.id && p.name); checks = found; published = live || null; show();
      } catch (_) {
        if (!disposed && request === revision) report({ state: 'failed', message: 'Unable to open this pitch deck. Check your connection and access, then try again.' });
      }
    }
    async function act(work) {
      if (disposed || busy || !job) return false;
      busy = true; show();
      try { await work(); busy = false; await load(); return true; } catch (error) {
        if (!disposed) { busy = false; show(error?.message || 'Try again.'); }
        return false;
      }
    }
    const stage = id => job?.stages.find(st => st.id === id);
    return { load,
      // Jax's stages always stay with Jax; finished stages keep their builder.
      assign: (stageId, personId) => act(async () => {
        const st = stage(stageId);
        if (!st || st.status === 'done') throw Error('This stage\'s builder can\'t change.');   // ASSIGN-MANY: Jax stages too
        await service.assignStage(spaceId, jobId, stageId, personId || null);
      }),
      finish: stageId => act(() => service.completeStage(spaceId, jobId, stageId)),
      /** U-D3: Jax puts the assembled board on its public link (his own real click only), and Publish is done. */
      publish: click => act(() => service.publishDeck(spaceId, jobId, { click: click === true })),
      resolve: (flagId, note) => act(() => service.resolveFlag(spaceId, jobId, flagId, String(note || '').trim())),
      dispose() { disposed = true; revision++; },
    };
  }

  function render(el, { spaceId, jobId, open }, studio) {
    const doc = el.ownerDocument, root = doc.createElement('section');
    root.className = 'studio-pitch-deck'; root.setAttribute('aria-label', 'Pitch deck'); el.replaceChildren(root);
    const states = doc.defaultView?.MeridianStudioScreenStates || require('./home.js').screenStates;
    const focus = states.focus(root);
    let listeners = [];
    const notes = {};   // Auto check notes being typed, kept across redraws
    const listen = (item, type, fn) => { item.addEventListener(type, fn); listeners.push([item, type, fn]); };
    const unlisten = () => { for (const [item, type, fn] of listeners) item.removeEventListener?.(type, fn); listeners = []; };
    function node(tag, text, className) {
      const item = doc.createElement(tag); if (text) item.textContent = text;
      if (className) item.className = className; return item;
    }
    function button(text, action, primary, disabled, label) {
      const item = node('button', text, `studio-button ${primary ? 'is-primary' : 'is-secondary'}`);
      item.type = 'button'; item.disabled = !!disabled; if (label) item.setAttribute('aria-label', label);
      listen(item, 'click', action); return item;
    }
    // The workspace is built once per visit, so a mounted tool survives the stage list's redraws.
    const header = node('div', '', 'studio-pitch-deck-head'), stages = node('div', '', 'studio-pitch-deck-stages');
    const workspace = node('div', '', 'studio-card studio-pitch-deck-work'), body = node('div', '', 'studio-pitch-deck-body');
    body.append(stages, workspace); root.append(header, body);
    if (HOME.includes(open)) {
      const slot = node('div'); workspace.append(node('h2', `Home page: Tier ${HOME.indexOf(open) + 1}`), slot);
      studio.mountInto(slot, 'tool', 'homepage-builder', { spaceId, jobId, stageId: open });
    } else if (open === PRINT) {
      const slot = node('div'); workspace.append(node('h2', 'Print card'), slot);
      studio.mountInto(slot, 'tool', 'print-card', { spaceId, jobId, stageId: PRINT });
    } else {
      workspace.className += ' studio-pitch-deck-deck';   // the deck form and preview fill it once the deck loads
    }
    // Deck form (Research + write) and live preview. Its listeners are its own, so stage-list redraws keep them.
    const deck = { value: null, errors: [], saving: false, message: '', locked: false, dirty: false };
    let deckListeners = [], closed = false;
    const board = () => doc.defaultView?.MeridianPitchBoard || require('../tools/pitch-deck/board.js');
    const dirty = value => { if (deck.dirty !== value) { deck.dirty = value; studio.setDirty?.(value); } };
    async function loadDeck(message = '') {
      try { deck.value = await studio.service.getDeck(spaceId, jobId); deck.message = message; } catch (error) { deck.message = error?.message || 'Unable to load the deck.'; }
      if (!closed) drawDeck();
    }
    async function saveDeck() {
      if (deck.saving || !deck.value || deck.locked) return;
      deck.saving = true; drawDeck();
      try {
        const typed = JSON.parse(JSON.stringify(deck.value));
        const result = await studio.service.saveDeck(spaceId, jobId, deck.value);
        deck.errors = Array.isArray(result.errors) ? result.errors : []; dirty(false);
        // Jax 10-29: "if the info isn't perfect, Save wipes it". The checker blanks a value it can't use (a link that isn't
        // https://...); keep what was typed on screen, with the message beside it, until it's fixed. A clean save shows
        // the checked deck.
        deck.value = deck.errors.length ? keepTyped(result.deck, typed, deck.errors) : result.deck;
        deck.message = result.ok ? 'Saved. The deck passes the checker.' : `Saved. ${deck.errors.length} thing(s) still to fix.`;
      } catch (error) {
        deck.message = error?.message || 'Unable to save. Try again.';
        // Someone else saved a moment ago: the service loaded their version, so show it and keep the message as-is.
        if (/someone else saved/i.test(deck.message)) { dirty(false); deck.saving = false; await loadDeck(deck.message); return; }
      }
      deck.saving = false; if (!closed) drawDeck();
    }
    function drawDeck() {
      for (const [item, type, fn] of deckListeners) item.removeEventListener?.(type, fn); deckListeners = [];
      const active = doc.activeElement?.getAttribute?.('data-path'), byPath = {}, shown = new Set(), inputs = {};
      for (const e of deck.errors) (byPath[e.path] = byPath[e.path] || []).push(e.message);
      const errorsFor = (path, el) => { for (const m of byPath[path] || []) { shown.add(path); const p = node('p', m, 'studio-pitch-deck-error'); el.appendChild(p); } };
      function field(path, key, value) {
        const wrap = node('label', '', 'studio-pitch-deck-field'), numbers = Array.isArray(value);
        const input = node(typeof value === 'string' && LONG.has(key) ? 'textarea' : 'input');
        if (typeof value === 'boolean') { input.type = 'checkbox'; input.checked = value; }
        else if (typeof value === 'number') { input.type = 'number'; input.step = 'any'; input.value = String(value); }
        else input.value = numbers ? value.join(', ') : String(value ?? '');
        input.setAttribute('data-path', path); input.disabled = deck.locked || deck.saving; inputs[path] = input;
        if (byPath[path]) input.setAttribute('aria-invalid', 'true');
        const read = () => typeof value === 'boolean' ? input.checked : typeof value === 'number' ? (input.value === '' ? null : Number(input.value))
          : numbers ? input.value.split(',').map(s => s.trim()).filter(Boolean).map(Number) : input.value;
        const fn = () => { setAt(deck.value, path, read()); dirty(true); };
        input.addEventListener(typeof value === 'boolean' ? 'change' : 'input', fn); deckListeners.push([input, typeof value === 'boolean' ? 'change' : 'input', fn]);
        wrap.append(node('span', numbers ? `${nameOf(key)} (numbers, commas between)` : nameOf(key)), input); errorsFor(path, wrap); return wrap;
      }
      function group(path, key, value) {
        // NO-GOOGLE 2026-10-29: a section or number nobody measured stays "not checked" (typing in it would save a made-up 0).
        if (value === null && (['demand', 'saturation'].includes(path) || /\.(presence\.\d+|visibility)$/.test(path))) {
          const note = node('p', `${nameOf(key)}: not checked${['demand', 'saturation'].includes(path) ? ' (no free source yet)' : ''}`, 'studio-pitch-deck-unchecked');
          errorsFor(path, note); return note;
        }
        if (Array.isArray(value) && value.some(v => v === null) && value.every(v => v === null || typeof v === 'number')) {
          const box = node('fieldset', '', 'studio-pitch-deck-group'); box.appendChild(node('legend', nameOf(key))); errorsFor(path, box);
          value.forEach((v, i) => box.appendChild(group(`${path}.${i}`, String(i), v))); return box;
        }
        if (value === null || typeof value !== 'object' || (Array.isArray(value) && value.every(v => typeof v === 'number'))) return field(path, key, value);
        const box = node('fieldset', '', 'studio-pitch-deck-group'); box.appendChild(node('legend', nameOf(key))); errorsFor(path, box);
        for (const [k, v] of Object.entries(value)) if (k !== 'version') box.appendChild(group(path ? `${path}.${k}` : k, k, v));
        return box;
      }
      const form = node('div', '', 'studio-pitch-deck-form'), preview = node('div', '', 'studio-pitch-deck-preview');
      form.appendChild(node('h2', 'Deck words and numbers'));
      if (deck.locked) form.appendChild(node('p', 'Research + write is done, so the deck is locked.'));
      const status = node('p', deck.message); status.setAttribute('role', /unable|someone else|locked|try again/i.test(deck.message) ? 'alert' : 'status');
      if (deck.value) {
        const sections = Object.entries(deck.value).filter(([k]) => k !== 'version').map(([k, v]) => group(k, k, v));
        const extra = deck.errors.filter(e => !shown.has(e.path));
        if (extra.length) { const list = node('ul', '', 'studio-pitch-deck-error'); for (const e of extra) list.appendChild(node('li', `${e.path}: ${e.message}`)); form.appendChild(list); }
        const save = node('button', deck.saving ? 'Saving…' : 'Save deck', 'studio-button is-primary'); save.type = 'button';
        save.disabled = deck.saving || deck.locked; save.setAttribute('data-path', '(save)'); inputs['(save)'] = save;
        save.addEventListener('click', saveDeck); deckListeners.push([save, 'click', saveDeck]);
        form.append(status, ...sections, save);
        const frame = node('iframe', '', 'studio-pitch-deck-board');
        frame.setAttribute('sandbox', 'allow-scripts'); frame.setAttribute('title', 'Board preview');   // never allow-same-origin
        try { frame.srcdoc = board().renderDeck(deck.value); preview.append(node('h2', 'Live preview'), frame); }
        catch (_) { preview.append(node('h2', 'Live preview'), node('p', 'The preview shows once the deck passes the checker.')); }
      } else form.appendChild(status);
      workspace.replaceChildren(form, preview);
      if (active && inputs[active] && !inputs[active].disabled) inputs[active].focus?.();
    }
    function builder(st, view) {
      const label = node('label', '', 'studio-pitch-deck-builder'), select = node('select');
      select.setAttribute('aria-label', `Who builds ${st.name}`);   // ASSIGN-MANY 2026-10-29: Jax's stages can be handed off too
      const options = [['', st.approver === 'jax' ? 'Jax by default' : 'Unassigned'], ...view.people.map(p => [p.id, p.name])];
      for (const [value, name] of options) { const o = node('option', name); o.value = value; select.appendChild(o); }
      const who = Array.isArray(st.assignees) ? st.assignees : st.assignee ? [st.assignee] : [];
      select.value = st.approver === 'jax' && who.join() === 'jax' ? '' : who[0] || ''; select.disabled = st.status === 'done' || view.busy;
      if (!select.disabled) listen(select, 'change', () => void model.assign(st.id, select.value));
      label.append(node('span', 'Built by'), select); return label;
    }
    // U-D3 2026-10-29: the live link, its QR code and Copy link, shown on Publish once the deck is out.
    function live(published) {
      const box = node('div', '', 'studio-pitch-deck-live'), link = node('a', published.url);
      link.href = published.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      box.append(node('p', 'Live link:'), link);
      if (published.qrSvg) {
        const qr = node('img'); qr.alt = 'QR code for the live link'; qr.width = 160; qr.height = 160;
        qr.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(published.qrSvg); box.appendChild(qr);
      }
      const status = node('span', '', 'studio-pitch-deck-copied'); status.setAttribute('role', 'status');
      box.append(button('Copy link', async () => {
        try { await doc.defaultView.navigator.clipboard.writeText(published.url); status.textContent = 'Copied.'; }
        catch (_) { status.textContent = "Couldn't copy. Select the link and copy it."; }
      }), status);
      return box;
    }
    function actions(st, view) {
      const row = node('div', '', 'studio-pitch-deck-actions'), busy = view.busy;
      if (st.id === 'publish' && view.published) row.appendChild(live(view.published));
      if (st.id === 'publish' && st.status === 'current' && !view.published) {   // only Jax puts a deck out in public
        if (studio.isOwner === true) {
          row.appendChild(button(busy ? 'Publishing…' : 'Publish deck', e => {
            if (!e || !e.isTrusted) return;   // a real click only
            const ask = doc.defaultView && doc.defaultView.confirm;
            if (typeof ask === 'function' && !ask.call(doc.defaultView, 'Publish this deck? Anyone with the link can open it.')) return;
            void model.publish(true);
          }, true, busy));
        } else row.appendChild(node('p', 'Waiting on Jax to publish.'));
        return row;
      }
      if (st.status === 'waiting-on-jax') { row.appendChild(node('p', 'Waiting on Jax')); return row; }
      if (st.status !== 'current') return row;
      if (st.id === 'research') row.appendChild(button('Open research', () => studio.navigate('research', { spaceId, jobId }), false, busy));
      if (HOME.includes(st.id) || st.id === PRINT) {
        row.appendChild(button(open === st.id ? 'Opened' : 'Open', () => studio.navigate('pitch-deck', { spaceId, jobId, open: st.id }),
          false, busy || open === st.id, `Open ${st.name}`));
      }
      if (st.id === 'publish') { /* published above */ }
      else if (st.id === PRINT) { /* Finish stage lives in the Print card tool: it saves the card first */ }
      else if (st.id === 'review') row.appendChild(button('Send to Review', () => void model.finish(st.id), true, busy));
      else row.appendChild(button('Finish', () => void model.finish(st.id), true, busy, `Finish ${st.name}`));
      return row;
    }
    function flags(view) {
      const box = node('div', '', 'studio-pitch-deck-flags'), list = node('ul');
      for (const f of view.checks.flags) {
        const li = node('li'); li.append(node('strong', f.message), node('span', f.where || ''));
        if (f.resolved) li.appendChild(node('span', 'Resolved', 'studio-chip'));
        else {
          const field = node('label'), input = node('input'); input.value = notes[f.id] || ''; input.disabled = view.busy;
          listen(input, 'input', () => { notes[f.id] = input.value; });
          field.append(node('span', 'Why it\'s OK'), input);
          li.append(field, button('Mark OK', () => void model.resolve(f.id, input.value), false, view.busy, `Mark OK: ${f.message}`));
        }
        list.appendChild(li);
      }
      box.append(node('h4', 'Flags to review'), list); return box;
    }
    const model = createPitchDeck({ service: studio.service, spaceId, jobId,
      report(view) {
        unlisten(); const restore = focus();
        const locked = view.job?.stages.find(st => st.id === 'research')?.status === 'done';
        if (view.state === 'ready' && locked !== deck.locked) { deck.locked = locked; if (deck.value) drawDeck(); }
        root.setAttribute('aria-busy', String(view.state === 'loading' || !!view.busy));
        header.replaceChildren(button('Back to Space', () => studio.navigate('space', { spaceId })), node('h1', view.job?.name || 'Pitch deck'));
        if (view.state !== 'ready') {
          stages.replaceChildren(states.panel(doc, view.state, view.state === 'loading' ? 'Loading pitch deck…' : view.message, () => void model.load()));
          restore(); return;
        }
        const list = node('ol', '', 'studio-pitch-deck-list');   // locked: the Job's stages never move or change
        for (const st of view.job.stages) {
          const li = node('li', '', `studio-card is-${st.status}`), head = node('div', '', 'studio-pitch-deck-stage');
          head.append(node('h3', st.name), node('span', STATUS[st.status] || st.status, 'studio-chip'));
          li.append(head, builder(st, view));
          if (Number.isFinite(st.timing?.minutes)) li.appendChild(node('p', `Took ${st.timing.minutes} min`, 'studio-pitch-deck-time'));
          li.appendChild(actions(st, view));
          if (st.id === 'check' && view.checks?.flags?.length) li.appendChild(flags(view));
          list.appendChild(li);
        }
        stages.replaceChildren(node('h2', 'Stages'), list);
        if (view.error) { const error = node('p', view.error); error.setAttribute('role', 'alert'); stages.appendChild(error); }
        restore();
      } });
    const off = studio.service.on((event, detail) => {
      if (['jobs-changed', 'deck-changed'].includes(event) && detail?.spaceId === spaceId) void model.load();
    });
    void model.load(); if (!HOME.includes(open) && open !== PRINT) void loadDeck();
    return () => { closed = true; off(); model.dispose(); unlisten(); for (const [i, ty, fn] of deckListeners) i.removeEventListener?.(ty, fn); dirty(false); root.remove(); };
  }
  return { createPitchDeck, render };
});
