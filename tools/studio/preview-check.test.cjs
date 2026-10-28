'use strict';
// Core: the real site, part 2 (#260), the main-process checks on a client site's Cloudflare Pages preview. Fake windows, no network.
const test = require('node:test');
const assert = require('node:assert/strict');
const { MAX_PAGES, previewRequest, pageFlags, checkPreview, makeCapture } = require('../../src/preview-check.js');

const PREVIEW = 'https://3-abc.site-sample-home-services.pages.dev';
const ok = extra => ({ projectId: 'sample-home', preview: PREVIEW, name: 'Website', pages: [{ path: '/', label: 'Home' }], ...extra });
const CLEAN = { h1: 1, noAlt: 0, title: true, description: true, links: [] };

test('the request from Studio is checked: project, preview link, pages; names are made safe', () => {
  assert.throws(() => previewRequest(ok({ projectId: '../etc' })), /Unknown project/);
  for (const preview of ['http://x.pages.dev', 'https://pages.dev.example.com', 'https://user:pass@x.pages.dev', 'https://x.pages.dev:8443', 'nope', `https://${'a'.repeat(300)}.pages.dev`]) {
    assert.throws(() => previewRequest(ok({ preview })), /must be an https:\/\/….pages.dev link/, preview);
  }
  assert.throws(() => previewRequest(ok({ pages: [{ path: 'about' }, { path: '/../x' }, { path: '//evil.example' }, { path: '/About' }] })), /No pages to check/);
  const job = previewRequest(ok({ preview: `${PREVIEW}/some/page?x=1`, name: 'Website <v2>/..\\', pages: [{ path: '/', label: 'Home' },
    { path: '/services/roofing/' }, { path: '/' }, 42] }));
  assert.equal(job.origin, PREVIEW);
  assert.deepEqual(job.pages.map(p => [p.url, p.where]), [[`${PREVIEW}/`, 'Home'], [`${PREVIEW}/services/roofing/`, '/services/roofing/']]);
  assert.deepEqual(job.pages[1].shots, { desktop: 'Website v2. - Site services-roofing on desktop.png', phone: 'Website v2. - Site services-roofing on a phone.png' });
  assert.equal(previewRequest(ok({ pages: Array.from({ length: 30 }, (_, i) => ({ path: `/p${i}` })) })).pages.length, MAX_PAGES);
});

test('what a page says about itself becomes flags', () => {
  assert.deepEqual(pageFlags(CLEAN, 'Home'), []);
  assert.deepEqual(pageFlags({ ...CLEAN, h1: 2, noAlt: 3, title: false, description: false }, 'Home').map(f => `${f.check}: ${f.message}`), [
    'accessibility: A page needs exactly one main heading (h1); this one has 2.', 'accessibility: 3 images have no alt text.',
    'seo: The page has no title for Google.', 'seo: The page has no description for Google.']);
  assert.equal(pageFlags(null, 'Home').length, 3, 'nothing read: no h1, title or description');
});

test('every page at both widths: flags, screenshots, a page that fails, outside links tried once', async () => {
  const job = previewRequest(ok({ pages: [{ path: '/', label: 'Home' }, { path: '/about', label: 'About' }] }));
  const seen = [], uploads = [], fetched = [];
  const capture = async (url, size) => {
    seen.push(`${size.id} ${url}`);
    if (url.endsWith('/about') && size.id === 'desktop') return { status: 404 };
    const wide = url.endsWith('/') && size.id === 'phone' ? 520 : size.width;
    return { status: 200, metrics: { cssContentSize: { width: wide, height: 2000 } }, png: Buffer.from('png'),
      said: { ...CLEAN, links: ['https://maps.example.com/a', 'https://maps.example.com/a', 'javascript:alert(1)', 'https://down.example.com'] } };
  };
  const fetchFn = async url => { fetched.push(url); if (url.includes('down')) throw new Error('ENOTFOUND'); return { status: 200 }; };
  const out = await checkPreview(job, { capture, upload: async (png, name) => { uploads.push(name); return true; }, fetchFn });
  assert.deepEqual(seen, [`desktop ${PREVIEW}/`, `phone ${PREVIEW}/`, `desktop ${PREVIEW}/about`, `phone ${PREVIEW}/about`]);
  assert.deepEqual(out.flags.map(f => `${f.check} · ${f.where}: ${f.message}`), [
    'phone · Home: Something runs off the side on a phone: the page is 520px wide on a 390px screen.',
    'links · About: This page doesn\'t open on the preview (error 404).',
    'links-open · Home: This link doesn\'t open: https://down.example.com']);
  assert.deepEqual(uploads, ['Website - Site home on desktop.png', 'Website - Site home on a phone.png', 'Website - Site about on a phone.png']);
  assert.deepEqual(out.ran, ['links-open'], 'one screenshot missing: the screenshots count as not run');
  assert.deepEqual([...new Set(fetched)], ['https://maps.example.com/a', 'https://down.example.com']);
  const good = await checkPreview(job, { capture: async (url, size) => ({ status: 200, metrics: { cssContentSize: { width: size.width, height: 900 } }, said: CLEAN, png: Buffer.from('p') }),
    upload: async () => true, fetchFn });
  assert.deepEqual([good.flags, good.ran, good.shots.length], [[], ['site-screenshots', 'links-open'], 4]);
  const thrown = await checkPreview(previewRequest(ok()), { capture: async () => { throw new Error('ERR_NAME_NOT_RESOLVED'); }, upload: async () => true, fetchFn });
  assert.deepEqual(thrown.flags.map(f => f.message), ['This page doesn\'t open on the preview.']);
});

test('the hidden window: locked down, never leaves the preview, always closed', async () => {
  const made = [];
  class FakeWindow {
    constructor(opts) {
      this.opts = opts; this.handlers = {}; this.destroyed = false; this.commands = []; made.push(this);
      const win = this;
      this.webContents = { on(k, fn) { win.handlers[k] = fn; }, setWindowOpenHandler(fn) { win.openHandler = fn; },
        executeJavaScript: async code => { win.commands.push(code.includes("loading = 'eager'") ? 'eager' : 'measure'); return code.includes('eager') ? true : CLEAN; },
        debugger: { attach() {}, async sendCommand(name, params) { win.commands.push(name);
          if (name === 'Page.getLayoutMetrics') return { cssContentSize: { width: 390, height: 99999 } };
          if (name === 'Page.captureScreenshot') { win.shot = params; if (win.hang) return new Promise(() => {}); return { data: Buffer.from('png').toString('base64') }; }
          return {}; } } };
    }
    async loadURL(url) { if (url.includes('broken')) throw new Error('ERR_ABORTED'); this.hang = url.includes('stuck'); this.handlers['did-navigate']({}, url, 200); }
    isDestroyed() { return this.destroyed; }
    destroy() { this.destroyed = true; }
  }
  const capture = makeCapture({ BrowserWindow: FakeWindow, ses: 'preview-session', origin: PREVIEW, settleMs: 0, timeoutMs: 50 });
  const got = await capture(`${PREVIEW}/`, { id: 'phone', width: 390, height: 844 });
  const [win] = made;
  assert.deepEqual(win.opts.webPreferences, { sandbox: true, contextIsolation: true, nodeIntegration: false, session: 'preview-session' });
  assert.equal(win.opts.show, false);
  const blocked = to => { let stopped = false; win.handlers['will-navigate']({ preventDefault() { stopped = true; } }, to); return stopped; };
  assert.equal(blocked(`${PREVIEW}/about/`), false);
  assert.equal(blocked('https://evil.example/'), true);
  let redirected = false; win.handlers['will-redirect']({ preventDefault() { redirected = true; } }, 'https://other.pages.dev/'); assert.equal(redirected, true);
  assert.deepEqual(win.openHandler({ url: 'https://example.com' }), { action: 'deny' });
  assert.deepEqual([got.status, got.said, got.png.toString()], [200, CLEAN, 'png']);
  assert.deepEqual(win.commands, ['eager', 'Page.getLayoutMetrics', 'measure', 'Page.captureScreenshot'], 'lazy images load first; no resize');
  assert.deepEqual([win.shot.captureBeyondViewport, win.shot.clip.height], [true, 16000], 'a very long page is cut at 16000 px');
  assert.equal(win.destroyed, true);
  await assert.rejects(capture(`${PREVIEW}/broken`, { id: 'desktop', width: 1440, height: 900 }), /ERR_ABORTED/);
  assert.equal(made[1].destroyed, true, 'closed even when the page fails');
  await assert.rejects(capture(`${PREVIEW}/stuck`, { id: 'desktop', width: 1440, height: 900 }), /slow/);
  assert.equal(made[2].destroyed, true, 'a screenshot that never comes back times out, and the window closes');
});
