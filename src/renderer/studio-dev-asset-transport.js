/* DEV-020: development-only named transport for Cassy's asset client.
 * Never pass this module to employee runtime or production transport wiring.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MeridianStudioSyntheticAssetTransport = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const METHOD = Object.freeze({
    'asset.list': 'list',
    'asset.import': 'import',
    'asset.metadata': 'metadata',
    'asset.download': 'download',
    'asset.submit-review': 'review',
  });

  function createDevelopmentTransport({ context, SyntheticService }) {
    if (!context || typeof context.snapshot !== 'function' ||
        typeof SyntheticService !== 'function') {
      throw new TypeError('Development transport requires Connect context and the synthetic service.');
    }
    // This service is intentionally process-memory-only. It is not an authoritative backend.
    const service = new SyntheticService({ projects: [] });
    return Object.freeze({
      mode: 'synthetic',
      async request(operation, payload, { signal } = {}) {
        const method = METHOD[operation];
        if (!method) throw Object.assign(new Error('INVALID_OPERATION'), { code: 'INVALID_OPERATION' });
        const before = context.snapshot();
        const projectId = before.project?.id;
        const allowed = before.projects?.some(p => p.id === projectId);
        if (!allowed || payload?.projectId !== projectId) {
          throw Object.assign(new Error('PROJECT_DENIED'), { code: 'PROJECT_DENIED' });
        }
        // Synthetic service permissions follow the current accepted Connect list only.
        service.memberships = new Set(before.projects.map(p => p.id));
        const ticket = context.beginProjectRequest();
        const result = await service[method]({ ...payload, projectId, signal });
        if (signal?.aborted || !context.isCurrentRequest(ticket)) {
          throw Object.assign(new Error('CANCELLED'), { code: 'CANCELLED' });
        }
        return result;
      },
    });
  }

  return Object.freeze({ createDevelopmentTransport });
});
