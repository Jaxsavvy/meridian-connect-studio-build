import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { BoardError, ISSUE_URL, PROJECT_OWNER } from './github.mjs';

const ALLOWED = new Set([
  'Ready:Building', 'Building:Blocked', 'Blocked:Ready', 'Blocked:Building',
  'Building:Review', 'Review:Building', 'Review:Testing',
  'Testing:Building', 'Testing:Blocked', 'Testing:Complete',
]);

export function publicTask(task) {
  return {
    actor: task.actor, issue: task.issue, project: task.project, itemId: task.itemId,
    fields: Object.fromEntries(Object.entries(task.fields).map(([name, field]) => [name, field.name])),
  };
}

export async function loadHandoff(path) {
  try {
    const document = JSON.parse(await readFile(path, 'utf8'));
    if (document.schema !== 'meridian.board-handoff.v1' || document.issueUrl !== ISSUE_URL ||
        !document.events || typeof document.events !== 'object' || Array.isArray(document.events) ||
        !document.sessions || typeof document.sessions !== 'object' || Array.isArray(document.sessions)) {
      throw new BoardError('HANDOFF', 'Handoff identity or schema does not match DEV-001.');
    }
    return document;
  } catch (error) {
    if (error.code === 'ENOENT') return { schema: 'meridian.board-handoff.v1', issueUrl: ISSUE_URL, events: {}, sessions: {} };
    if (error instanceof BoardError) throw error;
    throw new BoardError('HANDOFF', 'Could not read the structured handoff.');
  }
}

export async function saveHandoff(path, document) {
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(temp, `${JSON.stringify(document, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await rename(temp, path);
  } catch {
    await rm(temp, { force: true }).catch(() => {});
    throw new BoardError('HANDOFF_WRITE', `Could not save the handoff in ${dirname(path)}.`);
  }
}

function sameIdentity(before, after) {
  return before.issue.id === after.issue.id && before.project.id === after.project.id &&
    before.itemId === after.itemId &&
    ['Chair', 'Priority', 'Module'].every(name => before.fields[name].optionId === after.fields[name].optionId);
}

export async function sync(client, { expected, target, eventId, handoffPath, reason }) {
  if (!eventId || !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/.test(eventId)) {
    throw new BoardError('EVENT_ID', 'A stable, nonsensitive --event-id is required.');
  }
  if (!handoffPath) throw new BoardError('HANDOFF', '--handoff is required for retry-safe writes.');
  if (!reason || reason.length > 500) throw new BoardError('REASON', 'A short, nonsensitive --reason is required.');
  if (expected !== target && !ALLOWED.has(`${expected}:${target}`)) {
    throw new BoardError('TRANSITION', `Transition ${expected} → ${target} is not allowed.`);
  }
  const document = await loadHandoff(handoffPath);
  const prior = document.events[eventId];
  if (prior && (prior.expected !== expected || prior.target !== target || prior.reason !== reason)) {
    throw new BoardError('EVENT_CONFLICT', 'This event ID already belongs to a different request.');
  }
  const before = await client.read();
  if (before.issue.url !== ISSUE_URL || before.fields.Chair.name !== 'Chair 1 — Owner' ||
      before.fields.Priority.name !== 'P1 — High' ||
      before.fields.Module.name !== 'Infrastructure & QA' || before.issue.state !== 'OPEN') {
    throw new BoardError('TASK_SCOPE', 'DEV-001 identity, assignment, or open state did not match.');
  }
  if (before.actor !== PROJECT_OWNER) {
    throw new BoardError('ACTOR', 'The authenticated GitHub developer is not Chair 1 owner.');
  }
  const actual = before.fields.Status.name;
  if (prior?.outcome === 'confirmed' && actual === target && prior.itemId === before.itemId) {
    return { outcome: 'already-applied', eventId, status: actual, task: publicTask(before) };
  }
  if (prior?.outcome === 'confirmed') {
    throw new BoardError('EVENT_CONFLICT', 'A previously confirmed event cannot be replayed after the board changed.');
  }
  if (expected === target) {
    if (actual !== target) throw new BoardError('STALE', `Current Status is ${actual}, not ${target}.`);
    const receipt = { eventId, expected, target, reason, itemId: before.itemId,
      outcome: 'confirmed', mode: 'observation', actor: before.actor, verifiedAt: new Date().toISOString() };
    document.events[eventId] = receipt;
    document.lastTask = publicTask(before);
    await saveHandoff(handoffPath, document);
    return { ...receipt, task: document.lastTask };
  }
  if (actual === target) {
    throw new BoardError('UNCERTAIN', 'Status is already at the target without a matching confirmed receipt; reconcile manually.');
  }
  if (actual !== expected) throw new BoardError('STALE', `Current Status is ${actual}, not expected ${expected}.`);
  const prewrite = await client.read();
  if (!sameIdentity(before, prewrite) || prewrite.actor !== before.actor ||
      prewrite.fields.Status.name !== expected) {
    throw new BoardError('STALE', 'The Project item changed immediately before the write; no update was made.');
  }
  let writeError;
  try { await client.updateStatus(prewrite, target); }
  catch (error) { writeError = error; }
  let after;
  try { after = await client.read(); }
  catch { throw new BoardError('READBACK', 'Board sync pending: could not read back the Project item after the write attempt.'); }
  if (!sameIdentity(before, after) || after.fields.Status.name !== target || writeError) {
    throw new BoardError('READBACK', `Board sync pending: readback Status is ${after.fields.Status.name}; write was not safely confirmed.`);
  }
  const receipt = { eventId, expected, target, reason, itemId: after.itemId,
    outcome: 'confirmed', mode: 'status-update', actor: after.actor, verifiedAt: new Date().toISOString() };
  document.events[eventId] = receipt;
  document.lastTask = publicTask(after);
  await saveHandoff(handoffPath, document);
  return { ...receipt, task: document.lastTask };
}

export async function recordSession(client, {
  eventId, handoffPath, branch, commit, summary, checks, nextAction, blockers = '',
}) {
  if (!eventId || !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/.test(eventId)) {
    throw new BoardError('EVENT_ID', 'A stable, nonsensitive --event-id is required.');
  }
  if (!handoffPath || !branch || !/^[0-9a-f]{7,40}$/.test(commit || '') ||
      !summary || !checks || !nextAction ||
      [branch, summary, checks, nextAction, blockers].some(value => value.length > 1000)) {
    throw new BoardError('HANDOFF', 'Provide --handoff, --branch, --commit, --summary, --checks, and --next-action.');
  }
  const document = await loadHandoff(handoffPath);
  const task = await client.read();
  if (task.issue.url !== ISSUE_URL || task.fields.Chair.name !== 'Chair 1 — Owner') {
    throw new BoardError('TASK_SCOPE', 'The live issue or Chair did not match DEV-001.');
  }
  const content = { eventId, branch, commit, summary, checks, nextAction, blockers };
  const prior = document.sessions[eventId];
  if (prior) {
    if (prior.itemId !== task.itemId || Object.entries(content).some(([key, value]) => prior[key] !== value)) {
      throw new BoardError('EVENT_CONFLICT', 'This session ID already belongs to a different handoff.');
    }
    return { outcome: 'already-recorded', eventId, task: publicTask(task) };
  }
  const entry = { ...content, recordedAt: new Date().toISOString(), observedStatus: task.fields.Status.name,
    itemId: task.itemId, actor: task.actor };
  document.sessions[eventId] = entry;
  document.lastTask = publicTask(task);
  await saveHandoff(handoffPath, document);
  return { outcome: 'recorded', ...entry, task: document.lastTask };
}
