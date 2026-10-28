'use strict';
// Core (#273): a stage Jax approved on Review in Connect moves the Job on in the real service, with the usual rules,
// and is saved to the project folder. Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createServerService } = require('../../src/renderer/studio/studio-service.js');

const ID = 'sample-home', FILE = 'Website - Studio save.json';
function setup() {
  const files = new Map(), state = { approvals: [], offline: false, gets: 0 };
  const saveFile = async (id, name, content) => { files.set(`${id}/${name}`, content); return { success: true }; };
  const readSave = async (id, name) => (files.has(`${id}/${name}`) ? { success: true, content: files.get(`${id}/${name}`) } : { success: false, missing: true });
  const request = async (method, endpoint) => {
    if (method === 'GET' && endpoint === `/api/studio/spaces/${ID}/stage-approvals`) {
      state.gets++;
      return state.offline ? { success: false, status: 0, offline: true, error: 'Studio could not reach home base.' } : { success: true, data: state.approvals };
    }
    return { success: true, data: [] };
  };
  const open = () => {
    const s = createServerService({ request, saveFile, readSave });
    s.setProjects([{ id: ID, name: 'Sample Home Services' }]);
    return s;
  };
  return { files, state, open };
}
const saved = files => JSON.parse(files.get(`${ID}/${FILE}`)).jobs[0];

test('a stage Jax approved moves the Job on the next time its Jobs are listed, and is saved', async () => {
  const { files, state, open } = setup();
  const s = open();
  const job = await s.startJob(ID, 'website', 'standard');
  const waiting = await s.completeStage(ID, job.id);   // Kickoff goes to Jax
  assert.deepEqual([waiting.stageId, waiting.waitingOnJax], ['brief', true]);
  await s.listJobs(ID);
  assert.equal((await s.getJob(ID, job.id)).waitingOnJax, true, 'nothing approved yet');

  state.approvals = [{ jobId: job.id, stageId: 'brief', at: 1 }];
  const [summary] = await s.listJobs(ID);
  assert.equal(summary.stage, 'Concept');
  const after = await s.getJob(ID, job.id);
  assert.deepEqual([after.stageId, after.waitingOnJax, after.stages.find(st => st.id === 'brief').status], ['concept', false, 'done']);
  assert.deepEqual([saved(files).stageId, saved(files).waitingOnJax], ['concept', false], 'saved to the project folder');
  const other = open();   // someone else opening the project sees it moved on
  assert.equal((await other.listJobs(ID))[0].stage, 'Concept');

  await s.listJobs(ID);
  assert.equal((await s.getJob(ID, job.id)).stageId, 'concept', 'an approval moves its own stage once, never the next one');
  assert.equal(saved(files).stageId, 'concept');
});

test('no approvals when home base can\'t be reached, and approving here stays Jax-only', async () => {
  const { state, open } = setup();
  const s = open();
  const job = await s.startJob(ID, 'website', 'standard');
  await s.completeStage(ID, job.id);
  state.approvals = [{ jobId: job.id, stageId: 'brief', at: 1 }, { jobId: 'not-a-job', stageId: 'brief', at: 1 }, null];
  state.offline = true;
  await s.listJobs(ID);
  assert.ok(state.gets > 0);
  assert.equal((await s.getJob(ID, job.id)).waitingOnJax, true, 'offline: nothing changes, nothing breaks');
  state.offline = false;
  await s.listJobs(ID);
  assert.equal((await s.getJob(ID, job.id)).stageId, 'concept', 'odd rows are skipped');
  await assert.rejects(async () => s.approveStage(ID, job.id), /Only Jax approves, from Review in Connect\./);
});
