'use strict';
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../../..');
const out=process.env.MERIDIAN_ORDERED_EVIDENCE;
const item=Number(process.env.MERIDIAN_ORDERED_ITEM);
async function assertFocusVisible(){assert.equal(await js("(()=>{const r=document.activeElement.getBoundingClientRect(),b=document.querySelector('.website-workbar').getBoundingClientRect(),w=document.querySelector('.studio-workspace').getBoundingClientRect();return r.top>=b.bottom-1&&r.bottom<=w.bottom+1})()"),true,'Focused shortcut target is not hidden under Save bar');}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let win; const errors=[],requests=[];
const js=code=>win.webContents.executeJavaScript(code);
async function until(code){for(let n=0;n<150;n++){if(await js(code))return;await pause(40);}throw Error('Timed out: '+code);}
async function click(selector){await until(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);await js(`document.querySelector(${JSON.stringify(selector)}).click()`);await pause(100);}
async function capture(name){await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');await fs.writeFile(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG());}
async function create(){await click('[data-action="surface"][data-value="website"]');await js(`document.querySelector('#website-new-name').value='Ordered synthetic website'`);await click('[data-action="website-create"]');}
async function edit(){await js(`const f=document.querySelector('#website-brief-audience');f.value='Ordered retained audience';f.dispatchEvent(new Event('input',{bubbles:true}));`);}
app.commandLine.appendSwitch('disable-gpu');app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{try{
 await fs.mkdir(out,{recursive:true});app.setPath('userData',await fs.mkdtemp(path.join(require('node:os').tmpdir(),'meridian-ordered-')));
 win=new BrowserWindow({width:1440,height:1000,show:true,webPreferences:{preload:path.join(root,'docs/studio/design/9/runtime-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:false,backgroundThrottling:false,additionalArguments:['--studio-evidence-mode=development']}});
 win.webContents.on('console-message',(_e,level,message)=>{if(level>=3)errors.push(message);});
 win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(details,callback)=>{requests.push(details.url);callback({cancel:true});});
 await win.loadFile(path.join(root,'src/renderer/index.html'));await until(`Boolean(document.querySelector('#projectsMasterList .project-item'))`);await js(`switchView('studio')`);await until(`Boolean(document.querySelector('#studio-current-work-title'))`);
 let details={};
 if(item===24){
 await create();await edit();await click('[data-action="website-jump"][data-value="checkpoints"]');assert.equal(await js("document.activeElement.id"),'website-checkpoints-title');await assertFocusVisible();assert.match(await js("document.querySelector('.website-builder').textContent"),/Save the project first/);
 await click('[data-action="website-save"]');await js("document.querySelector('#website-checkpoint-label').value='Before organization review'");await click('[data-action="website-checkpoint-create"]');assert.equal(await js("document.querySelector('.website-shortcuts').textContent.includes('Saved checkpoints (1)')"),true);
 await click('[data-action="website-jump"][data-value="shared"]');assert.equal(await js("document.activeElement.id"),'website-shared-title');await assertFocusVisible();
 await click('[data-action="website-jump-section"]');assert.equal(await js("document.activeElement.dataset.field"),'heading');await assertFocusVisible();details.shortcutsFocusAndCheckpoint=true;await capture('24-section-shortcuts');await js("document.querySelector('.studio-workspace').scrollTop=0");await capture('24-shortcut-overview');
 }else if(item===23){
 await create();await edit();await click('.website-flow-nav [data-value="edit"]');
 await js("document.querySelector('.website-section-list').scrollIntoView({block:'end'})");await pause(150);
 details.bar=await js("(()=>{const b=document.querySelector('.website-workbar'),r=b.getBoundingClientRect(),w=document.querySelector('.studio-workspace').getBoundingClientRect();return {top:r.top,bottom:r.bottom,workspaceTop:w.top,visible:r.top>=w.top-1&&r.bottom<=w.bottom,text:b.textContent}})()");
 assert.equal(details.bar.visible,true);assert.match(details.bar.text,/Unsaved changes/);await capture('23-sticky-context');
 await click('[data-action="website-save"]');assert.match(await js("document.querySelector('.website-workbar').textContent"),/Saved on this device/);
 await click('[data-action="website-show-steps"]');assert.equal(await js("document.activeElement.getAttribute('aria-current')"),'step');details.savedAndStepFocus=true;
 }else if(item===2){
  await create();await edit();await click('[data-action="website-save"]');await click('[data-action="website-list"]');await click('[data-action="website-open"]');assert.equal(await js(`document.querySelector('#website-brief-audience').value`),'Ordered retained audience');
  await new Promise(resolve=>{win.webContents.once('did-finish-load',resolve);win.reload();});await until(`Boolean(document.querySelector('#projectsMasterList .project-item'))`);await js(`switchView('studio')`);await until(`Boolean(document.querySelector('#studio-current-work-title'))`);await click('[data-action="surface"][data-value="website"]');await click('[data-action="website-open"]');assert.equal(await js(`document.querySelector('#website-brief-audience').value`),'Ordered retained audience');await capture('02-reloaded-website');details={savedClosedReopened:true,reloadRetained:true};
 }else if(item===3){
  const cards=await js(`[...document.querySelectorAll('.studio-tool-card')].map(e=>({name:e.querySelector('h3').textContent,badge:e.querySelector('.studio-pill').textContent,action:e.querySelector('button').dataset.action,id:e.querySelector('button').dataset.value}))`);assert.equal(cards.length,9);
  for(const card of cards){if(card.id==='website')continue;await click(`[data-action="tool-detail"][data-value="${card.id}"]`);assert.match(await js(`document.querySelector('[role=dialog]').textContent`),/not connected/);await click('[data-action="close-tool"]');}
  await click('[data-action="surface"][data-value="website"]');assert.equal(await js(`Boolean(document.querySelector('#website-new-name'))`),true);details={cards,eightRequirementDialogs:true,websiteOpens:true};await capture('03-website-entry');
 }else if(item===4){
  details.routes=[];const routes=await js(`[...document.querySelectorAll('.nav-link[data-view]')].map(e=>e.dataset.view).filter(x=>x!=='studio')`);
  for(const route of routes){await js(`switchView(${JSON.stringify(route)})`);await pause(160);details.routes.push(await js(`({route:${JSON.stringify(route)},active:document.querySelector('.nav-link.active')?.dataset.view,visible:getComputedStyle(document.getElementById(({overview:'msgs',projects:'projectsCenter',tasks:'tasksCenter',messages:'teamMessagesCenter',send:'sendCenter',tools:'toolsCenter',chat:'mx-dock'})[${JSON.stringify(route)}])).display!=='none'})`));assert.equal(details.routes.at(-1).active,route);assert.equal(details.routes.at(-1).visible,true);}
  await js(`switchView('overview')`);await capture('04-connect-overview');details.limit='Synthetic client navigation only; no authenticated service behavior';
 }else if(item===15){
  await create();await edit();await js(`switchView('overview')`);await until(`Boolean(document.querySelector('[data-action="keep-editing"]'))`);
  await js(`document.querySelector('[data-action="keep-editing"]').focus()`);win.webContents.sendInputEvent({type:'keyDown',keyCode:'Tab',modifiers:['shift']});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Tab',modifiers:['shift']});await pause(80);assert.equal(await js(`document.activeElement.dataset.action`),'save-leave');win.webContents.sendInputEvent({type:'keyDown',keyCode:'Tab'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Tab'});await pause(80);assert.equal(await js(`document.activeElement.dataset.action`),'keep-editing');
  await click('[data-action="keep-editing"]');await click('.website-flow-nav [data-value="edit"]');assert.equal(await js(`document.activeElement.id`),'website-page-editor-title');
  details.unlabeled=await js(`[...document.querySelectorAll('.website-builder input,.website-builder textarea,.website-builder select')].filter(e=>!e.closest('label')&&!e.getAttribute('aria-label')&&![...document.querySelectorAll('label')].some(l=>l.htmlFor===e.id)).map(e=>e.id)`);assert.equal(details.unlabeled.length,0);
  win.webContents.debugger.attach('1.3');const ax=await win.webContents.debugger.sendCommand('Accessibility.getFullAXTree');await fs.writeFile(path.join(out,'15-accessibility-tree.json'),JSON.stringify(ax,null,2));win.webContents.debugger.detach();details.modalTabWrap=true;details.stepFocusRestored=true;details.limit='Chromium accessibility tree and keyboard events; no human screen-reader acceptance';await capture('15-keyboard-editor');
 }else if(item===27){
  await create();details.matrix=[];
  for(const [locale,label] of [['de-DE','Donaudampfschifffahrt '],['ar-EG','مرحبا بالعالم '],['ja-JP','長い見出しテスト ']]){
   await click('.website-flow-nav [data-value="pages"]');
   await js("(()=>{const f=document.querySelector('#website-page-title');f.value="+JSON.stringify(label.repeat(5))+";f.dispatchEvent(new Event('input',{bubbles:true}))})()");
   for(const [width,height,zoom] of [[1440,1000,1],[1000,800,1],[800,700,1],[1280,900,2]]){
    win.setSize(width,height);win.webContents.setZoomFactor(zoom);await pause(130);
    for(const step of ['brief','pages','edit','preview']){
     await click('.website-flow-nav [data-value="'+step+'"]');
     const metrics=await js("(()=>{const roots=['.studio-workspace','.studio-main','.website-builder'];const missingLabels=[...document.querySelectorAll('.website-builder button')].filter(e=>!e.disabled&&!e.textContent.trim()&&!e.getAttribute('aria-label')).length;const bar=document.querySelector('.website-workbar__status');return {fits:roots.every(s=>{const e=document.querySelector(s);return e.scrollWidth<=e.clientWidth+1}),missingLabels,statusFits:bar.scrollWidth<=bar.clientWidth+1,retainedTitle:document.querySelector('.website-workbar').textContent}})()");
     const record={locale,width,height,zoom,step,...metrics};details.matrix.push(record);assert.equal(metrics.fits,true,JSON.stringify(record));assert.equal(metrics.statusFits,true,JSON.stringify(record));assert.equal(metrics.missingLabels,0,JSON.stringify(record));assert.ok(metrics.retainedTitle.includes(label.trim()),JSON.stringify(record));
    }
    if(width===800||zoom===2)await capture('27-'+locale+'-'+width+'-'+zoom);
   }
  }
  details.limits='Mixed content in English UI, not translated UI or full RTL product support';
 }else if(item===16){
  await create();details.sizes=[];await js("(()=>{const f=document.querySelector('#website-page-title');f.value='P'.repeat(120);f.dispatchEvent(new Event('input',{bubbles:true}))})()");
  for(const [width,height,zoom] of [[1440,1000,1],[1000,800,1],[800,700,1],[700,650,1],[1280,900,2]]){win.setSize(width,height);win.webContents.setZoomFactor(zoom);await pause(130);for(const step of ['brief','pages','edit','preview']){await click(`.website-flow-nav [data-value="${step}"]`);const fit=await js(`['.studio-workspace','.studio-main','.website-builder'].every(s=>{const e=document.querySelector(s);return e.scrollWidth<=e.clientWidth+1})`);details.sizes.push({width,height,zoom,step,fit});assert.equal(fit,true,JSON.stringify(details.sizes.at(-1)));assert.equal(await js("(()=>{const e=document.querySelector('.website-workbar__status');return e.textContent.includes('Unsaved changes')&&e.scrollWidth<=e.clientWidth+1&&getComputedStyle(e).whiteSpace==='normal'})()"),true,'Long page name cannot truncate step/save status');}await capture(`16-${width}-${zoom}`);}
  win.webContents.debugger.attach('1.3');await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'},{name:'forced-colors',value:'active'}]});details.media=await js(`({reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,forcedColors:matchMedia('(forced-colors: active)').matches})`);assert.equal(details.media.reducedMotion,true);assert.equal(details.media.forcedColors,true);await capture('16-emulated-contrast');win.webContents.debugger.detach();details.limit='Emulated preferences; no OS theme changes on this computer';
 }else if(item===6){
  const builder=require(path.join(root,'src/renderer/studio-ui/website-builder.js'));
  const c=builder.createController({storage:builder.createMemoryStorage(),idFactory:()=> 'website-quota-evidence'});c.selectContext({id:'synthetic-northstar',name:'Synthetic'});c.createProject('Retained before quota');const record=c.snapshot().project;
  await js(`localStorage.setItem('meridian.website.synthetic-northstar.website-quota-evidence',${JSON.stringify(JSON.stringify(record))})`);
  win.webContents.debugger.attach('1.3');await win.webContents.debugger.sendCommand('Page.enable');await win.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument',{source:`Storage.prototype.setItem=function(){throw new DOMException('Synthetic full storage','QuotaExceededError')}`});
  await new Promise(resolve=>{win.webContents.once('did-finish-load',resolve);win.reload();});await until(`Boolean(document.querySelector('#projectsMasterList .project-item'))`);await js(`switchView('studio')`);await until(`Boolean(document.querySelector('#studio-current-work-title'))`);await click('[data-action="surface"][data-value="website"]');
  details={setItemBody:await js('Storage.prototype.setItem.toString()'),retainedRecordReadable:await js(`!!localStorage.getItem('meridian.website.synthetic-northstar.website-quota-evidence')`),retainedRecordListed:await js(`!!document.querySelector('[data-action="website-open"][data-value="website-quota-evidence"]')`),sessionFallback:await js(`document.querySelector('.website-builder').textContent.includes('session only')`)};assert.equal(details.retainedRecordListed,true);assert.equal(details.sessionFallback,false);await capture('06-startup-quota');win.webContents.debugger.detach();
 }else if(item===5){
  await create();await edit();await js(`switchView('overview')`);await until(`Boolean(document.querySelector('[data-action="keep-editing"]'))`);await click('[data-action="keep-editing"]');assert.equal(await js(`document.querySelector('#website-brief-audience').value`),'Ordered retained audience');
  details.navigationCancelPreservesEdits=true;
  await js(`selectStudioConnectProject('synthetic-field-notes')`);await until(`Boolean(document.querySelector('[data-action="keep-editing"]'))`);await click('[data-action="keep-editing"]');assert.equal(await js(`window.meridianStudioContext.snapshot().project.id`),'synthetic-northstar');details.projectSwitchCancelPreservesContext=true;
  await click('#btn-signout');await until(`Boolean(document.querySelector('[data-action="keep-editing"]'))`);await click('[data-action="keep-editing"]');assert.equal(await js(`document.querySelector('#website-brief-audience').value`),'Ordered retained audience');details.signoutCancelPreservesEdits=true;
  let prevented=false;win.webContents.once('will-prevent-unload',()=>{prevented=true;});win.close();await pause(250);details.dirtyWindowClosed=win.isDestroyed();details.closePrevented=prevented;
  assert.equal(details.dirtyWindowClosed,false);assert.equal(prevented,true);await capture('05-close-guard');await click('[data-action="save-leave"]');win.close();await pause(120);assert.equal(win.isDestroyed(),true);details.cleanWindowClosedAfterSave=true;
 }else { throw Error('No runtime check defined for item '+item); }
 assert.deepEqual(errors, [], 'No renderer errors');
 await fs.writeFile(path.join(out,`item-${String(item).padStart(2,'0')}.json`),JSON.stringify({item,status:'reviewed',details,rendererErrors:errors,blockedNetworkRequests:requests.length},null,2));
 console.log('ORDERED_ITEM_DONE',item);app.exit(0);
}catch(e){await fs.writeFile(path.join(out,`item-${item}-failure.txt`),e.stack);if(win&&!win.isDestroyed())await capture('failure').catch(()=>{});console.error(e);app.exit(1);}});
