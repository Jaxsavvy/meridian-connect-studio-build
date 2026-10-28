'use strict';
// Tyler 15: Print card with the QR code (#123). Synthetic data only; the live link is the sample-mode example.com one.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const Qr = require('../../src/renderer/studio/decks/qr-code.js');
const { LAYOUTS, buildCard, createPrintCard, mountCanvas } = require('../../src/renderer/studio/tools/pitch-deck/print-card.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
const URL_ = 'https://decks.example.com/u/job-0001';

// A deck walked up to Publish; publish: true has Jax approve it.
async function walked({ publish = false } = {}) {
  const service = createSampleService(); service.setProjects([{ id: 'client-a', name: 'Client <A> & "Co"' }]);
  const job = await service.startJob('client-a', 'pitch-deck', 'deck');
  await service.useSampleResearch('client-a', job.id);
  for (const id of ['research', 'home-t1', 'home-t2', 'home-t3', 'assemble', 'check']) await service.completeStage('client-a', job.id, id);
  await service.completeStage('client-a', job.id); await service.approveStage('client-a', job.id);   // Review
  await service.completeStage('client-a', job.id);                                                    // Publish waits on Jax
  if (publish) await service.approveStage('client-a', job.id);
  return { service, job };
}
function setup(service, jobId) {
  const views = [], dirty = [];
  const model = createPrintCard({ service, spaceId: 'client-a', jobId, report: v => views.push(v), onDirty: v => dirty.push(v) });
  return { model, views, dirty, last: () => views[views.length - 1] };
}
function dom() {
  const doc = { activeElement: null, createElement(tag) { return { tag, ownerDocument: doc, children: [], attrs: {}, events: {},
    setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; }, append(...items) { this.children.push(...items); },
    appendChild(item) { this.append(item); }, replaceChildren(...items) { this.children = items; },
    addEventListener(k, fn) { this.events[k] = fn; }, removeEventListener(k, fn) { if (this.events[k] === fn) delete this.events[k]; },
    remove() {}, click() { if (!this.disabled) this.events.click?.(); } }; } };
  return doc.createElement('div');
}
const walk = el => [el, ...el.children.flatMap(walk)];
const text = el => (el.textContent || '') + el.children.map(text).join('');

test('both layouts: name, score hook, QR of at least 1 inch, the live link and BV line; every piece of text escaped', () => {
  const qrSvg = Qr.svg(URL_);
  for (const layout of Object.keys(LAYOUTS)) {
    const html = buildCard({ layout, name: '<script>x()</script> & Co', score: 58, url: URL_, qrSvg });
    assert.match(html, new RegExp(`@page\\{size:${LAYOUTS[layout].page};`));
    assert.match(html, /Your business score: 58 of 100\. Scan to see why\./);
    assert.ok(html.includes(qrSvg), 'the exact QR code from Publish');
    assert.ok(parseFloat(LAYOUTS[layout].qr) >= 1); assert.match(html, /min-width:1in;min-height:1in/);
    assert.match(html, /<p class="link">https:\/\/decks\.example\.com\/u\/job-0001<\/p>/);
    assert.match(html, /Prepared by Breakthrough Ventures/);
    assert.match(html, /&lt;script&gt;x\(\)&lt;\/script&gt; &amp; Co/); assert.doesNotMatch(html, /<script/);
    assert.doesNotMatch(html, /\$|price|cost|deal/i);   // no money anywhere
  }
  assert.match(buildCard({ layout: 'card', name: 'A', score: null, url: URL_, qrSvg }), /Scan to see your market report\./);
});

test('nothing prints without the live https link and our QR code', () => {
  const qrSvg = Qr.svg(URL_);
  for (const url of ['http://decks.example.com/u/1', 'javascript:alert(1)', '', null]) assert.throws(() => buildCard({ name: 'A', url, qrSvg }), /https link/);
  for (const bad of ['', '<svg onload="x()"></svg>', qrSvg.replace('<path', '<text>hi</text><path'), `${qrSvg}<script>x()</script>`]) {
    assert.throws(() => buildCard({ name: 'A', url: URL_, qrSvg: bad }), /QR code/);
  }
});

test('waits for Publish, then the card; Finish saves both layouts and completes Print card', async () => {
  const { service, job } = await walked();
  const { model, views, dirty, last } = setup(service, job.id);
  await model.load();
  assert.equal(last().state, 'empty'); assert.match(last().message, /Waiting for Publish/);
  await service.approveStage('client-a', job.id);
  await model.load();
  const published = await service.getPublished('client-a', job.id);
  assert.deepEqual([last().state, last().open, last().done, last().url], ['ready', true, false, published.url]);
  assert.ok(last().html.includes(published.qrSvg)); assert.match(last().html, /Client &lt;A&gt; &amp; &quot;Co&quot;/);
  assert.match(last().html, /data-layout="letter"/);
  assert.equal(model.setLayout('poster'), false); assert.equal(model.setLayout('card'), true);
  assert.match(last().html, /data-layout="card"/);

  await model.finish();
  const files = (await service.listProjectFiles('client-a')).map(f => f.name).sort();
  assert.deepEqual(files, [`${job.name} - Print card - 4x6.html`, `${job.name} - Print card - letter.html`]);
  const after = await service.getJob('client-a', job.id);
  assert.equal(after.stages.find(st => st.id === 'print').status, 'done');
  assert.deepEqual([last().done, last().open, last().error], [true, false, '']);
  assert.deepEqual(dirty, [true, false]);
  await model.finish();
  assert.match(last().error, /isn't open/); assert.ok(views.length > 3);
});

test('the tool: sandboxed preview, a live reload when Jax approves Publish, cleanup; no innerHTML', async () => {
  const { service, job } = await walked();
  const el = dom(), studio = { service, setDirty() {} };
  const stop = mountCanvas(el, { studio, spaceId: 'client-a', jobId: job.id });
  await tick(); await tick();
  assert.match(text(el), /Waiting for Publish/);
  await service.approveStage('client-a', job.id);                // emits jobs-changed: the card appears by itself
  for (let i = 0; i < 6; i++) await tick();
  const frame = walk(el).find(n => n.tag === 'iframe');
  assert.equal(frame.attrs.sandbox, 'allow-scripts', 'exactly allow-scripts, never allow-same-origin');
  assert.match(frame.srcdoc, /Your business score: \d+ of 100/);
  const finish = walk(el).find(n => n.tag === 'button' && n.attrs['data-focus'] === 'finish');
  assert.equal(finish.disabled, false);
  stop();
  const source = fs.readFileSync(path.join(__dirname, '../../src/renderer/studio/tools/pitch-deck/print-card.js'), 'utf8');
  assert.doesNotMatch(source, /innerHTML|fetch\(|window\.meridian/);
});
