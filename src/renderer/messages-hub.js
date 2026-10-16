/* Meridian Connect: team messages, Discord-style (2026-10-07)
 * Channels (#general + one per project) and direct messages with anyone on the team, Jax included.
 * Takes over the Messages page; polls home base every few seconds while open.
 * Chat media (pictures, videos, files) saved in Obsidian vault with sidecar notes (2026-10-08).
 */
'use strict';

(function () {
  const S = { convo: 'c:general', last: 0, side: null, timer: null, sideTimer: null, sending: false, prev: null };
  const mediaUrlCache = new Map();
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const linkify = (t) => esc(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="#" data-url="$1">$1</a>').replace(/\n/g, '<br>');
  const api = (m, e, b) => window.meridian.api.ws(m, e, b);
  const hue = (id) => [...String(id)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 5;
  // 2026-10-08: delete messages (own messages; Jax can delete any). Small style block kept here with the feature.
  if (!document.getElementById('mh-del-style')) {
    const st = document.createElement('style'); st.id = 'mh-del-style';
    st.textContent = '.mh-msg{position:relative}.mh-del{position:absolute;top:2px;right:6px;display:none;border:1px solid rgba(255,255,255,.12);'
      + 'background:#121A2B;color:#9AA6BF;border-radius:7px;font-size:12px;padding:2px 8px;cursor:pointer}'
      + '.mh-msg:hover .mh-del,.mh-del:focus{display:block}.mh-del:hover{color:#F09CAE;border-color:#6E3B47}';
    document.head.appendChild(st);
  }

  async function getMediaUrl(id) {
    if (mediaUrlCache.has(id)) return mediaUrlCache.get(id);
    const u = await window.meridian.api.getChatMediaUrl(id);
    mediaUrlCache.set(id, u);
    return u;
  }

  function renderMessageBody(m) {
    let out = m.text ? linkify(m.text) : '';
    if (m.media) {
      const med = m.media;
      if (med.type === 'image') {
        out += `<div class="mh-media-wrap"><img class="mh-media-img" data-media-id="${esc(med.id)}" alt="${esc(med.name)}" title="${esc(med.name)} (click to save)" /></div>`;
      } else if (med.type === 'video') {
        out += `<div class="mh-media-wrap"><video class="mh-media-video" controls playsinline preload="metadata" data-media-id="${esc(med.id)}" title="${esc(med.name)}"></video></div>`;
      } else if (med.type === 'audio') {
        out += `<div class="mh-media-wrap"><audio class="mh-media-audio" controls preload="metadata" data-media-id="${esc(med.id)}"></audio></div>`;
      } else {
        out += `<div class="mh-media-wrap"><div class="mh-doc-card" data-dl-id="${esc(med.id)}" data-dl-name="${esc(med.name)}" role="button" tabindex="0" title="Download ${esc(med.name)}"><span class="mh-doc-ico">📄</span><div class="mh-doc-info"><span class="mh-doc-name">${esc(med.name)}</span><span class="mh-doc-size">${esc(med.size_formatted || '')}</span></div><span class="mh-doc-dl-ico" title="Download">⬇</span></div></div>`;
      }
    }
    return out;
  }

  function hydrateMedia(container, m) {
    if (!m.media) return;
    const med = m.media;
    const img = container.querySelector(`img[data-media-id="${med.id}"]`);
    if (img) {
      getMediaUrl(med.id).then((src) => { if (src) img.src = src; });
      img.onclick = () => window.meridian.api.wsDownloadChatMedia(med.id, med.name);
    }
    const video = container.querySelector(`video[data-media-id="${med.id}"]`);
    if (video) {
      getMediaUrl(med.id).then((src) => { if (src) video.src = src; });
    }
    const audio = container.querySelector(`audio[data-media-id="${med.id}"]`);
    if (audio) {
      getMediaUrl(med.id).then((src) => { if (src) audio.src = src; });
    }
    const docCard = container.querySelector(`.mh-doc-card[data-dl-id="${med.id}"]`);
    if (docCard) {
      const triggerDl = () => window.meridian.api.wsDownloadChatMedia(med.id, med.name);
      docCard.onclick = triggerDl;
      docCard.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); triggerDl(); } };
    }
  }

  function mount() {
    const host = document.getElementById('teamMessagesCenter');
    if (!host) return null;
    if (!document.getElementById('mh')) {
      host.innerHTML = `<div id="mh" class="mh">
        <aside class="mh-side"><div class="mh-side-h">Breakthrough Ventures</div><div id="mh-list" class="mh-list"></div></aside>
        <section class="mh-main"><div class="mh-head" id="mh-head"></div>
          <div class="mh-thread" id="mh-thread" role="log" aria-live="polite"></div>
          <form class="mh-compose" id="mh-compose">
            <button type="button" class="mh-attach-btn" id="mh-attach" title="Attach picture, video, or file" aria-label="Attach file">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            </button>
            <textarea id="mh-text" rows="1" placeholder="Message" aria-label="Message"></textarea>
            <button class="bv-btn" id="mh-send">Send</button>
          </form>
        </section></div>`;

      const ta = document.getElementById('mh-text');
      ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.getElementById('mh-compose').requestSubmit(); } });
      ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(160, ta.scrollHeight) + 'px'; });

      // Send text message
      document.getElementById('mh-compose').onsubmit = async (e) => {
        e.preventDefault();
        const text = ta.value.trim(); if (!text || S.sending) return;
        S.sending = true; ta.value = ''; ta.style.height = 'auto';
        const r = await api('POST', '/api/chat-hub/send', { c: S.convo, text });
        S.sending = false;
        if (!r.success) { ta.value = text; return flash(r.error); }
        await loadThread(false); loadSide();
      };

      // Attach file button
      const attachBtn = document.getElementById('mh-attach');
      if (attachBtn) {
        attachBtn.onclick = async () => {
          if (S.sending) return;
          const caption = ta.value.trim();
          attachBtn.disabled = true;
          const r = await window.meridian.api.wsUploadChatMedia(S.convo, caption);
          attachBtn.disabled = false;
          if (r && r.canceled) return;
          if (!r || !r.success) {
            return flash(r ? r.error : 'Upload failed');
          }
          ta.value = '';
          ta.style.height = 'auto';
          await loadThread(false);
          loadSide();
        };
      }

      // Drag and drop file upload onto chat area
      const mainEl = host.querySelector('.mh-main');
      if (mainEl) {
        mainEl.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'copy';
          mainEl.classList.add('drag-over');
        });
        mainEl.addEventListener('dragleave', (e) => {
          if (!mainEl.contains(e.relatedTarget)) {
            mainEl.classList.remove('drag-over');
          }
        });
        mainEl.addEventListener('drop', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          mainEl.classList.remove('drag-over');
          const files = e.dataTransfer.files;
          if (!files || !files.length) return;
          const filePath = files[0].path;
          if (!filePath) return;
          const caption = ta.value.trim();
          const r = await window.meridian.api.wsUploadChatFile(S.convo, filePath, caption);
          if (!r || !r.success) {
            return flash(r ? r.error : 'Upload failed');
          }
          ta.value = '';
          ta.style.height = 'auto';
          await loadThread(false);
          loadSide();
        });
      }

      document.getElementById('mh-thread').addEventListener('click', (e) => {
        const d = e.target.closest('[data-del]');
        if (d) { e.preventDefault(); return deleteMessage(d.dataset.del); }
        const a = e.target.closest('a[data-url]');
        if (a) { e.preventDefault(); window.meridian.openExternal(a.dataset.url); }
      });
    }
    return document.getElementById('mh');
  }

  function flash(msg) {
    const h = document.getElementById('mh-head');
    if (h) {
      const d = document.createElement('div');
      d.className = 'mh-err';
      d.textContent = msg;
      h.appendChild(d);
      setTimeout(() => d.remove(), 4000);
    }
  }

  async function loadSide() {
    const r = await api('GET', '/api/chat-hub/sidebar');
    if (!r || !r.success) return;
    S.side = r;
    const total = r.channels.reduce((a, c) => a + c.unread, 0) + r.people.reduce((a, p) => a + p.unread, 0);
    const navText = document.querySelector('.nav-link[data-view="messages"]');
    if (navText) {
      let b = navText.querySelector('.mh-badge');
      if (!b) { b = document.createElement('span'); b.className = 'nav-badge-pill mh-badge'; navText.appendChild(b); }
      b.textContent = total; b.style.display = total ? '' : 'none';
    }
    const list = document.getElementById('mh-list'); if (!list) return;
    list.innerHTML = `<div class="mh-sec">Channels</div>${r.channels.map((c) => `<button type="button" class="mh-item ${S.convo === 'c:' + c.id ? 'on' : ''} ${c.unread ? 'unread' : ''}" data-c="c:${esc(c.id)}">
          <span class="mh-hash">#</span><span class="mh-name">${esc(c.name)}</span>${c.unread ? `<span class="mh-pill">${c.unread}</span>` : ''}</button>`).join('')}
      <div class="mh-sec">Direct messages</div>${r.people.map((p) => `<button type="button" class="mh-item mh-dm ${S.convo === 'd:' + p.id ? 'on' : ''} ${p.unread ? 'unread' : ''}" data-c="d:${esc(p.id)}">
          <span class="mh-av h${hue(p.id)}">${esc(p.initials)}<i class="${p.online ? 'on' : ''}"></i></span>
          <span class="mh-grow"><span class="mh-name">${esc(p.name)}</span><small>${esc(p.last || p.role)}</small></span>${p.unread ? `<span class="mh-pill">${p.unread}</span>` : ''}</button>`).join('') || '<div class="mh-empty">No teammates yet.</div>'}`;
    list.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => open(b.dataset.c)));
    header();
  }

  function header() {
    const h = document.getElementById('mh-head'); if (!h || !S.side) return;
    const ta = document.getElementById('mh-text');
    if (S.convo.startsWith('c:')) {
      const c = S.side.channels.find((x) => 'c:' + x.id === S.convo) || { name: 'general', topic: '' };
      h.innerHTML = `<span class="mh-hash big">#</span><b>${esc(c.name)}</b><span class="mh-topic">${esc(c.topic)}</span>`;
      if (ta) ta.placeholder = `Message #${c.name}`;
    } else {
      const p = S.side.people.find((x) => 'd:' + x.id === S.convo) || { name: '?', online: false, id: '' };
      h.innerHTML = `<span class="mh-av h${hue(p.id)}">${esc(p.initials || '?')}<i class="${p.online ? 'on' : ''}"></i></span><b>${esc(p.name)}</b><span class="mh-topic">${p.online ? 'Online' : 'Offline'} · ${esc(p.role || '')}</span>`;
      if (ta) ta.placeholder = `Message ${p.name}`;
    }
  }

  async function loadThread(fresh) {
    const t = document.getElementById('mh-thread'); if (!t) return;
    if (fresh) { S.last = 0; t.innerHTML = ''; S.prev = null; }
    const r = await api('GET', `/api/chat-hub/thread?c=${encodeURIComponent(S.convo)}&after=${S.last}`);
    if (!r || !r.success) return;
    const atEnd = t.scrollHeight - t.scrollTop - t.clientHeight < 60;
    if (fresh && !r.messages.length) {
      t.innerHTML = `<div class="mh-welcome"><div class="mh-welcome-ico">${S.convo.startsWith('c:') ? '#' : '✦'}</div><h3>${S.convo.startsWith('c:') ? 'Welcome to the channel' : 'Start a conversation'}</h3><p>Messages here are saved on home base.</p></div>`;
    }
    for (const m of r.messages) {
      const w = t.querySelector('.mh-welcome'); if (w) w.remove();
      const grouped = S.prev && S.prev.sender_id === m.sender_id && m.ts - S.prev.ts < 300 && !m.media && !S.prev.media;
      const div = document.createElement('div');
      div.className = 'mh-msg' + (grouped ? ' cont' : '') + (m.mine ? ' mine' : '');
      div.dataset.mid = m.id;
      const bodyHtml = renderMessageBody(m);
      const del = m.can_delete ? `<button type="button" class="mh-del" data-del="${m.id}" title="Delete message" aria-label="Delete message">Delete</button>` : '';
      div.innerHTML = (grouped ? `<div class="mh-body">${bodyHtml}</div>`
        : `<span class="mh-av h${hue(m.sender_id)}">${esc(m.initials)}</span><div class="mh-col"><div class="mh-meta"><b>${esc(m.sender)}</b><span>${esc(m.time)}</span></div><div class="mh-body">${bodyHtml}</div></div>`) + del;
      t.appendChild(div);
      hydrateMedia(div, m);
      S.prev = m; S.last = m.id;
    }
    if (fresh || atEnd || r.messages.some((m) => m.mine)) t.scrollTop = t.scrollHeight;
    // Someone deleted a message we're showing: redraw the thread without it.
    if (!fresh && (r.deleted || []).some((id) => t.querySelector(`.mh-msg[data-mid="${id}"]`))) return loadThread(true);
  }

  async function deleteMessage(id) {
    if (!confirm('Delete this message for everyone?')) return;
    const r = await api('POST', '/api/chat-hub/delete', { c: S.convo, id: Number(id) });
    if (!r || !r.success) return flash(r ? r.error : 'Could not delete that message.');
    await loadThread(true); loadSide();
  }

  async function open(convo) {
    S.convo = convo;
    document.querySelectorAll('#mh-list .mh-item').forEach((b) => b.classList.toggle('on', b.dataset.c === convo));
    header();
    await loadThread(true);
    loadSide();
    const ta = document.getElementById('mh-text'); if (ta) ta.focus();
  }

  function start() {
    if (!mount()) return;
    loadSide(); loadThread(true);
    clearInterval(S.timer); S.timer = setInterval(() => { if (typeof activeView !== 'undefined' && activeView === 'messages') loadThread(false); }, 3000);
  }

  // Badge stays fresh on every page; full refresh while the Messages page is open
  clearInterval(S.sideTimer);
  S.sideTimer = setInterval(() => { if (typeof currentMe !== 'undefined' && currentMe) loadSide(); }, 8000);
  if (typeof switchView === 'function') {
    const base = switchView;
    // eslint-disable-next-line no-global-assign
    switchView = function (v) { base(v); if (v === 'messages') start(); };
  }
  window.meridianMessages = { open, start };
})();
