'use strict';
// DEV-020: isolated synthetic Electron smoke. No service endpoints, paid calls or customer files.
const { app, BrowserWindow } = require('electron');
const { mkdir, writeFile, rm } = require('node:fs/promises');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { assertWarningState, assertDistinctCapture } = require('./capture-guard.cjs');

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
    if(await script(window, expression))return;
    await wait(80);
  }
  throw new Error('Timed out: '+message);
}
async function freshImage(window) {
  window.webContents.invalidate();
  await script(window, 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  await Promise.race([window.webContents.capturePage(), wait(5000).then(() => { throw new Error('Warm-up capture timed out'); })]);
  await script(window, 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  await wait(200);
  return Promise.race([window.webContents.capturePage(), wait(5000).then(() => { throw new Error('Screenshot capture timed out'); })]);
}
async function snap(window, name) {
  const image = await freshImage(window);
  const bytes = image.toPNG();
  await writeFile(join(evidence, name+'.png'), bytes);
  return bytes;
}
async function script(window, content) {
  return Promise.race([
    window.webContents.executeJavaScript(content),
    wait(5000).then(() => { throw new Error('Renderer execution timed out: '+content.slice(0,90)); }),
  ]);
}

async function warningState(window) {
  return script(window, `(() => {
    const notice = document.querySelector('#studio-asset-client [aria-label="Unsaved host transition"]');
    function metrics(node) {
      if (!node) return { connected: false, visible: false, inViewport: false };
      const r = node.getBoundingClientRect();
      let visible = node.isConnected && r.width > 0 && r.height > 0;
      for (let parent = node; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (parent.hidden || style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) visible = false;
      }
      const bounds = { x: r.x, y: r.y, width: r.width, height: r.height };
      return { connected: node.isConnected, visible, bounds, inViewport: visible && r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }
    const input = document.querySelector('#studio-asset-client [data-focus=name]');
    const dirtyNotice = [...document.querySelectorAll('#studio-asset-client [role=status]')].find(node => node.textContent.includes('Unsaved metadata changes'));
    return {
      ...metrics(notice), text: notice?.textContent || '',
      controls: [...(notice?.querySelectorAll('button') || [])].map(node => ({ ...metrics(node), text: node.textContent, disabled: node.disabled })),
      projectId: window.meridianStudioContext.snapshot().project?.id,
      fieldValue: input?.value, dirty: metrics(dirtyNotice).visible,
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
    };
  })()`);
}

app.whenReady().then(async () => {
  await mkdir(evidence, { recursive: true });
  // Never let an old successful image/metrics file survive a failed new run.
  for (const name of ['unsaved-asset-leave.png', 'warning-capture.json', 'runtime-results.json']) {
    await rm(join(evidence, name), { force: true });
  }
  // Generated PNG/JSON evidence can be refreshed without making the tested
  // source dirty. Check executable inputs, not the captures they generate.
  execFileSync('git', ['diff', '--quiet', 'HEAD', '--', 'src', 'docs/studio/integration/32/*.cjs', 'docs/studio/design/9/runtime-preload.cjs'], { cwd: root });
  execFileSync('git', ['ls-files', '--error-unmatch', 'docs/studio/integration/32/runtime-check.cjs', 'docs/studio/integration/32/capture-guard.cjs'], { cwd: root, stdio: 'pipe' });
  const provenance = {
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: root, encoding: 'utf8' }).trim(),
    trackedSourceClean: true, runId: randomUUID(), startedAt: new Date().toISOString(),
  };
  const window=new BrowserWindow({
    width:1440,height:1000,show:true,backgroundColor:'#07101d',
    webPreferences:{preload,contextIsolation:true,nodeIntegration:false,sandbox:false,backgroundThrottling:false,
      additionalArguments:['--studio-evidence-mode=development']},
  });
  window.webContents.on('render-process-gone', (_, info) => console.error('DEV-020 renderer gone', JSON.stringify(info)));
  window.webContents.on('unresponsive', () => console.error('DEV-020 renderer unresponsive'));
  window.webContents.on('console-message', (_, level, message) => { if (level >= 2) console.error('DEV-020 renderer console:', message); });
  let failed=false;
  const watchdog = setTimeout(() => { console.error('DEV-020 runtime watchdog exceeded 75 seconds'); app.exit(1); }, 75000);
  try {
    console.log('DEV-020 step: load renderer');
    await window.loadFile(renderer);
    console.log('DEV-020 step: renderer loaded');
    await until(window, "Boolean(document.querySelector('#projectsMasterList .project-item'))", 'project context');
    console.log('DEV-020 step: open Studio');
    await script(window, "window.__DEV020_TRACE__ = true; switchView('studio')");
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
    const normalCapture = await snap(window,'asset-view-1440');

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
    const selectedCapture = await snap(window, 'asset-selected-clean-1440');
    const expectedWarning = await script(window, `({
      projectId: window.meridianStudioContext.snapshot().project?.id,
      fieldValue: 'Unsaved synthetic metadata',
    })`);
    await script(window, `(() => {
      const input=document.querySelector('#studio-asset-client [data-focus=name]');
      input.value='Unsaved synthetic metadata';
      input.dispatchEvent(new Event('input',{bubbles:true}));
      const dirty = [...document.querySelectorAll('#studio-asset-client [role=status]')].find(node => !node.hidden && node.textContent.includes('Unsaved metadata changes'));
      if (!dirty || input.value !== 'Unsaved synthetic metadata') throw new Error('Metadata was not dirty before leaving');
      switchView('overview');
    })()`);
    await until(window, "Boolean(document.querySelector('#studio-asset-client [aria-label=\"Unsaved host transition\"]'))", 'unsaved leave prompt');
    console.log('DEV-020 step: unsaved guard opened');
    // Use a shown isolated window, scroll the real alert into view, then wait for
    // compositor frames. DOM existence alone did not prove the old image was fresh.
    window.show();
    await script(window, `document.querySelector('#studio-asset-client [aria-label="Unsaved host transition"]').scrollIntoView({block:'center'})`);
    const beforeCapture = await warningState(window);
    assertWarningState(beforeCapture, expectedWarning);
    const image = await freshImage(window);
    const warningCapture = image.toPNG();
    const hashes = assertDistinctCapture({ normal: normalCapture, selected: selectedCapture, warning: warningCapture });
    const afterCapture = await warningState(window);
    assertWarningState(afterCapture, expectedWarning);
    const warningEvidence = { provenance, expectedWarning, beforeCapture, afterCapture, hashes,
      image: { width: image.getSize().width, height: image.getSize().height },
      capturedAt: new Date().toISOString(), manualVisualReview: 'PENDING: inspect actual warning pixels; distinct hashes alone are insufficient' };
    await writeFile(join(evidence, 'unsaved-asset-leave.png'), warningCapture);
    await writeFile(join(evidence, 'warning-capture.json'), JSON.stringify(warningEvidence, null, 2));
    console.log('DEV-020 step: guard screenshot written');
    await script(window, `[...document.querySelectorAll('#studio-asset-client button')].find(x=>x.textContent==='Keep editing').click()`);
    console.log('DEV-020 step: clicked Keep editing');
    await wait(100);
    const retained=await script(window, `document.body.classList.contains('view-studio') && document.querySelector('#studio-asset-client [data-focus=name]').value==='Unsaved synthetic metadata' && window.meridianStudioContext.snapshot().project?.id===${JSON.stringify(expectedWarning.projectId)}`);
    if(!retained) throw new Error('Keep editing did not retain the draft and Studio route.');
    console.log('DEV-020 step: Keep editing retained draft');
    console.log('DEV-020 step: attempt second leave');
    await script(window, "switchView('overview')");
    await until(window, "Boolean(document.querySelector('#studio-asset-client [aria-label=\"Unsaved host transition\"]'))", 'second unsaved prompt');
    console.log('DEV-020 step: second guard appeared');
    await script(window, `(() => { const button=[...document.querySelectorAll('#studio-asset-client button')].find(x=>x.textContent==='Discard changes and leave'); if(!button)throw new Error('Discard control missing'); setTimeout(()=>button.click(),0); return true; })()`);
    await wait(220);
    const afterDiscard = await script(window, `(() => ({
      stillInStudio: document.body.classList.contains('view-studio'),
      assetPrompt: !!document.querySelector('#studio-asset-client [aria-label="Unsaved host transition"]'),
      assetDraft: document.querySelector('#studio-asset-client [data-focus=name]')?.value,
      studioHidden: document.getElementById('studioCenter').hidden,
    }))()`);
    console.log('DEV-020 step: after discard', JSON.stringify(afterDiscard));
    if(afterDiscard.stillInStudio || afterDiscard.assetPrompt || afterDiscard.assetDraft === expectedWarning.fieldValue) throw new Error('Confirmed asset discard did not navigate and clear the draft: '+JSON.stringify(afterDiscard));
    console.log('DEV-020 step: discard-and-leave done');

    await script(window, "switchView('studio')");
    await until(window, "Boolean(document.querySelector('#studio-asset-client .sa-banner'))", 'Studio after return');
    await script(window, `(() => {
      const selector=document.querySelector('#studio-project-select');
      if(!selector || ![...selector.options].some(option=>option.value==='synthetic-field-notes')) throw new Error('Second accepted project missing');
      selector.value='synthetic-field-notes';
      selector.dispatchEvent(new Event('change',{bubbles:true}));
    })()`);
    await wait(250);
    const switchState = await script(window, `(() => ({
      context:window.meridianStudioContext.snapshot().project,
      projectHeader:document.querySelector('#studio-title')?.textContent,
      assetBanner:!!document.querySelector('#studio-asset-client .sa-banner'),
      inStudio:document.body.classList.contains('view-studio'),
      campaignPrompt:!!document.querySelector('#studio-leave-title'),
      assetPrompt:!!document.querySelector('#studio-asset-client [aria-label="Unsaved host transition"]'),
      projectPickerValue:document.querySelector('#studio-project-select')?.value,
    }))()`);
    console.log('DEV-020 step: Connect switch diagnostic', JSON.stringify(switchState));
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

    // Revoking the current project must clear an unsaved asset draft immediately,
    // not wait for a voluntary leave confirmation.
    window.webContents.setZoomFactor(1);
    await script(window, `(() => {
      const input=document.querySelector('#studio-asset-client input[type="file"]');
      const data=new DataTransfer();
      data.items.add(new File(['revoked project example'],'revoked-synthetic.txt',{type:'text/plain'}));
      input.files=data.files; input.dispatchEvent(new Event('change',{bubbles:true}));
    })()`);
    await until(window, "Boolean(document.querySelector('#studio-asset-client ul li button'))",'revoked project synthetic import');
    await script(window,"document.querySelector('#studio-asset-client ul li button').click()");
    await until(window,"Boolean(document.querySelector('#studio-asset-client [data-focus=name]'))",'revocation draft editor');
    await script(window,`(() => {
      const name=document.querySelector('#studio-asset-client [data-focus=name]');
      name.value='UNSAVED REVOKED PROJECT DRAFT';
      name.dispatchEvent(new Event('input',{bubbles:true}));
      const context=window.meridianStudioContext;
      const kept=context.snapshot().projects.find(p=>p.id==='synthetic-northstar');
      if(!kept || !context.acceptProjects([kept],context.beginProjectList()))throw new Error('Could not simulate accepted-project revocation');
    })()`);
    await until(window,"window.meridianStudioContext.snapshot().project===null && !document.querySelector('#studio-asset-client [data-focus=name]')",'immediate revocation cleanup');
    const revoked=await script(window,`(() => ({
      selected:window.meridianStudioContext.snapshot().project,
      retainedRevokedOption:[...document.querySelectorAll('#studio-project-select option')].some(p=>p.value==='synthetic-field-notes'),
      staleAssetDraft:document.querySelector('#studio-asset-client')?.textContent.includes('UNSAVED REVOKED PROJECT DRAFT'),
    }))()`);
    if(revoked.selected || revoked.retainedRevokedOption || revoked.staleAssetDraft)throw new Error('Revoked project remained visible or retained dirty asset state: '+JSON.stringify(revoked));
    console.log('DEV-020 step: revoked project and dirty asset cleared',JSON.stringify(revoked));

    // Voluntary sign-out differs from revocation: it must prompt before clearing.
    await script(window,`(() => {
      const selector=document.querySelector('#studio-project-select');
      selector.value='synthetic-northstar';selector.dispatchEvent(new Event('change',{bubbles:true}));
    })()`);
    await until(window,"window.meridianStudioContext.snapshot().project?.id==='synthetic-northstar' && Boolean(document.querySelector('#studio-asset-client input[type=file]'))",'project reselected after revocation');
    await script(window,`(() => {
      const input=document.querySelector('#studio-asset-client input[type=file]');
      const data=new DataTransfer();
      data.items.add(new File(['sign-out guard example'],'signout-synthetic.txt',{type:'text/plain'}));
      input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));
    })()`);
    await until(window, "Boolean(document.querySelector('#studio-asset-client ul li button'))",'signout synthetic import');
    await script(window, "document.querySelector('#studio-asset-client ul li button').click()");
    await until(window,"Boolean(document.querySelector('#studio-asset-client [data-focus=name]'))",'signout draft editor');
    await script(window,`(() => {
      const input=document.querySelector('#studio-asset-client [data-focus=name]');
      input.value='UNSAVED SIGNOUT DRAFT'; input.dispatchEvent(new Event('input',{bubbles:true}));
      document.querySelector('#btn-signout').click();
    })()`);
    await until(window, "Boolean(document.querySelector('#studio-asset-client [aria-label=\\\"Unsaved host transition\\\"]'))",'signout confirmation prompt');
    await script(window,"[...document.querySelectorAll('#studio-asset-client button')].find(b=>b.textContent==='Keep editing').click()");
    await wait(120);
    const signoutRetained=await script(window,"window.meridianStudioContext.snapshot().project?.id==='synthetic-northstar' && document.querySelector('#studio-asset-client [data-focus=name]')?.value==='UNSAVED SIGNOUT DRAFT' && document.getElementById('login-view').style.display !== 'flex'");
    if(!signoutRetained)throw new Error('Keep editing did not cancel voluntary sign-out');
    await script(window, "document.querySelector('#btn-signout').click()");
    await until(window, "Boolean(document.querySelector('#studio-asset-client [aria-label=\\\"Unsaved host transition\\\"]'))",'second signout confirmation');
    await script(window, `(() => { const b=[...document.querySelectorAll('#studio-asset-client button')].find(x=>x.textContent==='Discard changes and leave');setTimeout(()=>b.click(),0);return true;})()`);
    await until(window,"window.meridianStudioContext.snapshot().project===null && document.getElementById('login-view').style.display==='flex'",'confirmed voluntary signout');
    const signedOut=await script(window,`(() => ({
      selected:window.meridianStudioContext.snapshot().project,
      acceptedProjects:window.meridianStudioContext.snapshot().projects.length,
      exposedDraft:document.querySelector('#studio-asset-client')?.textContent.includes('UNSAVED SIGNOUT DRAFT'),
    }))()`);
    if(signedOut.selected || signedOut.acceptedProjects || signedOut.exposedDraft)throw new Error('Sign-out retained scoped client state: '+JSON.stringify(signedOut));
    console.log('DEV-020 step: guarded voluntary sign-out passed',JSON.stringify(signedOut));

    await writeFile(join(evidence,'runtime-results.json'),JSON.stringify({provenance,warningEvidence,initial,retained,project,scoped,zoom,revoked,signoutRetained,signedOut},null,2));
    console.log('DEV-020 isolated Electron smoke PASS',JSON.stringify({initial,retained,project,scoped,zoom,revoked,signoutRetained,signedOut}));
  } catch(error) {
    console.error('DEV-020 isolated Electron smoke FAIL',error.stack||String(error));
    failed=true;
  } finally {
    clearTimeout(watchdog);
    window.destroy();
    app.exit(failed ? 1 : 0);
  }
}).catch(error=>{console.error(error);app.exit(1);});
