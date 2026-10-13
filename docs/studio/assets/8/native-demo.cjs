// Explicit local synthetic fixture host: only seeded PNGs/derivatives; import denied.
// Not an authoritative backend, approved Electron bridge, or OS-isolated worker.
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {SyntheticService}=require('../../../../src/renderer/studio-assets/synthetic-service');const {NativeRunner,hashFile}=require('../../../../src/studio-assets/native-runner');const {inspectPng}=require('../../../../src/studio-assets/png');const {syntheticPng}=require('./upscayl-smoke.cjs');
const repo=path.resolve(__dirname,'../../../..'),stage=path.join(os.tmpdir(),'meridian-dev005-upscayl-20251207'),jobRoot=path.join(stage,'jobs');
const artifacts={executable:path.join(stage,'cli','upscayl-bin-20251207-174704-windows','upscayl-bin.exe'),executableSha256:'294d31be8f29d047c0d91a8dcd5e739616ece56bce3188ac688f9a52d70abe60',model:path.join(stage,'models','upscayl-lite-4x.bin'),modelSha256:'85ee266b632a765a725425ba6a5620c088c8aa2939a03063b2d83b3462724cc1',modelParam:path.join(stage,'models','upscayl-lite-4x.param'),modelParamSha256:'22174924330297357434ad21ed0af7f4b820008d2a502b492754d130d4142714',modelName:'upscayl-lite-4x',scale:4};
const service=new SyntheticService({projects:['synthetic-A','synthetic-B']});const runner=new NativeRunner({artifacts,jobRoot});const files=new Map([['/','docs/studio/assets/8/native-demo.html'],['/native-bootstrap.js','docs/studio/assets/8/native-bootstrap.js'],...['model.js','service-adapter.js','controller.js','view.js','view.css'].map(name=>['/src/renderer/studio-assets/'+name,'src/renderer/studio-assets/'+name])]);
function reply(res,status,data){if(res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function enhance(p,signal){
  service.authorize(p.projectId,signal);const asset=service.record(p.projectId,p.assetId);if(asset.originalVersionId!==p.originalVersionId)throw Object.assign(new Error('INVALID_LINEAGE'),{code:'INVALID_LINEAGE'});
  const source=await service.download({projectId:p.projectId,assetId:p.assetId,versionId:p.parentVersionId,signal});const info=inspectPng(source.bytes,{maxPixels:4096});
  if(info.width>64||info.height>64)throw Object.assign(new Error('SYNTHETIC_LIMIT'),{code:'SYNTHETIC_LIMIT'});const job=await fs.mkdtemp(path.join(jobRoot,'fixture-')),inputPath=path.join(job,'input.png'),outputPath=path.join(job,'output.png');
  try {await fs.writeFile(inputPath,source.bytes,{flag:'wx'});const originalHash=await hashFile(inputPath);const result=await runner.run({executable:artifacts.executable,model:artifacts.model,inputPath,outputPath,signal});if(result.exitCode!==0)throw Object.assign(new Error('PROCESS_FAILED'),{code:'PROCESS_FAILED'});
    const bytes=await fs.readFile(outputPath);const outputInfo=inspectPng(bytes);if(outputInfo.width!==info.width*4||outputInfo.height!==info.height*4||await hashFile(inputPath)!==originalHash)throw Object.assign(new Error('INVALID_OUTPUT'),{code:'INVALID_OUTPUT'});
    return await service.import({projectId:p.projectId,assetId:p.assetId,parentVersionId:p.parentVersionId,filename:'synthetic-grid-4x.png',mediaType:'image/png',bytes,operation:'upscale',idempotencyKey:p.jobId,signal});
  }finally{if(path.dirname(job)===jobRoot&&path.basename(job).startsWith('fixture-'))await fs.rm(job,{recursive:true,force:true});}
}
async function main(){await fs.mkdir(jobRoot,{recursive:true});await runner.verify();await service.import({projectId:'synthetic-A',filename:'synthetic-grid.png',mediaType:'image/png',bytes:syntheticPng(),idempotencyKey:'fixture-original'});
  http.createServer(async(req,res)=>{
    if(req.method==='GET'&&files.has(req.url)){const target=files.get(req.url);res.writeHead(200,{'Content-Type':target.endsWith('.html')?'text/html; charset=utf-8':target.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-store'});res.end(await fs.readFile(path.join(repo,target)));return;}
    if(req.method!=='POST'||req.url!=='/fixture'){res.writeHead(404);res.end();return;}
    if(req.headers.origin&&req.headers.origin!=='http://127.0.0.1:8769'){reply(res,403,{code:'ORIGIN_DENIED'});return;}
    const abort=new AbortController();res.once('close',()=>{if(!res.writableEnded)abort.abort();});let length=0;const chunks=[];
    try {for await(const chunk of req){length+=chunk.length;if(length>65536)throw Object.assign(new Error('TOO_LARGE'),{code:'TOO_LARGE'});chunks.push(chunk);}const {operation,payload}=JSON.parse(Buffer.concat(chunks).toString());const p={...payload,signal:abort.signal};let result;
      switch(operation){case 'asset.list':result=await service.list(p);break;case 'asset.metadata':result=await service.metadata(p);break;case 'asset.submit-review':result=await service.review(p);break;case 'asset.download':{const data=await service.download(p);result={filename:data.filename,mediaType:data.mediaType,sha256:data.sha256,base64:Buffer.from(data.bytes).toString('base64')};break;}case 'asset.enhance':result=await enhance(p,abort.signal);break;default:throw Object.assign(new Error('OPERATION_DENIED'),{code:'OPERATION_DENIED'});}
      reply(res,200,result);
    }catch(error){reply(res,400,{code:['PROJECT_DENIED','NOT_FOUND','INVALID_LINEAGE','SYNTHETIC_LIMIT','WORKER_BUSY','CANCELLED','PROCESS_FAILED','OUTPUT_MISSING','INVALID_OUTPUT','REVISION_CONFLICT','TOO_LARGE','OPERATION_DENIED'].includes(error.code)?error.code:'FIXTURE_FAILED'});}
  }).listen(8769,'127.0.0.1',()=>console.log('Synthetic-only native CLI preview http://127.0.0.1:8769/; external artifacts verified; no arbitrary imports accepted.'));
}
main().catch(error=>{console.error(error.code||'FIXTURE_START_FAILED');process.exitCode=1;});
