'use strict';
// Core: saving a Job's outputs into the client project's folder (Files tab, Docs section).
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSampleService, createServerService } = require('../../src/renderer/studio/studio-service.js');

function service() {
  const s = createSampleService();
  s.setProjects([{ id: 'client-a', name: 'Client A' }]);
  return s;
}

test('outputs are saved to the project folder, named after the Job; saving again replaces', async () => {
  const s = service();
  const job = await s.startJob('client-a', 'website', 'standard');
  const events = [];
  s.on(e => events.push(e));
  const r = await s.saveToProjectFiles('client-a', job.id, [
    { name: 'Research summary.md', content: '# Research summary' },
    { name: 'Deck data.json', content: '{"version":1}' }]);
  assert.deepEqual(r.saved, ['Website v1 - Research summary.md', 'Website v1 - Deck data.json']);
  assert.deepEqual(r.failed, []);
  assert.ok(events.includes('project-files-changed'));
  await s.saveToProjectFiles('client-a', job.id, [{ name: 'Research summary.md', content: '# Updated, longer summary' }]);
  const files = await s.listProjectFiles('client-a');
  assert.equal(files.length, 2);
  assert.ok(files.every(f => f.section === 'Docs' && f.jobId === job.id));
  assert.equal(files[0].size, '# Updated, longer summary'.length);
});

test('only client projects, safe names, text up to 5 MB, 1 to 10 files', async () => {
  const s = service();
  const job = await s.startJob('client-a', 'website', 'standard');
  const one = name => [{ name, content: 'x' }];
  await assert.rejects(s.saveToProjectFiles('sandbox-me', job.id, one('a.md')), /client projects/);
  await assert.rejects(s.saveToProjectFiles('client-a', 'job-nope', one('a.md')), /Job not found/);
  for (const bad of ['../secret.md', 'run.exe', 'notes', 'a/b.md', 'x<script>.html']) {
    await assert.rejects(s.saveToProjectFiles('client-a', job.id, one(bad)), /normal file name/, bad);
  }
  await assert.rejects(s.saveToProjectFiles('client-a', job.id, [{ name: 'a.md', content: 42 }]), /must be text/);
  await assert.rejects(s.saveToProjectFiles('client-a', job.id, [{ name: 'a.md', content: 'x'.repeat(5 * 1024 * 1024 + 1) }]), /5 MB/);
  await assert.rejects(s.saveToProjectFiles('client-a', job.id, []), /1 to 10/);
  await assert.rejects(s.saveToProjectFiles('client-a', job.id, Array.from({ length: 11 }, (_, i) => ({ name: `f${i}.md`, content: 'x' }))), /1 to 10/);
});

test('server mode saves through Connect into the real folder and reports each file', async () => {
  const local = service();
  const job = await local.startJob('client-a', 'website', 'standard');
  const calls = [];
  const saveFile = async (projectId, name, content) => {
    calls.push([projectId, name, content]);
    return name.includes('Board') ? { success: false, error: 'HTTP 507' } : { success: true };
  };
  const s = createServerService({ request: async () => ({ success: false }), local, saveFile });
  const r = await s.saveToProjectFiles('client-a', job.id, [{ name: 'Research summary.md', content: 'a' }, { name: 'Board.html', content: '<p>b</p>' }]);
  assert.deepEqual(calls.map(c => c.slice(0, 2)), [['client-a', 'Website v1 - Research summary.md'], ['client-a', 'Website v1 - Board.html']]);
  assert.deepEqual(r.saved, ['Website v1 - Research summary.md']);
  assert.deepEqual(r.failed, [{ name: 'Website v1 - Board.html', error: 'HTTP 507' }]);
  const none = createServerService({ request: async () => ({ success: false }), local });
  await assert.rejects(none.saveToProjectFiles('client-a', job.id, [{ name: 'a.md', content: 'x' }]), /isn't available/);
});
