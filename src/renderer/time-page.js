'use strict';
/**
 * TIME 2026-10-31 (Jax): the owner's Time page. Only Jax sees it; Team Hub refuses the data to anyone else
 * (GET /connect/api/time, time_tracking.py). Organised by how often each question comes up:
 *   Live (always on top)  who's in, where, for how long, hours today
 *   Timesheet             the week person by person: hours, first in / last out, idle sign-outs; then what stands out
 *   A day (drill-in)      each clock-in and how it ended, the day block by block, then what they did
 *   Where time went       each person's week by area, by client, and inside Studio by stage
 * Pay is per project, not hourly: this is for seeing how time is spent, so hours are exact, never rounded.
 * Usage: const close = MeridianTimePage.mount(el, { load: (from, to) => Promise<report>, now: () => Date.now() }).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianTimePage = api;
})(typeof window === 'undefined' ? null : window, function () {
  // Chart colours: validated for colour-blind separation on the dark cards, in this fixed order. Areas Connect may add
  // later fold into Other rather than getting a new colour.
  const AREAS = { studio: ['Studio', '#1A84F8'], tasks: ['My Tasks', '#1FA58C'], chat: ['AI chat', '#8670E8'],
    messages: ['Messages', '#C2772E'], projects: ['Projects', '#2E9FD6'], outside: ['Outside Connect', ''], other: ['Other', '#8C9BB4'] };
  const ORDER = ['studio', 'tasks', 'chat', 'messages', 'projects', 'outside', 'other'];
  const STAGES = { brief: 'Kickoff', concept: 'Concept', plan: 'Story and sitemap', words: 'Words', storyboard: 'Storyboard',
    look: 'Look and assets', motion: 'Motion test', lock: 'Design lock', build: 'Build', check: 'Check', review: 'Review',
    launch: 'Launch', research: 'Research', 'analytics-audit': 'Website audit', 'home-t1': 'Home page: Tier 1',
    'home-t2': 'Home page: Tier 2', 'home-t3': 'Home page: Tier 3', 'sample-t1': 'Sample site: Tier 1', 'sample-t2': 'Sample site: Tier 2',
    'sample-t3': 'Sample site: Tier 3', assemble: 'Assemble board', publish: 'Publish', print: 'Print card' };
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const GRADIENTS = ['linear-gradient(135deg,#1A84F8,#5CC8FF)', 'linear-gradient(135deg,#8670E8,#1A84F8)', 'linear-gradient(135deg,#1FA58C,#2E9FD6)',
    'linear-gradient(135deg,#F6A85B,#C2772E)', 'linear-gradient(135deg,#F4889C,#8670E8)'];
  const group = area => (AREAS[area] ? area : 'other');
  const fill = area => (group(area) === 'outside' ? 'repeating-linear-gradient(135deg,#5E6E87 0 4px,#46546B 4px 8px)' : AREAS[group(area)][1]);

  // ---- local days and formatting
  const pad = n => String(n).padStart(2, '0');
  const startOfDay = ms => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const addDays = (ms, n) => { const d = new Date(ms); d.setDate(d.getDate() + n); return d.getTime(); };
  const weekOf = ms => { const d = new Date(startOfDay(ms)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
  const iso = ms => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const clock = ms => { const d = new Date(ms), h = d.getHours(); return `${(h + 11) % 12 + 1}:${pad(d.getMinutes())} ${h < 12 ? 'am' : 'pm'}`; };
  const short = ms => clock(ms).replace(' am', 'a').replace(' pm', 'p');
  const dur = ms => { const m = Math.round(ms / 60000), h = Math.floor(m / 60); return h ? `${h}h ${pad(m % 60)}m` : `${m}m`; };
  const longDay = ms => new Date(ms).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const span = (a, b) => `${new Date(a).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(b).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  const placeName = p => [AREAS[group(p.area)] ? AREAS[group(p.area)][0] : 'Other', p.projectName, STAGES[p.stageId] || p.stageId, p.label]
    .filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(' › ');

  /** Everything the page shows for one week, from Team Hub's report. Pure: the tests drive it with synthetic reports. */
  function model(report, week, nowMs) {
    const now = nowMs || report.now * 1000;
    const days = DAYS.map((_, i) => addDays(week, i));
    const sessions = (report.sessions || []).map(s => ({ ...s, start: s.started * 1000, end: s.ended ? s.ended * 1000 : now, open: !s.ended }));
    const blocks = (report.blocks || []).map(b => ({ ...b, start: b.from * 1000, end: b.to * 1000 }));
    const clipped = (list, a, b) => list.map(x => ({ ...x, start: Math.max(x.start, a), end: Math.min(x.end, b) })).filter(x => x.end > x.start);
    const day = (uid, d) => {
      const end = addDays(d, 1), mine = clipped(sessions.filter(s => s.userId === uid), d, end);
      const idle = sessions.filter(s => s.userId === uid && s.endReason === 'idle' && s.end >= d && s.end < end).length;
      const last = mine.length ? mine[mine.length - 1] : null;
      return { start: d, ms: mine.reduce((n, s) => n + s.end - s.start, 0), sessions: mine, idle,
        first: mine.length ? mine[0].start : 0, last: last ? (last.open && last.end === now ? null : last.end) : 0,
        blocks: clipped(blocks.filter(b => b.userId === uid), d, end),
        did: (report.did || []).filter(e => e.userId === uid && e.at * 1000 >= d && e.at * 1000 < end).map(e => ({ ...e, atMs: e.at * 1000 })),
        messages: ((report.messageCounts || {})[uid] || {})[iso(d)] || 0 };
    };
    const people = (report.people || []).map((p, i) => {
      const week7 = days.map(d => day(p.id, d));
      const ms = week7.reduce((n, d) => n + d.ms, 0), worked = week7.filter(d => d.ms > 0).length;
      const areas = {};
      for (const d of week7) for (const b of d.blocks) areas[group(b.area)] = (areas[group(b.area)] || 0) + b.end - b.start;
      return { id: p.id, name: p.name, owner: p.role === 'owner', first: String(p.name || '').split(' ')[0], initials: String(p.name || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase(),
        grad: GRADIENTS[i % GRADIENTS.length], days: week7, ms, worked, idle: week7.reduce((n, d) => n + d.idle, 0), areas,
        live: (report.live || []).find(l => l.userId === p.id) || { clockedIn: false } };
    });
    const total = people.reduce((n, p) => n + p.ms, 0), personDays = people.reduce((n, p) => n + p.worked, 0);
    const blockMs = people.reduce((n, p) => n + Object.values(p.areas).reduce((a, b) => a + b, 0), 0);
    const outsideMs = people.reduce((n, p) => n + (p.areas.outside || 0), 0);
    const sum = key => { const out = {}; for (const p of people) for (const d of p.days) for (const b of d.blocks) { const k = key(b); if (k) out[k] = (out[k] || 0) + b.end - b.start; }
      return Object.entries(out).sort((a, b) => b[1] - a[1]); };
    const today = startOfDay(now), past = days.filter(d => d <= today && new Date(d).getDay() % 6 !== 0);
    const flags = [];
    for (const p of people) if (p.idle >= 3) flags.push({ kind: 'idle', person: p.id, day: p.days.reduce((a, d) => (d.idle > a.idle ? d : a), p.days[0]).start,
      text: `${p.first} was signed out for inactivity ${p.idle} times this week.` });
    const longest = people.flatMap(p => p.days.map(d => ({ p, d }))).sort((a, b) => b.d.ms - a.d.ms)[0];
    if (longest && longest.d.ms > 0) flags.push({ kind: 'long', person: longest.p.id, day: longest.d.start,
      text: `Longest day: ${longest.p.first} on ${longDay(longest.d.start)}, ${dur(longest.d.ms)} clocked${longest.d.first ? `, ${clock(longest.d.first)} to ${longest.d.last ? clock(longest.d.last) : 'now'}` : ''}.` });
    const share = p => { const all = Object.values(p.areas).reduce((a, b) => a + b, 0); return all ? (p.areas.outside || 0) / all : 0; };
    const most = people.filter(p => share(p) >= 0.2).sort((a, b) => share(b) - share(a))[0];
    if (most) flags.push({ kind: 'outside', text: `${Math.round(share(most) * 100)}% of ${most.first}'s week was in other apps, the most on the team.` });
    for (const p of people) {   // one card per person, not one per day
      const missed = p.owner || !p.worked ? [] : p.days.filter(d => past.includes(d.start) && d.start < today && !d.ms).map(d => DAYS[(new Date(d.start).getDay() + 6) % 7]);
      if (missed.length) flags.push({ kind: 'missed', text: `${p.first} didn't clock in on ${missed.length > 1 ? missed.slice(0, -1).join(', ') + ' or ' + missed[missed.length - 1] : missed[0]}.` });
    }
    return { week, days, now, today, people, total, personDays, flags,
      outsideShare: blockMs ? outsideMs / blockMs : 0, outsideMs, idle: people.reduce((n, p) => n + p.idle, 0),
      clients: sum(b => b.projectName || (b.area === 'outside' ? '' : 'No client')).filter(([k]) => k),
      stages: sum(b => (group(b.area) === 'studio' && b.stageId ? STAGES[b.stageId] || b.stageId : '')) };
  }

  function csv(m) {
    const rows = [['Person', 'Date', 'First in', 'Last out', 'Clocked (h:mm)', 'Idle sign-outs']];
    for (const p of m.people) for (const d of p.days) if (d.ms) {
      const mins = Math.round(d.ms / 60000);
      rows.push([p.name, iso(d.start), clock(d.first), d.last ? clock(d.last) : 'still in', `${Math.floor(mins / 60)}:${pad(mins % 60)}`, String(d.idle)]);
    }
    return rows.map(r => r.map(v => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(',')).join('\n') + '\n';
  }

  // ---- the page
  function mount(el, { load, now = () => Date.now(), refreshMs = 60000 } = {}) {
    const doc = el.ownerDocument, win = doc.defaultView;
    const root = doc.createElement('section'); root.className = 'tp'; root.setAttribute('aria-label', 'Time');
    el.replaceChildren(root);
    const state = { view: 'sheet', week: weekOf(now()), person: '', day: 0 };
    let report = null, error = '', closed = false, request = 0, timer = null, listeners = [];
    const node = (tag, text, cls) => { const n = doc.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; };
    const on = (n, type, fn) => { n.addEventListener(type, fn); listeners.push([n, type, fn]); return n; };
    const button = (text, fn, cls, label) => { const b = on(node('button', text, cls), 'click', fn); b.type = 'button'; if (label) b.setAttribute('aria-label', label); return b; };
    const set = patch => { Object.assign(state, patch); if ('week' in patch) refresh(); else draw(); };
    const swatch = area => { const s = node('span', '', 'tp-swatch'); s.style.background = fill(area); s.setAttribute('aria-hidden', 'true'); return s; };
    const avatar = p => { const a = node('span', p.initials, 'tp-avatar'); a.style.background = p.grad; a.setAttribute('aria-hidden', 'true'); return a; };
    const band = (num, label, title, text) => { const h = node('div', '', 'tp-band'); h.append(node('p', `${num} · ${label}`, 'tp-label'), node('h2', title, 'tp-title')); if (text) h.appendChild(node('p', text, 'tp-quiet')); return h; };
    function strip(blocks, d, now0, cls, label) {
      const box = node('div', '', cls); box.setAttribute('role', 'img'); box.setAttribute('aria-label', label);
      const from = addDays(d, 0) + 7 * 3600000, to = from + 12 * 3600000;   // 7 am to 7 pm
      for (const b of blocks) {
        const a = Math.max(b.start, from), z = Math.min(b.end, to); if (z <= a) continue;
        const seg = node('span', '', 'tp-seg'); seg.title = `${placeName(b)} · ${clock(b.start)}–${clock(b.end)} (${dur(b.end - b.start)})`;
        seg.style.left = `${((a - from) / (to - from) * 100).toFixed(2)}%`; seg.style.width = `calc(${((z - a) / (to - from) * 100).toFixed(2)}% - 2px)`; seg.style.background = fill(b.area);
        box.appendChild(seg);
      }
      if (now0 >= from && now0 <= to) { const n = node('span', '', 'tp-now'); n.style.left = `${((now0 - from) / (to - from) * 100).toFixed(2)}%`; box.appendChild(n); }
      return box;
    }
    const ticks = () => { const t = node('div', '', 'tp-ticks'); t.setAttribute('aria-hidden', 'true'); for (const x of ['7 am', '9', '11', '1 pm', '3', '5', '7 pm']) t.appendChild(node('span', x)); return t; };
    const legend = () => { const l = node('div', '', 'tp-legend'); for (const a of ORDER) { const i = node('span'); i.append(swatch(a), AREAS[a][0]); l.appendChild(i); } return l; };

    function live(m) {
      const s = node('section', '', 'tp-live'); s.setAttribute('aria-label', 'Live');
      const inNow = m.people.filter(p => p.live.clockedIn).length;
      const head = node('div', '', 'tp-live-head');
      head.append(node('p', `LIVE · ${clock(m.now).toUpperCase()}`, 'tp-label tp-live-label'), node('h2', `${inNow} of ${m.people.length} clocked in`, 'tp-title'));
      const cards = node('div', '', 'tp-cards');
      for (const p of m.people) {
        const c = node('article', '', 'tp-card'), l = p.live, top = node('div', '', 'tp-card-top'), who = node('div');
        who.append(node('p', p.name, 'tp-name'), node('p', l.clockedIn ? `In since ${clock(l.since * 1000)}` : (l.lastActive ? `Last active ${longDay(l.lastActive * 1000) === longDay(m.now) ? clock(l.lastActive * 1000) : longDay(l.lastActive * 1000)}${l.endReason === 'idle' ? ', signed out for inactivity' : ''}` : 'Not seen yet'), 'tp-quiet'));
        top.append(avatar(p), who, node('span', l.clockedIn ? 'In' : 'Out', l.clockedIn ? 'tp-chip tp-in' : (l.endReason === 'idle' ? 'tp-chip tp-idle' : 'tp-chip tp-out')));
        c.appendChild(top);
        if (l.clockedIn) {
          const where = node('p', '', 'tp-where'); where.append(swatch(l.place.area), placeName(l.place) || 'Connect');
          c.append(where, node('p', `Here for ${dur(m.now - l.hereSince * 1000)}`, 'tp-quiet'));
        }
        const today = m.days.indexOf(m.today);
        if (today >= 0) c.appendChild(strip(p.days[today].blocks, m.today, m.now, 'tp-strip tp-strip-sm', `${p.first} today`));
        const foot = node('div', '', 'tp-card-foot');
        const todayMs = today >= 0 ? p.days[today].ms : 0;
        foot.appendChild(node('p', todayMs ? `${dur(todayMs)} today` : (today >= 0 ? 'No time today' : ''), todayMs ? 'tp-strong' : 'tp-quiet'));
        if (todayMs) foot.appendChild(button('Open today', () => set({ view: 'day', person: p.id, day: today }), 'tp-link', `Open ${p.first}'s day`));
        c.appendChild(foot); cards.appendChild(c);
      }
      s.append(head, cards);
      return s;
    }

    function sheet(m) {
      const out = node('div', '', 'tp-stack');
      const tiles = node('div', '', 'tp-tiles');
      for (const [label, value, note, cls] of [['Clocked this week', dur(m.total), `${m.personDays} person-days`, 'tp-teal'],
        ['Average day', m.personDays ? dur(m.total / m.personDays) : '—', 'Per person, per day worked', 'tp-amber'],
        ['Idle sign-outs', String(m.idle), m.people.filter(p => p.idle).map(p => `${p.first} ${p.idle}`).join(' · ') || 'None this week', 'tp-rose'],
        ['Outside Connect', `${Math.round(m.outsideShare * 100)}%`, `${dur(m.outsideMs)} in other apps`, 'tp-cyan']]) {
        const t = node('div', '', `tp-tile ${cls}`); t.append(node('p', label, 'tp-quiet'), node('p', value, 'tp-tile-value'), node('p', note, 'tp-quiet')); tiles.appendChild(t);
      }
      const head = node('div', '', 'tp-band-row');
      head.append(band('01', 'TIMESHEET', 'The week, person by person', 'Clocked hours each day, with first in and last out. Pick a day to see it block by block.'),
        button('Export CSV', () => download(m), 'tp-primary'));
      const grid = node('div', '', 'tp-grid'), scroll = node('div', '', 'tp-scroll');
      const header = node('div', '', 'tp-row tp-row-head'); header.appendChild(node('span', 'Person'));
      m.days.forEach((d, i) => header.appendChild(node('span', `${DAYS[i]} ${new Date(d).getDate()}`, d === m.today ? 'tp-today' : '')));
      header.appendChild(node('span', 'Total', 'tp-right')); grid.appendChild(header);
      for (const p of m.people) {
        const row = node('div', '', 'tp-row'), name = node('span', '', 'tp-person'); name.append(avatar(p), p.first); row.appendChild(name);
        p.days.forEach((d, i) => {
          if (!d.ms) { row.appendChild(node('span', d.start > m.today ? '' : '—', 'tp-off')); return; }
          const b = button('', () => set({ view: 'day', person: p.id, day: i }), d.start === m.today ? 'tp-cell tp-cell-today' : 'tp-cell',
            `${p.first}, ${longDay(d.start)}: ${dur(d.ms)}${d.idle ? `, ${d.idle} idle sign-out${d.idle > 1 ? 's' : ''}` : ''}. Open the day.`);
          const hrs = node('span', dur(d.ms), 'tp-strong'); if (d.idle) { const dot = node('span', '', 'tp-dot'); dot.setAttribute('aria-hidden', 'true'); hrs.appendChild(dot); }
          b.append(hrs, node('span', `${short(d.first)} – ${d.last ? short(d.last) : 'now'}`, 'tp-quiet'));
          row.appendChild(b);
        });
        row.appendChild(node('span', dur(p.ms), 'tp-strong tp-right')); grid.appendChild(row);
      }
      const team = node('div', '', 'tp-row tp-row-team'); team.appendChild(node('span', 'Team', 'tp-strong'));
      m.days.forEach((d, i) => { const ms = m.people.reduce((n, p) => n + p.days[i].ms, 0); team.appendChild(node('span', ms ? dur(ms) : '—', ms ? 'tp-strong' : 'tp-off')); });
      team.appendChild(node('span', dur(m.total), 'tp-strong tp-right')); grid.appendChild(team);
      scroll.appendChild(grid);
      const note = node('p', '', 'tp-quiet tp-note'); const dot = node('span', '', 'tp-dot'); dot.setAttribute('aria-hidden', 'true');
      note.append(dot, ' Signed out for inactivity that day. Idle minutes are never counted.');
      const flags = node('div', '', 'tp-flags');
      if (!m.flags.length) flags.appendChild(node('p', 'Nothing stands out this week.', 'tp-quiet'));
      for (const f of m.flags) {
        const card = node('article', '', 'tp-flag'), tag = { idle: ['Idle sign-outs', 'tp-idle'], long: ['Longest day', 'tp-amber-chip'], outside: ['Outside Connect', 'tp-cyan-chip'], missed: ['No clock-in', 'tp-out'] }[f.kind];
        card.append(node('span', tag[0], `tp-chip ${tag[1]}`), node('p', f.text));
        if (f.person && f.day) card.appendChild(button(`Open ${DAYS[(new Date(f.day).getDay() + 6) % 7]}`, () => set({ view: 'day', person: f.person, day: m.days.indexOf(f.day) }), 'tp-link'));
        else if (f.kind === 'outside') card.appendChild(button('See where time went', () => set({ view: 'where' }), 'tp-link'));
        flags.appendChild(card);
      }
      out.append(tiles, head, scroll, note, band('02', 'NEEDS A LOOK', 'What stands out this week', 'Idle sign-outs, unusually long days, and time the page can\'t see.'), flags);
      return out;
    }

    function dayView(m) {
      const p = m.people.find(x => x.id === state.person) || m.people[0];
      const out = node('div', '', 'tp-stack');
      if (!p) { out.appendChild(node('p', 'Nobody to show yet.', 'tp-quiet')); return out; }
      const d = p.days[state.day] || p.days[0];
      const crumbs = node('nav', '', 'tp-crumbs'); crumbs.setAttribute('aria-label', 'Breadcrumb');
      crumbs.append(button('Timesheet', () => set({ view: 'sheet' }), 'tp-link'), node('span', '›', 'tp-sep'), node('span', p.name), node('span', '›', 'tp-sep'), node('span', longDay(d.start), 'tp-amber-text'));
      const nav = node('div', '', 'tp-daynav');
      const prev = button('‹', () => set({ day: state.day - 1 }), 'tp-icon', 'Previous day'); prev.disabled = state.day <= 0;
      const next = button('›', () => set({ day: state.day + 1 }), 'tp-icon', 'Next day'); next.disabled = state.day >= 6 || addDays(d.start, 1) > m.today;
      nav.append(prev, next);
      const top = node('div', '', 'tp-band-row'); top.append(crumbs, nav);
      const pills = node('div', '', 'tp-pills');
      for (const x of m.people) { const b = button('', () => set({ person: x.id }), x.id === p.id ? 'tp-pill tp-pill-on' : 'tp-pill'); b.setAttribute('aria-pressed', String(x.id === p.id)); b.append(avatar(x), x.first); pills.appendChild(b); }
      out.append(top, pills);
      if (!d.ms) { out.appendChild(node('p', `${p.first} didn't clock in on ${longDay(d.start)}.`, 'tp-empty')); return out; }
      const facts = node('div', '', 'tp-facts');
      for (const [label, value, cls] of [['Clocked', dur(d.ms)], ['Sessions', String(d.sessions.length)], ['First in', clock(d.first), 'tp-amber-text'],
        ['Last out', d.last ? clock(d.last) : 'Still in', d.last ? 'tp-amber-text' : 'tp-teal-text'], ['Idle sign-outs', String(d.idle), d.idle ? 'tp-rose-text' : '']]) {
        const f = node('div', '', 'tp-fact'); f.append(node('p', label, 'tp-quiet'), node('p', value, `tp-fact-value ${cls || ''}`)); facts.appendChild(f);
      }
      const table = node('div', '', 'tp-sessions');
      const ended = { idle: ['15 idle minutes', 'tp-idle'], signout: ['Signed out', 'tp-out'], closed: ['Closed Connect', 'tp-out'] };
      for (const s of d.sessions) {
        const r = node('div', '', 'tp-session'), [txt, cls] = s.open ? ['Still in', 'tp-in'] : (ended[s.endReason] || ['Ended', 'tp-out']);
        r.append(node('span', clock(s.start), 'tp-strong'), node('span', s.open ? 'Now' : clock(s.end), 'tp-strong'), node('span', dur(s.end - s.start)), node('span', txt, `tp-chip ${cls}`));
        table.appendChild(r);
      }
      const list = node('div', '', 'tp-blocks');
      for (const b of d.blocks) { const r = node('div', '', 'tp-block'), a = node('span', '', 'tp-block-area'); a.append(swatch(b.area), AREAS[group(b.area)][0]);
        r.append(node('span', `${clock(b.start)} – ${clock(b.end)}`, 'tp-quiet'), a, node('span', placeName(b).split(' › ').slice(1).join(' › ') || '—'), node('span', dur(b.end - b.start), 'tp-strong tp-right')); list.appendChild(r); }
      const count = kinds => d.did.filter(e => kinds.includes(e.kind)).reduce((n, e) => n + (e.count || 1), 0);
      const did = node('div', '', 'tp-facts');
      for (const [label, value] of [['Tasks finished', count(['task'])], ['Files added', count(['file'])], ['Notes and links', count(['note', 'link', 'deliverable'])],
        ['Sent to Jax', count(['sent'])], ['Images made', count(['studio'])], ['Messages sent', d.messages]]) {
        const f = node('div', '', 'tp-fact'); f.append(node('p', label, 'tp-quiet'), node('p', String(value), 'tp-fact-value')); did.appendChild(f);
      }
      const done = node('div', '', 'tp-panel');
      if (!d.did.length) done.appendChild(node('p', 'Nothing recorded for this day yet.', 'tp-quiet'));
      for (const e of d.did) { const r = node('div', '', 'tp-did'); r.append(node('span', clock(e.atMs), 'tp-amber-text'), node('span', e.text), node('span', e.projectName || '', 'tp-quiet')); done.appendChild(r); }
      const card = node('div', '', 'tp-panel');
      card.append(strip(d.blocks, d.start, m.now, 'tp-strip tp-strip-lg', `${p.first}, ${longDay(d.start)}: ` + d.blocks.map(b => `${AREAS[group(b.area)][0]} ${dur(b.end - b.start)}`).join(', ')), ticks(), legend(), list);
      out.append(facts, band('01', 'CLOCK IN AND OUT', 'Each session, and how it ended', 'Signing in clocks in. Signing out, 15 idle minutes, or closing Connect clocks out, at the last moment they were active.'), table,
        band('02', 'WHERE THEY WERE', 'The day, block by block', 'Page, client project, and in Studio the Job and stage. Time in other apps shows as Outside Connect, without the app\'s name.'), card,
        band('03', 'WHAT THEY DID', 'Work that moved', 'Tasks finished, files and notes added, work sent to you, and Studio images. Messages are counted, never read.'), did, done);
      return out;
    }

    function where(m) {
      const out = node('div', '', 'tp-stack');
      const areas = node('div', '', 'tp-panel');
      for (const p of m.people.concat([{ first: 'Team', areas: m.people.reduce((t, p) => { for (const [k, v] of Object.entries(p.areas)) t[k] = (t[k] || 0) + v; return t; }, {}), team: true }])) {
        const all = ORDER.reduce((n, a) => n + (p.areas[a] || 0), 0);
        const row = node('div', '', 'tp-bar-row'); row.appendChild(node('p', p.first, p.team ? 'tp-strong' : ''));
        const bar = node('div', '', 'tp-stack-bar'); bar.setAttribute('role', 'img');
        bar.setAttribute('aria-label', `${p.first}: ` + ORDER.filter(a => p.areas[a]).map(a => `${AREAS[a][0]} ${dur(p.areas[a])}`).join(', ') || 'no time');
        for (const a of ORDER) if (p.areas[a]) { const s = node('span', '', 'tp-part'); s.style.flex = `${p.areas[a]} 1 0`; s.style.background = fill(a); s.title = `${AREAS[a][0]} · ${dur(p.areas[a])} (${Math.round(p.areas[a] / all * 100)}%)`; bar.appendChild(s); }
        row.append(bar, node('p', all ? dur(all) : '—', 'tp-strong tp-right')); areas.appendChild(row);
      }
      areas.appendChild(legend());
      const bars = rows => { const panel = node('div', '', 'tp-panel'), max = rows.length ? rows[0][1] : 0;
        if (!rows.length) panel.appendChild(node('p', 'No time here this week.', 'tp-quiet'));
        for (const [name, ms] of rows) { const r = node('div', '', 'tp-bar-row'), track = node('div', '', 'tp-track'), fillEl = node('span', '', 'tp-fill');
          fillEl.style.width = `${(ms / max * 100).toFixed(1)}%`; if (name === 'No client') fillEl.style.background = '#5E6E87'; track.setAttribute('aria-hidden', 'true'); track.appendChild(fillEl);
          r.append(node('p', name), track, node('p', dur(ms), 'tp-strong tp-right')); panel.appendChild(r); }
        return panel; };
      out.append(band('01', 'BY AREA', 'Where each person\'s week went', 'Each bar is one person\'s time, split by where they spent it.'), areas,
        band('02', 'BY CLIENT', 'Which clients took the time', 'Hours inside each client\'s project and Studio Jobs. No client covers Messages, tasks without a project and the rest.'), bars(m.clients),
        band('03', 'INSIDE STUDIO', 'Which stages take longest', 'Studio time by Job stage, across every client.'), bars(m.stages));
      return out;
    }

    function download(m) {
      const url = win.URL.createObjectURL(new win.Blob([csv(m)], { type: 'text/csv' })), a = node('a');
      a.href = url; a.download = `time-${iso(m.week)}.csv`; root.appendChild(a); a.click(); a.remove();
      win.setTimeout(() => win.URL.revokeObjectURL(url), 1000);
    }

    function draw() {
      if (closed) return;
      for (const [n, type, fn] of listeners) n.removeEventListener(type, fn);
      listeners = [];
      const want = doc.activeElement && root.contains && root.contains(doc.activeElement) ? doc.activeElement.getAttribute('aria-label') || doc.activeElement.textContent : null;
      if (!report) { root.replaceChildren(node('p', error || 'Loading time…', error ? 'tp-error' : 'tp-quiet')); if (error) root.appendChild(button('Try again', refresh, 'tp-link')); return; }
      const m = model(report, state.week, now());
      const tabs = node('div', '', 'tp-tabs'); tabs.setAttribute('aria-label', 'View');
      for (const [id, label] of [['sheet', 'Timesheet'], ['where', 'Where time went']]) {
        const on = state.view === id || (id === 'sheet' && state.view === 'day');
        const b = button(label, () => set({ view: id }), on ? 'tp-tab tp-tab-on' : 'tp-tab'); b.setAttribute('aria-pressed', String(on)); tabs.appendChild(b);
      }
      const bar = node('div', '', 'tp-band-row tp-switch'); bar.appendChild(tabs);
      if (state.view !== 'day') {
        const period = node('div', '', 'tp-daynav'), next = button('›', () => set({ week: addDays(state.week, 7) }), 'tp-icon', 'Next week');
        next.disabled = addDays(state.week, 7) > now();
        period.append(button('‹', () => set({ week: addDays(state.week, -7) }), 'tp-icon', 'Previous week'), node('span', span(state.week, addDays(state.week, 6)), 'tp-amber-text'), next);
        bar.appendChild(period);
      }
      const body = state.view === 'day' ? dayView(m) : state.view === 'where' ? where(m) : sheet(m);
      const foot = node('p', 'Only you see this page. Not recorded: screenshots, keystrokes, message text, or the names of other apps.', 'tp-quiet tp-foot');
      root.replaceChildren(live(m), bar, body, foot);
      if (error) root.insertBefore(node('p', error, 'tp-error'), bar);
      const again = want && root.querySelectorAll && [...root.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent) === want);
      if (again && !again.disabled) again.focus();
    }

    async function refresh() {
      const mine = ++request;
      try {
        const res = await load(iso(state.week), iso(addDays(state.week, 6)));
        if (closed || mine !== request) return;
        if (!res || res.success === false || res.ok === false) throw new Error((res && res.error) || 'Unable to load time.');
        report = res; error = '';
      } catch (e) {
        if (closed || mine !== request) return;
        error = report ? 'Couldn\'t refresh. Showing the last numbers.' : 'Unable to load the Time page. Check that home base is running, then try again.';
      }
      draw();
    }

    refresh();
    timer = win.setInterval(refresh, refreshMs);
    return () => { closed = true; request++; win.clearInterval(timer); for (const [n, type, fn] of listeners) n.removeEventListener(type, fn); listeners = []; root.remove(); };
  }

  return { mount, model, csv, weekOf, iso };
});
