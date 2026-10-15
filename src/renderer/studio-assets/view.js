(function (root) {
  'use strict';
  function mount(host, controller, { enhance = null, allowImport = true, bannerText = null, hostOwned = false } = {}) {
    let versionId = null; let retryKey = null; let retryFile = null; let jobAbort = null; let jobState = 'idle'; let filters = { query: '', section: '',mediaType:'',reviewState:'' }; let pendingProjectId = null;let preview=null;let renderedProjectId=null;
    const drafts = new Map(); const conflicts = new Set();let leave=null;let disposed=false;
    const element = (tag, text, attrs = {}) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; Object.assign(node, attrs); return node; };
    const button = (label, action, disabled = false) => { const node = element('button',label,{type:'button',disabled}); node.addEventListener('click', action); return node; };
    const errorText = { PROJECT_DENIED: 'Access has changed. Select another project.', OFFLINE: 'Offline. Your changes have not been saved.', REVISION_CONFLICT: 'A newer revision exists. Reload before editing.', STORAGE_FAILED: 'Storage failed. Retry the same import when available.', CANCELLED: 'Cancelled.', CORRUPT_MEDIA: 'This file cannot be accepted as that media type.',PREVIEW_FAILED:'This image could not be previewed. The original is unchanged.' };
    const reviewLabel={draft:'Draft',submitted:'Needs review',approved:'Approved','changes-requested':'Changes requested'};
    function clearPreview(){if(preview)URL.revokeObjectURL(preview.url);preview=null;}
    function settleLeave(allowed){const pending=leave;leave=null;if(pending)pending.resolve(allowed);}
    function prepareLeave(){
      if(disposed)return Promise.resolve(false);
      if(leave)return leave.promise;
      if(!drafts.size)return Promise.resolve(true);
      let resolve;const promise=new Promise(done=>resolve=done);leave={promise,resolve};render(controller.snapshot());return promise;
    }
    function switchProject(id) {
      if(jobAbort)jobAbort.abort();clearPreview();jobState='idle';drafts.clear();filters={query:'',section:'',mediaType:'',reviewState:''};versionId=null;retryKey=null;retryFile=null;pendingProjectId=null;controller.selectProject(id);
    }
    function render(state) {
      const projectId=state.project?.id || null;
      if(state.error==='REVISION_CONFLICT' && state.selectedId)conflicts.add(state.selectedId);
      if(projectId!==renderedProjectId || state.error==='PROJECT_DENIED'){
        settleLeave(false);
        if(jobAbort)jobAbort.abort();clearPreview();drafts.clear();conflicts.clear();pendingProjectId=null;versionId=null;retryKey=null;retryFile=null;jobState='idle';filters={query:'',section:'',mediaType:'',reviewState:''};renderedProjectId=projectId;
      }
      const oldFocus = document.activeElement && document.activeElement.dataset.focus;
      const busy = ['saving','loading'].includes(state.phase); host.replaceChildren(); host.classList.add('studio-assets');
      host.append(element('h1','Studio Asset Library'));
      host.append(element('p',bannerText || (state.mode === 'synthetic' ? 'SYNTHETIC DEVELOPMENT — memory only; no production service connected.' : 'Authorized service adapter'), {className:'sa-banner'}));
      const project = element('select'); project.setAttribute('aria-label','Project'); project.dataset.focus = 'project'; project.append(element('option','Select project',{value:''}));
      for (const p of controller.projects) project.append(element('option',p.name,{value:p.id})); project.value = state.project?.id || '';
      project.onchange = () => {
        if(drafts.size){pendingProjectId=project.value;render(controller.snapshot());return;}
        switchProject(project.value);
      };
      if(!hostOwned)host.append(project,button('Sign out',()=> api.signOut()));
      const status = element('p',errorText[state.error] || state.error || (state.phase==='ready' && state.notice) || ({ready:'Project assets loaded',loading:'Loading assets…',saving:'Saving…',cancelled:'Cancelled'}[state.phase] || 'Choose a project to begin'));
      status.setAttribute('role',state.error ? 'alert' : 'status'); status.setAttribute('aria-live','polite'); host.append(status);
      if(leave){
        const notice=element('section');notice.setAttribute('role','alert');notice.setAttribute('aria-label','Unsaved host transition');
        notice.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();settleLeave(false);render(controller.snapshot());host.querySelector('[data-focus="name"]')?.focus();}});
        notice.append(element('p','Unsaved asset metadata will be discarded if you leave this project.'),button('Keep editing',()=>{settleLeave(false);render(controller.snapshot());host.querySelector('[data-focus="name"]')?.focus();}),button('Discard changes and leave',()=>{drafts.clear();conflicts.clear();settleLeave(true);render(controller.snapshot());}));host.append(notice);
      }
      if(pendingProjectId!==null){
        const notice=element('section');notice.setAttribute('role','alert');notice.setAttribute('aria-label','Unsaved project switch');
        notice.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();pendingProjectId=null;render(controller.snapshot());host.querySelector('[data-focus="name"]')?.focus();}});
        notice.append(element('p','Unsaved asset metadata will be discarded if you switch projects.'),button('Keep editing',()=>{pendingProjectId=null;render(controller.snapshot());host.querySelector('[data-focus="name"]')?.focus();}),button('Discard changes and switch',()=>switchProject(pendingProjectId)));host.append(notice);
      }
      if (!state.project) return;
      const controls = element('form'); const query = element('input',undefined,{type:'search',placeholder:'Search names and tags',value:filters.query}); query.setAttribute('aria-label','Search assets'); query.dataset.focus='search';query.oninput=()=>{filters.query=query.value;};
      const section = element('select'); section.setAttribute('aria-label','Filter section'); for (const s of ['','Files','Brand','Website','Docs']) section.append(element('option',s || 'All sections',{value:s}));section.value=filters.section;section.onchange=()=>{filters.section=section.value;};
      const media=element('select');media.setAttribute('aria-label','Filter media');for(const [value,label]of [['','All media'],['image/png','PNG images'],['image/jpeg','JPEG images'],['text/plain','Text files']])media.append(element('option',label,{value}));media.value=filters.mediaType;media.onchange=()=>{filters.mediaType=media.value;};
      const review=element('select');review.setAttribute('aria-label','Filter review state');for(const [value,label]of [['','All review states'],['draft','Draft'],['submitted','Needs review'],['approved','Approved'],['changes-requested','Changes requested']])review.append(element('option',label,{value}));review.value=filters.reviewState;review.onchange=()=>{filters.reviewState=review.value;};
      controls.append(query,section,media,review,button('Search',()=>controller.search(filters),busy)); controls.onsubmit=e=>{e.preventDefault();controller.search(filters);}; host.append(controls);
      const file = element('input',undefined,{type:'file',accept:'.png,.jpg,.jpeg,.txt'}); file.setAttribute('aria-label','Import synthetic file'); file.disabled=busy || !allowImport;
      file.onchange = async () => {
        const selected=file.files[0]; if(!selected) return; retryFile=selected; retryKey=crypto.randomUUID(); await importFile();
      };
      async function importFile() {
        if (!retryFile || !retryKey) return;
        const file = retryFile, key = retryKey, generation = controller.generation;
        if(file.size > 25*1024*1024) { controller.state.error='TOO_LARGE';controller.emit();return; }
        const bytes = new Uint8Array(await file.arrayBuffer());
        if(controller.generation !== generation) return;
        await controller.save('import',{filename:file.name,mediaType:file.type || 'text/plain',bytes,idempotencyKey:key});
      }
      host.append(file,button('Retry import',importFile,busy || !retryFile || !allowImport),button('Cancel requests',()=>controller.cancel(),!busy));
      const list=element('ul'); list.setAttribute('aria-label','Project assets');
      for(const asset of state.assets) { const row=element('li'); row.append(button(asset.name,()=> {clearPreview();versionId=null;controller.selectAsset(asset.id);}),element('span',` ${asset.tags.join(', ')} · ${asset.versions.length} version(s)`)); list.append(row); }
      host.append(list);
      const count=element('p',busy?'Updating asset results…':`${state.assets.length} matching asset${state.assets.length===1?'':'s'}.`,{role:'status'});count.setAttribute('aria-live','polite');count.setAttribute('aria-atomic','true');host.append(count);
      if(!state.assets.length && !busy) host.append(element('p','No matching assets. Import a synthetic file to begin.'));
      const asset=state.assets.find(a=>a.id===state.selectedId); if(!asset){clearPreview();return;}
      const panel=element('section'); panel.setAttribute('aria-label','Asset details'); panel.append(element('h2',asset.name),element('p',`Original: ${asset.originalFilename}`));
      const form=element('form'); const fields={}; const draft=drafts.get(asset.id) || {revision:asset.revision,name:asset.name,tags:asset.tags.join(', '),description:asset.description,section:asset.section};
      const draftNotice=element('p','Unsaved metadata changes — retained while this project remains selected.',{role:'status'});draftNotice.hidden=!drafts.has(asset.id);
      for(const [key,label] of [['name','Display name'],['tags','Tags (comma separated)'],['description','Description'],['section','Section']]) {
        const wrap=element('label',label); const input=element('input',undefined,{value:draft[key] || '',disabled:busy}); input.dataset.focus=key;fields[key]=input;input.oninput=()=>{draft[key]=input.value;drafts.set(asset.id,draft);draftNotice.hidden=false;};wrap.append(input);form.append(wrap);
      }
      const save=element('button','Save metadata',{type:'submit',disabled:busy});form.append(save);form.onsubmit=async e=>{e.preventDefault();const result=await controller.save('metadata',{assetId:asset.id,revision:draft.revision,name:fields.name.value,tags:fields.tags.value.split(',').map(t=>t.trim()).filter(Boolean),description:fields.description.value,section:fields.section.value});if(result){drafts.delete(asset.id);render(controller.snapshot());}};panel.append(form);
      panel.append(draftNotice);
      if(conflicts.has(asset.id))panel.append(button('Discard draft and load latest metadata',async()=>{
        const epoch=controller.generation;const result=await controller.reloadAsset(asset.id);
        if(result && epoch===controller.generation){drafts.delete(asset.id);conflicts.delete(asset.id);render(controller.snapshot());host.querySelector('[data-focus="name"]')?.focus();}
      },busy),element('p','Loading the latest metadata discards this local draft only after a successful response. Copy any edits you want to keep first.'));
      const origin=asset.provenance?.name;panel.append(element('p',origin?`Name source: ${origin.source==='rule'?'Librarian naming rule':origin.source==='human'?'Human edit':origin.source}${origin.actor?' · '+origin.actor:''}${origin.at?' · '+origin.at:''}`:'Name source: not supplied'));
      const suggestion=StudioAssetModel.suggestName(asset.originalFilename);panel.append(button(`Use naming suggestion: ${suggestion}`,()=>{draft.name=suggestion;drafts.set(asset.id,draft);render(controller.snapshot());},busy || draft.name===suggestion));
      if(asset.metadataHistory?.length){const history=element('details');history.append(element('summary','Metadata change history'));for(const event of asset.metadataHistory.slice(-10).reverse())history.append(element('p',`Revision ${event.revision} · ${event.actor} · ${event.at} · ${Object.keys(event.changes).join(', ')}`));panel.append(history);}
      const versions=element('select');versions.setAttribute('aria-label','Asset version'); for(const v of asset.versions) versions.append(element('option',`v${v.sequence} · ${v.id===asset.originalVersionId?'Original':'Derivative'}${v.operation==='upscale'?' · Upscayl':''} · ${reviewLabel[v.reviewState]}`,{value:v.id}));
      if(!asset.versions.some(v=>v.id===versionId)) versionId=asset.preferredVersionId;versions.value=versionId;versions.onchange=()=> {clearPreview();versionId=versions.value;render(controller.snapshot());};panel.append(versions);
      const selected=asset.versions.find(v=>v.id===versionId);panel.append(element('p',`Parent: ${selected.parentVersionId || 'none'} · ${selected.bytes} bytes`));
      if(selected.mediaType.startsWith('image/'))panel.append(button('Preview selected image',async()=>{
        const epoch=controller.generation;const result=await controller.download({assetId:asset.id,versionId:selected.id});if(!result || epoch!==controller.generation || controller.snapshot().selectedId!==asset.id || versionId!==selected.id)return;
        const url=URL.createObjectURL(new Blob([result.bytes],{type:result.mediaType}));
        try {
          const image=new root.Image();image.src=url;await image.decode();
          if(epoch!==controller.generation || controller.snapshot().selectedId!==asset.id || versionId!==selected.id){URL.revokeObjectURL(url);return;}
          clearPreview();preview={assetId:asset.id,versionId:selected.id,url};render(controller.snapshot());
        }catch{URL.revokeObjectURL(url);if(epoch===controller.generation && controller.snapshot().selectedId===asset.id && versionId===selected.id){controller.state.error='PREVIEW_FAILED';controller.state.phase='error';controller.emit();}}
      },busy));
      if(preview?.assetId===asset.id && preview.versionId===selected.id)panel.append(element('img',undefined,{src:preview.url,alt:`${asset.name}, version ${selected.sequence}, ${selected.operation}`,className:'sa-image-preview'}));
      panel.append(button('Download selected version',async()=> {
        const result=await controller.download({assetId:asset.id,versionId:selected.id});if(!result)return;
        const url=URL.createObjectURL(new Blob([result.bytes],{type:result.mediaType}));const link=element('a',undefined,{href:url,download:result.filename});link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      },busy),button('Submit selected version for review',()=>controller.save('review',{assetId:asset.id,versionId:selected.id,revision:asset.revision}),busy || !['draft','changes-requested'].includes(selected.reviewState)));
      panel.append(button('Upscale as new version',async()=> {
        const epoch=controller.generation; const abort=new AbortController();jobAbort=abort;jobState='queued';render(controller.snapshot());
        try {await enhance({projectId:state.project.id,assetId:asset.id,parentVersionId:selected.id,originalVersionId:asset.originalVersionId,signal:abort.signal,onState:phase=>{if(controller.generation===epoch){jobState=phase;render(controller.snapshot());}}});if(controller.generation===epoch)await controller.search(filters);}
        catch {if(controller.generation===epoch){jobState=abort.signal.aborted?'cancelled':'failed';controller.state.error=abort.signal.aborted?'CANCELLED':'UPSCALE_FAILED';controller.emit();}}
        finally {if(jobAbort===abort)jobAbort=null;if(controller.generation===epoch)render(controller.snapshot());}
      },busy || !enhance || !!jobAbort || !selected.mediaType.startsWith('image/')));
      panel.append(element('p',`Upscale job: ${jobState}`,{role:'status'}),button('Cancel upscale job',()=>jobAbort?.abort(),!jobAbort));
      if(!enhance) panel.append(element('p','Upscayl unavailable: approved executable/model, isolation and host integration are pending.'));
      host.append(panel); if(oldFocus) host.querySelector(`[data-focus="${oldFocus}"]`)?.focus();
    }
    const api=()=>{disposed=true;settleLeave(false);if(jobAbort)jobAbort.abort();clearPreview();drafts.clear();conflicts.clear();controller.onChange=()=>{};controller.cancel();host.replaceChildren();};
    api.prepareLeave=prepareLeave;
    api.setProject=async id=>{
      if(disposed || !controller.projects.some(project=>project.id===id))return false;
      if(controller.snapshot().project?.id===id)return true;
      const epoch=controller.generation;if(!await prepareLeave() || disposed || epoch!==controller.generation)return false;switchProject(id);return true;
    };
    api.signOut=async()=>{const epoch=controller.generation;if(!await prepareLeave() || disposed || epoch!==controller.generation)return false;api.clearContext();return true;};
    api.clearContext=()=>{settleLeave(false);if(jobAbort)jobAbort.abort();clearPreview();drafts.clear();conflicts.clear();pendingProjectId=null;retryKey=null;retryFile=null;controller.signOut();};
    controller.onChange=render; render(controller.snapshot());
    return api;
  }
  root.StudioAssetView = { mount };
})(globalThis);
