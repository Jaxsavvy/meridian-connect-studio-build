// Explicit synthetic-only CLI check; no Connect IPC/backend and no OS-isolation claim.
const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');const zlib=require('node:zlib');
const {NativeRunner,hashFile}=require('../../../../src/studio-assets/native-runner');
const {inspectPng,crc32}=require('../../../../src/studio-assets/png');
const {SyntheticService}=require('../../../../src/renderer/studio-assets/synthetic-service');
function chunk(type,data){const name=Buffer.from(type),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([size,name,data,crc]);}
function syntheticPng(){const width=32,height=32,header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;const rows=Buffer.alloc(height*(width*3+1));for(let y=0;y<height;y++)for(let x=0;x<width;x++){const offset=y*(width*3+1)+1+x*3;rows[offset]=x<16?20:220;rows[offset+1]=y<16?60:200;rows[offset+2]=180;}return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);}
async function main(){
  const stage=path.join(os.tmpdir(),'meridian-dev005-upscayl-20251207');const exe=path.join(stage,'cli','upscayl-bin-20251207-174704-windows','upscayl-bin.exe');const jobRoot=path.join(stage,'jobs');await fs.mkdir(jobRoot,{recursive:true});const job=await fs.mkdtemp(path.join(jobRoot,'synthetic-'));
  const artifacts={executable:exe,executableSha256:'294d31be8f29d047c0d91a8dcd5e739616ece56bce3188ac688f9a52d70abe60',model:path.join(stage,'models','upscayl-lite-4x.bin'),modelSha256:'85ee266b632a765a725425ba6a5620c088c8aa2939a03063b2d83b3462724cc1',modelParam:path.join(stage,'models','upscayl-lite-4x.param'),modelParamSha256:'22174924330297357434ad21ed0af7f4b820008d2a502b492754d130d4142714',modelName:'upscayl-lite-4x',scale:4};
  const runner=new NativeRunner({artifacts,jobRoot,timeoutMs:60000});const inputPath=path.join(job,'input.png'),outputPath=path.join(job,'output.png');const input=syntheticPng();await fs.writeFile(inputPath,input,{flag:'wx'});const originalHash=await hashFile(inputPath);
  const service=new SyntheticService({projects:['synthetic-A']});const original=await service.import({projectId:'synthetic-A',filename:'synthetic-grid.png',mediaType:'image/png',bytes:input,idempotencyKey:'original'});
  const started=Date.now();const result=await runner.run({executable:exe,model:artifacts.model,inputPath,outputPath});
  if(result.exitCode!==0)throw Object.assign(new Error('PROCESS_FAILED'),{code:'PROCESS_FAILED',diagnostic:result.log.replaceAll(stage,'<external-stage>')});
  const output=await fs.readFile(outputPath),inputInfo=inspectPng(input),outputInfo=inspectPng(output);if(outputInfo.width!==128||outputInfo.height!==128||await hashFile(inputPath)!==originalHash)throw new Error('INVALID_OUTPUT_OR_ORIGINAL_CHANGED');
  const registration={projectId:'synthetic-A',assetId:original.id,parentVersionId:original.originalVersionId,filename:'synthetic-grid-4x.png',mediaType:'image/png',bytes:output,operation:'upscale',idempotencyKey:'real-smoke-job'};const derivative=await service.import(registration),retry=await service.import(registration);
  if(derivative.versions.length!==2||retry.versions.length!==2||derivative.preferredVersionId!==retry.preferredVersionId)throw new Error('DUPLICATE_VERSION');
  const evidence={release:'20251207-174704',model:'upscayl-lite-4x',modelSourceCommit:'4f39acfc6f88260d105920a64deff8431d5e1544',isolation:runner.isolation,elapsedMs:Date.now()-started,exitCode:result.exitCode,input:inputInfo,output:outputInfo,inputSha256:originalHash,outputSha256:await hashFile(outputPath),originalPreserved:true,derivativeVersions:derivative.versions.length,idempotentRetry:true,diagnostic:result.log.replaceAll(stage,'<external-stage>').slice(-3000)};
  await fs.writeFile(path.join(stage,'smoke-evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));console.log('Input/output retained outside Git in temporary synthetic staging.');
}
if(require.main===module)main().catch(e=>{console.error(JSON.stringify({code:e.code||'SMOKE_FAILED',diagnostic:e.diagnostic||e.message}));process.exitCode=1;});
module.exports={syntheticPng};
