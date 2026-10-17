'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const { createStudioContext } = require('../../src/renderer/studio-context');
const { createDevelopmentTransport } = require('../../src/renderer/studio-dev-asset-transport');
const { createAssetHost } = require('../../src/renderer/studio-asset-host');
const { Controller } = require('../../src/renderer/studio-assets/controller');
const { ServiceAdapter } = require('../../src/renderer/studio-assets/service-adapter');
const { SyntheticService } = require('../../src/renderer/studio-assets/synthetic-service');

const tick = () => new Promise(resolve => setImmediate(resolve));
function accepted(context, projects) {
  assert.equal(context.acceptProjects(projects, context.beginProjectList()), true);
}
function fixture() {
  const context = createStudioContext();
  accepted(context, [{ id: 'a', name: 'Example A' }, { id: 'b', name: 'Example B' }]);
  const transport = createDevelopmentTransport({ context, SyntheticService });
  const host = createAssetHost({ context, Controller, ServiceAdapter, transport });
  return { context, transport, host };
}
test('DEV-020 transport is explicitly synthetic and rejects invalid or unselected scope', async () => {
  const { context, transport, host } = fixture();
  assert.equal(transport.mode, 'synthetic');
  await assert.rejects(transport.request('asset.list', { projectId: 'a' }), { code: 'PROJECT_DENIED' });
  context.selectProject('a');
  await tick();
  await assert.rejects(transport.request('asset.list', { projectId: 'b' }), { code: 'PROJECT_DENIED' });
  await assert.rejects(transport.request('asset.unknown', { projectId: 'a' }), { code: 'INVALID_OPERATION' });
  host.dispose();
});
test('DEV-020 host supports synthetic import, metadata updates, listing and strict project isolation', async () => {
  const { context, host } = fixture();
  context.selectProject('a');
  await tick();
  const bytes = new TextEncoder().encode('development-only example');
  const imported = await host.save('import', { filename: 'sample.txt', mediaType: 'text/plain', bytes, idempotencyKey: 'example-import' });
  assert.ok(imported?.id);
  assert.equal(imported.projectId, 'a');
  const edited = await host.save('metadata', { assetId: imported.id, revision: imported.revision, name: 'Edited', tags: ['design'], description: 'Synthetic', section: 'Website' });
  assert.equal(edited.name, 'Edited');
  assert.equal((await host.search({ query: 'Edited' })).length, 1);
  context.selectProject('b');
  await tick();
  assert.deepEqual(await host.search({}), []);
  assert.equal(host.snapshot().project?.id, 'b');
  host.dispose();
});
test('DEV-020 revocation clears selected project and blocks future transport requests', async () => {
  const { context, transport, host } = fixture();
  context.selectProject('a');
  await tick();
  accepted(context, [{ id: 'b', name: 'Example B' }]);
  assert.equal(context.snapshot().project, null);
  assert.equal(host.snapshot().project, null);
  await assert.rejects(transport.request('asset.list', { projectId: 'a' }), { code: 'PROJECT_DENIED' });
  host.dispose();
});
test('DEV-020 sign-out clears selected asset state', async () => {
  const { context, host } = fixture();
  context.selectProject('a');
  await tick();
  context.reset();
  assert.equal(host.snapshot().project, null);
  assert.deepEqual(host.snapshot().assets, []);
  host.dispose();
});
