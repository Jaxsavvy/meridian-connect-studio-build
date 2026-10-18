'use strict';
// Synthetic, bounded measurements. No service calls or application database.
const fs=require('node:fs'),{performance}=require('node:perf_hooks');
const W=require('../../src/renderer/studio-ui/website-builder.js');
const output=process.env.MERIDIAN_PERFORMANCE_EVIDENCE;
if(!output)throw Error('External performance evidence file is required');
function bytes(storage){let result=0;for(let i=0;i<storage.length;i++){const key=storage.key(i);result+=2*(key.length+storage.getItem(key).length);}return result;}
function timed(fn){const start=performance.now(),value=fn();return {ms:Math.round((performance.now()-start)*100)/100,value};}
const results=[];
for(const [label,pages,sections,bodyLength]of [['small',3,5,200],['medium',20,20,400],['large',50,100,400]]){
 global.gc?.();const before=process.memoryUsage().heapUsed;
 const storage=W.createMemoryStorage();let n=0;const c=W.createController({storage,idFactory:prefix=>prefix+'-bench-'+(++n)});
 c.selectContext({id:'synthetic-performance',name:'Synthetic performance'});c.createProject('Performance '+label);
 const project=c.snapshot().project;project.pages=Array.from({length:pages},(_,p)=>({id:'page-'+p,title:'Page '+p,slug:p?'page-'+p:'',sections:Array.from({length:sections},(_,s)=>({id:'section-'+p+'-'+s,type:s?'content':'hero',heading:'Synthetic heading '+s,body:'x'.repeat(bodyLength),action:''}))}));
 W.createRepository(storage,project.meridianProjectId).save(project);
 const open=timed(()=>c.openProject(project.id));if(!open.value)throw Error('Open failed');
 const edit=timed(()=>c.updateBrief('goal','Benchmark edit'));const save=timed(()=>c.save());if(!save.value)throw Error('Save failed');
 const preview=timed(()=>c.preview());const site=timed(()=>c.exportSite());const zip=timed(()=>c.exportArchive());if(!zip.value)throw Error('Export failed');
 const beforeCheckpoints=bytes(storage),checkpointTimes=[];let reason=null;
 for(let i=0;i<11;i++){const result=timed(()=>c.createCheckpoint('Measured '+i));checkpointTimes.push(result.ms);if(!result.value){reason=c.snapshot().error;break;}}
 const afterCheckpoints=bytes(storage);global.gc?.();
 results.push({label,pages,sectionsPerPage:sections,bodyCharacters:bodyLength,projectUTF8Bytes:Buffer.byteLength(JSON.stringify(project)),projectUTF16Units:JSON.stringify(project).length,openMs:open.ms,editMs:edit.ms,saveMs:save.ms,previewMs:preview.ms,siteMs:site.ms,zipMs:zip.ms,zipBytes:zip.value.bytes.length,previewBytes:Buffer.byteLength(preview.value),htmlBytes:Object.values(site.value.files).reduce((n,s)=>n+Buffer.byteLength(s),0),checkpointCount:c.snapshot().checkpoints.length,checkpointTimesMs:checkpointTimes,checkpointStopReason:reason,storageUTF16BytesBeforeCheckpoints:beforeCheckpoints,storageUTF16BytesAfterCheckpoints:afterCheckpoints,heapDeltaBytes:process.memoryUsage().heapUsed-before});
}
fs.writeFileSync(output,JSON.stringify({node:process.version,platform:process.platform,architecture:process.arch,gcAvailable:!!global.gc,measurement:'Single local sample per operation; informational, no performance SLA',storageLimit:'Existing checkpoint serialized history cap6MiB; website storage quota is environment dependent',results},null,2)+'\n');
console.log(JSON.stringify(results.map(({label,projectUTF8Bytes,openMs,editMs,saveMs,zipMs,checkpointCount,storageUTF16BytesAfterCheckpoints})=>({label,projectUTF8Bytes,openMs,editMs,saveMs,zipMs,checkpointCount,storageUTF16BytesAfterCheckpoints}))));
