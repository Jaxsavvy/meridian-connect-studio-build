'use strict';
// Shared test helper (Core, #186, #202, #229): fills a Website Job's concept and chapter cards and picks a look frame, so every gate up to Look and assets passes.
// Screen tests that walk a Website Job through its stages call this once after startJob. Synthetic data only.
// Concept (#229): saves a complete concept unless it has already gone to Jax. Doesn't move the Job.
async function fillConcept(service, spaceId, jobId) {
  const stage = (await service.getJob(spaceId, jobId)).stages.find(st => st.id === 'concept');
  if (!stage || !['current', 'upcoming'].includes(stage.status)) return;
  await service.saveConcept(spaceId, jobId, { line: 'A roof that shrugs off the rain', audience: 'Homeowners in the valley',
    goal: 'Book a roof check', mood: ['calm', 'sturdy', 'local'], references: [1, 2, 3].map(n => ({ url: `https://example.com/ref-${n}`, note: 'Clear call button' })) });
}
// Concept is a Jax stage before Story: if the Job is sitting at Concept, fillStory sends it and approves it, so walks keep their steps.
async function fillStory(service, spaceId, jobId) {
  await fillConcept(service, spaceId, jobId);
  if ((await service.getJob(spaceId, jobId)).stageId === 'concept') { await service.completeStage(spaceId, jobId); await service.approveStage(spaceId, jobId); }
  const shot = (await service.generateImage({ spaceId, description: 'Synthetic hero photo', count: 1 })).results[0].assetId;
  await service.keepAsset(spaceId, shot);
  const saved = await service.saveStory(spaceId, jobId, { pages: [{ id: 'home', name: 'Home', path: '/', purpose: 'Get estimate calls',
    chapters: [{ id: 'hero', name: 'Hero', job: 'Make the visitor call for an estimate',
      words: { headline: 'Roofs done right', body: 'Licensed crews across the valley.', button: 'Call now' },
      layout: 'hero-photo', motion: 'none', phone: 'Photo above the headline',
      shots: [{ what: 'Crew on a finished roof', prompt: 'Synthetic photo of a roofing crew', size: 'wide', tool: 'image', assetId: shot }] }] }] });
  const look = await service.makeLookFrames(spaceId, jobId, { directions: ['bold'] });   // look frames (#202)
  await service.chooseLookFrame(spaceId, jobId, look.frames[0].id);
  return saved;
}
// Build can't finish without a site (#206): walk loops call this before completing each stage.
async function startSiteAtBuild(service, spaceId, jobId) {
  const job = await service.getJob(spaceId, jobId);
  if (job.stageId === 'build' && !(await service.getSite(spaceId, jobId))) await service.startSite(spaceId, jobId, { from: 'cards' });
}
module.exports = { fillConcept, fillStory, startSiteAtBuild };
