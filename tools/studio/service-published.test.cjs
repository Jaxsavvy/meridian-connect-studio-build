'use strict';
// Core (#123): service.getPublished gives the Print card its live link and QR code, only once Jax approves Publish.
// Synthetic data only. The QR codes were checked with an independent decoder (jsQR) at versions 1-10 when written.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createSampleService, createServerService } = require('../../src/renderer/studio/studio-service.js');
const Qr = require('../../src/renderer/studio/decks/qr-code.js');

function service() {
  const s = createSampleService();
  s.setProjects([{ id: 'sample-home', name: 'Sample Home Services' }]);
  return s;
}
const bits = q => q.modules.map(r => r.map(b => (b ? 1 : 0)).join('')).join('\n');

test('null until Jax approves Publish, then an unlisted link and a QR code for it', async () => {
  const s = service();
  const job = await s.startJob('sample-home', 'pitch-deck', 'deck');
  await s.useSampleResearch('sample-home', job.id);
  for (const id of ['research', 'home-t1', 'home-t2', 'home-t3', 'assemble', 'check']) await s.completeStage('sample-home', job.id, id);
  assert.equal(await s.getPublished('sample-home', job.id), null, 'nothing before Review');
  await s.completeStage('sample-home', job.id);
  await s.approveStage('sample-home', job.id);                       // Review approved
  assert.equal(await s.getPublished('sample-home', job.id), null);
  const waiting = await s.completeStage('sample-home', job.id);      // Publish waits on Jax
  assert.deepEqual([waiting.stageId, waiting.waitingOnJax], ['publish', true]);
  assert.equal(await s.getPublished('sample-home', job.id), null, 'nothing prints before Publish is approved');

  await s.approveStage('sample-home', job.id);
  const out = await s.getPublished('sample-home', job.id);
  assert.deepEqual(Object.keys(out), ['url', 'qrSvg']);
  assert.match(out.url, /^https:\/\/decks\.example\.com\/u\/[^/?#\s]+$/, 'a made-up link, never a real site');
  assert.ok(out.url.endsWith(encodeURIComponent(job.id)));
  assert.match(out.qrSvg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 (\d+) \1"/);
  assert.equal(out.qrSvg, Qr.svg(out.url), 'the QR code is for exactly this link');
  assert.deepEqual(await s.getPublished('sample-home', job.id), out, 'the same link every time');
});

test('other Jobs, unknown Jobs and the server service', async () => {
  const s = service();
  const site = await s.startJob('sample-home', 'website', 'standard');
  assert.equal(await s.getPublished('sample-home', site.id), null, 'only pitch decks publish here');
  await assert.rejects(s.getPublished('sample-home', 'not-a-job'));
  await assert.rejects(s.getPublished('elsewhere', site.id));
  const server = createServerService({ request: async () => ({ success: true, data: [] }) });
  assert.equal(await server.getPublished('sample-home', 'any'), null, 'null until publishing is on the server (#121)');
});

test('the QR code: known pattern, finder squares, level M format bits, quiet zone', () => {
  const url = 'https://decks.example.com/u/sample-job-0001';
  const q = Qr.encode(url);
  assert.equal(q.size, 33);   // version 4
  assert.equal(crypto.createHash('sha256').update(bits(q)).digest('hex'),
    '995a565d8317c1bea73aa30185d23cfaa56ec8b980adb3db81bacfe21eb5d20d', 'the pattern jsQR decoded back to this link');
  const finder = ['1111111', '1000001', '1011101', '1011101', '1011101', '1000001', '1111111'];
  const at = (x0, y0) => finder.map((_, y) => q.modules[y0 + y].slice(x0, x0 + 7).map(b => (b ? 1 : 0)).join(''));
  for (const [x, y] of [[0, 0], [q.size - 7, 0], [0, q.size - 7]]) assert.deepEqual(at(x, y), finder);
  let format = 0;   // read the format bits back (top-left copy) and check the error correction level and BCH code
  for (let i = 0; i <= 5; i++) format |= (q.modules[i][8] ? 1 : 0) << i;
  format |= (q.modules[7][8] ? 1 : 0) << 6 | (q.modules[8][8] ? 1 : 0) << 7 | (q.modules[8][7] ? 1 : 0) << 8;
  for (let i = 9; i < 15; i++) format |= (q.modules[8][14 - i] ? 1 : 0) << i;
  format ^= 0x5412;
  assert.equal(format >>> 13, 0, 'error correction level M');
  let rem = format >>> 10;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  assert.equal(rem & 0x3FF, format & 0x3FF, 'format bits pass their BCH check');
  assert.match(Qr.svg(url), /viewBox="0 0 41 41"/, '4 modules of quiet zone on each side');
  assert.throws(() => Qr.encode('z'.repeat(214)), /too long/);
  assert.equal(Qr.encode('a').size, 21);
  assert.ok(!/[<>"&]/.test(Qr.svg('<script>"&').replace(/<\/?(svg|rect|path)[^>]*>/g, '')), 'text never lands in the SVG');
});

test('the contact the Print card prints, the same in both services, and the card loads in the app', async () => {
  const want = { name: 'Breakthrough Ventures', email: 'breakthroughventuresgroup@gmail.com' };
  assert.deepEqual(await service().getContact(), want);
  assert.deepEqual(await createServerService({ request: async () => ({ success: true, data: [] }) }).getContact(), want);
  const c = await service().getContact(); c.email = 'changed';
  assert.equal((await service().getContact()).email, want.email, 'callers get a copy');
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../src/renderer/studio/studio-app.js'), 'utf8');
  assert.match(app, /'studio\/tools\/pitch-deck\/print-card\.js'/, 'LANE_FILES loads the Print card tool (#277)');
});
