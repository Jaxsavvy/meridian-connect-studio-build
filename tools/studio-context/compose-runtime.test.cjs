'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ASSET_HEAD, validSha, allowedAssetPath } = require('./compose-runtime.cjs');
test('runtime composition requires exact immutable inputs, not refs or command text', () => {
  assert.equal(validSha(ASSET_HEAD), true);
  for (const value of [undefined, '', 'main', '3fab5ef', 'a'.repeat(41), 'a'.repeat(39), 'a'.repeat(40) + ';']) assert.equal(validSha(value), false);
});
test('runtime composition cannot add unrelated chair paths', () => {
  for (const file of ['src/renderer/studio-assets/view.css', 'docs/studio/assets/8/component.test.cjs', 'docs/development/handoffs/ISSUE-8-chair-3.md']) assert.equal(allowedAssetPath(file), true);
  for (const file of ['src/main.js', 'src/preload.js', 'package.json', 'src/renderer/app.js', 'src/renderer/studio-ui/studio-shell.js', '.github/workflows/anything.yml']) assert.equal(allowedAssetPath(file), false);
});
