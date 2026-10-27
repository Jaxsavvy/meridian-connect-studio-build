'use strict';
// Core: Connect's top bar at narrow widths and 200% zoom (#83). Checked in Chromium at 800-1280px when built;
// these guard the pieces that make it work.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const src = file => fs.readFileSync(path.join(__dirname, '../../src', file), 'utf8');

test('the main window can be narrowed to 800px', () => {
  assert.match(src('main.js'), /minWidth: 800,/);
});

test('the top bar collapses instead of clipping: one-line title, icon search, initial-only profile', () => {
  const css = src('renderer/meridian-standard.css');
  assert.match(css, /\.log header h1,\.log header \.head-sub\{white-space:nowrap!important;overflow:hidden;text-overflow:ellipsis\}/);
  assert.match(css, /@media\(max-width:1000px\)\{[^]*\.command-search\{flex:none!important;width:39px!important/);
  assert.match(css, /@media\(max-width:1000px\)\{[^]*#user-name-label\{position:absolute!important;width:1px!important/);
});

test('the home-base banner sits under the top bar, in the page flow', () => {
  const shell = src('renderer/connect-shell.js');
  assert.match(shell, /const bar = document\.querySelector\('\.log > header'\);/);
  assert.match(shell, /bar\.insertAdjacentElement\('afterend', el\)/);
});
