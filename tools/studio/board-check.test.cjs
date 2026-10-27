'use strict';
// Core: Auto check part 2 (#131), the main-process helpers for the phone-width board check and the link check.
const test = require('node:test');
const assert = require('node:assert/strict');
const { PHONE, MAX_LINKS, checkRequest, linkFlags, phoneFlags } = require('../../src/board-check.js');

const BOARD = '<!doctype html><html><body>Board</body></html>';
const ok = extra => ({ projectId: 'sample-home', html: BOARD, fileName: 'Pitch deck v1 - Board on a phone.png', links: [], ...extra });

test('the request from Studio is checked: project, board, file name; links filtered and capped', () => {
  assert.throws(() => checkRequest(ok({ projectId: '../etc' })), /Unknown project/);
  assert.throws(() => checkRequest(ok({ html: '<script>alert(1)</script>' })), /isn't a board/);
  assert.throws(() => checkRequest(ok({ fileName: 'board.html' })), /\.png/);
  assert.throws(() => checkRequest(null), /Unknown project/);
  const links = [{ url: 'https://example.com/a', where: 'market.stats.0.source.url' }, { url: 'https://example.com/a', where: 'dupe' },
    { url: 'javascript:alert(1)', where: 'x' }, { url: 'file:///etc/passwd', where: 'y' }, { url: 'http://example.com/b' }, 42];
  assert.deepEqual(checkRequest(ok({ links })).links, [{ url: 'https://example.com/a', where: 'market.stats.0.source.url' }, { url: 'http://example.com/b', where: '' }]);
  const many = Array.from({ length: 60 }, (_, i) => ({ url: `https://example.com/${i}` }));
  assert.equal(checkRequest(ok({ links: many })).links.length, MAX_LINKS);
});

test('a link is flagged only when it doesn\'t open (a refused HEAD gets a normal visit first)', async () => {
  const calls = [];
  const fetchFn = async (url, { method }) => {
    calls.push(`${method} ${url}`);
    if (url.endsWith('/broken')) return { status: 404 };
    if (url.endsWith('/no-head')) return { status: method === 'HEAD' ? 405 : 200 };
    if (url.endsWith('/down')) throw new Error('ENOTFOUND');
    return { status: 200 };
  };
  const flags = await linkFlags([{ url: 'https://example.com/fine', where: 'a' }, { url: 'https://example.com/broken', where: 'b' },
    { url: 'https://example.com/no-head', where: 'c' }, { url: 'https://example.com/down', where: 'd' }], fetchFn);
  assert.deepEqual(flags.map(f => [f.check, f.where]), [['links-open', 'b'], ['links-open', 'd']]);
  assert.match(flags[0].message, /doesn't open: https:\/\/example\.com\/broken/);
  assert.ok(calls.includes('GET https://example.com/no-head'));
  const slow = await linkFlags([{ url: 'https://example.com/slow', where: 'e' }],
    (url, { signal }) => new Promise((_, fail) => signal.addEventListener('abort', () => fail(new Error('aborted')))), { timeoutMs: 10 });
  assert.equal(slow.length, 1);
});

test('the phone check flags a board wider than the phone screen', () => {
  assert.deepEqual(phoneFlags({ cssContentSize: { width: PHONE.width, height: 5000 } }), []);
  assert.deepEqual(phoneFlags({ cssContentSize: { width: PHONE.width + 1 } }), []);   // rounding
  const [flag] = phoneFlags({ contentSize: { width: 520 } });
  assert.equal(flag.check, 'phone'); assert.match(flag.message, /520px wide on a 390px screen/);
  assert.deepEqual(phoneFlags(null), []);
});
