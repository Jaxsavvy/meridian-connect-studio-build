/* Decides which links Connect may hand to the operating system to open.
 * Only normal web links and email links. Anything else (file:, javascript:,
 * custom app protocols, links with hidden usernames/passwords) is refused,
 * because the OS would otherwise launch local files or programs. */
'use strict';

const ALLOWED_PROTOCOLS = new Set(['https:', 'http:', 'mailto:']);
const MAX_LENGTH = 2048;

function isSafeExternalUrl(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_LENGTH) return false;
  let url;
  try { url = new URL(value.trim()); } catch { return false; }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) return false;
  if (url.protocol === 'mailto:') return url.pathname.includes('@');
  if (!url.hostname) return false;
  if (url.username || url.password) return false;
  return true;
}

module.exports = { isSafeExternalUrl };
