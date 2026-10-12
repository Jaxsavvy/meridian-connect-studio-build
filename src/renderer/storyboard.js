/* Meridian Connect: Storyboards (2026-10-08)
 * Lives in the project workspace (Storyboards tab). Panels have a frame (Meridian image generation on home base, or an
 * upload), shot type, camera movement, transition into the next panel, duration, action and VO / on-screen text.
 * Draft with Meridian writes the shot list from a brief. Export makes a PDF sheet. Send to Jax puts it in his review queue.
 */
'use strict';

(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const M = () => window.meridian.api;
  const ST = { board: null, opts: null, quota: null, busy: {}, imgs: new Map(), timers: {}, project: null, ctx: null, showDraft: false };
  const STATUS = { draft: ['Draft', ''], ready: ['With Jax', 'amber'], approved: ['Approved', 'teal'], delivered: ['Delivered', 'blue'] };
  const KIND = { ad: 'Ad', website: 'Website', social: 'Social', other: 'Other' };
  const RATIO = { '16:9': '16 / 9', '9:16': '9 / 16', '1:1': '1 / 1', '4:5': '4 / 5', '16:10': '16 / 10', '9:19.5': '9 / 19.5', '4:3': '4 / 3' };
  const FRAMES = [['16:9', '16:9 wide (YouTube, video hero)'], ['9:16', '9:16 tall (TikTok, Reels, Stories)'], ['1:1', '1:1 square (feed)'], ['4:5', '4:5 portrait (feed)'],
    ['16:10', 'Website: desktop screen'], ['9:19.5', 'Website: phone screen'], ['4:3', 'Website: tablet screen']];
  const FRAME_LABEL = Object.fromEntries(FRAMES.map(([k, l]) => [k, l.replace(/ \(.*\)/, '')]));
  const isTall = (a) => a === '9:16' || a === '4:5' || a === '9:19.5';
  const base = () => `/api/projects/${ST.project.id}/storyboards`;

  function css() {
    if (document.getElementById('sb-style')) return;
    const st = document.createElement('style');
    st.id = 'sb-style';
    st.textContent = `
#pw-host [hidden]{display:none!important}
.sb-voice{padding:10px 14px 0}
.sb-layout{display:grid;grid-template-columns:minmax(0,1fr) 370px;gap:14px;align-items:stretch;height:calc(100vh - 250px);min-height:520px}
.sb-main{display:flex;flex-direction:column;gap:14px;min-width:0;overflow:auto;padding-right:4px}
@media (max-width:1250px){.sb-layout{grid-template-columns:1fr;height:auto}.sb-main{overflow:visible}.sb-ai{height:560px}}
.sb-ai{display:flex;flex-direction:column;min-height:0;border:1px solid #1C2B42;border-radius:14px;
  background:linear-gradient(180deg,#0E1A2B,#0A1422);overflow:hidden}
.sb-aih{display:flex;gap:10px;align-items:center;padding:12px 14px;border-bottom:1px solid #16243A}
.sb-aih i{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;font-style:normal;font:700 13px var(--bv-sans,Inter,sans-serif);color:#fff;
  background:linear-gradient(135deg,#1A84F8,#9B87F5)}
.sb-aih b{display:block;color:#fff;font:600 13.5px var(--bv-sans,Inter,sans-serif)}.sb-aih small{color:#7F93AE;font:400 11.5px var(--bv-sans,Inter,sans-serif)}
.sb-thread{flex:1;overflow:auto;padding:12px 14px;display:flex;flex-direction:column;gap:12px}
.sb-me{align-self:flex-end;max-width:88%;background:#13253D;color:#E4ECF7;border-radius:12px 12px 4px 12px;padding:8px 11px;font:400 13px/1.45 var(--bv-sans,Inter,sans-serif);white-space:pre-wrap}
.sb-mer{color:#DCE5F2;font:400 13px/1.55 var(--bv-sans,Inter,sans-serif)}
.sb-mer p{margin:0 0 8px}.sb-mer ul{margin:0 0 8px;padding-left:18px}
.sb-props{display:grid;gap:6px;margin-top:8px}
.sb-prop{border:1px solid #1F3350;border-radius:10px;padding:8px 10px;background:#0B1626;display:grid;grid-template-columns:1fr auto;gap:4px 8px;align-items:start}
.sb-prop b{color:#fff;font:600 12px/1.4 var(--bv-sans,Inter,sans-serif)}.sb-prop small{grid-column:1;color:#8FA3BE;font:400 11.5px/1.4 var(--bv-sans,Inter,sans-serif)}
.sb-prop button{grid-row:1/3;grid-column:2;align-self:center}
.sb-prop.done{opacity:.55}.sb-prop .ok{color:#34D3B4;font:600 11.5px var(--bv-sans,Inter,sans-serif);grid-row:1/3;grid-column:2;align-self:center}
.sb-mini{border:1px solid #2A4466;background:#0B1A2C;color:#DCE7F5;border-radius:8px;padding:5px 9px;font:600 11.5px var(--bv-sans,Inter,sans-serif);cursor:pointer;white-space:nowrap}
.sb-mini.pri{background:#1A84F8;border-color:#1A84F8;color:#fff}
.sb-plist{margin-top:8px;border:1px solid #1F3350;border-radius:10px;background:#0B1626}
.sb-plist summary{cursor:pointer;padding:8px 10px;color:#5CC8FF;font:600 12px var(--bv-sans,Inter,sans-serif)}
.sb-pi{padding:8px 10px;border-top:1px solid #16243A;display:grid;gap:5px}
.sb-pi b{color:#fff;font:600 11.5px var(--bv-sans,Inter,sans-serif)}
.sb-pi p{margin:0;color:#C5D2E4;font:400 12px/1.45 var(--bv-sans,Inter,sans-serif)}.sb-pi p em{color:#7F93AE;font-style:normal;font-weight:600}
.sb-pi div{display:flex;gap:5px;flex-wrap:wrap}
.sb-src{font:400 11px var(--bv-sans,Inter,sans-serif);color:#7F93AE;margin-top:6px}.sb-src a{color:#5CC8FF;cursor:pointer;text-decoration:none}
.sb-chips{display:flex;gap:5px;flex-wrap:wrap;padding:8px 14px 0}
.sb-chips button{border:1px solid #23395A;background:none;color:#9FB3CC;border-radius:20px;padding:4px 10px;font:500 11.5px var(--bv-sans,Inter,sans-serif);cursor:pointer}
.sb-chips button:hover{border-color:#1A84F8;color:#fff}
.sb-ask{display:flex;gap:6px;padding:10px 14px 12px}
.sb-ask textarea{flex:1;resize:none;min-height:40px;max-height:120px}
.sb-tips{display:grid;gap:6px;padding:10px 14px 0;flex:none;max-height:45%;overflow:auto}
.sb-more-tips{border:0;background:none;color:#F6A85B;font:500 11.5px var(--bv-sans,Inter,sans-serif);cursor:pointer;justify-self:start;padding:0}
.sb-tip{border:1px solid rgba(246,168,91,.28);border-left:3px solid #F6A85B;border-radius:10px;background:rgba(246,168,91,.07);padding:8px 10px;
  display:grid;gap:6px;font:400 12.5px/1.45 var(--bv-sans,Inter,sans-serif);color:#F3DFC6}
.sb-tip .t{display:flex;gap:6px;align-items:baseline}.sb-tip .t a{color:#F6A85B;font-weight:600;cursor:pointer;white-space:nowrap}
.sb-tip .b{display:flex;gap:6px}
.sb-tiphead{display:flex;justify-content:space-between;align-items:center;color:#F6A85B;font:600 10.5px var(--bv-sans,Inter,sans-serif);letter-spacing:.06em;text-transform:uppercase}
.sb-shot{border:1px solid #2A4466;background:#0B1A2C;color:#DCE7F5;border-radius:8px;padding:5px 9px;font:600 11px var(--bv-sans,Inter,sans-serif);cursor:pointer;display:flex;gap:5px;align-items:center}
.sb-shot svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:1.8}
.sb-shot:hover{border-color:#1A84F8;color:#fff}
.sb-att{margin:6px 14px 0;display:flex;gap:8px;align-items:center;padding:6px 8px;border:1px solid #1F3350;border-radius:9px;background:#0B1626;color:#C5D2E4;font:500 11.5px var(--bv-sans,Inter,sans-serif)}
.sb-att img{width:64px;height:40px;object-fit:cover;border-radius:5px;border:1px solid #23395A}
.sb-att button{margin-left:auto;border:0;background:none;color:#7F93AE;cursor:pointer;font-size:14px}
.sb-mute{border:0;background:none;color:#7F93AE;cursor:pointer;font:500 11px var(--bv-sans,Inter,sans-serif);margin-left:auto}
.sb-mute:hover{color:#fff}
.sb-num.tip{box-shadow:0 0 0 2px #F6A85B}
.sb-panel.flash{animation:sbflash 1.2s ease}
@keyframes sbflash{0%,100%{box-shadow:none}30%{box-shadow:0 0 0 2px #F6A85B}}
.sb-typing{color:#8FA3BE;font:400 12px var(--bv-sans,Inter,sans-serif);display:flex;gap:8px;align-items:center}
.sb-typing .sb-spin{width:16px;height:16px;border-width:2px}
.sb-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.sb-bar .pw-grow{min-width:180px}
.sb-title{font:400 22px/1.2 'Source Serif 4',Georgia,serif;color:#fff;background:transparent;border:1px solid transparent;border-radius:8px;padding:4px 8px;min-width:0;width:100%}
.sb-title:hover,.sb-title:focus{border-color:#1F3350;background:#08111D}
.sb-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:10px}
.sb-meta label,.sb-field{display:grid;gap:4px;font:600 10.5px var(--bv-sans,Inter,sans-serif);letter-spacing:.06em;text-transform:uppercase;color:#7F93AE}
.sb-meta .wide{grid-column:1/-1}
.sb-quota{font:400 12px var(--bv-sans,Inter,sans-serif);color:#8FA3BE}
.sb-quota b{color:#5CC8FF;font-weight:600}
.sb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(var(--sb-min,300px),1fr));gap:14px;align-items:start}
.sb-panel{border:1px solid #1C2B42;border-radius:14px;background:#0C1622;overflow:hidden;display:flex;flex-direction:column}
.sb-panel.drag{outline:2px dashed #5CC8FF}
.sb-ph{display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid #16243A}
.sb-num{font:600 12px var(--bv-sans,Inter,sans-serif);color:#fff;background:#13253D;border-radius:7px;padding:3px 8px}
.sb-dur{width:58px;flex:none;text-align:right;padding:6px 6px!important}
.sb-ph{flex-wrap:nowrap}.sb-ph .sb-ico{flex:none;padding:4px}
.sb-ico{border:0;background:none;color:#7F93AE;cursor:pointer;padding:4px 6px;border-radius:6px;font-size:13px;line-height:1}
.sb-ico:hover{color:#fff;background:#13253D}.sb-ico.del:hover{color:#F4889C}
.sb-frame{position:relative;background:#060D17;display:grid;place-items:center;overflow:hidden}
.sb-frame img{width:100%;height:100%;object-fit:cover;display:block}
.sb-empty{display:grid;gap:8px;justify-items:center;color:#5F7491;font:400 12px var(--bv-sans,Inter,sans-serif);text-align:center;padding:10px}
.sb-empty svg{width:28px;height:28px;stroke:#2B4262;fill:none;stroke-width:1.5}
.sb-fbtns{position:absolute;right:8px;bottom:8px;display:flex;gap:6px;opacity:0;transition:opacity .15s}
.sb-frame:hover .sb-fbtns,.sb-frame:focus-within .sb-fbtns{opacity:1}
.sb-fbtns button,.sb-empty button{border:1px solid #2A4466;background:#0B1A2CE6;color:#DCE7F5;border-radius:8px;padding:6px 10px;font:600 11.5px var(--bv-sans,Inter,sans-serif);cursor:pointer}
.sb-empty .gen,.sb-fbtns .gen{background:#1A84F8;border-color:#1A84F8;color:#fff}
.sb-busy{position:absolute;inset:0;background:#050E1ACC;display:grid;place-items:center;align-content:center;gap:8px;color:#BFD0E6;font:500 12px var(--bv-sans,Inter,sans-serif)}
.sb-spin{width:26px;height:26px;border-radius:50%;border:2.5px solid #1F3350;border-top-color:#5CC8FF;animation:sbspin 0.9s linear infinite}
@keyframes sbspin{to{transform:rotate(360deg)}}
.sb-body{padding:10px;display:grid;gap:8px}
.sb-sel{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.sb-sel .tr{grid-column:1/-1}
.sb-sel select,.sb-body textarea,.sb-body input{width:100%}
.sb-sel select{font-size:12px;padding:7px 8px;text-overflow:ellipsis}
.sb-body textarea{resize:vertical;min-height:52px;font-size:12.5px;line-height:1.45}
.sb-more{font:500 11.5px var(--bv-sans,Inter,sans-serif);color:#7F93AE;cursor:pointer}
.sb-more summary{list-style:none}.sb-more summary::-webkit-details-marker{display:none}
.sb-more summary:hover{color:#5CC8FF}
.sb-trans{display:flex;align-items:center;gap:6px;font:500 11px var(--bv-sans,Inter,sans-serif);color:#9B87F5}
.sb-add{border:1.5px dashed #23395A;border-radius:14px;background:none;color:#7F93AE;min-height:160px;cursor:pointer;font:600 13px var(--bv-sans,Inter,sans-serif)}
.sb-add:hover{border-color:#1A84F8;color:#fff}
.sb-saved{font:400 11.5px var(--bv-sans,Inter,sans-serif);color:#34D3B4;min-width:44px}
.sb-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
.sb-card{border:1px solid #1C2B42;border-radius:14px;background:#0C1622;overflow:hidden;cursor:pointer;text-align:left;padding:0;color:inherit;display:flex;flex-direction:column}
.sb-card:hover{border-color:#2A4E7E}
.sb-cover{aspect-ratio:16/9;background:#060D17 center/cover no-repeat;display:grid;place-items:center;color:#2B4262;font:600 12px var(--bv-sans,Inter,sans-serif)}
.sb-cinfo{padding:10px 12px;display:grid;gap:4px}
.sb-cinfo b{color:#fff;font:600 14px var(--bv-sans,Inter,sans-serif)}
.sb-cinfo small{color:#7F93AE;font:400 11.5px var(--bv-sans,Inter,sans-serif)}
.sb-new{display:grid;gap:10px}
.sb-check{display:flex;gap:8px;align-items:center;color:#C5D2E4;font:400 12.5px var(--bv-sans,Inter,sans-serif)}`;
    document.head.appendChild(st);
  }

  const ICON_FRAME = '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 8"/></svg>';
  const opt = (list, cur) => list.map((o) => `<option ${o === cur ? 'selected' : ''}>${esc(o)}</option>`).join('');
  const err = (m) => ST.ctx && ST.ctx.err(m);

  // ------------------------------------------------------------ entry
  async function render(body, project, ctx) {
    css();
    ST.project = project; ST.ctx = ctx;
    if (ST.board && ST.board.project_id === project.id) return openBoard(body, ST.board.id);
    ST.board = null;
    const r = await M().ws('GET', base());
    if (!r || !r.success) { body.innerHTML = `<div class="pw-empty">${esc((r && r.error) || 'Storyboards could not be loaded.')}</div>`; return; }
    ST.opts = r.options; ST.quota = r.quota;
    const list = r.storyboards || [];
    body.innerHTML = `<section class="pw-card"><h3>Storyboards <small>plan ads and website stories shot by shot, with Meridian frames</small></h3>
      <div class="sb-bar"><button type="button" class="pw-btn" id="sb-new-btn">New storyboard</button><span class="pw-grow"></span>${quotaHtml()}</div>
      <form class="sb-new" id="sb-new" hidden style="margin-top:12px">
        <div class="sb-meta">
          <label class="wide">Title<input class="pw-in" id="sbn-title" placeholder="e.g. Spring roof special, 15s TikTok" required maxlength="150"></label>
          <label>Type<select class="pw-in" id="sbn-kind">${Object.entries(KIND).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
          <label>Frame<select class="pw-in" id="sbn-aspect">${FRAMES.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
          <label class="wide">Look / style <input class="pw-in" id="sbn-style" placeholder="e.g. photoreal, warm golden hour, shallow depth of field (keeps every frame consistent)" maxlength="600"></label>
          <label class="wide">Brief <textarea class="pw-in" id="sbn-brief" rows="3" placeholder="What is it for, who is it for, the offer, the feeling. Meridian uses this to draft the shots." maxlength="4000"></textarea></label>
        </div>
        <label class="sb-check"><input type="checkbox" class="pw-chk" id="sbn-draft" checked> Have Meridian draft the shot list from the brief</label>
        <div class="pw-form"><button class="pw-btn" id="sbn-go">Create storyboard</button><button type="button" class="pw-btn q" id="sbn-cancel">Cancel</button><span class="pw-empty" id="sbn-status" style="padding:6px 0"></span></div>
      </form></section>
      <section class="sb-cards" id="sb-cards">${list.map(cardHtml).join('') || '<div class="pw-empty">No storyboards yet. Start one for an ad, a social post or a website scroll story.</div>'}</section>`;
    const form = body.querySelector('#sb-new');
    const kindSel = body.querySelector('#sbn-kind'), aspSel = body.querySelector('#sbn-aspect');
    kindSel.onchange = () => {   // website boards start on a desktop screen; video boards on 16:9
      const web = ['16:10', '9:19.5', '4:3'].includes(aspSel.value);
      if (kindSel.value === 'website' && !web) aspSel.value = '16:10';
      if (kindSel.value !== 'website' && web) aspSel.value = kindSel.value === 'social' ? '9:16' : '16:9';
    };
    body.querySelector('#sb-new-btn').onclick = () => { form.hidden = false; body.querySelector('#sbn-title').focus(); };
    body.querySelector('#sbn-cancel').onclick = () => { form.hidden = true; };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const go = body.querySelector('#sbn-go'), st = body.querySelector('#sbn-status');
      const brief = body.querySelector('#sbn-brief').value.trim();
      const wantDraft = body.querySelector('#sbn-draft').checked && brief;
      go.disabled = true; st.textContent = 'Creating…';
      const c = await M().ws('POST', base(), { title: body.querySelector('#sbn-title').value, kind: body.querySelector('#sbn-kind').value,
        aspect: body.querySelector('#sbn-aspect').value, style: body.querySelector('#sbn-style').value, brief, panels: wantDraft ? 1 : 4 });
      if (!c.success) { go.disabled = false; st.textContent = ''; return err(c.error); }
      ST.board = c.storyboard;
      if (wantDraft) {
        st.textContent = 'Meridian is writing the shot list… (about a minute)';
        const d = await M().ws('POST', `${base()}/${c.storyboard.id}/draft`, { brief, count: 6, replace: true });
        if (!d.success) err(d.error + ' You can draft again from the board.');
        else ST.board = d.storyboard;
      }
      openBoard(body, ST.board.id);
    };
    body.querySelectorAll('[data-board]').forEach((b) => (b.onclick = () => openBoard(body, b.dataset.board)));
    list.filter((b) => b.cover).forEach(async (b) => {
      const u = await frameUrl(b.id, b.cover, b.updated);
      const el = body.querySelector(`[data-cover="${b.id}"]`);
      if (u && el) { el.style.backgroundImage = `url("${u}")`; el.textContent = ''; }
    });
  }

  function quotaHtml() {
    const q = ST.quota;
    if (!q) return '';
    if (q.unlimited) return `<span class="sb-quota">Frames today: <b>${q.used}</b> (no limit for you)</span>`;
    return `<span class="sb-quota">Frames left today: <b>${q.left}</b> of ${q.cap}</span>`;
  }

  function cardHtml(b) {
    const s = STATUS[b.status] || STATUS.draft;
    return `<button type="button" class="sb-card" data-board="${b.id}"><div class="sb-cover" data-cover="${b.id}">${b.cover ? '' : esc(b.aspect)}</div>
      <div class="sb-cinfo"><b>${esc(b.title)}</b><small>${esc(KIND[b.kind] || b.kind)} · ${esc(FRAME_LABEL[b.aspect] || b.aspect)} · ${b.panel_count} panels · ${b.runtime}s</small>
      <small><span class="tk-st ${s[1]}">${s[0]}</span> ${esc(b.author)} · ${esc(b.updated)}</small></div></button>`;
  }

  async function frameUrl(bid, pid, v) {
    const key = `${pid}:${v}`;
    if (ST.imgs.has(key)) return ST.imgs.get(key);
    const r = await M().wsImage(`${base()}/${bid}/panels/${pid}/image?v=${encodeURIComponent(v || '')}`);
    const u = r && r.success ? r.url : null;
    if (u) ST.imgs.set(key, u);
    return u;
  }

  // ------------------------------------------------------------ board
  async function openBoard(body, bid) {
    const r = await M().ws('GET', `${base()}/${bid}`);
    if (!r || !r.success) { ST.board = null; err((r && r.error) || 'That storyboard could not be opened.'); return render(body, ST.project, ST.ctx); }
    ST.board = r.storyboard; ST.opts = r.options; ST.quota = r.quota;
    if (ST.turnsFor !== bid) {
      const t = await M().ws('GET', `${base()}/${bid}/assist`);
      ST.turns = (t && t.success && t.turns) || []; ST.turnsFor = bid;
    }
    drawBoard(body);
    coachNow('open');
  }

  function locked() {
    const owner = typeof currentMe !== 'undefined' && currentMe && currentMe.is_owner;
    return (ST.board.status === 'approved' || ST.board.status === 'delivered') && !owner;
  }

  function drawBoard(body) {
    const b = ST.board, s = STATUS[b.status] || STATUS.draft, lock = locked(), o = ST.opts;
    const prevMain = body.querySelector('.sb-main'), keepScroll = prevMain ? prevMain.scrollTop : 0;
    body.innerHTML = `<div class="sb-layout"><div class="sb-main"><section class="pw-card">
      <div class="sb-bar"><button type="button" class="pw-btn q" id="sb-back">All storyboards</button><span class="pw-grow"></span>
        <span class="tk-st ${s[1]}">${s[0]}</span>${quotaHtml()}<span class="sb-saved" id="sb-saved"></span></div>
      ${b.jax_note ? `<div class="tk-note" style="margin-top:10px">Jax: ${esc(b.jax_note)}</div>` : ''}
      <input class="sb-title" id="sb-title" value="${esc(b.title)}" ${lock ? 'disabled' : ''} aria-label="Storyboard title" style="margin-top:8px">
      <div class="sb-meta">
        <label>Type<select class="pw-in" data-meta="kind" ${lock ? 'disabled' : ''}>${Object.entries(KIND).map(([k, l]) => `<option value="${k}" ${k === b.kind ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label>Frame<select class="pw-in" data-meta="aspect" ${lock ? 'disabled' : ''}>${FRAMES.filter(([k]) => o.aspects.includes(k)).map(([k, l]) => `<option value="${k}" ${k === b.aspect ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label>Runtime<input class="pw-in" value="${b.runtime}s · ${b.panel_count} panels" disabled></label>
        <label class="wide">Look / style (used in every frame)<input class="pw-in" data-meta="style" value="${esc(b.style)}" ${lock ? 'disabled' : ''} maxlength="600" placeholder="e.g. photoreal, warm golden hour, 35mm film grain"></label>
      </div>
      <div class="pw-form" style="margin-top:12px">${lock ? '<span class="pw-empty">Approved by Jax. Ask Jax for changes.</span>' : `
        <button type="button" class="pw-btn" id="sb-draft-btn">Draft shots with Meridian</button>
        <button type="button" class="pw-btn q" id="sb-genall">Generate empty frames</button>`}
        <button type="button" class="pw-btn q" id="sb-pdf">Export PDF</button>
        ${lock ? '' : b.status === 'draft' ? '<button type="button" class="pw-btn" id="sb-send">Send to Jax for review</button>' : b.status === 'ready' ? '<button type="button" class="pw-btn q" id="sb-pull">Pull back to draft</button>' : ''}
        ${lock ? '' : '<button type="button" class="pw-btn q" id="sb-del">Delete</button>'}</div>
      <form id="sb-draft" ${ST.showDraft ? '' : 'hidden'} style="margin-top:12px;display:grid;gap:8px">
        <textarea class="pw-in" id="sb-brief" rows="3" maxlength="4000" placeholder="Brief: what it is for, who it is for, the offer, the feeling">${esc(b.brief)}</textarea>
        <div class="pw-form"><select class="pw-in" id="sb-count">${[4, 6, 8, 10, 12].map((n) => `<option value="${n}" ${n === 6 ? 'selected' : ''}>${n} shots</option>`).join('')}</select>
          <button class="pw-btn" id="sb-draft-go">Write the shot list</button><span class="pw-empty" style="padding:6px 0">Empty panels are replaced; panels with a frame or text are kept.</span></div>
      </form></section>
      <section class="sb-grid" id="sb-grid" style="--sb-min:${isTall(b.aspect) ? '220px' : '300px'}">
        ${b.panels.map((p, i) => panelHtml(p, i, lock)).join('')}
        ${lock ? '' : '<button type="button" class="sb-add" id="sb-add">+ Add panel</button>'}
      </section></div><aside class="sb-ai" id="sb-ai" aria-label="Meridian AI"></aside></div>`;
    wireBoard(body);
    drawAI();
    const main = body.querySelector('.sb-main'); if (main && keepScroll) main.scrollTop = keepScroll;
    b.panels.filter((p) => p.has_image).forEach((p) => loadFrame(p));
  }

  function panelHtml(p, i, lock) {
    const o = ST.opts, dis = lock ? 'disabled' : '', last = i === ST.board.panels.length - 1;
    return `<article class="sb-panel" data-p="${p.id}">
      <div class="sb-ph"><span class="sb-num ${(ST.tips || []).some((t) => t.panel_id === p.id) ? 'tip' : ''}" ${(ST.tips || []).some((t) => t.panel_id === p.id) ? 'title="Meridian has a tip for this panel"' : ''}>${i + 1}</span>
        <input class="pw-in sb-dur" type="number" min="0.5" max="120" step="0.5" value="${p.duration}" data-f="duration" ${dis} aria-label="Seconds"><small style="color:#7F93AE">sec</small>
        <span class="pw-grow"></span>${lock ? '' : `<button type="button" class="sb-ico" data-act="left" title="Move earlier" aria-label="Move earlier">◀</button>
        <button type="button" class="sb-ico" data-act="right" title="Move later" aria-label="Move later">▶</button>
        <button type="button" class="sb-ico" data-act="insert" title="Add a panel after this" aria-label="Add a panel after this">＋</button>
        <button type="button" class="sb-ico del" data-act="delete" title="Delete panel" aria-label="Delete panel">✕</button>`}</div>
      <div class="sb-frame" style="aspect-ratio:${RATIO[ST.board.aspect] || '16 / 9'}" data-frame>
        ${p.has_image ? '<div class="sb-busy"><div class="sb-spin"></div></div>' : `<div class="sb-empty">${ICON_FRAME}${lock ? 'No frame' : `<div style="display:flex;gap:6px"><button type="button" class="gen" data-act="gen">Generate frame</button><button type="button" data-act="upload">Upload</button></div>`}</div>`}
        ${ST.busy[p.id] ? '<div class="sb-busy"><div class="sb-spin"></div><span>Meridian is drawing this frame…</span></div>' : ''}
        ${p.has_image && !lock ? '<div class="sb-fbtns"><button type="button" class="gen" data-act="gen">Regenerate</button><button type="button" data-act="upload">Upload</button><button type="button" data-act="clear">Remove</button></div>' : ''}
      </div>
      <div class="sb-body">
        <div class="sb-sel">
          <label class="sb-field">Shot<select class="pw-in" data-f="shot" ${dis}>${opt(o.shots, p.shot)}</select></label>
          <label class="sb-field">Camera<select class="pw-in" data-f="camera" ${dis}>${opt(o.cameras, p.camera)}</select></label>
          <label class="sb-field tr">${last ? 'Transition (end of piece)' : `Transition into ${i + 2}`}<select class="pw-in" data-f="transition" ${dis}>${opt(o.transitions, p.transition)}</select></label>
        </div>
        <label class="sb-field">What we see<textarea class="pw-in" data-f="action" rows="2" ${dis} placeholder="Action, subject, setting">${esc(p.action)}</textarea></label>
        <label class="sb-field">VO / on-screen text<textarea class="pw-in" data-f="voiceover" rows="1" ${dis} placeholder="Optional">${esc(p.voiceover)}</textarea></label>
        <details class="sb-more" ${p.prompt ? 'open' : ''}><summary>Image prompt ${p.prompt ? '' : '(optional, overrides "What we see" for the frame)'}</summary>
          <textarea class="pw-in" data-f="prompt" rows="2" ${dis} style="margin-top:6px" placeholder="Exact description for the image model">${esc(p.prompt)}</textarea></details>
      </div></article>`;
  }

  async function loadFrame(p) {
    const el = document.querySelector(`.sb-panel[data-p="${p.id}"] [data-frame]`);
    if (!el) return;
    const u = await frameUrl(ST.board.id, p.id, p.v);
    const busy = el.querySelector('.sb-busy');
    if (u) { const img = document.createElement('img'); img.alt = `Frame ${p.pos + 1}`; img.src = u; el.prepend(img); }
    if (busy && !ST.busy[p.id]) busy.remove();
  }

  function saved(t) { const s = document.getElementById('sb-saved'); if (s) { s.textContent = t; clearTimeout(ST.timers._s); ST.timers._s = setTimeout(() => { s.textContent = ''; }, 1600); } }

  function panelValues(card) {
    const v = {};
    card.querySelectorAll('[data-f]').forEach((f) => { v[f.dataset.f] = f.value; });
    return v;
  }

  function wireBoard(body) {
    const b = ST.board;
    body.querySelector('#sb-back').onclick = () => { ST.board = null; ST.ctx.rerender(); };
    body.querySelector('#sb-pdf').onclick = () => exportPdf();
    if (locked()) return;
    const saveMeta = async (patch) => {
      const r = await M().ws('POST', `${base()}/${b.id}`, patch);
      if (!r.success) return err(r.error);
      const aspectChanged = patch.aspect && patch.aspect !== b.aspect;
      Object.assign(ST.board, r.storyboard);
      saved('Saved');
      if (aspectChanged) drawBoard(body);
    };
    const t = body.querySelector('#sb-title');
    t.onchange = () => saveMeta({ title: t.value });
    body.querySelectorAll('[data-meta]').forEach((f) => (f.onchange = () => saveMeta({ [f.dataset.meta]: f.value })));
    body.querySelector('#sb-draft-btn').onclick = () => { ST.showDraft = !ST.showDraft; body.querySelector('#sb-draft').hidden = !ST.showDraft; if (ST.showDraft) body.querySelector('#sb-brief').focus(); };
    body.querySelector('#sb-draft').onsubmit = async (e) => {
      e.preventDefault();
      const go = body.querySelector('#sb-draft-go');
      go.disabled = true; go.textContent = 'Meridian is writing…';
      const r = await M().ws('POST', `${base()}/${b.id}/draft`, { brief: body.querySelector('#sb-brief').value, count: +body.querySelector('#sb-count').value, replace: true });
      go.disabled = false; go.textContent = 'Write the shot list';
      if (!r.success) return err(r.error);
      ST.board = r.storyboard; ST.showDraft = false; err(''); drawBoard(body);
    };
    body.querySelector('#sb-genall').onclick = async () => {
      const todo = ST.board.panels.filter((p) => !p.has_image && (p.action.trim() || p.prompt.trim()));
      if (!todo.length) return err('Every panel with a description already has a frame.');
      if (!confirm(`Generate ${todo.length} frame${todo.length > 1 ? 's' : ''}? Each one counts toward today's limit.`)) return;
      for (const p of todo) { if (await generate(p.id) === false) break; }
    };
    const send = body.querySelector('#sb-send');
    if (send) send.onclick = () => {
      const box = document.createElement('form');
      box.className = 'pw-form'; box.style.cssText = 'margin-top:10px;width:100%';
      box.innerHTML = '<input class="pw-in grow" id="sb-note" maxlength="1000" placeholder="Anything Jax should know? (optional)"><button class="pw-btn">Send</button><button type="button" class="pw-btn q" id="sb-note-x">Cancel</button>';
      send.closest('.pw-form').after(box);
      send.disabled = true;
      box.querySelector('#sb-note').focus();
      box.querySelector('#sb-note-x').onclick = () => { box.remove(); send.disabled = false; };
      box.onsubmit = async (e) => {
        e.preventDefault();
        const r = await M().ws('POST', `${base()}/${b.id}/submit`, { note: box.querySelector('#sb-note').value });
        if (!r.success) return err(r.error);
        ST.board = { ...ST.board, ...r.storyboard }; drawBoard(body); saved('Sent to Jax');
      };
    };
    const pull = body.querySelector('#sb-pull');
    if (pull) pull.onclick = () => saveMeta({ status: 'draft' }).then(() => drawBoard(body));
    body.querySelector('#sb-del').onclick = async () => {
      if (!confirm('Delete this storyboard? Its frames stay in the project folder.')) return;
      const r = await M().ws('POST', `${base()}/${b.id}/delete`, {});
      if (!r.success) return err(r.error);
      ST.board = null; ST.ctx.rerender();
    };
    const add = body.querySelector('#sb-add');
    if (add) add.onclick = () => panelAct(null, 'add');

    body.querySelectorAll('.sb-panel').forEach((card) => {
      const pid = card.dataset.p;
      card.querySelectorAll('[data-f]').forEach((f) => {
        const ev = f.tagName === 'SELECT' || f.type === 'number' ? 'change' : 'input';
        f.addEventListener(ev, () => {
          clearTimeout(ST.timers[pid]);
          ST.timers[pid] = setTimeout(async () => {
            const v = panelValues(card);
            const r = await M().ws('POST', `${base()}/${b.id}/panels/${pid}`, v);
            if (!r.success) return err(r.error);
            const p = ST.board.panels.find((x) => x.id === pid);
            if (p) Object.assign(p, v, { duration: parseFloat(v.duration) || p.duration });
            saved('Saved');
            scheduleCoach();
          }, f.tagName === 'TEXTAREA' ? 700 : 150);
        });
      });
      card.querySelectorAll('[data-act]').forEach((btn) => (btn.onclick = () => panelAct(pid, btn.dataset.act)));
    });
  }

  async function panelAct(pid, act) {
    const b = ST.board, body = document.getElementById('pw-body');
    if (act === 'add' || act === 'insert') {
      const r = await M().ws('POST', `${base()}/${b.id}/panels`, act === 'insert' ? { after: pid } : {});
      if (!r.success) return err(r.error);
      ST.board = r.storyboard; return drawBoard(body);
    }
    if (act === 'left' || act === 'right') {
      const r = await M().ws('POST', `${base()}/${b.id}/panels/${pid}/move`, { dir: act === 'left' ? -1 : 1 });
      if (!r.success) return err(r.error);
      ST.board = r.storyboard; return drawBoard(body);
    }
    if (act === 'delete') {
      if (!confirm('Delete this panel?')) return;
      const r = await M().ws('POST', `${base()}/${b.id}/panels/${pid}/delete`, {});
      if (!r.success) return err(r.error);
      ST.board = r.storyboard; return drawBoard(body);
    }
    if (act === 'clear') {
      const r = await M().ws('POST', `${base()}/${b.id}/panels/${pid}/image/clear`, {});
      if (!r.success) return err(r.error);
      return openBoard(body, b.id);
    }
    if (act === 'upload') {
      const r = await M().wsUploadImage(`${base()}/${b.id}/panels/${pid}/image/upload`);
      if (!r.success) return err(r.error);
      if (r.uploaded) return openBoard(body, b.id);
      return;
    }
    if (act === 'gen') return generate(pid);
  }

  async function generate(pid) {
    const b = ST.board;
    const card = document.querySelector(`.sb-panel[data-p="${pid}"]`);
    if (!card || ST.busy[pid]) return;
    const v = panelValues(card);
    if (!(v.action || '').trim() && !(v.prompt || '').trim()) { err('Describe the shot in "What we see" first.'); return false; }
    ST.busy[pid] = true; err('');
    const frame = card.querySelector('[data-frame]');
    const cover = document.createElement('div');
    cover.className = 'sb-busy';
    cover.innerHTML = '<div class="sb-spin"></div><span>Meridian is drawing this frame…</span><small style="color:#7F93AE">usually 20–60 seconds</small>';
    frame.appendChild(cover);
    const r = await M().ws('POST', `${base()}/${b.id}/panels/${pid}/generate`, { action: v.action, prompt: v.prompt, shot: v.shot, camera: v.camera });
    ST.busy[pid] = false;
    if (r && r.quota) ST.quota = r.quota;
    if (!r || !r.success) { cover.remove(); err((r && r.error) || 'The frame could not be made.'); return false; }
    const p = b.panels.find((x) => x.id === pid);
    if (p) { p.has_image = true; p.v = r.v; Object.assign(p, { action: v.action, prompt: v.prompt }); }
    if (ST.board === b) drawBoard(document.getElementById('pw-body'));
    coachNow('frame', pid);
    return true;
  }

  // ------------------------------------------------------------ PDF
  async function exportPdf() {
    const b = ST.board, btn = document.getElementById('sb-pdf');
    if (btn) { btn.disabled = true; btn.textContent = 'Preparing…'; }
    const frames = {};
    for (const p of b.panels.filter((x) => x.has_image)) frames[p.id] = await frameUrl(b.id, p.id, p.v);
    const tall = isTall(b.aspect);
    const cols = tall ? 4 : 3;
    const proj = ST.project;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(b.title)}</title><style>
      *{box-sizing:border-box}body{margin:0;font-family:"Segoe UI",Inter,Arial,sans-serif;color:#13202F;background:#fff}
      header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #13202F;padding-bottom:8px;margin-bottom:12px}
      h1{font-family:Georgia,"Source Serif 4",serif;font-weight:400;font-size:24px;margin:0}
      .sub{font-size:11px;color:#55657A;margin-top:3px}.right{text-align:right;font-size:11px;color:#55657A}
      .brief{font-size:11px;color:#223246;margin:0 0 12px;line-height:1.45}
      .grid{display:grid;grid-template-columns:repeat(${cols},1fr);gap:12px}
      .p{break-inside:avoid;border:1px solid #CBD5E1;border-radius:6px;overflow:hidden}
      .f{aspect-ratio:${RATIO[b.aspect] || '16 / 9'};background:#E8EDF3;display:flex;align-items:center;justify-content:center;color:#8A9AB0;font-size:11px}
      .f img{width:100%;height:100%;object-fit:cover;display:block}
      .m{padding:6px 8px;font-size:9.5px;line-height:1.4}
      .n{display:flex;justify-content:space-between;font-weight:700;font-size:10.5px;margin-bottom:3px}
      .tags{color:#334155;margin-bottom:3px}.tags b{font-weight:600}
      .a{color:#13202F}.vo{color:#6D28D9;margin-top:2px}.tr{color:#0F766E;margin-top:3px;font-weight:600}
      footer{margin-top:10px;font-size:9px;color:#8A9AB0;text-align:right}
    </style></head><body>
      <header><div><h1>${esc(b.title)}</h1><div class="sub">${esc(proj.client || 'Breakthrough Ventures')} · ${esc(proj.name)} · ${esc(KIND[b.kind] || b.kind)} · ${esc(FRAME_LABEL[b.aspect] || b.aspect)}</div></div>
        <div class="right">${b.panels.length} panels · ${b.runtime}s<br>${esc((STATUS[b.status] || STATUS.draft)[0])} · ${new Date().toLocaleDateString()}</div></header>
      ${b.brief ? `<p class="brief"><b>Brief:</b> ${esc(b.brief)}</p>` : ''}${b.style ? `<p class="brief"><b>Look:</b> ${esc(b.style)}</p>` : ''}
      <div class="grid">${b.panels.map((p, i) => `<div class="p"><div class="f">${frames[p.id] ? `<img src="${frames[p.id]}">` : 'No frame'}</div>
        <div class="m"><div class="n"><span>${i + 1}</span><span>${p.duration}s</span></div>
        <div class="tags"><b>${esc(p.shot)}</b> · ${esc(p.camera)}</div>
        ${p.action ? `<div class="a">${esc(p.action)}</div>` : ''}${p.voiceover ? `<div class="vo">VO: ${esc(p.voiceover)}</div>` : ''}
        <div class="tr">${i === b.panels.length - 1 ? '■ ' : '→ '}${esc(p.transition)}</div></div></div>`).join('')}</div>
      <footer>Breakthrough Ventures · Meridian Connect storyboard</footer></body></html>`;
    const r = await M().wsExportPdf(html, `${b.title} storyboard`);
    if (btn) { btn.disabled = false; btn.textContent = 'Export PDF'; }
    if (!r.success) return err(r.error);
    if (r.saved) { err(''); const s = document.getElementById('sb-saved'); if (s) { s.textContent = 'PDF saved'; } }
  }

  // ------------------------------------------------------------ Meridian AI beside the board
  const fmt = (t) => (window.meridianFmt ? window.meridianFmt(t) : `<p>${esc(t)}</p>`);
  const CHIPS = ['What do you see?', 'Review this board', 'Punch up the hook', 'Write the prompt list', 'Fix the pacing', 'Better transitions', 'Plan the website sections'];

  function drawAI() {
    const box = document.getElementById('sb-ai');
    if (!box) return;
    const lock = locked();
    box.innerHTML = `<div class="sb-aih"><i>M</i><div><b>Meridian</b><small>Creative director · suggests, you apply</small></div>
        <button type="button" class="sb-shot" id="sb-shot" title="Send Meridian a snapshot of this window with your next question"><svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>Show</button>
        ${lock ? '' : `<button type="button" class="sb-mute" id="sb-mute" title="${ST.muted ? 'Turn tips back on' : 'Stop tips while you build'}">${ST.muted ? 'Tips off' : 'Tips on'}</button>`}</div>
      <div class="sb-voice" id="sb-voice"></div>
      <div class="sb-tips" id="sb-tips"></div>
      <div class="sb-thread" id="sb-thread">${(ST.turns || []).map((t) => turnHtml(t, lock)).join('') ||
        `<div class="sb-mer"><p>I can review this board, suggest fixes and ideas, tighten the pacing, and write an image + video prompt for every panel. Nothing changes until you click Apply.</p></div>`}
        ${ST.aiBusy ? '<div class="sb-typing"><div class="sb-spin"></div>Meridian is working on the board… (can take a minute)</div>' : ''}</div>
      <div class="sb-chips">${CHIPS.filter((c) => c !== 'Plan the website sections' || ST.board.kind === 'website').map((c) => `<button type="button" data-chip="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      ${ST.screen ? `<div class="sb-att">${ST.screenUrl ? `<img src="${ST.screenUrl}" alt="">` : ''}<span>Your screen is attached to the next question</span><button type="button" id="sb-att-x" aria-label="Remove snapshot">✕</button></div>` : ''}
      <form class="sb-ask" id="sb-ask"><textarea class="pw-in" id="sb-ask-q" rows="2" placeholder="Ask for ideas, fixes or prompts…" aria-label="Ask Meridian">${esc(ST.aiDraft || '')}</textarea>
        <button class="pw-btn" ${ST.aiBusy ? 'disabled' : ''}>Ask</button></form>`;
    const th = box.querySelector('#sb-thread'); th.scrollTop = th.scrollHeight;
    drawTips();
    if (window.meridianVoice) window.meridianVoice.mount(box.querySelector('#sb-voice'), { onText: (t) => ask(t) });
    box.querySelector('#sb-shot').onclick = () => snapshot();
    const ax = box.querySelector('#sb-att-x'); if (ax) ax.onclick = () => { ST.screen = null; ST.screenUrl = null; drawAI(); };
    const mute = box.querySelector('#sb-mute');
    if (mute) mute.onclick = async () => {
      const r = await M().ws('POST', `${base()}/${ST.board.id}/coach/mute`, { muted: !ST.muted });
      if (r && r.success) { ST.muted = r.muted; if (ST.muted) ST.tips = []; drawAI(); markTipPanels(); if (!ST.muted) coachNow('open'); }
    };
    const q = box.querySelector('#sb-ask-q');
    q.oninput = () => { ST.aiDraft = q.value; };
    q.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); box.querySelector('#sb-ask').requestSubmit(); } };
    box.querySelector('#sb-ask').onsubmit = (e) => { e.preventDefault(); ask(q.value); };
    box.querySelectorAll('[data-chip]').forEach((c) => (c.onclick = async () => {
      if (c.dataset.chip === 'What do you see?') { if (await snapshot()) ask('Look at my screen and the frames: what is weak right now, and what would you change first?'); return; }
      ask(c.dataset.chip);
    }));
    box.querySelectorAll('[data-apply]').forEach((btn) => (btn.onclick = () => applyProps(btn.dataset.turn, btn.dataset.apply === '*' ? null : [btn.dataset.apply])));
    box.querySelectorAll('[data-copy]').forEach((btn) => (btn.onclick = () => copyText(btn.dataset.copy === '*' ? allPrompts(btn.dataset.turn) : promptText(btn.dataset.turn, +btn.dataset.i, btn.dataset.copy), btn)));
    box.querySelectorAll('[data-use]').forEach((btn) => (btn.onclick = () => usePrompt(btn.dataset.turn, +btn.dataset.use, btn)));
    box.querySelectorAll('[data-src]').forEach((a) => (a.onclick = () => window.meridian.openExternal(a.dataset.src)));
  }

  function turnHtml(t, lock) {
    const applied = new Set(t.applied || []);
    const open = (t.proposals || []).filter((p) => !applied.has(p.id));
    return `<div class="sb-me">${esc(t.message)}</div><div class="sb-mer">${fmt(t.reply)}
      ${(t.proposals || []).length ? `<div class="sb-props">${t.proposals.map((p) => `<div class="sb-prop ${applied.has(p.id) ? 'done' : ''}"><b>${esc(p.label)}</b>
        <small>${esc(p.reason || '')}</small>${applied.has(p.id) ? '<span class="ok">Applied</span>' : lock ? '' : `<button type="button" class="sb-mini" data-turn="${t.id}" data-apply="${p.id}">${p.type === 'generate' ? 'Generate' : 'Apply'}</button>`}</div>`).join('')}
        ${open.length > 1 && !lock ? `<div><button type="button" class="sb-mini pri" data-turn="${t.id}" data-apply="*">Apply all ${open.length}</button></div>` : ''}</div>` : ''}
      ${(t.prompts || []).length ? `<details class="sb-plist" ${t === ST.turns[ST.turns.length - 1] ? 'open' : ''}><summary>Prompt list · ${t.prompts.length} panels</summary>
        ${t.prompts.map((it, i) => `<div class="sb-pi"><b>Panel ${it.panel_n}</b><p><em>Image</em> ${esc(it.image_prompt)}</p><p><em>Video</em> ${esc(it.video_prompt)}</p>
          <div><button type="button" class="sb-mini" data-turn="${t.id}" data-i="${i}" data-copy="image_prompt">Copy image</button>
          <button type="button" class="sb-mini" data-turn="${t.id}" data-i="${i}" data-copy="video_prompt">Copy video</button>
          ${lock ? '' : `<button type="button" class="sb-mini" data-turn="${t.id}" data-use="${i}">Use for frame</button>`}</div></div>`).join('')}
        <div class="sb-pi"><div><button type="button" class="sb-mini pri" data-turn="${t.id}" data-copy="*">Copy all prompts</button></div></div></details>` : ''}
      ${(t.sources || []).length ? `<div class="sb-src">Sources: ${t.sources.map((x) => `<a data-src="${esc(x.url)}">${esc(x.title)}</a>`).join(' · ')}</div>` : ''}</div>`;
  }

  async function ask(text) {
    const msg = String(text || '').trim();
    if (!msg || ST.aiBusy) return;
    const nav = window.meridianNav ? await window.meridianNav.handle(msg).catch(() => null) : null;   // "take me to…"
    if (nav) { ST.aiDraft = ''; return nav; }
    ST.aiBusy = true; ST.aiDraft = '';
    ST.turns = (ST.turns || []).concat([{ id: 'pending', message: msg, reply: '', proposals: [], prompts: [], applied: [] }]);
    drawAI();
    const bid = ST.board.id;
    const screen = ST.screen; ST.screen = null; ST.screenUrl = null;
    const r = await M().ws('POST', `${base()}/${bid}/assist`, { message: msg, screen: screen || '' });
    ST.aiBusy = false;
    ST.turns = ST.turns.filter((t) => t.id !== 'pending');
    if (!r || !r.success) { ST.aiDraft = msg; err((r && r.error) || 'Meridian could not answer.'); }
    else ST.turns.push(r.turn);
    if (ST.board && ST.board.id === bid) drawAI();
    return r && r.success ? r.turn.reply + ((r.turn.proposals || []).length ? ` I made ${r.turn.proposals.length} suggestions you can apply on screen.` : '') : '';
  }

  async function applyProps(turnId, ids) {
    const t = (ST.turns || []).find((x) => x.id === turnId);
    if (!t) return;
    const applied = new Set(t.applied || []);
    const want = ids || t.proposals.filter((p) => !applied.has(p.id)).map((p) => p.id);
    const r = await M().ws('POST', `${base()}/${ST.board.id}/assist/apply`, { turn: turnId, ids: want });
    if (!r || !r.success) return err((r && r.error) || 'Could not apply that.');
    t.applied = Array.from(new Set([...(t.applied || []), ...r.applied]));
    if (r.skipped && r.skipped.length) err('Some suggestions no longer fit the board (a panel was removed), so they were skipped.');
    ST.board = r.storyboard;
    drawBoard(document.getElementById('pw-body'));
    scheduleCoach();
    for (const pid of r.generate || []) { if (await generate(pid) === false) break; }
  }

  function promptText(turnId, i, kind) {
    const t = ST.turns.find((x) => x.id === turnId); const it = t && t.prompts[i];
    return it ? it[kind] : '';
  }
  function allPrompts(turnId) {
    const t = ST.turns.find((x) => x.id === turnId);
    return (t ? t.prompts : []).map((it) => `Panel ${it.panel_n}\nImage: ${it.image_prompt}\nVideo: ${it.video_prompt}`).join('\n\n');
  }
  async function copyText(text, btn) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
    const old = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = old; }, 1200);
  }
  async function usePrompt(turnId, i, btn) {
    const t = ST.turns.find((x) => x.id === turnId); const it = t && t.prompts[i];
    if (!it) return;
    const r = await M().ws('POST', `${base()}/${ST.board.id}/panels/${it.panel_id}`, { prompt: it.image_prompt });
    if (!r || !r.success) return err((r && r.error) || 'That panel is gone.');
    const p = ST.board.panels.find((x) => x.id === it.panel_id);
    if (p) p.prompt = it.image_prompt;
    drawBoard(document.getElementById('pw-body'));
  }

  async function snapshot() {
    if (!M().wsCapture) { err('Update Connect to send Meridian your screen.'); return false; }
    const btn = document.getElementById('sb-shot'); if (btn) btn.disabled = true;
    const r = await M().wsCapture(`${base()}/${ST.board.id}/screen/image/upload`);
    if (btn) btn.disabled = false;
    if (!r || !r.success) { err((r && r.error) || 'Could not take the snapshot.'); return false; }
    ST.screen = r.screen;
    ST.screenUrl = r.preview || null;
    drawAI();
    return true;
  }

  // ------------------------------------------------------------ quiet coach
  function scheduleCoach() {
    clearTimeout(ST.timers._coach);
    ST.timers._coach = setTimeout(() => coachNow('edit'), 20000);   // only after a pause in editing
  }
  async function coachNow(trigger, pid) {
    if (!ST.board || locked()) return;
    const bid = ST.board.id;
    const r = await M().ws('POST', `${base()}/${bid}/coach`, { trigger, panel_id: pid || '' });
    if (!r || !r.success || !ST.board || ST.board.id !== bid) return;
    ST.muted = !!r.muted;
    ST.tips = r.tips || [];
    drawTips(); markTipPanels();
    const mute = document.getElementById('sb-mute'); if (mute) mute.textContent = ST.muted ? 'Tips off' : 'Tips on';
  }
  function markTipPanels() {
    document.querySelectorAll('.sb-panel').forEach((card) => {
      const n = card.querySelector('.sb-num');
      if (n) n.classList.toggle('tip', (ST.tips || []).some((t) => t.panel_id === card.dataset.p));
    });
  }
  function drawTips() {
    const el = document.getElementById('sb-tips');
    if (!el) return;
    const tips = ST.tips || [];
    if (!tips.length) { el.innerHTML = ''; el.style.display = 'none'; return; }
    el.style.display = '';
    const shown = ST.allTips ? tips : tips.slice(0, 1);
    el.innerHTML = `<div class="sb-tiphead"><span>Meridian noticed</span></div>` + shown.map((t) => `<div class="sb-tip">
      <div class="t">${t.panel_n ? `<a data-goto="${t.panel_id}">Panel ${t.panel_n}</a>` : ''}<span>${esc(t.text)}</span></div>
      <div class="b">${t.fix && Object.keys(t.fix).length ? `<button type="button" class="sb-mini pri" data-fix="${t.id}">Fix it</button>` : ''}
        <button type="button" class="sb-mini" data-tip="${t.id}">Got it</button></div></div>`).join('')
      + (tips.length > 1 && !ST.allTips ? `<button type="button" class="sb-more-tips" id="sb-more-tips">+${tips.length - 1} more</button>` : '');
    const more = el.querySelector('#sb-more-tips'); if (more) more.onclick = () => { ST.allTips = true; drawTips(); };
    el.querySelectorAll('[data-tip]').forEach((b) => (b.onclick = () => tipAction(b.dataset.tip, 'dismiss')));
    el.querySelectorAll('[data-goto]').forEach((a) => (a.onclick = () => {
      const card = document.querySelector(`.sb-panel[data-p="${a.dataset.goto}"]`);
      if (card) { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash'); }
    }));
    el.querySelectorAll('[data-fix]').forEach((b) => (b.onclick = async () => {
      const t = tips.find((x) => x.id === b.dataset.fix);
      if (!t || !t.panel_id) return;
      b.disabled = true;
      const r = await M().ws('POST', `${base()}/${ST.board.id}/panels/${t.panel_id}`, t.fix);
      if (!r || !r.success) { b.disabled = false; return err((r && r.error) || 'Could not apply that.'); }
      await tipAction(t.id, 'done');
      await openBoard(document.getElementById('pw-body'), ST.board.id);
      if (t.fix.prompt) generate(t.panel_id);
    }));
  }
  async function tipAction(id, action) {
    const r = await M().ws('POST', `${base()}/${ST.board.id}/tips/${id}`, { action });
    if (r && r.success) { ST.tips = r.tips || []; drawTips(); markTipPanels(); }
  }

  window.meridianStoryboard = { render, reset: () => { ST.board = null; ST.tips = []; },
    preselect: (pid, bid) => { ST.board = { id: bid, project_id: pid }; ST.tips = []; } };
})();
