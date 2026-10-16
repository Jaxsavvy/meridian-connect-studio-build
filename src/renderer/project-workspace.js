/* Meridian Connect: Project Workspace (v3.1, 2026-10-11)
 * Matches Jax's reference Project Command Center (cinematic header, progress ring, analytics, work, files, people,
 * messages, activity), employee view: no money, no approvals, nothing invented. Empty data shows an honest state.
 * Tab keys are unchanged (nav.js "take me to…" and openTab() use them).
 */
'use strict';

(function () {
  const WS = { pid: null, tab: 'overview', section: 'All', clicked: false, mine: true, show: 'open', wf: 'all', ff: 'recent', renderEpoch: 0, dataEpoch: 0 };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const host = (u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch (e) { return u; } };
  const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
  const dayDiff = (iso) => { if (!iso) return null; return Math.round((new Date(iso.slice(0, 10) + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 864e5); };
  const fmtD = (iso) => (iso ? new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');
  const fmtDY = (iso) => (iso ? new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '');
  const plural = (n, w, ws) => `${n} ${n === 1 ? w : (ws || w + 's')}`;
  const ini = (n) => (n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || '?';
  const relDue = (iso) => { const n = dayDiff(iso); if (n == null) return { t: 'No date', c: 'faint' }; if (n < 0) return { t: plural(-n, 'day') + ' late', c: 'coral' }; if (n === 0) return { t: 'Today', c: 'amber' }; if (n === 1) return { t: 'Tomorrow', c: 'amber' }; if (n <= 7) return { t: fmtD(iso), c: 'amber' }; return { t: fmtD(iso), c: '' }; };
  const ago = (s) => { if (!s) return ''; const t = new Date(String(s).replace(' ', 'T')); const m = Math.round((Date.now() - t) / 6e4); if (isNaN(m)) return s; if (m < 60) return m <= 1 ? 'just now' : m + ' min ago'; if (m < 1440) return Math.round(m / 60) + 'h ago'; if (m < 10080) return Math.round(m / 1440) + 'd ago'; return fmtD(String(s).slice(0, 10)); };
  const HUES = [['#2B8DD0', '#0D3E70'], ['#7A5BD0', '#36256E'], ['#2E9C8A', '#11493F'], ['#C98A3E', '#5E3B16'], ['#3A6FB8', '#182F5C'], ['#B65C7E', '#4E2238'], ['#4E9B5B', '#1F4527'], ['#5B7FA6', '#26384F']];
  const grad = (id) => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; const [a, b] = HUES[h % HUES.length]; return `linear-gradient(150deg,${a},${b} 72%)`; };
  const M = () => window.meridian.api;
  const me = () => (typeof currentMe !== 'undefined' && currentMe) || {};
  const SECTIONS = ['Website', 'Brand', 'Docs', 'Files'];
  const KIND = { website: 'Live site', staging: 'Staging site', design: 'Design', doc: 'Document', link: 'Link' };
  const I = {   /* small line icons */
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    check: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 12l3 3 5-6"/>', file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    note: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/>', tool: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/>',
    box: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/>', film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>', ring: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5a5 5 0 0 1 6 4.5"/>',
    msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', act: '<path d="M3 12h4l3-8 4 16 3-8h4"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    dl: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', chev: '<path d="M6 9l6 6 6-6"/>', send: '<path d="M4 12l16-8-6 16-2-6z"/>',
  };
  const ic = (k, s) => `<svg class="pw-i" viewBox="0 0 24 24" width="${s || 16}" height="${s || 16}" aria-hidden="true">${I[k] || I.grid}</svg>`;

  function css() {
    if (document.getElementById('pw-style')) return;
    const st = document.createElement('style');
    st.id = 'pw-style';
    st.textContent = `
.projects-split.pw-full{grid-template-columns:minmax(0,1fr)!important}
.projects-split.pw-full>.tk-panel:first-child{display:none!important}
.projects-split.pw-full>.tk-panel{background:none!important;border:0!important;box-shadow:none!important;padding:0!important;backdrop-filter:none!important}
#pw-host{--ink:#EEF4FB;--ink2:#C3D3E6;--ink3:#8AA0BA;--ink4:#5F7795;--hair:#FFFFFF14;--hair2:#FFFFFF0B;--cyan:#38CFF5;--blue:#4B8BFF;--sea:#4FE0C0;--amber:#FFB15C;--coral:#FF7A6B;--violet:#A08FFF;--gold:#F1C878;
  --serif:"Source Serif 4",Georgia,serif;--sans:"Inter",system-ui,"Segoe UI",sans-serif;--mono:ui-monospace,"Cascadia Code",Consolas,monospace;
  display:flex;flex-direction:column;min-height:0;height:100%;font:400 13.5px/1.45 var(--sans);color:var(--ink);font-variant-numeric:tabular-nums;container:pw/inline-size}
#pw-host *{box-sizing:border-box}
#pw-host button{font:inherit;color:inherit;cursor:pointer}#pw-host button:disabled{cursor:default;opacity:.55}
#pw-host :focus-visible{outline:2px solid var(--cyan);outline-offset:2px;border-radius:7px}
#pw-host .pw-i{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
#pw-host .faint{color:var(--ink4)}#pw-host .dim{color:var(--ink3)}#pw-host .amber{color:var(--amber)!important}#pw-host .coral{color:var(--coral)}#pw-host .sea{color:var(--sea)}
#pw-host .label{font:600 10px/1.1 var(--mono);letter-spacing:.11em;text-transform:uppercase;color:var(--ink3)}
/* ---------- cinematic header ---------- */
#pw-host .pw-cover{position:relative;flex:none;border-radius:18px;overflow:hidden;display:flex;flex-direction:column;margin-bottom:16px;
  background:url(assets/meridian-valley-banner-v2.png) 72% 50%/cover no-repeat,#071326;box-shadow:0 24px 50px -24px #000000E0,0 0 0 1px #FFFFFF18}
#pw-host .pw-cover::before{content:"";position:absolute;inset:0;background:
  radial-gradient(560px 320px at 84% 74%,#FF8A3D80,transparent 70%),radial-gradient(460px 240px at 60% 100%,#FF6A3D48,transparent 70%),radial-gradient(300px 160px at 95% 40%,#FFB15C33,transparent 70%),
  linear-gradient(90deg,#050E1E 0%,#050E1EEE 30%,#050E1E99 52%,#050E1E22 76%,#050E1E00 100%),linear-gradient(0deg,#050E1EF2 0%,#050E1E00 38%)}
#pw-host .pw-cover::after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 1px 0 #FFFFFF2A;pointer-events:none}
#pw-host .pw-cover>*{position:relative}
#pw-host .pw-ctop{display:flex;align-items:center;gap:10px;padding:16px 22px 0;flex-wrap:wrap}
#pw-host .pw-crumb{display:flex;align-items:center;gap:8px;font:500 12.5px var(--sans);color:var(--ink3)}
#pw-host .pw-crumb .home{border:0;background:none;padding:0;color:var(--ink3)}#pw-host .pw-crumb .home:hover{color:#fff}
#pw-host .pw-switch{display:inline-flex;align-items:center;gap:7px;border:0;background:none;padding:2px 4px;border-radius:7px;color:#7FD8F7;font:600 12.5px var(--sans)}
#pw-host .pw-switch:hover{background:#FFFFFF10}
#pw-host .pw-cact{margin-left:auto;display:flex;gap:8px}
#pw-host .pw-id{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 18px;align-items:center;padding:14px 24px 0;max-width:min(860px,80%)}
#pw-host .pw-tile{width:62px;height:62px;border-radius:16px;display:grid;place-items:center;font:600 22px var(--serif);color:#F2FBFF;box-shadow:inset 0 1px 0 #FFFFFF45,0 12px 26px -10px #000000D0,0 0 0 1.5px #FFFFFF30}
#pw-host .pw-eyebrow{display:flex;gap:10px;align-items:center;font:600 10.5px var(--mono);letter-spacing:.13em;text-transform:uppercase;color:#8FB7D8}
#pw-host .pw-eyebrow b{font:500 13px var(--sans);letter-spacing:0;text-transform:none;color:#DDEBFA}
#pw-host .pw-eyebrow i{width:1px;height:12px;background:#FFFFFF33}
#pw-host .pw-title{margin:4px 0 0;font:600 clamp(26px,4.6cqi,46px)/1.06 var(--serif);color:#FFFFFF;text-shadow:0 2px 22px #000000A0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
#pw-host .pw-desc{grid-column:1/-1;margin:8px 0 0;max-width:62ch;color:#D3E1F0;font-size:14px;line-height:1.55;white-space:pre-wrap;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#pw-host .pw-facts{display:flex;flex-wrap:wrap;gap:6px 0;margin:18px 24px 0}
#pw-host .pw-facts>div{display:grid;gap:6px;padding:0 22px;border-left:1px solid #FFFFFF1F;min-width:0}#pw-host .pw-facts>div:first-child{padding-left:0;border-left:0}
#pw-host .pw-facts .v{display:flex;align-items:center;gap:9px;font:600 14px var(--sans);color:#fff;white-space:nowrap}
#pw-host .pw-facts .v small{font:400 11.5px var(--sans);color:var(--ink3);display:block}
#pw-host .pw-facts .vi{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#FFFFFF12;box-shadow:inset 0 0 0 1px #FFFFFF22;color:#9FDCF5}
#pw-host .pw-status{display:inline-flex;align-items:center;gap:7px;height:28px;padding:0 12px;border-radius:999px;background:#0B3A33CC;box-shadow:inset 0 0 0 1px #4FE0C066;color:#7DF0D4;font:600 12.5px var(--sans)}
#pw-host .pw-status i{width:7px;height:7px;border-radius:50%;background:currentColor;box-shadow:0 0 8px currentColor}
#pw-host .pw-status.hold{background:#3A2A0FCC;box-shadow:inset 0 0 0 1px #FFB15C66;color:var(--amber)}#pw-host .pw-status.done{background:#FFFFFF14;box-shadow:inset 0 0 0 1px #FFFFFF2A;color:var(--ink2)}
#pw-host .pw-tabs{display:flex;gap:4px;margin-top:20px;padding:0 14px;background:linear-gradient(0deg,#050E1EF5,#050E1EC0);backdrop-filter:blur(8px);box-shadow:inset 0 1px 0 #FFFFFF14;overflow-x:auto;scrollbar-width:none}
#pw-host .pw-cover.slim .pw-tabs{margin-top:14px}
#pw-host .pw-tab{position:relative;display:inline-flex;align-items:center;gap:8px;background:none;border:0;height:48px;padding:0 14px;color:#9DB2CB;font:500 13px var(--sans);white-space:nowrap;transition:color .15s}
#pw-host .pw-tab:hover{color:#fff}
#pw-host .pw-tab.on{color:#fff;font-weight:600;background:linear-gradient(0deg,#38CFF51F,transparent 80%)}
#pw-host .pw-tab.on::after{content:"";position:absolute;left:12px;right:12px;bottom:0;height:2.5px;border-radius:2px;background:linear-gradient(90deg,#38CFF5,#4B8BFF);box-shadow:0 0 12px #38CFF5}
#pw-host .pw-tab .n{font:600 10px var(--mono);color:var(--ink4)}
#pw-host .pw-slimrow{display:flex;align-items:center;gap:14px;padding:12px 22px 0;flex-wrap:wrap}
#pw-host .pw-slimrow .pw-tile{width:42px;height:42px;border-radius:12px;font-size:16px}
#pw-host .pw-slimname{font:600 22px/1.15 var(--serif);color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;max-width:60cqi}
#pw-host .pw-sw{position:absolute;z-index:50;top:44px;left:22px;width:min(420px,calc(100% - 44px));max-height:60vh;overflow:auto;padding:8px;border-radius:14px;background:#0B1A31F8;backdrop-filter:blur(16px);box-shadow:0 28px 70px -10px #000000E0,0 0 0 1px #FFFFFF1F}
#pw-host .pw-sw input{width:100%;height:36px;margin-bottom:6px;padding:0 12px;border-radius:9px;border:0;background:#05101F;box-shadow:inset 0 0 0 1px #FFFFFF17;color:var(--ink);outline:none}
#pw-host .pw-swi{display:grid;grid-template-columns:30px minmax(0,1fr) auto;gap:10px;align-items:center;width:100%;padding:7px 8px;border:0;border-radius:9px;background:none;text-align:left}
#pw-host .pw-swi:hover{background:#FFFFFF10}#pw-host .pw-swi b{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#pw-host .pw-swi small{color:var(--ink3);font-size:11.5px}
#pw-host .pw-swi .t{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;font:600 11px var(--serif);color:#fff}
@container pw (max-width:820px){#pw-host .pw-id{max-width:100%}#pw-host .pw-facts>div{padding:0 12px}#pw-host .pw-tabs{-webkit-mask-image:linear-gradient(90deg,#000 88%,transparent);mask-image:linear-gradient(90deg,#000 88%,transparent)}}
/* ---------- body + panels ---------- */
#pw-host .pw-body{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:16px;padding:0 2px 8px 0}
#pw-host .pw-err{color:var(--coral);font-size:12px}#pw-host .pw-err:not(:empty){margin:-6px 0 10px}
#pw-host .pwx{--ac:#38CFF5;position:relative;border-radius:16px;min-width:0;background:radial-gradient(520px 200px at 0% 0%,color-mix(in srgb,var(--ac) 9%,transparent),transparent 70%),linear-gradient(160deg,#0F2140,#0A1730 75%);
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ac) 30%,#1A2E4A),inset 0 1px 0 #FFFFFF14,0 18px 40px -22px #000000E0,0 0 34px -14px color-mix(in srgb,var(--ac) 45%,transparent)}
#pw-host .pwx.a-cyan{--ac:#38CFF5}#pw-host .pwx.a-blue{--ac:#4B8BFF}#pw-host .pwx.a-teal{--ac:#4FE0C0}#pw-host .pwx.a-amber{--ac:#FFB15C}#pw-host .pwx.a-violet{--ac:#8E7BFF}#pw-host .pwx.a-steel{--ac:#6F8FB8}
#pw-host .pwx.deep{background:radial-gradient(500px 260px at 10% 10%,#1D5C9A40,transparent 70%),url(assets/meridian-valley-banner-v2.png) 30% 20%/cover,#0A1730}
#pw-host .pwx.deep::before{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(110deg,#081428F2 30%,#081428CC 60%,#08142899);pointer-events:none}
#pw-host .pwx.deep>*{position:relative}
#pw-host .ph{display:flex;align-items:center;gap:11px;padding:15px 18px 10px;flex-wrap:wrap}
#pw-host .ph h3{margin:0;font:600 15.5px/1.2 var(--sans);color:#fff}
#pw-host .ph .meta{color:var(--ink3);font-size:12px}
#pw-host .ph .gl{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;color:var(--ac);background:color-mix(in srgb,var(--ac) 16%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ac) 35%,transparent)}
#pw-host .ph .end{margin-left:auto;display:flex;gap:8px;align-items:center}
#pw-host .pill{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 13px;border-radius:999px;border:0;background:#FFFFFF08;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ac,#38CFF5) 45%,#FFFFFF22);color:#CFEFFF;font:600 12px var(--sans);white-space:nowrap;transition:background .15s}
#pw-host .pill:hover{background:#FFFFFF14}
#pw-host .grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:16px}
#pw-host .s7{grid-column:span 7}#pw-host .s5{grid-column:span 5}#pw-host .s4{grid-column:span 4}#pw-host .s3{grid-column:span 3}#pw-host .s6{grid-column:span 6}#pw-host .s12{grid-column:span 12}
@container pw (max-width:1180px){#pw-host .s7,#pw-host .s5{grid-column:span 12}#pw-host .s4,#pw-host .s3{grid-column:span 6}}
@container pw (max-width:760px){#pw-host .s4,#pw-host .s3,#pw-host .s6{grid-column:span 12}}
/* progress */
#pw-host .prog{display:grid;grid-template-columns:auto minmax(0,1fr);gap:26px;align-items:center;padding:6px 22px 22px}
@container pw (max-width:620px){#pw-host .prog{grid-template-columns:1fr;justify-items:center}}
#pw-host .ringw{position:relative;width:168px;height:168px}
#pw-host .ringw svg{width:168px;height:168px;transform:rotate(-90deg);filter:drop-shadow(0 0 14px #38CFF566)}
#pw-host .ringw .c{position:absolute;inset:0;display:grid;place-content:center;text-align:center}
#pw-host .ringw .c b{font:700 42px/1 var(--sans);color:#fff;letter-spacing:-.02em}#pw-host .ringw .c b small{font-size:18px;font-weight:600;color:var(--ink2);margin-left:2px}
#pw-host .ringw .c span{margin-top:6px;font:700 10.5px var(--mono);letter-spacing:.12em;text-transform:uppercase}
#pw-host .ringw .c em{font-style:normal;font-size:11px;color:var(--ink3);margin-top:3px}
#pw-host .phead{font:600 24px/1.2 var(--serif);color:#fff;margin:0}
#pw-host .phead b{font-weight:600;color:#6FD9FF}
#pw-host .psub{margin:8px 0 0;color:var(--ink2);font-size:13.5px;line-height:1.55;max-width:58ch}
#pw-host .stepper{display:flex;margin-top:22px;position:relative}
#pw-host .stp{flex:1;display:grid;justify-items:center;gap:6px;text-align:center;position:relative;min-width:0}
#pw-host .stp::before{content:"";position:absolute;top:15px;right:50%;width:100%;height:2px;background:#FFFFFF1A;z-index:0}
#pw-host .stp:first-child::before{display:none}
#pw-host .stp.d::before,#pw-host .stp.c::before{background:linear-gradient(90deg,var(--sea),var(--cyan))}
#pw-host .stp i{position:relative;z-index:1;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;font:700 12px var(--sans);font-style:normal;background:#0A1A33;box-shadow:inset 0 0 0 2px #FFFFFF26;color:var(--ink3)}
#pw-host .stp.d i{box-shadow:inset 0 0 0 2px var(--sea);color:var(--sea);background:#0C2E30}
#pw-host .stp.c i{background:linear-gradient(145deg,#2AB2F0,#2A5FE0);box-shadow:0 0 0 5px #38CFF52A,0 0 20px #38CFF599;color:#fff}
#pw-host .stp b{font:600 12px var(--sans);color:#fff;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 4px}
#pw-host .stp small{font-size:11px;color:var(--ink4);margin-top:-4px}#pw-host .stp.d small{color:var(--sea)}#pw-host .stp.c small{color:#6FD9FF}
/* analytics */
#pw-host .kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));padding:2px 18px 0}
#pw-host .kpi{padding:2px 14px 8px;border-left:1px solid var(--hair);min-width:0}#pw-host .kpi:first-child{border-left:0;padding-left:0}
#pw-host .kpi b{display:block;font:700 24px/1.1 var(--sans);color:#fff;margin:2px 0}#pw-host .kpi b.none{color:var(--ink4)}
#pw-host .kpi span{display:block;color:var(--ink2);font-size:12px}#pw-host .kpi em{display:block;margin-top:5px;font:600 10px var(--mono);font-style:normal;letter-spacing:.06em;color:var(--sea)}
#pw-host .kpi em.est{color:var(--amber)}#pw-host .kpi em.miss{color:var(--ink4)}
@container pw (max-width:560px){#pw-host .kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
#pw-host .chart{position:relative;padding:4px 16px 12px}
#pw-host .chart svg{display:block;width:100%;height:170px}
#pw-host .chart text{font:500 10px var(--sans);fill:#6C84A3}
#pw-host .chart .msg{position:absolute;inset:0 16px 30px;display:grid;place-content:center;text-align:center;gap:6px;color:var(--ink3);font-size:12.5px}
#pw-host .chart .msg b{color:#fff;font-size:13.5px;font-weight:600}
/* lists */
#pw-host .chips{display:flex;gap:6px;flex-wrap:wrap;padding:0 18px 10px}
#pw-host .chip2{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 12px;border-radius:9px;border:0;background:#FFFFFF08;box-shadow:inset 0 0 0 1px #FFFFFF14;color:var(--ink2);font:500 12px var(--sans)}
#pw-host .chip2 em{font-style:normal;color:var(--ink4);font-size:11px}
#pw-host .chip2.on{background:linear-gradient(180deg,#1C6FE0,#1752B8);box-shadow:inset 0 0 0 1px #4B8BFF,0 4px 14px -4px #1C6FE0;color:#fff}#pw-host .chip2.on em{color:#CFE2FF}
#pw-host .row{display:grid;align-items:center;gap:12px;padding:9px 18px;border-top:1px solid var(--hair2);transition:background .12s}
#pw-host .row:hover{background:#FFFFFF07}
#pw-host .row b{font-weight:500;color:#fff}#pw-host .row .sub{display:block;color:var(--ink3);font-size:11.5px;margin-top:1px}
#pw-host .clip{min-width:0}#pw-host .clip>*{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#pw-host .cbox{appearance:none;width:20px;height:20px;border-radius:50%;margin:0;border:0;box-shadow:inset 0 0 0 1.6px #5D7899;background:transparent;display:grid;place-items:center;cursor:pointer}
#pw-host .cbox:hover{box-shadow:inset 0 0 0 1.6px var(--cyan)}
#pw-host .cbox:checked{background:var(--sea);box-shadow:0 0 10px #4FE0C080}#pw-host .cbox:checked::after{content:"";width:8px;height:4px;border:2px solid #04231D;border-top:0;border-right:0;transform:rotate(-45deg) translate(1px,-1px)}
#pw-host .when{font-size:12px;color:var(--ink2);white-space:nowrap}
#pw-host .prio{font:600 11.5px var(--sans)}#pw-host .prio.High,#pw-host .prio.Urgent{color:var(--amber)}#pw-host .prio.Urgent{color:var(--coral)}#pw-host .prio.Normal,#pw-host .prio.Low{color:var(--ink3)}
#pw-host .stat{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px;border-radius:999px;font:600 11.5px var(--sans);white-space:nowrap;justify-self:start}
#pw-host .stat i{width:6px;height:6px;border-radius:50%;background:currentColor}
#pw-host .stat.done{color:#7DF0D4;background:#0D3B35;box-shadow:inset 0 0 0 1px #4FE0C055}#pw-host .stat.todo{color:var(--ink2);box-shadow:inset 0 0 0 1px #FFFFFF2A}
#pw-host .stat.late{color:#FFB3A8;background:#3A1A18;box-shadow:inset 0 0 0 1px #FF7A6B55}#pw-host .stat.prog{color:#9DC5FF;background:#11295A;box-shadow:inset 0 0 0 1px #4B8BFF66}
#pw-host .av{display:inline-grid;place-items:center;width:28px;height:28px;border-radius:50%;flex:none;font:600 11px var(--sans);color:#EAF4FF;background:linear-gradient(145deg,#3667A0,#1B3A62);box-shadow:0 0 0 2px #0A1730}
#pw-host .av.lg{width:40px;height:40px;font-size:14px}#pw-host .av.none{background:none;box-shadow:inset 0 0 0 1.5px #4A6587;color:var(--ink4)}#pw-host .av.jax{background:linear-gradient(145deg,#1B8DA8,#0E4D63)}
#pw-host .avs{display:flex}#pw-host .avs .av{margin-left:-8px}#pw-host .avs .av:first-child{margin-left:0}
#pw-host .fi{width:30px;height:34px;border-radius:6px;display:grid;place-items:end center;padding-bottom:4px;font:700 7.5px var(--mono);color:#fff;position:relative;flex:none;background:#2E5C9A}
#pw-host .fi::before{content:"";position:absolute;top:0;right:0;width:9px;height:9px;background:linear-gradient(225deg,#0A1730 50%,#FFFFFF55 50%);border-radius:0 6px 0 3px}
#pw-host .fi.pdf{background:linear-gradient(160deg,#E5484D,#A3262B)}#pw-host .fi.img{background:linear-gradient(160deg,#2BB59A,#147564)}#pw-host .fi.doc{background:linear-gradient(160deg,#3D7BFF,#2049B8)}#pw-host .fi.note{background:linear-gradient(160deg,#8E7BFF,#5440C2)}#pw-host .fi.fig{background:linear-gradient(160deg,#F24E1E,#A259FF)}
#pw-host .kebab{width:28px;height:28px;border:0;border-radius:7px;background:none;color:var(--ink3);display:grid;place-items:center}#pw-host .kebab:hover{background:#FFFFFF12;color:#fff}
#pw-host .pf{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 18px 14px;border-top:1px solid var(--hair2);font-size:12px;color:var(--ink4)}
#pw-host .lnk{border:0;background:none;padding:0;color:#7FD8F7;font:600 12px var(--sans);display:inline-flex;gap:6px;align-items:center}#pw-host .lnk:hover{color:#C4EEFF}
/* deliverables donut, client, messages, activity */
#pw-host .donutw{display:grid;grid-template-columns:auto minmax(0,1fr);gap:20px;align-items:center;padding:4px 18px 16px}
#pw-host .donut{position:relative;width:132px;height:132px}#pw-host .donut svg{width:132px;height:132px;transform:rotate(-90deg)}
#pw-host .donut .c{position:absolute;inset:0;display:grid;place-content:center;text-align:center}#pw-host .donut .c b{font:700 30px/1 var(--sans);color:#fff}#pw-host .donut .c span{font-size:11px;color:var(--ink3);margin-top:4px}
#pw-host .leg{display:grid;gap:9px;font-size:12.5px}#pw-host .leg div{display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:9px;align-items:center}#pw-host .leg i{width:10px;height:10px;border-radius:3px}#pw-host .leg b{color:#fff;font-weight:600}
#pw-host .client{display:grid;grid-template-columns:52px minmax(0,1fr);gap:14px;align-items:center;margin:0 18px 6px;padding:14px;border-radius:14px;background:#FFFFFF08;box-shadow:inset 0 0 0 1px var(--hair)}
#pw-host .client .lg{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;font:600 18px var(--serif);color:#fff;background:linear-gradient(150deg,#3D6BAA,#1E3A66);box-shadow:inset 0 1px 0 #FFFFFF33,0 0 0 2px #FFFFFF1F}
#pw-host .client b{font:600 15px var(--sans);color:#fff;display:block}#pw-host .client small{color:var(--sea);font-size:12px}
#pw-host .cbtns{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
#pw-host .bbtn{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:9px;border:0;background:linear-gradient(180deg,#1C6FE0,#1752B8);color:#fff;font:600 12px var(--sans);box-shadow:0 6px 16px -6px #1C6FE0}
#pw-host .bbtn.q{background:#FFFFFF0D;box-shadow:inset 0 0 0 1px #FFFFFF22}
#pw-host .msgr{display:grid;grid-template-columns:32px minmax(0,1fr) auto;gap:11px;align-items:start;padding:10px 18px;border-top:1px solid var(--hair2)}
#pw-host .msgr b{font-weight:600;color:#fff;font-size:13px}#pw-host .msgr p{margin:2px 0 0;color:var(--ink2);font-size:12.5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
#pw-host .msgr time{font-size:11px;color:var(--ink4);white-space:nowrap}
#pw-host .unread{display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:999px;background:#FFB15C;color:#2A1600;font:700 11px var(--sans)}
#pw-host .tl{position:relative;padding:4px 18px 10px}
#pw-host .tl::before{content:"";position:absolute;left:33px;top:16px;bottom:22px;width:2px;background:linear-gradient(#4FE0C066,#FFFFFF10)}
#pw-host .ev{position:relative;display:grid;grid-template-columns:32px minmax(0,1fr) auto;gap:11px;padding:8px 0;align-items:start}
#pw-host .ev .ic{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:#0E2A4A;color:#9FDCF5;box-shadow:0 0 0 3px #0A1730,inset 0 0 0 1.5px #38CFF566}
#pw-host .ev .ic.ok{background:#0D3B35;color:var(--sea);box-shadow:0 0 0 3px #0A1730,inset 0 0 0 1.5px #4FE0C0}
#pw-host .ev .ic.inf{background:#0A1730;color:var(--ink4);box-shadow:0 0 0 3px #0A1730,inset 0 0 0 1.5px #4A6587}
#pw-host .ev p{margin:0;font-size:12.5px;color:#fff;min-width:0;overflow-wrap:anywhere}#pw-host .ev p small{display:block;color:var(--ink3);font-size:11.5px;margin-top:1px}
#pw-host .ev time{font-size:11px;color:var(--ink4);white-space:nowrap;padding-top:2px}
#pw-host .rec{font:600 8.5px var(--mono);letter-spacing:.07em;padding:1px 5px;border-radius:4px;margin-left:6px;vertical-align:1px;color:#9FD9F2;background:#38CFF51A}
#pw-host .rec.inf{color:var(--ink4);background:none;box-shadow:inset 0 0 0 1px #4A6587}
#pw-host .state{display:grid;place-items:center;text-align:center;padding:22px 18px;gap:7px;color:var(--ink3);font-size:12.5px;line-height:1.55}
#pw-host .state .sg{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:color-mix(in srgb,var(--ac,#38CFF5) 12%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ac,#38CFF5) 30%,transparent);color:var(--ac,#38CFF5)}
#pw-host .state b{display:block;color:#fff;font-size:13.5px;font-weight:600}
#pw-host .skel{border-radius:7px;background:linear-gradient(90deg,#FFFFFF08,#FFFFFF15,#FFFFFF08);background-size:200% 100%;animation:pwsh 1.4s infinite linear}
@keyframes pwsh{to{background-position:-200% 0}}
#pw-host .skels{padding:6px 18px 18px;display:grid;gap:10px}
/* shared older classes used by the other tabs */
#pw-host .pw-card{border-radius:16px!important;padding:16px 18px}
#pw-host .pw-card h3{margin:0 0 10px;font:600 15px/1.2 var(--sans);color:#fff;display:flex;justify-content:space-between;align-items:baseline;gap:10px}
#pw-host .pw-card h3 small{font-weight:400;color:var(--ink3);font-size:12px}
#pw-host .pw-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:32px;padding:0 14px;border-radius:9px;border:0;background:linear-gradient(180deg,#1C6FE0,#1752B8);color:#fff;font:600 12.5px var(--sans);white-space:nowrap;box-shadow:0 6px 16px -6px #1C6FE0}
#pw-host .pw-btn.q{background:#FFFFFF0D;box-shadow:inset 0 0 0 1px #FFFFFF22;color:var(--ink)}#pw-host .pw-btn.sm{height:28px;padding:0 11px;font-size:12px}
#pw-host .pw-in{height:34px;background:#05101F;border:0;box-shadow:inset 0 0 0 1px #FFFFFF17;border-radius:10px;padding:0 11px;color:var(--ink);font:400 13px var(--sans);min-width:0}
#pw-host textarea.pw-in{height:auto;padding:9px 11px;resize:vertical}#pw-host .pw-in:focus{outline:none;box-shadow:inset 0 0 0 1.5px var(--cyan),0 0 0 4px #38CFF51F}
#pw-host .pw-in.grow{flex:1;min-width:150px}#pw-host select.pw-in option{background:#0C192C}
#pw-host .pw-form{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
#pw-host .pw-chk{appearance:none;width:20px;height:20px;border:0;border-radius:50%;box-shadow:inset 0 0 0 1.6px #5D7899;background:transparent;display:grid;place-items:center;margin:0;cursor:pointer;flex:none}
#pw-host .pw-chk:checked{background:var(--sea);box-shadow:none}#pw-host .pw-chk:checked::after{content:"";width:8px;height:4px;border:2px solid #04231D;border-top:0;border-right:0;transform:rotate(-45deg) translate(1px,-1px)}
#pw-host .pw-seg{display:inline-flex;gap:4px;flex-wrap:wrap}
#pw-host .pw-seg button{border:0;height:28px;padding:0 12px;border-radius:9px;background:#FFFFFF08;box-shadow:inset 0 0 0 1px #FFFFFF14;color:var(--ink2);font:500 12px var(--sans)}
#pw-host .pw-seg button.on{background:linear-gradient(180deg,#1C6FE0,#1752B8);box-shadow:inset 0 0 0 1px #4B8BFF;color:#fff}
#pw-host .pw-row{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--hair2)}#pw-host .pw-row:first-of-type{border-top:0}
#pw-host .pw-row b{color:#fff;font-size:13px;font-weight:500;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#pw-host .pw-row small{color:var(--ink3);font-size:11.5px}
#pw-host .pw-row.done b{text-decoration:line-through;text-decoration-color:#4A6587;color:var(--ink4)}
#pw-host .pw-grow{flex:1;min-width:0}
#pw-host .pw-x{border:0;background:none;color:var(--ink3);font-size:15px;padding:2px 6px;border-radius:6px}#pw-host .pw-x:hover{color:var(--coral);background:#FF7A6B14}
#pw-host .pw-tag{font-size:10.5px;padding:2px 8px;border-radius:20px;box-shadow:inset 0 0 0 1px #FFFFFF1F;color:var(--ink3);white-space:nowrap}#pw-host .pw-tag.hi{color:var(--amber);box-shadow:inset 0 0 0 1px #FFB15C55}
#pw-host .pw-empty{color:var(--ink3);font-size:12.5px;padding:10px 0}
#pw-host .due{font-size:12px;text-align:right;white-space:nowrap}
#pw-host .pnl{--ac:#38CFF5;position:relative;border-radius:16px;min-width:0;background:linear-gradient(160deg,#0F2140,#0A1730 75%);box-shadow:inset 0 0 0 1px #1E3556,inset 0 1px 0 #FFFFFF12,0 18px 40px -22px #000000E0}
#pw-host .r{display:grid;align-items:center;gap:12px;padding:9px 18px;border-top:1px solid var(--hair2)}#pw-host .r b{font-weight:500;color:#fff}#pw-host .r .sub{display:block;color:var(--ink3);font-size:11.5px;margin-top:1px}
#pw-host .chip{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 9px;border-radius:999px;font:600 11.5px var(--sans);white-space:nowrap;background:#FFFFFF0A;color:var(--ink2);box-shadow:inset 0 0 0 1px #FFFFFF1A}
#pw-host .chip.c-ok{color:#7DF0D4;background:#0D3B35;box-shadow:inset 0 0 0 1px #4FE0C055}#pw-host .chip.c-cobalt{color:#9DC5FF;background:#11295A;box-shadow:inset 0 0 0 1px #4B8BFF66}
#pw-host .steps{display:inline-flex;gap:3px}#pw-host .steps i{width:11px;height:4px;border-radius:2px;background:#FFFFFF17}#pw-host .steps i.d{background:var(--sea)}#pw-host .steps i.c{background:var(--cyan)}
#pw-host .tk-result{margin-top:12px}`;
    document.head.appendChild(st);
  }

  function mount() {
    let root = document.getElementById('pw-host');
    if (root) return root;
    const seed = document.getElementById('projectFilesList');
    if (!seed) return null;
    const panel = seed.closest('.tk-panel') || seed.parentElement;
    panel.innerHTML = '<div id="pw-host"></div>';
    return document.getElementById('pw-host');
  }

  const TABS = [['overview', 'Command Center', 'grid'], ['tasks', 'Work', 'check'], ['files', 'Files', 'file'], ['notes', 'Notes', 'note'], ['toolkit', 'Toolkit', 'tool'], ['deliverables', 'Deliverables', 'box'], ['storyboards', 'Storyboards', 'film'], ['market', 'Analytics', 'chart'], ['ai', 'Meridian AI', 'spark']];
  function err(m) { const e = document.getElementById('pw-err'); if (e) e.textContent = m || ''; }

  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('#projectsMasterList')) WS.clicked = true;
    const sw = document.getElementById('pw-sw'); if (sw && !sw.hidden && !e.target.closest('#pw-sw') && !e.target.closest('#pw-swbtn')) sw.hidden = true;
  }, true);
  document.addEventListener('bv-pick', () => { WS.clicked = true; });

  async function open(pid) {
    const all = typeof projects !== 'undefined' ? projects : [];
    if (!WS.clicked && WS.pid && WS.pid !== pid && all.some((p) => p.id === WS.pid)) pid = WS.pid;
    if (!window.meridianStudioContext.selectProject(pid)) return false;
    if (WS.pid !== pid) { WS.tab = 'overview'; if (window.meridianStoryboard) window.meridianStoryboard.reset(); }
    WS.clicked = false;
    WS.pid = pid;
    document.querySelectorAll('#projectsMasterList .project-item').forEach((el) => el.classList.toggle('active', el.dataset.id === pid));
    if (typeof currentProject !== 'undefined') currentProject = all.find((p) => p.id === pid) || null;
    await render();
    return true;
  }

  /* ------------------------------------------------------------------ measures (same rules as Command; see the spec) */
  function measures(p, tasks) {
    const s = p.summary || {};
    const jobs = s.by_jobs ? (s.progress || 0) : null;   // Meridian's stage formula, computed on home base
    const tTotal = tasks ? tasks.length : (s.tasks_total || 0), tDone = tasks ? tasks.filter((t) => t.completed).length : (s.tasks_done || 0);
    const open_ = tasks ? tasks.filter((t) => !t.completed) : null;
    const overdue = open_ ? open_.filter((t) => t.due_date && t.due_date < today()) : null;
    const nOver = overdue ? overdue.length : (s.tasks_overdue || 0);
    const maxLate = overdue && overdue.length ? Math.max(...overdue.map((t) => -dayDiff(t.due_date))) : null;
    const work = jobs != null ? { v: jobs, label: `jobs ${jobs}% by stage` } : tTotal ? { v: Math.round(100 * tDone / tTotal), label: `tasks ${tDone} of ${tTotal} done (${Math.round(100 * tDone / tTotal)}%)` } : null;
    return { jobs, tTotal, tDone, nOver, maxLate, work, time: s.timeline_elapsed, daysLeft: s.days_left, openDated: open_ ? open_.some((t) => t.due_date) : nOver > 0 };
  }
  function health(p, tasks) {
    const m = measures(p, tasks);
    if (p.status === 'Done') return { k: 'ok', t: 'Complete', why: ['This project is marked Done'] };
    if (p.status === 'On hold') return { k: 'none', t: 'On hold', why: ['Projects on hold are not judged'] };
    if (!p.due_date && !m.openDated) return { k: 'none', t: 'Not enough data', why: ['No project due date and no task due dates to judge against'] };
    const off = [], risk = [], gap = (m.work && m.time != null) ? m.time - m.work.v : null;
    if (m.daysLeft != null && m.daysLeft < 0) off.push(`Past the due date by ${plural(-m.daysLeft, 'day')}`);
    if (gap != null && gap > 25) off.push(`Work is ${gap} points behind time: ${m.work.label}, ${m.time}% of the time used`);
    if (m.nOver >= 3) off.push(`${plural(m.nOver, 'task')} overdue`);
    if (m.maxLate != null && m.maxLate >= 14) off.push(`A task is ${m.maxLate} days overdue`);
    if (gap != null && gap >= 10 && gap <= 25) risk.push(`Work is ${gap} points behind time: ${m.work.label}, ${m.time}% of the time used`);
    if (m.nOver >= 1 && m.nOver <= 2) risk.push(`${plural(m.nOver, 'task')} overdue${m.maxLate ? ` (up to ${plural(m.maxLate, 'day')})` : ''}`);
    if (m.daysLeft != null && m.daysLeft >= 0 && m.daysLeft <= 7 && m.work && m.work.v < 80) risk.push(`Due in ${plural(m.daysLeft, 'day')} with ${m.work.label}`);
    if (off.length) return { k: 'off', t: 'Off track', why: off.concat(risk) };
    if (risk.length) return { k: 'risk', t: 'At risk', why: risk };
    const why = [gap != null ? (gap <= 0 ? `Work is ahead of or level with time (${m.work.label}, ${m.time}% of the time used)` : `Work is ${gap} points behind time, within tolerance`) : 'Pace can\'t be judged without start and due dates and some work recorded'];
    why.push(m.nOver ? `${plural(m.nOver, 'task')} overdue` : 'No overdue tasks');
    return { k: 'ok', t: 'On track', why };
  }
  const HCOL = { ok: '#4FE0C0', risk: '#FFB15C', off: '#FF7A6B', none: '#8AA0BA' };
  const HCLS = { ok: 'c-ok', risk: 'c-amber', off: 'c-coral', none: '' };
  const skel = (n) => `<div class="skels">${Array.from({ length: n }, (_, i) => `<div class="skel" style="height:30px;${i === n - 1 ? 'width:70%' : ''}"></div>`).join('')}</div>`;
  const ftype = (n) => { const x = (String(n).split('.').pop() || '').toLowerCase(); return x === 'pdf' ? ['pdf', 'PDF'] : x === 'fig' ? ['fig', 'FIG'] : /png|jpe?g|gif|webp|svg/.test(x) ? ['img', x.toUpperCase().slice(0, 4)] : /docx?|txt|rtf|md/.test(x) ? ['doc', x.toUpperCase().slice(0, 4)] : ['', (x || 'FILE').toUpperCase().slice(0, 4)]; };
  const JL = { not_started: 'Not started', in_progress: 'In progress', done: 'Complete' };
  const mainJob = (p) => { const j = p.jobs || []; return j.find((x) => x.status === 'in_progress') || j.find((x) => x.status === 'not_started') || null; };

  /* ------------------------------------------------------------------ shell */
  async function render() {
    const epoch = ++WS.renderEpoch;
    css();
    const root = mount();
    if (!root || !WS.pid) return;
    if (window.meridianStudioContext.snapshot().project?.id !== WS.pid) {
      root.replaceChildren();
      return;
    }
    const split = root.closest('.projects-split'); if (split) split.classList.add('pw-full');
    const pid = WS.pid;
    const tab = WS.tab;
    const request = window.meridianStudioContext.beginProjectRequest();
    const res = await M().ws('GET', `/api/projects/${pid}`);
    if (WS.pid !== pid || WS.tab !== tab || WS.renderEpoch !== epoch ||
        !window.meridianStudioContext.isCurrentRequest(request)) return;
    if (!res || !res.success || res.project?.id !== pid) {
      root.innerHTML = `<div class="state"><b>This project could not be loaded</b>${esc((res && res.error) || '')}</div>`;
      return;
    }
    const p = res.project, s = p.summary || {}, big = WS.tab === 'overview', team = p.members || [];
    const mj = mainJob(p);
    const tabs = TABS.map(([k, l, i]) => `<button type="button" role="tab" aria-selected="${WS.tab === k}" class="pw-tab ${WS.tab === k ? 'on' : ''}" data-tab="${k}">${ic(i, 16)}${l}${k === 'tasks' && s.tasks_total ? `<span class="n">${s.tasks_total - (s.tasks_done || 0)}</span>` : ''}</button>`).join('');
    const stCls = p.status === 'On hold' ? 'hold' : p.status === 'Done' ? 'done' : '';
    const crumb = `<nav class="pw-crumb" aria-label="Breadcrumb"><button type="button" class="home" id="pw-home">Projects</button><span>›</span><button type="button" class="pw-switch" id="pw-swbtn" aria-haspopup="dialog">${esc(p.name)} ${ic('chev', 14)}</button></nav>`;
    const due = p.due_date ? `${fmtDY(p.due_date)}<small>${s.days_left == null ? '' : s.days_left < 0 ? plural(-s.days_left, 'day') + ' late' : plural(s.days_left, 'day') + ' remaining'}</small>` : 'Not set<small>no due date yet</small>';
    root.innerHTML = (big ? `<div class="pw-cover" aria-label="Project">
        <div class="pw-ctop">${crumb}<div class="pw-cact"><button type="button" class="pill" data-goto="ai">${ic('spark', 14)}Ask Meridian</button></div></div>
        <div class="pw-id"><div class="pw-tile" style="background:${grad(p.id)}" aria-hidden="true">${esc(ini(p.name))}</div>
          <div style="min-width:0"><div class="pw-eyebrow">Client<i></i><b>${esc(p.client || 'Breakthrough Ventures')}</b></div><h2 class="pw-title" title="${esc(p.name)}">${esc(p.name)}</h2></div>
          ${p.description ? `<p class="pw-desc" title="${esc(p.description)}">${esc(p.description)}</p>` : ''}</div>
        <div class="pw-facts" role="list">
          <div role="listitem"><span class="label">Status</span><span class="v"><span class="pw-status ${stCls}"><i></i>${esc(p.status)}</span></span></div>
          <div role="listitem"><span class="label">In progress</span><span class="v"><span class="vi">${ic('ring', 15)}</span><span>${mj ? esc(mj.job + (mj.round ? ' ' + mj.round : '')) : 'Nothing yet'}<small>${mj ? (mj.status === 'in_progress' ? `${esc(mj.stage || 'In progress')} · stage ${mj.stage_index || 1} of ${mj.stages_total || 1}` : 'Not started') : 'no jobs in motion'}</small></span></span></div>
          <div role="listitem"><span class="label">Due date</span><span class="v"><span class="vi">${ic('cal', 15)}</span><span>${due}</span></span></div>
          <div role="listitem"><span class="label">Lead</span><span class="v"><span class="av jax">J</span>Jax</span></div>
          <div role="listitem"><span class="label">Team</span><span class="v">${team.length ? `<span class="avs">${team.slice(0, 4).map((m) => `<span class="av" title="${esc(m.name)}">${esc(ini(m.name))}</span>`).join('')}</span><span>${esc(team.map((m) => m.name).slice(0, 2).join(', '))}${team.length > 2 ? ' +' + (team.length - 2) : ''}</span>` : '<span class="dim">Just Jax</span>'}</span></div>
        </div>
        <nav class="pw-tabs" role="tablist" aria-label="Project sections">${tabs}</nav><div class="pw-sw" id="pw-sw" hidden></div></div>`
      : `<div class="pw-cover slim" aria-label="Project"><div class="pw-ctop">${crumb}</div><div class="pw-slimrow"><span class="pw-tile" style="background:${grad(p.id)}">${esc(ini(p.name))}</span>
          <span class="pw-slimname" title="${esc(p.name)}">${esc(p.name)}</span><span class="pw-status ${stCls}"><i></i>${esc(p.status)}</span></div>
          <nav class="pw-tabs" role="tablist" aria-label="Project sections">${tabs}</nav><div class="pw-sw" id="pw-sw" hidden></div></div>`)
      + '<div class="pw-err" id="pw-err" role="alert"></div><div class="pw-body" id="pw-body"></div>';
    root.querySelectorAll('[data-tab]').forEach((b) => {
      b.onclick = () => { WS.tab = b.dataset.tab; render(); };
      b.onkeydown = (e) => { const i = TABS.findIndex((t) => t[0] === b.dataset.tab), n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null; if (n == null) return; e.preventDefault(); const k = TABS[(n + TABS.length) % TABS.length][0]; const nb = root.querySelector(`[data-tab="${k}"]`); if (nb) nb.focus(); };
    });
    root.querySelectorAll('.pw-cover [data-goto]').forEach((b) => (b.onclick = () => { WS.tab = b.dataset.goto; render(); }));
    document.getElementById('pw-home').onclick = () => { const sp = root.closest('.projects-split'); if (sp) sp.classList.toggle('pw-full'); };
    document.getElementById('pw-swbtn').onclick = (e) => { e.stopPropagation(); openSwitcher(); };
    const dock = document.getElementById('dockProjectName');
    if (dock) dock.textContent = p.name;
    const body = document.getElementById('pw-body');
    return ({ overview, market, toolkit, deliverables, storyboards, tasks, files, notes, ai })[tab](body, p);
  }
  function openSwitcher() {
    const sw = document.getElementById('pw-sw'); if (!sw) return;
    const all = typeof projects !== 'undefined' ? projects : [];
    sw.hidden = false;
    const draw = (q) => {
      const list = all.filter((x) => !q || (x.name + ' ' + (x.client || '')).toLowerCase().includes(q.toLowerCase()));
      sw.querySelector('#pw-swl').innerHTML = list.map((x) => `<button type="button" class="pw-swi" data-sw="${esc(x.id)}"><span class="t" style="background:${grad(x.id)}">${esc(ini(x.name))}</span><span style="min-width:0"><b>${esc(x.name)}</b><small>${esc(x.client || 'Breakthrough Ventures')} · ${esc(x.status || '')}</small></span>${x.id === WS.pid ? '<span style="color:var(--cyan)">✓</span>' : '<span></span>'}</button>`).join('') || '<div class="state"><b>No projects match</b></div>';
      sw.querySelectorAll('[data-sw]').forEach((b) => (b.onclick = () => { sw.hidden = true; if (b.dataset.sw !== WS.pid) { WS.clicked = true; open(b.dataset.sw); } }));
    };
    sw.innerHTML = '<input id="pw-swq" placeholder="Find a project" aria-label="Find a project" autocomplete="off"><div id="pw-swl" role="listbox"></div>';
    const q = document.getElementById('pw-swq');
    q.oninput = () => draw(q.value.trim());
    q.onkeydown = (e) => { if (e.key === 'Escape') sw.hidden = true; if (e.key === 'Enter') { const f = sw.querySelector('[data-sw]'); if (f) f.click(); } };
    draw(''); q.focus();
  }

  /* ------------------------------------------------------------------ Command Center */
  function ringSvg(pct, color) {
    const r = 70, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, pct || 0));
    return `<svg viewBox="0 0 168 168" aria-hidden="true"><defs><linearGradient id="pwrg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2AB2F0"/><stop offset="1" stop-color="${color}"/></linearGradient></defs>
      <circle cx="84" cy="84" r="${r}" fill="none" stroke="#FFFFFF14" stroke-width="13"/>
      <circle cx="84" cy="84" r="${r}" fill="none" stroke="url(#pwrg)" stroke-width="13" stroke-linecap="round" stroke-dasharray="${(c * v / 100).toFixed(1)} ${c.toFixed(1)}"/></svg>`;
  }
  function liveView(body, p, tab, epoch, dataEpoch, request) {
    return WS.pid === p.id && WS.tab === tab && WS.renderEpoch === epoch && WS.dataEpoch === dataEpoch &&
      body.isConnected && window.meridianStudioContext.isCurrentRequest(request);
  }
  function overview(body, p) {
    const pid = p.id, links = p.links || [], team = p.members || [];
    const epoch = WS.renderEpoch;
    const dataEpoch = ++WS.dataEpoch;
    const request = window.meridianStudioContext.beginProjectRequest();
    const site = links.find((l) => l.kind === 'website') || links.find((l) => l.kind === 'staging');
    const h0 = health(p), m0 = measures(p, null), mj = mainJob(p);
    const pct = m0.jobs != null ? m0.jobs : m0.tTotal ? Math.round(100 * m0.tDone / m0.tTotal) : 0;
    const jobs = (p.jobs || []).slice().sort((a, b) => ({ done: 0, in_progress: 1, not_started: 2 }[a.status] - { done: 0, in_progress: 1, not_started: 2 }[b.status])).slice(0, 6);
    const doneN = (p.jobs || []).filter((j) => j.status === 'done').length;
    body.innerHTML = `<div class="grid">
      <section class="pwx deep a-cyan s7" aria-label="Project progress"><div class="ph"><span class="gl">${ic('ring', 16)}</span><h3>Project Progress</h3><div class="end"><button type="button" class="pill" data-goto="tasks">View work ${ic('arrow', 13)}</button></div></div>
        <div class="prog"><div class="ringw" id="pw-ring">${ringSvg(pct, HCOL[h0.k])}<div class="c"><b>${pct}<small>%</small></b><span style="color:${HCOL[h0.k]}">${esc(h0.t)}</span><em>${m0.jobs != null ? 'jobs by stage' : m0.tTotal ? 'tasks done' : 'nothing measured yet'}</em></div></div>
          <div style="min-width:0"><h4 class="phead">${mj ? `<b>${esc(mj.status === 'in_progress' ? (mj.stage || 'Work') : mj.job)}</b> ${mj.status === 'in_progress' ? 'in progress' : 'up next'}` : (p.jobs || []).length ? '<b>All jobs</b> complete' : 'No jobs <b>set yet</b>'}</h4>
            <p class="psub" id="pw-psub">${mj ? `${esc(mj.job + (mj.round ? ' ' + mj.round : ''))}${mj.status === 'in_progress' ? ` is at stage ${mj.stage_index || 1} of ${mj.stages_total || 1}` : ' hasn\'t started'}. ${doneN} of ${plural((p.jobs || []).length, 'job row')} complete.` : 'Jax adds what this project includes in Meridian.'} ${esc(h0.why[0] || '')}.</p>
            ${jobs.length ? `<div class="stepper">${jobs.map((j, i) => `<div class="stp ${j.status === 'done' ? 'd' : j === mj ? 'c' : ''}"><i>${j.status === 'done' ? '✓' : i + 1}</i><b title="${esc(j.job + ' ' + (j.round || ''))}">${esc(j.job.split(/[\s/&]+/)[0])}${j.round ? ' ' + esc(j.round) : ''}</b><small>${JL[j.status]}</small></div>`).join('')}</div>` : ''}</div></div></section>
      <section class="pwx a-blue s5" aria-label="Analytics and growth"><div class="ph"><span class="gl">${ic('chart', 16)}</span><h3>Analytics &amp; Growth</h3><div class="end"><button type="button" class="pill" data-goto="market">View details ${ic('arrow', 13)}</button></div></div><div id="pw-an">${skel(3)}</div></section>
      <section class="pwx a-cyan s5" aria-label="Work and deliverables"><div class="ph"><span class="gl">${ic('check', 16)}</span><h3>Work &amp; Deliverables</h3><div class="end"><button type="button" class="pill" data-goto="tasks">View all tasks ${ic('arrow', 13)}</button></div></div><div id="pw-w">${skel(4)}</div></section>
      <section class="pwx a-blue s4" aria-label="Files and notes"><div class="ph"><span class="gl">${ic('file', 16)}</span><h3>Files &amp; Notes</h3><div class="end"><button type="button" class="pill" data-goto="files">View all files ${ic('arrow', 13)}</button></div></div><div id="pw-f">${skel(4)}</div></section>
      <section class="pwx a-amber s3" aria-label="Deliverables"><div class="ph"><span class="gl">${ic('box', 16)}</span><h3>Deliverables</h3><div class="end"><button type="button" class="pill" data-goto="deliverables">Open ${ic('arrow', 13)}</button></div></div><div id="pw-d">${skel(3)}</div></section>
      <section class="pwx a-teal s4" aria-label="Client and team"><div class="ph"><span class="gl">${ic('users', 16)}</span><h3>Client &amp; Team</h3></div><div id="pw-p"></div></section>
      <section class="pwx a-violet s4" aria-label="Messages"><div class="ph"><span class="gl">${ic('msg', 16)}</span><h3>Messages</h3><span id="pw-unread"></span><div class="end"><button type="button" class="pill" id="pw-opench">Open channel ${ic('arrow', 13)}</button></div></div><div id="pw-msg">${skel(3)}</div></section>
      <section class="pwx a-steel s4" aria-label="Recent activity"><div class="ph"><span class="gl">${ic('act', 16)}</span><h3>Recent Activity</h3><span class="meta">partial history</span></div><div id="pw-a">${skel(3)}</div></section></div>`;
    body.querySelectorAll('[data-goto]').forEach((b) => (b.onclick = () => { WS.tab = b.dataset.goto; render(); }));
    const live = (el) => el && liveView(body, p, 'overview', epoch, dataEpoch, request) && document.body.contains(el);
    // client & team
    const fillPeople = (tasks) => {
      const el = document.getElementById('pw-p'); if (!el) return;
      el.innerHTML = `<div class="client"><span class="lg">${esc(ini(p.client || 'BV'))}</span><span style="min-width:0"><b>${esc(p.client || 'Breakthrough Ventures')}</b><small>${p.client ? 'Client' : 'Internal project'}</small>
          <div class="cbtns">${site ? `<button type="button" class="bbtn" data-preview="${esc(site.url)}">${ic('globe', 14)}Website</button>` : ''}<button type="button" class="bbtn ${site ? 'q' : ''}" id="pw-tojax">${ic('send', 14)}Send to Jax</button></div></span></div>`
        + team.map((m) => { const o = tasks ? tasks.filter((t) => !t.completed && t.assignee_id === m.id) : [], j = (p.jobs || []).filter((x) => x.assigned_to === m.name && x.status !== 'done');
          return `<div class="row" style="grid-template-columns:28px minmax(0,1fr) auto"><span class="av">${esc(ini(m.name))}</span><span class="clip"><b>${esc(m.name)}${m.id === me().id ? ' <span class="dim">(you)</span>' : ''}</b><span class="sub">${[j.length ? j.map((x) => x.job + (x.round ? ' ' + x.round : '')).join(', ') : 'Team member', tasks ? plural(o.length, 'open task') : ''].filter(Boolean).map(esc).join(' · ')}</span></span>
            ${m.id === me().id ? '<span></span>' : `<button type="button" class="kebab" data-dm="${esc(m.id)}" title="Message ${esc(m.name)}">${ic('msg', 15)}</button>`}</div>`; }).join('');
      el.querySelectorAll('[data-preview]').forEach((b) => (b.onclick = async () => { const r = await window.meridian.api.wsPreview(b.dataset.preview, p.name); if (!r.success) err(r.error); }));
      const tj = document.getElementById('pw-tojax'); if (tj) tj.onclick = () => { if (typeof switchView === 'function') switchView('send'); };
      el.querySelectorAll('[data-dm]').forEach((b) => (b.onclick = () => openConvo('d:' + b.dataset.dm)));
    };
    fillPeople(null);
    // tasks-dependent
    M().ws('GET', `/api/projects/${pid}/tasks`).then((r) => {
      const box = document.getElementById('pw-w'); if (!live(box)) return;
      if (!r || !r.success) { box.innerHTML = `<div class="state"><b>Tasks didn't load</b>${esc((r && r.error) || '')}</div>`; return; }
      const tasks = r.tasks || [], h = health(p, tasks), m = measures(p, tasks);
      const pctT = m.jobs != null ? m.jobs : m.tTotal ? Math.round(100 * m.tDone / m.tTotal) : 0;
      const ring = document.getElementById('pw-ring'); if (ring) ring.innerHTML = `${ringSvg(pctT, HCOL[h.k])}<div class="c"><b>${pctT}<small>%</small></b><span style="color:${HCOL[h.k]}">${esc(h.t)}</span><em>${m.jobs != null ? 'jobs by stage' : m.tTotal ? 'tasks done' : 'nothing measured yet'}</em></div>`;
      fillPeople(tasks);
      const drawWork = () => {
        const t0 = today(), mine = tasks.filter((t) => t.assignee_id === me().id);
        const sets = { all: tasks.filter((t) => !t.completed), mine: mine.filter((t) => !t.completed), late: tasks.filter((t) => !t.completed && t.due_date && t.due_date < t0), done: tasks.filter((t) => t.completed) };
        const list = sets[WS.wf].slice().sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
        box.innerHTML = `<div class="chips" role="group" aria-label="Filter">${[['all', 'Open'], ['mine', 'Mine'], ['late', 'Overdue'], ['done', 'Done']].map(([k, l]) => `<button type="button" class="chip2 ${WS.wf === k ? 'on' : ''}" data-wf="${k}">${l} <em>${sets[k].length}</em></button>`).join('')}</div>`
          + (list.length ? list.slice(0, 6).map((t) => { const rd = relDue(t.due_date), late = !t.completed && t.due_date && t.due_date < t0;
            return `<div class="row" style="grid-template-columns:20px minmax(0,1fr) 28px 62px 54px auto"><input type="checkbox" class="cbox" data-done="${t.id}" ${t.completed ? 'checked' : ''} aria-label="${t.completed ? 'Reopen' : 'Complete'} ${esc(t.title)}">
              <span class="clip"><b>${esc(t.title)}</b></span><span class="av ${t.assignee_id ? '' : 'none'}" title="${esc(t.assigned_to)}">${t.assignee_id ? esc(ini(t.assigned_to)) : '?'}</span>
              <span class="when ${t.completed ? 'faint' : rd.c}">${t.due_date ? esc(fmtD(t.due_date)) : '—'}</span><span class="prio ${esc(t.priority || 'Normal')}">${esc(t.priority === 'Normal' ? 'Normal' : t.priority || 'Normal')}</span>
              <span class="stat ${t.completed ? 'done' : late ? 'late' : 'todo'}"><i></i>${t.completed ? 'Done' : late ? 'Overdue' : 'To do'}</span></div>`; }).join('')
            : `<div class="state"><span class="sg">${ic('check', 18)}</span><b>${{ all: 'No open tasks', mine: 'Nothing assigned to you', late: 'Nothing overdue', done: 'Nothing done yet' }[WS.wf]}</b>${WS.wf === 'all' ? 'Add one in Work.' : ''}</div>`)
          + (list.length > 6 ? `<div class="pf"><span>+${list.length - 6} more</span><button type="button" class="lnk" data-goto="tasks">All work →</button></div>` : '');
        box.querySelectorAll('[data-wf]').forEach((b) => (b.onclick = () => { WS.wf = b.dataset.wf; drawWork(); }));
        box.querySelectorAll('[data-done]').forEach((cb) => (cb.onchange = async () => { const x = await M().ws('POST', `/api/tasks/${cb.dataset.done}/complete`, { completed: cb.checked }); if (!x.success) err(x.error); render(); }));
        box.querySelectorAll('[data-goto]').forEach((b) => (b.onclick = () => { WS.tab = 'tasks'; render(); }));
      };
      if (WS.wf === 'all' && !tasks.some((t) => !t.completed) && tasks.length) WS.wf = 'done';
      drawWork();
      Promise.all([M().ws('GET', `/api/projects/${pid}/notes`), M().ws('GET', `/api/projects/${pid}/files`)]).then(([n, f]) => {
        const fb = document.getElementById('pw-f'), ab = document.getElementById('pw-a'); if (!live(fb)) return;
        const notes = (n && n.notes) || [], files = (f && f.files) || [];
        const drawFiles = () => {
          const sets = { recent: files, notes: [], Website: files.filter((x) => x.section === 'Website'), Brand: files.filter((x) => x.section === 'Brand'), Docs: files.filter((x) => x.section === 'Docs') };
          const items = WS.ff === 'notes' ? notes.map((x) => ({ k: 'n', n: x.title, s: 'Note · ' + x.author, u: x.date, z: '' })) : sets[WS.ff].map((x) => ({ k: 'f', n: x.name, s: x.section, u: x.updated, z: x.size, sec: x.section }));
          items.sort((a, b) => (b.u || '').localeCompare(a.u || ''));
          fb.innerHTML = `<div class="chips" role="group" aria-label="Filter">${[['recent', 'Recent files', files.length], ['notes', 'Notes', notes.length], ['Website', 'Website', sets.Website.length], ['Brand', 'Brand', sets.Brand.length], ['Docs', 'Docs', sets.Docs.length]].map(([k, l, c]) => `<button type="button" class="chip2 ${WS.ff === k ? 'on' : ''}" data-ff="${k}">${l} <em>${c}</em></button>`).join('')}</div>`
            + (items.length ? items.slice(0, 5).map((x) => { const [c, l] = x.k === 'n' ? ['note', 'NOTE'] : ftype(x.n);
              return `<div class="row" style="grid-template-columns:30px minmax(0,1fr) auto auto 28px"><span class="fi ${c}">${l}</span><span class="clip"><b>${esc(x.n)}</b><span class="sub">${esc(x.s)}</span></span><span class="when">${esc(fmtD(String(x.u).slice(0, 10)))}</span><span class="when faint">${esc(x.z || '')}</span>
                ${x.k === 'f' ? `<button type="button" class="kebab" data-dl="${esc(x.n)}" data-dsec="${esc(x.sec)}" title="Download">${ic('dl', 15)}</button>` : '<span></span>'}</div>`; }).join('')
              : `<div class="state"><span class="sg">${ic(WS.ff === 'notes' ? 'note' : 'file', 18)}</span><b>${WS.ff === 'notes' ? 'No notes yet' : 'No files here yet'}</b>${WS.ff === 'notes' ? 'Write one in Notes.' : 'Upload in Files: website files in Website, logos in Brand.'}</div>`);
          fb.querySelectorAll('[data-ff]').forEach((b) => (b.onclick = () => { WS.ff = b.dataset.ff; drawFiles(); }));
          fb.querySelectorAll('[data-dl]').forEach((b) => (b.onclick = async () => { const x = await window.meridian.api.wsDownload(pid, b.dataset.dl, b.dataset.dsec); err(x.success ? '' : x.error); }));
        };
        drawFiles();
        const ev = [];
        tasks.forEach((t) => { if (t.completed && t.done_at) ev.push({ at: t.done_at, rec: true, ic: 'check', cls: 'ok', h: `Completed <b>${esc(t.title)}</b>`, sub: `Assigned to ${esc(t.assigned_to)}` }); });
        notes.forEach((x) => ev.push({ at: x.date, rec: false, ic: 'note', h: `${esc(x.author)} saved a note`, sub: esc(x.title) }));
        files.forEach((x) => ev.push({ at: x.updated, rec: false, ic: 'file', cls: 'inf', h: `File changed: <b>${esc(x.name)}</b>`, sub: esc(x.section) }));
        const top = ev.filter((e) => e.at).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);
        ab.innerHTML = top.length ? `<div class="tl">${top.map((e) => `<div class="ev"><span class="ic ${e.cls || ''}">${ic(e.ic, 14)}</span><p>${e.h}<span class="rec ${e.rec ? '' : 'inf'}">${e.rec ? 'RECORDED' : 'MODIFIED'}</span><small>${e.sub}</small></p><time title="${esc(e.at)}">${esc(ago(e.at))}</time></div>`).join('')}</div>`
          : `<div class="state"><span class="sg">${ic('act', 18)}</span><b>No activity yet</b>Completed tasks, notes and file changes show up here.</div>`;
      });
    });
    // analytics
    M().ws('GET', `/api/projects/${pid}/market`).then((r) => {
      const box = document.getElementById('pw-an'); if (!live(box)) return;
      const rep = r && r.success && r.report, Mx = (rep && rep.metrics) || {};
      const val = (k) => { const m = Mx[k]; return m && m.value != null && typeof m.value !== 'object' ? m : null; };
      const kpi = (k, label, fmt) => { const m = val(k); return `<div class="kpi"><b class="${m ? '' : 'none'}">${m ? esc(fmt(m.value)) : '—'}</b><span>${label}</span><em class="${m ? (m.confidence === 'estimate' ? 'est' : '') : 'miss'}">${m ? esc(m.confidence.toUpperCase()) : 'NOT MEASURED'}</em></div>`; };
      const num = (v) => Number(v).toLocaleString(), pc = (v) => (v > 0 ? '+' : '') + v + '%';
      const series = (Mx.demand_series && Array.isArray(Mx.demand_series.value)) ? Mx.demand_series.value : [];
      const W = 520, H = 170, gx = [30, W - 8], gy = [14, H - 28];
      let plot = '';
      if (series.length > 2) {
        const vals = series.map((x) => x.searches || 0), mx = Math.max(...vals, 1), n = vals.length;
        const pts = vals.map((v, i) => [gx[0] + i * (gx[1] - gx[0]) / (n - 1), gy[1] - (v / mx) * (gy[1] - gy[0])]);
        const line = pts.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' ');
        plot = `<path d="${line} L${pts[n - 1][0]} ${gy[1]} L${gx[0]} ${gy[1]} Z" fill="url(#pwag)"/><path d="${line}" fill="none" stroke="#5FA8FF" stroke-width="2.4" stroke-linejoin="round" style="filter:drop-shadow(0 0 6px #4B8BFF)"/><circle cx="${pts[n - 1][0]}" cy="${pts[n - 1][1]}" r="4.5" fill="#CFE6FF" stroke="#0A1730" stroke-width="2"/>
          <text x="${gx[0]}" y="${H - 8}">${esc(series[0].month)}</text><text x="${gx[1] - 44}" y="${H - 8}">${esc(series[n - 1].month)}</text>`;
      }
      box.innerHTML = `<div class="kpis">${kpi('monthly_searches', 'Monthly searches', num)}${kpi('demand_trend', '12-month trend', pc)}${kpi('visibility', 'Visibility', (v) => v + '%')}${kpi('competitors_found', 'Competitors', num)}</div>
        <div class="chart"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${series.length ? 'Monthly searches over time' : 'No search history yet'}"><defs><linearGradient id="pwag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3D7BFF" stop-opacity=".5"/><stop offset="1" stop-color="#3D7BFF" stop-opacity="0"/></linearGradient></defs>
          ${[0, 1, 2, 3].map((i) => `<line x1="${gx[0]}" x2="${gx[1]}" y1="${gy[0] + i * (gy[1] - gy[0]) / 3}" y2="${gy[0] + i * (gy[1] - gy[0]) / 3}" stroke="#FFFFFF10"/>`).join('')}${plot}</svg>
          ${series.length > 2 ? '' : `<div class="msg"><b>${rep ? 'No search history in this report' : 'No market analysis yet'}</b>${rep ? '' : 'Jax runs it from Meridian. Search demand, visibility and competitors for this client\'s area show here.'}</div>`}</div>`;
    });
    // deliverables
    M().ws('GET', `/api/projects/${pid}/deliverables`).then((r) => {
      const box = document.getElementById('pw-d'); if (!live(box)) return;
      const list = (r && r.deliverables) || [];
      const cats = [['draft', 'Draft', '#6F8FB8'], ['ready', 'With Jax', '#FFB15C'], ['approved', 'Approved', '#4FE0C0'], ['delivered', 'Delivered', '#4B8BFF']].map(([k, l, c]) => [k, l, c, list.filter((d) => d.status === k).length]);
      const R = 52, C = 2 * Math.PI * R; let off = 0;
      const arcs = list.length ? cats.filter((x) => x[3]).map(([, , c, n]) => { const len = C * n / list.length; const s = `<circle cx="66" cy="66" r="${R}" fill="none" stroke="${c}" stroke-width="14" stroke-dasharray="${Math.max(0, len - 2).toFixed(1)} ${C.toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}"/>`; off += len; return s; }).join('') : '';
      box.innerHTML = `<div class="donutw"><div class="donut"><svg viewBox="0 0 132 132" aria-hidden="true"><circle cx="66" cy="66" r="${R}" fill="none" stroke="#FFFFFF12" stroke-width="14"/>${arcs}</svg><div class="c"><b>${list.length}</b><span>deliverable${list.length === 1 ? '' : 's'}</span></div></div>
        <div class="leg">${cats.map(([, l, c, n]) => `<div><i style="background:${c}"></i><span>${l}</span><b>${n}</b></div>`).join('')}</div></div>
        ${list.length ? '' : '<div class="pf"><span>Have Meridian draft one in the Toolkit.</span><button type="button" class="lnk" id="pw-totk">Toolkit →</button></div>'}`;
      const tk = document.getElementById('pw-totk'); if (tk) tk.onclick = () => { WS.tab = 'toolkit'; render(); };
    });
    // messages: this project's team channel (reading it marks it read, like opening it in Messages)
    const chId = 'p:' + pid;
    document.getElementById('pw-opench').onclick = () => openConvo('c:' + chId);
    M().ws('GET', '/api/chat-hub/sidebar').then((sb) => {
      const ch = sb && sb.success && (sb.channels || []).find((c) => c.id === chId);
      const u = document.getElementById('pw-unread'); if (!live(u)) return null;
      if (ch && ch.unread) u.innerHTML = `<span class="unread">${ch.unread} unread</span>`;
      return M().ws('GET', `/api/chat-hub/thread?c=${encodeURIComponent('c:' + chId)}&after=0`);
    }).then((t) => {
      const box = document.getElementById('pw-msg'); if (!live(box)) return;
      const msgs = ((t && t.messages) || []).slice(-4).reverse();
      box.innerHTML = msgs.length ? msgs.map((x) => `<div class="msgr"><span class="av">${esc(x.initials || ini(x.sender))}</span><span style="min-width:0"><b>${esc(x.sender)}</b><p>${esc(x.text || (x.media ? 'Shared ' + x.media.name : ''))}</p></span><time>${esc(ago(x.time))}</time></div>`).join('')
        : `<div class="state"><span class="sg">${ic('msg', 18)}</span><b>No messages in this project's channel</b>Start the conversation with the team.</div>`;
    }).catch(() => { const box = document.getElementById('pw-msg'); if (live(box)) box.innerHTML = '<div class="state"><b>Messages didn\'t load</b></div>'; });
  }
  function openConvo(convo) {
    if (typeof switchView === 'function') switchView('messages');
    setTimeout(() => { if (window.meridianMessages && window.meridianMessages.open) window.meridianMessages.open(convo); }, 150);
  }

  function wireLinks(body, p) {
    body.querySelectorAll('[data-preview]').forEach((b) => (b.onclick = async () => { const r = await window.meridian.api.wsPreview(b.dataset.preview, p.name); if (!r.success) err(r.error); }));
    body.querySelectorAll('[data-browser]').forEach((b) => (b.onclick = () => window.meridian.openExternal(b.dataset.browser)));
    body.querySelectorAll('[data-unlink]').forEach((b) => (b.onclick = async () => {
      if (!confirm('Remove this link?')) return;
      const r = await M().ws('POST', `/api/projects/${p.id}/links/${b.dataset.unlink}/delete`, {});
      if (!r.success) return err(r.error);
      render();
    }));
    const f = document.getElementById('pw-link');
    if (f) f.onsubmit = async (e) => {
      e.preventDefault();
      let url = document.getElementById('pw-link-url').value.trim();
      if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
      const r = await M().ws('POST', `/api/projects/${p.id}/links`, { url, label: document.getElementById('pw-link-label').value.trim(), kind: document.getElementById('pw-link-kind').value });
      if (!r.success) return err(r.error);
      render();
    };
  }

  /* ------------------------------------------------------------------ Work */
  async function tasks(body, p) {
    const epoch = WS.renderEpoch;
    const dataEpoch = ++WS.dataEpoch;
    const request = window.meridianStudioContext.beginProjectRequest();
    body.innerHTML = skel(4);
    const r = await M().ws('GET', `/api/projects/${p.id}/tasks`);
    if (!liveView(body, p, 'tasks', epoch, dataEpoch, request)) return;
    if (!r || !r.success) { body.innerHTML = `<div class="state err"><span class="sg">!</span><b>Tasks didn't load</b>${esc((r && r.error) || '')}</div>`; return; }
    const list = r.tasks || [], myId = me().id;
    const shown = list.filter((t) => (!WS.mine || t.assignee_id === myId) && (WS.show === 'all' || (WS.show === 'open' ? !t.completed : t.completed)));
    const t0 = today(), g = { Overdue: [], 'Due this week': [], Later: [], 'No date': [], Done: [] };
    shown.forEach((t) => { if (t.completed) g.Done.push(t); else if (!t.due_date) g['No date'].push(t); else if (t.due_date < t0) g.Overdue.push(t); else if (dayDiff(t.due_date) <= 7) g['Due this week'].push(t); else g.Later.push(t); });
    Object.values(g).forEach((a) => a.sort((x, y) => (x.due_date || '9999').localeCompare(y.due_date || '9999')));
    const row = (t) => { const rd = relDue(t.due_date);
      return `<div class="pw-row ${t.completed ? 'done' : ''}" style="padding:9px 16px"><input type="checkbox" class="pw-chk" data-done="${t.id}" ${t.completed ? 'checked' : ''} aria-label="${t.completed ? 'Reopen' : 'Complete'} ${esc(t.title)}">
        <div class="pw-grow"><b>${esc(t.title)}</b><small>${esc(t.assigned_to)}${t.completed && t.done_at ? ' · done ' + esc(fmtD(t.done_at)) : ''}</small></div>
        ${t.priority === 'High' || t.priority === 'Urgent' ? `<span class="pw-tag hi">${esc(t.priority)}</span>` : ''}<span class="due ${t.completed ? 'faint' : rd.c}" style="min-width:90px">${t.completed ? '' : esc(rd.t)}</span></div>`; };
    const jobs = p.jobs || [], JL = { not_started: 'Not started', in_progress: 'In progress', done: 'Done' };
    body.innerHTML = `<div class="pw-form" style="justify-content:space-between">
        <div class="pw-form"><div class="pw-seg" role="group" aria-label="Whose tasks"><button type="button" data-mine="1" class="${WS.mine ? 'on' : ''}">Mine</button><button type="button" data-mine="0" class="${WS.mine ? '' : 'on'}">Everyone</button></div>
        <div class="pw-seg" role="group" aria-label="Status"><button type="button" data-show="open" class="${WS.show === 'open' ? 'on' : ''}">Open</button><button type="button" data-show="done" class="${WS.show === 'done' ? 'on' : ''}">Done</button><button type="button" data-show="all" class="${WS.show === 'all' ? 'on' : ''}">All</button></div></div>
        <span class="dim" style="font-size:12px">${list.filter((t) => t.completed).length} of ${list.length} done on this project</span></div>
      <section class="pnl" aria-label="Tasks"><div class="ph"><span class="glyph">☑</span><h3>Tasks</h3><span class="meta">${plural(shown.length, 'task')} shown</span></div>
        ${shown.length ? Object.entries(g).filter(([, v]) => v.length).map(([k, v]) => `<div class="label" style="padding:10px 16px 4px;display:flex;justify-content:space-between;background:#00000020;border-top:1px solid var(--hair2)">${k}<span class="faint">${v.length}</span></div>${v.map(row).join('')}`).join('')
          : `<div class="state"><span class="sg" style="color:var(--sea)">✓</span><b>${WS.mine ? 'Nothing here for you' : 'No tasks here'}</b>${WS.mine ? 'Switch to Everyone to see the whole project.' : 'Add one below.'}</div>`}
        <form class="pw-form" id="pw-task" style="padding:12px 16px;border-top:1px solid var(--hair2)"><input class="pw-in grow" id="pw-t-title" placeholder="Add a task" maxlength="300" aria-label="Task" required>
          <input class="pw-in" type="date" id="pw-t-due" aria-label="Due date"><select class="pw-in" id="pw-t-who" aria-label="For"><option value="">For me</option>
          ${(p.members || []).filter((m) => m.id !== myId).map((m) => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('')}</select><button class="pw-btn">Add task</button></form></section>
      ${jobs.length ? `<section class="pnl m-steel" aria-label="Jobs"><div class="ph"><span class="glyph">◆</span><h3>Jobs</h3><span class="meta">set by Jax · read-only here</span></div>
        ${jobs.map((j) => { const n = j.stages_total || 0, ix = (j.stage_index || 0) - 1, rd = relDue(j.due_date);
          return `<div class="r" style="grid-template-columns:minmax(0,1fr) auto auto"><span class="clip"><b>${esc(j.job)}${j.round ? ` <span class="dim" style="font-weight:400">${esc(j.round)}</span>` : ''}</b><span class="sub" style="display:flex;gap:8px;align-items:center"><span class="steps">${Array.from({ length: n }, (_, i) => `<i class="${j.status === 'done' || (j.status === 'in_progress' && i < ix) ? 'd' : j.status === 'in_progress' && i === ix ? 'c' : ''}"></i>`).join('')}</span>${esc(JL[j.status] || j.status)}${j.status === 'in_progress' && j.stage ? ' · ' + esc(j.stage) : ''}${j.assigned_to ? ' · ' + esc(j.assigned_to) : ''}</span></span>
            <span class="due ${j.status === 'done' ? 'faint' : rd.c}">${j.due_date ? esc(rd.t) : ''}</span><span class="chip ${j.status === 'done' ? 'c-ok' : j.status === 'in_progress' ? 'c-cobalt' : ''}">${esc(JL[j.status] || j.status)}</span></div>`; }).join('')}</section>` : ''}`;
    body.querySelectorAll('[data-mine]').forEach((b) => (b.onclick = () => { WS.mine = b.dataset.mine === '1'; tasks(body, p); }));
    body.querySelectorAll('[data-show]').forEach((b) => (b.onclick = () => { WS.show = b.dataset.show; tasks(body, p); }));
    body.querySelectorAll('[data-done]').forEach((cb) => (cb.onchange = async () => {
      const res = await M().ws('POST', `/api/tasks/${cb.dataset.done}/complete`, { completed: cb.checked });
      if (!res.success) err(res.error);
      render();
    }));
    document.getElementById('pw-task').onsubmit = async (e) => {
      e.preventDefault();
      const title = document.getElementById('pw-t-title').value.trim();
      if (!title) return;
      const res = await M().ws('POST', `/api/projects/${p.id}/tasks`, { title, due_date: document.getElementById('pw-t-due').value, assignee_id: document.getElementById('pw-t-who').value });
      if (!res.success) return err(res.error);
      render();
    };
  }

  /* ------------------------------------------------------------------ Files (with links) */
  async function files(body, p) {
    const epoch = WS.renderEpoch;
    const dataEpoch = ++WS.dataEpoch;
    const request = window.meridianStudioContext.beginProjectRequest();
    body.innerHTML = skel(4);
    const r = await M().ws('GET', `/api/projects/${p.id}/files`);
    if (!liveView(body, p, 'files', epoch, dataEpoch, request)) return;
    const list = (r && r.files) || [];
    const links = p.links || [];
    const shown = WS.section === 'All' ? list : list.filter((f) => f.section === WS.section);
    const target = WS.section === 'All' ? 'Files' : WS.section;
    body.innerHTML = `<section class="pnl m-steel" aria-label="Files"><div class="ph"><span class="glyph">▤</span><h3>Files</h3><span class="meta">${plural(list.length, 'file')} in the project folder</span>
        <div class="end"><button type="button" class="pw-btn sm" id="pw-up">Add files to ${esc(target)}</button></div></div>
      <div style="padding:0 16px 10px"><div class="pw-seg" role="group" aria-label="Section">${['All'].concat(SECTIONS).map((s) => `<button type="button" class="${WS.section === s ? 'on' : ''}" data-sec="${s}">${s}${s === 'All' ? '' : ' ' + list.filter((f) => f.section === s).length}</button>`).join('')}</div></div>
      ${r && !r.success ? `<div class="state err"><span class="sg">!</span><b>Files didn't load</b>${esc(r.error || '')}</div>` : shown.map((f) => { const [c, l] = ftype(f.name); return `<div class="r" style="grid-template-columns:28px minmax(0,1fr) auto auto"><span class="ft ${c}">${l}</span><span class="clip"><b>${esc(f.name)}</b><span class="sub">${esc(f.section)} · ${esc(f.size)} · ${esc(f.updated)}</span></span>
        <span></span><button type="button" class="pw-btn q sm" data-dl="${esc(f.name)}" data-dsec="${esc(f.section)}">Download</button></div>`; }).join('') || `<div class="state"><span class="sg">▤</span><b>No files in ${esc(WS.section === 'All' ? 'this project' : WS.section)} yet</b>Website files go in Website, logos and colors in Brand.</div>`}</section>
      <section class="pnl" aria-label="Links"><div class="ph"><span class="glyph">↗</span><h3>Websites and links</h3><span class="meta">sites, designs, docs</span></div>
        ${links.map((l) => `<div class="r" style="grid-template-columns:minmax(0,1fr) auto auto auto"><span class="clip"><b>${esc(l.label)}</b><span class="sub">${esc(KIND[l.kind] || 'Link')} · ${esc(host(l.url))}</span></span>
          ${/^(website|staging)$/.test(l.kind) ? `<button type="button" class="pw-btn q sm" data-preview="${esc(l.url)}">Preview</button>` : '<span></span>'}
          <button type="button" class="pw-btn q sm" data-browser="${esc(l.url)}">Open</button><button type="button" class="pw-x" data-unlink="${l.id}" aria-label="Remove link">×</button></div>`).join('') || '<div class="state" style="padding:12px"><b>No links yet</b>Add the project website or any link the team needs.</div>'}
        <form class="pw-form" id="pw-link" style="padding:12px 16px;border-top:1px solid var(--hair2)"><input class="pw-in grow" id="pw-link-url" placeholder="https://…" aria-label="Web address" required>
          <input class="pw-in" id="pw-link-label" placeholder="Name (optional)" aria-label="Link name" style="width:150px">
          <select class="pw-in" id="pw-link-kind" aria-label="Link type">${Object.entries(KIND).map(([k, v]) => `<option value="${k}" ${k === (links.some((l) => l.kind === 'website') ? 'link' : 'website') ? 'selected' : ''}>${v}</option>`).join('')}</select>
          <button class="pw-btn">Add link</button></form></section>`;
    body.querySelectorAll('[data-sec]').forEach((b) => (b.onclick = () => { WS.section = b.dataset.sec; files(body, p); }));
    document.getElementById('pw-up').onclick = async () => {
      err('');
      const res = await window.meridian.api.wsUpload(p.id, target);
      if (!res.success) return err(res.error);
      if (res.uploaded) files(body, p);
    };
    body.querySelectorAll('[data-dl]').forEach((b) => (b.onclick = async () => {
      const res = await window.meridian.api.wsDownload(p.id, b.dataset.dl, b.dataset.dsec);
      err(res.success ? '' : res.error);
    }));
    wireLinks(body, p);
  }

  // MARKET ANALYSIS (2026-10-11): the client's market report, produced on home base by Meridian (market_intel).
  // Read-only here; Jax runs it from the Projects page in Meridian. Dollar estimates are owner-only and not sent.
  async function market(body, p) {
    const epoch = WS.renderEpoch;
    const dataEpoch = ++WS.dataEpoch;
    const request = window.meridianStudioContext.beginProjectRequest();
    body.innerHTML = skel(4);
    const r = await M().ws('GET', `/api/projects/${p.id}/market`);
    if (!liveView(body, p, 'market', epoch, dataEpoch, request)) return;
    if (!r || !r.success) { body.innerHTML = `<div class="state err"><span class="sg">!</span><b>The market analysis could not be loaded</b>${esc((r && r.error) || '')}</div>`; return; }
    if (!r.report) { body.innerHTML = '<section class="pnl m-graphite"><div class="state off"><span class="sg">▥</span><b>No market analysis for this project yet</b>Jax runs it from Meridian. It shows search demand, local visibility and competitors for this client\'s area.</div></section>'; return; }
    if (!window.MarketRender) { body.innerHTML = '<div class="state err"><b>The report viewer is missing</b>Update Meridian Connect.</div>'; return; }
    window.MarketRender.render(body, r.report);
  }

  async function notes(body, p, editing) {
    const epoch = WS.renderEpoch;
    const dataEpoch = ++WS.dataEpoch;
    const request = window.meridianStudioContext.beginProjectRequest();
    const r = await M().ws('GET', `/api/projects/${p.id}/notes`);
    if (!liveView(body, p, 'notes', epoch, dataEpoch, request)) return;
    const list = (r && r.notes) || [];
    const ed = editing ? list.find((n) => n.id === editing) : null;
    body.innerHTML = `<section class="pnl m-ink" aria-label="Write a note"><div class="ph"><span class="glyph">✎</span><h3>${ed ? 'Edit note' : 'New note'}</h3><span class="meta">the whole project team can read notes</span></div>
        <form id="pw-note" style="display:grid;gap:8px;padding:0 16px 14px"><input class="pw-in" id="pw-n-title" placeholder="Note title" maxlength="150" value="${esc(ed ? ed.title : '')}" aria-label="Note title" required>
        <textarea class="pw-in" id="pw-n-body" rows="${ed ? 8 : 3}" placeholder="Write a note for the team" aria-label="Note">${esc(ed ? ed.content : '')}</textarea>
        <div class="pw-form"><button class="pw-btn">${ed ? 'Save note' : 'Add note'}</button>${ed ? '<button type="button" class="pw-btn q" id="pw-n-cancel">Cancel</button>' : ''}</div></form></section>
      <section class="pnl" aria-label="Notes"><div class="ph"><span class="glyph">▤</span><h3>Notes</h3><span class="meta">${plural(list.length, 'note')}</span></div>
        ${list.map((n) => `<div class="pw-row pw-note" style="align-items:flex-start;padding:10px 16px"><div class="pw-grow"><b>${esc(n.title)}</b><p>${esc(n.content)}</p><small>${esc(n.author)} · ${esc(n.date)}</small></div>
        <button type="button" class="pw-btn q sm" data-edit="${n.id}">Edit</button><button type="button" class="pw-x" data-del="${n.id}" aria-label="Delete note">×</button></div>`).join('') || '<div class="state"><b>No notes yet</b></div>'}</section>`;
    document.getElementById('pw-note').onsubmit = async (e) => {
      e.preventDefault();
      const b = { title: document.getElementById('pw-n-title').value.trim(), content: document.getElementById('pw-n-body').value };
      const res = await M().ws('POST', ed ? `/api/projects/${p.id}/notes/${ed.id}` : `/api/projects/${p.id}/notes`, b);
      if (!res.success) return err(res.error);
      notes(body, p);
    };
    const c = document.getElementById('pw-n-cancel');
    if (c) c.onclick = () => notes(body, p);
    body.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => notes(body, p, b.dataset.edit)));
    body.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
      if (!confirm('Delete this note?')) return;
      const res = await M().ws('POST', `/api/projects/${p.id}/notes/${b.dataset.del}/delete`, {});
      if (!res.success) return err(res.error);
      notes(body, p);
    }));
  }


  // ------------------------------------------------------------------ Toolkit: everything BV delivers, one click away
  const STATUS = { draft: ['Draft', ''], ready: ['With Jax', 'amber'], approved: ['Approved', 'teal'], delivered: ['Delivered', 'blue'] };
  function toolGroups(p) {
    const site = (p.links || []).find((l) => l.kind === 'website') || (p.links || []).find((l) => l.kind === 'staging');
    const domain = site ? host(site.url) : '';
    const q = encodeURIComponent(p.client || p.name);
    const own = (kind) => ((p.links || []).find((l) => l.kind === kind || (l.label || '').toLowerCase() === kind) || {}).url;
    return [
      { id: 'build', name: 'Build', note: 'Website and search', acc: 'blue', tools: [
        { t: 'Website', d: site ? 'Preview ' + domain : 'Add the site link in Files', ico: 'globe', go: site ? { url: site.url } : { tab: 'files' } },
        { t: 'Website files', d: 'Code, pages, media', ico: 'folder', go: { files: 'Website' } },
        { t: 'SEO plan', d: 'Meridian writes a prioritized plan', ico: 'spark', gen: 'seo_plan' },
        { t: 'Search Console', d: domain ? 'Rankings for ' + domain : 'Google search data', ico: 'search', go: { url: own('search console') || 'https://search.google.com/search-console' + (domain ? '?resource_id=sc-domain:' + domain : '') } } ] },
      { id: 'grow', name: 'Grow', note: 'Analytics, Google, trends', acc: 'teal', tools: [
        { t: 'Google Analytics', d: 'Traffic and conversions', ico: 'chart', go: { url: own('analytics') || 'https://analytics.google.com' } },
        { t: 'Google Business', d: 'Profile, posts, reviews', ico: 'pin', go: { url: own('google business') || 'https://business.google.com' } },
        { t: 'Semrush', d: domain ? 'Domain overview' : 'Keywords and competitors', ico: 'search', go: { url: 'https://www.semrush.com/analytics/overview/' + (domain ? '?q=' + encodeURIComponent(domain) : '') } },
        { t: 'Google Trends', d: 'Interest for ' + (p.client || p.name), ico: 'trend', go: { url: 'https://trends.google.com/trends/explore?geo=US&q=' + q } },
        { t: 'Meta insights', d: 'Facebook and Instagram', ico: 'chart', go: { url: own('meta') || 'https://business.facebook.com/latest/insights' } },
        { t: 'TikTok trends', d: 'Trending hashtags and sounds', ico: 'trend', go: { url: 'https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en' } },
        { t: 'Google posts', d: 'Meridian drafts 4 posts', ico: 'spark', gen: 'gbp_posts' },
        { t: 'Review replies', d: 'Reply templates', ico: 'spark', gen: 'review_replies' },
        { t: 'Analytics summary', d: 'Paste numbers, get the story', ico: 'spark', gen: 'analytics_summary' } ] },
      { id: 'present', name: 'Present', note: 'For Jax to share with the client', acc: 'amber', tools: [
        { t: 'Pitch deck', d: 'Slide-by-slide outline', ico: 'deck', gen: 'pitch_outline' },
        { t: 'Presentable', d: 'One-page results summary', ico: 'deck', gen: 'presentable' },
        { t: 'Client update', d: 'Drafted for Jax to send', ico: 'mail', gen: 'client_update' } ] },
      { id: 'create', name: 'Create', note: 'Marketing and media', acc: 'violet', tools: [
        { t: 'Marketing copy', d: 'Ads, email, video hooks', ico: 'spark', gen: 'marketing_copy' },
        { t: 'Social posts', d: 'A week of posts', ico: 'spark', gen: 'social_posts' },
        { t: 'Higgsfield', d: 'AI video and images', ico: 'film', go: { url: 'https://higgsfield.ai' } },
        { t: 'ChatGPT', d: 'Open ChatGPT', ico: 'chat', go: { url: 'https://chatgpt.com' } },
        { t: 'Storyboard', d: 'Shots, camera moves, Meridian frames', ico: 'image', go: { tab: 'storyboards' } } ] },
    ];
  }
  const ICO = {
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    spark: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    deck: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/>',
  };
  const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICO[k] || ICO.spark}</svg>`;

  function toolkit(body, p) {
    const groups = toolGroups(p);
    body.innerHTML = groups.map((g) => `<section class="tk-group acc-${g.acc}"><div class="tk-gh"><b>${g.name}</b><span>${g.note}</span></div>
      <div class="tk-tiles">${g.tools.map((t, i) => `<button type="button" class="tk-tile ${t.soon ? 'soon' : ''}" data-g="${g.id}" data-i="${i}" ${t.soon ? 'disabled' : ''}>
        <span class="tk-ico">${svg(t.ico)}</span><span class="tk-txt"><b>${esc(t.t)}</b><small>${esc(t.d)}</small></span>
        <span class="tk-kind">${t.gen ? 'Meridian' : t.soon ? 'Next' : t.go && t.go.url ? 'Opens' : ''}</span></button>`).join('')}</div></section>`).join('')
      + '<section class="pw-card" id="tk-gen" hidden></section>';
    body.querySelectorAll('.tk-tile').forEach((b) => (b.onclick = () => {
      const t = groups.find((g) => g.id === b.dataset.g).tools[+b.dataset.i];
      if (t.gen) return genPanel(body, p, t);
      if (t.go.url) return window.meridian.api.wsPreview(t.go.url, t.t + ' · ' + p.name);
      if (t.go.files) { WS.tab = 'files'; WS.section = t.go.files; return render(); }
      if (t.go.tab) { WS.tab = t.go.tab; return render(); }
    }));
  }

  function genPanel(body, p, t) {
    const box = document.getElementById('tk-gen');
    box.hidden = false;
    box.innerHTML = `<h3>${esc(t.t)} <small>Meridian drafts it from this project's brief, tasks, notes and links</small></h3>
      <form class="pw-form" id="tk-form" style="flex-direction:column;align-items:stretch">
        <textarea class="pw-in" id="tk-extra" rows="3" placeholder="${t.gen === 'analytics_summary' ? 'Paste the numbers (visits, calls, rankings, followers...) and the date range' : 'Anything specific? Tone, offer, dates, what to focus on (optional)'}"></textarea>
        <div class="pw-form"><button class="pw-btn" id="tk-go">Write it</button><span class="pw-empty" id="tk-status" style="padding:6px 0"></span></div></form>
      <div id="tk-out"></div>`;
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('tk-form').onsubmit = async (e) => {
      e.preventDefault();
      const go = document.getElementById('tk-go'), st = document.getElementById('tk-status');
      go.disabled = true; st.textContent = 'Meridian is writing…';
      const r = await M().ws('POST', `/api/projects/${p.id}/generate`, { kind: t.gen, instructions: document.getElementById('tk-extra').value });
      go.disabled = false; st.textContent = '';
      if (!r.success) return err(r.error);
      const d = r.deliverable;
      document.getElementById('tk-out').innerHTML = `<div class="tk-result">${window.meridianFmt ? window.meridianFmt(d.body) : esc(d.body)}</div>
        <div class="pw-form" style="margin-top:10px"><button type="button" class="pw-btn" id="tk-send">Send to Jax for review</button>
        <button type="button" class="pw-btn q" id="tk-edit">Edit in Deliverables</button><span class="pw-empty">Saved as a draft.</span></div>`;
      document.getElementById('tk-send').onclick = async () => {
        const s = await M().ws('POST', `/api/projects/${p.id}/deliverables/${d.id}`, { status: 'ready' });
        if (!s.success) return err(s.error);
        document.getElementById('tk-send').outerHTML = '<span class="tk-sent">Sent to Jax</span>';
      };
      document.getElementById('tk-edit').onclick = () => { WS.tab = 'deliverables'; WS.openDel = d.id; render(); };
    };
  }

  async function deliverables(body, p) {
    const epoch = WS.renderEpoch;
    const dataEpoch = ++WS.dataEpoch;
    const request = window.meridianStudioContext.beginProjectRequest();
    const r = await M().ws('GET', `/api/projects/${p.id}/deliverables`);
    if (!liveView(body, p, 'deliverables', epoch, dataEpoch, request)) return;
    const list = (r && r.deliverables) || [];
    const ed = WS.openDel ? list.find((d) => d.id === WS.openDel) : null;
    WS.openDel = null;
    if (ed) {
      const locked = ed.status === 'approved' || ed.status === 'delivered';
      body.innerHTML = `<section class="pw-card"><h3>${esc(ed.kind_label)} <small><span class="tk-st ${STATUS[ed.status][1]}">${STATUS[ed.status][0]}</span></small></h3>
        ${ed.jax_note ? `<div class="tk-note">Jax: ${esc(ed.jax_note)}</div>` : ''}
        <form id="dl-form" style="display:grid;gap:8px"><input class="pw-in" id="dl-title" value="${esc(ed.title)}" ${locked ? 'disabled' : ''} aria-label="Title">
          <textarea class="pw-in" id="dl-body" rows="16" ${locked ? 'disabled' : ''} aria-label="Content">${esc(ed.body)}</textarea>
          <div class="pw-form">${locked ? '<span class="pw-empty">Approved by Jax. Ask Jax for changes.</span>' : `<button class="pw-btn">Save</button>${ed.status === 'draft' ? '<button type="button" class="pw-btn" id="dl-ready">Send to Jax for review</button>' : '<button type="button" class="pw-btn q" id="dl-back">Pull back to draft</button>'}<button type="button" class="pw-btn q" id="dl-del">Delete</button>`}
            <button type="button" class="pw-btn q" id="dl-close">Back to list</button></div></form></section>`;
      const save = async (status) => { const s = await M().ws('POST', `/api/projects/${p.id}/deliverables/${ed.id}`, { title: document.getElementById('dl-title').value, body: document.getElementById('dl-body').value, status: status || ed.status }); if (!s.success) return err(s.error); WS.openDel = status ? null : ed.id; render(); };
      document.getElementById('dl-close').onclick = () => render();
      if (!locked) {
        document.getElementById('dl-form').onsubmit = (e) => { e.preventDefault(); save(); };
        const rd = document.getElementById('dl-ready'); if (rd) rd.onclick = () => save('ready');
        const bk = document.getElementById('dl-back'); if (bk) bk.onclick = () => save('draft');
        document.getElementById('dl-del').onclick = async () => { if (!confirm('Delete this deliverable?')) return; const s = await M().ws('POST', `/api/projects/${p.id}/deliverables/${ed.id}/delete`, {}); if (!s.success) return err(s.error); render(); };
      }
      return;
    }
    body.innerHTML = `<section class="pw-card"><h3>Deliverables <small>drafts, work with Jax, and approved pieces</small></h3>
      ${list.map((d) => `<button type="button" class="tk-del" data-d="${d.id}"><span class="tk-st ${STATUS[d.status][1]}">${STATUS[d.status][0]}</span>
        <span class="pw-grow"><b>${esc(d.title)}</b><small>${esc(d.kind_label)} · ${esc(d.author)} · ${esc(d.updated)}${d.jax_note ? ' · Jax left a note' : ''}</small></span></button>`).join('')
        || '<div class="pw-empty">Nothing yet. Open the Toolkit and have Meridian draft a client update, pitch deck or SEO plan.</div>'}
      <div class="pw-form" style="margin-top:10px"><button type="button" class="pw-btn q" id="dl-new">Open the Toolkit</button></div></section>`;
    body.querySelectorAll('[data-d]').forEach((b) => (b.onclick = () => { WS.openDel = b.dataset.d; render(); }));
    document.getElementById('dl-new').onclick = () => { WS.tab = 'toolkit'; render(); };
  }

  function storyboards(body, p) {
    if (!window.meridianStoryboard) { body.innerHTML = '<div class="pw-empty">Storyboards are not available in this build.</div>'; return; }
    return window.meridianStoryboard.render(body, p, { err, rerender: render });
  }

  function ai(body, p) {
    body.innerHTML = `<section class="pw-card m-ink"><h3>Ask Meridian about ${esc(p.name)} <small>uses this project's brief, tasks, notes, files and links</small></h3>
      <form class="pw-form" id="pw-ask"><textarea class="pw-in grow" id="pw-ask-q" rows="2" placeholder="e.g. What's left before launch?" aria-label="Question"></textarea><button class="pw-btn" id="pw-ask-go">Ask</button></form>
      <div class="pw-seg" style="margin-top:10px">${['What is left before this is done?', 'Summarize this project for a new teammate', 'Draft a client update'].map((q) => `<button type="button" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div></section>
      <section class="pw-card" id="pw-ask-out" hidden></section>`;
    const q = document.getElementById('pw-ask-q'), out = document.getElementById('pw-ask-out');
    const go = async () => { const v = q.value.trim(); if (!v || !window.meridianAsk) return; await window.meridianAsk(p.id, v, out, document.getElementById('pw-ask-go')); q.value = ''; };
    document.getElementById('pw-ask').onsubmit = (e) => { e.preventDefault(); go(); };
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } });
    body.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => { q.value = b.dataset.q; go(); }));
  }

  // eslint-disable-next-line no-global-assign
  selectProject = open;
  async function openTab(pid, tab, boardId) {   // used by "take me to…" navigation
    WS.clicked = true;
    if (!window.meridianStudioContext.selectProject(pid)) return;
    if (WS.pid !== pid && !(await open(pid))) return;
    if (boardId && window.meridianStoryboard && window.meridianStoryboard.preselect) window.meridianStoryboard.preselect(pid, boardId);
    else if (tab === 'storyboards' && window.meridianStoryboard) window.meridianStoryboard.reset();   // the list, not the last board
    if (tab && TABS.some(([k]) => k === tab)) { WS.tab = tab; await render(); }
  }
  function clear() {
    WS.renderEpoch += 1;
    WS.dataEpoch += 1;
    WS.pid = null;
    WS.tab = 'overview';
    WS.clicked = false;
    if (window.meridianStoryboard) window.meridianStoryboard.reset();
    const root = document.getElementById('pw-host');
    if (root) {
      root.replaceChildren();
      const split = root.closest('.projects-split');
      if (split) split.classList.remove('pw-full');
    }
  }
  window.meridianStudioContext.subscribe((state) => {
    if (WS.pid && state.project?.id !== WS.pid) clear();
  });
  window.meridianWorkspace = { open, openTab, refresh: render, clear, tabs: () => TABS.slice(), current: () => WS.pid };
})();
