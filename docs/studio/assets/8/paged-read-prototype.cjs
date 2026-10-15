// Unmounted DEV-005 state prototype. Inject reviewed v1 parsing/transport; no IPC or network here.
const Model=require('../../../../src/renderer/studio-assets/model');
class PagedRead {
 constructor({search,get,parsePage,mapAsset}){this.io={search,get,parsePage,mapAsset};this.generation=0;this.projectId=null;this.reset();}
 reset(){this.generation++;this.items=[];this.records=new Map();this.nextCursor=null;this.complete=false;this.filters={};this.error=null;this.pending=false;this.used=new Set();}
 selectProject(id){this.reset();this.projectId=id;}
 snapshot(){return structuredClone({projectId:this.projectId,items:this.items,records:[...this.records.values()],nextCursor:this.nextCursor,complete:this.complete,error:this.error,pending:this.pending});}
 async search(filters={}){this.generation++;this.items=[];this.nextCursor=null;this.complete=false;this.used.clear();this.filters=structuredClone(filters);return this.page(null);}
 async more(){if(this.pending||this.complete||!this.nextCursor)return false;return this.page(this.nextCursor);}
 async page(cursor){
  if(!this.projectId)throw Error('NO_PROJECT');const generation=this.generation,projectId=this.projectId;this.pending=true;this.error=null;
  try{
   const response=await this.io.search({...this.filters,projectId,cursor,limit:50});if(generation!==this.generation)return false;
   const page=this.io.parsePage(response,projectId,50);
   const ids=new Set(this.items.map(a=>a.assetId));
   if(page.items.some(a=>ids.has(a.assetId)) || (page.nextCursor && (page.nextCursor===cursor||this.used.has(page.nextCursor))))throw Object.assign(Error('PAGE_CONFLICT'),{code:'PAGE_CONFLICT'});
   // Commit only after the whole page is accepted. Missing summaries never remove exact records.
   this.items.push(...structuredClone(page.items));if(cursor)this.used.add(cursor);this.nextCursor=page.nextCursor;this.complete=page.complete;return true;
  }catch(error){if(generation===this.generation)this.error=error.code||'REQUEST_FAILED';return false;}
  finally{if(generation===this.generation)this.pending=false;}
 }
 async hydrate(assetId){const generation=this.generation,projectId=this.projectId;if(!projectId)throw Error('NO_PROJECT');
  try{const response=await this.io.get({projectId,assetId});if(generation!==this.generation)return null;const asset=Model.validate(this.io.mapAsset(response,projectId,assetId),projectId);if(asset.id!==assetId)Model.fail('INVALID_RESPONSE');const prior=this.records.get(assetId);if(!prior||prior.revision<=asset.revision)this.records.set(assetId,asset);return structuredClone(this.records.get(assetId));}
  catch(error){if(generation===this.generation)this.error=error.code||'REQUEST_FAILED';return null;}
 }
 clear(){this.reset();this.projectId=null;}
}
module.exports={PagedRead};

