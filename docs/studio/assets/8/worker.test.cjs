const test=require('node:test'); const assert=require('node:assert/strict'); const fs=require('node:fs/promises'); const os=require('node:os'); const path=require('node:path');
const {UpscaleWorker,sha256}=require('../../../../src/studio-assets/upscale-worker');
async function fixture(t, overrides={}) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'studio-synthetic-test-'));
  t.after(async()=> { if(path.dirname(root)===os.tmpdir() && path.basename(root).startsWith('studio-synthetic-test-')) await fs.rm(root,{recursive:true,force:true}); });
  const executable=path.join(root,'synthetic-executable.txt'),model=path.join(root,'synthetic-model.txt');await fs.writeFile(executable,'not executable');await fs.writeFile(model,'not a model');
  let calls=0; const records=[];
  const worker=new UpscaleWorker({root,manifest:{approval:'owner-approved',licenseReview:'synthetic test only',deviceVerified:true,executable,model,executableSha256:sha256(Buffer.from('not executable')),modelSha256:sha256(Buffer.from('not a model'))},
    runner:{isolation:'os-enforced',run:async ({outputPath})=>{await fs.writeFile(outputPath,new Uint8Array([2,3,4]));return {exitCode:0};}},
    validateImage:async bytes=> {if(bytes[0]===0)throw Object.assign(new Error('invalid'),{code:'CORRUPT_MEDIA'});return {pixels:10};},
    authorize:async()=>{calls++;},register:async record=>{records.push(record);return {id:'synthetic-v2'};},...overrides});
  const job={projectId:'A',assetId:'asset',parentVersionId:'v1',originalVersionId:'v1',jobId:'job1',input:new Uint8Array([1,2,3])};
  return {worker,job,records,root,get calls(){return calls;}};
}
test('mock worker records separate derivative and cleans only job scratch',async t=>{
  const f=await fixture(t);const original=new Uint8Array(f.job.input); const r=await f.worker.run(f.job);
  assert.equal(r.version.id,'synthetic-v2');assert.deepEqual(f.job.input,original);assert.equal(f.calls,2);
  assert.equal(f.records[0].parentVersionId,'v1');assert.equal(f.records[0].idempotencyKey,'job1');assert.equal(f.records[0].operation,'upscale');
  assert.deepEqual((await fs.readdir(f.root)).sort(),['synthetic-executable.txt','synthetic-model.txt']);
});
test('missing approval and pin mismatch fail before runner',async t=>{
  const f=await fixture(t);f.worker.manifest.approval='pending';await assert.rejects(f.worker.run(f.job),{code:'PREREQUISITES_PENDING'});
  f.worker.manifest.approval='owner-approved';f.worker.manifest.modelSha256='wrong';await assert.rejects(f.worker.run(f.job),{code:'PIN_MISMATCH'});assert.equal(f.records.length,0);
});
test('runner nonzero exit, corrupt output and original modification never register',async t=>{
  const f=await fixture(t);f.worker.runner.run=async()=>({exitCode:1});await assert.rejects(f.worker.run(f.job),{code:'PROCESS_FAILED'});
  f.worker.runner.run=async({outputPath})=>{await fs.writeFile(outputPath,new Uint8Array([0]));return {exitCode:0};};await assert.rejects(f.worker.run(f.job),{code:'CORRUPT_MEDIA'});
  f.worker.runner.run=async({inputPath,outputPath})=>{await fs.chmod(inputPath,0o600);await fs.writeFile(inputPath,'modified');await fs.writeFile(outputPath,new Uint8Array([2]));return {exitCode:0};};
  await assert.rejects(f.worker.run(f.job),{code:'ORIGINAL_CHANGED'});assert.equal(f.records.length,0);
});
test('timeout aborts injected runner and leaves no version',async t=>{
  const f=await fixture(t,{timeoutMs:5});f.worker.runner.run=({signal})=>new Promise(resolve=>signal.addEventListener('abort',()=>resolve({exitCode:1}),{once:true}));
  await assert.rejects(f.worker.run(f.job),{code:'CANCELLED'});assert.equal(f.records.length,0);assert.equal(f.worker.active,false);
});
test('revoked authorization at final registration gate denies output',async t=>{
  let checks=0;const f=await fixture(t,{authorize:async()=>{if(++checks===2)throw Object.assign(new Error('deny'),{code:'PROJECT_DENIED'});}});
  await assert.rejects(f.worker.run(f.job),{code:'PROJECT_DENIED'});assert.equal(f.records.length,0);
});
test('limits, unsafe identity, missing output and registration failure remain terminal failures',async t=>{
  const f=await fixture(t);await assert.rejects(f.worker.run({...f.job,jobId:'../bad'}),{code:'INVALID_JOB'});
  f.worker.maxInputBytes=1;await assert.rejects(f.worker.run(f.job),{code:'TOO_LARGE'});f.worker.maxInputBytes=100;
  f.worker.runner.run=async()=>({exitCode:0});await assert.rejects(f.worker.run(f.job));
  f.worker.runner.run=async({outputPath})=>{await fs.writeFile(outputPath,new Uint8Array([2]));return {exitCode:0};};
  f.worker.register=async()=>{throw Object.assign(new Error('storage'),{code:'STORAGE_FAILED'});};await assert.rejects(f.worker.run(f.job),{code:'STORAGE_FAILED'});
});
test('invalid decoder dimensions are rejected before invocation',async t=>{
  const f=await fixture(t,{validateImage:async()=>({})});let ran=false;f.worker.runner.run=async()=>{ran=true;return {exitCode:0};};
  await assert.rejects(f.worker.run(f.job),{code:'CORRUPT_MEDIA'});assert.equal(ran,false);assert.equal(f.records.length,0);
});
