(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MeridianStudioFixtures = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const TOOL_DETAILS = Object.freeze({
    images: 'Image generation requires an approved provider, project permission, and spending gate.',
    storyboard: 'Storyboard service verification is pending. The development editor below does not call it.',
    video: 'Video Studio requires an approved Higgsfield provider contract and job lifecycle.',
    blender: 'Blender requires an approved, host-controlled desktop exchange.',
    krita: 'Krita requires an approved, host-controlled artwork exchange.',
    upscayl: 'Upscayl remains unavailable until isolation and distribution review are accepted.',
    website: 'Create, save and export websites on this device. Team sync, connected media and publishing are not available yet.',
    audio: 'Audio Studio requires approved capture, provider, consent, and export contracts.',
    files: 'Studio Files requires the authoritative project-scoped asset service and host lifecycle.',
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createProjectFixture(project) {
    const projectName = project && project.name ? project.name : 'Selected project';
    return clone({
      developmentOnly: true,
      project: { id: project.id, name: projectName },
      campaign: {
        id: 'campaign-northstar',
        name: 'Northstar Launch Story',
        brief: `A synthetic campaign workspace for ${projectName}. No service or customer content is connected.`,
        progress: 64,
        scenes: 6,
        assets: 24,
        decisions: 2,
        status: 'Draft',
      },
      scenes: [
        { id: 'scene-opening', name: '01 · Opening signal', duration: '00:08', status: 'Saved', note: 'A restrained opening establishes place, purpose, and project context.' },
        { id: 'scene-proof', name: '02 · Proof in motion', duration: '00:12', status: 'Unsaved', note: 'Show the team moving from a clear brief to a reviewable creative decision.' },
        { id: 'scene-close', name: '03 · Confident close', duration: '00:06', status: 'Needs review', note: 'End on a calm, practical next action without implying approval.' },
      ],
      assets: [
        { id: 'asset-ridge', name: 'Ridgeline master — extended synthetic filename for responsive layout verification', type: 'Original', version: 'v1', status: 'Approved', tone: 'blue' },
        { id: 'asset-light', name: 'Light study', type: 'Derivative', version: 'v3', status: 'Draft', tone: 'teal', parent: 'Ridgeline master' },
        { id: 'asset-frame', name: 'Product frame select', type: 'Original', version: 'v2', status: 'Needs review', tone: 'gold' },
        { id: 'asset-type', name: 'Editorial title treatment', type: 'Derivative', version: 'v4', status: 'Approved', tone: 'slate', parent: 'Type study' },
      ],
      decisions: [
        { id: 'decision-hero', title: 'Hero cut v3', reason: 'Choose the final opening rhythm before assembly.', owner: 'Creative reviewer', state: 'Needs review' },
        { id: 'decision-frame', title: 'Product frame select', reason: 'Confirm the reviewable synthetic frame for scene two.', owner: 'Project reviewer', state: 'Needs review' },
      ],
    });
  }

  function createSyntheticAdapter(options = {}) {
    const delay = Number.isFinite(options.delay) ? options.delay : 120;
    let failNextLoad = false;
    let failNextSave = false;
    const wait = () => new Promise(resolve => setTimeout(resolve, delay));
    return {
      mode: 'synthetic',
      failNext(operation) {
        if (operation === 'load') failNextLoad = true;
        if (operation === 'save') failNextSave = true;
      },
      async load(project) {
        await wait();
        if (failNextLoad) {
          failNextLoad = false;
          throw new Error('Synthetic project load failed.');
        }
        return createProjectFixture(project);
      },
      async save(payload) {
        await wait();
        if (failNextSave) {
          failNextSave = false;
          throw new Error('Synthetic draft save failed.');
        }
        return { ...clone(payload), savedAt: new Date().toISOString() };
      },
    };
  }

  return Object.freeze({ TOOL_DETAILS, createProjectFixture, createSyntheticAdapter });
});
