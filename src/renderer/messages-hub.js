/* Meridian Connect: team messages, Discord-style (2026-10-07)
 * Channels (#general + one per project) and direct messages with anyone on the team, Jax included.
 * Takes over the Messages page; polls home base every few seconds while open.
 * Chat media (pictures, videos, files) saved in Obsidian vault with sidecar notes (2026-10-08).
 */
'use strict';

(function () {
  const S = { convo: 'c:general', last: 0, side: null, timer: null, sideTimer: null, sending: false, prev: null,
    gen: 0, loading: false, again: false, files: [], filesOpen: false, filesAvailable: false, aiEnabled: false };
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
            <button type="button" class="mh-ask-btn" id="mh-ask" title="Invite Meridian into this project chat" aria-label="Invite Meridian">✦</button>
            <textarea id="mh-text" rows="1" placeholder="Message" aria-label="Message"></textarea>
            <button class="bv-btn" id="mh-send">Send</button>
          </form>
        </section>
        <aside class="mh-files" id="mh-files" aria-label="Project files" hidden>
          <div class="mh-files-head"><div><b>Project files</b><small id="mh-files-project"></small></div><button type="button" id="mh-files-close" aria-label="Close project files">×</button></div>
          <label class="mh-files-search"><span aria-hidden="true">⌕</span><input id="mh-files-search" type="search" placeholder="Search files" aria-label="Search project files"></label>
          <div class="mh-files-actions"><button type="button" id="mh-files-upload">↑ Upload</button><button type="button" id="mh-files-create">＋ Markdown</button><button type="button" id="mh-files-pdf">＋ PDF</button></div>
          <div class="mh-files-list" id="mh-files-list"></div>
          <p class="mh-files-hint">Select a file to share it in this chat. Your project access is checked again when you send.</p>
        </aside></div>
        <dialog class="mh-new-doc" id="mh-new-doc"><form method="dialog" id="mh-new-doc-form">
          <h3 id="mh-new-doc-heading">New Markdown note</h3><label>Title<input id="mh-new-doc-title" maxlength="100" required placeholder="Project brief"></label>
          <label>Content<textarea id="mh-new-doc-content" rows="9" maxlength="50000" placeholder="# Project brief"></textarea></label>
          <div><button type="button" id="mh-new-doc-cancel">Cancel</button><button type="submit">Create note</button></div>
        </form></dialog>`;

      const ta = document.getElementById('mh-text');
      ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.getElementById('mh-compose').requestSubmit(); } });
      ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(160, ta.scrollHeight) + 'px'; });

      // Send text message
      document.getElementById('mh-compose').onsubmit = async (e) => {
        e.preventDefault();
        const text = ta.value.trim(); if (!text || S.sending) return;
        const convo = S.convo;
        if (convo.startsWith('c:p:') && /(?:@meridian\b|\bhey[ ,]+meridian\b)/i.test(text) && !S.aiEnabled) {
          return flash('Shared Meridian is not available on the host yet.');
        }
        S.sending = true; ta.value = ''; ta.style.height = 'auto';
        const r = await api('POST', '/api/chat-hub/send', { c: convo, text });
        S.sending = false;
        if (!r.success) { ta.value = text; return flash(r.error); }
        await loadThread(false); loadSide();
        if (convo.startsWith('c:p:') && /(?:@meridian\b|\bhey[ ,]+meridian\b)/i.test(text)) {
          const reply = await api('POST', '/api/chat-hub/ask-project', { c: convo, message_id: r.message_id });
          if (convo === S.convo) {
            if (!reply || !reply.success) flash(reply ? reply.error : 'Meridian is unavailable.');
            else loadThread(false);
          }
        }
      };
      document.getElementById('mh-ask').onclick = () => {
        if (!projectIdForConvo()) return flash('Open a project chat to invite Meridian.');
        ta.value = (ta.value.trim() ? ta.value.trim() + ' ' : '') + '@Meridian ';
        ta.focus(); ta.dispatchEvent(new Event('input'));
      };

      // Attach file button
      const attachBtn = document.getElementById('mh-attach');
      if (attachBtn) {
        attachBtn.onclick = async () => {
          if (S.sending) return;
          if (S.convo.startsWith('d:')) return flash('Choose a project chat to add files while private-message project placement is being set up.');
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
          loadSide(); loadFiles();
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
          const shared = e.dataTransfer.getData('application/x-meridian-project-file');
          if (shared) {
            try { await shareFile(JSON.parse(shared)); } catch (_) { flash('Could not attach that project file.'); }
            return;
          }
          if (!files || !files.length) return;
          if (S.convo.startsWith('d:')) return flash('Choose a project chat to add files while private-message project placement is being set up.');
          const caption = ta.value.trim();
          const r = await window.meridian.api.wsUploadDroppedChatFile(S.convo, files[0], caption);
          if (!r || !r.success) {
            return flash(r ? r.error : 'Upload failed');
          }
          ta.value = '';
          ta.style.height = 'auto';
          await loadThread(false);
          loadSide(); loadFiles();
        });
      }

      document.getElementById('mh-thread').addEventListener('click', (e) => {
        const d = e.target.closest('[data-del]');
        if (d) { e.preventDefault(); return deleteMessage(d.dataset.del); }
        const a = e.target.closest('a[data-url]');
        if (a) { e.preventDefault(); window.meridian.openExternal(a.dataset.url); }
      });
      document.getElementById('mh-head').addEventListener('click', (e) => {
        if (e.target.closest('#mh-files-toggle')) { S.filesOpen = !S.filesOpen; renderFiles(); header(); }
      });
      document.getElementById('mh-files-close').onclick = () => { S.filesOpen = false; renderFiles(); header(); };
      document.getElementById('mh-files-search').oninput = renderFiles;
      document.getElementById('mh-files-upload').onclick = async () => {
        const projectId = projectIdForConvo();
        if (!projectId) return;
        const r = await window.meridian.api.wsUpload(projectId, 'Files');
        if (!r || !r.success) return flash(r ? r.error : 'Upload failed');
        await loadFiles();
      };
      const newDoc = document.getElementById('mh-new-doc');
      let documentKind = 'md';
      document.getElementById('mh-files-create').onclick = () => {
        documentKind = 'md'; document.getElementById('mh-new-doc-heading').textContent = 'New Markdown note'; newDoc.showModal();
      };
      document.getElementById('mh-files-pdf').onclick = () => {
        documentKind = 'pdf'; document.getElementById('mh-new-doc-heading').textContent = 'New PDF'; newDoc.showModal();
      };
      document.getElementById('mh-new-doc-cancel').onclick = () => newDoc.close();
      document.getElementById('mh-new-doc-form').onsubmit = async (e) => {
        e.preventDefault();
        const title = document.getElementById('mh-new-doc-title').value.trim();
        const content = document.getElementById('mh-new-doc-content').value;
        const r = documentKind === 'pdf'
          ? await window.meridian.api.wsCreateProjectPdf(projectIdForConvo(), title, content)
          : await api('POST', '/api/chat-hub/create-markdown', { c: S.convo, title, content });
        if (!r || !r.success) return flash(r ? r.error : 'Could not create note.');
        newDoc.close(); e.target.reset(); await loadFiles();
      };
      document.getElementById('mh-files-list').addEventListener('click', (e) => {
        const row = e.target.closest('[data-file-index]');
        if (row) shareFile(S.files[Number(row.dataset.fileIndex)]);
      });
      document.getElementById('mh-files-list').addEventListener('dragstart', (e) => {
        const row = e.target.closest('[data-file-index]');
        if (row) e.dataTransfer.setData('application/x-meridian-project-file', JSON.stringify(S.files[Number(row.dataset.fileIndex)]));
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

  const projectIdForConvo = () => S.convo.startsWith('c:p:') ? S.convo.slice(4) : null;

  async function loadCapabilities() {
    let r = null;
    try { r = await api('GET', '/api/chat-hub/capabilities'); } catch (_) { /* unavailable */ }
    S.aiEnabled = !!(r && r.success && r.shared_ai_invite_enabled);
    const firstAvailability = !S.filesAvailable && !!(r && r.success && r.project_files_enabled);
    S.filesAvailable = !!(r && r.success && r.project_files_enabled);
    if (firstAvailability) S.filesOpen = !!projectIdForConvo() && window.innerWidth > 1200;
    if (!S.filesAvailable) S.filesOpen = false;
    header();
    renderFiles();
    if (S.filesAvailable) loadFiles();
  }

  async function loadFiles() {
    const convo = S.convo;
    if (!S.filesAvailable || !projectIdForConvo()) { S.files = []; renderFiles(); return; }
    const r = await api('GET', `/api/chat-hub/project-files?c=${encodeURIComponent(convo)}`);
    if (convo !== S.convo) return;
    if (!r || !r.success) { S.files = []; renderFiles(); return flash(r ? r.error : 'Project files unavailable.'); }
    S.files = r.files || [];
    renderFiles();
  }

  function renderFiles() {
    const drawer = document.getElementById('mh-files');
    const list = document.getElementById('mh-files-list');
    if (!drawer || !list) return;
    const show = S.filesAvailable && !!projectIdForConvo() && S.filesOpen;
    drawer.hidden = !show;
    document.getElementById('mh').classList.toggle('files-open', show);
    if (!show) return;
    const project = S.side?.channels.find((x) => 'c:' + x.id === S.convo);
    document.getElementById('mh-files-project').textContent = `${project?.topic || 'Project'} · ${S.files.length} files`;
    const q = document.getElementById('mh-files-search').value.trim().toLowerCase();
    const groups = [['Pictures', 'image'], ['Documents', 'document'], ['Videos', 'video'], ['Audio', 'audio']];
    list.innerHTML = groups.map(([label, type]) => {
      const rows = S.files.map((f, index) => ({ f, index })).filter(({ f }) => f.type === type && (!q || f.name.toLowerCase().includes(q)));
      if (!rows.length) return '';
      return `<section class="mh-files-group"><h4>${label} <span>${rows.length}</span></h4>${rows.map(({ f, index }) =>
        `<button type="button" class="mh-file" data-file-index="${index}" draggable="true" title="Share ${esc(f.name)} in this chat">
          <span class="mh-file-icon">${type === 'image' ? '▧' : type === 'video' ? '▷' : type === 'audio' ? '♫' : '▤'}</span>
          <span><b>${esc(f.name)}</b><small>${esc(f.section)} · ${esc(f.size_formatted || '')}</small></span><i aria-hidden="true">↗</i></button>`).join('')}</section>`;
    }).join('') || `<p class="mh-empty">${q ? 'No matching files.' : 'No project files yet. Upload one or create a note.'}</p>`;
  }

  async function shareFile(file) {
    if (!file || !projectIdForConvo() || S.sending) return;
    const ta = document.getElementById('mh-text');
    const convo = S.convo;
    const caption = ta.value.trim();
    S.sending = true;
    const body = { c: convo, source: file.source, section: file.section, name: file.name,
      media_id: file.media_id, caption };
    const r = await api('POST', '/api/chat-hub/attach-existing', body);
    S.sending = false;
    if (!r || !r.success) return flash(r ? r.error : 'Could not share file.');
    if (convo === S.convo) {
      ta.value = ''; ta.style.height = 'auto';
      await loadThread(false);
    }
    loadSide();
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
      if (b.textContent !== String(total)) { b.textContent = total; b.style.display = total ? '' : 'none'; }
    }
    const list = document.getElementById('mh-list'); if (!list) return;
    // 2026-10-19: this runs every 8 s on every page; only touch the page when something actually changed.
    const html = `<div class="mh-sec">Channels</div>${r.channels.map((c) => `<button type="button" class="mh-item ${S.convo === 'c:' + c.id ? 'on' : ''} ${c.unread ? 'unread' : ''}" data-c="c:${esc(c.id)}">
          <span class="mh-hash">#</span><span class="mh-name">${esc(c.name)}</span>${c.unread ? `<span class="mh-pill">${c.unread}</span>` : ''}</button>`).join('')}
      <div class="mh-sec">Direct messages</div>${r.people.map((p) => `<button type="button" class="mh-item mh-dm ${S.convo === 'd:' + p.id ? 'on' : ''} ${p.unread ? 'unread' : ''}" data-c="d:${esc(p.id)}">
          <span class="mh-av h${hue(p.id)}">${esc(p.initials)}<i class="${p.online ? 'on' : ''}"></i></span>
          <span class="mh-grow"><span class="mh-name">${esc(p.name)}</span><small>${esc(p.last || p.role)}</small></span>${p.unread ? `<span class="mh-pill">${p.unread}</span>` : ''}</button>`).join('') || '<div class="mh-empty">No teammates yet.</div>'}`;
    if (list._html !== html) {
      list.innerHTML = html; list._html = html;
      list.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => open(b.dataset.c)));
    }
    header();
  }

  function header() {
    const h = document.getElementById('mh-head'); if (!h || !S.side) return;
    const ta = document.getElementById('mh-text');
    let html, placeholder;
    if (S.convo.startsWith('c:')) {
      const c = S.side.channels.find((x) => 'c:' + x.id === S.convo) || { name: 'general', topic: '' };
      html = `<span class="mh-hash big">#</span><b>${esc(c.name)}</b><span class="mh-topic">${esc(c.topic)}</span>${projectIdForConvo() && S.filesAvailable ? `<button type="button" id="mh-files-toggle" aria-expanded="${S.filesOpen}">▤ Files</button>` : ''}`;
      placeholder = `Message #${c.name}`;
    } else {
      const p = S.side.people.find((x) => 'd:' + x.id === S.convo) || { name: '?', online: false, id: '' };
      html = `<span class="mh-av h${hue(p.id)}">${esc(p.initials || '?')}<i class="${p.online ? 'on' : ''}"></i></span><b>${esc(p.name)}</b><span class="mh-topic">${p.online ? 'Online' : 'Offline'} · ${esc(p.role || '')}</span>`;
      placeholder = `Message ${p.name}`;
    }
    if (h._html !== html) { h.innerHTML = html; h._html = html; }   // unchanged: leave it (and any error note) alone
    if (ta) ta.placeholder = placeholder;
    const invite = document.getElementById('mh-ask');
    if (invite) invite.hidden = !projectIdForConvo() || !S.aiEnabled;
  }

  async function loadThread(fresh) {
    const t = document.getElementById('mh-thread'); if (!t) return;
    // 2026-10-19: one request at a time. On a slow connection a poll could overlap the next one (both appended the
    // same messages), and a poll still out when you switched conversations dropped its messages into the new one.
    if (!fresh && S.loading) { S.again = true; return; }
    const gen = ++S.gen;
    S.loading = true;
    if (fresh) { S.last = 0; t.innerHTML = ''; S.prev = null; }
    let r = null;
    try { r = await api('GET', `/api/chat-hub/thread?c=${encodeURIComponent(S.convo)}&after=${S.last}`); } catch (_) { /* offline */ }
    if (gen !== S.gen) return;   // a newer load replaced this one (it owns S.loading now)
    S.loading = false;
    if (S.again) { S.again = false; setTimeout(() => loadThread(false), 0); }
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
    S.filesOpen = S.filesAvailable && !!projectIdForConvo() && window.innerWidth > 1200;
    document.querySelectorAll('#mh-list .mh-item').forEach((b) => b.classList.toggle('on', b.dataset.c === convo));
    header();
    await Promise.all([loadThread(true), loadFiles()]);
    loadSide();
    const ta = document.getElementById('mh-text'); if (ta) ta.focus();
  }

  // 2026-10-19: while Connect is minimized or covered, check every 15 s (thread) / 30 s (badge) instead of 3 s / 8 s,
  // and catch up the moment it is visible again.
  const onMessages = () => typeof activeView !== 'undefined' && activeView === 'messages';
  const signedIn = () => typeof currentMe !== 'undefined' && !!currentMe;
  const due = (key, ms) => { const now = Date.now(); if (now - (S[key] || 0) < ms) return false; S[key] = now; return true; };

  function start() {
    if (!mount()) return;
    document.body.classList.add('view-messages');
    loadCapabilities(); loadSide(); loadThread(true); loadFiles();
    clearInterval(S.timer);
    S.timer = setInterval(() => { if (onMessages() && (!document.hidden || due('hiddenThreadAt', 15000))) loadThread(false); }, 3000);
  }

  // Badge stays fresh on every page; full refresh while the Messages page is open
  clearInterval(S.sideTimer);
  S.sideTimer = setInterval(() => { if (signedIn() && (!document.hidden || due('hiddenSideAt', 30000))) loadSide(); }, 8000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !signedIn()) return;
    loadSide();
    if (onMessages() && document.getElementById('mh-thread')) loadThread(false);
  });
  if (typeof switchView === 'function') {
    const base = switchView;
    // eslint-disable-next-line no-global-assign
    switchView = function (v) { base(v); document.body.classList.toggle('view-messages', v === 'messages'); if (v === 'messages') start(); };
  }
  window.meridianMessages = { open, start };
})();
