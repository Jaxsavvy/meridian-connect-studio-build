/* Meridian Studio conversation panel (left side of every tool). Core lane.
 * Today it runs a scripted sample flow for Image gen on the sample service:
 *   describe -> pick preset -> ask what's missing -> suggest a sharper description
 *   -> generate only when the person says yes -> results go to the canvas.
 * Wave 1 (#48) swaps the scripted replies for the real model through the server router;
 * the flow and the rules stay the same: propose, preview, apply on yes, never mention cost. */
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

  /** Only these settings are ever shown to employees, whatever the service returns (no costs, keys, paths or diagnostics). */
  function safeSettings(settings) {
    const s = settings && typeof settings === 'object' ? settings : {};
    const out = [];
    if (typeof s.preset === 'string' && s.preset.length <= 60) out.push(['Preset', s.preset]);
    if (typeof s.size === 'string' && /^\d{1,2}:\d{1,2}$/.test(s.size)) out.push(['Size', s.size]);
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
  });

  let requestCounter = 0;

  /** The conversation itself, without any screen code, so it can be tested in Node. */
  function createConversation({ service, emit, spaceId, toolId, report = () => {} }) {
    const messages = [];
    let presets = [];
    let space = null;
    let pending = null;   // { step: 'answer' | 'confirm', description, preset, answer, sharpened, requestId }
    let busy = false;
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
        space = await service.getSpace(spaceId);
        if (toolId === 'image-gen') presets = await service.listPresets('image-gen');
      } catch (error) {
        report(error);
        say('meridian', COPY.startFailed, { status: 'error' });
        return false;
      }
      if (disposed) return false;
      if (toolId !== 'image-gen') {
        say('meridian', `I can run Image gen for you today. Help with the ${String(toolId).replace(/-/g, ' ')} tool is coming soon.`);
      } else {
        say('meridian', space.type === 'client'
          ? `What image do you need for ${space.name}? Describe it in your own words.`
          : 'What image do you want to try? Describe it in your own words.');
      }
      ready = true;
      return true;
    }

    async function send(text) {
      const input = String(text || '').trim();
      if (!ready || disposed || !input || busy) return false;
      say('you', input);
      if (toolId !== 'image-gen') { say('meridian', 'That tool is coming soon. Open Image gen and I can help there.'); return true; }

      if (pending && pending.step === 'answer') {
        pending.answer = input;
        propose();
        return true;
      }
      if (pending && pending.step === 'confirm') {
        if (/^(yes|y|go|generate|do it|ok|okay|sure)\b/i.test(input)) { await confirm(); return true; }
        pending = { step: 'answer', description: `${pending.description}; ${input}`, preset: pending.preset, answer: pending.answer };
        propose();
        return true;
      }
      const preset = pickPreset(input, presets);
      pending = { step: 'answer', description: input, preset, answer: '' };
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
      say('meridian', 'Here\'s a sharper way to describe it. Generate 4 options, or tell me what to change?', {
        proposal: pending.sharpened, actions: ['Generate', 'Change it'],
      });
    }

    /** Hands confirmed results to the canvas. Display problems never make the generation look failed. */
    function deliver(out) {
      const payload = {
        spaceId, toolId, requestId: out.requestId,
        refinedDescription: out.refinedDescription,
        results: Array.isArray(out.results) ? out.results : [],
        settingsUsed: Object.fromEntries(safeSettings(out.settingsUsed).map(([k, v]) => [k, v])),
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
        { settings: safeSettings(out.settingsUsed) });
    }

    async function confirm() {
      if (!ready || disposed || !pending || pending.step !== 'confirm' || busy) return;
      busy = true;
      const request = pending;
      const working = say('meridian', 'Generating...', { status: 'working' });
      let before = null;
      try {
        try { before = new Set((await service.listAssets(spaceId)).map(a => a.id)); } catch (e) { before = null; }
        let out;
        try {
          out = await service.generateImage({ spaceId, requestId: request.requestId, presetId: request.preset && request.preset.id,
            description: request.sharpened, count: 4 });
        } catch (error) {
          report(error);
          // Uncertain outcome: check whether the images were made before offering a retry.
          const made = await reconcile(before);
          if (made.length) {
            pending = null;
            say('meridian', COPY.reconciled);
            deliver({ requestId: request.requestId, results: made.map(a => ({ assetId: a.id, url: a.url, note: '' })), settingsUsed: made[0].settingsUsed });
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
      start, send, confirm, cancel, dispose,
      get messages() { return messages.slice(); },
      get hasDraft() { return Boolean(pending); },
      get busy() { return busy; },
      get ready() { return ready; },
    };
  }

  /** Screen code: only runs in the app. */
  function mountConversation(el, { spaceId, toolId, studio }) {
    const convo = createConversation({ service: studio.service, emit: studio.emit, spaceId, toolId,
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
        if (m.actions && m === convo.messages[convo.messages.length - 1] && convo.hasDraft) {
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

  return { pickPreset, sharpenDescription, chooseQuestion, safeSettings, COPY, createConversation, mountConversation };
});
