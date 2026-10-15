'use strict';
// DEV-020: isolated synthetic Electron smoke. No service endpoints, paid calls or customer files.
const { app, BrowserWindow } = require('electron');
const { mkdir, writeFile } = require('node:fs/promises');
const { join } = require('node:path');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('force-color-profile', 'srgb');
const root = join(__dirname, '..', '..', '..', '..');
const renderer = join(root, 'src', 'renderer', 'index.html');
const evidence = join(__dirname, 'renders');
const preload = join(root, 'docs', 'studio', 'design', '9', 'runtime-preload.cjs');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(window, expression, message, timeout = 8000) {
  const start=Date.now();
  while(Date.now()-start<timeout) {
    if(await window.webContents.executeJavaScript(expression))return;
    await wait(80);
  }
  throw new Error('Timed out: '+message);
}
async function snap(window, name) {
  await wait(200);
  const image = await Promise.race([window.webContents.capturePage(), wait(5000).then(() => { throw new Error('Screenshot capture timed out'); })]);
  await writeFile(join(evidence, name+'.png'), image.toPNG());
}
async function script(window, content) {
  return window.webContents.executeJavaScript(content);
}

app.whenReady().then(async () => {
  await mkdir(evidence, { recursive: true });
  const window=new BrowserWindow({
    width:1440,height:1000,show:true,backgroundColor:'#07101d',
    webPreferences:{preload,contextIsolation:true,nodeIntegration:false,sandbox:false,
      additionalArguments:['--studio-evidence-mode=development']},
  });
  let failed=false;
  const watchdog = setTimeout(() => { console.error('DEV-020 runtime watchdog exceeded 75 seconds'); app.exit(1); }, 75000);
  try {
    console.log('DEV-020 step: load renderer');
    await window.loadFile(renderer);
    console.log('DEV-020 step: renderer loaded');
    await until(window, "Boolean(document.querySelector('#projectsMasterList .project-item'))", 'project context');
    console.log('DEV-020 step: open Studio');
    await script(window, "switchView('studio')");
    await until(window, "Boolean(document.querySelector('#studioCenter:not([hidden]) .studio-campaign'))", 'studio');
    await script(window, "document.querySelector('[data-action=surface][data-value=assets]').click()");
    await until(window, "Boolean(document.querySelector('#studio-asset-client .sa-banner'))", 'writable asset client');
    const initial=await script(window, `(() => ({
      banner:document.querySelector('#studio-asset-client .sa-banner').textContent,
      localProjectSelector:!!document.querySelector('#studio-asset-client [aria-label="Project"]'),
      localSignout:!![...document.querySelectorAll('#studio-asset-client button')].find(x=>x.textContent==='Sign out'),
      upscaleEnabled:[...document.querySelectorAll('#studio-asset-client button')].some(x=>x.textContent.includes('Upscale as new version')&&!x.disabled),
      devOnly:document.getElementById('studioCenter').dataset.mode==='synthetic-development',
    }))()`);
    if(!initial.banner.includes('SYNTHETIC DEVELOPMENT ONLY') || initial.localProjectSelector || initial.localSignout || initial.upscaleEnabled || !initial.devOnly) {
      throw new Error('Asset view gate/ownership invariant failed: '+JSON.stringify(initial));
    }
    console.log('DEV-020 step: mounted asset view');
    await snap(window,'asset-view-1440');

    await script(window, `(() => {
      const input=document.querySelector('#studio-asset-client input[type="file"]');
      const data=new DataTransfer();
      data.items.add(new File(['synthetic example contents'],'design-notes.txt',{type:'text/plain'}));
      input.files=data.files;
      input.dispatchEvent(new Event('change',{bubbles:true}));
    })()`);
    console.log('DEV-020 step: wait for import');
    await until(window, "Boolean(document.querySelector('#studio-asset-client ul li button'))", 'synthetic import');
    await script(window, "document.querySelector('#studio-asset-client ul li button').click()");
    await until(window, "Boolean(document.querySelector('#studio-asset-client [data-focus=name]'))", 'metadata editor');
    await script(window, `(() => {
      const input=document.querySelector('#studio-asset-client [data-focus=name]');
      input.value='Unsaved synthetic metadata';
      input.dispatchEvent(new Event('input',{bubbles:true}));
      switchView('overview');
    })()`);
    await until(window, "Boolean(document.querySelector('#studio-asset-client [aria-label=\"Unsaved host transition\"]'))", 'unsaved leave prompt');
    console.log('DEV-020 step: unsaved guard opened');
    await snap(window,'unsaved-asset-leave');
    await script(window, `[...document.querySelectorAll('#studio-asset-client button')].find(x=>x.textContent==='Keep editing').click()`);
    await wait(100);
    const retained=await script(window, "document.body.classList.contains('view-studio') && document.querySelector('#studio-asset-client [data-focus=name]').value==='Unsaved synthetic metadata'");
    if(!retained) throw new Error('Keep editing did not retain the draft and Studio route.');
    await script(window, "switchView('overview')");
    await until(window, "Boolean(document.querySelector('#studio-asset-client [aria-label=\"Unsaved host transition\"]'))", 'second unsaved prompt');
    await script(window, `[...document.querySelectorAll('#studio-asset-client button')].find(x=>x.textContent==='Discard changes and leave').click()`);
    await until(window, "document.body.classList.contains('view-studio') === false", 'confirmed Studio leave');

    await script(window, "switchView('studio')");
    await until(window, "Boolean(document.querySelector('#studio-asset-client .sa-banner'))", 'Studio after return');
    await script(window, "selectProject('synthetic-field-notes')");
    await until(window, `document.querySelector('#studio-title')?.textContent.includes('Field Notes Campaign') && Boolean(document.querySelector('#studio-asset-client .sa-banner'))`, 'Connect project switch');
    const project=await script(window, "window.meridianStudioContext.snapshot().project?.id");
    const scoped=await script(window, "document.querySelectorAll('#studio-asset-client ul li').length");
    if(project!=='synthetic-field-notes' || scoped!==0)throw new Error('Project isolation failed after switch');
    console.log('DEV-020 step: project switch done');
    await snap(window,'asset-project-switch');

    window.webContents.setZoomFactor(2);
    await wait(220);
    const zoom=await script(window,`(() => ({
      zoom:window.devicePixelRatio,
      documentFits:document.documentElement.scrollWidth<=document.documentElement.clientWidth,
      assetFits:document.querySelector('#studio-asset-client').scrollWidth<=document.querySelector('#studio-asset-client').clientWidth,
    }))()`);
    await snap(window,'asset-view-200pct');
    if(!zoom.documentFits || !zoom.assetFits)throw new Error('200% asset view horizontal overflow: '+JSON.stringify(zoom));

    await writeFile(join(evidence,'runtime-results.json'),JSON.stringify({initial,retained,project,scoped,zoom},null,2));
    console.log('DEV-020 isolated Electron smoke PASS',JSON.stringify({initial,retained,project,scoped,zoom}));
  } catch(error) {
    console.error('DEV-020 isolated Electron smoke FAIL',error.stack||String(error));
    failed=true;
  } finally {
    clearTimeout(watchdog);
    window.destroy();
    app.exit(failed ? 1 : 0);
  }
}).catch(error=>{console.error(error);app.exit(1);});
