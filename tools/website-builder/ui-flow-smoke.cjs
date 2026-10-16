'use strict';
const { app, BrowserWindow, nativeTheme } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const root = join(__dirname, '../..');
const evidence = process.env.MERIDIAN_UI_FLOW_EVIDENCE || join(root, 'ui-flow-evidence');
const requireOSHighContrast = process.env.MERIDIAN_REQUIRE_OS_HIGH_CONTRAST === '1';
const compositionMode = process.env.MERIDIAN_ASSET_COMPOSITION === '1';
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('force-color-profile', 'srgb');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitFor(window, selector) {
  for (let i = 0; i < 160; i++) {
    if (await window.webContents.executeJavaScript('Boolean(document.querySelector(' + JSON.stringify(selector) + '))')) return;
    await pause(50);
  }
  throw Error('Missing ' + selector);
}
async function click(window, selector) {
  await waitFor(window, selector);
  await window.webContents.executeJavaScript('document.querySelector(' + JSON.stringify(selector) + ').focus(); document.querySelector(' + JSON.stringify(selector) + ').click()');
  await pause(80);
}
async function capture(window, name) {
  window.webContents.invalidate();
  await window.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  await pause(180);
  await window.webContents.capturePage();
  await pause(120);
  const image = await window.webContents.capturePage();
  await fs.writeFile(join(evidence, name + '.png'), image.toPNG());
}
async function until(window, condition) {
  for (let i = 0; i < 160; i++) {
    if (await window.webContents.executeJavaScript(condition)) return;
    await pause(50);
  }
  throw Error('Condition timed out: ' + condition);
}
async function metrics(window) {
  return window.webContents.executeJavaScript('(' + (() => ({
    visiblePanels: [...document.querySelectorAll('[data-website-panel]')].filter(panel => !panel.hidden && getComputedStyle(panel).display !== 'none').map(panel => panel.dataset.websitePanel),
    currentStep: document.querySelector('.website-flow-nav [aria-current="step"]')?.dataset.value,
    focusedId: document.activeElement?.id,
    usableHeight: document.querySelector('.studio-workspace').clientHeight >= innerHeight * .5,
    focusedHeadingVisible: (() => { const h=document.activeElement?.getBoundingClientRect(); const w=document.querySelector('.studio-workspace').getBoundingClientRect(); return h && h.top >= w.top && h.bottom <= w.bottom; })(),
    fits: ['.studio-workspace', '.studio-main', '.website-builder'].every(selector => {
      const el = document.querySelector(selector);
      return el && el.scrollWidth <= el.clientWidth + 1;
    }),
    unlabeledControls: [...document.querySelectorAll('.website-builder :is(input,select,textarea)')].filter(el => !(el.getAttribute('aria-label') || el.closest('label') || document.querySelector('label[for="' + el.id + '"]'))).length,
    saveText: document.querySelector('.website-flow-status')?.textContent,
    audience: document.querySelector('#website-brief-audience')?.value,
    frameSandbox: document.querySelector('.website-preview iframe')?.getAttribute('sandbox'),
  })).toString() + ')()');
}

app.whenReady().then(async () => {
  let window;
  try {
    if (requireOSHighContrast) {
      assert.equal(process.platform, 'win32');
      assert.equal(nativeTheme.shouldUseHighContrastColors, true, 'Actual Windows High Contrast must be enabled before launch');
    }
    await fs.mkdir(evidence, { recursive: true });
    app.setPath('userData', await fs.mkdtemp(join(tmpdir(), 'meridian-ui-flow-')));
    window = new BrowserWindow({
      width: 1440, height: 1000, show: true, backgroundColor: '#07101d',
      webPreferences: {
        preload: join(root, 'docs/studio/design/9/runtime-preload.cjs'),
        contextIsolation: true, nodeIntegration: false, sandbox: false, backgroundThrottling: false,
        additionalArguments: ['--studio-evidence-mode=development'],
      },
    });
    await window.loadFile(join(root, 'src/renderer/index.html'));
    if (requireOSHighContrast) assert.equal(await window.webContents.executeJavaScript("matchMedia('(forced-colors: active)').matches"), true, 'Actual OS colors must reach the renderer before any emulation');
    await waitFor(window, '#projectsMasterList .project-item');
    await pause(500);
    await window.webContents.executeJavaScript("switchView('studio')");
    await waitFor(window, '#studio-current-work-title');
    await capture(window, '00-project-overview');
    await click(window, '[data-action="surface"][data-value="website"]');
    await waitFor(window, '#website-new-name');
    await window.webContents.executeJavaScript("document.querySelector('#website-new-name').value = 'Northstar Website — UI Flow Review'");
    await click(window, '[data-action="website-create"]');
    let result = await metrics(window);
    assert.deepEqual(result.visiblePanels, ['brief']);
    assert.equal(result.currentStep, 'brief');
    assert.equal(result.unlabeledControls, 0);
    await capture(window, '01-brief-1440');
    await window.webContents.executeJavaScript("const input = document.querySelector('#website-brief-audience'); input.value = 'Independent local businesses'; input.dispatchEvent(new Event('input', { bubbles: true }));");
    for (const [step, heading] of [['pages', 'website-sitemap-title'], ['edit', 'website-page-editor-title'], ['preview', 'website-preview-title']]) {
      await click(window, '.website-flow-nav [data-value="' + step + '"]');
      result = await metrics(window);
      assert.deepEqual(result.visiblePanels, [step]);
      assert.equal(result.currentStep, step);
      assert.equal(result.focusedId, heading);
      assert.equal(result.focusedHeadingVisible, true);
      assert.equal(result.audience, 'Independent local businesses');
      assert.match(result.saveText, /Unsaved changes/);
      assert.equal(result.fits, true);
      if (step === 'edit') {
        const retainedScroll = await window.webContents.executeJavaScript(`(() => {
          const field=document.querySelector('[data-website-section][data-field="body"]');
          field.focus(); field.scrollIntoView({block:'center'});
          const before=document.querySelector('.studio-workspace').scrollTop;
          field.value += ' Runtime edit retained.'; field.dispatchEvent(new Event('input',{bubbles:true}));
          return {before,after:document.querySelector('.studio-workspace').scrollTop,focused:document.activeElement.dataset.field};
        })()`);
        assert.ok(retainedScroll.before > 0);
        assert.ok(Math.abs(retainedScroll.before-retainedScroll.after) <= 2);
        assert.equal(retainedScroll.focused,'body');
      }
      await capture(window, '02-' + step + '-1440');
    }
    // Actual renderer controls and a real Electron download, not model-only evidence.
    await click(window, '.website-flow-nav [data-value="brief"]');
    await window.webContents.executeJavaScript(`(() => {
      const accent=document.querySelector('#website-design-accent'); accent.value='#16715a'; accent.dispatchEvent(new Event('change',{bubbles:true}));
      const font=document.querySelector('#website-design-font'); font.value='serif'; font.dispatchEvent(new Event('change',{bubbles:true}));
    })()`);
    await capture(window, '10-global-styles');
    await click(window, '.website-flow-nav [data-value="pages"]');
    await window.webContents.executeJavaScript("document.querySelector('#website-page-name').value='Services'");
    await click(window, '[data-action="website-add-page"]');
    await click(window, '[data-action="website-move-page-up"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('.website-page span').textContent"), 'Services');
    await click(window, '[data-action="website-remove-page"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelectorAll('.website-page').length"), 1);
    await click(window, '[data-action="website-undo"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelectorAll('.website-page').length"), 2);
    await window.webContents.executeJavaScript("document.querySelector('[data-website-panel=pages] .website-item-actions').scrollIntoView({block:'center'})");
    await capture(window, '11-page-management');
    await click(window, '.website-flow-nav [data-value="edit"]');
    await window.webContents.executeJavaScript("document.querySelector('#website-section-type').value='cta'");
    await click(window, '[data-action="website-add-section"]');
    await click(window, '.website-section-card:last-child [data-action="website-move-section-up"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('.website-section-card .studio-pill').textContent"), 'cta');
    await click(window, '.website-section-card:first-child [data-action="website-remove-section"]');
    await click(window, '[data-action="website-undo"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelectorAll('.website-section-card').length"), 2);
    await window.webContents.executeJavaScript("document.querySelector('.website-section-card').scrollIntoView({block:'start'})");
    await capture(window, '12-section-management');
    await click(window, '.website-flow-nav [data-value="preview"]');
    const previewPages = await window.webContents.executeJavaScript("[...document.querySelector('#website-preview-page').options].map(o=>({id:o.value,title:o.textContent}))");
    for (const page of previewPages) {
      await window.webContents.executeJavaScript(`(() => { const control=document.querySelector('#website-preview-page'); control.focus(); control.value=${JSON.stringify(page.id)}; control.dispatchEvent(new Event('change',{bubbles:true})); })()`);
      const preview = await window.webContents.executeJavaScript("({html:document.querySelector('.website-preview iframe').srcdoc,sandbox:document.querySelector('.website-preview iframe').getAttribute('sandbox'),focused:document.activeElement.id})");
      assert.equal(preview.sandbox, '');
      assert.equal(preview.focused, 'website-preview-page');
      assert.ok(preview.html.includes('<title>' + page.title));
      assert.ok(preview.html.includes('--accent:#16715a'));
      assert.ok(preview.html.includes('Georgia,serif'));
      assert.ok(!preview.html.includes('href="index.html"') && !preview.html.includes('href="services.html"'));
    }
    const download = new Promise((resolve, reject) => {
      const timer=setTimeout(()=>reject(Error('ZIP download timed out')),15000);
      window.webContents.session.once('will-download', (_event,item) => {
        const target=join(evidence,'synthetic-website.zip'); item.setSavePath(target);
        item.once('done',(_event,state)=>{clearTimeout(timer);state==='completed'?resolve({target,name:item.getFilename()}):reject(Error('ZIP download '+state));});
      });
    });
    await click(window, '[data-action="website-export-archive"]');
    const downloaded=await download;
    const zip=await fs.readFile(downloaded.target);
    assert.equal(zip.readUInt32LE(0),0x04034b50);
    assert.equal(zip.readUInt16LE(zip.length-12),2);
    assert.match(zip.toString('utf8'),/href="services.html"/);
    assert.match(zip.toString('utf8'),/href="index.html"/);
    await fs.writeFile(join(evidence,'website-management.json'),JSON.stringify({status:'passed',previewPages,download:{name:downloaded.name,bytes:zip.length,sha256:require('node:crypto').createHash('sha256').update(zip).digest('hex')},sandbox:'',globalStyle:{accent:'#16715a',font:'serif'},verified:['page reorder/remove/undo','section type/reorder/remove/undo','every preview page','actual ZIP download']},null,2));
    await capture(window, '13-multipage-preview');
    await click(window, '[data-action="website-device"][data-value="phone"]');
    assert.equal((await metrics(window)).frameSandbox, '');
    const phoneWidth = await window.webContents.executeJavaScript("document.querySelector('.website-preview iframe').getBoundingClientRect().width");
    assert.ok(phoneWidth <= 376);
    await capture(window, '03-phone-preview');
    await click(window, '[data-action="website-list"]');
    await waitFor(window, '#studio-leave-title');
    assert.equal(await window.webContents.executeJavaScript("document.activeElement.dataset.action"), 'keep-editing');
    await window.webContents.executeJavaScript(`(() => {
      document.querySelector('[data-action="save-leave"]').focus();
      document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
    })()`);
    assert.equal(await window.webContents.executeJavaScript("document.activeElement.dataset.action"), 'keep-editing');
    await click(window, '[data-action="keep-editing"]');
    assert.equal((await metrics(window)).audience, 'Independent local businesses');

    // Exercise the composed Website -> mounted Assets -> Website guards in the
    // real renderer, not a shell-only or mocked Asset client.
    await window.webContents.executeJavaScript(`(() => {
      const input=document.querySelector('#website-brief-audience');
      input.value='Combined guard retained content'; input.dispatchEvent(new Event('input',{bubbles:true}));
    })()`);
    await click(window, '[data-action="surface"][data-value="assets"]');
    await waitFor(window, '#studio-leave-title');
    const modalFocus = await window.webContents.executeJavaScript("document.activeElement.dataset.action");
    assert.equal(modalFocus, 'keep-editing');
    await click(window, '[data-action="keep-editing"]');
    assert.equal((await metrics(window)).audience, 'Combined guard retained content');
    await click(window, '[data-action="surface"][data-value="assets"]');
    await click(window, '[data-action="save-leave"]');
    await waitFor(window, '#studio-asset-client input[type="file"]');
    await window.webContents.executeJavaScript(`(() => {
      const file=document.querySelector('#studio-asset-client input[type="file"]');
      const transfer=new DataTransfer(); transfer.items.add(new File(['synthetic integration'],'integration-notes.txt',{type:'text/plain'}));
      file.files=transfer.files; file.dispatchEvent(new Event('change',{bubbles:true}));
    })()`);
    await click(window, '#studio-asset-client ul li button');
    await waitFor(window, '#studio-asset-client [data-focus="name"]');
    if (compositionMode) {
      const tokens = await window.webContents.executeJavaScript(`(() => {
        const host=document.querySelector('#studio-asset-client');const field=host.querySelector('[data-focus=name]');
        return {color:getComputedStyle(host).color,panel:getComputedStyle(host).backgroundColor,border:getComputedStyle(field).borderTopColor,font:getComputedStyle(host).fontFamily,
          forcedColors:matchMedia('(forced-colors:active)').matches,continuationHelper:typeof StudioAssetModel.assertContinuation,
          resultCount:[...host.querySelectorAll('[role=status]')].some(el=>el.textContent==='1 matching asset.')};
      })()`);
      assert.equal(tokens.continuationHelper,'function');
      assert.equal(tokens.resultCount,true);
      if (!tokens.forcedColors) {
        assert.equal(tokens.color,'rgb(242, 246, 251)');
        assert.equal(tokens.panel,'rgb(14, 27, 46)');
        assert.equal(tokens.border,'rgb(166, 181, 202)');
      }
      assert.match(tokens.font,/Inter/);
      await window.webContents.executeJavaScript("document.querySelector('#studio-asset-client [data-focus=name]').focus()");
      window.webContents.sendInputEvent({type:'keyDown',keyCode:'Tab'});
      window.webContents.sendInputEvent({type:'keyUp',keyCode:'Tab'});
      await pause(80);
      assert.equal(await window.webContents.executeJavaScript('document.activeElement.dataset.focus'),'tags');
      await fs.writeFile(join(evidence,'composition-tokens.json'),JSON.stringify(tokens,null,2));
      await window.webContents.executeJavaScript("document.querySelector('#studio-asset-client [data-focus=name]').scrollIntoView({block:'center'})");
      await capture(window,'14-composed-asset-tokens');
    }
    await window.webContents.executeJavaScript(`(() => {
      const input=document.querySelector('#studio-asset-client [data-focus="name"]');
      input.value='UNSAVED COMBINED ASSET'; input.dispatchEvent(new Event('input',{bubbles:true}));
    })()`);
    await click(window, '[data-action="surface"][data-value="website"]');
    await waitFor(window, '#studio-asset-client [aria-label="Unsaved host transition"]');
    await capture(window, '05-composed-asset-warning');
    if (compositionMode) {
      await window.webContents.executeJavaScript("document.querySelector('#studio-asset-client [aria-label=\"Unsaved host transition\"] button').focus()");
      window.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});
      window.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});
      await until(window,"!document.querySelector('#studio-asset-client [aria-label=\"Unsaved host transition\"]')");
      assert.equal(await window.webContents.executeJavaScript('document.activeElement.dataset.focus'),'name');
      assert.equal(await window.webContents.executeJavaScript("document.querySelector('#studio-asset-client [data-focus=name]').value"),'UNSAVED COMBINED ASSET');
      await click(window,'[data-action="surface"][data-value="website"]');
      await waitFor(window,'#studio-asset-client [aria-label="Unsaved host transition"]');
      await fs.writeFile(join(evidence,'composition-keyboard.json'),JSON.stringify({actualTab:'name to tags',actualEscape:'inline warning cancelled, dirty value retained, focus name',source:'Pinned composition manifest in test-output/composition/inputs.json',limits:'Not Narrator speech; not a modal/inert claim'},null,2));
    }
    await window.webContents.executeJavaScript("[...document.querySelectorAll('#studio-asset-client button')].find(x=>x.textContent==='Keep editing').click()");
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('#studio-asset-client [data-focus=name]').value"), 'UNSAVED COMBINED ASSET');
    await click(window, '[data-action="surface"][data-value="website"]');
    await until(window, "Boolean(document.querySelector('#studio-asset-client [aria-label=\"Unsaved host transition\"]'))");
    await window.webContents.executeJavaScript("[...document.querySelectorAll('#studio-asset-client button')].find(x=>x.textContent==='Discard changes and leave').click()");
    await waitFor(window, '#website-brief-audience');
    assert.equal((await metrics(window)).audience, 'Combined guard retained content');

    await click(window, '[data-action="surface"][data-value="editor"]');
    await waitFor(window, '#studio-scene-title');
    await window.webContents.executeJavaScript(`(() => {
      const input=document.querySelector('#studio-scene-title');
      input.value='Combined scene proof'; input.dispatchEvent(new Event('input',{bubbles:true}));
    })()`);
    await click(window, '[data-action="asset-select"][data-value="asset-ridge"]');
    await click(window, '[data-action="asset-place"]');
    await click(window, '[data-action="save"]');
    await until(window, "[...document.querySelectorAll('.studio-save-cluster .studio-pill')].some(x=>x.textContent==='Saved')");
    await capture(window, '06-storyboard-material');
    await click(window, '[data-action="scene-to-website"]');
    await waitFor(window, '#website-page-editor-title');
    assert.equal((await metrics(window)).currentStep, 'edit');
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('#website-page-title').value"), 'Combined scene proof');
    await click(window, '[data-action="website-save"]');
    await click(window, '[data-action="surface"][data-value="handoff"]');
    await waitFor(window, '#studio-handoff-title');
    assert.equal(await window.webContents.executeJavaScript("document.querySelectorAll('[data-surface=handoff] button:disabled').length"), 3);
    await capture(window, '07-review-handoff');
    await click(window, '[data-action="surface"][data-value="website"]');
    await click(window, '[data-action="website-save"]');
    assert.match((await metrics(window)).saveText, /Saved in this app/);
    await click(window, '[data-action="website-list"]');
    await click(window, '[data-action="website-open"]');
    assert.equal((await metrics(window)).currentStep, 'brief');
    assert.equal((await metrics(window)).audience, 'Combined guard retained content');

    window.setSize(1280, 900);
    window.webContents.setZoomFactor(2);
    await pause(200);
    for (const step of ['brief', 'pages', 'edit', 'preview']) {
      await click(window, '.website-flow-nav [data-value="' + step + '"]');
      assert.equal((await metrics(window)).fits, true, '200% fit: ' + step);
      assert.equal((await metrics(window)).usableHeight, true, '200% usable editor height: ' + step);
      assert.equal((await metrics(window)).focusedHeadingVisible, true, '200% focused heading visible: ' + step);
    }
    await capture(window, '04-preview-200pct');
    window.webContents.debugger.attach('1.3');
    await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{name:'prefers-reduced-motion',value:'reduce'}, {name:'forced-colors',value:'active'}] });
    const media = await window.webContents.executeJavaScript("({reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,forcedColors:matchMedia('(forced-colors: active)').matches})");
    assert.equal(media.reducedMotion, true); assert.equal(media.forcedColors, true);
    await capture(window, '08-emulated-forced-colors');
    window.webContents.debugger.detach();
    const employee = new BrowserWindow({width:1440,height:1000,show:true,webPreferences:{preload:join(root,'docs/studio/design/9/runtime-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:false,additionalArguments:['--studio-evidence-mode=employee']}});
    await employee.loadFile(join(root,'src/renderer/index.html'));
    await waitFor(employee,'#projectsMasterList .project-item');
    await employee.webContents.executeJavaScript("switchView('studio')");
    const employeeGate = await employee.webContents.executeJavaScript(`({disabled:document.querySelector('#nav-studio-link').disabled,hidden:document.querySelector('#studioCenter').hidden,syntheticLoaded:[...document.scripts].some(s=>s.src.includes('studio-ui/studio-shell.js'))})`);
    assert.equal(employeeGate.disabled,true); assert.equal(employeeGate.hidden,true); assert.equal(employeeGate.syntheticLoaded,false);
    await capture(employee,'09-employee-unavailable'); employee.destroy();
    await fs.writeFile(join(evidence, 'results.json'), JSON.stringify({ status: 'passed', osHighContrast: { required: requireOSHighContrast, enabled: nativeTheme.shouldUseHighContrastColors }, media, employeeGate, lastMetrics: await metrics(window), verified: ['four panels', 'focus after navigation', 'modal keyboard wrapping', 'unsaved edits retained', 'phone width', 'sandbox preserved', 'dirty list guard', 'save/list/reopen', 'Website/Assets composed guards', 'synthetic scene references', 'scene-to-page provenance', 'unavailable authoritative handoff', 'all steps at 200%', 'emulated forced colors/reduced motion', 'employee gate'] }, null, 2));
    console.log('UI_FLOW_SMOKE_PASSED');
    app.exit(0);
  } catch (error) {
    if (window) await capture(window, 'failure').catch(() => {});
    console.error(error.stack || String(error));
    app.exit(1);
  }
});
