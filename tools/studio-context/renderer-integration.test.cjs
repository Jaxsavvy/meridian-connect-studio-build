'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { createStudioContext } = require('../../src/renderer/studio-context.js');

const renderer = join(__dirname, '..', '..', 'src', 'renderer');
const alpha = { id: 'a'.repeat(32), name: 'Synthetic Alpha' };
const beta = { id: 'b'.repeat(32), name: 'Synthetic Beta' };

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function element() {
  const children = [];
  let html = '';
  let content = '';
  return {
    style: {}, dataset: {}, children,
    get innerHTML() { return html; },
    set innerHTML(value) { html = value; content = ''; children.length = 0; },
    get textContent() { return content; },
    set textContent(value) { content = value; html = ''; children.length = 0; },
    appendChild(child) { children.push(child); return child; },
    replaceChildren() { children.length = 0; html = ''; content = ''; },
    addEventListener() {},
    querySelectorAll() { return []; },
  };
}

function appHarness() {
  const studio = createStudioContext();
  const elements = new Map();
  for (const id of ['login-view', 'login-password', 'nav-projects-count',
    'overview-projects-stat', 'overview-projects-count', 'projCountBadge',
    'dashboardProjectsList', 'projectsMasterList', 'dockMessages', 'text', 'dockSendBtn']) {
    elements.set(id, element());
  }
  const pending = [];
  let sends = 0;
  const document = {
    addEventListener() {},
    getElementById(id) { return elements.get(id) || null; },
    createElement: element,
    querySelectorAll() { return []; },
  };
  const window = { meridianStudioContext: studio, meridian: { api: {
    getProjects() { const request = deferred(); pending.push(request); return request.promise; },
    sendChatMessage() { sends += 1; return Promise.resolve({ success: false }); },
  } } };
  const context = vm.createContext({ document, window, console, Set, Date, Promise });
  vm.runInContext(readFileSync(join(renderer, 'app.js'), 'utf8'), context, { filename: 'app.js' });
  context.selectProject = () => {};
  return { context, studio, elements, pending, get sends() { return sends; } };
}

test('project refresh failure clears old cards and refuses a stale response', async () => {
  const h = appHarness();
  const first = h.context.loadProjects();
  h.pending[0].resolve({ success: true, data: [alpha] });
  await first;
  h.studio.selectProject(alpha.id);
  assert.equal(h.elements.get('projectsMasterList').children.length, 1);

  const stale = h.context.loadProjects();
  const latest = h.context.loadProjects();
  h.pending[2].resolve({ success: true, data: [beta] });
  await latest;
  h.pending[1].resolve({ success: false, error: 'Old offline response' });
  await stale;
  assert.equal(h.elements.get('projectsMasterList').children.length, 1);
  assert.equal(h.elements.get('projectsMasterList').children[0].dataset.id, beta.id);

  const failed = h.context.loadProjects();
  h.pending[3].resolve({ success: false, offline: true });
  await failed;
  assert.equal(h.studio.snapshot().project, null);
  assert.equal(h.elements.get('projectsMasterList').textContent, 'Projects could not be loaded.');
  assert.equal(h.elements.get('nav-projects-count').textContent, '0');
});

test('an empty authorized project list removes the previous selection and cards', async () => {
  const h = appHarness();
  const first = h.context.loadProjects();
  h.pending[0].resolve({ success: true, data: [alpha] });
  await first;
  h.studio.selectProject(alpha.id);

  const empty = h.context.loadProjects();
  h.pending[1].resolve({ success: true, data: [] });
  await empty;
  assert.equal(h.studio.snapshot().project, null);
  assert.equal(h.elements.get('projectsMasterList').textContent, 'No projects assigned.');
  assert.equal(h.elements.get('projectsMasterList').children.length, 0);
});

test('chat never sends a fabricated project ID when nothing is selected', async () => {
  const h = appHarness();
  h.context.setupChatHandlers();
  const input = h.elements.get('text');
  input.value = 'Synthetic question';
  await h.elements.get('dockSendBtn').onclick();
  assert.equal(h.sends, 0);
  assert.equal(input.value, 'Synthetic question');
  assert.equal(h.elements.get('dockMessages').children.length, 1);
  assert.equal(h.elements.get('dockMessages').children.at(-1).textContent,
    'Select a project before sending.');
});

test('sign-out prevents an in-flight project list from repopulating cards', async () => {
  const h = appHarness();
  const loading = h.context.loadProjects();
  h.context.showLogin();
  h.pending[0].resolve({ success: true, data: [alpha] });
  await loading;
  assert.equal(h.studio.snapshot().project, null);
  assert.equal(h.elements.get('projectsMasterList').textContent, 'Sign in to load projects.');
  assert.equal(h.elements.get('projectsMasterList').children.length, 0);
});

function workspaceHarness() {
  const studio = createStudioContext();
  studio.acceptProjects([alpha, beta], studio.beginProjectList());
  const root = element();
  const full = { value: false };
  root.closest = () => ({ classList: {
    add() { full.value = true; },
    remove() { full.value = false; },
  } });
  const pending = [];
  const document = {
    head: { appendChild() {} },
    body: { contains() { return false; } },
    addEventListener() {},
    getElementById(id) { return id === 'pw-host' ? root : null; },
    querySelectorAll() { return []; },
    createElement: element,
  };
  const window = { meridianStudioContext: studio, meridian: { api: {
    ws() { const request = deferred(); pending.push(request); return request.promise; },
  } } };
  const context = vm.createContext({ document, window, console, Date, Promise, URL });
  context.projects = [alpha, beta];
  context.currentProject = null;
  context.selectProject = () => {};
  vm.runInContext(readFileSync(join(renderer, 'project-workspace.js'), 'utf8'), context,
    { filename: 'project-workspace.js' });
  return { window, studio, root, pending, full };
}

test('old project responses cannot overwrite a switch away and back', async () => {
  const h = workspaceHarness();
  const oldAlpha = h.window.meridianWorkspace.open(alpha.id);
  h.studio.selectProject(beta.id);
  const onBeta = h.window.meridianWorkspace.open(beta.id);
  h.studio.selectProject(alpha.id);
  const newAlpha = h.window.meridianWorkspace.open(alpha.id);
  assert.equal(h.pending.length, 3);

  h.pending[2].resolve({ success: false, error: 'Latest response' });
  await newAlpha;
  h.pending[0].resolve({ success: false, error: 'Old Alpha response' });
  h.pending[1].resolve({ success: false, error: 'Old Beta response' });
  await Promise.all([oldAlpha, onBeta]);
  assert.match(h.root.innerHTML, /Latest response/);
  assert.doesNotMatch(h.root.innerHTML, /Old Alpha|Old Beta/);
});

test('an older same-project refresh cannot replace a newer render', async () => {
  const h = workspaceHarness();
  const first = h.window.meridianWorkspace.open(alpha.id);
  const second = h.window.meridianWorkspace.refresh();
  h.pending[1].resolve({ success: false, error: 'New response' });
  await second;
  h.pending[0].resolve({ success: false, error: 'Old response' });
  await first;
  assert.match(h.root.innerHTML, /New response/);
  assert.doesNotMatch(h.root.innerHTML, /Old response/);
});

test('workspace rejects a project payload with a different ID', async () => {
  const h = workspaceHarness();
  const loading = h.window.meridianWorkspace.open(alpha.id);
  h.pending[0].resolve({ success: true, project: beta });
  await loading;
  assert.match(h.root.innerHTML, /This project could not be loaded/);
  assert.doesNotMatch(h.root.innerHTML, /Synthetic Beta/);
});

test('sign-out clears the workspace and ignores its pending project response', async () => {
  const h = workspaceHarness();
  const loading = h.window.meridianWorkspace.open(alpha.id);
  h.studio.reset();
  h.pending[0].resolve({ success: false, error: 'Late response' });
  await loading;
  assert.equal(h.window.meridianWorkspace.current(), null);
  assert.equal(h.root.innerHTML, '');
  assert.equal(h.full.value, false);
});
