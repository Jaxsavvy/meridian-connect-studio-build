'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Contract = require('./asset-v1-contract.cjs');

const A = 'synthetic-project-a';
const B = 'synthetic-project-b';
const H1 = 'a'.repeat(64);
const H2 = 'b'.repeat(64);
const envelope = extra => ({ contract: Contract.CONTRACT, correlationId: 'synthetic-correlation-1', ...extra });
function asset() {
  return {
    assetId: 'synthetic-asset-a', projectId: A, revision: 2, name: 'poster',
    originalFilename: 'poster.png', tags: ['launch'], description: '', section: 'Files',
    originalVersionId: 'synthetic-version-1', preferredVersionId: 'synthetic-version-2',
    historyCursor: null,
    versions: [
      { versionId: 'synthetic-version-1', assetId: 'synthetic-asset-a', projectId: A,
        sequence: 1, originalVersionId: 'synthetic-version-1', parentVersionId: null,
        operation: 'original', reviewState: 'draft', byteLength: 16, sha256: H1,
        mediaType: 'image/png', originalFilename: 'poster.png' },
      { versionId: 'synthetic-version-2', assetId: 'synthetic-asset-a', projectId: A,
        sequence: 2, originalVersionId: 'synthetic-version-1', parentVersionId: 'synthetic-version-1',
        operation: 'manual-edit', reviewState: 'draft', byteLength: 18, sha256: H2,
        mediaType: 'image/png', originalFilename: 'poster-edit.png' },
    ],
  };
}
function summary() {
  return { assetId: 'synthetic-asset-a', projectId: A, revision: 2, name: 'poster',
    originalVersionId: 'synthetic-version-1', preferredVersionId: 'synthetic-version-2',
    preferredMediaType: 'image/png', preferredReviewState: 'draft', updatedAt: '2026-10-15T00:00:00Z' };
}

test('page boundary is explicit and never becomes a full-list array', () => {
  const page = Contract.parseSearchPage(envelope({ items: [summary()], nextCursor: 'opaque-next' }), A, 50);
  assert.equal(page.complete, false);
  assert.equal(page.nextCursor, 'opaque-next');
  assert.equal(page.items.length, 1);
  assert.equal(Contract.parseSearchPage(envelope({ items: [summary()], nextCursor: null }), A, 50).complete, true);
  assert.throws(() => Contract.parseSearchPage(envelope({ items: [], nextCursor: 'stuck' }), A, 50), { code: 'INVALID_RESPONSE' });
});

test('foreign and duplicate summaries fail before display', () => {
  const foreign = summary(); foreign.projectId = B;
  assert.throws(() => Contract.parseSearchPage(envelope({ items: [foreign], nextCursor: null }), A), { code: 'INVALID_RESPONSE' });
  assert.throws(() => Contract.parseSearchPage(envelope({ items: [summary(), summary()], nextCursor: null }), A), { code: 'INVALID_RESPONSE' });
  const leaking = summary(); leaking.storageKey = 'internal-object-key';
  assert.throws(() => Contract.parseSearchPage(envelope({ items: [leaking], nextCursor: null }), A), { code: 'INVALID_RESPONSE' });
  assert.throws(() => Contract.parseSearchPage(envelope({ items: [summary()], nextCursor: null,
    storageKey: 'internal-object-key' }), A), { code: 'INVALID_RESPONSE' });
  const tooLong = summary(); tooLong.name = 'n'.repeat(161);
  assert.throws(() => Contract.parseSearchPage(envelope({ items: [tooLong], nextCursor: null }), A), { code: 'INVALID_RESPONSE' });
});

test('exact record maps complete lineage to Cassy component shape', () => {
  const record = asset(); record.description = 'First line\nSecond line';
  const mapped = Contract.mapAsset(envelope({ asset: record }), A, 'synthetic-asset-a');
  assert.equal(mapped.id, 'synthetic-asset-a');
  assert.equal(mapped.originalVersionId, 'synthetic-version-1');
  assert.equal(mapped.versions[1].id, 'synthetic-version-2');
  assert.equal(mapped.versions[1].bytes, 18);
  assert.equal(mapped.versions[0].sha256, H1);
  assert.equal(mapped.description, 'First line\nSecond line');
});

test('foreign, cyclic and incomplete exact records fail closed', () => {
  const foreign = asset(); foreign.versions[1].projectId = B;
  assert.throws(() => Contract.mapAsset(envelope({ asset: foreign }), A, 'synthetic-asset-a'), { code: 'PROJECT_DENIED' });
  const cyclic = asset(); cyclic.versions[1].parentVersionId = 'synthetic-version-2';
  assert.throws(() => Contract.mapAsset(envelope({ asset: cyclic }), A, 'synthetic-asset-a'), { code: 'INVALID_RESPONSE' });
  const incomplete = asset(); incomplete.historyCursor = 'more-history';
  assert.throws(() => Contract.mapAsset(envelope({ asset: incomplete }), A, 'synthetic-asset-a'), { code: 'PAGED_HISTORY_UNSUPPORTED' });
  const leaking = asset(); leaking.versions[0].storageKey = 'internal-object-key';
  assert.throws(() => Contract.mapAsset(envelope({ asset: leaking }), A, 'synthetic-asset-a'), { code: 'INVALID_RESPONSE' });
  assert.throws(() => Contract.mapAsset(envelope({ asset: asset() }), A, 'synthetic-asset-other'), { code: 'INVALID_RESPONSE' });
  const missingMarker = asset(); delete missingMarker.historyCursor;
  assert.throws(() => Contract.mapAsset(envelope({ asset: missingMarker }), A, 'synthetic-asset-a'), { code: 'INVALID_RESPONSE' });
  const badDescription = asset(); badDescription.description = { unexpected: true };
  assert.throws(() => Contract.mapAsset(envelope({ asset: badDescription }), A, 'synthetic-asset-a'), { code: 'INVALID_RESPONSE' });
  const badFilename = asset(); delete badFilename.versions[0].originalFilename;
  assert.throws(() => Contract.mapAsset(envelope({ asset: badFilename }), A, 'synthetic-asset-a'), { code: 'INVALID_RESPONSE' });
  assert.throws(() => Contract.mapAsset(envelope({ asset: asset(), storageKey: 'internal-object-key' }), A,
    'synthetic-asset-a'), { code: 'INVALID_RESPONSE' });
});

test('body digest is stable for same intent and changes for different intent', async () => {
  const base = { assetId: 'synthetic-asset-a', expectedRevision: 2, name: ' Café ',
    tags: ['launch'], description: '', section: 'Files', mutationKey: 'synthetic-mutation-0001' };
  const first = await Contract.bodyDigest('files.metadata', A, base);
  const repeat = await Contract.bodyDigest('files.metadata', A,
    { ...base, name: 'Café', mutationKey: 'synthetic-mutation-0002' });
  const changed = await Contract.bodyDigest('files.metadata', A,
    { ...base, tags: ['other'] });
  assert.equal(first, repeat);
  assert.notEqual(first, changed);
  assert.match(first, /^[0-9a-f]{64}$/);
});

test('fingerprints bind project, parent, bytes and review intent', async () => {
  const begin = { filename: 'poster.png', mediaType: 'image/png', byteLength: 16,
    sha256: H1, mutationKey: 'synthetic-mutation-0003' };
  assert.notEqual(await Contract.bodyDigest('files.import-begin', A, begin),
    await Contract.bodyDigest('files.import-begin', B, begin));
  assert.notEqual(await Contract.bodyDigest('files.import-begin', A, begin),
    await Contract.bodyDigest('files.import-begin', A, { ...begin, sha256: H2 }));
  const derivative = { ...begin, assetId: 'synthetic-asset-a',
    parentVersionId: 'synthetic-version-1', baseRevision: 2 };
  assert.notEqual(await Contract.bodyDigest('files.import-begin', A, begin),
    await Contract.bodyDigest('files.import-begin', A, derivative));
  await assert.rejects(Contract.bodyDigest('files.submit-review', A,
    { assetId: 'synthetic-asset-a', versionId: 'synthetic-version-2',
      expectedRevision: 2, decision: 'approved', mutationKey: 'synthetic-mutation-0004' }),
  { code: 'INVALID_REQUEST' });
});

test('renderer-supplied endpoint and path fields are rejected', async () => {
  await assert.rejects(Contract.bodyDigest('files.import-begin', A,
    { filename: 'poster.png', mediaType: 'image/png', byteLength: 16, sha256: H1 }),
  { code: 'INVALID_REQUEST' });
  await assert.rejects(Contract.bodyDigest('files.import-begin', A,
    { filename: 'poster.png', mediaType: 'image/png', byteLength: 16, sha256: H1,
      mutationKey: 'synthetic-mutation-0005', endpoint: 'https://example.invalid' }),
  { code: 'INVALID_REQUEST' });
  await assert.rejects(Contract.bodyDigest('files.import-finalize', A,
    { uploadId: 'synthetic-upload-1', sha256: H1, mutationKey: 'synthetic-mutation-0006',
      destinationPath: 'synthetic-path' }), { code: 'INVALID_REQUEST' });
});

test('mutation names stay within the current Asset Model read limit', async () => {
  const begin = { filename: 'f'.repeat(161), mediaType: 'image/png', byteLength: 16,
    sha256: H1, mutationKey: 'synthetic-mutation-0007' };
  await assert.rejects(Contract.bodyDigest('files.import-begin', A, begin), { code: 'INVALID_REQUEST' });
  const metadata = { assetId: 'synthetic-asset-a', expectedRevision: 2, name: 'n'.repeat(161),
    tags: [], description: '', section: 'Files', mutationKey: 'synthetic-mutation-0008' };
  await assert.rejects(Contract.bodyDigest('files.metadata', A, metadata), { code: 'INVALID_REQUEST' });
});

