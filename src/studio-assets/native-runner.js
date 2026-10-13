'use strict';
const fs=require('node:fs/promises');const path=require('node:path');const {createReadStream}=require('node:fs');const crypto=require('node:crypto');const {spawn}=require('node:child_process');
const {inspectPng}=require('./png');
function fail(code){const e=new Error(code);e.code=code;throw e;}
async function hashFile(file){const hash=crypto.createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
class NativeRunner {
  constructor({artifacts,jobRoot,timeoutMs=300000,maxLogBytes=65536}) {
    if(!artifacts || !path.isAbsolute(jobRoot) || !Number.isSafeInteger(timeoutMs) || timeoutMs<1 || !Number.isSafeInteger(maxLogBytes) || maxLogBytes<1)fail('INVALID_RUNNER');
    this.artifacts=Object.freeze({...artifacts});this.jobRoot=jobRoot;this.timeoutMs=timeoutMs;this.maxLogBytes=maxLogBytes;
    // Scoped process controls are NOT an OS sandbox. Host integration stays fail-closed.
    this.isolation='process-scoped';this.active=false;
  }
  async verify() {
    const a=this.artifacts;
    if(!/^[a-zA-Z0-9_-]+$/.test(a.modelName) || ![2,3,4].includes(a.scale))fail('INVALID_RUNNER');
    for(const [file,hash] of [[a.executable,a.executableSha256],[a.model,a.modelSha256],[a.modelParam,a.modelParamSha256]]){
      if(!path.isAbsolute(file)||!/^[0-9a-f]{64}$/.test(hash))fail('INVALID_RUNNER');let stat;try{stat=await fs.lstat(file);}catch{fail('MISSING_FILE');}
      if(!stat.isFile() || stat.isSymbolicLink() || await hashFile(file)!==hash)fail('PIN_MISMATCH');
    }
    if(path.dirname(a.model)!==path.dirname(a.modelParam)||path.basename(a.model)!==a.modelName+'.bin'||path.basename(a.modelParam)!==a.modelName+'.param')fail('MODEL_MISMATCH');
  }
  async run({executable,model,inputPath,outputPath,signal}) {
    if(this.active)fail('WORKER_BUSY');this.active=true;
    try {
      if(signal?.aborted)fail('CANCELLED');await this.verify();const a=this.artifacts;
      if(executable!==a.executable || model!==a.model)fail('PIN_MISMATCH');
      if((await fs.lstat(this.jobRoot)).isSymbolicLink()||(await fs.lstat(path.dirname(inputPath))).isSymbolicLink())fail('UNSAFE_PATH');
      const root=await fs.realpath(this.jobRoot),dir=await fs.realpath(path.dirname(inputPath));
      if(dir===root||!dir.startsWith(root+path.sep)||path.dirname(outputPath)!==path.dirname(inputPath)||path.basename(inputPath)!=='input.png'||path.basename(outputPath)!=='output.png')fail('UNSAFE_PATH');
      let inputStat;try{inputStat=await fs.lstat(inputPath);}catch{fail('MISSING_FILE');}
      if(!inputStat.isFile()||inputStat.isSymbolicLink()||path.resolve(inputPath)!==path.join(dir,'input.png')||await fs.realpath(inputPath)!==path.join(dir,'input.png'))fail('UNSAFE_PATH');
      try{await fs.lstat(outputPath);fail('OUTPUT_EXISTS');}catch(e){if(e.code!=='ENOENT')throw e;}
      if(signal?.aborted)fail('CANCELLED');
      const args=['-i',inputPath,'-o',outputPath,'-m',path.dirname(a.model),'-n',a.modelName,'-z',String(a.scale),'-s',String(a.scale),'-t','32','-j','1:1:1','-f','png'];
      const environment={SYSTEMROOT:process.env.SYSTEMROOT||process.env.SystemRoot,WINDIR:process.env.WINDIR,PATH:process.env.SYSTEMROOT?path.join(process.env.SYSTEMROOT,'System32'):'',TEMP:dir,TMP:dir};
      return await new Promise((resolve,reject)=>{
        const child=spawn(a.executable,args,{cwd:dir,env:environment,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
        let timer,stopper,stopped=false,timedOut=false,log='',logBytes=0,launchError=null,termination=null;
        const capture=chunk=>{const remaining=this.maxLogBytes-logBytes;if(remaining>0){const piece=chunk.subarray(0,remaining);log+=piece.toString('utf8');logBytes+=piece.length;}};
        child.stdout.on('data',capture);child.stderr.on('data',capture);
        const stop=()=>{
          if(stopped)return;stopped=true;
          if(process.platform==='win32'&&child.pid){stopper=new Promise(done=>{const killer=spawn(path.join(process.env.SYSTEMROOT||process.env.SystemRoot,'System32','taskkill.exe'),['/PID',String(child.pid),'/T','/F'],{windowsHide:true,shell:false,stdio:'ignore'});killer.once('error',()=>{termination=child.kill()?'direct-child-kill':'already-exited';done();});killer.once('close',code=>{termination=code===0?'tree-kill-requested':child.kill()?'direct-child-kill':'already-exited';done();});});}
          else termination=child.kill('SIGKILL')?'direct-child-kill':'already-exited';
        };
        const abort=()=>stop();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)stop();
        timer=setTimeout(()=>{timedOut=true;stop();},this.timeoutMs);
        child.once('error',e=>{launchError=e;});
        child.once('close',async code=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(stopper)await stopper;
          if(launchError){reject(Object.assign(new Error('PROCESS_START_FAILED'),{code:'PROCESS_START_FAILED'}));return;}
          if(stopped){
            try {await fs.rm(outputPath,{force:true});}catch {reject(Object.assign(new Error('CLEANUP_FAILED'),{code:'CLEANUP_FAILED',launched:true}));return;}
            reject(Object.assign(new Error(timedOut?'PROCESS_TIMEOUT':'CANCELLED'),{code:timedOut?'PROCESS_TIMEOUT':'CANCELLED',launched:true,termination}));return;
          }
          let image=null;
          if(code===0) {
            try {
              let stat;try{stat=await fs.lstat(outputPath);}catch{fail('OUTPUT_MISSING');}
              if(!stat.isFile()||stat.isSymbolicLink()||!stat.size||stat.size>128*1024*1024)fail('OUTPUT_LIMIT');
              image=inspectPng(await fs.readFile(outputPath));
            } catch(error) {reject(Object.assign(new Error(error.code||'INVALID_OUTPUT'),{code:error.code||'INVALID_OUTPUT',exitCode:code}));return;}
          }
          resolve({exitCode:code,log,logTruncated:logBytes>=this.maxLogBytes,image});
        });
      });
    } finally {this.active=false;}
  }
}
module.exports={NativeRunner,hashFile};
