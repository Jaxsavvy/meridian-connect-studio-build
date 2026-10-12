/* Meridian Connect: voice (2026-10-08)
 * Hands-free voice call with Meridian: listens, sends each spoken question to the chat it is mounted in, and speaks the
 * reply. Three controls: Start call / End, Mic on/off, Meridian's voice on/off (plus Interrupt while it speaks).
 * Speech-to-text and the voice run on home base (Jax's PC); if home base has no local voice, the computer's own voice
 * is used. Audio is never stored.
 *   window.meridianVoice.mount(element, { onText: async (text) => replyText, label: 'Overview' })
 */
'use strict';

(function () {
  const V = { on: false, phase: 'off', micMuted: false, voiceMuted: false, el: null, onText: null, ctx: null, stream: null,
    node: null, src: null, buf: [], pre: [], speaking: false, audio: null, level: 0, noise: 0.004, loudMs: 0, quietMs: 0,
    uttMs: 0, inUtt: false, busy: false, hint: '' };
  try { V.micMuted = localStorage.getItem('connect.mic.muted') === 'true'; V.voiceMuted = localStorage.getItem('connect.voice.muted') === 'true'; } catch (e) {}
  const CFG = { startMs: 160, endMs: 900, maxMs: 20000, minMs: 450, preMs: 300 };
  const LABEL = { off: ['', ''], starting: ['Starting…', 'Allow the microphone if asked.'], listening: ['Listening', 'Speak naturally, then pause.'],
    hearing: ['Hearing you', 'Keep going, pause when done.'], transcribing: ['Got it', 'Turning that into text…'],
    thinking: ['Thinking', 'Meridian is working on it.'], speaking: ['Speaking', 'Interrupt to cut in.'], ended: ['Call ended', ''] };
  const ICON = {
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    end: '<path d="M3 15c5-4.5 13-4.5 18 0l-2.5 2.5-3-1.5v-2.5a10 10 0 0 0-7 0V16l-3 1.5z"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    micOff: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M4 4l16 16"/>',
    spk: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
    spkOff: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 6 6"/><path d="m22 9-6 6"/>',
    stop: '<rect x="7" y="7" width="10" height="10" rx="1.5"/>' };
  const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;

  function css() {
    if (document.getElementById('mv-style')) return;
    const st = document.createElement('style');
    st.id = 'mv-style';
    st.textContent = `
.mv{display:grid;gap:8px}
.bv-voice{margin-bottom:10px}
#mv-float{position:fixed;right:18px;bottom:18px;width:330px;z-index:9998;padding:10px;border:1px solid #23395A;border-radius:14px;
  background:#0A1424F2;box-shadow:0 12px 40px #000A;backdrop-filter:blur(8px)}
.mv-status{display:flex;gap:10px;align-items:center;padding:9px 11px;border:1px solid #23395A;border-radius:12px;background:linear-gradient(180deg,#0E1B2E,#0A1424)}
.mv-status[hidden]{display:none}
.mv-orb{width:28px;height:28px;flex:none;border-radius:50%;display:grid;place-items:center;background:#0B2340;border:1px solid #1A84F8}
.mv-orb i{width:10px;height:10px;border-radius:50%;background:#5CC8FF;transform:scale(calc(.8 + var(--lvl,0) * 1.6));transition:transform .08s linear}
.mv.speaking .mv-orb{border-color:#9B87F5;background:#1B1640}.mv.speaking .mv-orb i{background:#9B87F5;animation:mvp 1.1s ease-in-out infinite}
.mv.thinking .mv-orb i,.mv.transcribing .mv-orb i{animation:mvb 1s ease-in-out infinite}
@keyframes mvp{50%{transform:scale(1.5)}}@keyframes mvb{50%{opacity:.35}}
.mv-txt{min-width:0;flex:1;display:grid;gap:2px}
.mv-txt b{color:#F2F6FF;font:600 13px var(--bv-sans,Inter,sans-serif)}
.mv-txt small{color:#8FA3BE;font:400 11.5px/1.35 var(--bv-sans,Inter,sans-serif);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-meter{height:3px;border-radius:3px;background:#16243A;overflow:hidden;margin-top:2px}.mv-meter i{display:block;height:100%;width:0;background:#5CC8FF;transition:width .08s linear}
.mv-row{display:flex;gap:6px}
.mv-row button{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:36px;border-radius:10px;cursor:pointer;font:600 12px var(--bv-sans,Inter,sans-serif);transition:background .15s,border-color .15s}
.mv-row svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.mv-call{flex:1;border:1px solid #1A84F8;background:#1A84F8;color:#fff}.mv-call:hover{background:#3796FF}
.mv-end{flex:1;border:1px solid #E5566A;background:#3A1620;color:#FFE3E6}.mv-end:hover{background:#5A1E2B}
.mv-ic{width:38px;flex:none;border:1px solid #2A3A55;background:#121B2C;color:#DCE6F5}.mv-ic:hover{border-color:#4A6C99;color:#fff}
.mv-ic[aria-pressed="true"]{border-color:#E5566A;background:#3A1620;color:#FFE3E6}
.mv-ic.int{border-color:#2C6570;background:#0F2530;color:#6FE0EC}
.mv-ic[hidden],.mv-call[hidden],.mv-end[hidden]{display:none}
.mv-row button:focus-visible{outline:2px solid #6dd9ff;outline-offset:2px}`;
    document.head.appendChild(st);
  }

  // Where the controls show: in the panel they were mounted in, or, while a call is on and that panel is off screen
  // (e.g. "take me to Roof Co"), in a small floating bar so End / mic / voice are always reachable.
  function host() {
    const f = document.getElementById('mv-float');
    if (V.el && V.el.isConnected) { if (f) f.remove(); return V.el; }
    if (!V.on && V.phase !== 'ended') { if (f) f.remove(); return null; }
    if (f) return f;
    const n = document.createElement('div'); n.id = 'mv-float'; n.setAttribute('aria-label', 'Voice call with Meridian');
    document.body.appendChild(n); return n;
  }
  setInterval(() => { if (V.on && (!V.el || !V.el.isConnected) && !document.getElementById('mv-float')) draw();
    else if (V.el && V.el.isConnected && document.getElementById('mv-float')) draw(); }, 1000);

  function draw() {
    const el = host();
    if (!el) return;
    const lab = LABEL[V.phase] || LABEL.off;
    let hint = V.hint || lab[1];
    if (V.on && V.micMuted) hint = 'Your mic is off. ' + (V.phase === 'speaking' ? hint : 'Turn it on to talk.');
    else if (V.on && V.voiceMuted && V.phase !== 'speaking') hint += ' Meridian\'s voice is off, replies show as text.';
    el.innerHTML = `<div class="mv ${V.phase}">
      <div class="mv-status" ${V.on || V.phase === 'ended' ? '' : 'hidden'} role="status" aria-live="polite"><div class="mv-orb" aria-hidden="true"><i></i></div>
        <div class="mv-txt"><b>${lab[0]}</b><small title="${hint.replace(/"/g, '&quot;')}">${hint.replace(/</g, '&lt;')}</small><div class="mv-meter" aria-hidden="true"><i></i></div></div></div>
      <div class="mv-row">
        <button type="button" class="mv-call" data-mv="call" ${V.on ? 'hidden' : ''} title="Start a hands-free voice call with Meridian">${svg('phone')}Start call</button>
        <button type="button" class="mv-end" data-mv="end" ${V.on ? '' : 'hidden'} title="End the call">${svg('end')}End</button>
        <button type="button" class="mv-ic int" data-mv="interrupt" ${V.on && (V.phase === 'speaking' || V.phase === 'thinking') ? '' : 'hidden'} title="Interrupt" aria-label="Interrupt">${svg('stop')}</button>
        <button type="button" class="mv-ic" data-mv="mic" aria-pressed="${V.micMuted}" title="${V.micMuted ? 'Turn your mic on' : 'Mute your mic'}" aria-label="${V.micMuted ? 'Mic off' : 'Mic on'}">${svg(V.micMuted ? 'micOff' : 'mic')}</button>
        <button type="button" class="mv-ic" data-mv="voice" aria-pressed="${V.voiceMuted}" title="${V.voiceMuted ? 'Turn Meridian\'s voice on' : 'Mute Meridian\'s voice'}" aria-label="${V.voiceMuted ? 'Meridian voice off' : 'Meridian voice on'}">${svg(V.voiceMuted ? 'spkOff' : 'spk')}</button>
      </div></div>`;
    el.querySelectorAll('[data-mv]').forEach((b) => (b.onclick = () => act(b.dataset.mv)));
  }

  function meter() {
    const el = (V.el && V.el.isConnected) ? V.el : document.getElementById('mv-float');
    if (!el) return;
    const live = V.on && !V.micMuted && (V.phase === 'listening' || V.phase === 'hearing');
    const lvl = live ? Math.min(1, V.level * 12) : 0;
    const m = el.querySelector('.mv-meter i'); if (m) m.style.width = Math.round(lvl * 100) + '%';
    const o = el.querySelector('.mv'); if (o) o.style.setProperty('--lvl', lvl.toFixed(2));
  }

  function phase(p, hint) { V.phase = p; V.hint = hint || ''; draw(); }

  function act(what) {
    if (what === 'call') return start();
    if (what === 'end') return end('Call ended.');
    if (what === 'interrupt') { stopSpeaking(); if (V.on) phase('listening', 'Interrupted. I\'m listening.'); return; }
    if (what === 'mic') {
      V.micMuted = !V.micMuted;
      try { localStorage.setItem('connect.mic.muted', String(V.micMuted)); } catch (e) {}
      if (V.stream) V.stream.getAudioTracks().forEach((t) => { t.enabled = !V.micMuted; });
      if (V.micMuted) { V.inUtt = false; V.buf = []; if (V.phase === 'hearing') V.phase = 'listening'; }
      return draw();
    }
    if (what === 'voice') {
      V.voiceMuted = !V.voiceMuted;
      try { localStorage.setItem('connect.voice.muted', String(V.voiceMuted)); } catch (e) {}
      if (V.voiceMuted) stopSpeaking();
      return draw();
    }
  }

  // ------------------------------------------------------------ microphone + voice activity
  async function start() {
    if (V.on) return;
    if (!window.meridian || !window.meridian.api.voiceTranscribe) { alertInline('Update Connect to use voice.'); return; }
    V.on = true; phase('starting');
    try {
      V.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    } catch (e) {
      V.on = false; phase('ended', 'Microphone unavailable. Check Windows privacy settings for the microphone.'); return;
    }
    V.stream.getAudioTracks().forEach((t) => { t.enabled = !V.micMuted; t.onended = () => { if (V.on) end('The microphone disconnected.'); }; });
    V.ctx = new (window.AudioContext || window.webkitAudioContext)();
    V.src = V.ctx.createMediaStreamSource(V.stream);
    V.node = V.ctx.createScriptProcessor(2048, 1, 1);
    V.src.connect(V.node); V.node.connect(V.ctx.destination);
    V.node.onaudioprocess = (ev) => onAudio(ev.inputBuffer.getChannelData(0), ev.inputBuffer.duration * 1000);
    V.buf = []; V.pre = []; V.inUtt = false; V.loudMs = V.quietMs = V.uttMs = 0;
    phase('listening');
  }

  function onAudio(data, ms) {
    if (!V.on) return;
    let sum = 0; for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / data.length);
    V.level = V.level * 0.6 + rms * 0.4;
    meter();
    const listening = V.phase === 'listening' || V.phase === 'hearing';
    if (!listening || V.micMuted || V.speaking) return;
    const copy = new Float32Array(data);
    const thr = Math.max(0.012, V.noise * 3.2);
    if (!V.inUtt) {
      V.pre.push(copy); let preMs = V.pre.length * ms; while (preMs > CFG.preMs) { V.pre.shift(); preMs -= ms; }
      if (rms > thr) { V.loudMs += ms; if (V.loudMs >= CFG.startMs) { V.inUtt = true; V.buf = V.pre.slice(); V.pre = []; V.uttMs = V.buf.length * ms; V.quietMs = 0; phase('hearing'); } }
      else { V.loudMs = 0; V.noise = V.noise * 0.98 + rms * 0.02; }
      return;
    }
    V.buf.push(copy); V.uttMs += ms;
    if (rms > thr) V.quietMs = 0; else V.quietMs += ms;
    if (V.quietMs >= CFG.endMs || V.uttMs >= CFG.maxMs) finishUtterance();
  }

  async function finishUtterance() {
    const chunks = V.buf, rate = V.ctx.sampleRate, dur = V.uttMs;
    V.inUtt = false; V.buf = []; V.loudMs = 0; V.quietMs = 0;
    if (dur < CFG.minMs) { phase('listening'); return; }
    phase('transcribing');
    const wav = toWav(chunks, rate);
    const r = await window.meridian.api.voiceTranscribe(wav);
    if (!V.on) return;
    if (!r || !r.success) { phase('listening', (r && r.error) || 'Couldn\'t hear that. Try again.'); return; }
    const text = (r.text || '').trim();
    if (!text || text.length < 2) { phase('listening', 'Didn\'t catch that. Try again.'); return; }
    phase('thinking', '“' + (text.length > 80 ? text.slice(0, 80) + '…' : text) + '”');
    let reply = '';
    try { reply = V.onText ? await V.onText(text) : ''; } catch (e) { reply = ''; }
    if (!V.on) return;
    if (reply && !V.voiceMuted) await speak(reply);
    if (V.on) phase('listening');
  }

  function toWav(chunks, rate) {
    let n = 0; chunks.forEach((c) => { n += c.length; });
    const ratio = rate / 16000, outLen = Math.floor(n / ratio);
    const all = new Float32Array(n); let o = 0; chunks.forEach((c) => { all.set(c, o); o += c.length; });
    const pcm = new Int16Array(outLen);
    for (let i = 0; i < outLen; i++) {   // simple averaging downsample to 16 kHz
      const a = Math.floor(i * ratio), b = Math.min(n, Math.floor((i + 1) * ratio)); let s = 0;
      for (let j = a; j < b; j++) s += all[j];
      const v = Math.max(-1, Math.min(1, s / Math.max(1, b - a)));
      pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    const buf = new ArrayBuffer(44 + pcm.length * 2), d = new DataView(buf);
    const w = (p, s) => { for (let i = 0; i < s.length; i++) d.setUint8(p + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); d.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt '); d.setUint32(16, 16, true);
    d.setUint16(20, 1, true); d.setUint16(22, 1, true); d.setUint32(24, 16000, true); d.setUint32(28, 32000, true);
    d.setUint16(32, 2, true); d.setUint16(34, 16, true); w(36, 'data'); d.setUint32(40, pcm.length * 2, true);
    new Int16Array(buf, 44).set(pcm);
    return new Uint8Array(buf);
  }

  // ------------------------------------------------------------ Meridian's voice
  function clean(t) {
    return String(t || '').replace(/```[\s\S]*?```/g, ' ').replace(/[*_#>`]/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/https?:\/\/\S+/g, 'the link').replace(/\s+/g, ' ').trim().slice(0, 1200);
  }
  async function speak(text) {
    const say = clean(text);
    if (!say) return;
    phase('speaking');
    V.speaking = true;
    try {
      const r = await window.meridian.api.voiceSpeech(say);
      if (!V.speaking) return;
      if (r && r.success && r.audio) {
        await new Promise((resolve) => {
          const a = new Audio(`data:${r.mime || 'audio/wav'};base64,${r.audio}`);
          V.audio = a; a.onended = a.onerror = () => resolve(); a.play().catch(() => resolve());
        });
      } else if (window.speechSynthesis) {   // home base has no local voice: use this computer's
        await new Promise((resolve) => {
          const u = new SpeechSynthesisUtterance(say); u.rate = 1.03; u.onend = u.onerror = () => resolve();
          V.utter = u; speechSynthesis.speak(u);
        });
      }
    } finally { V.speaking = false; V.audio = null; V.utter = null; }
  }
  function stopSpeaking() {
    V.speaking = false;
    if (V.audio) { try { V.audio.pause(); } catch (e) {} V.audio = null; }
    if (window.speechSynthesis) speechSynthesis.cancel();
  }

  function end(reason) {
    if (!V.on) return;
    V.on = false; stopSpeaking();
    try { if (V.node) { V.node.onaudioprocess = null; V.node.disconnect(); } if (V.src) V.src.disconnect(); } catch (e) {}
    if (V.stream) V.stream.getTracks().forEach((t) => t.stop());
    if (V.ctx) { V.ctx.close().catch(() => {}); }
    V.stream = V.ctx = V.node = V.src = null; V.buf = []; V.pre = []; V.inUtt = false; V.level = 0;
    phase('ended', reason || '');
    setTimeout(() => { if (!V.on && V.phase === 'ended') phase('off'); }, 2400);
  }

  function alertInline(msg) { V.hint = msg; phase('ended', msg); setTimeout(() => { if (!V.on) phase('off'); }, 3000); }

  addEventListener('keydown', (e) => { if (e.key === 'Escape' && V.speaking) { stopSpeaking(); if (V.on) phase('listening', 'Stopped. I\'m listening.'); } });

  window.meridianVoice = {
    mount(el, opts) { css(); V.el = el; V.onText = (opts && opts.onText) || null; draw(); },
    end: () => end('Call ended.'),
    state: () => ({ on: V.on, phase: V.phase, micMuted: V.micMuted, voiceMuted: V.voiceMuted })
  };
})();
