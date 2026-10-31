'use strict';
/**
 * TIME 2026-10-31 (Jax): Connect's side of time tracking, in the main process.
 * Once a minute it tells Team Hub (POST /connect/api/activity, time_tracking.py) three things:
 *   active    - mouse or keyboard input anywhere on the computer in the last minute (powerMonitor's idle time),
 *               so work in other apps keeps someone clocked in
 *   inConnect - a Connect window had the focus (if not, the minute counts as "Outside Connect")
 *   where     - the page, project and Studio Job/stage the renderer last reported (setPlace)
 * Team Hub keeps the clock-in and clock-out. When it says the 15-minute rule is on (signOutOnIdle), this warns at
 * 14 quiet minutes and signs out at 15; a 401 from Team Hub signs out too. With the rule off it only reports, and the
 * old 8-hour sign-out stays as the backstop. Nothing else leaves the computer: no screenshots, keystrokes, window
 * titles or the names of other apps.
 * Electron-free so it can be tested: main.js hands in the idle time, the focus check, the request and the UI hooks.
 */
const TICK_MS = 60 * 1000;
const WATCH_MS = 5 * 1000;
const WARN_AT = 14 * 60;
const SIGN_OUT_AT = 15 * 60;
const BACKSTOP_AT = 8 * 60 * 60;   // the rule is off: the old idleTimeoutHours default, now counted computer-wide
const ID = /^[A-Za-z0-9_-]{1,128}$/;

/** Only the fields Team Hub keeps, each one checked (Team Hub checks again; the renderer is never trusted). */
function cleanPlace(place) {
  const p = place && typeof place === 'object' ? place : {};
  const out = { area: typeof p.area === 'string' && /^[a-z-]{1,24}$/.test(p.area) ? p.area : 'other' };
  for (const key of ['projectId', 'jobId', 'stageId', 'tool']) if (typeof p[key] === 'string' && ID.test(p[key])) out[key] = p[key];
  if (typeof p.label === 'string' && p.label.trim()) out.label = p.label.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, 120);
  return out;
}

function createActivityWatch({ idleSeconds, focused, send, onWarn = () => {}, onClear = () => {}, onSignOut = async () => {},
  setTimer = setInterval, clearTimer = clearInterval }) {
  let place = { area: 'overview' }, enforce = false, warned = false, running = false, signingOut = false, timers = [];
  const idle = () => { const s = Number(idleSeconds()); return Number.isFinite(s) && s > 0 ? s : 0; };

  async function tick() {
    if (!running) return;
    const res = await Promise.resolve(send(Object.assign({ active: idle() < 60, inConnect: !!focused() }, place))).catch(() => null);
    if (!running || !res) return;   // offline: try again next minute; the time already kept stays kept
    if (res.status === 401) return signOut('server');   // Team Hub ended this sign-in after 15 quiet minutes
    if (res.success) enforce = res.signOutOnIdle === true;
  }

  function watch() {
    if (!running) return;
    const quiet = idle();
    if (quiet >= (enforce ? SIGN_OUT_AT : BACKSTOP_AT)) { signOut('idle'); return; }
    if (enforce && quiet >= WARN_AT && !warned) { warned = true; onWarn(Math.max(1, Math.round(SIGN_OUT_AT - quiet))); }
    else if (warned && quiet < WARN_AT) { warned = false; onClear(); }
  }

  async function signOut(why) {
    if (signingOut) return;
    signingOut = true;
    stop();
    await onSignOut(why);
  }

  function start() {
    if (running) return;
    running = true; signingOut = false; warned = false;
    timers = [setTimer(tick, TICK_MS), setTimer(watch, WATCH_MS)];
    tick();
  }

  function stop() {
    running = false;
    timers.forEach(t => clearTimer(t));
    timers = [];
    if (warned) { warned = false; onClear(); }
  }

  /** Connect is quitting: clock out at the last activity (best effort; Team Hub's sweep catches a missed one). */
  async function closing() {
    if (!running) return;
    stop();
    await Promise.resolve(send({ closing: true })).catch(() => null);
  }

  return { start, stop, closing, tick, watch, setPlace(p) { place = cleanPlace(p); },
    get running() { return running; }, get enforcing() { return enforce; } };
}

module.exports = { createActivityWatch, cleanPlace, TICK_MS, WATCH_MS, WARN_AT, SIGN_OUT_AT, BACKSTOP_AT };
