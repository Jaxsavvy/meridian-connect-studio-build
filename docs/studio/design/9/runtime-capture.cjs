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
    await pause(700);
    await window.webContents.executeJavaScript("switchView('studio')");
    await waitForSelector(window, '#studioCenter:not([hidden]) .studio-campaign');
    await pause(250);
    await capture(window, 'studio-operations-1440x1000.png');

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
    }))()`);

    await window.webContents.executeJavaScript("document.querySelector('[data-action=surface][data-value=states]').click()");
    await waitForSelector(window, '[data-surface=states]');
    await capture(window, 'studio-states-1440x1000.png');

    await window.webContents.executeJavaScript(`(() => {
      document.querySelector('[data-action=surface][data-value=editor]').click();
      const notes = document.querySelector('#studio-scene-notes');
      notes.value += ' Unsaved runtime evidence.';
      notes.dispatchEvent(new Event('input', { bubbles: true }));
      switchView('overview');
    })()`);
    await waitForSelector(window, '#studio-leave-title');
    await capture(window, 'studio-unsaved-leave-1440x1000.png');
    await window.webContents.executeJavaScript("document.querySelector('[data-action=keep-editing]').click(); document.querySelector('[data-action=surface][data-value=operations]').click()");

    window.setSize(1280, 900);
    window.webContents.setZoomFactor(2);
    await window.webContents.executeJavaScript("document.querySelector('[data-action=surface][data-value=operations]').click()");
    await waitForSelector(window, '[data-surface=operations]');
    await pause(300);
    await capture(window, 'studio-operations-1280x900-200pct.png');
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
    await writeFile(join(evidenceDirectory, 'runtime-results.json'), JSON.stringify({ standardMetrics, zoomMetrics, employeeMetrics }, null, 2) + '\n');
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
