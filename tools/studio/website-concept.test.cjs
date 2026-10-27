'use strict';
// Core: the Concept step, the big idea before Story (#229). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanConcept, conceptGaps } = require('../../src/renderer/studio/website/concept.js');
const { createSampleService, createServerService } = require('../../src/renderer/studio/studio-service.js');

const ID = 'sample-home';
const refs = n => Array.from({ length: n }, (_, i) => ({ url: `https://example.com/ref-${i + 1}`, note: 'Big call button' }));
const FULL = { line: 'A roof that shrugs off the rain', audience: 'Homeowners in the valley', goal: 'Book a roof check',
  references: refs(3), mood: ['Calm', 'sturdy', 'local'] };
async function atConcept(s = createSampleService()) {
  s.setProjects([{ id: ID, name: 'Sample Home Services' }]);
  const job = await s.startJob(ID, 'website', 'standard');
  await s.completeStage(ID, job.id); await s.approveStage(ID, job.id);   // Kickoff
  return { s, job };
}

test('cleanConcept keeps only the known fields and refuses bad links and words', () => {
  const c = cleanConcept({ ...FULL, mood: ['Calm', 'calm', ' local ', ''], references: [{ url: '', note: '' }, ...refs(2)], extra: 'dropped' });
  assert.deepEqual(Object.keys(c), ['line', 'audience', 'goal', 'references', 'mood']);
  assert.deepEqual(c.mood, ['calm', 'local'], 'lower case, no repeats, no blanks');
  assert.equal(c.references.length, 2, 'empty rows are dropped');
  assert.deepEqual(cleanConcept(null), { line: '', audience: '', goal: '', references: [], mood: [] });
  assert.throws(() => cleanConcept({ references: [{ url: 'http://example.com' }] }), /full https:\/\/ link/);
  assert.throws(() => cleanConcept({ references: [{ url: 'javascript:alert(1)' }] }), /full https:\/\/ link/);
  assert.throws(() => cleanConcept({ references: refs(4) }), /at most 3/);
  assert.throws(() => cleanConcept({ mood: ['<b>bold</b>'] }), /letters, spaces and dashes/);
  assert.throws(() => cleanConcept({ line: 'x'.repeat(141) }), /too long/);
  assert.throws(() => cleanConcept({ goal: 5 }), /must be text/);
});

test('conceptGaps names what is missing, including placeholder text', () => {
  assert.deepEqual(conceptGaps(cleanConcept(FULL)), []);
  assert.deepEqual(conceptGaps(cleanConcept({})).map(g => g.field), ['line', 'audience', 'goal', 'references', 'mood']);
  const thin = conceptGaps(cleanConcept({ ...FULL, references: [{ url: 'https://example.com/a' }, ...refs(1)], mood: ['calm'] }));
  assert.deepEqual(thin.map(g => g.message), ['Add 3 reference sites (2 so far).', 'Say what you like about each reference site.', 'Add at least 3 mood words (1 so far).']);
  assert.deepEqual(conceptGaps(cleanConcept({ ...FULL, line: 'TBD' })).map(g => g.message), ['Replace the placeholder text.']);
});

test('Concept comes after Kickoff, waits on Jax, and its gate needs a complete concept', async () => {
  const { s, job } = await atConcept();
  const wf = await s.getWorkflow('website');
  const stage = wf.stages.find(st => st.id === 'concept');
  assert.deepEqual([wf.stages.indexOf(stage), stage.approver, stage.tools], [1, 'jax', ['concept']]);
  assert.equal((await s.getJob(ID, job.id)).stageId, 'concept');
  assert.deepEqual(await s.getConcept(ID, job.id), cleanConcept({}));
  await assert.rejects(s.completeStage(ID, job.id), /The concept isn't ready: Write the concept line/);
  const events = []; s.on((e, d) => events.push([e, d.jobId]));
  const half = await s.saveConcept(ID, job.id, { line: FULL.line });
  assert.equal(half.ok, true);
  assert.deepEqual(half.errors.map(g => g.field), ['audience', 'goal', 'references', 'mood'], 'a partial concept saves, and says what is left');
  assert.deepEqual(events, [['concept-changed', job.id]]);
  const bad = await s.saveConcept(ID, job.id, { ...FULL, references: [{ url: 'http://example.com' }] });
  assert.equal(bad.ok, false);
  assert.equal((await s.getConcept(ID, job.id)).line, FULL.line, 'a refused save changes nothing');
  assert.deepEqual((await s.saveConcept(ID, job.id, FULL)).errors, []);
  assert.equal((await s.completeStage(ID, job.id)).waitingOnJax, true);
  await assert.rejects(s.saveConcept(ID, job.id, FULL), /locked once it goes to Jax/);
  assert.equal((await s.approveStage(ID, job.id)).stageId, 'plan');
  await assert.rejects(s.saveConcept(ID, job.id, FULL), /locked/);
  assert.equal((await s.getConcept(ID, job.id)).mood[0], 'calm');
});

test('the concept can be started at Kickoff; only Website Jobs have one, and never across Spaces', async () => {
  const s = createSampleService();
  s.setProjects([{ id: ID, name: 'Sample Home Services' }, { id: 'other', name: 'Other' }]);
  const job = await s.startJob(ID, 'website', 'standard');
  assert.equal((await s.saveConcept(ID, job.id, FULL)).ok, true);
  await assert.rejects(s.getConcept('other', job.id), /not found/);
  const deck = await s.startJob(ID, 'pitch-deck', 'deck');
  await assert.rejects(s.saveConcept(ID, deck.id, FULL), /Only Website Jobs/);
});

test('Meridian\'s draft starts from Kickoff and DNA, leaves the reference sites to the lead, and never saves', async () => {
  const { s, job } = await atConcept();
  const { draft, settingsUsed } = await s.draftConcept(ID, job.id);
  assert.deepEqual(draft.references, []);
  assert.ok(draft.line && draft.audience && draft.goal && draft.mood.length >= 3);
  assert.equal(settingsUsed.model, 'sample');
  assert.deepEqual(await s.getConcept(ID, job.id), cleanConcept({}), 'the draft is not saved');
  const server = createServerService({ local: createSampleService({ practice: false }), request: async () => ({ success: true, data: [] }) });
  await assert.rejects(server.draftConcept(ID, job.id), /Coming soon/);
});

test('real sign-in keeps the concept in the project folder, and a bad saved concept comes back empty', async () => {
  const folder = new Map();
  const computer = () => {
    const local = createSampleService({ practice: false });
    const server = createServerService({ local,
      request: async (method, endpoint) => ({ success: true, data: /\/spaces\/sample-home$/.test(endpoint) ? { id: ID, name: 'Sample Home Services', dna: null } : [] }),
      readSave: async (spaceId, name) => (folder.has(name) ? { success: true, content: folder.get(name) } : { success: false, missing: true }),
      saveFile: async (spaceId, name, content) => { folder.set(name, content); return { success: true }; } });
    server.setProjects([{ id: ID, name: 'Sample Home Services' }]);
    return server;
  };
  const a = computer(), job = await a.startJob(ID, 'website', 'standard');
  await a.saveConcept(ID, job.id, FULL);
  assert.deepEqual(await computer().getConcept(ID, job.id), cleanConcept(FULL));
  const file = 'Website - Studio save.json', saved = JSON.parse(folder.get(file));
  saved.jobs[0].concept.references[0].url = 'http://example.com'; saved.revision += 1;
  folder.set(file, JSON.stringify(saved));
  assert.deepEqual(await computer().getConcept(ID, job.id), cleanConcept({}));
  const v2 = JSON.parse(folder.get(file));   // a Job saved before Concept existed keeps its stages
  Object.assign(v2.jobs[0], { templateVersion: 2, done: ['brief'], stageId: 'plan' }); v2.revision += 1;
  folder.set(file, JSON.stringify(v2));
  const back = await computer().getJob(ID, job.id);
  assert.deepEqual([back.templateVersion, back.stageId, back.stages.some(st => st.id === 'concept')], [2, 'plan', false]);
  v2.jobs[0].templateVersion = 1; v2.revision += 1; folder.set(file, JSON.stringify(v2));
  assert.equal((await computer().listJobs(ID)).length, 0, 'an unknown template is still refused');
});
