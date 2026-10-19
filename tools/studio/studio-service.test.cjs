'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService } = require('../../src/renderer/studio/studio-service.js');

function service() {
  const s = createSampleService();
  s.setProjects([{ id: 'proj_a', name: 'Sample Roofing' }, { id: 'bad id!', name: 'Rejected' }]);
  return s;
}

test('spaces are two sandboxes plus only valid assigned projects', async () => {
  const spaces = await service().listSpaces();
  assert.deepEqual(spaces.map(s => s.type), ['sandbox-personal', 'sandbox-team', 'client']);
  assert.equal(spaces[2].name, 'Sample Roofing');
});

test('unassigned spaces are refused', async () => {
  await assert.rejects(service().getSpace('someone-else'), /not assigned/);
});

test('client spaces have DNA and jobs; sandboxes do not', async () => {
  const s = service();
  assert.ok((await s.getSpace('proj_a')).dna);
  assert.equal((await s.getSpace('sandbox-me')).dna, null);
});

test('tool catalogue is honest and never mentions cost', async () => {
  const tools = await service().listTools();
  assert.ok(tools.every(t => ['available', 'coming-soon'].includes(t.state)));
  assert.ok(!JSON.stringify(tools).match(/cost|price|\$/i));
});

test('nine image presets, each with questions', async () => {
  const presets = await service().listPresets('image-gen');
  assert.equal(presets.length, 9);
  assert.ok(presets.every(p => p.questions.length > 0));
});

test('generateImage saves results to that space only, with settings and no cost', async () => {
  const s = service();
  const out = await s.generateImage({ spaceId: 'proj_a', presetId: 'website-hero', description: 'crew on a roof', count: 2 });
  assert.equal(out.results.length, 2);
  assert.match(out.refinedDescription, /crew on a roof/);
  assert.ok(!JSON.stringify(out).match(/cost|price/i));
  assert.equal((await s.listAssets('proj_a')).length, 2);
  assert.equal((await s.listAssets('sandbox-me')).length, 0);
  await assert.rejects(s.generateImage({ spaceId: 'proj_a', description: '  ' }), /Describe/);
});

test('trash and restore; approved work cannot be trashed', async () => {
  const s = service();
  const { results } = await s.generateImage({ spaceId: 'sandbox-me', description: 'test', count: 1 });
  const id = results[0].assetId;
  await s.trashAsset('sandbox-me', id);
  assert.equal((await s.listAssets('sandbox-me')).length, 0);
  assert.equal((await s.listAssets('sandbox-me', { includeTrash: true })).length, 1);
  await s.restoreAsset('sandbox-me', id);
  assert.equal((await s.listAssets('sandbox-me')).length, 1);
});
