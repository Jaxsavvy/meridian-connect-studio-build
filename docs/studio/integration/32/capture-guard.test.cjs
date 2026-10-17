'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assertWarningState, assertDistinctCapture } = require('./capture-guard.cjs');
const expected = { projectId: 'synthetic-northstar', fieldValue: 'Unsaved synthetic metadata' };
const valid = () => ({ ...expected, connected: true, visible: true, inViewport: true, dirty: true,
  text: 'Unsaved asset metadata will be discarded if you leave this project.',
  controls: ['Keep editing', 'Discard changes and leave'].map(text => ({ text, visible: true, inViewport: true, disabled: false })) });

test('accepts the actual dirty warning and both visible choices', () => {
  assert.doesNotThrow(() => assertWarningState(valid(), expected));
});
test('rejects missing, hidden, clipped or wrong-project warning state', () => {
  for (const patch of [{ connected: false }, { visible: false }, { inViewport: false }, { dirty: false }, { projectId: 'other' }, { fieldValue: 'saved' }, { text: 'Ordinary Asset view' }]) {
    assert.throws(() => assertWarningState({ ...valid(), ...patch }, expected));
  }
});
test('rejects missing, disabled, hidden and clipped warning choices', () => {
  for (const patch of [{ visible: false }, { inViewport: false }, { disabled: true }]) {
    const state = valid(); Object.assign(state.controls[0], patch);
    assert.throws(() => assertWarningState(state, expected));
  }
  const state = valid(); state.controls.pop();
  assert.throws(() => assertWarningState(state, expected));
});
test('rejects byte-identical baseline captures and missing bytes', () => {
  const normal = Buffer.from('normal'); const selected = Buffer.from('selected');
  for (const warning of [normal, selected, Buffer.alloc(0)]) {
    assert.throws(() => assertDistinctCapture({ normal, selected, warning }));
  }
});
test('records distinct hashes without claiming pixel or visual acceptance', () => {
  const result = assertDistinctCapture({ normal: Buffer.from('normal'), selected: Buffer.from('selected'), warning: Buffer.from('warning') });
  assert.equal(new Set(Object.values(result)).size, 3);
  assert.match(result.warning, /^[a-f0-9]{64}$/);
});
