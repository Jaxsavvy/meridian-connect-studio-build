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
    historyCursor: null, metadataHistory: [], reviewHistory: [],
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
  const expandsAfterNfc = summary(); expandsAfterNfc.name = '\u0344'.repeat(160);
  assert.throws(() => Contract.parseSearchPage(envelope({ items: [expandsAfterNfc], nextCursor: null }), A),
    { code: 'INVALID_RESPONSE' });
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
  assert.deepEqual(mapped.metadataHistory, []);
  assert.deepEqual(mapped.reviewHistory, []);
});

test('complete empty history is explicit and omitted arrays fail closed', () => {
  const noMetadata = asset(); delete noMetadata.metadataHistory;
  assert.throws(() => Contract.mapAsset(envelope({ asset: noMetadata }), A, noMetadata.assetId),
    { code: 'INVALID_RESPONSE' });
  const noReview = asset(); delete noReview.reviewHistory;
  assert.throws(() => Contract.mapAsset(envelope({ asset: noReview }), A, noReview.assetId),
    { code: 'INVALID_RESPONSE' });
});

test('exact record rejects a name that expands beyond the read limit after NFC', () => {
  const record = asset(); record.name = '\u0344'.repeat(160);
  assert.throws(() => Contract.mapAsset(envelope({ asset: record }), A, record.assetId),
    { code: 'INVALID_RESPONSE' });
});

test('staged metadata and review history map without losing provenance', () => {
  const record = asset();
  record.revision = 4;
  record.metadataHistory = [{ actorId: 'synthetic-actor-a', priorRevision: 2,
    revision: 3, changed: { name: { before: 'poster', after: 'poster final' } },
    createdAt: 1760486400, correlationId: 'synthetic-correlation-2' }];
  record.reviewHistory = [{ actorId: 'synthetic-actor-a', versionId: 'synthetic-version-2',
    decision: 'submitted', revision: 4, createdAt: 1760486401,
    correlationId: 'synthetic-correlation-3' }];
  const mapped = Contract.mapAsset(envelope({ asset: record }), A, record.assetId);
  assert.equal(mapped.metadataHistory[0].actor, 'synthetic-actor-a');
  assert.equal(mapped.metadataHistory[0].changes.name.after, 'poster final');
  assert.match(mapped.metadataHistory[0].at, /^2025-10-15T/);
  assert.equal(mapped.reviewHistory[0].versionId, 'synthetic-version-2');
  assert.equal(mapped.reviewHistory[0].decision, 'submitted');
});

test('complete exact history rejects duplicate revisions across event kinds', () => {
  const record = asset();
  record.metadataHistory = [{ actorId: 'synthetic-actor-a', priorRevision: 1,
    revision: 2, changed: { name: { before: 'poster', after: 'poster final' } },
    createdAt: 1760486400, correlationId: 'synthetic-correlation-2' }];
  record.reviewHistory = [{ actorId: 'synthetic-actor-a', versionId: 'synthetic-version-2',
    decision: 'submitted', revision: 2, createdAt: 1760486401,
    correlationId: 'synthetic-correlation-3' }];
  assert.throws(() => Contract.mapAsset(envelope({ asset: record }), A, record.assetId),
    { code: 'INVALID_RESPONSE' });
});

test('history rejects foreign versions, internal fields and unsupported size', () => {
  const record = asset();
  record.reviewHistory = [{ actorId: 'synthetic-actor-a', versionId: 'synthetic-version-foreign',
    decision: 'submitted', revision: 2, createdAt: 1760486401,
    correlationId: 'synthetic-correlation-3' }];
  assert.throws(() => Contract.mapAsset(envelope({ asset: record }), A, record.assetId),
    { code: 'INVALID_RESPONSE' });
  record.reviewHistory[0].versionId = 'synthetic-version-2';
  record.reviewHistory[0].storageKey = 'private-object-key';
  assert.throws(() => Contract.mapAsset(envelope({ asset: record }), A, record.assetId),
    { code: 'INVALID_RESPONSE' });
  delete record.reviewHistory[0].storageKey;
  record.metadataHistory = Array.from({ length: 101 }, (_, index) => ({
    actorId: 'synthetic-actor-a', priorRevision: 1, revision: 2,
    changed: { name: { before: 'poster', after: `poster-${index}` } },
    createdAt: 1760486400, correlationId: 'synthetic-correlation-2' }));
  assert.throws(() => Contract.mapAsset(envelope({ asset: record }), A, record.assetId),
    { code: 'PAGED_HISTORY_UNSUPPORTED' });
  record.metadataHistory = record.metadataHistory.slice(0, 100);
  record.reviewHistory = [{ actorId: 'synthetic-actor-a', versionId: 'synthetic-version-2',
    decision: 'submitted', revision: 2, createdAt: 1760486401,
    correlationId: 'synthetic-correlation-3' }];
  assert.throws(() => Contract.mapAsset(envelope({ asset: record }), A, record.assetId),
    { code: 'PAGED_HISTORY_UNSUPPORTED' });
});

test('older history pages preserve provenance and an explicit completion marker', () => {
  const context = { projectId: A, assetId: 'synthetic-asset-a', assetRevision: 7,
    beforeRevision: 6, versionIds: ['synthetic-version-1', 'synthetic-version-2'] };
  const first = envelope({ projectId: A, assetId: context.assetId,
    metadataHistory: [
      { actorId: 'synthetic-actor-a', priorRevision: 2, revision: 3,
        changed: { name: { before: 'poster', after: 'poster revised' } },
        createdAt: 1760486400, correlationId: 'synthetic-correlation-2' },
      { actorId: 'synthetic-actor-a', priorRevision: 4, revision: 5,
        changed: { section: { before: 'Files', after: 'Design' } },
        createdAt: 1760486401, correlationId: 'synthetic-correlation-3' }],
    reviewHistory: [{ actorId: 'synthetic-actor-a', versionId: 'synthetic-version-2',
      decision: 'submitted', revision: 4, createdAt: 1760486400,
      correlationId: 'synthetic-correlation-4' }], nextCursor: 'synthetic-older-cursor' });
  const page = Contract.parseHistoryPage(first, context);
  assert.equal(page.complete, false);
  assert.equal(page.oldestRevision, 3);
  assert.equal(page.metadataHistory[0].changes.name.after, 'poster revised');
  assert.equal(page.reviewHistory[0].versionId, 'synthetic-version-2');
  const older = Contract.parseHistoryPage(envelope({ projectId: A, assetId: context.assetId,
    metadataHistory: [], reviewHistory: [{ actorId: 'synthetic-actor-a',
      versionId: 'synthetic-version-1', decision: 'submitted', revision: 2,
      createdAt: 1760486399, correlationId: 'synthetic-correlation-5' }],
    nextCursor: null }), { ...context, beforeRevision: page.oldestRevision });
  assert.equal(older.complete, true);
  assert.equal(older.oldestRevision, 2);
});

test('history pages fail closed on scope, order, size and hidden fields', () => {
  const context = { projectId: A, assetId: 'synthetic-asset-a', assetRevision: 7,
    beforeRevision: 6, versionIds: ['synthetic-version-1', 'synthetic-version-2'] };
  const event = { actorId: 'synthetic-actor-a', priorRevision: 2, revision: 3,
    changed: { name: { before: 'poster', after: 'poster revised' } },
    createdAt: 1760486400, correlationId: 'synthetic-correlation-2' };
  const page = { projectId: A, assetId: context.assetId,
    metadataHistory: [event], reviewHistory: [], nextCursor: null };
  const parse = value => Contract.parseHistoryPage(envelope(value), context);
  assert.throws(() => parse({ ...page, projectId: B }), { code: 'INVALID_RESPONSE' });
  assert.throws(() => parse({ ...page, assetId: 'synthetic-asset-b' }), { code: 'INVALID_RESPONSE' });
  assert.throws(() => parse({ ...page, metadataHistory: [{ ...event, storageKey: 'hidden' }] }),
    { code: 'INVALID_RESPONSE' });
  assert.throws(() => parse({ ...page, metadataHistory: [{ ...event, revision: 6 }] }),
    { code: 'INVALID_RESPONSE' });
  assert.throws(() => parse({ ...page, metadataHistory: [event, event] }),
    { code: 'INVALID_RESPONSE' });
  assert.throws(() => parse({ ...page, metadataHistory: Array(101).fill(event) }),
    { code: 'INVALID_RESPONSE' });
  assert.throws(() => parse({ ...page, metadataHistory: [], nextCursor: 'still-more' }),
    { code: 'INVALID_RESPONSE' });
  assert.throws(() => parse({ ...page, reviewHistory: [{ actorId: 'synthetic-actor-a',
    versionId: 'synthetic-version-foreign', decision: 'submitted', revision: 4,
    createdAt: 1760486400, correlationId: 'synthetic-correlation-3' }] }),
  { code: 'INVALID_RESPONSE' });
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
  assert.equal(typeof await Contract.bodyDigest('files.import-begin', A,
    { ...begin, filename: '😀'.repeat(80) }), 'string');
  for (const filename of ['😀'.repeat(81), 'e\u0301'.repeat(81)]) {
    await assert.rejects(Contract.bodyDigest('files.import-begin', A,
      { ...begin, filename }), { code: 'INVALID_REQUEST' });
  }
  assert.equal(typeof await Contract.bodyDigest('files.import-begin', A,
    { ...begin, filename: '\u0344'.repeat(80) }), 'string');
  const expanding = '\u0344'.repeat(160);
  assert.equal(expanding.length, 160);
  assert.equal(expanding.normalize('NFC').length, 320);
  await assert.rejects(Contract.bodyDigest('files.import-begin', A,
    { ...begin, filename: expanding }), { code: 'INVALID_REQUEST' });
  const metadata = { assetId: 'synthetic-asset-a', expectedRevision: 2, name: 'n'.repeat(161),
    tags: [], description: '', section: 'Files', mutationKey: 'synthetic-mutation-0008' };
  await assert.rejects(Contract.bodyDigest('files.metadata', A, metadata), { code: 'INVALID_REQUEST' });
  await assert.rejects(Contract.bodyDigest('files.metadata', A,
    { ...metadata, name: '😀'.repeat(81) }), { code: 'INVALID_REQUEST' });
  await assert.rejects(Contract.bodyDigest('files.metadata', A,
    { ...metadata, name: expanding }), { code: 'INVALID_REQUEST' });
});

test('metadata text limits count UTF-16 units before and after normalization', async () => {
  const base = { assetId: 'synthetic-asset-a', expectedRevision: 2, name: 'poster',
    tags: ['launch'], description: '', section: 'Files', mutationKey: 'synthetic-mutation-0009' };
  for (const change of [
    { description: '😀'.repeat(1001) },
    { description: 'e\u0301'.repeat(1001) },
    { description: '\u0344'.repeat(1500) },
    { section: '😀'.repeat(51) },
    { section: '\u0344'.repeat(75) },
    { tags: ['😀'.repeat(33)] },
    { tags: ['\u0344'.repeat(40)] },
    { description: '\ud800' },
    { section: '\ud800' },
    { tags: ['\ud800'] },
  ]) {
    await assert.rejects(Contract.bodyDigest('files.metadata', A, { ...base, ...change }),
      { code: 'INVALID_REQUEST' });
  }
  assert.match(await Contract.bodyDigest('files.metadata', A, {
    ...base, tags: ['😀'.repeat(32)], description: '😀'.repeat(1000),
    section: '😀'.repeat(50),
  }), /^[0-9a-f]{64}$/);
  const record = asset(); record.description = '😀'.repeat(1001);
  assert.throws(() => Contract.mapAsset(envelope({ asset: record }), A, record.assetId),
    { code: 'INVALID_RESPONSE' });
});
