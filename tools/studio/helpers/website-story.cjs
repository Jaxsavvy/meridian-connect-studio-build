'use strict';
// Shared test helper (Core, #186): fills a Website Job's chapter cards so every gate up to Look and assets passes.
// Screen tests that walk a Website Job through its stages call this once after startJob. Synthetic data only.
async function fillStory(service, spaceId, jobId) {
  const shot = (await service.generateImage({ spaceId, description: 'Synthetic hero photo', count: 1 })).results[0].assetId;
  await service.keepAsset(spaceId, shot);
  return service.saveStory(spaceId, jobId, { pages: [{ id: 'home', name: 'Home', path: '/', purpose: 'Get estimate calls',
    chapters: [{ id: 'hero', name: 'Hero', job: 'Make the visitor call for an estimate',
      words: { headline: 'Roofs done right', body: 'Licensed crews across the valley.', button: 'Call now' },
      layout: 'hero-photo', motion: 'none', phone: 'Photo above the headline',
      shots: [{ what: 'Crew on a finished roof', prompt: 'Synthetic photo of a roofing crew', size: 'wide', tool: 'image', assetId: shot }] }] }] });
}
module.exports = { fillStory };
