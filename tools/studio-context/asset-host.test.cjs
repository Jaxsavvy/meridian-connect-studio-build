'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createStudioContext } = require('../../src/renderer/studio-context');
const { createAssetHost } = require('../../src/renderer/studio-asset-host');
const { Controller } = require('../../src/renderer/studio-assets/controller');
const { ServiceAdapter } = require('../../src/renderer/studio-assets/service-adapter');
const { SyntheticService } = require('../../src/renderer/studio-assets/synthetic-service');

const A = { id: 'A', name: 'Synthetic A' };
const B = { id: 'B', name: 'Synthetic B' };
const tick = () => new Promise(resolve => setImmediate(resolve));

function setup(transport) {
  const context = createStudioContext();
  const host = createAssetHost({ context, Controller, ServiceAdapter, transport });
  context.acceptProjects([A, B], context.beginProjectList());
  return { context, host };
}

test('Connect context exposes a copied accepted list and notifies on membership changes', () => {
  const context = createStudioContext();
  const lists = [];
  context.subscribe(state => lists.push(state.projects.map(project => project.id)));
  context.acceptProjects([A], context.beginProjectList());
  const state = context.snapshot();
  state.projects[0].name = 'Tampered';
  assert.deepEqual(context.snapshot().projects, [A]);
  context.acceptProjects([B], context.beginProjectList());
  context.rejectProjectList(context.beginProjectList());
  assert.deepEqual(lists, [['A'], ['B'], []]);
});

test('missing approved service reports unavailable and cannot save', async () => {
  const { context, host } = setup();
  context.selectProject('A');
  await tick();
  assert.equal(host.snapshot().project.id, 'A');
  assert.equal(host.snapshot().error, 'SERVICE_UNAVAILABLE');
  assert.equal(host.snapshot().phase, 'error');
  assert.equal(await host.save('import', { filename: 'synthetic.txt' }), null);
  assert.equal(host.snapshot().error, 'SERVICE_UNAVAILABLE');
  assert.deepEqual(host.snapshot().assets, []);
  host.dispose();
});

test('host follows the selected Connect project and drops late responses', async () => {
  const synthetic = new SyntheticService({ projects: ['A'] });
  const asset = await synthetic.import({
    projectId: 'A', filename: 'Synthetic.txt', mediaType: 'text/plain',
    bytes: new TextEncoder().encode('synthetic content'), idempotencyKey: 'seed',
  });
  const pending = [];
  const transport = { mode: 'synthetic', request(operation, payload) {
    assert.equal(operation, 'asset.list');
    return new Promise(resolve => pending.push({ projectId: payload.projectId, resolve }));
  } };
  const { context, host } = setup(transport);
  context.selectProject('A');
  context.selectProject('B');
  assert.deepEqual(pending.map(item => item.projectId), ['A', 'B']);
  pending[0].resolve([asset]);
  await tick();
  assert.equal(host.snapshot().project.id, 'B');
  assert.deepEqual(host.snapshot().assets, []);
  pending[1].resolve([]);
  await tick();
  assert.equal(host.snapshot().phase, 'ready');
  context.selectProject('A');
  assert.equal(pending[2].projectId, 'A');
  context.reset();
  pending[2].resolve([asset]);
  await tick();
  assert.equal(host.snapshot().project, null);
  assert.deepEqual(host.snapshot().assets, []);
  assert.throws(() => host.search(), { code: 'NO_PROJECT' });
  host.dispose();
});

test('revocation aborts the asset scope and the refreshed list is used', async () => {
  const synthetic = new SyntheticService({ projects: ['A', 'B'] });
  const methods = {
    'asset.list': 'list', 'asset.import': 'import', 'asset.metadata': 'metadata',
    'asset.download': 'download', 'asset.submit-review': 'review',
  };
  const transport = { mode: 'synthetic', request(operation, payload) {
    return synthetic[methods[operation]](payload);
  } };
  const { context, host } = setup(transport);
  context.selectProject('A');
  await tick();
  assert.equal(host.snapshot().phase, 'ready');
  context.acceptProjects([B], context.beginProjectList());
  assert.equal(host.snapshot().project, null);
  assert.throws(() => host.save('import', {}), { code: 'NO_PROJECT' });
  context.selectProject('B');
  await tick();
  assert.equal(host.snapshot().project.id, 'B');
  assert.equal(host.snapshot().phase, 'ready');
  host.dispose();
});

test('renaming the selected project preserves a pending asset save', async () => {
  const synthetic = new SyntheticService({ projects: ['A'] });
  const imported = await synthetic.import({
    projectId: 'A', filename: 'Draft.txt', mediaType: 'text/plain',
    bytes: new TextEncoder().encode('draft'), idempotencyKey: 'rename-seed',
  });
  let finishSave;
  const transport = { mode: 'synthetic', request(operation, payload) {
    if (operation === 'asset.metadata') {
      return new Promise(resolve => { finishSave = () => resolve(synthetic.metadata(payload)); });
    }
    return synthetic.list(payload);
  } };
  const { context, host } = setup(transport);
  context.selectProject('A');
  await tick();
  const pending = host.save('metadata', {
    assetId: imported.id, revision: imported.revision, name: 'Saved draft',
    tags: [], description: '', section: 'Files',
  });
  assert.equal(typeof finishSave, 'function');
  context.acceptProjects([{ id: 'A', name: 'Renamed project' }, B], context.beginProjectList());
  assert.equal(host.snapshot().project.name, 'Renamed project');
  assert.equal(host.snapshot().phase, 'saving');
  finishSave();
  assert.equal((await pending).name, 'Saved draft');
  assert.equal(host.snapshot().assets[0].revision, imported.revision + 1);
  host.dispose();
});

test('host denies calls after disposal and cannot select outside shared context', async () => {
  const { context, host } = setup();
  assert.throws(() => host.search(), { code: 'NO_PROJECT' });
  assert.equal(context.selectProject('missing'), false);
  context.selectProject('A');
  await tick();
  host.dispose();
  assert.throws(() => host.search(), { code: 'DISPOSED' });
  assert.equal(host.snapshot().project, null);
});
