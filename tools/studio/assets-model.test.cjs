'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const M = require('../../src/renderer/studio/assets/asset-model.js');
const asset = (changes = {}) => ({
  id: 'original', spaceId: 'sandbox-me', name: 'crew-hero-main__v1',
  kind: 'image', version: 1, parentId: null, ...changes,
});

test('the same module exports its API in Node and the app', () => {
  const context = { window: {}, structuredClone };
  vm.runInNewContext(fs.readFileSync(require.resolve('../../src/renderer/studio/assets/asset-model.js'), 'utf8'), context);
  assert.deepEqual(Object.keys(context.window.MeridianAssetModel), Object.keys(M));
  assert.equal(context.window.MeridianAssetModel.safeName('CON.txt'), '_CON.txt');
});

test('safe names normalize text and handle unsafe filename characters and reserved names', () => {
  assert.equal(M.safeName('  Cafe\u0301  '), 'Café');
  assert.equal(M.safeName('a<>:"/\\|?*b...'), 'a---------b');
  for (const name of ['CON.txt', 'prn', 'AUX.png', 'nul', 'COM1', 'lpt9.txt']) {
    assert.equal(M.safeName(name), '_' + name);
  }
  for (const name of ['', ' ', '.', '..', null, 12, 'a\nb', 'a\u0000b', 'a\u007fb']) {
    assert.throws(() => M.safeName(name));
  }
  assert.throws(() => M.safeName('CON.' + 'a'.repeat(156)), { code: 'INVALID_TEXT' });
});

test('archived Unicode cases enforce submitted and final NFC limits without truncation', () => {
  const expanding = '\u0344';
  const accepted = expanding.repeat(80);
  const rejected = expanding.repeat(160);
  assert.equal(rejected.length, 160);
  assert.equal(rejected.normalize('NFC').length, 320);
  assert.throws(() => M.safeName(rejected), { code: 'INVALID_TEXT' });
  assert.equal(M.safeName(accepted), accepted.normalize('NFC'));
  assert.equal(M.safeName(accepted).length, 160);
  assert.equal(M.safeName('n'.repeat(160)), 'n'.repeat(160));
  assert.throws(() => M.safeName('n'.repeat(161)), { code: 'INVALID_TEXT' });
  assert.equal(M.safeName('😀'.repeat(80)), '😀'.repeat(80));
  assert.throws(() => M.safeName('😀'.repeat(81)), { code: 'INVALID_TEXT' });
  assert.equal(M.safeName('e\u0301'.repeat(80)), 'é'.repeat(80));
  assert.throws(() => M.safeName('e\u0301'.repeat(81)), { code: 'INVALID_TEXT' });
  assert.throws(() => M.safeName(' '.repeat(160) + 'x'), { code: 'INVALID_TEXT' });
});

test('suggestions use subject-purpose-variant and validate the whole final name', () => {
  assert.equal(M.suggestName({ subject: 'Our Crew', purpose: 'Website Hero', variant: 'Main', version: 2 }), 'our-crew-website-hero-main__v2');
  assert.equal(M.suggestName({ subject: 'Cafe\u0301', purpose: 'social', variant: 'square' }), 'café-social-square__v1');
  assert.throws(() => M.suggestName({ subject: 'x'.repeat(150), purpose: 'hero', variant: 'main' }), { code: 'INVALID_TEXT' });
  assert.throws(() => M.suggestName({ subject: 'x', purpose: 'hero', variant: '---' }), { code: 'UNSAFE_NAME' });
  assert.throws(() => M.suggestName(), { code: 'INVALID_TEXT' });
  for (const version of [0, -1, 1.5, '1', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => M.suggestName({ subject: 'x', purpose: 'hero', variant: 'main', version }), { code: 'INVALID_VERSION' });
  }
});

test('validation requires current asset fields, supported kinds and valid lineage', () => {
  for (const kind of ['image', 'video', 'file']) assert.equal(M.validateAsset(asset({ kind })).kind, kind);
  for (const key of ['id', 'spaceId', 'name', 'kind', 'version', 'parentId']) {
    const bad = asset(); delete bad[key];
    assert.throws(() => M.validateAsset(bad), key);
  }
  for (const bad of [null, [], asset({ kind: 'audio' }), asset({ id: '../asset' }),
    asset({ spaceId: 7 }), asset({ name: '../bad' }), asset({ version: 0 }),
    asset({ version: 2 }), asset({ parentId: 'other' }), asset({ version: 2, parentId: 'original' })]) {
    assert.throws(() => M.validateAsset(bad));
  }
  assert.equal(M.validateAsset(asset({ id: 'second', version: 2, parentId: 'original' })).version, 2);
});

test('validation clones metadata and rejects expanded names without changing input', () => {
  const input = asset({ metadata: { tags: ['crew'] } });
  const copy = M.validateAsset(input);
  copy.metadata.tags.push('hero');
  assert.deepEqual(input.metadata.tags, ['crew']);
  const bad = asset({ name: '\u0344'.repeat(160) });
  const before = structuredClone(bad);
  assert.throws(() => M.validateAsset(bad), { code: 'INVALID_TEXT' });
  assert.deepEqual(bad, before);
  assert.equal(M.validateAsset(asset({ name: '\u0344'.repeat(80) })).name.length, 160);
});

test('a derivative has its own identity, links to its parent and starts as draft work', () => {
  const parent = asset({ approved: true, kept: true, metadata: { tags: ['original'] } });
  const before = structuredClone(parent);
  const changes = { id: 'second', metadata: { tags: ['edited'] }, parentId: 'wrong', version: 100, approved: true };
  const next = M.nextVersion(parent, changes);
  assert.equal(next.id, 'second');
  assert.equal(next.spaceId, parent.spaceId);
  assert.equal(next.version, 2);
  assert.equal(next.parentId, parent.id);
  assert.equal(next.name, 'crew-hero-main__v2');
  assert.equal(next.approved, false);
  assert.equal(next.kept, false);
  assert.equal(next.trashed, false);
  next.metadata.tags.push('independent');
  assert.deepEqual(parent, before);
  assert.deepEqual(changes.metadata.tags, ['edited']);
  const third = M.nextVersion(next, { id: 'third', name: 'crew-social-square__v1' });
  assert.equal(third.parentId, 'second');
  assert.equal(third.name, 'crew-social-square__v3');
});

test('invalid derivatives cannot reuse an ID, cross Spaces or overflow names and versions', () => {
  for (const changes of [null, {}, { id: 'original' }]) assert.throws(() => M.nextVersion(asset(), changes));
  assert.throws(() => M.nextVersion(asset(), { id: 'second', spaceId: 'other' }), { code: 'SPACE_DENIED' });
  assert.throws(() => M.nextVersion(asset({ version: Number.MAX_SAFE_INTEGER, parentId: 'prior' }), { id: 'second' }), { code: 'INVALID_VERSION' });
  const parent = asset({ name: 'x'.repeat(156) + '__v9', version: 9, parentId: 'prior' });
  const before = structuredClone(parent);
  assert.throws(() => M.nextVersion(parent, { id: 'second' }), { code: 'INVALID_TEXT' });
  assert.deepEqual(parent, before);
});
