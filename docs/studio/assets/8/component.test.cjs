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
test('retried import acknowledgement cannot roll back newer human metadata',async()=>{
  const s=new SyntheticService({projects:['A']});const c=new Controller({service:s,projects:[{id:'A',name:'A'}]});await c.selectProject('A');
  const a=await c.save('import',input());await c.save('metadata',{assetId:a.id,revision:a.revision,name:'Human correction',tags:['human'],description:'corrected',section:'Brand'});
  const ack=await c.save('import',input());assert.equal(ack.revision,1);assert.equal(c.snapshot().assets[0].revision,2);assert.equal(c.snapshot().assets[0].name,'Human correction');
});
test('late same-project list cannot roll back a successful metadata save',async()=>{
  const s=new SyntheticService({projects:['A']});const c=new Controller({service:s,projects:[{id:'A',name:'A'}]});await c.selectProject('A');const a=await c.save('import',input());
  let resolve;s.list=()=>new Promise(done=>{resolve=done;});const pending=c.search();await c.save('metadata',{assetId:a.id,revision:a.revision,name:'Latest correction',tags:[],description:'',section:'Files'});
  resolve([a]);await pending;assert.equal(c.snapshot().assets[0].name,'Latest correction');assert.equal(c.snapshot().assets[0].revision,2);
});
test('self-consistent download of the wrong version is rejected',async()=>{
  const s=new SyntheticService({projects:['A']});const c=new Controller({service:s,projects:[{id:'A',name:'A'}]});await c.selectProject('A');const a=await c.save('import',input());
  const b=await c.save('import',input({assetId:a.id,parentVersionId:a.originalVersionId,operation:'manual-edit',idempotencyKey:'other',bytes:new Uint8Array([4,5,6])}));
  const original=s.download.bind(s);s.download=scope=>original({...scope,versionId:b.preferredVersionId});await c.download({assetId:a.id,versionId:a.originalVersionId});assert.equal(c.snapshot().error,'CHECKSUM_MISMATCH');
});
test('mutation response for another asset is rejected despite matching project',async()=>{
  const s=new SyntheticService({projects:['A']});const c=new Controller({service:s,projects:[{id:'A',name:'A'}]});await c.selectProject('A');const a=await c.save('import',input());
  const other=await s.import(input({idempotencyKey:'other'}));s.metadata=async()=>other;await c.save('metadata',{assetId:a.id});assert.equal(c.snapshot().error,'INVALID_RESPONSE');assert.equal(c.snapshot().assets.length,1);
});
test('read completion does not report ready while a metadata write is pending',async()=>{
  const s=new SyntheticService({projects:['A']});const c=new Controller({service:s,projects:[{id:'A',name:'A'}]});await c.selectProject('A');const a=await c.save('import',input());
  let release;const gate=new Promise(resolve=>{release=resolve;});const original=s.metadata.bind(s);s.metadata=async p=>{await gate;return original(p);};
  const save=c.save('metadata',{assetId:a.id,revision:a.revision,name:'Pending correction',tags:[],section:'Files'});await c.search();assert.equal(c.snapshot().phase,'saving');
  release();await save;assert.equal(c.snapshot().phase,'ready');assert.equal(c.snapshot().assets[0].name,'Pending correction');
});
test('tags-only correction preserves rule name provenance and records independent change history',async()=>{
  const s=new SyntheticService({projects:['A'],clock:()=> '2026-10-13T05:00:00Z'});const a=await s.import(input());
  const b=await s.metadata({projectId:'A',assetId:a.id,revision:a.revision,name:a.name,tags:['blue'],description:a.description,section:a.section});
  assert.equal(b.provenance.name.source,'rule');assert.equal(b.provenance.tags.source,'human');assert.deepEqual(Object.keys(b.metadataHistory[0].changes),['tags']);assert.deepEqual(b.metadataHistory[0].changes.tags.before,[]);
  b.metadataHistory[0].changes.tags.after.push('mutated');const saved=(await s.list({projectId:'A'}))[0];assert.deepEqual(saved.metadataHistory[0].changes.tags.after,['blue']);assert.equal(saved.originalFilename,a.originalFilename);
});
test('media and review filters match the same version; description is searchable',async()=>{
  const s=new SyntheticService({projects:['A']});const a=await s.import(input());await s.review({projectId:'A',assetId:a.id,versionId:a.originalVersionId,revision:a.revision});
  const jpeg=new Uint8Array([255,216,255,217]);const b=await s.import(input({assetId:a.id,parentVersionId:a.originalVersionId,mediaType:'image/jpeg',bytes:jpeg,operation:'manual-edit',idempotencyKey:'jpeg'}));
  assert.equal((await s.list({projectId:'A',mediaType:'image/jpeg',reviewState:'submitted'})).length,0);assert.equal((await s.list({projectId:'A',mediaType:'image/jpeg',reviewState:'draft'})).length,1);
  await s.metadata({projectId:'A',assetId:a.id,revision:b.revision,name:b.name,tags:[],description:'campaign launch',section:'Files'});assert.equal((await s.list({projectId:'A',query:'campaign launch'})).length,1);
});
test('malformed provenance/history is rejected and legacy records without these fields remain valid',async()=>{
  const s=new SyntheticService({projects:['A']});const a=await s.import(input());const legacy=structuredClone(a);delete legacy.provenance;delete legacy.metadataHistory;assert.equal(M.validate(legacy,'A').id,a.id);
  const bad=structuredClone(a);bad.provenance.name.source='untrusted';assert.throws(()=>M.validate(bad,'A'),{code:'INVALID_METADATA'});
  bad.provenance=a.provenance;bad.metadataHistory=[{revision:1,actor:'test',at:'test',changes:null}];assert.throws(()=>M.validate(bad,'A'),{code:'INVALID_METADATA'});
});

test('explicit conflict reload returns latest metadata without changing immutable versions',async()=>{
 const s=new SyntheticService({projects:['A']});const a=await s.import(input());const c=new Controller({service:s,projects:[{id:'A'}]});await c.selectProject('A');c.selectAsset(a.id);
 const updated=await s.metadata({projectId:'A',assetId:a.id,revision:a.revision,name:'Other editor',tags:['new'],section:'Files'});
 assert.equal(await c.save('metadata',{assetId:a.id,revision:a.revision,name:'Stale draft',tags:[],section:'Files'}),null);assert.equal(c.snapshot().error,'REVISION_CONFLICT');
 s.offline=true;assert.equal(await c.reloadAsset(a.id),null);assert.equal(c.snapshot().assets[0].name,a.name);
 s.offline=false;const result=await c.reloadAsset(a.id);assert.equal(result.name,'Other editor');assert.equal(result.revision,updated.revision);assert.deepEqual(result.versions,a.versions);
});
test('conflict reload rejects foreign records and late responses after switching project',async()=>{
 const s=new SyntheticService({projects:['A','B']});const a=await s.import(input());let release;const original=s.list.bind(s);const c=new Controller({service:s,projects:[{id:'A'},{id:'B'}]});await c.selectProject('A');
 s.list=async()=>[{...a,projectId:'B'}];assert.equal(await c.reloadAsset(a.id),null);assert.equal(c.snapshot().error,'PROJECT_DENIED');
 s.list=original;await c.selectProject('A');s.list=async()=>{await new Promise(r=>release=r);return [a];};const late=c.reloadAsset(a.id);s.list=original;await c.selectProject('B');release();assert.equal(await late,null);assert.equal(c.snapshot().project.id,'B');assert.equal(c.snapshot().assets.length,0);
});
test('offline metadata retry succeeds once and retains the original version',async()=>{
 const s=new SyntheticService({projects:['A']});const a=await s.import(input());const c=new Controller({service:s,projects:[{id:'A'}]});await c.selectProject('A');
 const patch={assetId:a.id,revision:a.revision,name:'Resume after offline',tags:[],section:'Files'};s.offline=true;assert.equal(await c.save('metadata',patch),null);assert.equal(c.snapshot().phase,'offline');assert.equal(c.snapshot().assets[0].revision,a.revision);
 s.offline=false;const saved=await c.save('metadata',patch);assert.equal(saved.revision,a.revision+1);assert.equal(saved.metadataHistory.length,1);assert.deepEqual(saved.versions,a.versions);
});

test('newer adapter responses cannot rewrite loaded original bytes or filename',async()=>{
 const s=new SyntheticService({projects:['A']});const a=await s.import(input());const c=new Controller({service:s,projects:[{id:'A'}]});await c.selectProject('A');
 const changed=structuredClone(a);changed.revision++;changed.versions[0].sha256='a'.repeat(64);s.list=async()=>[changed];assert.equal(await c.search(),null);assert.equal(c.snapshot().error,'IMMUTABLE_VERSION_CHANGED');assert.deepEqual(c.snapshot().assets[0],a);
 changed.versions[0].sha256=a.versions[0].sha256;changed.originalFilename='replacement.txt';assert.equal(await c.reloadAsset(a.id),null);assert.deepEqual(c.snapshot().assets[0],a);
});
test('mutation cannot remove an existing derivative but review-state changes remain valid',async()=>{
 const s=new SyntheticService({projects:['A']});const a=await s.import(input());const b=await s.import(input({assetId:a.id,parentVersionId:a.originalVersionId,operation:'manual-edit',idempotencyKey:'branch'}));const c=new Controller({service:s,projects:[{id:'A'}]});await c.selectProject('A');
 const incomplete=structuredClone(b);incomplete.revision++;incomplete.versions=incomplete.versions.slice(0,1);incomplete.preferredVersionId=incomplete.originalVersionId;s.metadata=async()=>incomplete;
 assert.equal(await c.save('metadata',{assetId:a.id}),null);assert.equal(c.snapshot().error,'IMMUTABLE_VERSION_CHANGED');assert.equal(c.snapshot().assets[0].versions.length,2);
 const reviewed=await c.save('review',{assetId:b.id,versionId:b.originalVersionId,revision:b.revision});assert.equal(reviewed.versions[0].reviewState,'submitted');assert.equal(reviewed.versions.length,2);
});

test('save outcomes are explicit and failed retry, cancel and signout clear success',async()=>{
 const s=new SyntheticService({projects:['A']});const c=new Controller({service:s,projects:[{id:'A'}]});await c.selectProject('A');const a=await c.save('import',input());assert.equal(c.snapshot().notice,'Asset imported and saved.');
 s.offline=true;await c.save('metadata',{assetId:a.id,revision:a.revision,name:'Offline edit',tags:[],section:'Files'});assert.equal(c.snapshot().notice,null);assert.equal(c.snapshot().phase,'offline');s.offline=false;
 const b=await c.save('metadata',{assetId:a.id,revision:a.revision,name:'Saved edit',tags:[],section:'Files'});assert.equal(c.snapshot().notice,'Metadata saved.');await c.save('review',{assetId:b.id,versionId:b.originalVersionId,revision:b.revision});assert.equal(c.snapshot().notice,'Selected version submitted for review.');c.cancel();assert.equal(c.snapshot().notice,null);c.signOut();assert.equal(c.snapshot().notice,undefined);
});

test('exact reload hydrates selected record independently of a partial search list',async()=>{
 const s=new SyntheticService({projects:['A']});const a=await s.import(input());let listCalls=0,getCalls=0;
 const service={mode:'service',list:async()=>{listCalls++;return [];},get:async request=>{getCalls++;assert.equal(request.projectId,'A');assert.equal(request.assetId,a.id);assert.ok(request.signal);return a;}};
 const c=new Controller({service,projects:[{id:'A'}]});await c.selectProject('A');assert.equal(c.snapshot().assets.length,0);const result=await c.reloadAsset(a.id);assert.equal(result.id,a.id);assert.equal(listCalls,1);assert.equal(getCalls,1);
 delete service.get;assert.equal(await c.reloadAsset(a.id),null);assert.equal(c.snapshot().error,'SERVICE_UNAVAILABLE');assert.equal(listCalls,1);
});
test('exact reload rejects wrong identity, revoked scope and late results',async()=>{
 const s=new SyntheticService({projects:['A','B']});const a=await s.import(input());const other=await s.import(input({filename:'other.txt',idempotencyKey:'other'}));const c=new Controller({service:s,projects:[{id:'A'},{id:'B'}]});await c.selectProject('A');s.get=async()=>other;assert.equal(await c.reloadAsset(a.id),null);assert.equal(c.snapshot().error,'INVALID_RESPONSE');
 s.get=async()=>({...a,projectId:'B'});assert.equal(await c.reloadAsset(a.id),null);assert.equal(c.snapshot().assets.length,0);
 let release;s.get=async()=>{await new Promise(r=>release=r);return a;};const pending=c.reloadAsset(a.id);await c.selectProject('B');release();assert.equal(await pending,null);assert.equal(c.snapshot().project.id,'B');assert.equal(c.snapshot().assets.length,0);
});
test('unknown mutation outcome is not auto-replayed and exact read can reconcile committed data',async()=>{
 const s=new SyntheticService({projects:['A']});const a=await s.import(input());const c=new Controller({service:s,projects:[{id:'A'}]});await c.selectProject('A');const metadata=s.metadata.bind(s);let attempts=0;
 s.metadata=async request=>{attempts++;await metadata(request);throw Object.assign(new Error('unknown'),{code:'UNKNOWN_OUTCOME'});};
 await c.save('metadata',{assetId:a.id,revision:a.revision,name:'Committed but timed out',tags:[],section:'Files'});assert.equal(attempts,1);assert.equal(c.snapshot().error,'UNKNOWN_OUTCOME');assert.equal(c.snapshot().assets[0].name,a.name);assert.equal(c.snapshot().notice,null);
 s.get=async({projectId,assetId})=>structuredClone(s.record(projectId,assetId));const read=await c.reloadAsset(a.id);assert.equal(read.name,'Committed but timed out');assert.equal(attempts,1);assert.deepEqual(read.versions,a.versions);
});

test('160-character names download with exact version suffix without trusting transport filenames',async()=>{
 const s=new SyntheticService({projects:['A']});const a=await s.import(input({filename:'f'.repeat(156)+'.txt'}));const c=new Controller({service:s,projects:[{id:'A'}]});await c.selectProject('A');const name='n'.repeat(160);const b=await c.save('metadata',{assetId:a.id,revision:a.revision,name,tags:[],section:'Files'});
 const download=s.download.bind(s);s.download=async request=>({...await download(request),filename:'../untrusted-destination.exe'});const result=await c.download({assetId:a.id,versionId:a.originalVersionId});assert.equal(result.filename,name+'__v1.txt');assert.equal(result.filename.length,168);assert.equal(b.originalFilename,a.originalFilename);assert.equal(b.versions[0].sha256,a.versions[0].sha256);
 assert.equal(await c.save('metadata',{assetId:a.id,revision:b.revision,name:'n'.repeat(161),tags:[],section:'Files'}),null);assert.equal(c.snapshot().error,'INVALID_TEXT');assert.equal(c.snapshot().assets[0].name,name);
});
test('Unicode display names keep exact export suffix while retaining current UTF-16 length limit',()=>{const name='😀'.repeat(80);assert.equal(M.text(name).length,160);assert.equal(M.exportName({name},{mediaType:'image/png',sequence:12}),name+'__v12.png');assert.throws(()=>M.text('😀'.repeat(81)),{code:'INVALID_TEXT'});});

test('non-synthetic legacy download fails closed before fetching complete bytes even for approved metadata',async()=>{const s=new SyntheticService({projects:['A']});const a=await s.import(input());s.mode='service';let fetched=0;s.download=async()=>{fetched++;throw Error('must not fetch');};const c=new Controller({service:s,projects:[{id:'A'}]});await c.selectProject('A');c.state.assets[0].versions[0].reviewState='approved';assert.equal(await c.download({assetId:a.id,versionId:a.originalVersionId}),null);assert.equal(c.snapshot().error,'SERVICE_UNAVAILABLE');assert.equal(fetched,0);});
