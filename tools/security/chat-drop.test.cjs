'use strict';

// Files dropped onto Messages: the page hands over bytes, never a path on disk.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = (file) => fs.readFileSync(path.join(__dirname, '../../src', file), 'utf8');

test('the drop handler takes bytes and a name, not a file path', () => {
  const main = src('main.js');
  const start = main.indexOf("ipcMain.handle('ws:upload-dropped-chat-file'");
  assert.ok(start > 0, 'handler exists');
  const handler = main.slice(start, main.indexOf('});', start));
  assert.match(handler, /bytes instanceof Uint8Array/);
  assert.match(handler, /DROP_MAX_BYTES/);
  assert.match(handler, /uploadChatBytes\(/);
  assert.doesNotMatch(handler, /readFileSync|filePath/);
});

test('preload sends the dropped file as bytes', () => {
  const preload = src('preload.js');
  assert.match(preload, /wsUploadDroppedChatFile:[\s\S]*?file\.arrayBuffer\(\)/);
  assert.doesNotMatch(preload, /webUtils|getPathForFile/);
});

test('Messages uses the byte upload for drops', () => {
  const hub = src('renderer/messages-hub.js');
  assert.match(hub, /wsUploadDroppedChatFile\(/);
  assert.doesNotMatch(hub, /files\[0\]\.path/);
});
