const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../../../../src/renderer/studio-assets/model');
const { SyntheticService } = require('../../../../src/renderer/studio-assets/synthetic-service');
const { Controller } = require('../../../../src/renderer/studio-assets/controller');
const input = (overrides = {}) => ({ projectId: 'A', filename: 'Blue Poster.txt', mediaType: 'text/plain', bytes: new TextEncoder().encode('synthetic content'), idempotencyKey: 'first', ...overrides });
test('original, branches and download remain independent immutable snapshots', async () => {
  const s = new SyntheticService({ projects: ['A'] }); const a = await s.import(input()); const original = structuredClone(a.versions[0]);
  const b = await s.import(input({ assetId: a.id, parentVersionId: original.id, operation: 'manual-edit', idempotencyKey: 'second', bytes: new Uint8Array([1]) }));
  const c = await s.import(input({ assetId: a.id, parentVersionId: original.id, operation: 'manual-edit', idempotencyKey: 'third' }));
  assert.deepEqual(c.versions[0], original); assert.equal(c.versions.length, 3); assert.equal(c.versions[2].parentVersionId, original.id);
  b.name = 'mutated'; assert.notEqual((await s.list({ projectId: 'A' }))[0].name, 'mutated');
  const d = await s.download({ projectId: 'A', assetId: a.id, versionId: original.id }); d.bytes[0] = 0;
  assert.equal(new TextDecoder().decode((await s.download({ projectId: 'A', assetId: a.id, versionId: original.id })).bytes), 'synthetic content');
});
test('idempotent concurrent imports create one version and conflicting reuse is rejected', async () => {
  const s = new SyntheticService({ projects: ['A'], delay: 2 }); const [a,b] = await Promise.all([s.import(input()), s.import(input())]);
  assert.equal(a.id, b.id); assert.equal((await s.list({ projectId: 'A' })).length, 1);
  await assert.rejects(s.import(input({ filename: 'Other.txt' })), { code: 'IDEMPOTENCY_CONFLICT' });
});
test('cross-project list, asset, parent and download cannot escape scope', async () => {
  const s = new SyntheticService({ projects: ['A','B'] }); const a = await s.import(input());
  assert.deepEqual(await s.list({ projectId: 'B' }), []);
  await assert.rejects(s.download({ projectId: 'B', assetId: a.id, versionId: a.originalVersionId }), { code: 'NOT_FOUND' });
  await assert.rejects(s.import(input({ projectId: 'B', assetId: a.id, parentVersionId: a.originalVersionId, operation: 'upscale', idempotencyKey: 'bad' })), { code: 'NOT_FOUND' });
  await assert.rejects(s.list({ projectId: 'C' }), { code: 'PROJECT_DENIED' });
});
test('revocation and cancellation at commit publish nothing', async () => {
  const s = new SyntheticService({ projects: ['A'] }); s.beforeCommit = () => s.revoke('A');
  await assert.rejects(s.import(input()), { code: 'PROJECT_DENIED' }); assert.equal(s.assets.size, 0);
  const abort = new AbortController(); const t = new SyntheticService({ projects: ['A'], beforeCommit: () => abort.abort() });
  await assert.rejects(t.import(input({ signal: abort.signal })), { code: 'CANCELLED' }); assert.equal(t.assets.size, 0);
});
test('unsafe paths, corrupt media, absent bytes and storage failure do not register', async () => {
  const s = new SyntheticService({ projects: ['A'] });
  await assert.rejects(s.import(input({ filename: '../bad.txt' })), { code: 'UNSAFE_PATH' });
  await assert.rejects(s.import(input({ mediaType: 'image/png' })), { code: 'CORRUPT_MEDIA' });
  await assert.rejects(s.import(input({ bytes: new Uint8Array() })), { code: 'MISSING_FILE' });
  s.storageFailure = true; await assert.rejects(s.import(input()), { code: 'STORAGE_FAILED' }); assert.equal(s.assets.size, 0);
});
test('human correction, revision conflict and search', async () => {
  const s = new SyntheticService({ projects: ['A'] }); const a = await s.import(input());
  const b = await s.metadata({ projectId: 'A', assetId: a.id, revision: 1, name: 'My corrected name', tags: ['poster'], section: 'Brand' });
  assert.equal(b.provenance.name.source, 'human'); assert.equal(b.originalFilename, 'Blue Poster.txt');
  assert.equal((await s.list({ projectId: 'A', query: 'poster', section: 'Brand' })).length, 1);
  await assert.rejects(s.metadata({ projectId: 'A', assetId: a.id, revision: 1, name: 'stale', tags: [], section: 'Files' }), { code: 'REVISION_CONFLICT' });
});
test('review targets exact version and enhanced version starts draft', async () => {
  const s = new SyntheticService({ projects: ['A'] }); const a = await s.import(input());
  const b = await s.review({ projectId: 'A', assetId: a.id, versionId: a.originalVersionId, revision: a.revision });
  const c = await s.import(input({ assetId: a.id, parentVersionId: a.originalVersionId, operation: 'upscale', idempotencyKey: 'enhance' }));
  assert.equal(b.versions[0].reviewState, 'submitted'); assert.equal(c.versions[0].reviewState, 'submitted'); assert.equal(c.versions[1].reviewState, 'draft');
});
test('validator rejects duplicate, missing-parent and foreign records without mutating input', async () => {
  const s = new SyntheticService({ projects: ['A'] }); const a = await s.import(input()); const before = structuredClone(a);
  assert.deepEqual(M.validate(a, 'A'), before);
  const bad = structuredClone(a); bad.versions.push({ ...bad.versions[0], id: 'v-bad', sequence: 2, operation: 'upscale', parentVersionId: 'missing' });
  assert.throws(() => M.validate(bad,'A'), { code: 'INVALID_LINEAGE' }); assert.throws(() => M.validate(a,'B'), { code: 'PROJECT_DENIED' });
  bad.versions[1] = structuredClone(bad.versions[0]); assert.throws(() => M.validate(bad,'A'), { code: 'INVALID_LINEAGE' }); assert.deepEqual(a, before);
});
test('project switches and sign-out discard responses from an adapter ignoring abort', async () => {
  const resolvers = []; const service = { mode: 'synthetic', list: ({projectId}) => new Promise(resolve => resolvers.push({projectId,resolve})) };
  const c = new Controller({ service, projects: [{id:'A',name:'A'},{id:'B',name:'B'}] });
  const pa = c.selectProject('A'); const pb = c.selectProject('B'); resolvers[0].resolve([]); await pa;
  assert.equal(c.snapshot().project.id, 'B'); resolvers[1].resolve([]); await pb;
  const pc = c.search(); c.signOut(); resolvers[2].resolve([]); await pc; assert.equal(c.snapshot().project, null); assert.deepEqual(c.snapshot().assets, []);
});
test('cancelled saves and revoked membership cannot populate controller', async () => {
  const s = new SyntheticService({ projects: ['A'], delay: 5 }); const c = new Controller({service:s,projects:[{id:'A',name:'A'}]}); await c.selectProject('A');
  const save = c.save('import', input()); c.cancel(); await save; assert.equal(s.assets.size,0); assert.equal(c.snapshot().phase,'cancelled');
  await c.save('import', input()); s.revoke('A'); await c.search(); assert.deepEqual(c.snapshot().assets, []); assert.equal(c.snapshot().error,'PROJECT_DENIED');
});
test('unknown project clears previous scope; offline state stays honest', async () => {
  const s = new SyntheticService({ projects: ['A'] }); const c = new Controller({service:s,projects:[{id:'A',name:'A'}]}); await c.selectProject('A');
  s.offline = true; await c.search(); assert.equal(c.snapshot().phase,'offline'); await c.selectProject('fake'); assert.equal(c.snapshot().project,null);
});
test('export names neutralize platform reserved names and preserve version identity', () => {
  assert.equal(M.safeName('CON.txt'), '_CON.txt'); assert.equal(M.suggestName('Blue Poster.png'),'blue-poster');
  assert.equal(M.exportName({name:'../unsafe'},{mediaType:'image/png',sequence:2}),'..-unsafe__v2.png');
});
test('controller rejects malformed records, corrupt download and unsupported operations',async()=>{
  const s=new SyntheticService({projects:['A']});const c=new Controller({service:s,projects:[{id:'A',name:'A'}]});await c.selectProject('A');const a=await c.save('import',input());
  const normal=s.download.bind(s);s.download=async scope=>{const result=await normal(scope);result.bytes[0]=0;return result;};
  assert.equal(await c.download({assetId:a.id,versionId:a.originalVersionId}),null);assert.equal(c.snapshot().error,'CHECKSUM_MISMATCH');
  s.list=async()=>[{}];await c.search();assert.equal(c.snapshot().error,'PROJECT_DENIED');assert.deepEqual(c.snapshot().assets,[]);
  await assert.rejects(c.save('revoke',{}),{code:'INVALID_OPERATION'});
});
test('named service adapter snapshots payload and forwards cancellation without routes/tokens',async()=>{
  const {ServiceAdapter}=require('../../../../src/renderer/studio-assets/service-adapter');let captured;
  const adapter=new ServiceAdapter({request:async(operation,payload,options)=>{captured={operation,payload,options};return [];}});
  const signal=new AbortController();await adapter.list({projectId:'A',signal:signal.signal});assert.equal(captured.operation,'asset.list');assert.deepEqual(captured.payload,{projectId:'A'});assert.equal(captured.options.signal,signal.signal);
  signal.abort();await assert.rejects(adapter.list({projectId:'A',signal:signal.signal}),{code:'CANCELLED'});
});
