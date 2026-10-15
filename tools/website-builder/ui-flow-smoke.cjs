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
  await window.webContents.executeJavaScript('document.querySelector(' + JSON.stringify(selector) + ').click()');
  await pause(80);
}
async function capture(window, name) {
  window.webContents.invalidate();
  await pause(180);
  await window.webContents.capturePage();
  await pause(120);
  const image = await window.webContents.capturePage();
  await fs.writeFile(join(evidence, name + '.png'), image.toPNG());
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
      width: 1440, height: 1000, show: false, backgroundColor: '#07101d',
      webPreferences: {
        preload: join(root, 'docs/studio/design/9/runtime-preload.cjs'),
        contextIsolation: true, nodeIntegration: false, sandbox: false,
        additionalArguments: ['--studio-evidence-mode=development'],
      },
    });
    await window.loadFile(join(root, 'src/renderer/index.html'));
    await waitFor(window, '#projectsMasterList .project-item');
    await pause(500);
    await window.webContents.executeJavaScript("switchView('studio')");
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
    await click(window, '[data-action="keep-editing"]');
    assert.equal((await metrics(window)).audience, 'Independent local businesses');
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
    await fs.writeFile(join(evidence, 'results.json'), JSON.stringify({ status: 'passed', lastMetrics: await metrics(window), verified: ['four panels', 'focus after navigation', 'unsaved edits retained', 'phone width', 'sandbox preserved', 'dirty list guard', 'save/list/reopen', 'all steps at 200%'] }, null, 2));
    console.log('UI_FLOW_SMOKE_PASSED');
    app.exit(0);
  } catch (error) {
    if (window) await capture(window, 'failure').catch(() => {});
    console.error(error.stack || String(error));
    app.exit(1);
  }
});
