'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');
const home = require('../../src/renderer/studio/screens/home.js');
const space = require('../../src/renderer/studio/screens/space.js');
const work = require('../../src/renderer/studio/screens/work.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
const walk = node => [node, ...node.children.flatMap(walk)];
const text = node => node.textContent;
// A small DOM double tests state/focus wiring, not native keyboard or layout behavior.
function dom() {
  const doc = { defaultView: { MeridianStudioScreenStates: home.screenStates },
    createElement(tag) {
      return { tagName: tag.toUpperCase(), ownerDocument: doc, children: [], attrs: {}, events: {},
        get textContent() { return (this._text || '') + this.children.map(text).join(''); },
        set textContent(value) { this._text = value; this.children = []; },
        setAttribute(key, value) { this.attrs[key] = value; },
        append(...nodes) { this.children.push(...nodes); },
        appendChild(node) { this.append(node); return node; },
        replaceChildren(...nodes) { this.children = nodes; },
        contains(node) { return walk(this).includes(node); },
        querySelectorAll(selector) { return walk(this).filter(node => node.tagName === selector.toUpperCase()); },
        querySelector(selector) { return this.querySelectorAll(selector)[0]; },
        addEventListener(key, listener) { this.events[key] = listener; },
        removeEventListener(key) { delete this.events[key]; },
        focus() { doc.activeElement = this; },
        click() { if (!this.disabled) this.events.click?.(); },
        remove() {},
      };
    } };
  doc.activeElement = doc.createElement('body');
  return doc.createElement('main');
}
function serviceWithFailures() {
  const service = createSampleService(); let failing = true;
  return { service: { ...service,
    async listSpaces() { if (failing) throw Error('private detail'); return service.listSpaces(); },
    async getSpace(id) { if (failing) throw Error('private detail'); return service.getSpace(id); },
  }, recover() { failing = false; } };
}
for (const [name, screen, params] of [
  ['home', home, {}], ['space', space, { spaceId: 'sandbox-me' }],
  ['work', work, { spaceId: 'sandbox-me', toolId: 'image-gen' }],
]) {
  test(`${name}: loading and safe failed panels, actual retry, focus and cleanup`, async () => {
    const el = dom(), source = serviceWithFailures(), routes = [], mounts = [];
    const cleanup = screen.render(el, params, { service: source.service,
      navigate: (...route) => routes.push(route), mountInto: (...args) => mounts.push(args) });
    const root = el.children[0];
    assert.equal(root.attrs['aria-busy'], 'true');
    assert.equal(el.ownerDocument.activeElement.tagName, 'H1');
    await tick();
    assert.equal(root.attrs['aria-busy'], 'false');
    const panel = walk(el).find(node => node.className === 'studio-state is-failed');
    assert.ok(panel); assert.equal(panel.children[0].attrs.role, 'alert');
    assert.doesNotMatch(text(panel), /private detail/);
    const retry = panel.querySelector('button'); retry.focus();
    source.recover(); retry.click(); await tick();
    assert.equal(walk(el).some(node => node.className === 'studio-state is-failed'), false);
    assert.equal(el.ownerDocument.activeElement.tagName, name === 'work' ? 'H2' : 'H1');
    if (name === 'work') assert.equal(mounts.length, 3);
    const button = root.querySelector('button'); button.click();
    assert.equal(routes.length, 1); cleanup();
  });
}
test('home and Work empty views use the same announced state panel', async () => {
  for (const [screen, params, service] of [
    [home, {}, { ...createSampleService(), listSpaces: async () => [] }],
    [work, { spaceId: 'sandbox-me', toolId: 'unknown' }, createSampleService()],
  ]) {
    const el = dom(); const cleanup = screen.render(el, params, { service, navigate() {} });
    await tick();
    const panel = walk(el).find(node => node.className === 'studio-state is-empty');
    assert.ok(panel); assert.equal(panel.children[0].attrs.role, 'status');
    assert.equal(panel.querySelector('button'), undefined); cleanup();
  }
});
test('Space empty sections share state styling and refresh preserves selected tool focus', async () => {
  const el = dom(), service = createSampleService(), routes = [];
  const cleanup = space.render(el, { spaceId: 'sandbox-me' }, { service, navigate: (...v) => routes.push(v) });
  await tick();
  assert.equal(walk(el).filter(node => node.className === 'studio-state is-empty').length, 2);
  const tool = el.querySelectorAll('button').find(node => text(node) === 'Image gen'); tool.focus();
  service.setProjects([]); await tick();
  assert.equal(text(el.ownerDocument.activeElement), 'Image gen');
  el.ownerDocument.activeElement.click();
  assert.deepEqual(routes, [['work', { spaceId: 'sandbox-me', toolId: 'image-gen' }]]);
  const outside = el.ownerDocument.createElement('button'); outside.focus();
  service.setProjects([]); await tick(); assert.equal(el.ownerDocument.activeElement, outside);
  cleanup();
});
test('Home cannot open stale Spaces during a refresh and disposed models never reload', async () => {
  const service = createSampleService(), views = [], routes = [];
  let resolve, hold = false;
  const model = home.createHome({ service: { ...service, listSpaces: () => hold
    ? new Promise(done => { resolve = done; }) : service.listSpaces() },
    report: view => views.push(view), navigate: (...route) => routes.push(route) });
  await model.load(); hold = true;
  const pending = model.load(); assert.equal(model.open('sandbox-me'), false);
  model.dispose(); resolve([]); await pending;
  const count = views.length; await model.load(); assert.equal(views.length, count);
  assert.equal(routes.length, 0);
  const s = space.createSpace({ service, spaceId: 'sandbox-me', report: view => views.push(view), navigate() {} });
  s.dispose(); await s.load(); assert.equal(views.length, count);
});
