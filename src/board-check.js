/**
 * Auto check, part 2 (#131): what Connect's main process checks on a finished pitch deck board.
 * The board at phone width (nothing may run off the side) and every link on it (each must open).
 * Pure helpers so they can be tested without Electron; main.js does the window and the network.
 */

'use strict';

const PHONE = Object.freeze({ width: 390, height: 844 });
const MAX_LINKS = 40;
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const PNG_NAME = /^[A-Za-z0-9 ._()-]{1,140}\.png$/;

/** Studio's request, checked (it comes from the renderer, so nothing is trusted): { projectId, html, links, fileName }. */
function checkRequest(req) {
  const r = req && typeof req === 'object' ? req : {};
  if (!SAFE_ID.test(String(r.projectId || ''))) throw new Error('Unknown project.');
  if (typeof r.html !== 'string' || !/^<!doctype html>/i.test(r.html) || r.html.length > 3 * 1024 * 1024) throw new Error('That isn\'t a board.');
  if (!PNG_NAME.test(String(r.fileName || '')) || r.fileName.includes('..')) throw new Error('Use a normal file name ending in .png.');
  const seen = new Set(), links = [];
  for (const l of Array.isArray(r.links) ? r.links : []) {
    const url = l && typeof l.url === 'string' ? l.url.trim() : '';
    if (!/^https?:\/\//i.test(url) || url.length > 500 || seen.has(url)) continue;
    seen.add(url); links.push({ url, where: typeof l.where === 'string' ? l.where.slice(0, 200) : '' });
  }
  return { projectId: r.projectId, html: r.html, fileName: r.fileName, links: links.slice(0, MAX_LINKS) };
}

/** One flag per link that doesn't open. fetchFn(url, { method, redirect, signal }) resolves to { status }. */
async function linkFlags(links, fetchFn, { timeoutMs = 8000 } = {}) {
  const opens = async url => {
    for (const method of ['HEAD', 'GET']) {   // some sites refuse HEAD; try a normal visit before flagging
      const stop = new AbortController(), timer = setTimeout(() => stop.abort(), timeoutMs);
      try {
        const res = await fetchFn(url, { method, redirect: 'follow', signal: stop.signal });
        if (res && res.status < 400) return true;
      } catch (_) { /* tried below, or flagged */ } finally { clearTimeout(timer); }
    }
    return false;
  };
  const results = await Promise.all(links.map(async l => ((await opens(l.url)) ? null : l)));
  return results.filter(Boolean).map(l => ({ check: 'links-open', message: `This link doesn't open: ${l.url}`, where: l.where }));
}

/** Flags from the board's size at phone width (Chromium's Page.getLayoutMetrics). */
function phoneFlags(metrics) {
  const size = (metrics && (metrics.cssContentSize || metrics.contentSize)) || {};
  const width = Math.round(Number(size.width) || 0);
  return width > PHONE.width + 1
    ? [{ check: 'phone', message: `Something runs off the side on a phone: the board is ${width}px wide on a ${PHONE.width}px screen.`, where: 'board' }]
    : [];
}

module.exports = { PHONE, MAX_LINKS, checkRequest, linkFlags, phoneFlags };
