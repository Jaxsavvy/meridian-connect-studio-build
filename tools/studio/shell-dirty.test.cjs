'use strict';
// Core: each mounted panel keeps its own unsaved-work flag.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');

function shell() {
  const asked = [];
  const win = { MeridianStudioService: { createSampleService }, confirm: label => { asked.push(label); return false; } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../../src/renderer/studio/studio-app.js'), 'utf8'),
    { window: win, document: {}, console });
  return { studio: win.MeridianStudio, ui: win.MeridianStudioUI, asked };
}

function mountTwo(studio) {
  const got = {};
  studio.registerPart('conversation', { mount(el, ctx) { got.chat = ctx.studio; } });
  studio.registerTool('image-gen', { mountCanvas(el, ctx) { got.canvas = ctx.studio; } });
  studio.mountInto({}, 'part', 'conversation', { spaceId: 'sandbox-me' });
  studio.mountInto({}, 'tool', 'image-gen', { spaceId: 'sandbox-me' });
  return got;
}

test('chat clearing its draft does not clear the canvas warning', () => {
  const s = shell(); const got = mountTwo(s.studio);
  got.canvas.setDirty(true);
  got.chat.setDirty(true);
  got.chat.setDirty(false);
  assert.equal(s.ui.guardLeave(() => {}, 'Leave'), false, 'canvas draft still protected');
  assert.equal(s.asked.length, 1);
  got.canvas.setDirty(false);
  assert.equal(s.ui.guardLeave(() => {}, 'Leave'), true);
});

test('panels still see the shared service, events and navigation', () => {
  const s = shell(); const got = mountTwo(s.studio);
  assert.equal(got.chat.service, s.studio.service);
  assert.equal(typeof got.canvas.emit, 'function');
  assert.equal(typeof got.canvas.navigate, 'function');
  assert.notEqual(got.chat.setDirty, got.canvas.setDirty);
});

test('screen-level setDirty still guards leaving', () => {
  const s = shell();
  s.studio.setDirty(true);
  assert.equal(s.ui.guardLeave(() => {}, 'Leave'), false);
  s.studio.setDirty(false);
  assert.equal(s.ui.guardLeave(() => {}, 'Leave'), true);
});
