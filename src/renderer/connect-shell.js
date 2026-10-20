/* Meridian Connect shell (2026-10-06): applies the design standard's structure on top of app.js.
 * - plain page titles, BV mark in the sidebar, one profile menu (settings + sign out)
 * - Overview rebuilt around the person's day: due soon, their projects with pace, messages from Jax
 */
'use strict';

(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
  const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };

  // Plain, human page titles (top bar)
  if (typeof viewHeadings !== 'undefined') {
    Object.assign(viewHeadings, {
      overview: { eyebrow: 'Your day at Breakthrough Ventures', title: 'Overview' },
      projects: { eyebrow: 'Everything for each project in one place', title: 'Projects' },
      tasks: { eyebrow: 'Work assigned to you', title: 'My tasks' },
      messages: { eyebrow: 'Channels and direct messages with the team', title: 'Messages' },
      send: { eyebrow: 'Files and links go straight to Jax', title: 'Send to Jax' },
      tools: { eyebrow: '', title: 'Tools' },
      chat: { eyebrow: 'Answers from Meridian on home base', title: 'Meridian AI' },
    });
  }

  function tidyChrome() {
    const brand = document.querySelector('.nav-brand');
    if (brand) {
      const img = brand.querySelector('img');
      if (img) { img.src = 'assets/meridian-256.png'; img.alt = ''; }
      const w = brand.querySelector('.brand-words'); if (w) w.textContent = 'Meridian';
      const t = brand.querySelector('.brand-tagline'); if (t) t.textContent = 'Connect';
    }
    const NAVI = {
      overview: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
      projects: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
      tasks: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>',
      messages: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
      send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
      chat: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>' };
    Object.entries(NAVI).forEach(([v, d]) => { const el = document.querySelector(`.nav-link[data-view="${v}"] .nav-icon`);
      if (el && !el.dataset.svg) { el.dataset.svg = '1'; el.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`; } });
    const label = document.querySelector('.nav-label'); if (label) label.textContent = 'Workspace';
    const rename = { messages: 'Messages', tasks: 'My tasks', chat: 'Meridian AI', send: 'Send to Jax' };
    Object.entries(rename).forEach(([v, txt]) => { const el = document.querySelector(`.nav-link[data-view="${v}"] .nav-text`); if (el) el.textContent = txt; });
    const dockTitle = document.querySelector('#chatDock .dock-kicker'); if (dockTitle) dockTitle.textContent = 'Meridian AI';
    const welcome = document.querySelector('#dockMessages .m.mer');
    if (welcome && /SAMPLE/.test(welcome.textContent)) welcome.innerHTML = '<div>Ask anything about your work. Meridian answers from home base; your chats stay on Jax\'s PC.</div>';
    const ta = document.getElementById('text'); if (ta) ta.placeholder = 'Ask Meridian…';
    // one profile menu instead of separate gear / sign-out buttons in the top bar
    const prof = document.getElementById('headerProfile');
    if (prof && !prof.dataset.menu) {
      prof.dataset.menu = '1';
      const menu = document.createElement('div');
      menu.id = 'bv-profile-menu';
      menu.hidden = true;
      menu.style.cssText = 'position:fixed;z-index:9000;min-width:180px;background:#0E1B2E;border:1px solid #28405F;border-radius:12px;padding:6px;box-shadow:0 18px 50px #0008';
      menu.innerHTML = '<button type="button" data-act="settings" style="display:block;width:100%;text-align:left;padding:9px 12px;border:0;background:none;color:#EEF3FA;border-radius:8px;cursor:pointer">Settings</button>'
        + '<button type="button" data-act="signout" style="display:block;width:100%;text-align:left;padding:9px 12px;border:0;background:none;color:#F2A0AE;border-radius:8px;cursor:pointer">Sign out</button>';
      document.body.appendChild(menu);
      prof.addEventListener('click', (e) => {
        e.stopPropagation();
        const r = prof.getBoundingClientRect();
        menu.style.top = (r.bottom + 6) + 'px'; menu.style.left = Math.max(8, r.right - 180) + 'px';
        menu.hidden = !menu.hidden;
      });
      document.addEventListener('click', () => { menu.hidden = true; });
      menu.querySelector('[data-act="settings"]').onclick = () => { const b = document.getElementById('openSettingsBtn'); if (b) b.click(); };
      menu.querySelector('[data-act="signout"]').onclick = () => { const b = document.getElementById('btn-signout'); if (b) b.click(); };
    }
  }

  // Shared "ask Meridian" used by the Overview and the project workspace
  async function ask(projectId, q, out, btn) {
    const nav = window.meridianNav ? await window.meridianNav.handle(q).catch(() => null) : null;   // "take me to…"
    if (nav) return nav;
    out.hidden = false;
    out.innerHTML = `<div class="bv-q">${esc(q)}</div><div class="bv-a bv-thinking">Meridian is thinking…</div>`;
    if (btn) btn.disabled = true;
    try {
      const onChunk = streamInto(() => out.querySelector('.bv-a'));
      const r = await window.meridian.api.streamChat(projectId, q, onChunk);
      onChunk.done();
      out.innerHTML = r && r.success
        ? `<div class="bv-q">${esc(q)}</div><div class="bv-a">${fmt(r.text)}</div>`
        : `<div class="bv-q">${esc(q)}</div><div class="bv-a bv-err">${esc((r && r.error) || 'Meridian could not answer. Try again.')}</div>`;
    } finally { if (btn) btn.disabled = false; }
  }
  // 2026-10-19: show the reply as Meridian writes it. Returns the onChunk for streamChat; target() gives the element to
  // fill. Redraws at most once a frame; call .done() before drawing the final reply so a late frame can't overwrite it.
  function streamInto(target, after) {
    let text = '', queued = false, over = false;
    const onChunk = (piece) => {
      text += piece;
      if (queued || over) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const el = !over && target(); if (!el) return;
        el.classList.remove('bv-thinking');
        el.innerHTML = fmt(text);
        if (after) after(el);
      });
    };
    onChunk.done = () => { over = true; };
    return onChunk;
  }
  function fmt(t) {   // light formatting: paragraphs, bullet lists, bold
    const bullet = /^\s*([-*•]|\d+[.)])\s+/;
    return esc(t || '').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split(/\n{2,}/).map((para) => {
      let html = '', list = [], text = [];
      const flushText = () => { if (text.length) { html += '<p>' + text.join('<br>') + '</p>'; text = []; } };
      const flushList = () => { if (list.length) { html += '<ul>' + list.map((l) => '<li>' + l + '</li>').join('') + '</ul>'; list = []; } };
      para.split('\n').forEach((l) => { if (bullet.test(l)) { flushText(); list.push(l.replace(bullet, '')); } else { flushList(); text.push(l); } });
      flushText(); flushList();
      return html;
    }).join('');
  }
  window.meridianAsk = ask;
  window.meridianFmt = fmt;

  const CHAT = { turns: [], busy: false, project: undefined };   // survives Overview refreshes

  // ------------------------------------------------------------ Speak replies (2026-10-11)
  // Optional, off by default: when it is on, Meridian's replies to typed messages are also read aloud in Meridian's
  // voice. Same voice path as voice calls (window.meridian.api.voiceSpeech -> home base /connect/api/voice/speech, or this
  // computer's own voice when home base has none). Remembered per person in Connect's settings store (settings.json in
  // this computer's app-data, key speakReplies.<username>). To keep the voice budget small only the first ~1,200
  // characters of a reply are spoken (same cap as voice calls), cut at a sentence end. A new message, Stop, Esc or
  // turning it off stops playback. During a voice call the call speaks its own replies, so this stays quiet.
  const SPEAK_MAX = 1200;
  const SPEAK = { on: false, user: null, playing: false, seq: 0, audio: null, utter: null };
  const SPK_ICON = { on: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
    off: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 6 6"/><path d="m22 9-6 6"/>', stop: '<rect x="7" y="7" width="10" height="10" rx="1.5"/>' };
  const spkSvg = (k) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + SPK_ICON[k] + '</svg>';
  function speakCss() {
    if (document.getElementById('bv-speak-style')) return;
    const st = document.createElement('style'); st.id = 'bv-speak-style';
    st.textContent = '.bv-chat-tools{display:flex;align-items:center;gap:6px;flex:0 0 auto}' +
      '.bv-speak{display:inline-grid;place-items:center;padding:0}.bv-speak svg,.bv-speaking svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}' +
      '.bv-speak[aria-pressed="true"]{color:#34D3B4;border-color:#2C6570;background:rgba(52,211,180,.10)}.bv-speak[aria-pressed="true"]:hover{color:#6FF0D6;border-color:#34D3B4}' +
      '.bv-speak:focus-visible,.bv-speaking button:focus-visible{outline:2px solid #6dd9ff;outline-offset:2px}' +
      '.bv-speaking{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 4px 0 10px;border:1px solid #3A3270;border-radius:8px;background:#1B1640;color:#CFC6FF;font:600 11.5px var(--bv-sans,Inter,sans-serif)}' +
      '.bv-speaking[hidden]{display:none}.bv-speaking .bv-eq{display:inline-flex;align-items:flex-end;gap:2px;height:12px}' +
      '.bv-speaking .bv-eq i{width:3px;height:100%;border-radius:2px;background:#9B87F5;animation:bvEq .9s ease-in-out infinite}.bv-speaking .bv-eq i:nth-child(2){animation-delay:.15s}.bv-speaking .bv-eq i:nth-child(3){animation-delay:.3s}' +
      '@keyframes bvEq{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}' +
      '.bv-speaking button{display:inline-grid;place-items:center;width:22px;height:22px;border:0;border-radius:6px;background:transparent;color:#CFC6FF;cursor:pointer;padding:0}.bv-speaking button:hover{background:#2A2360;color:#fff}';
    document.head.appendChild(st);
  }
  function speakUser() { return (typeof currentMe !== 'undefined' && currentMe && (currentMe.username || currentMe.id)) || ''; }
  async function speakLoad() {   // read this person's choice once per sign-in
    const u = speakUser(); if (!u || SPEAK.user === u) return;
    SPEAK.user = u; SPEAK.on = false;
    try { const st = await window.meridian.getSettings(); SPEAK.on = !!(st && st.speakReplies && st.speakReplies[u] === true); } catch (e) {}
    speakUi();
  }
  async function speakSet(on) {
    SPEAK.on = !!on; if (!SPEAK.on) speakStop();
    speakUi();
    const u = speakUser(); if (!u) return;
    try { const st = (await window.meridian.getSettings()) || {}; const m = Object.assign({}, st.speakReplies || {}); m[u] = SPEAK.on;
      await window.meridian.saveSettings({ speakReplies: m }); } catch (e) {}
  }
  function speakUi() {
    const b = document.getElementById('bv-speak'), ind = document.getElementById('bv-speaking');
    if (b) { b.setAttribute('aria-pressed', SPEAK.on ? 'true' : 'false'); b.innerHTML = spkSvg(SPEAK.on ? 'on' : 'off');
      b.title = SPEAK.on ? 'Speak replies is on. Meridian reads its replies aloud. Click to turn off.' : 'Speak replies is off. Click to have Meridian read its replies aloud.'; }
    if (ind) ind.hidden = !SPEAK.playing;
  }
  function speakClean(t) {   // same clean-up as voice calls (voice.js), capped at a sentence end
    let say = String(t || '').replace(/```[\s\S]*?```/g, ' ').replace(/[*_#>`]/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/https?:\/\/\S+/g, 'the link').replace(/\s+/g, ' ').trim();
    if (say.length > SPEAK_MAX) { const cut = say.slice(0, SPEAK_MAX); const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
      say = end > SPEAK_MAX * 0.5 ? cut.slice(0, end + 1) : cut; }
    return say;
  }
  function speakStop() {
    SPEAK.seq++;
    if (SPEAK.audio) { try { SPEAK.audio.pause(); } catch (e) {} }
    if (SPEAK.utter && window.speechSynthesis) { try { speechSynthesis.cancel(); } catch (e) {} }
    SPEAK.audio = null; SPEAK.utter = null;
    if (SPEAK.playing) { SPEAK.playing = false; speakUi(); }
  }
  async function speakReply(text) {
    const inCall = window.meridianVoice && window.meridianVoice.state && window.meridianVoice.state().on;
    if (!SPEAK.on || inCall) return;
    const say = speakClean(text); if (!say) return;
    speakStop();
    const my = ++SPEAK.seq; SPEAK.playing = true; speakUi();
    try {
      const r = await window.meridian.api.voiceSpeech(say);
      if (my !== SPEAK.seq) return;
      if (r && r.success && r.audio) {
        await new Promise((resolve) => {
          const a = new Audio('data:' + (r.mime || 'audio/wav') + ';base64,' + r.audio);
          SPEAK.audio = a; a.onended = a.onerror = a.onpause = () => resolve(); a.play().catch(() => resolve());
        });
      } else if (window.speechSynthesis) {   // home base has no voice right now: use this computer's
        await new Promise((resolve) => {
          const u = new SpeechSynthesisUtterance(say); u.rate = 1.03; u.onend = u.onerror = () => resolve();
          SPEAK.utter = u; speechSynthesis.speak(u);
        });
      }
    } catch (e) { /* speaking is optional; the text reply is already on screen */ }
    finally { if (my === SPEAK.seq) { SPEAK.playing = false; SPEAK.audio = null; SPEAK.utter = null; speakUi(); } }
  }
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && SPEAK.playing) speakStop(); });
  window.meridianSpeak = { state: () => ({ on: SPEAK.on, playing: SPEAK.playing, user: SPEAK.user }), stop: speakStop };
  function drawThread(suggestions) {
    const t = document.getElementById('bv-thread'); if (!t) return;
    t.innerHTML = CHAT.turns.length ? CHAT.turns.map((x) => x.role === 'user'
        ? `<div class="bv-bubble me">${esc(x.text)}</div>`
        : `<div class="bv-airow"><img class="bv-av" src="assets/meridian-256.png" alt=""><div class="bv-bubble ai ${x.err ? 'bv-err' : ''}">${x.pending ? '<span class="bv-typing" aria-label="Meridian is thinking"><i></i><i></i><i></i></span>' : x.err ? esc(x.text) : fmt(x.text)}</div></div>`).join('')
      : `<div class="bv-chat-empty"><p>Ask anything about your projects and tasks. Try:</p>${(suggestions || []).map((q) => `<button type="button" class="bv-chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>`;
    t.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => chatSend(b.dataset.q, suggestions)));
    t.scrollTop = t.scrollHeight;
  }
  async function chatSend(q, suggestions) {
    speakStop();   // a new message stops any reply being read aloud
    const nav = window.meridianNav ? await window.meridianNav.handle(q).catch(() => null) : null;   // "take me to…"
    if (nav) { CHAT.turns.push({ role: 'user', text: q }, { role: 'ai', text: nav }); drawThread(suggestions); return nav; }
    CHAT.busy = true;
    const go = document.getElementById('bv-ask-go'); if (go) go.disabled = true;
    CHAT.turns.push({ role: 'user', text: q }, { role: 'ai', pending: true });
    drawThread(suggestions);
    let r;
    const lastBubble = () => { const b = document.querySelectorAll('#bv-thread .bv-bubble.ai'); return b.length ? b[b.length - 1] : null; };
    const onChunk = streamInto(lastBubble, () => { const t = document.getElementById('bv-thread'); if (t) t.scrollTop = t.scrollHeight; });
    try { r = await window.meridian.api.streamChat(CHAT.project || null, q, onChunk); } catch (e) { r = { success: false, error: e.message }; }
    onChunk.done();
    CHAT.turns[CHAT.turns.length - 1] = r && r.success ? { role: 'ai', text: r.text } : { role: 'ai', err: true, text: (r && r.error) || 'Meridian could not answer. Try again.' };
    CHAT.busy = false;
    const go2 = document.getElementById('bv-ask-go'); if (go2) go2.disabled = false;
    drawThread(suggestions);
    const last = CHAT.turns[CHAT.turns.length - 1];
    if (last && !last.err && last.text) speakReply(last.text);   // only if Speak replies is on (2026-10-11)
    return last && !last.err ? last.text : '';
  }

  async function renderOverview() {
    const host = document.getElementById('empty');
    if (!host || !window.meridian || typeof currentMe === 'undefined' || !currentMe) return;
    let box = document.getElementById('bv-ov');
    if (!box) { box = document.createElement('div'); box.id = 'bv-ov'; box.className = 'bv-ov'; host.prepend(box); }
    const api = window.meridian.api;
    const [t, p, m] = await Promise.all([api.getTasks(currentMe.username), api.getProjects(currentMe.username), api.getMessages()]);
    const tasks = (t && t.data) || [], projs = (p && p.data) || [], msgs = (m && m.data) || [];
    const open = tasks.filter((x) => !x.completed);
    const due = open.filter((x) => x.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const week = due.filter((x) => x.dueDate <= addDays(7)).length;
    const fromJax = msgs.filter((x) => x.isJax);
    const h = new Date().getHours();
    const first = String(currentMe.displayName || currentMe.name || '').split(/\s+/)[0] || 'there';
    const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    const when = (d) => d < today() ? ['late', 'Late, ' + d] : d === today() ? ['soon', 'Today'] : d <= addDays(2) ? ['soon', d] : ['', d];
    const pname = (id) => (projs.find((x) => x.id === id) || {}).name || '';
    const I = {
      task: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>',
      cal: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
      proj: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
      msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' };
    const icon = (k) => `<svg viewBox="0 0 24 24" class="bv-ico" aria-hidden="true">${I[k]}</svg>`;
    const lateN = open.filter((x) => x.dueDate && x.dueDate < today()).length;
    const top = projs.slice().sort((a, b) => ((a.summary || {}).days_left ?? 9999) - ((b.summary || {}).days_left ?? 9999))[0];
    const ts = top ? (top.summary || {}) : {};
    const gauge = (pct) => { const r = 54, c = Math.PI * r; const v = Math.max(0, Math.min(100, pct || 0));
      return `<svg viewBox="0 0 140 84" class="bv-gauge" aria-hidden="true"><defs><linearGradient id="bvg" x1="0" x2="1"><stop offset="0" stop-color="#1F6FD6"/><stop offset="1" stop-color="#5CB4FF"/></linearGradient></defs>
        <path d="M16 76 A54 54 0 0 1 124 76" fill="none" stroke="#1A2B44" stroke-width="10" stroke-linecap="round"/>
        <path d="M16 76 A54 54 0 0 1 124 76" fill="none" stroke="url(#bvg)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c * v / 100} ${c}"/></svg>`; };
    const headline = !open.length ? 'You are all caught up.' : lateN ? `${lateN} task${lateN === 1 ? ' is' : 's are'} past due.` : week ? `${week} task${week === 1 ? '' : 's'} due this week.` : `${open.length} open task${open.length === 1 ? '' : 's'}, nothing urgent.`;
    box.innerHTML = `<div class="bv-ovgrid bv-solo"><div class="bv-ovmain">
      <section class="bv-hero"><div class="bv-hero-in"><div class="bv-kicker">${esc(dateStr)}</div>
        <h2>${h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'}, ${esc(first)}.</h2>
        <p>Here is where your work stands today across ${projs.length} project${projs.length === 1 ? '' : 's'}.</p>
        <div class="bv-actions"><button type="button" class="bv-btn" data-go="projects">Open my projects →</button><button type="button" class="bv-btn ghost" id="bv-focus-chat">Ask Meridian</button></div></div>
        ${(due[0] || open[0]) ? `<button type="button" class="bv-next" data-go="tasks"><span class="bv-label">Up next</span>
          <b>${esc((due[0] || open[0]).title)}</b><small>${esc(pname((due[0] || open[0]).projectId))}</small>
          <span class="bv-next-when ${(due[0] && when(due[0].dueDate)[0]) || ''}">${due[0] ? esc(when(due[0].dueDate)[1]) : 'No due date'}</span></button>`
          : '<div class="bv-hero-tag">Same team.<br>Clearer days.<br>Better work.</div>'}</section>

      <section class="bv-band"><div class="bv-lead"><div class="bv-label">01. Your day</div><h3>${esc(headline)}</h3>
          <p>${open.length ? 'Start with what is due soonest. Tick tasks off as you finish so Jax sees progress right away.' : 'New tasks from Jax will show up here as soon as they are assigned.'}</p></div>
        <div class="bv-stats">
          <div class="bv-stat a-blue">${icon('task')}<b>${open.length}</b><span>Open tasks</span><em>${tasks.length - open.length} done</em></div>
          <div class="bv-stat a-amber">${icon('cal')}<b>${week}</b><span>Due this week</span><em class="${lateN ? 'late' : ''}">${lateN ? lateN + ' late' : 'on track'}</em></div>
          <div class="bv-stat a-violet">${icon('proj')}<b>${projs.length}</b><span>Projects</span><em>assigned to you</em></div>
          <div class="bv-stat a-teal">${icon('msg')}<b>${fromJax.length}</b><span>From Jax</span><em>messages</em></div></div></section>

      <section class="bv-band"><div class="bv-lead"><div class="bv-label">02. Due soon</div><h3>What is next on your plate.</h3>
          <p>Sorted by due date. Open a task's project to see its files, notes and website.</p><button type="button" class="bv-link" data-go="tasks">All my tasks →</button></div>
        <div class="bv-list">${(due.length ? due : open).slice(0, 6).map((x) => { const w = x.dueDate ? when(x.dueDate) : ['', 'No date'];
            return `<button type="button" class="bv-row" data-go="tasks"><span class="bv-dot ${w[0]}"></span><div class="bv-grow"><b>${esc(x.title)}</b><small>${esc(pname(x.projectId))}</small></div><span class="bv-when ${w[0]}">${esc(w[1])}</span></button>`; }).join('') || '<div class="bv-empty">Nothing due right now.</div>'}</div></section>

      <section class="bv-band"><div class="bv-lead"><div class="bv-label">03. Your projects</div><h3>${top ? esc(top.name) : 'No projects yet.'}</h3>
          <p>${top ? `${esc(top.client || 'Breakthrough Ventures')}. ${ts.days_left != null ? (ts.days_left < 0 ? -ts.days_left + ' days past due.' : ts.days_left + ' days left.') : ''} ${ts.tasks_done || 0} of ${ts.tasks_total || 0} tasks done.` : 'Jax adds you to projects from Meridian Command.'}</p>
          ${top ? `<button type="button" class="bv-btn" data-project="${esc(top.id)}">Open workspace →</button>` : ''}</div>
        <div class="bv-proj">${top ? `<div class="bv-score">${gauge(ts.progress)}<div class="bv-score-n">${ts.progress || 0}<small>%</small></div><div class="bv-score-l">complete<br><span style="color:#8C9BB4;letter-spacing:0;text-transform:none;font-weight:400;font-size:12.5px">${esc(top.name)}</span></div></div>` : ''}
          <div class="bv-list">${projs.map((x) => { const s2 = x.summary || {};
            return `<button type="button" class="bv-row" data-project="${esc(x.id)}"><span class="bv-mono h${[...String(x.id)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 5}">${esc(String(x.name).split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase())}</span><div class="bv-grow"><b>${esc(x.name)}</b><small>${esc(x.client || x.status)}${s2.days_left != null ? `, ${s2.days_left < 0 ? -s2.days_left + ' days late' : s2.days_left + ' days left'}` : ''}</small></div>
              <div class="bv-pace"><i style="width:${s2.progress || 0}%"></i></div><span class="bv-pct">${s2.progress || 0}%</span></button>`; }).join('')}</div></div></section>

      <section class="bv-band"><div class="bv-lead"><div class="bv-label">04. From Jax</div><h3>${fromJax.length ? 'Latest from Jax.' : 'No messages yet.'}</h3>
          <p>Reply in Messages. Files and links go through Send to Jax.</p><button type="button" class="bv-link" data-go="messages">Open messages →</button></div>
        <div class="bv-list">${fromJax.slice(-3).reverse().map((x) => `<div class="bv-msg"><p>${esc(x.text)}</p><small>${esc(x.time)}</small></div>`).join('') || '<div class="bv-empty">When Jax messages you, it shows up here.</div>'}</div></section>
      </div>
      </div>`;
    box.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => switchView(b.dataset.go)));
    document.getElementById('bv-focus-chat').onclick = () => dockFocus();
    DOCK.suggestions = ['What should I work on first today?', top ? 'Summarize where ' + top.name + ' stands' : 'Summarize my week', top ? 'Draft a short client update for ' + top.name : 'Help me plan my tasks'];
    DOCK.projects = projs;
    renderDock();
    box.querySelectorAll('[data-project]').forEach((b) => (b.onclick = () => {
      switchView('projects');
      if (window.meridianWorkspace) { document.dispatchEvent(new Event('bv-pick')); window.meridianWorkspace.open(b.dataset.project); }
    }));
  }

  // ------------------------------------------------------------ Meridian on every page (2026-10-08)
  // One dock on the right of every page, one conversation everywhere. It follows the page: on a project it asks about
  // that project. It lives outside the pages (in .workspace-main), so adding or removing pages never affects it.
  // The "Meridian AI" menu item opens it full width. On a storyboard it steps aside for the storyboard's own Meridian.
  const DOCK = { suggestions: ['What should I work on first today?', 'Summarize my week', 'Help me plan my tasks'], projects: [],
    collapsed: false, manual: false, overBoard: false, lastBoard: false };
  try { DOCK.collapsed = localStorage.getItem('connect.dock.collapsed') === '1'; } catch (e) {}
  function dockEl() {
    let el = document.getElementById('mx-dock');
    const host = document.querySelector('.workspace-main');
    if (!el && host) { el = document.createElement('aside'); el.id = 'mx-dock'; el.className = 'mx-dock bv-ovchat'; el.setAttribute('aria-label', 'Meridian AI'); host.appendChild(el); }
    return el;
  }
  function pageProject() {   // the project on screen, if any
    try { if (activeView === 'projects' && window.meridianWorkspace && window.meridianWorkspace.current) return window.meridianWorkspace.current() || null; } catch (e) {}
    return null;
  }
  function renderDock() {
    const el = dockEl(); if (!el) return;
    const signedIn = typeof currentMe !== 'undefined' && currentMe;
    el.hidden = !signedIn;
    if (!signedIn) { speakStop(); SPEAK.user = null; SPEAK.on = false; return; }
    if (!DOCK.manual) CHAT.project = pageProject();
    const hide = boardOnScreen() && !DOCK.overBoard;
    const small = (DOCK.collapsed || hide) && activeView !== 'chat';
    el.classList.toggle('mx-small', small);
    document.body.classList.toggle('mx-dock-small', small);
    if (small) {
      el.innerHTML = `<button type="button" class="mx-open" title="${hide ? 'The storyboard has its own Meridian panel' : 'Open Meridian'}" aria-label="Open Meridian">
        <img src="assets/meridian-256.png" alt=""><span>Meridian</span></button>`;
      el.querySelector('.mx-open').onclick = () => { DOCK.collapsed = false; if (hide) DOCK.overBoard = true; else save(); renderDock(); };
      return;
    }
    const projs = DOCK.projects.length ? DOCK.projects : (typeof projects !== 'undefined' ? projects : []);
    const name = (projs.find((x) => x.id === CHAT.project) || {}).name;
    el.innerHTML = `<div class="bv-chat-h"><div><div class="bv-label">Meridian AI</div><h3>${name ? esc(name) : 'Ask about your work'}</h3></div>
        <div class="bv-chat-tools"><span class="bv-speaking" id="bv-speaking" role="status" ${SPEAK.playing ? '' : 'hidden'}><span class="bv-eq" aria-hidden="true"><i></i><i></i><i></i></span>Speaking<button type="button" id="bv-speak-stop" title="Stop speaking (Esc)" aria-label="Stop speaking">${spkSvg('stop')}</button></span>
        <button type="button" class="mx-collapse bv-speak" id="bv-speak" aria-label="Speak replies" aria-pressed="${SPEAK.on ? 'true' : 'false'}">${spkSvg(SPEAK.on ? 'on' : 'off')}</button>
        ${activeView === 'chat' ? '' : '<button type="button" class="mx-collapse" title="Hide Meridian" aria-label="Hide Meridian">⟩</button>'}</div></div>
      <div class="bv-voice" id="bv-voice"></div>
      <select id="bv-ask-proj" class="bv-chat-about" aria-label="About"><option value="">About: ${pageProject() ? 'this page' : 'all my work'}</option>${projs.map((x) => `<option value="${esc(x.id)}" ${CHAT.project === x.id ? 'selected' : ''}>About: ${esc(x.name)}</option>`).join('')}</select>
      <div class="bv-thread" id="bv-thread" role="log" aria-live="polite"></div>
      <form id="bv-ask" class="bv-composer"><textarea id="bv-ask-q" rows="2" placeholder="Message Meridian, or say “take me to…”" aria-label="Message Meridian">${esc(DOCK.draft || '')}</textarea><button class="bv-btn" id="bv-ask-go" aria-label="Send" ${CHAT.busy ? 'disabled' : ''}>Send</button></form>
      <div class="bv-chat-foot">Meridian sees your projects, tasks, notes and links. Not Jax's private files.</div>`;
    const askQ = el.querySelector('#bv-ask-q'), sel = el.querySelector('#bv-ask-proj');
    const sugg = name ? ['What is left before ' + name + ' is done?', 'Summarize where ' + name + ' stands', 'Draft a client update for ' + name] : DOCK.suggestions;
    drawThread(sugg);
    if (window.meridianVoice) window.meridianVoice.mount(el.querySelector('#bv-voice'), { onText: (q) => chatSend(q, sugg) });
    sel.onchange = () => { CHAT.project = sel.value || null; DOCK.manual = !!sel.value && sel.value !== pageProject(); renderDock(); };
    askQ.oninput = () => { DOCK.draft = askQ.value; };
    askQ.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.querySelector('#bv-ask').requestSubmit(); } });
    el.querySelector('#bv-ask').onsubmit = async (e) => {
      e.preventDefault();
      const q = askQ.value.trim(); if (!q || CHAT.busy) return;
      askQ.value = ''; DOCK.draft = '';
      await chatSend(q, sugg);
    };
    const col = el.querySelector('.mx-collapse:not(.bv-speak)'); if (col) col.onclick = () => { DOCK.collapsed = true; save(); renderDock(); };
    speakCss();
    el.querySelector('#bv-speak').onclick = () => speakSet(!SPEAK.on);
    el.querySelector('#bv-speak-stop').onclick = () => speakStop();
    speakUi(); speakLoad();
  }
  function save() { try { localStorage.setItem('connect.dock.collapsed', DOCK.collapsed ? '1' : '0'); } catch (e) {} }
  function dockFocus() { DOCK.collapsed = false; DOCK.overBoard = true; save(); renderDock(); const q = document.getElementById('bv-ask-q'); if (q) q.focus(); }
  // A storyboard has its own Meridian panel, so the dock steps aside while one is open (found by looking at the page,
  // so it keeps working however the storyboard or project pages change).
  function boardOnScreen() { return activeView === 'projects' && !!document.querySelector('#projectsCenter .sb-layout'); }
  const pc = document.getElementById('projectsCenter');
  if (pc && window.MutationObserver) new MutationObserver(() => {
    const b = boardOnScreen();
    if (b !== DOCK.lastBoard) { DOCK.lastBoard = b; if (!b) DOCK.overBoard = false; renderDock(); }
  }).observe(pc, { childList: true, subtree: true });
  window.meridianDock = { focus: dockFocus, refresh: renderDock, collapse: () => { DOCK.collapsed = true; save(); renderDock(); } };

  if (typeof switchView === 'function') {
    const base = switchView;
    // eslint-disable-next-line no-global-assign
    switchView = function (v) { base(v); DOCK.manual = false; renderDock(); if (v === 'overview') renderOverview(); };
  }
  if (window.meridianWorkspace && window.meridianWorkspace.open) {   // follow the project on screen
    const wsOpen = window.meridianWorkspace.open;
    window.meridianWorkspace.open = async function (pid) { const r = await wsOpen.apply(this, arguments); DOCK.manual = false; renderDock(); return r; };
    document.addEventListener('bv-pick', () => setTimeout(renderDock, 300));
  }
  if (typeof enterApp === 'function') {
    const baseEnter = enterApp;
    // eslint-disable-next-line no-global-assign
    enterApp = async function (u) { const r = await baseEnter(u); tidyChrome(); renderOverview(); renderDock(); return r; };
  }
  document.addEventListener('DOMContentLoaded', tidyChrome);
  if (window.meridian && window.meridian.onDataSync) window.meridian.onDataSync(() => { if (activeView === 'overview') renderOverview(); });
  window.meridianShell = { renderOverview, tidyChrome };

  // Home-base status (2026-10-08): a calm banner instead of "fetch failed", and an automatic reconnect.
  let hbOffline = false;
  function hbBanner(show) {
    let el = document.getElementById('hb-offline');
    if (!el) {
      el = document.createElement('div');
      el.id = 'hb-offline';
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:9999;max-width:620px;padding:10px 16px;'
        + 'border-radius:10px;background:#2A1A0C;border:1px solid #F6A85B66;color:#F6D3B0;font:500 13px/1.45 Inter,system-ui,sans-serif;'
        + 'box-shadow:0 8px 30px #0008;display:none';
      el.innerHTML = '<strong style="color:#F6A85B">Home base is offline.</strong> Check that Tailscale is on. If it is, Jax\'s computer may be off or asleep. Connect will reconnect by itself.';
      document.body.appendChild(el);
    }
    el.style.display = show ? 'block' : 'none';
  }
  async function hbCheck() {
    if (!window.meridian || !window.meridian.api || !window.meridian.api.ping) return;
    let ok = false;
    try { const r = await window.meridian.api.ping(); ok = !!(r && r.success); } catch (_) { ok = false; }
    if (!ok && !hbOffline) { hbOffline = true; hbBanner(true); }
    else if (ok && hbOffline) {
      hbOffline = false; hbBanner(false);
      const err = document.getElementById('login-error');
      if (err && /home base/i.test(err.textContent)) err.style.display = 'none';
      try { const lv = document.getElementById('login-view'); const signedIn = !lv || lv.offsetParent === null; if (signedIn && typeof activeView !== 'undefined' && typeof switchView === 'function') switchView(activeView); } catch (_) {}
    }
    setTimeout(hbCheck, hbOffline ? 5000 : 15000);
  }
  document.addEventListener('DOMContentLoaded', () => setTimeout(hbCheck, 1500));

  // Auto-update banner (2026-10-08): a quiet card when a new version has downloaded.
  function updateBanner(info) {
    if (!info || document.getElementById('upd-ready')) return;
    const el = document.createElement('div');
    el.id = 'upd-ready'; el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;left:18px;bottom:18px;z-index:9997;display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:12px;'
      + 'background:#0C1622;border:1px solid #1A84F8;color:#DCE5F2;font:500 13px Inter,system-ui,sans-serif;box-shadow:0 10px 30px #0009';
    el.innerHTML = `<span>Meridian Connect ${info.version ? esc(info.version) + ' ' : ''}is ready.</span>`
      + '<button type="button" id="upd-go" style="border:0;background:#1A84F8;color:#fff;border-radius:8px;padding:6px 10px;font:600 12px Inter,sans-serif;cursor:pointer">Restart to update</button>'
      + '<button type="button" id="upd-later" style="border:1px solid #2A3A55;background:none;color:#9FB0C8;border-radius:8px;padding:6px 10px;font:500 12px Inter,sans-serif;cursor:pointer">Later</button>';
    document.body.appendChild(el);
    el.querySelector('#upd-go').onclick = () => window.meridian.installUpdate();
    el.querySelector('#upd-later').onclick = () => el.remove();   // it also installs by itself the next time Connect quits
  }
  document.addEventListener('DOMContentLoaded', async () => {
    if (!window.meridian || !window.meridian.onUpdateReady) return;
    window.meridian.onUpdateReady(updateBanner);
    try { const st = await window.meridian.updateStatus(); if (st && st.ready) updateBanner(st.ready); } catch (e) { /* ignore */ }
  });
})();
