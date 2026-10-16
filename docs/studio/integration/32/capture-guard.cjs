'use strict';

const { createHash } = require('node:crypto');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function assertWarningState(state, expected) {
  if (state.projectId !== expected.projectId || !state.projectId) throw new Error('Warning project changed.');
  if (state.fieldValue !== expected.fieldValue || !state.dirty) throw new Error('Unsaved metadata draft is missing.');
  if (!state.connected || !state.visible || !state.inViewport) throw new Error('Warning must be connected, visible and fully in the capture viewport.');
  if (!state.text.includes('Unsaved asset metadata will be discarded if you leave this project.')) throw new Error('Actual unsaved warning text is missing.');
  for (const label of ['Keep editing', 'Discard changes and leave']) {
    const control = state.controls.find(item => item.text === label);
    if (!control || !control.visible || !control.inViewport || control.disabled) throw new Error(`Warning control is not visible and enabled: ${label}`);
  }
}

function assertDistinctCapture({ normal, selected, warning }) {
  if ([normal, selected, warning].some(bytes => !Buffer.isBuffer(bytes) || bytes.length === 0)) throw new Error('Capture bytes are missing.');
  const hashes = { normal: hash(normal), selected: hash(selected), warning: hash(warning) };
  if (hashes.warning === hashes.normal || hashes.warning === hashes.selected) throw new Error('Stale warning capture matches an ordinary Asset view.');
  return hashes;
}

module.exports = { assertWarningState, assertDistinctCapture, hash };
