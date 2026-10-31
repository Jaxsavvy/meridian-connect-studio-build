'use strict';
// TIME 2026-10-31 (Jax): the owner's Time page (src/renderer/time-page.js) on a synthetic Team Hub report for the week
// of Mon Oct 26 2026, "now" Friday 3:35 pm (local time). People are made up.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const page = require('../../src/renderer/time-page.js');
const src = file => fs.readFileSync(path.join(__dirname, '../../src', file), 'utf8');
const flush = async () => { for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r)); };

const at = (day, h, m = 0) => Math.floor(new Date(2026, 9, 26 + day, h, m).getTime() / 1000);
const WEEK = new Date(2026, 9, 26).getTime(), NOW = at(4, 15, 35) * 1000;
const H = 3600000;
const AVERY = 'u-avery-0001', JORDAN = 'u-jordan-001', JAX = 'u-owner-0001';
function report() {
  const s = (userId, a, b, endReason, lastActive) => ({ id: `${userId}-${a}`, userId, started: a, ended: b, lastActive: lastActive || b, endReason });
  const b = (userId, a, z, area, extra = {}) => Object.assign({ sessionId: 'x', userId, from: a, to: z, area, projectId: '', projectName: '', jobId: '', stageId: '', tool: '', label: '' }, extra);
  return {
    ok: true, now: NOW / 1000,
    people: [{ id: AVERY, name: 'Avery Brooks', role: 'employee' }, { id: JORDAN, name: 'Jordan Lee', role: 'employee' }, { id: JAX, name: 'Jax Test', role: 'owner' }],
    sessions: [s(AVERY, at(0, 9), at(0, 12), 'signout'), s(AVERY, at(0, 13), at(0, 14), 'idle'), s(AVERY, at(4, 9), 0, '', at(4, 15, 30)),
      s(JORDAN, at(0, 10), at(0, 11), 'signout'), s(JORDAN, at(2, 22), at(3, 1), 'closed')],
    blocks: [b(AVERY, at(0, 9), at(0, 10), 'studio', { projectId: 'p1', projectName: 'Roof Co', stageId: 'storyboard' }),
      b(AVERY, at(0, 10), at(0, 12), 'projects', { projectId: 'p1', projectName: 'Roof Co' }), b(AVERY, at(0, 13), at(0, 14), 'outside'),
      b(AVERY, at(4, 9), NOW / 1000, 'studio', { projectId: 'p2', projectName: 'Build Co', stageId: 'build' }),
      b(JORDAN, at(0, 10), at(0, 11), 'messages'), b(JORDAN, at(2, 22), at(3, 1), 'outside')],
    live: [{ userId: AVERY, clockedIn: true, since: at(4, 9), lastActive: at(4, 15, 30), hereSince: at(4, 9),
      place: { area: 'studio', projectId: 'p2', projectName: 'Build Co', jobId: 'j', stageId: 'build', tool: 'website', label: '' } },
      { userId: JORDAN, clockedIn: false, lastActive: at(3, 1), endReason: 'closed' }, { userId: JAX, clockedIn: false, lastActive: 0, endReason: '' }]
  };
}

test('the week: days split at local midnight, open sessions run to now, idle sign-outs counted on the day they happened', () => {
  const m = page.model(report(), WEEK, NOW);
  const [avery, jordan, jax] = m.people;
  assert.deepEqual(avery.days.map(d => d.ms / H), [4, 0, 0, 0, 6 + 35 / 60, 0, 0]);
  assert.deepEqual([avery.days[0].first, avery.days[0].last, avery.days[0].idle], [at(0, 9) * 1000, at(0, 14) * 1000, 1]);
  assert.equal(avery.days[4].last, null, 'still in');
  assert.deepEqual(jordan.days.map(d => d.ms / H), [1, 0, 2, 1, 0, 0, 0], 'Wednesday 10 pm to Thursday 1 am splits at midnight');
  assert.equal(jax.ms, 0);
  assert.equal(m.total / H, 14 + 35 / 60);
  assert.equal(m.personDays, 5);
  assert.equal(m.idle, 1);
  assert.equal(Math.round(m.outsideShare * 100), 27);
});

test('what stands out: longest day, most time outside Connect, one card per person for missed days, never the owner', () => {
  const m = page.model(report(), WEEK, NOW);
  assert.deepEqual(m.flags.map(f => f.kind), ['long', 'outside', 'missed', 'missed']);
  assert.match(m.flags[0].text, /^Longest day: Avery on Friday, Oct 30, 6h 35m clocked, 9:00 am to now\.$/);
  assert.equal(m.flags[0].day, WEEK + 0 + new Date(2026, 9, 30).getTime() - WEEK);
  assert.equal(m.flags[1].text, '75% of Jordan\'s week was in other apps, the most on the team.');
  assert.equal(m.flags[2].text, 'Avery didn\'t clock in on Tue, Wed or Thu.');
  assert.equal(m.flags[3].text, 'Jordan didn\'t clock in on Tue.');
});

test('where time went: by area per person, by client (busiest first), inside Studio by stage name', () => {
  const m = page.model(report(), WEEK, NOW);
  assert.deepEqual(Object.fromEntries(Object.entries(m.people[0].areas).map(([k, v]) => [k, Math.round(v / 60000)])), { studio: 455, projects: 120, outside: 60 });
  assert.deepEqual(m.clients.map(([k, v]) => [k, Math.round(v / 60000)]), [['Build Co', 395], ['Roof Co', 180], ['No client', 60]]);
  assert.deepEqual(m.stages.map(([k, v]) => [k, Math.round(v / 60000)]), [['Build', 395], ['Storyboard', 60]]);
});

test('CSV: one row per person and day worked, exact minutes, quoted names', () => {
  const r = report();
  r.people[0].name = 'Avery "AB", Brooks';
  const lines = page.csv(page.model(r, WEEK, NOW)).trim().split('\n');
  assert.equal(lines[0], 'Person,Date,First in,Last out,Clocked (h:mm),Idle sign-outs');
  assert.deepEqual(lines.slice(1), ['"Avery ""AB"", Brooks",2026-10-26,9:00 am,2:00 pm,4:00,1', '"Avery ""AB"", Brooks",2026-10-30,9:00 am,still in,6:35,0',
    'Jordan Lee,2026-10-26,10:00 am,11:00 am,1:00,0', 'Jordan Lee,2026-10-28,10:00 pm,12:00 am,2:00,0', 'Jordan Lee,2026-10-29,12:00 am,1:00 am,1:00,0']);
});

function dom() {
  const doc = { activeElement: null, createElement(tag) {
    const el = { tag, ownerDocument: doc, children: [], attrs: {}, events: {}, style: {}, textContent: '', className: '', disabled: false, parent: null,
      setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] === undefined ? null : this.attrs[k]; },
      append(...items) { for (const i of items) { if (typeof i === 'object') i.parent = this; this.children.push(i); } }, appendChild(i) { this.append(i); return i; },
      replaceChildren(...items) { this.children = []; this.append(...items); }, insertBefore(i, ref) { i.parent = this; this.children.splice(this.children.indexOf(ref), 0, i); },
      addEventListener(k, fn) { this.events[k] = fn; }, removeEventListener(k, fn) { if (this.events[k] === fn) delete this.events[k]; },
      remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }, focus() { doc.activeElement = this; },
      click() { if (!this.disabled && this.events.click) this.events.click(); } };
    return el; } };
  doc.defaultView = { setInterval: () => 1, clearInterval() {}, setTimeout() {}, URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} }, Blob: function () {} };
  return doc.createElement('main');
}
const walk = el => [el, ...el.children.filter(c => typeof c === 'object').flatMap(walk)];
const text = el => (typeof el === 'string' ? el : (el.textContent || '') + el.children.map(text).join(''));
const btn = (el, label) => walk(el).find(n => n.tag === 'button' && (n.attrs['aria-label'] === label || text(n) === label));

test('the page: live cards, the timesheet, a day opened from a cell, and where time went', async () => {
  const el = dom(), asked = [];
  const close = page.mount(el, { load: async (from, to) => { asked.push([from, to]); return report(); }, now: () => NOW });
  await flush();
  assert.deepEqual(asked, [['2026-10-26', '2026-11-01']]);
  const all = text(el);
  assert.match(all, /LIVE · 3:35 PM1 of 3 clocked in/);
  assert.match(all, /Avery BrooksIn since 9:00 amIn/);
  assert.match(all, /Studio › Build Co › BuildHere for 6h 35m/);
  assert.match(all, /Jordan LeeLast active Thursday, Oct 29OutNo time today/);
  assert.equal(btn(el, 'Open Jordan\'s day'), undefined, 'nothing to open today');
  assert.ok(btn(el, 'Open Avery\'s day'));
  assert.match(all, /Clocked this week14h 35m5 person-days/);
  assert.match(all, /Idle sign-outs1Avery 1/);
  const cell = btn(el, 'Avery, Monday, Oct 26: 4h 00m, 1 idle sign-out. Open the day.');
  assert.ok(cell, 'Monday is a button');
  cell.click();
  const day = text(el);
  assert.match(day, /Timesheet›Avery Brooks›Monday, Oct 26/);
  assert.match(day, /Clocked4h 00mSessions2First in9:00 amLast out2:00 pmIdle sign-outs1/);
  assert.match(day, /9:00 am12:00 pm3h 00mSigned out1:00 pm2:00 pm1h 00m15 idle minutes/);
  assert.equal(btn(el, 'Previous day').disabled, true, 'Monday is the first day of the week');
  btn(el, 'Next day').click();
  assert.match(text(el), /Avery didn't clock in on Tuesday, Oct 27\./);
  btn(el, 'Timesheet').click();
  btn(el, 'Where time went').click();
  assert.match(text(el), /01 · BY AREAWhere each person's week went/);
  assert.match(text(el), /Build Co6h 35mRoof Co3h 00mNo client1h 00m/);
  close();
  assert.equal(el.children.length, 0, 'unmounted');
});

test('the page says so when Team Hub refuses or is unreachable, and offers to try again', async () => {
  const el = dom();
  let answer = { success: false, status: 403, error: 'Only Jax can see the Time page.' };
  page.mount(el, { load: async () => answer, now: () => NOW });
  await flush();
  assert.match(text(el), /Unable to load the Time page\./);
  answer = report();
  btn(el, 'Try again').click(); await flush();
  assert.match(text(el), /1 of 3 clocked in/);
});

test('wired into Connect for the owner only', () => {
  const app = src('renderer/app.js'), html = src('renderer/index.html');
  assert.match(html, /id="nav-time-link" data-view="time" style="display: none;"/);
  assert.match(html, /<section id="timeCenter" aria-label="Time" hidden><\/section>/);
  assert.match(app, /timeNav\.style\.display = meRes\.data\.is_owner \? '' : 'none'/);
  assert.match(app, /viewKey === 'time' && currentMe && currentMe\.is_owner && !closeTime && window\.MeridianTimePage/);
  assert.match(src('api.js'), /apiRequest\(`\/api\/time\?from=\$\{from\}&to=\$\{to\}`/);
  assert.match(src('preload.js'), /time: \(from, to\) => ipcRenderer\.invoke\('api:time', \{ from, to \}\)/);
});
