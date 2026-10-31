'use strict';
/**
 * TIME 2026-10-31 (Jax): the renderer half of time tracking (the main-process half is src/activity-watch.js).
 * - Tells the main process where the person is (page, project, Studio Job/stage/tool) when it changes, checked every
 *   15 seconds; the main process sends it to Team Hub with its once-a-minute check-in.
 * - Shows "Still there?" when the main process warns at 14 quiet minutes, and hands the sign-out at 15 back to the
 *   shell (which shows the sign-in page with the reason).
 * The shell calls MeridianActivity.start({ getPlace, signedOut }) after a real sign-in and stop() when it signs out.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianActivity = api.create(root);
})(typeof window === 'undefined' ? null : window, function () {
  const PLACE_MS = 15 * 1000;
  const SIGNED_OUT = 'Signed out after 15 minutes without activity. Sign in again.';

  /** Where Studio is: a client Space is a project (sandboxes aren't), plus the Job, stage and tool on screen. */
  function studioPlace(studio) {
    const current = studio && typeof studio.current === 'function' ? studio.current() : null;
    const p = (current && current.params) || {};
    const text = v => (typeof v === 'string' ? v : '');
    return { projectId: text(p.spaceId).startsWith('sandbox-') ? '' : text(p.spaceId), jobId: text(p.jobId),
      stageId: text(p.stageId), tool: text(p.toolId) || text(current && current.name) };
  }

  function create(win) {
    const doc = win.document;
    const bridge = () => win.meridian || {};
    let timer = null, ticker = null, last = '', offs = [], box = null, signedOut = null;

    function push(getPlace) {
      let place;
      try { place = getPlace() || {}; } catch (_) { place = {}; }
      const clean = {};
      for (const [k, v] of Object.entries(place)) if (typeof v === 'string' && v) clean[k] = v;
      const key = JSON.stringify(clean);
      if (key === last) return;
      last = key;
      if (typeof bridge().activityPlace === 'function') bridge().activityPlace(clean);
    }

    function warn(secondsLeft) {
      clear();
      let left = Math.max(1, Math.round(Number(secondsLeft) || 60));
      box = doc.createElement('div');
      box.className = 'activity-still';
      box.setAttribute('role', 'alertdialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-labelledby', 'activity-still-title');
      box.setAttribute('aria-describedby', 'activity-still-text');
      const card = doc.createElement('div'); card.className = 'activity-still-card';
      const title = doc.createElement('h2'); title.id = 'activity-still-title'; title.textContent = 'Still there?';
      const text = doc.createElement('p'); text.id = 'activity-still-text';
      const count = doc.createElement('strong');
      const say = () => { count.textContent = `${left} second${left === 1 ? '' : 's'}`; };
      say();
      text.append('No activity for 14 minutes. You\'ll be signed out in ', count, '.');
      const here = doc.createElement('button'); here.type = 'button'; here.className = 'activity-still-here'; here.textContent = 'I\'m here';
      here.addEventListener('click', () => { clear(); if (typeof bridge().activityHere === 'function') bridge().activityHere(); });
      card.append(title, text, here); box.appendChild(card);
      doc.body.appendChild(box);
      here.focus();
      ticker = win.setInterval(() => { left = Math.max(0, left - 1); say(); }, 1000);
    }

    function clear() {
      if (ticker) win.clearInterval(ticker);
      ticker = null;
      if (box) box.remove();
      box = null;
    }

    function start({ getPlace, signedOut: onSignedOut } = {}) {
      stop();
      signedOut = onSignedOut;
      const b = bridge();
      offs = [b.onActivityWarn && b.onActivityWarn(warn), b.onActivityClear && b.onActivityClear(clear),
        b.onActivitySignedOut && b.onActivitySignedOut(() => { const done = signedOut; stop(); if (done) done(SIGNED_OUT); })]
        .filter(off => typeof off === 'function');
      if (typeof getPlace === 'function') { push(getPlace); timer = win.setInterval(() => push(getPlace), PLACE_MS); }
      if (typeof b.activityStart === 'function') b.activityStart();
    }

    function stop() {
      if (timer) win.clearInterval(timer);
      timer = null; last = ''; signedOut = null;
      offs.forEach(off => off());
      offs = [];
      clear();
      if (typeof bridge().activityStop === 'function') bridge().activityStop();
    }

    return { start, stop, studioPlace, warn, clear };
  }

  return { create, studioPlace, SIGNED_OUT };
});
