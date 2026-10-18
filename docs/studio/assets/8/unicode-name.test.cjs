const test=require('node:test');const assert=require('node:assert/strict');
const M=require('../../../../src/renderer/studio-assets/model');
const {SyntheticService}=require('../../../../src/renderer/studio-assets/synthetic-service');
const {Controller}=require('../../../../src/renderer/studio-assets/controller');
const expanding='\u0344';const accepted=expanding.repeat(80);const rejected=expanding.repeat(160);
const input=(filename='synthetic.txt',key='seed')=>({projectId:'A',filename,mediaType:'text/plain',bytes:new TextEncoder().encode('synthetic name boundary'),idempotencyKey:key});

test('text enforces submitted and final NFC UTF-16 limits without truncation',()=>{
 assert.equal(rejected.length,160);assert.equal(rejected.normalize('NFC').length,320);
 assert.throws(()=>M.text(rejected),{code:'INVALID_TEXT'});
 assert.equal(M.text(accepted),accepted.normalize('NFC'));assert.equal(M.text(accepted).length,160);
 assert.equal(M.text('n'.repeat(160)),'n'.repeat(160));assert.throws(()=>M.text('n'.repeat(161)),{code:'INVALID_TEXT'});
 assert.equal(M.text('😀'.repeat(80)),'😀'.repeat(80));assert.throws(()=>M.text('😀'.repeat(81)),{code:'INVALID_TEXT'});
 assert.equal(M.text('e\u0301'.repeat(80)),'é'.repeat(80));assert.throws(()=>M.text('e\u0301'.repeat(81)),{code:'INVALID_TEXT'});
 assert.equal(M.text('  Cafe\u0301  '),'Café');assert.throws(()=>M.text(' '.repeat(160)+'x'),{code:'INVALID_TEXT'});
 assert.equal(M.text(expanding.repeat(32),64).length,64);assert.throws(()=>M.text(expanding.repeat(33),64),{code:'INVALID_TEXT'});
});
test('model validation rejects expanded display or original names without changing its input',async()=>{
 const s=new SyntheticService({projects:['A']});const asset=await s.import(input());
 for(const field of ['name','originalFilename']){const bad=structuredClone(asset);bad[field]=rejected;const snapshot=structuredClone(bad);assert.throws(()=>M.validate(bad,'A'),{code:'INVALID_TEXT'});assert.deepEqual(bad,snapshot);const good=structuredClone(asset);good[field]=accepted;assert.equal(M.validate(good,'A')[field],accepted);}
});
test('import rejects expanding original filenames and preserves accepted original spelling and bytes',async()=>{
 const s=new SyntheticService({projects:['A']});await assert.rejects(s.import(input(rejected,'bad')),{code:'INVALID_TEXT'});assert.equal((await s.list({projectId:'A'})).length,0);
 const asset=await s.import(input(accepted));assert.equal(asset.originalFilename,accepted);assert.equal(asset.versions[0].originalFilename,accepted);
 const bytes=await s.download({projectId:'A',assetId:asset.id,versionId:asset.originalVersionId});assert.equal(new TextDecoder().decode(bytes.bytes),'synthetic name boundary');
 await assert.rejects(s.import(input('😀'.repeat(81),'emoji-bad')),{code:'INVALID_TEXT'});const emoji=await s.import(input('😀'.repeat(80),'emoji-good'));assert.equal(emoji.originalFilename.length,160);
});
test('metadata rejects expanded names atomically and accepted names export with the exact suffix',async()=>{
 const s=new SyntheticService({projects:['A']});const asset=await s.import(input());const patch={projectId:'A',assetId:asset.id,revision:asset.revision,name:rejected,tags:[],description:'',section:'Files'};
 await assert.rejects(s.metadata(patch),{code:'INVALID_TEXT'});assert.deepEqual((await s.list({projectId:'A'}))[0],asset);
 const saved=await s.metadata({...patch,name:accepted});assert.equal(saved.name,accepted.normalize('NFC'));assert.equal(saved.originalFilename,asset.originalFilename);assert.deepEqual(saved.versions,asset.versions);
 const c=new Controller({service:s,projects:[{id:'A'}]});await c.selectProject('A');const originalDownload=s.download.bind(s);s.download=async request=>({...await originalDownload(request),filename:'../transport-picked.exe'});
 const result=await c.download({assetId:asset.id,versionId:asset.originalVersionId});assert.equal(result.filename,saved.name+'__v1.txt');assert.equal(result.filename.length,168);assert.equal(result.sha256,asset.versions[0].sha256);
});
test('safe export naming rejects expansion and retains valid normalized stems and version suffixes',()=>{
 assert.throws(()=>M.safeName(rejected),{code:'INVALID_TEXT'});assert.throws(()=>M.exportName({name:rejected},{sequence:1,mediaType:'image/png'}),{code:'INVALID_TEXT'});
 assert.equal(M.safeName(accepted),accepted.normalize('NFC'));assert.equal(M.exportName({name:accepted},{sequence:12,mediaType:'image/png'}),accepted.normalize('NFC')+'__v12.png');
 assert.equal(M.exportName({name:'e\u0301'.repeat(80)},{sequence:2,mediaType:'text/plain'}),'é'.repeat(80)+'__v2.txt');assert.equal(M.safeName('CON.txt'),'_CON.txt');
});
