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

  /** The conversation itself, without any screen code, so it can be tested in Node. */
  function createConversation({ service, emit, spaceId, toolId }) {
    const messages = [];
    let presets = [];
    let space = null;
    let pending = null;   // { step: 'answer' | 'confirm', description, preset, answer, sharpened }
    let busy = false;

    const say = (role, text, extra = {}) => { const m = { role, text, ...extra }; messages.push(m); return m; };

    async function start() {
      space = await service.getSpace(spaceId);
      if (toolId !== 'image-gen') {
        say('meridian', `I can run Image gen for you today. Help with the ${toolId.replace(/-/g, ' ')} tool is coming soon.`);
        return;
      }
      presets = await service.listPresets('image-gen');
      say('meridian', space.type === 'client'
        ? `What image do you need for ${space.name}? Describe it in your own words.`
        : 'What image do you want to try? Describe it in your own words.');
    }

    async function send(text) {
      const input = String(text || '').trim();
      if (!input || busy) return;
      say('you', input);
      if (toolId !== 'image-gen') { say('meridian', 'That tool is coming soon. Open Image gen and I can help there.'); return; }

      if (pending && pending.step === 'answer') {
        pending.answer = input;
        return propose();
      }
      if (pending && pending.step === 'confirm') {
        if (/^(yes|y|go|generate|do it|ok|okay|sure)\b/i.test(input)) return confirm();
        pending = { step: 'answer', description: `${pending.description}; ${input}`, preset: pending.preset, answer: pending.answer };
        return propose();
      }
      const preset = pickPreset(input, presets);
      pending = { step: 'answer', description: input, preset, answer: '' };
      const question = preset && preset.questions[0];
      if (question) {
        say('meridian', `I'll use the "${preset.name}" preset. ${question}`);
        return;
      }
      return propose();
    }

    function propose() {
      const dna = space && space.type === 'client' ? space.dna : null;
      pending.sharpened = sharpenDescription(pending.description, pending.preset, pending.answer, dna);
      pending.step = 'confirm';
      say('meridian', 'Here\'s a sharper way to describe it. Generate 4 options, or tell me what to change?', {
        proposal: pending.sharpened, actions: ['Generate', 'Change it'],
      });
    }

    async function confirm() {
      if (!pending || pending.step !== 'confirm' || busy) return;
      busy = true;
      const working = say('meridian', 'Generating...', { status: 'working' });
      try {
        const out = await service.generateImage({ spaceId, presetId: pending.preset && pending.preset.id, description: pending.sharpened, count: 4 });
        emit('image-results', out);
        const best = out.results.find(r => r.note) || out.results[0];
        say('meridian', `${out.results.length} ready on the right. ${best && best.note ? `#${out.results.indexOf(best) + 1}: ${best.note}.` : ''} Keep the ones you like, or tell me what to change.`,
          { settingsUsed: out.settingsUsed });
        pending = null;
      } catch (error) {
        say('meridian', `That didn't work: ${error.message}`, { status: 'error' });
      } finally {
        const i = messages.indexOf(working);
        if (i !== -1) messages.splice(i, 1);
        busy = false;
      }
    }

    function cancel() {
      if (!pending) return;
      pending = null;
      say('meridian', 'No problem. Describe something else whenever you\'re ready.');
    }

    return {
      start, send, confirm, cancel,
      get messages() { return messages.slice(); },
      get hasDraft() { return Boolean(pending); },
      get busy() { return busy; },
    };
  }

  /** Screen code: only runs in the app. */
  function mountConversation(el, { spaceId, toolId, studio }) {
    const convo = createConversation({ service: studio.service, emit: studio.emit, spaceId, toolId });
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
        if (m.settingsUsed) {
          const details = document.createElement('details');
          details.className = 'mc-settings';
          const summary = document.createElement('summary');
          summary.textContent = 'Settings Meridian used';
          const list = document.createElement('ul');
          for (const [k, v] of Object.entries(m.settingsUsed)) {
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
      sendBtn.disabled = convo.busy;
      studio.setDirty(convo.hasDraft || input.value.trim().length > 0);
    }

    async function run(fn) { const p = fn(); render(); await p; render(); }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value;
      input.value = '';
      input.placeholder = 'Describe what you need...';
      run(() => convo.send(text));
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
    });
    input.addEventListener('input', () => studio.setDirty(convo.hasDraft || input.value.trim().length > 0));

    run(() => convo.start()).catch((error) => {
      log.textContent = `Meridian couldn't start: ${error.message}`;
    });
    return () => studio.setDirty(false);
  }

  return { pickPreset, sharpenDescription, createConversation, mountConversation };
});
