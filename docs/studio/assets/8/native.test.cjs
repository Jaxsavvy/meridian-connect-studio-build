const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {NativeRunner,hashFile}=require('../../../../src/studio-assets/native-runner');
const {inspectPng,crc32}=require('../../../../src/studio-assets/png');
const {syntheticPng}=require('./upscayl-smoke.cjs');
test('PNG decoder verifies pixels, CRC, complete decompression and rejects damaged data',()=>{
  const png=syntheticPng();assert.equal(inspectPng(png).pixels,1024);const bad=Buffer.from(png);bad[20]^=1;
  assert.throws(()=>inspectPng(bad),{code:'CORRUPT_MEDIA'});assert.throws(()=>inspectPng(png.subarray(0,png.length-1)),{code:'CORRUPT_MEDIA'});
  assert.throws(()=>inspectPng(png,{maxPixels:1}),{code:'CORRUPT_MEDIA'});assert.throws(()=>inspectPng(Buffer.concat([png,Buffer.from([0])])),{code:'CORRUPT_MEDIA'});
  assert.equal(crc32(Buffer.from('123456789')),0xcbf43926);
});
test('native artifact verification rejects tampered model and missing file',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'studio-native-test-'));t.after(async()=>{if(path.dirname(root)===os.tmpdir()&&path.basename(root).startsWith('studio-native-test-'))await fs.rm(root,{recursive:true,force:true});});
  const executable=path.join(root,'not-executable.txt'),model=path.join(root,'synthetic.bin'),modelParam=path.join(root,'synthetic.param');for(const file of [executable,model,modelParam])await fs.writeFile(file,'synthetic only');
  const artifacts={executable,model,modelParam,executableSha256:await hashFile(executable),modelSha256:await hashFile(model),modelParamSha256:await hashFile(modelParam),modelName:'synthetic',scale:4};
  const runner=new NativeRunner({artifacts,jobRoot:root});await runner.verify();assert.equal(runner.isolation,'process-scoped');await fs.writeFile(model,'tampered');await assert.rejects(runner.verify(),{code:'PIN_MISMATCH'});
  const missing=new NativeRunner({artifacts:{...artifacts,executable:path.join(root,'missing.exe')},jobRoot:root});await assert.rejects(missing.verify(),{code:'MISSING_FILE'});
  const abort=new AbortController();abort.abort();await assert.rejects(runner.run({signal:abort.signal}),{code:'CANCELLED'});assert.equal(runner.active,false);
});
