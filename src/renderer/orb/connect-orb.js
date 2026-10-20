// Connect's galaxy orb: one live orb that sits in the Meridian AI panel (and large on the Meridian AI page).
// The panel redraws its HTML often, so the orb lives in one element that connect-shell.js moves into the
// panel's .mx-orb-slot after each redraw (same task, so the orb never sees itself leave the page).
// States (orb/meridian-orb.js STATES): idle, thinking (waiting for Meridian), speaking (reply arriving or
// being read aloud), listening / hearing (voice call), unread.
(function () {
  'use strict';
  let state = 'idle';
  let provider = null;   // connect-shell.js: () => the state from Meridian's chat and voice
  let voice = 0;
  let wrap = null;
  let orb = null;

  function freshCanvas() {
    const c = document.createElement('canvas');
    c.className = 'orb-canvas';
    c.width = 256; c.height = 256;
    c.setAttribute('aria-hidden', 'true');
    return c;
  }

  function start() {
    if (orb || !window.MeridianOrb) return;
    orb = window.MeridianOrb.startOrb(wrap.querySelector('canvas'), () => (provider ? provider() : state), () => voice,
      { zoom: 0.89, fps: 30, calmFps: 15, backdrop: 'page', maxDpr: 2 });
  }

  // Put the orb into host's .mx-orb-slot (call after the host's HTML is redrawn).
  function place(host) {
    const slot = host && host.querySelector('.mx-orb-slot');
    if (!slot) return;
    if (!wrap) {
      wrap = document.createElement('span');
      wrap.className = 'mx-orb';
      wrap.setAttribute('aria-hidden', 'true');
      wrap.appendChild(freshCanvas());
    } else if (!wrap.isConnected && orb) {
      // It was off the page long enough for its engine to stop: start a new one.
      orb.stop(); orb = null;
      wrap.replaceChildren(freshCanvas());
    }
    slot.appendChild(wrap);
    start();
  }

  window.meridianOrb = {
    place,
    setState(s) { state = s || 'idle'; },
    useState(fn) { provider = typeof fn === 'function' ? fn : null; },
    getState() { return state; },
    setVoice(level) { voice = Math.max(0, Math.min(1, Number(level) || 0)); },
  };
})();
