// Synthetic fixture host only. No Connect authentication or live backend.
const service=new StudioAssetService.ServiceAdapter({mode:'synthetic',request:async(operation,payload,{signal}={})=>{
  const response=await fetch('/fixture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation,payload}),signal});
  const result=await response.json();if(!response.ok)throw Object.assign(new Error(result.code),{code:result.code});
  if(operation==='asset.download')result.bytes=Uint8Array.from(atob(result.base64),c=>c.charCodeAt(0));return result;
}});
const controller=new StudioAssetController.Controller({service,projects:[{id:'synthetic-A',name:'Synthetic PNG project A'},{id:'synthetic-B',name:'Synthetic empty project B'}]});
StudioAssetView.mount(document.getElementById('assets'),controller,{allowImport:false,bannerText:'SYNTHETIC-ONLY TEST — real pinned Upscayl CLI; memory records; process-scoped controls; no production integration.',enhance:async intent=>{
  intent.onState('running');await service.call('asset.enhance',{projectId:intent.projectId,assetId:intent.assetId,parentVersionId:intent.parentVersionId,originalVersionId:intent.originalVersionId,jobId:crypto.randomUUID(),signal:intent.signal});intent.onState('succeeded');
}});
