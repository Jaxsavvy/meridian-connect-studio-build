'use strict';

const { app, BrowserWindow } = require('electron');
const { mkdir, writeFile } = require('node:fs/promises');
const { join } = require('node:path');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('force-color-profile', 'srgb');

const evidenceDirectory = join(__dirname, 'renders');
const renderer = join(__dirname, '..', '..', '..', '..', 'src', 'renderer', 'index.html');

async function pause(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function capture(window, filename) {
  window.webContents.invalidate();
  await pause(180);
  await window.webContents.capturePage();
  await pause(120);
  const image = await window.webContents.capturePage();
  await writeFile(join(evidenceDirectory, filename), image.toPNG());
}

async function waitForSelector(window, selector, timeout = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const found = await window.webContents.executeJavaScript(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
    if (found) return;
    await pause(50);
  }
  throw new Error(`Timed out waiting for ${selector}`);
}

app.whenReady().then(async () => {
  await mkdir(evidenceDirectory, { recursive: true });
  const window = new BrowserWindow({
    width: 1440,
    height: 1000,
    show: false,
    backgroundColor: '#07101d',
    webPreferences: {
      preload: join(__dirname, 'runtime-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      additionalArguments: ['--studio-evidence-mode=development'],
    },
  });
  let employeeWindow = null;

  try {
    await window.loadFile(renderer);
    window.webContents.setZoomFactor(1);
    await waitForSelector(window, '#projectsMasterList .project-item');
    await window.webContents.executeJavaScript(`(() => {
      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index);
        if (key && key.startsWith('meridian.website.')) localStorage.removeItem(key);
      }
    })()`);
    await pause(700);
    await window.webContents.executeJavaScript("switchView('studio')");
    await waitForSelector(window, '#studioCenter:not([hidden]) .studio-campaign');
    await pause(250);
    await capture(window, 'studio-operations-1440x1000.png');

    await window.webContents.executeJavaScript(`(() => {
      const opener = document.querySelector('[data-action="tool-detail"]');
      opener.focus();
      opener.click();
    })()`);
    await waitForSelector(window, '.studio-modal[role="dialog"]');
    await pause(80);
    const toolDialogOpenMetrics = await window.webContents.executeJavaScript(`(() => ({
      ariaModal: document.querySelector('.studio-modal').getAttribute('aria-modal'),
      localNavigationInert: document.querySelector('.studio-local-nav').inert,
      workspaceInert: document.querySelector('.studio-workspace').inert,
      initialFocusAction: document.activeElement.dataset.action,
    }))()`);
    await window.webContents.executeJavaScript(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))`);
    await pause(100);
    const toolDialogCloseMetrics = await window.webContents.executeJavaScript(`(() => ({
      dialogClosed: !document.querySelector('.studio-modal'),
      focusReturnedToOpener: document.activeElement.matches('[data-action="tool-detail"]'),
    }))()`);

    await window.webContents.executeJavaScript("document.querySelector('[data-action=continue-campaign]').click()");
    await waitForSelector(window, '[data-surface=editor]');
    await pause(200);
    await capture(window, 'studio-editor-1440x1000.png');

    await window.webContents.executeJavaScript("document.querySelector('[data-action=surface][data-value=assets]').click()");
    await waitForSelector(window, '[data-surface=assets]');
    await pause(200);
    await capture(window, 'studio-assets-1440x1000.png');

    const standardMetrics = await window.webContents.executeJavaScript(`(() => ({
      viewport: { width: innerWidth, height: innerHeight, zoom: 1 },
      documentFitsHorizontally: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      workspaceFitsHorizontally: document.querySelector('.studio-workspace').scrollWidth <= document.querySelector('.studio-workspace').clientWidth,
      tools: window.meridianStudioContext.snapshot().tools.map(tool => ({ id: tool.id, availability: tool.availability })),
      unnamedButtons: [...document.querySelectorAll('#studioCenter button')].filter(button => !(button.getAttribute('aria-label') || button.textContent.trim())).length,
      unlabeledFormControls: [...document.querySelectorAll('#studioCenter input, #studioCenter select, #studioCenter textarea')].filter(control => !(control.getAttribute('aria-label') || document.querySelector('label[for="' + control.id + '"]'))).map(control => control.id),
      assetResultCountIsLive: document.querySelector('#studio-results-title').getAttribute('aria-live') === 'polite',
    }))()`);

    await window.webContents.executeJavaScript("document.querySelector('[data-action=surface][data-value=states]').click()");
    await waitForSelector(window, '[data-surface=states]');
    await capture(window, 'studio-states-1440x1000.png');

    await window.webContents.executeJavaScript(`(() => {
      document.querySelector('[data-action=surface][data-value=editor]').click();
      const notes = document.querySelector('#studio-scene-notes');
      notes.focus();
      notes.value += ' Unsaved runtime evidence.';
      notes.dispatchEvent(new Event('input', { bubbles: true }));
      switchView('overview');
    })()`);
    await waitForSelector(window, '#studio-leave-title');
    await capture(window, 'studio-unsaved-leave-1440x1000.png');
    const leaveDialogOpenMetrics = await window.webContents.executeJavaScript(`(() => {
      const keepEditing = document.querySelector('[data-action="keep-editing"]');
      const saveAndLeave = document.querySelector('[data-action="save-leave"]');
      keepEditing.focus();
      keepEditing.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
      const shiftTabWraps = document.activeElement === saveAndLeave;
      saveAndLeave.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
      return {
        localNavigationInert: document.querySelector('.studio-local-nav').inert,
        workspaceInert: document.querySelector('.studio-workspace').inert,
        shiftTabWraps,
        tabWraps: document.activeElement === keepEditing,
      };
    })()`);
    await window.webContents.executeJavaScript("document.querySelector('[data-action=keep-editing]').click()");
    await pause(100);
    const leaveDialogCloseMetrics = await window.webContents.executeJavaScript(`(() => ({
      dialogClosed: !document.querySelector('.studio-modal'),
      focusReturnedToEditor: document.activeElement.id === 'studio-scene-notes',
    }))()`);
    await window.webContents.executeJavaScript("document.querySelector('[data-action=surface][data-value=operations]').click()");

    await window.webContents.executeJavaScript("document.querySelector('[data-action=surface][data-value=website]').click()");
    await waitForSelector(window, '[data-surface=website]');
    await window.webContents.executeJavaScript(`(() => {
      const input = document.querySelector('#website-new-name');
      if (!input) return;
      input.value = 'Summit Roofing Website';
      document.querySelector('[data-action="website-create"]').click();
    })()`);
    await waitForSelector(window, '#website-brief-audience');
    for (const [selector, value] of [
      ['#website-brief-audience', 'Oregon homeowners planning roof replacement'],
      ['#website-brief-goal', 'Build trust and request an estimate'],
      ['#website-brief-tone', 'Clear, capable, neighborly'],
      ['#website-brief-offer', 'No-pressure roof assessment'],
    ]) {
      await window.webContents.executeJavaScript(`(() => { const input = document.querySelector(${JSON.stringify(selector)}); input.value = ${JSON.stringify(value)}; input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    }
    await window.webContents.executeJavaScript(`(() => {
      const input = document.querySelector('#website-page-name');
      input.value = 'Services';
      document.querySelector('[data-action="website-add-page"]').click();
    })()`);
    await waitForSelector(window, '#website-page-title');
    await window.webContents.executeJavaScript(`(() => {
      const heading = document.querySelector('[data-website-section][data-field="heading"]');
      heading.value = 'Roofing built for Northwest weather';
      heading.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('[data-action="website-save"]').click();
    })()`);
    await pause(200);
    await capture(window, 'website-builder-editor-1440x1000.png');
    await window.webContents.executeJavaScript("document.querySelector('.studio-workspace').scrollTop = document.querySelector('.studio-workspace').scrollHeight");
    await pause(180);
    await capture(window, 'website-builder-preview-1440x1000.png');
    await window.webContents.executeJavaScript("document.querySelector('.studio-workspace').scrollTop = 0");
    const websiteMetrics = await window.webContents.executeJavaScript(`(() => ({
      saved: document.querySelector('.website-builder .studio-kicker').textContent.includes('Saved locally'),
      pageCount: document.querySelectorAll('.website-page').length,
      sectionCount: document.querySelectorAll('.website-section-card').length,
      previewSandboxed: document.querySelector('.website-preview iframe').hasAttribute('sandbox'),
      previewHasRenderedBody: document.querySelector('.website-preview iframe').srcdoc.includes('Roofing built for Northwest weather'),
      documentFitsHorizontally: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      workspaceFitsHorizontally: document.querySelector('.studio-workspace').scrollWidth <= document.querySelector('.studio-workspace').clientWidth,
      unlabeledControls: [...document.querySelectorAll('.website-builder input, .website-builder textarea, .website-builder select')].filter(control => !(control.getAttribute('aria-label') || document.querySelector('label[for="' + control.id + '"]') || control.closest('label'))).map(control => control.id),
    }))()`);

    await window.webContents.reload();
    await waitForSelector(window, '#projectsMasterList .project-item');
    await pause(500);
    await window.webContents.executeJavaScript("switchView('studio')");
    await waitForSelector(window, '#studioCenter:not([hidden]) [data-action="surface"][data-value="website"]');
    await window.webContents.executeJavaScript("document.querySelector('[data-action=surface][data-value=website]').click()");
    await waitForSelector(window, '[data-action="website-open"]');
    const websiteListMetrics = await window.webContents.executeJavaScript(`(() => ({
      projectName: document.querySelector('.website-project-list h3').textContent,
      projectCount: document.querySelectorAll('.website-project-list article').length,
    }))()`);
    await window.webContents.executeJavaScript("document.querySelector('[data-action=website-open]').click()");
    await waitForSelector(window, '#website-brief-audience');
    const websiteReopenMetrics = await window.webContents.executeJavaScript(`(() => ({
      audience: document.querySelector('#website-brief-audience').value,
      pageCount: document.querySelectorAll('.website-page').length,
      selectedPage: document.querySelector('.website-page[aria-current="page"] span').textContent,
    }))()`);
    await capture(window, 'website-builder-reopened-1440x1000.png');
    await window.webContents.executeJavaScript(`(() => {
      const input = document.querySelector('#website-brief-tone');
      input.value += ' and reassuring';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      switchView('overview');
    })()`);
    await waitForSelector(window, '#studio-leave-title');
    const websiteLeaveMetrics = await window.webContents.executeJavaScript(`(() => ({
      dialogOpen: Boolean(document.querySelector('#studio-leave-title')),
      identifiesWebsiteChanges: document.querySelector('#studio-leave-title').textContent.includes('website changes'),
      hasSaveChoice: Boolean(document.querySelector('[data-action="save-leave"]')),
      hasDiscardChoice: Boolean(document.querySelector('[data-action="discard-leave"]')),
    }))()`);
    await window.webContents.executeJavaScript("document.querySelector('[data-action=keep-editing]').click(); document.querySelector('[data-action=website-save]').click()");
    await waitForSelector(window, '[data-surface=website]');

    window.setSize(1280, 900);
    window.webContents.setZoomFactor(2);
    await waitForSelector(window, '[data-surface=website]');
    await pause(300);
    await capture(window, 'website-builder-1280x900-200pct.png');
    const zoomMetrics = await window.webContents.executeJavaScript(`(() => ({
      viewport: { width: innerWidth, height: innerHeight, zoom: 2 },
      documentFitsHorizontally: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      workspaceFitsHorizontally: document.querySelector('.studio-workspace').scrollWidth <= document.querySelector('.studio-workspace').clientWidth,
      studioMainFitsHorizontally: document.querySelector('.studio-main').scrollWidth <= document.querySelector('.studio-main').clientWidth,
      projectName: document.querySelector('#studio-project-select').selectedOptions[0].textContent,
    }))()`);
    employeeWindow = new BrowserWindow({
      width: 1440,
      height: 1000,
      show: false,
      backgroundColor: '#07101d',
      webPreferences: {
        preload: join(__dirname, 'runtime-preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        additionalArguments: ['--studio-evidence-mode=employee'],
      },
    });
    await employeeWindow.loadFile(renderer);
    employeeWindow.webContents.setZoomFactor(1);
    await waitForSelector(employeeWindow, '#nav-studio-link[disabled]');
    await pause(900);
    await capture(employeeWindow, 'studio-employee-unavailable-1440x1000.png');
    const employeeMetrics = await employeeWindow.webContents.executeJavaScript(`(() => ({
      viewport: { width: innerWidth, height: innerHeight, zoom: 1 },
      studioNavigationDisabled: document.querySelector('#nav-studio-link').disabled,
      studioNavigationAvailability: document.querySelector('#nav-studio-link').dataset.availability,
      studioNavigationBadge: document.querySelector('#nav-studio-status').textContent,
      studioHostHidden: document.querySelector('#studioCenter').hidden,
      syntheticModulesLoaded: Boolean(window.MeridianStudioFixtures || window.MeridianStudioWorkspace || window.MeridianStudioUI),
      programmaticStudioRouteBlocked: (() => { switchView('studio'); return activeView !== 'studio' && document.querySelector('#studioCenter').hidden; })(),
    }))()`);
    const accessibilityMetrics = {
      toolDialog: { ...toolDialogOpenMetrics, ...toolDialogCloseMetrics },
      unsavedLeaveDialog: { ...leaveDialogOpenMetrics, ...leaveDialogCloseMetrics },
    };
    await writeFile(join(evidenceDirectory, 'runtime-results.json'), JSON.stringify({ standardMetrics, websiteMetrics, websiteListMetrics, websiteReopenMetrics, websiteLeaveMetrics, zoomMetrics, employeeMetrics, accessibilityMetrics }, null, 2) + '\n');
  } finally {
    if (!window.isDestroyed()) window.destroy();
    if (employeeWindow && !employeeWindow.isDestroyed()) employeeWindow.destroy();
    app.quit();
  }
}).catch(error => {
  console.error(error);
  app.exitCode = 1;
  app.quit();
});
