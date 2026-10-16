// Real CLI failure/cancellation checks. Requires the externally staged pinned bundle.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {NativeRunner,hashFile}=require('../../../../src/studio-assets/native-runner');const {syntheticPng}=require('./upscayl-smoke.cjs');
async function main(){
  const stage=path.join(os.tmpdir(),'meridian-dev005-upscayl-20251207'),jobRoot=path.join(stage,'jobs');await fs.mkdir(jobRoot,{recursive:true});
  const executable=path.join(stage,'cli','upscayl-bin-20251207-174704-windows','upscayl-bin.exe');
  const artifacts={executable,executableSha256:'294d31be8f29d047c0d91a8dcd5e739616ece56bce3188ac688f9a52d70abe60',model:path.join(stage,'models','upscayl-lite-4x.bin'),modelSha256:'85ee266b632a765a725425ba6a5620c088c8aa2939a03063b2d83b3462724cc1',modelParam:path.join(stage,'models','upscayl-lite-4x.param'),modelParamSha256:'22174924330297357434ad21ed0af7f4b820008d2a502b492754d130d4142714',modelName:'upscayl-lite-4x',scale:4};
  const runner=new NativeRunner({artifacts,jobRoot,timeoutMs:60000});const job=await fs.mkdtemp(path.join(jobRoot,'cancel-')),inputPath=path.join(job,'input.png'),outputPath=path.join(job,'output.png');await fs.writeFile(inputPath,syntheticPng());const before=await hashFile(inputPath);
  const abort=new AbortController();const started=Date.now();const cancelled=runner.run({executable,model:artifacts.model,inputPath,outputPath,signal:abort.signal});const timer=setTimeout(()=>abort.abort(),300);
  let termination;await assert.rejects(cancelled,error=>{assert.equal(error.code,'CANCELLED');assert.equal(error.launched,true);termination=error.termination;return true;});const cancelElapsedMs=Date.now()-started;clearTimeout(timer);assert.equal(await hashFile(inputPath),before);assert.equal(runner.active,false);
  let exists=true;try{await fs.stat(outputPath);}catch{exists=false;}
  assert.equal(exists,false);const corruptJob=await fs.mkdtemp(path.join(jobRoot,'corrupt-')),corruptInput=path.join(corruptJob,'input.png'),corruptOutput=path.join(corruptJob,'output.png');await fs.writeFile(corruptInput,'synthetic corrupt bytes');
  let corruptExitCode=null;await assert.rejects(runner.run({executable,model:artifacts.model,inputPath:corruptInput,outputPath:corruptOutput}),error=>{assert.equal(error.code,'OUTPUT_MISSING');corruptExitCode=error.exitCode;return true;});
  const missingJob=await fs.mkdtemp(path.join(jobRoot,'missing-'));await assert.rejects(runner.run({executable,model:artifacts.model,inputPath:path.join(missingJob,'input.png'),outputPath:path.join(missingJob,'output.png')}),{code:'MISSING_FILE'});
  const wrong=new NativeRunner({artifacts:{...artifacts,modelSha256:'0'.repeat(64)},jobRoot});await assert.rejects(wrong.verify(),{code:'PIN_MISMATCH'});
  const timeoutJob=await fs.mkdtemp(path.join(jobRoot,'timeout-')),timeoutInput=path.join(timeoutJob,'input.png'),timeoutOutput=path.join(timeoutJob,'output.png');await fs.writeFile(timeoutInput,syntheticPng());
  const shortRunner=new NativeRunner({artifacts,jobRoot,timeoutMs:100});await assert.rejects(shortRunner.run({executable,model:artifacts.model,inputPath:timeoutInput,outputPath:timeoutOutput}),{code:'PROCESS_TIMEOUT',launched:true});
  await assert.rejects(fs.stat(timeoutOutput),{code:'ENOENT'});assert.equal(await hashFile(timeoutInput),before);
  console.log(JSON.stringify({cancelled:true,cancelElapsedMs,termination,originalPreserved:true,partialOutputExists:exists,corruptExitCode,zeroExitWithoutOutputRejected:true,missingInputRejected:true,wrongPinRejected:true,realTimeoutRejected:true,isolation:runner.isolation}));
}
main().catch(e=>{console.error(JSON.stringify({code:e.code,message:e.message,actual:e.actual,expected:e.expected}));process.exitCode=1;});
