/* Meridian Studio conversation panel (left side of every tool). Core lane.
 * STUDIO-AI 2026-10-25: Meridian itself answers (POST /api/studio/spaces/<id>/chat). The server keeps the whole
 * conversation, so follow-ups ("the rest need to be cats too") change the last proposal instead of starting over.
 * Meridian rewrites the description; the person approves it; images are made only on a clear yes, from the stored
 * proposal (proposalId), never from raw chat text. Presets show as clickable suggestions.
 * The old scripted flow below is only the fallback when the server says Meridian chat is off (503 studio_ai_off)
 * or on the sample service. Rules stay: propose, preview, apply on yes, never mention cost. */
'use strict';

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.MeridianStudio) {
    root.MeridianStudio.registerPart('conversation', { mount: (el, ctx) => api.mountConversation(el, ctx) });
  }
})(typeof window === 'undefined' ? null : window, function () {
  const PRESET_WORDS = {
    'website-hero': ['hero', 'homepage', 'home page', 'banner', 'landing'],
    'page-header': ['header', 'page top', 'about page', 'services page'],
    'service-in-action': ['in action', 'working', 'crew on', 'installing', 'repair', 'job site', 'jobsite'],
    'before-after': ['before', 'after', 'transformation'],
    'team-portrait': ['team', 'crew photo', 'portrait', 'staff', 'headshot'],
    'product-shot': ['product', 'packshot', 'on white', 'item'],
    'social-promo': ['social', 'instagram', 'facebook', 'post', 'story'],
    'ad-creative': ['ad', 'advert', 'offer', 'promo code', 'sale'],
    'seasonal': ['holiday', 'christmas', 'summer', 'winter', 'spring', 'fall', 'halloween', 'seasonal'],
  };

  /** Best preset for a request, by keywords; falls back to the first preset. */
  function pickPreset(text, presets) {
    const lower = ` ${String(text || '').toLowerCase()} `;
    let best = null;
    let bestScore = 0;
    for (const preset of presets) {
      const words = PRESET_WORDS[preset.id] || [];
      const score = words.reduce((n, w) => n + (lower.includes(w) ? w.length : 0), 0);
      if (score > bestScore) { best = preset; bestScore = score; }
    }
    return best || presets[0] || null;
  }

  /** A clearer version of the request, using the preset and (for client spaces) the Project DNA. */
  /** How many images the person asked for: 1, 2 or 4 (the only counts the server makes), or null if they didn't say.
   *  Only counts tied to an image word, so "2 people" or "1990s" don't count. A singular request ("a hero image") is 1. */
  const COUNT_WORDS = { one: 1, single: 1, a: 1, an: 1, '1': 1, two: 2, couple: 2, pair: 2, '2': 2, three: 4, '3': 4, four: 4, '4': 4, few: 4, several: 4 };
  function pickCount(text) {
    const t = String(text || '').toLowerCase();
    const near = t.match(/\b(one|single|1|two|2|three|3|four|4|couple|pair|few|several)\b(?:\s+of)?(?:\s+[a-z-]+){0,2}?\s+(images?|pictures?|photos?|options?|versions?|shots?|ones?)\b/);
    if (near) return COUNT_WORDS[near[1]] || null;
    const bare = t.match(/^\s*(?:just |only |make it )?(one|1|two|2|four|4)\s*(?:please)?\s*[.!]?\s*$/);
    if (bare) return COUNT_WORDS[bare[1]];
    if (/\b(just|only)\s+(one|1)\b|\b(one|1)\s+please\b|\bsingle\b/.test(t)) return 1;
    if (/\b(images|pictures|photos|options|versions|shots)\b/.test(t)) return null;
    if (/\b(an?|one)\s+(?:[a-z-]+\s+){0,3}(image|picture|photo|shot)\b/.test(t)) return 1;
    return null;
  }

  function sharpenDescription(description, preset, answer, dna) {
    const parts = [String(description || '').trim().replace(/[.\s]+$/, '')];
    if (answer) parts.push(String(answer).trim());
    if (preset) parts.push(`${preset.name.toLowerCase()} composition, ${preset.size} frame`);
    if (dna && dna.voice) parts.push(`mood: ${dna.voice.toLowerCase()}`);
    if (dna && Array.isArray(dna.colors) && dna.colors.length) parts.push(`brand colors ${dna.colors.join(' and ')}`);
    parts.push('natural light, realistic, no text or fake logos');
    return parts.filter(Boolean).join('; ');
  }

  /** Picks the one question to ask. If the person already described the subject (4+ words),
   *  skip "what/which" content questions and ask the first practical one instead. */
  function chooseQuestion(preset, description) {
    const questions = (preset && Array.isArray(preset.questions)) ? preset.questions : [];
    const words = String(description || '').split(/\s+/).filter(Boolean).length;
    if (words >= 4) {
      const practical = questions.find(q => !/^(what|which)\b/i.test(q));
      if (practical) return practical;
    }
    return questions[0] || null;
  }

  /** Only these settings are ever shown to employees, whatever the service returns (no costs, keys, paths or diagnostics).
   *  STUDIO-AI 2026-10-25: also takes the server's [{label, value}] list, and display-keyed objects (Preset/Size/...). */
  const SETTING_LABELS = ['Preset', 'Size', 'Count', 'Options', 'Brand DNA', 'Model'];
  function safeSettings(settings) {
    if (Array.isArray(settings)) {
      return settings.filter(r => r && SETTING_LABELS.includes(r.label) && typeof r.value === 'string' && r.value
        && r.value.length <= 60 && !/[$\u20ac\u00a3]|cost|usd/i.test(r.value)).map(r => [r.label, r.value]);
    }
    const raw = settings && typeof settings === 'object' ? settings : {};
    const s = { preset: raw.preset ?? raw.Preset, size: raw.size ?? raw.Size, count: raw.count ?? raw.Options ?? raw.Count,
      useBrandDna: raw.useBrandDna ?? (raw['Brand DNA'] === undefined ? undefined : raw['Brand DNA'] === 'On' || raw['Brand DNA'] === true) };
    if (typeof s.count === 'string' && /^[124]$/.test(s.count)) s.count = Number(s.count);
    const out = [];
    if (typeof s.preset === 'string' && s.preset.length <= 60) out.push(['Preset', s.preset]);
    if (typeof s.size === 'string' && /^(\d{1,2}:\d{1,2}|\d{3,4}x\d{3,4})( \(\d{3,4}x\d{3,4}\))?$/.test(s.size)) out.push(['Size', s.size]);
    if ([1, 2, 4].includes(s.count)) out.push(['Options', String(s.count)]);
    if (typeof s.useBrandDna === 'boolean') out.push(['Brand DNA', s.useBrandDna ? 'On' : 'Off']);
    return out;
  }

  /** Fixed, safe wording for anything that goes wrong. Raw error details never reach the screen. */
  const COPY = Object.freeze({
    startFailed: 'Meridian can\'t open this Space right now. Check your connection, or ask Jax if you should have access.',
    generateFailed: 'Meridian couldn\'t make the images just now. Nothing new was saved. Try again in a moment.',
    displayFailed: 'Your images were made and saved to this Space\'s assets, but couldn\'t be shown here. Open the Asset Library to see them.',
    reconciled: 'The images were made after all and are saved in this Space. Showing them now.',
    aiOff: 'Meridian\'s chat isn\'t available right now, so I\'ll use the quick guided steps instead.',   // STUDIO-AI 2026-10-25
    chatFailed: 'Meridian couldn\'t answer just now. Nothing was made. Try sending that again.',
    allowanceUsed: 'Your Meridian allowance is used up for now. Ask Jax if you need more.',
  });
  const YES = /^(yes|y|yep|yeah|go|generate|do it|ok|okay|sure|make it|approved?|looks good)\b/i;

  let requestCounter = 0;

  /** The conversation itself, without any screen code, so it can be tested in Node. */
  function createConversation({ service, emit, spaceId, toolId, jobId, stageId, report = () => {} }) {
    const messages = [];
    let presets = [];
    let space = null;
    let pending = null;   // { step: 'answer' | 'confirm', description, preset, answer, sharpened, requestId, proposalId?, approved? }
    let busy = false;
    // STUDIO-AI 2026-10-25: 'meridian' = the server's Meridian chat; 'script' = the old guided steps (fallback only).
    let mode = typeof service.chat === 'function' ? 'meridian' : 'script';
    let sessionId = null;   // kept after generating, so follow-ups carry the whole conversation
    let ready = false;
    let disposed = false;

    const say = (role, text, extra = {}) => {
      if (disposed) return null;
      const m = { role, text, ...extra };
      messages.push(m);
      return m;
    };

    async function start() {
      try {
        [space, presets] = await Promise.all([service.getSpace(spaceId),   // STUDIO-AI 2026-10-25: in parallel
          toolId === 'image-gen' ? service.listPresets('image-gen') : Promise.resolve([])]);
      } catch (error) {
        report(error);
        say('meridian', COPY.startFailed, { status: 'error' });
        return false;
      }
      if (disposed) return false;
      if (toolId === 'copywriter') {
        say('meridian', 'Fill in the brief on the canvas. "Ask Meridian for a summary" there drafts one from what you wrote.');
      } else if (toolId !== 'image-gen') {
        say('meridian', `I can run Image gen for you today. Help with the ${String(toolId).replace(/-/g, ' ')} tool is coming soon.`);
      } else {
        say('meridian', space.type === 'client'
          ? `What image do you need for ${space.name}? Describe it in your own words.`
          : 'What image do you want to try? Describe it in your own words.',
        mode === 'meridian' ? { suggestions: presets.map(p => ({ id: p.id, name: p.name })) } : {});
      }
      ready = true;
      return true;
    }

    async function send(text) {
      const input = String(text || '').trim();
      if (!ready || disposed || !input || busy) return false;
      say('you', input);
      if (toolId === 'copywriter') { say('meridian', 'Use "Ask Meridian for a summary" on the canvas for the brief. Open Image gen and I can make pictures there.'); return true; }
      if (toolId !== 'image-gen') { say('meridian', 'That tool is coming soon. Open Image gen and I can help there.'); return true; }
      if (mode === 'meridian') {   // STUDIO-AI 2026-10-25
        if (pending && pending.proposalId && YES.test(input) && input.split(/\s+/).length <= 4) {
          pending.approved = true;
          await confirm();
          return true;
        }
        await ask(input);
        if (mode === 'meridian') return true;   // else Meridian chat is off: the guided steps take this message
      }
      return scriptSend(input);
    }

    /** STUDIO-AI 2026-10-25: one turn with Meridian. The server stores the conversation and the proposal. */
    async function ask(input, presetId) {
      busy = true;
      const working = say('meridian', 'Thinking...', { status: 'working' });
      let out;
      try {
        out = await service.chat(spaceId, { sessionId, message: input, toolId, presetId });
      } catch (error) {
        if (working) { const i = messages.indexOf(working); if (i !== -1) messages.splice(i, 1); }
        busy = false;
        if (error && (error.code === 'studio_ai_off' || error.status === 503 || error.status === 404)) {   // 0.2.32 integrator: 404 = server half not deployed yet -> old guided steps
          mode = 'script';
          say('meridian', COPY.aiOff);
          return false;
        }
        report(error);
        say('meridian', error && error.code === 'allowance_used' ? COPY.allowanceUsed : COPY.chatFailed, { status: 'error' });
        return false;
      }
      if (working) { const i = messages.indexOf(working); if (i !== -1) messages.splice(i, 1); }
      busy = false;
      if (disposed || !out) return false;
      if (typeof out.sessionId === 'string') sessionId = out.sessionId;
      const suggestions = (Array.isArray(out.suggestions) ? out.suggestions : [])
        .filter(x => x && presets.some(p => p.id === x.id)).map(x => ({ id: x.id, name: presets.find(p => p.id === x.id).name }));
      const p = out.proposal;
      if (p && typeof p.id === 'string' && typeof p.prompt === 'string') {
        const preset = presets.find(x => x.id === p.presetId) || { id: p.presetId, name: p.presetName || '' };
        pending = { step: 'confirm', proposalId: p.id, preset, count: [1, 2, 4].includes(p.count) ? p.count : 2,
          sharpened: p.prompt, approved: false, requestId: `${spaceId}:${Date.now().toString(36)}:${(requestCounter += 1)}` };
        say('meridian', String(out.reply || 'Here\'s how I\'d describe it.'), {
          proposal: p.prompt, actions: ['I approve', 'Generate'], suggestions, settings: safeSettings(p.settings) });
      } else {
        pending = null;
        say('meridian', String(out.reply || 'Tell me a bit more about the image you want.'), { suggestions });
      }
      return true;
    }

    /** A clicked preset chip: tells Meridian which preset to use (it rewrites the proposal for it). */
    async function choosePreset(presetId) {
      const preset = presets.find(p => p.id === presetId);
      if (!ready || disposed || busy || !preset) return false;
      if (mode !== 'meridian') { say('you', preset.name); return scriptSend(preset.name); }
      say('you', `Use the ${preset.name} preset.`);
      await ask(`Use the ${preset.name} preset.`, preset.id);
      return true;
    }

    function approve() { if (pending && pending.proposalId && !busy) pending.approved = true; }

    async function scriptSend(input) {
      if (pending && pending.step === 'answer') {
        pending.answer = input;
        propose();
        return true;
      }
      if (pending && pending.step === 'confirm') {
        if (/^(yes|y|go|generate|do it|ok|okay|sure)\b/i.test(input)) { await confirm(); return true; }
        const asked = input.length <= 40 ? pickCount(input) : null;   // "just one", "make it 2 images"
        if (asked) { pending.count = asked; propose(); return true; }
        pending = { step: 'answer', description: `${pending.description}; ${input}`, preset: pending.preset, answer: pending.answer,
          count: pickCount(input) || pending.count };
        propose();
        return true;
      }
      const preset = pickPreset(input, presets);
      pending = { step: 'answer', description: input, preset, answer: '', count: pickCount(input) || 2 };
      const question = chooseQuestion(preset, input);
      if (question) {
        say('meridian', `I'll use the "${preset.name}" preset. ${question}`);
        return true;
      }
      propose();
      return true;
    }

    function propose() {
      const dna = space && space.type === 'client' ? space.dna : null;
      pending.sharpened = sharpenDescription(pending.description, pending.preset, pending.answer, dna);
      pending.step = 'confirm';
      // One id per proposal. A retry of the same proposal reuses it, so the server can refuse to
      // generate (and charge) twice for it (docs/PLAN.md: retries never charge twice).
      pending.requestId = `${spaceId}:${Date.now().toString(36)}:${(requestCounter += 1)}`;
      const n = pending.count || 2;
      say('meridian', `Here's a sharper way to describe it. Generate ${n} ${n === 1 ? 'image' : 'options'}, or tell me what to change? (Say "just one" or "4" to change how many.)`, {
        proposal: pending.sharpened, actions: ['Generate', 'Change it'],
      });
    }

    /** Hands confirmed results to the canvas. Display problems never make the generation look failed. */
    function deliver(out) {
      const payload = {
        spaceId, toolId, requestId: out.requestId,
        refinedDescription: out.refinedDescription,
        results: Array.isArray(out.results) ? out.results : [],
        // STUDIO-AI 2026-10-25: the server's own settings go through unchanged (the canvas filters them again); the
        // old code turned them into display keys here and then filtered those as raw keys, which emptied the list.
        settingsUsed: rawSettings(out.settingsUsed),
        settings: rowsFor(out).map(([label, value]) => ({ label, value })),
        ...(out.proposalId ? { proposalId: out.proposalId } : {}),
      };
      if (disposed) return;   // the person left this Space: results stay saved there, nothing is shown elsewhere
      try {
        emit('image-results', payload);
      } catch (error) {
        report(error);
        say('meridian', COPY.displayFailed, { status: 'error' });
        return;
      }
      const best = payload.results.find(r => r && r.note) || payload.results[0];
      say('meridian', `${payload.results.length} ready on the canvas. ${best && best.note ? `#${payload.results.indexOf(best) + 1} fits the brief best. ` : ''}Keep the ones you like, or tell me what to change.`,
        { settings: rowsFor(out) });
    }

    function rawSettings(raw) {   // STUDIO-AI 2026-10-25: only the known keys, never cost, keys or paths
      const s = raw && typeof raw === 'object' ? raw : {}, out = {};
      for (const k of ['preset', 'size', 'pixels', 'model']) if (typeof s[k] === 'string' && s[k].length <= 60 && !/[$]|cost/i.test(s[k])) out[k] = s[k];
      if ([1, 2, 4].includes(s.count)) out.count = s.count;
      if (typeof s.useBrandDna === 'boolean') out.useBrandDna = s.useBrandDna;
      return out;
    }

    function rowsFor(out) {   // STUDIO-AI 2026-10-25: the server's list first, the raw settings otherwise
      const list = safeSettings(Array.isArray(out.settings) ? out.settings : []);
      return list.length ? list : safeSettings(out.settingsUsed);
    }

    async function confirm() {
      if (!ready || disposed || !pending || pending.step !== 'confirm' || busy) return;
      if (pending.proposalId && !pending.approved) return;   // STUDIO-AI 2026-10-25: only after "I approve" or a typed yes
      busy = true;
      const request = pending;
      const working = say('meridian', 'Generating...', { status: 'working' });
      let before = null;
      try {
        try { before = new Set((await service.listAssets(spaceId)).map(a => a.id)); } catch (e) { before = null; }
        let out;
        try {
          out = await service.generateImage({ spaceId, requestId: request.requestId, presetId: request.preset && request.preset.id,
            description: request.sharpened, count: [1, 2, 4].includes(request.count) ? request.count : 2, ...(jobId ? { jobId, stageId } : {}),
            ...(request.proposalId ? { proposalId: request.proposalId } : {}) });   // STUDIO-AI 2026-10-25: the server makes the stored proposal
        } catch (error) {
          report(error);
          // Uncertain outcome: check whether the images were made before offering a retry.
          const made = await reconcile(before);
          if (made.length) {
            pending = null;
            say('meridian', COPY.reconciled);
            deliver({ requestId: request.requestId, results: made.map(a => ({ assetId: a.id, url: a.url, previewUrl: a.previewUrl, width: a.width, height: a.height, note: '' })),
              settingsUsed: made[0].settingsUsed, settings: made[0].settings, proposalId: request.proposalId });
          } else {
            say('meridian', COPY.generateFailed, { status: 'error' });   // same proposal (and requestId) stays retryable
          }
          return;
        }
        pending = null;   // generation is confirmed: never offer to run it again
        deliver(out);
      } finally {
        if (working) { const i = messages.indexOf(working); if (i !== -1) messages.splice(i, 1); }
        busy = false;
      }
    }

    async function reconcile(before) {
      if (!before) return [];
      try {
        return (await service.listAssets(spaceId)).filter(a => !before.has(a.id) && a.createdBy === 'image-gen');
      } catch (error) {
        report(error);
        return [];
      }
    }

    function cancel() {
      if (!pending || busy) return;
      pending = null;
      say('meridian', 'No problem. Describe something else whenever you\'re ready.');
    }

    function dispose() { disposed = true; ready = false; }

    return {
      start, send, confirm, cancel, dispose, choosePreset, approve,
      get messages() { return messages.slice(); },
      get mode() { return mode; },
      get sessionId() { return sessionId; },
      get approved() { return Boolean(pending && pending.approved); },
      get hasDraft() { return Boolean(pending); },
      get busy() { return busy; },
      get ready() { return ready; },
    };
  }

  /** Screen code: only runs in the app. */
  function mountConversation(el, { spaceId, toolId, jobId, stageId, studio }) {
    const convo = createConversation({ service: studio.service, emit: studio.emit, spaceId, toolId, jobId, stageId,
      report: (error) => console.error('[Meridian Studio]', error) });   // details go to the developer console only
    el.innerHTML = '';
    const panel = document.createElement('section');
    panel.className = 'mc-panel';
    panel.setAttribute('aria-label', 'Meridian Studio conversation');
    const log = document.createElement('div');
    log.className = 'mc-log';
    log.setAttribute('role', 'log');
    log.setAttribute('aria-live', 'polite');
    const form = document.createElement('form');
    form.className = 'mc-form';
    const input = document.createElement('textarea');
    input.className = 'mc-input';
    input.rows = 2;
    input.placeholder = 'Describe what you need...';
    input.setAttribute('aria-label', 'Message Meridian');
    const sendBtn = document.createElement('button');
    sendBtn.type = 'submit';
    sendBtn.className = 'mc-send';
    sendBtn.textContent = 'Send';
    sendBtn.disabled = true;   // locked until the Space and presets have loaded
    input.disabled = true;
    form.append(input, sendBtn);
    const heading = document.createElement('h2');
    heading.className = 'mc-title';
    heading.textContent = 'Meridian Studio';
    panel.append(heading, log, form);
    el.appendChild(panel);

    function render() {
      log.innerHTML = '';
      for (const m of convo.messages) {
        const row = document.createElement('div');
        row.className = `mc-msg mc-${m.role}${m.status ? ` is-${m.status}` : ''}`;
        const text = document.createElement('p');
        text.textContent = m.text;
        row.appendChild(text);
        if (m.proposal) {
          const box = document.createElement('blockquote');
          box.className = 'mc-proposal';
          box.textContent = m.proposal;
          row.appendChild(box);
        }
        const last = m === convo.messages[convo.messages.length - 1];
        if (m.suggestions && m.suggestions.length && last) {   // STUDIO-AI 2026-10-25: presets as clickable chips
          const chips = document.createElement('div');
          chips.className = 'mc-suggestions';
          for (const sug of m.suggestions) {
            const chip = document.createElement('button');
            chip.type = 'button'; chip.className = 'mc-chip'; chip.textContent = sug.name;
            chip.disabled = convo.busy;
            chip.addEventListener('click', () => run(() => convo.choosePreset(sug.id)));
            chips.appendChild(chip);
          }
          row.appendChild(chips);
        }
        if (m.actions && m.actions[0] === 'I approve' && last && convo.hasDraft) {   // STUDIO-AI 2026-10-25
          const bar = document.createElement('div');
          bar.className = 'mc-actions';
          const ok = document.createElement('button');
          ok.type = 'button'; ok.textContent = convo.approved ? 'Approved' : 'I approve';
          ok.setAttribute('aria-pressed', String(convo.approved));
          ok.addEventListener('click', () => { convo.approve(); render(); });
          const go = document.createElement('button');
          go.type = 'button'; go.textContent = 'Generate'; go.className = 'mc-primary';
          go.disabled = !convo.approved || convo.busy;
          go.addEventListener('click', () => run(() => convo.confirm()));
          bar.append(ok, go);
          row.appendChild(bar);
        } else if (m.actions && last && convo.hasDraft) {
          const bar = document.createElement('div');
          bar.className = 'mc-actions';
          const go = document.createElement('button');
          go.type = 'button'; go.textContent = 'Generate'; go.className = 'mc-primary';
          go.addEventListener('click', () => run(() => convo.confirm()));
          const change = document.createElement('button');
          change.type = 'button'; change.textContent = 'Change it';
          change.addEventListener('click', () => { input.focus(); input.placeholder = 'What should change?'; });
          bar.append(go, change);
          row.appendChild(bar);
        }
        if (m.settings && m.settings.length) {
          const details = document.createElement('details');
          details.className = 'mc-settings';
          const summary = document.createElement('summary');
          summary.textContent = 'Settings Meridian used';
          const list = document.createElement('ul');
          for (const [k, v] of m.settings) {
            const li = document.createElement('li');
            li.textContent = `${k}: ${v}`;
            list.appendChild(li);
          }
          details.append(summary, list);
          row.appendChild(details);
        }
        log.appendChild(row);
      }
      log.scrollTop = log.scrollHeight;
      sendBtn.disabled = !convo.ready || convo.busy;
      input.disabled = !convo.ready;
      studio.setDirty(convo.hasDraft || input.value.trim().length > 0);
    }

    async function run(fn) {
      const p = fn();
      render();
      try { await p; } catch (error) { console.error('[Meridian Studio]', error); }
      render();
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!convo.ready || convo.busy) return;
      const text = input.value;
      input.value = '';
      input.placeholder = 'Describe what you need...';
      run(() => convo.send(text));
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
    });
    input.addEventListener('input', () => studio.setDirty(convo.hasDraft || input.value.trim().length > 0));

    run(() => convo.start());
    return () => { convo.dispose(); studio.setDirty(false); };
  }

  return { pickPreset, pickCount, sharpenDescription, chooseQuestion, safeSettings, COPY, YES, createConversation, mountConversation };
});
