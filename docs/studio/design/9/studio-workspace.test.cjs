'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { createStudioContext } = require('../../../../src/renderer/studio-context.js');
const { createWorkspace } = require('../../../../src/renderer/studio-ui/studio-workspace.js');
const { createProjectFixture, createSyntheticAdapter } = require('../../../../src/renderer/studio-ui/studio-fixtures.js');

const alpha = { id: 'alpha-project', name: 'Synthetic Alpha Project With A Deliberately Long Name For Layout Verification' };
const beta = { id: 'beta-project', name: 'Synthetic Beta' };

function tick() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function contextWithProjects() {
  const context = createStudioContext();
  assert.equal(context.acceptProjects([alpha, beta], context.beginProjectList()), true);
  return context;
}

async function readyWorkspace(adapter = createSyntheticAdapter({ delay: 0 })) {
  const context = contextWithProjects();
  const events = [];
  const workspace = createWorkspace({ context, adapter, onChange: state => events.push(state) });
  context.selectProject(alpha.id);
  await tick();
  assert.equal(workspace.snapshot().phase, 'ready');
  return { context, workspace, events, adapter };
}

test('project selection loads a synthetic workspace without changing honest tool availability', async () => {
  const { context, workspace } = await readyWorkspace();
  assert.equal(workspace.snapshot().project.id, alpha.id);
  assert.equal(workspace.snapshot().data.developmentOnly, true);
  assert.equal(context.snapshot().tools.length, 9);
  assert.ok(context.snapshot().tools.every(tool => tool.availability === 'planned'));
  workspace.destroy();
});

test('late project results cannot overwrite a switch away and back', async () => {
  const context = contextWithProjects();
  const pending = [];
  const adapter = {
    load(project) { return new Promise(resolve => pending.push({ project, resolve })); },
    save(payload) { return Promise.resolve({ ...payload, savedAt: new Date(0).toISOString() }); },
  };
  const workspace = createWorkspace({ context, adapter });
  context.selectProject(alpha.id);
  context.selectProject(beta.id);
  context.selectProject(alpha.id);
  assert.equal(pending.length, 3);
  pending[2].resolve(createProjectFixture(alpha));
  await tick();
  pending[0].resolve(createProjectFixture({ ...alpha, name: 'Stale Alpha' }));
  pending[1].resolve(createProjectFixture(beta));
  await tick();
  assert.equal(workspace.snapshot().data.project.name, alpha.name);
  assert.notEqual(workspace.snapshot().data.project.name, 'Stale Alpha');
  workspace.destroy();
});

test('editor uses explicit Unsaved, Saving, Saved, and Needs review states', async () => {
  const { workspace } = await readyWorkspace();
  workspace.selectScene('scene-proof');
  workspace.updateEditor('notes', 'Synthetic revised direction.');
  assert.equal(workspace.snapshot().saveState, 'Unsaved');
  assert.equal(workspace.submitForReview(), false);
  const saving = workspace.saveDraft();
  assert.equal(workspace.snapshot().saveState, 'Saving');
  assert.equal(await saving, true);
  assert.equal(workspace.snapshot().saveState, 'Saved');
  assert.equal(workspace.submitForReview(), true);
  assert.equal(workspace.snapshot().saveState, 'Needs review');
  workspace.destroy();
});

test('failed saves preserve edits and support a successful retry', async () => {
  const adapter = createSyntheticAdapter({ delay: 0 });
  const { workspace } = await readyWorkspace(adapter);
  workspace.updateEditor('notes', 'Keep this local content after failure.');
  adapter.failNext('save');
  assert.equal(await workspace.saveDraft(), false);
  assert.equal(workspace.snapshot().saveState, 'Error');
  assert.equal(workspace.snapshot().unsaved, true);
  assert.equal(workspace.snapshot().editor.notes, 'Keep this local content after failure.');
  assert.equal(await workspace.saveDraft(), true);
  assert.equal(workspace.snapshot().unsaved, false);
  workspace.destroy();
});

test('asset filters change results and placement remains separate from selection', async () => {
  const { workspace } = await readyWorkspace();
  workspace.openSurface('assets');
  workspace.setAssetFilter('Original');
  assert.ok(workspace.filteredAssets().every(asset => asset.type === 'Original'));
  workspace.setAssetQuery('frame');
  assert.deepEqual(workspace.filteredAssets().map(asset => asset.id), ['asset-frame']);
  assert.equal(workspace.placeSelectedAsset(), false);
  assert.equal(workspace.selectAsset('asset-frame'), true);
  assert.equal(workspace.placeSelectedAsset(), true);
  assert.equal(workspace.snapshot().surface, 'editor');
  assert.equal(workspace.snapshot().saveState, 'Unsaved');
  workspace.destroy();
});

test('opening a decision is not approval and outcomes are labeled synthetic', async () => {
  const { workspace } = await readyWorkspace();
  assert.equal(workspace.openDecision('decision-hero'), true);
  assert.equal(workspace.snapshot().data.decisions[0].state, 'Needs review');
  assert.equal(workspace.resolveDecision('Approved'), true);
  assert.equal(workspace.snapshot().data.decisions[0].state, 'Approved');
  assert.match(workspace.snapshot().statusMessage, /synthetic memory only/i);
  workspace.destroy();
});

test('sign-out clears Studio data and invalidates pending work', async () => {
  const { context, workspace } = await readyWorkspace();
  workspace.updateEditor('title', 'Local synthetic edit');
  context.reset();
  assert.equal(workspace.snapshot().project, null);
  assert.equal(workspace.snapshot().data, null);
  assert.equal(workspace.snapshot().unsaved, false);
  workspace.destroy();
});

test('renderer integration contains the required accessible and honest UI contracts', () => {
  const root = join(__dirname, '..', '..', '..', '..');
  const shell = readFileSync(join(root, 'src', 'renderer', 'studio-ui', 'studio-shell.js'), 'utf8');
  const css = readFileSync(join(root, 'src', 'renderer', 'studio-ui', 'studio-ui.css'), 'utf8');
  const html = readFileSync(join(root, 'src', 'renderer', 'index.html'), 'utf8');
  const app = readFileSync(join(root, 'src', 'renderer', 'app.js'), 'utf8');
  for (const phrase of ['aria-current', 'aria-pressed', 'aria-live', 'for=\\"studio-scene-title',
    'for=\\"studio-scene-format', 'for=\\"studio-scene-notes', 'role=\\"img', 'Retry synthetic load',
    'Create synthetic draft', 'Keep editing', 'Discard and continue', 'Save then continue']) {
    assert.match(shell, new RegExp(phrase));
  }
  assert.match(css, /--studio-action:\s*#1f6fd6/i);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.doesNotMatch(css, /min-width:\s*1080px/i);
  assert.match(html, /class="studio-skip"/);
  assert.match(html, /data-view="studio"/);
  assert.match(app, /meridianStudioContext/);
  assert.doesNotMatch(shell, /StudioAssetView\.mount/);
});

test('primary action blue meets WCAG AA contrast for normal white text', () => {
  function luminance([red, green, blue]) {
    const channels = [red, green, blue].map(value => {
      const channel = value / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  function contrast(first, second) {
    const lighter = Math.max(luminance(first), luminance(second));
    const darker = Math.min(luminance(first), luminance(second));
    return (lighter + 0.05) / (darker + 0.05);
  }
  assert.ok(contrast([255, 255, 255], [31, 111, 214]) >= 4.5);
});
