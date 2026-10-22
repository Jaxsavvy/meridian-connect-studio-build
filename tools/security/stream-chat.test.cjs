'use strict';

// Meridian AI chat: replies arrive in pieces, and earlier turns go back as {user, assistant} pairs.
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../../src/api.js');

const realFetch = global.fetch;
test.after(() => { global.fetch = realFetch; });

// A fake home base that answers with the given NDJSON lines and records what was sent.
function fakeServer(lines, sent) {
  global.fetch = async (url, opts) => {
    sent.push(JSON.parse(opts.body));
    const body = new ReadableStream({
      start(c) { for (const l of lines) c.enqueue(new TextEncoder().encode(JSON.stringify(l) + '\n')); c.close(); },
    });
    return new Response(body, { status: 200 });
  };
}

test('pieces reach onChunk and the full reply comes back', async () => {
  const sent = [];
  fakeServer([{ type: 'chunk', text: 'Hel' }, { type: 'chunk', text: 'lo' }, { type: 'done', text: 'Hello' }], sent);
  const pieces = [];
  const r = await api.streamChat('a'.repeat(32), 'hi', (t) => pieces.push(t));
  assert.deepEqual(pieces, ['Hel', 'lo']);
  assert.deepEqual(r, { success: true, text: 'Hello' });
});

test('the next question carries the earlier turn as a {user, assistant} pair', async () => {
  const sent = [];
  fakeServer([{ type: 'done', text: 'Second answer' }], sent);
  await api.streamChat('a'.repeat(32), 'second question');
  assert.deepEqual(sent[0].history, [{ user: 'hi', assistant: 'Hello' }]);
});

test('a reply that stops early is kept and marked as cut off', async () => {
  const sent = [];
  fakeServer([{ type: 'chunk', text: 'Part one' }], sent);
  const r = await api.streamChat(null, 'q');
  assert.equal(r.success, true);
  assert.match(r.text, /^Part one\n\n\(The reply was cut off/);
});

test('a server error with no text is reported as a failure', async () => {
  const sent = [];
  fakeServer([{ type: 'error', error: 'Meridian is busy.' }], sent);
  const r = await api.streamChat(null, 'q');
  assert.deepEqual(r, { success: false, error: 'Meridian is busy.' });
});
