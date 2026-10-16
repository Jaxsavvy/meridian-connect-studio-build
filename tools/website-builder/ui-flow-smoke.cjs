'use strict';
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const root = join(__dirname, '../..');
const evidence = join(root, 'ui-flow-evidence');
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
      assert.equal(result.audience, 'Independent local businesses');
      assert.match(result.saveText, /Unsaved changes/);
      assert.equal(result.fits, true);
      await capture(window, '02-' + step + '-1440');
    }
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
    await window.webContents.executeJavaScript(`(() => {
      const input=document.querySelector('#studio-asset-client [data-focus="name"]');
      input.value='UNSAVED COMBINED ASSET'; input.dispatchEvent(new Event('input',{bubbles:true}));
    })()`);
    await click(window, '[data-action="surface"][data-value="website"]');
    await waitFor(window, '#studio-asset-client [aria-label="Unsaved host transition"]');
    await capture(window, '05-composed-asset-warning');
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
    assert.equal((await metrics(window)).audience, 'Independent local businesses');

    window.setSize(1280, 900);
    window.webContents.setZoomFactor(2);
    await pause(200);
    for (const step of ['brief', 'pages', 'edit', 'preview']) {
      await click(window, '.website-flow-nav [data-value="' + step + '"]');
      assert.equal((await metrics(window)).fits, true, '200% fit: ' + step);
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
    await fs.writeFile(join(evidence, 'results.json'), JSON.stringify({ status: 'passed', media, employeeGate, lastMetrics: await metrics(window), verified: ['four panels', 'focus after navigation', 'modal keyboard wrapping', 'unsaved edits retained', 'phone width', 'sandbox preserved', 'dirty list guard', 'save/list/reopen', 'Website/Assets composed guards', 'synthetic scene references', 'scene-to-page provenance', 'unavailable authoritative handoff', 'all steps at 200%', 'emulated forced colors/reduced motion', 'employee gate'] }, null, 2));
    console.log('UI_FLOW_SMOKE_PASSED');
    app.exit(0);
  } catch (error) {
    if (window) await capture(window, 'failure').catch(() => {});
    console.error(error.stack || String(error));
    app.exit(1);
  }
});
