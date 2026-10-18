'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../../src/renderer/studio-ui/website-builder.js');

for (const initialSeed of [19371, 0x12345678, 0xdeadbeef, 0x7fffffff]) {
test(`18000 deterministic editing transitions preserve invariants (seed ${initialSeed})`, () => {
  let seed = initialSeed;
  const random = size => (seed = (seed * 1664525 + 1013904223) >>> 0) % size;
  let total = 0;
  for (let run = 0; run < 30; run++) {
    let identity = 0;
    const storage = W.createMemoryStorage();
    const controller = W.createController({
      storage,
      now: () => '2026-10-17T00:00:00.000Z',
      idFactory: prefix => `${prefix}-audit-${run}-${++identity}`,
    });
    controller.selectContext({ id: 'synthetic-a', name: 'Synthetic A' });
    assert.equal(controller.createProject(`Audit ${run}`), true);
    for (let step = 0; step < 600; step++) {
      const state = controller.snapshot();
      const project = state.project;
      const page = project.pages.find(item => item.id === state.selectedPageId);
      const section = page.sections[0];
      const actions = [
        () => controller.addPage(`Page ${random(5)}`),
        () => controller.selectPage(project.pages[random(project.pages.length)].id),
        () => controller.updateBrief('goal', `Goal ${step}`),
        () => controller.updatePage('title', `Title ${step}`),
        () => controller.addSection(['hero', 'content', 'features', 'cta'][random(4)]),
        () => section && controller.updateSection(section.id, 'body', `Body ${step}`),
        () => section && controller.makeSectionShared(section.id),
        () => {
          const groups = W.sharedSections(project);
          return groups.length && controller.addSharedSection(groups[random(groups.length)].id);
        },
        () => section && controller.detachSection(section.id),
        () => controller.undo(),
        () => controller.redo(),
        () => controller.save(),
        () => controller.removePage(project.pages[random(project.pages.length)].id),
        () => section && controller.removeSection(section.id),
        () => controller.movePage(project.pages[random(project.pages.length)].id, random(2) ? 1 : -1),
        () => controller.updatePage('parentPageId', project.pages[random(project.pages.length)].id),
        () => controller.createCheckpoint(`Checkpoint ${step}`),
        () => {
          const checkpoints = controller.snapshot().checkpoints;
          return checkpoints.length && controller.removeCheckpoint(checkpoints[0].id);
        },
        () => controller.saveSeparateCopy(),
        () => { const checkpoints = controller.snapshot().checkpoints; return checkpoints.length && !controller.snapshot().dirty && controller.restoreCheckpoint(checkpoints[random(checkpoints.length)].id); },
        () => { if (controller.save()) return controller.openProject(controller.snapshot().project.id); },
      ];
      const action = random(actions.length);
      try {
        actions[action]();
        const next = controller.snapshot();
        W.validateProject(next.project, 'synthetic-a');
        assert.ok(next.project.pages.some(item => item.id === next.selectedPageId));
        assert.ok(controller.exportSite().files['index.html']);
      } catch (error) {
        error.message += ` (initialSeed ${initialSeed}, run ${run}, step ${step}, action ${action}, seed ${seed})`;
        throw error;
      }
      total++;
    }
  }
  assert.equal(total, 18000);
});

}
