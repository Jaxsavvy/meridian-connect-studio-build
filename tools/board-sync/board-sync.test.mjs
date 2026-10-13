import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createGhClient, ISSUE_URL } from './github.mjs';
import { recordSession, sync } from './sync.mjs';

const fieldNames = {
  Chair: 'Chair 1 — Owner', Priority: 'P1 — High',
  Module: 'Infrastructure & QA', Status: 'Ready',
};

function task(status = 'Ready') {
  const names = { ...fieldNames, Status: status };
  return {
    actor: 'Jaxsavvy',
    issue: { id: 'issue-3', number: 3, url: ISSUE_URL, state: 'OPEN', title: 'DEV-001' },
    project: { id: 'project-1', number: 1, title: 'Meridian Development Command' },
    itemId: 'item-3',
    fields: Object.fromEntries(Object.entries(names).map(([name, value]) => [name, {
      id: `field-${name}`, name: value, optionId: `option-${value}`,
      options: [...new Set([value, 'Ready', 'Building', 'Review', 'Testing', 'Blocked', 'Complete'])]
        .map(option => ({ id: `option-${option}`, name: option })),
    }])),
  };
}

function client(initial = 'Ready') {
  let current = initial;
  let writes = 0;
  return {
    get writes() { return writes; },
    async read() { return task(current); },
    async updateStatus(_task, target) { writes += 1; current = target; },
    setStatus(value) { current = value; },
  };
}

async function withHandoff(callback) {
  const directory = await mkdtemp(join(tmpdir(), 'board-sync-'));
  try { await callback(join(directory, 'handoff.json')); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

const request = (handoffPath, extra = {}) => ({
  expected: 'Ready', target: 'Building', eventId: 'dev001-start',
  reason: 'Owner began the DEV-001 prototype', handoffPath, ...extra,
});

test('one verified status write and an idempotent retry', async () => {
  await withHandoff(async handoffPath => {
    const gh = client();
    assert.equal((await sync(gh, request(handoffPath))).outcome, 'confirmed');
    assert.equal((await sync(gh, request(handoffPath))).outcome, 'already-applied');
    assert.equal(gh.writes, 1);
    const handoff = JSON.parse(await readFile(handoffPath, 'utf8'));
    assert.equal(Object.keys(handoff.events).length, 1);
    assert.equal(handoff.lastTask.fields.Status, 'Building');
  });
});

test('stale or ambiguous board state never writes', async () => {
  await withHandoff(async handoffPath => {
    const gh = client('Blocked');
    await assert.rejects(sync(gh, request(handoffPath)), { category: 'STALE' });
    gh.setStatus('Building');
    await assert.rejects(sync(gh, request(handoffPath)), { category: 'UNCERTAIN' });
    assert.equal(gh.writes, 0);
  });
});

test('a changed Project value just before mutation prevents the write', async () => {
  await withHandoff(async handoffPath => {
    const gh = client();
    let reads = 0;
    gh.read = async () => task(++reads === 1 ? 'Ready' : 'Blocked');
    await assert.rejects(sync(gh, request(handoffPath)), { category: 'STALE' });
    assert.equal(gh.writes, 0);
  });
});

test('Complete is forbidden even when requested by the owner account', async () => {
  await withHandoff(async handoffPath => {
    const gh = client('Testing');
    await assert.rejects(sync(gh, request(handoffPath, {
      expected: 'Testing', target: 'Complete', eventId: 'accept',
    })), { category: 'OWNER_APPROVAL' });
    assert.equal(gh.writes, 0);
  });
});

test('readback disagreement is pending, not confirmed', async () => {
  await withHandoff(async handoffPath => {
    const gh = client();
    gh.updateStatus = async () => {};
    await assert.rejects(sync(gh, request(handoffPath)), { category: 'READBACK' });
    await assert.rejects(readFile(handoffPath, 'utf8'), { code: 'ENOENT' });
  });
});

test('a confirmed event cannot be reused with a different request or after reversal', async () => {
  await withHandoff(async handoffPath => {
    const gh = client();
    await sync(gh, request(handoffPath));
    await assert.rejects(sync(gh, request(handoffPath, { reason: 'different' })), { category: 'EVENT_CONFLICT' });
    gh.setStatus('Ready');
    await assert.rejects(sync(gh, request(handoffPath)), { category: 'EVENT_CONFLICT' });
    assert.equal(gh.writes, 1);
  });
});

test('Building observation writes one harmless handoff and no Project mutation', async () => {
  await withHandoff(async handoffPath => {
    const gh = client('Building');
    const input = request(handoffPath, { expected: 'Building', target: 'Building', eventId: 'dev001-observe' });
    assert.equal((await sync(gh, input)).mode, 'observation');
    assert.equal((await sync(gh, input)).outcome, 'already-applied');
    assert.equal(gh.writes, 0);
  });
});

test('GitHub resolver requires one verified existing item', async () => {
  const response = {
    viewer: { login: 'Jaxsavvy' },
    repository: { nameWithOwner: 'Jaxsavvy/meridian-connect-studio-build', issue: {
      id: 'issue-3', number: 3, url: ISSUE_URL, state: 'OPEN', title: 'DEV-001',
      projectItems: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
    } },
    user: { login: 'Jaxsavvy', projectV2: { id: 'project-1', number: 1, title: 'Board', closed: false, fields: { nodes: [] } } },
  };
  const gh = createGhClient(async () => response);
  await assert.rejects(gh.read(), { category: 'ITEM_COUNT' });
});

test('session handoff records once and rejects a changed retry', async () => {
  await withHandoff(async handoffPath => {
    const gh = client('Building');
    const input = {
      eventId: 'session-1', handoffPath, branch: 'feature/studio-integration',
      commit: 'cd6bf77', summary: 'Mock prototype', checks: 'Seven synthetic tests pass',
      nextAction: 'Review the live board state',
    };
    assert.equal((await recordSession(gh, input)).outcome, 'recorded');
    assert.equal((await recordSession(gh, input)).outcome, 'already-recorded');
    await assert.rejects(recordSession(gh, { ...input, summary: 'Changed' }), { category: 'EVENT_CONFLICT' });
    const saved = JSON.parse(await readFile(handoffPath, 'utf8'));
    assert.equal(Object.keys(saved.sessions).length, 1);
  });
});
