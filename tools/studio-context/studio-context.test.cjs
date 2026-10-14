'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createStudioContext } = require('../../src/renderer/studio-context.js');

const alpha = { id: 'a'.repeat(32), name: 'Synthetic Alpha' };
const beta = { id: 'b'.repeat(32), name: 'Synthetic Beta' };

function withProjects(projects = [alpha, beta]) {
  const studio = createStudioContext();
  assert.equal(studio.acceptProjects(projects, studio.beginProjectList()), true);
  return studio;
}

test('starts without a selected project and labels every planned tool honestly', () => {
  const studio = createStudioContext();
  const state = studio.snapshot();
  assert.equal(state.project, null);
  assert.equal(state.tools.length, 9);
  assert.equal(new Set(state.tools.map(tool => tool.id)).size, 9);
  assert.ok(state.tools.every(tool => tool.availability === 'planned'));
  assert.equal(studio.beginProjectRequest(), null);
});

test('only a project in the accepted Connect list can become active', () => {
  const studio = withProjects();
  assert.equal(studio.selectProject('unknown'), false);
  assert.equal(studio.snapshot().project, null);
  assert.equal(studio.selectProject(alpha.id), true);
  assert.deepEqual(studio.snapshot().project, alpha);
  const copy = studio.snapshot();
  copy.project.name = 'Tampered';
  copy.tools[0].availability = 'available';
  assert.deepEqual(studio.snapshot().project, alpha);
  assert.equal(studio.snapshot().tools[0].availability, 'planned');
});

test('the newest project list wins when refreshes finish out of order', () => {
  const studio = createStudioContext();
  const old = studio.beginProjectList();
  const latest = studio.beginProjectList();
  assert.equal(studio.acceptProjects([alpha], latest), true);
  assert.equal(studio.acceptProjects([beta], old), false);
  assert.equal(studio.selectProject(alpha.id), true);
  assert.equal(studio.selectProject(beta.id), false);
});

test('rapid switches reject stale project work, including a switch back', () => {
  const studio = withProjects();
  studio.selectProject(alpha.id);
  const first = studio.beginProjectRequest();
  studio.selectProject(beta.id);
  assert.equal(studio.isCurrentRequest(first), false);
  const second = studio.beginProjectRequest();
  assert.equal(studio.isCurrentRequest(second), true);
  studio.selectProject(alpha.id);
  assert.equal(studio.isCurrentRequest(first), false);
  assert.equal(studio.isCurrentRequest(second), false);
  assert.equal(studio.isCurrentRequest(studio.beginProjectRequest()), true);
});

test('a refreshed list revokes a removed project', () => {
  const studio = withProjects();
  studio.selectProject(alpha.id);
  const pending = studio.beginProjectRequest();
  assert.equal(studio.acceptProjects([beta], studio.beginProjectList()), true);
  assert.equal(studio.snapshot().project, null);
  assert.equal(studio.isCurrentRequest(pending), false);
  assert.equal(studio.selectProject(alpha.id), false);
});

test('a failed or malformed project list fails closed', () => {
  const studio = withProjects();
  studio.selectProject(alpha.id);
  assert.equal(studio.acceptProjects([alpha, alpha], studio.beginProjectList()), false);
  assert.equal(studio.snapshot().project, null);
  assert.equal(studio.selectProject(alpha.id), false);
  assert.equal(studio.acceptProjects([beta], studio.beginProjectList()), true);
  studio.selectProject(beta.id);
  assert.equal(studio.rejectProjectList(studio.beginProjectList()), true);
  assert.equal(studio.snapshot().project, null);
});

test('project IDs containing URL path syntax are rejected with the whole list', () => {
  const studio = createStudioContext();
  assert.equal(studio.acceptProjects([alpha, { id: '../other', name: 'Unsafe' }],
    studio.beginProjectList()), false);
  assert.equal(studio.selectProject(alpha.id), false);
});

test('sign-out clears identity and invalidates pending list and project requests', () => {
  const studio = withProjects();
  studio.selectProject(alpha.id);
  const pendingWork = studio.beginProjectRequest();
  const pendingList = studio.beginProjectList();
  studio.reset();
  assert.equal(studio.snapshot().project, null);
  assert.equal(studio.isCurrentRequest(pendingWork), false);
  assert.equal(studio.acceptProjects([alpha], pendingList), false);
  assert.equal(studio.selectProject(alpha.id), false);
});

test('subscribers see selection and sign-out without owning mutable state', () => {
  const studio = withProjects();
  const events = [];
  const unsubscribe = studio.subscribe(state => events.push(state.project?.id || null));
  studio.selectProject(alpha.id);
  studio.selectProject(alpha.id);
  studio.reset();
  unsubscribe();
  assert.deepEqual(events, [alpha.id, null]);
});
