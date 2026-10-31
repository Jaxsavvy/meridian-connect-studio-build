'use strict';
// TIME 2026-10-31 (Jax): time tracking and the 15-minute sign-out, Connect's side (src/activity-watch.js,
// src/renderer/activity.js). Fake clock, fake idle time, fake Team Hub, fake page. Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createActivityWatch, cleanPlace, TICK_MS, WATCH_MS } = require('../../src/activity-watch.js');
const activity = require('../../src/renderer/activity.js');
const src = file => fs.readFileSync(path.join(__dirname, '../../src', file), 'utf8');
const flush = () => new Promise(r => setImmediate(r));

function rig({ answer = { success: true, signOutOnIdle: false } } = {}) {
  const r = { idle: 0, focus: true, sent: [], events: [], timers: new Map(), answer };
  let n = 0;
  r.watch = createActivityWatch({
    idleSeconds: () => r.idle, focused: () => r.focus,
    send: async body => { r.sent.push(body); return typeof r.answer === 'function' ? r.answer(body) : r.answer; },
    onWarn: s => r.events.push(['warn', s]), onClear: () => r.events.push(['clear']), onSignOut: async why => r.events.push(['signout', why]),
    setTimer: (fn, ms) => { r.timers.set(++n, { fn, ms }); return n; }, clearTimer: id => r.timers.delete(id),
  });
  r.every = ms => [...r.timers.values()].filter(t => t.ms === ms).map(t => t.fn);
  r.minute = async () => { for (const fn of r.every(TICK_MS)) fn(); await flush(); };
  r.check = () => { for (const fn of r.every(WATCH_MS)) fn(); };
  return r;
}

test('each minute: active means input anywhere in the last minute; outside Connect when it lost the focus', async () => {
  const r = rig();
  r.watch.setPlace({ area: 'studio', projectId: 'p'.repeat(32), jobId: 'job-1', stageId: 'storyboard', tool: 'storyboard' });
  r.watch.start(); await flush();
  assert.deepEqual(r.sent[0], { active: true, inConnect: true, area: 'studio', projectId: 'p'.repeat(32), jobId: 'job-1', stageId: 'storyboard', tool: 'storyboard' });
  r.idle = 30; r.focus = false; await r.minute();
  assert.deepEqual([r.sent[1].active, r.sent[1].inConnect], [true, false], 'working in another app still counts');
  r.idle = 90; await r.minute();
  assert.equal(r.sent[2].active, false);
  assert.deepEqual(r.events, [], 'rule off: no warnings, no sign-out');
});

test('nothing but checked ids and a short label leave the computer', () => {
  assert.deepEqual(cleanPlace({ area: 'studio', projectId: '../x', jobId: 'ok_1', title: 'Secret window', label: 'A\nB'.padEnd(300, 'c') }),
    { area: 'studio', jobId: 'ok_1', label: 'A B'.padEnd(120, 'c') });
  assert.deepEqual(cleanPlace({ area: 'Studio <b>' }), { area: 'other' });
  assert.deepEqual(cleanPlace(null), { area: 'other' });
});

test('rule on: "Still there?" at 14 quiet minutes, cleared by any input, signed out at 15', async () => {
  const r = rig({ answer: { success: true, signOutOnIdle: true } });
  r.watch.start(); await flush();
  assert.equal(r.watch.enforcing, true, 'Team Hub turns the rule on');
  r.idle = 13 * 60 + 50; r.check();
  assert.deepEqual(r.events, []);
  r.idle = 14 * 60; r.check(); r.check();
  assert.deepEqual(r.events, [['warn', 60]], 'warned once');
  r.idle = 3; r.check();
  assert.deepEqual(r.events.at(-1), ['clear'], 'moving the mouse anywhere clears it');
  r.idle = 14 * 60 + 30; r.check();
  r.idle = 15 * 60; r.check(); await flush();
  assert.deepEqual(r.events.slice(-1), [['signout', 'idle']]);
  assert.equal(r.watch.running, false);
  assert.equal(r.timers.size, 0, 'timers stopped');
  r.check(); await r.minute();
  assert.equal(r.events.filter(e => e[0] === 'signout').length, 1, 'signed out once');
});

test('rule off: the 8-hour sign-out stays as the backstop; a 401 from Team Hub signs out at once', async () => {
  const r = rig();
  r.watch.start(); await flush();
  r.idle = 15 * 60; r.check();
  assert.deepEqual(r.events, []);
  r.idle = 8 * 60 * 60; r.check(); await flush();
  assert.deepEqual(r.events, [['signout', 'idle']]);
  const s = rig({ answer: { success: false, status: 401, error: 'Signed out after 15 minutes without activity. Sign in again.' } });
  s.watch.start(); await flush();
  assert.deepEqual(s.events, [['signout', 'server']]);
});

test('offline keeps trying; quitting clocks out; sign-out stops it', async () => {
  const r = rig({ answer: () => null });
  r.watch.start(); await flush(); await r.minute();
  assert.equal(r.watch.running, true, 'no answer: keeps going');
  r.answer = { success: true, signOutOnIdle: false };
  await r.watch.closing();
  assert.deepEqual(r.sent.at(-1), { closing: true });
  assert.equal(r.watch.running, false);
  r.watch.start(); r.watch.stop();
  assert.equal(r.timers.size, 0);
});

function page() {
  const doc = { activeElement: null, body: null, createElement(tag) {
    const el = { tag, ownerDocument: doc, children: [], attrs: {}, events: {}, textContent: '', id: '', className: '',
      setAttribute(k, v) { this.attrs[k] = v; }, append(...items) { this.children.push(...items); }, appendChild(item) { this.children.push(item); },
      addEventListener(k, fn) { this.events[k] = fn; }, focus() { doc.activeElement = this; },
      remove() { doc.body.children = doc.body.children.filter(c => c !== this); }, click() { this.events.click && this.events.click(); } };
    return el; } };
  doc.body = doc.createElement('body');
  const handlers = {}, calls = [], timers = new Map();
  let n = 0;
  const on = name => cb => { handlers[name] = cb; return () => { delete handlers[name]; }; };
  const win = { document: doc, setInterval: (fn, ms) => { timers.set(++n, { fn, ms }); return n; }, clearInterval: id => timers.delete(id),
    meridian: { activityStart: () => calls.push(['start']), activityStop: () => calls.push(['stop']), activityHere: () => calls.push(['here']),
      activityPlace: p => calls.push(['place', p]), onActivityWarn: on('warn'), onActivityClear: on('clear'), onActivitySignedOut: on('out') } };
  return { win, doc, handlers, calls, timers };
}
page.text = el => (typeof el === 'string' ? el : (el.textContent || '') + el.children.map(page.text).join(''));

test('the page reports where the person is only when it changes, and starts and stops the watcher', () => {
  const p = page(), a = activity.create(p.win);
  let place = { area: 'projects', projectId: 'p'.repeat(32), jobId: '' };
  a.start({ getPlace: () => place, signedOut: () => {} });
  assert.deepEqual(p.calls.slice(-2), [['place', { area: 'projects', projectId: 'p'.repeat(32) }], ['start']]);
  const every15 = [...p.timers.values()].find(t => t.ms === 15000).fn;
  every15();
  assert.equal(p.calls.filter(c => c[0] === 'place').length, 1, 'unchanged: not sent again');
  place = { area: 'studio' }; every15();
  assert.deepEqual(p.calls.at(-1), ['place', { area: 'studio' }]);
  a.stop();
  assert.deepEqual(p.calls.at(-1), ['stop']);
  assert.equal(p.timers.size, 0);
  assert.deepEqual(Object.keys(p.handlers), [], 'listeners removed');
});

test('"Still there?" shows a countdown with the button focused; "I\'m here" and a clear both close it', () => {
  const p = page(), a = activity.create(p.win);
  a.start({ getPlace: () => ({ area: 'overview' }), signedOut: () => {} });
  p.handlers.warn(60);
  const box = p.doc.body.children[0];
  assert.equal(box.attrs.role, 'alertdialog');
  assert.match(page.text(box), /Still there\?No activity for 14 minutes\. You'll be signed out in 60 seconds\./);
  assert.equal(p.doc.activeElement.textContent, 'I\'m here');
  [...p.timers.values()].find(t => t.ms === 1000).fn();
  assert.match(page.text(box), /59 seconds/);
  p.doc.activeElement.click();
  assert.equal(p.doc.body.children.length, 0);
  assert.deepEqual(p.calls.at(-1), ['here']);
  p.handlers.warn(30); p.handlers.clear();
  assert.equal(p.doc.body.children.length, 0, 'input anywhere clears it');
});

test('signed out by the rule: the shell gets the reason and everything stops', () => {
  const p = page(), a = activity.create(p.win), got = [];
  a.start({ getPlace: () => ({ area: 'tasks' }), signedOut: message => got.push(message) });
  p.handlers.warn(10);
  p.handlers.out();
  assert.deepEqual(got, ['Signed out after 15 minutes without activity. Sign in again.']);
  assert.equal(p.doc.body.children.length, 0);
  assert.equal(p.timers.size, 0);
});

test('Studio: a client Space is the project, a sandbox is not; the Job, stage and tool come along', () => {
  const studio = params => ({ current: () => ({ name: 'work', params }) });
  assert.deepEqual(activity.studioPlace(studio({ spaceId: 'p'.repeat(32), jobId: 'job-9', stageId: 'look', toolId: 'look-frames' })),
    { projectId: 'p'.repeat(32), jobId: 'job-9', stageId: 'look', tool: 'look-frames' });
  assert.deepEqual(activity.studioPlace(studio({ spaceId: 'sandbox-team' })), { projectId: '', jobId: '', stageId: '', tool: 'work' });
  assert.deepEqual(activity.studioPlace(null), { projectId: '', jobId: '', stageId: '', tool: '' });
});

test('wired into Connect: main uses powerMonitor and clocks out on quit; the old 8-hour page timer is gone', () => {
  const main = src('main.js'), app = src('renderer/app.js'), html = src('renderer/index.html'), preload = src('preload.js');
  assert.match(main, /idleSeconds: \(\) => powerMonitor\.getSystemIdleTime\(\)/);
  assert.match(main, /app\.on\('before-quit'[^]*activityWatch\.closing\(\)/);
  assert.match(main, /ipcMain\.handle\('activity:start', \(\) => \{ const u = authManager\.getCurrentUser\(\); if \(u && !u\.sample\)/);
  assert.doesNotMatch(main, /idleTimeoutHours/);
  assert.doesNotMatch(app, /setupIdleWatcher|idleTimeoutHours/);
  assert.match(app, /window\.MeridianActivity\.start\(\{ getPlace: activityPlace, signedOut: showSignedOut \}\)/);
  assert.match(app, /if \(window\.MeridianActivity\) window\.MeridianActivity\.stop\(\);/);
  assert.ok(html.indexOf('activity.js') > 0 && html.indexOf('activity.js') < html.indexOf('src="app.js"'));
  for (const name of ['activityStart', 'activityStop', 'activityHere', 'activityPlace', 'onActivityWarn', 'onActivityClear', 'onActivitySignedOut']) {
    assert.match(preload, new RegExp(name + ':'));
  }
});
