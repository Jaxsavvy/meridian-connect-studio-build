#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createGhClient, BoardError } from './github.mjs';
import { publicTask, recordSession, sync } from './sync.mjs';

function options(args) {
  const result = {};
  for (let index = 0; index < args.length; index += 2) {
    if (!args[index]?.startsWith('--') || args[index + 1] === undefined) {
      throw new BoardError('ARGUMENT', 'Use --name value options.');
    }
    result[args[index].slice(2)] = args[index + 1];
  }
  return result;
}

function gitValue(...args) {
  const result = spawnSync('git', args, { encoding: 'utf8', shell: false, windowsHide: true });
  if (result.error || result.status !== 0 || !result.stdout.trim()) {
    throw new BoardError('GIT', 'Could not identify the current Git branch and commit.');
  }
  return result.stdout.trim();
}

function integrationBranch() {
  const branch = gitValue('branch', '--show-current');
  if (branch !== 'feature/studio-integration') {
    throw new BoardError('BRANCH', 'DEV-001 updates require feature/studio-integration.');
  }
  return branch;
}

try {
  const [command, ...rest] = process.argv.slice(2);
  const client = createGhClient();
  let result;
  if (command === 'inspect' && rest.length === 0) result = publicTask(await client.read());
  else if (command === 'sync') {
    integrationBranch();
    const input = options(rest);
    result = await sync(client, {
      expected: input.expected, target: input.target, eventId: input['event-id'],
      handoffPath: input.handoff, reason: input.reason,
    });
  } else if (command === 'handoff') {
    const input = options(rest);
    result = await recordSession(client, {
      eventId: input['event-id'], handoffPath: input.handoff,
      branch: integrationBranch(), commit: gitValue('rev-parse', 'HEAD'), summary: input.summary,
      checks: input.checks, nextAction: input['next-action'], blockers: input.blockers,
    });
  } else throw new BoardError('USAGE', 'Use inspect, sync --expected STATUS --target STATUS --event-id ID --reason TEXT --handoff PATH, or handoff --event-id ID --summary TEXT --checks TEXT --next-action TEXT --handoff PATH.');
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  const category = error instanceof BoardError ? error.category : 'UNEXPECTED';
  process.stderr.write(`${JSON.stringify({ outcome: 'pending', category, message: error.message })}\n`);
  process.exitCode = 1;
}
