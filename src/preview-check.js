/**
 * The real site, part 2 (#260): what Connect's main process checks on a client site's Cloudflare Pages preview.
 * Every page at desktop and phone width (a full-page screenshot of each goes to the project's Docs), what each page
 * says about itself (one h1, alt text, a title and a description), and its outside links, each tried once.
 * Pure helpers, tested without Electron; makeCapture() drives the hidden windows main.js hands it.
 */

'use strict';

const { PHONE, MAX_LINKS, linkFlags, phoneFlags, timed } = require('./board-check');

const SIZES = Object.freeze([Object.freeze({ id: 'desktop', label: 'on desktop', width: 1440, height: 900 }),
  Object.freeze({ id: 'phone', label: 'on a phone', width: PHONE.width, height: PHONE.height })]);
const MAX_PAGES = 20, MAX_HEIGHT = 16000;
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const PAGE_PATH = /^\/[a-z0-9/-]{0,100}$/;

/** Studio's request, checked (it comes from the renderer, so nothing is trusted): { projectId, preview, name, pages: [{ path, label }] }.
 *  Returns { projectId, origin, pages: [{ url, where, shots: { desktop, phone } }] }; shots are the screenshots' file names. */
function previewRequest(req) {
  const r = req && typeof req === 'object' ? req : {};
  if (!SAFE_ID.test(String(r.projectId || ''))) throw new Error('Unknown project.');
  let url = null;
  try { url = new URL(String(r.preview || '')); } catch (_) { /* refused below */ }
  if (!url || url.protocol !== 'https:' || url.username || url.password || url.port || !/(^|\.)pages\.dev$/.test(url.hostname)
    || String(r.preview).length > 300) throw new Error('The preview link must be an https://….pages.dev link from Cloudflare Pages.');
  const name = String(r.name || '').replace(/[^A-Za-z0-9 ._()-]/g, '').replace(/\.{2,}/g, '.').trim().slice(0, 80) || 'Website';
  const pages = [], seen = new Set();
  for (const p of Array.isArray(r.pages) ? r.pages : []) {
    const path = p && typeof p.path === 'string' ? p.path : '';
    if (!PAGE_PATH.test(path) || path.includes('//') || seen.has(path) || pages.length >= MAX_PAGES) continue;
    seen.add(path);
    const slug = path === '/' ? 'home' : path.replace(/^\/|\/$/g, '').replace(/\//g, '-').slice(0, 40);
    const where = typeof p.label === 'string' && p.label.trim() ? p.label.trim().slice(0, 80) : path;
    pages.push({ url: url.origin + path, where, shots: Object.fromEntries(SIZES.map(s => [s.id, `${name} - Site ${slug} ${s.label}.png`])) });
  }
  if (!pages.length) throw new Error('No pages to check.');
  return { projectId: r.projectId, origin: url.origin, pages };
}

/** Runs inside the page: what it says about itself. */
const MEASURE = `(() => {
  const meta = document.querySelector('meta[name="description"]');
  return { h1: document.querySelectorAll('h1').length,
    noAlt: Array.from(document.images).filter(i => !i.hasAttribute('alt')).length,
    title: document.title.trim().length > 0, description: !!(meta && String(meta.content || '').trim()),
    links: Array.from(document.querySelectorAll('a[href]'), a => a.href).filter(h => /^https?:/i.test(h) && new URL(h).origin !== location.origin).slice(0, 40) };
})()`;

/** Runs inside the page first: images that would load as they scroll into view load now (3 seconds at most), so
 *  they're in the screenshot. */
const EAGER = `Promise.race([Promise.all(Array.from(document.images, i => { i.loading = 'eager';
  return i.complete ? 0 : new Promise(done => { i.addEventListener('load', done, { once: true }); i.addEventListener('error', done, { once: true }); }); })),
  new Promise(done => setTimeout(done, 3000))]).then(() => true)`;

/** Flags from what one page said (MEASURE). */
function pageFlags(said, where) {
  const s = said && typeof said === 'object' ? said : {}, count = v => Math.max(0, Math.floor(Number(v) || 0));
  const h1 = count(s.h1), noAlt = count(s.noAlt), flags = [], flag = (check, message) => flags.push({ check, message, where });
  if (h1 !== 1) flag('accessibility', `A page needs exactly one main heading (h1); this one has ${h1}.`);
  if (noAlt) flag('accessibility', `${noAlt} ${noAlt === 1 ? 'image has' : 'images have'} no alt text.`);
  if (s.title !== true) flag('seo', 'The page has no title for Google.');
  if (s.description !== true) flag('seo', 'The page has no description for Google.');
  return flags;
}
function widthFlags(metrics, where) {
  return phoneFlags(metrics).map(f => ({ ...f, where, message: f.message.replace('the board is', 'the page is') }));
}

/** Every check. capture(url, size) -> { status, metrics, said, png } (throws when the page can't be opened);
 *  upload(png, fileName) -> true once saved. Returns what Studio adds to Check: { success, flags, ran, shots }. */
async function checkPreview(job, { capture, upload, fetchFn }) {
  const flags = [], links = new Map(), shots = [];
  for (const page of job.pages) {
    let failed = null;
    for (const size of SIZES) {
      let got = null;
      try { got = await capture(page.url, size); } catch (_) { /* flagged below */ }
      if (!got || Number(got.status) >= 400) { failed = failed || (got && got.status) || 'no answer'; continue; }
      if (size.id === 'phone') {   // the words and links are the same at both widths: read them once
        flags.push(...widthFlags(got.metrics, page.where), ...pageFlags(got.said, page.where));
        for (const url of Array.isArray(got.said && got.said.links) ? got.said.links : []) {
          if (typeof url === 'string' && /^https?:\/\//i.test(url) && url.length <= 500 && !links.has(url)) links.set(url, { url, where: page.where });
        }
      }
      if (got.png && await upload(got.png, page.shots[size.id])) shots.push(page.shots[size.id]);
    }
    if (failed) flags.push({ check: 'links', where: page.where,
      message: failed === 'no answer' ? 'This page doesn\'t open on the preview.' : `This page doesn't open on the preview (error ${failed}).` });
  }
  flags.push(...await linkFlags([...links.values()].slice(0, MAX_LINKS), fetchFn));
  return { success: true, flags, ran: [...(shots.length === job.pages.length * SIZES.length ? ['site-screenshots'] : []), 'links-open'], shots };
}

const sameOrigin = (to, origin) => { try { return new URL(to).origin === origin; } catch (_) { return false; } };
/** capture() for checkPreview: one page in a hidden window, read by Chromium's page tools. ses: an in-memory session that
 *  refuses permissions and downloads (main.js). The page can run its own scripts but can't leave the preview or open windows. */
function makeCapture({ BrowserWindow, ses, origin, timeoutMs = 30000, settleMs = 300 }) {
  return async function capture(url, size) {
    const win = new BrowserWindow({ show: false, width: size.width, height: size.height, useContentSize: true,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, session: ses } });
    let status = 0;
    const stay = (ev, to) => { if (!sameOrigin(to, origin)) ev.preventDefault(); };
    win.webContents.on('will-navigate', stay);
    win.webContents.on('will-redirect', stay);
    win.webContents.on('did-navigate', (ev, to, code) => { status = code; });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    async function read() {
      await win.loadURL(url);
      await win.webContents.executeJavaScript(EAGER, true);
      await new Promise(done => setTimeout(done, settleMs));   // fonts and late layout settle
      const tools = win.webContents.debugger;
      tools.attach('1.3');
      const metrics = await tools.sendCommand('Page.getLayoutMetrics');
      const said = size.id === 'phone' ? await win.webContents.executeJavaScript(MEASURE, true) : null;
      const full = Math.min(Math.ceil(Number((metrics.cssContentSize || metrics.contentSize || {}).height) || size.height), MAX_HEIGHT);
      // Like the board check (#131): a hidden window paints no new frame after a resize, so capture beyond the viewport instead.
      const shot = await tools.sendCommand('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: size.width, height: full, scale: 1 } });
      return { status, metrics, said, png: Buffer.from(shot.data, 'base64') };
    }
    try {   // the whole read is timed: a page that never finishes can't hold up Check
      return await timed(read, timeoutMs);
    } finally {
      if (!win.isDestroyed()) win.destroy();
    }
  };
}

module.exports = { SIZES, MAX_PAGES, MEASURE, previewRequest, pageFlags, checkPreview, makeCapture };
