/* DEV-010 public-safe test reference. No service, bridge, or packaged runtime access. */
module.exports = (function (Model) {
  'use strict';
  const CONTRACT = 'studio.files.v1';
  const ID = /^[A-Za-z0-9_-]{1,128}$/;
  const SHA = /^[0-9a-f]{64}$/;
  const REVIEW = new Set(['draft', 'submitted', 'approved', 'changes-requested']);
  const fail = code => { const error = new Error(code); error.code = code; throw error; };
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const id = value => typeof value === 'string' && ID.test(value);
  const sha = value => typeof value === 'string' && SHA.test(value);
  const integer = value => Number.isSafeInteger(value) && value >= 1;
  const responseText = (value, max) => {
    if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) fail('INVALID_RESPONSE');
    const normalized = value.normalize('NFC').trim();
    if (!normalized || normalized.length > max || /[\u0000-\u001f]/.test(normalized)) fail('INVALID_RESPONSE');
  };
  function text(value, max) {
    if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) fail('INVALID_REQUEST');
    const normalized = value.normalize('NFC').trim();
    if (!normalized || normalized.length > max || /[\u0000-\u001f]/.test(normalized)) fail('INVALID_REQUEST');
    return normalized;
  }
  function keys(value, allowed) {
    if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) fail('INVALID_REQUEST');
  }
  function envelope(response) {
    if (!object(response) || response.contract !== CONTRACT || !id(response.correlationId)) fail('INVALID_RESPONSE');
  }
  function responseKeys(value, allowed) {
    if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) fail('INVALID_RESPONSE');
  }
  function historyTime(seconds) {
    if (!Number.isSafeInteger(seconds) || seconds < 0) fail('INVALID_RESPONSE');
    const date = new Date(seconds * 1000);
    if (!Number.isFinite(date.getTime())) fail('INVALID_RESPONSE');
    return date.toISOString();
  }
  function mapMetadataHistory(events, revision) {
    if (!Array.isArray(events) || events.length > 100) fail('PAGED_HISTORY_UNSUPPORTED');
    return events.map(event => {
      responseKeys(event, ['actorId','priorRevision','revision','changed','createdAt','correlationId']);
      if (!id(event.actorId) || !id(event.correlationId) || !integer(event.priorRevision) ||
          !integer(event.revision) || event.priorRevision >= event.revision ||
          event.revision > revision || !object(event.changed) ||
          !Object.keys(event.changed).length ||
          Object.keys(event.changed).some(field => !['name','tags','description','section'].includes(field))) fail('INVALID_RESPONSE');
      for (const [field, change] of Object.entries(event.changed)) {
        responseKeys(change, ['before','after']);
        if (!Object.hasOwn(change, 'before') || !Object.hasOwn(change, 'after')) fail('INVALID_RESPONSE');
        for (const value of [change.before, change.after]) {
          if (field === 'tags') {
            if (!Array.isArray(value) || value.length > 30 || value.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > 64)) fail('INVALID_RESPONSE');
          } else if (typeof value !== 'string' || value.length > (field === 'description' ? 2000 : field === 'section' ? 100 : 160)) fail('INVALID_RESPONSE');
        }
      }
      return { actor: event.actorId, at: historyTime(event.createdAt),
        priorRevision: event.priorRevision, revision: event.revision,
        changes: structuredClone(event.changed), correlationId: event.correlationId };
    });
  }
  function mapReviewHistory(events, revision, versionIds) {
    if (!Array.isArray(events) || events.length > 100) fail('PAGED_HISTORY_UNSUPPORTED');
    return events.map(event => {
      responseKeys(event, ['actorId','versionId','decision','revision','createdAt','correlationId']);
      if (!id(event.actorId) || !id(event.correlationId) || !versionIds.has(event.versionId) ||
          !['submitted','approved','changes-requested'].includes(event.decision) || !integer(event.revision) ||
          event.revision > revision) fail('INVALID_RESPONSE');
      return { actor: event.actorId, at: historyTime(event.createdAt),
        versionId: event.versionId, decision: event.decision, revision: event.revision,
        correlationId: event.correlationId };
    });
  }
  function parseSearchPage(response, projectId, limit = 50) {
    envelope(response);
    responseKeys(response, ['contract','correlationId','items','nextCursor']);
    if (!id(projectId) || !integer(limit) || limit > 50 || !Array.isArray(response.items) ||
        response.items.length > limit || (response.items.length === 0 && response.nextCursor !== null) ||
        !(response.nextCursor === null ||
        (typeof response.nextCursor === 'string' && response.nextCursor.length > 0 && response.nextCursor.length <= 512))) fail('INVALID_RESPONSE');
    const seen = new Set();
    for (const item of response.items) {
      responseKeys(item, ['assetId','projectId','revision','name','originalVersionId',
        'preferredVersionId','preferredMediaType','preferredReviewState','updatedAt']);
      if (!object(item) || item.projectId !== projectId || !id(item.assetId) ||
          seen.has(item.assetId) || !integer(item.revision) || !id(item.originalVersionId) ||
          !id(item.preferredVersionId) ||
          typeof item.preferredMediaType !== 'string' || !REVIEW.has(item.preferredReviewState) ||
          typeof item.updatedAt !== 'string' || !item.updatedAt) fail('INVALID_RESPONSE');
      responseText(item.name, 160);
      seen.add(item.assetId);
    }
    return {
      items: structuredClone(response.items),
      nextCursor: response.nextCursor,
      complete: response.nextCursor === null,
    };
  }
  function mapAsset(response, projectId, assetId) {
    envelope(response);
    responseKeys(response, ['contract','correlationId','asset']);
    const a = response.asset;
    if (!id(projectId) || !id(assetId) || !object(a) || a.projectId !== projectId ||
        a.assetId !== assetId || !Array.isArray(a.versions) ||
        !Array.isArray(a.metadataHistory) || !Array.isArray(a.reviewHistory) ||
        !Object.hasOwn(a, 'historyCursor') ||
        !(a.historyCursor === null ||
        (typeof a.historyCursor === 'string' && a.historyCursor.length > 0))) fail('INVALID_RESPONSE');
    if (a.historyCursor) fail('PAGED_HISTORY_UNSUPPORTED');
    responseKeys(a, ['assetId','projectId','revision','name','originalFilename','tags',
      'description','section','originalVersionId','preferredVersionId','versions',
      'historyCursor','provenance','metadataHistory','reviewHistory']);
    responseText(a.name, 160);
    responseText(a.originalFilename, 160);
    if (typeof a.description !== 'string' || a.description.length > 2000) fail('INVALID_RESPONSE');
    responseText(a.section, 100);
    const mapped = {
      id: a.assetId, projectId: a.projectId, revision: a.revision, name: a.name,
      originalFilename: a.originalFilename, tags: a.tags, description: a.description,
      section: a.section, originalVersionId: a.originalVersionId,
      preferredVersionId: a.preferredVersionId,
      versions: a.versions.map(v => {
        responseKeys(v, ['versionId','assetId','projectId','sequence','originalVersionId',
          'parentVersionId','operation','reviewState','byteLength','sha256','mediaType',
          'originalFilename']);
        if (!object(v) || !id(v.versionId) || !integer(v.sequence) || !integer(v.byteLength) ||
            !sha(v.sha256)) fail('INVALID_RESPONSE');
        responseText(v.originalFilename, 160);
        return {
          id: v.versionId, assetId: v.assetId, projectId: v.projectId,
          sequence: v.sequence, originalVersionId: v.originalVersionId,
          parentVersionId: v.parentVersionId, operation: v.operation,
          reviewState: v.reviewState, bytes: v.byteLength, sha256: v.sha256,
          mediaType: v.mediaType, originalFilename: v.originalFilename,
        };
      }),
    };
    if (a.provenance !== undefined) mapped.provenance = a.provenance;
    mapped.metadataHistory = mapMetadataHistory(a.metadataHistory, a.revision);
    mapped.reviewHistory = mapReviewHistory(
      a.reviewHistory, a.revision, new Set(a.versions.map(v => v.versionId)));
    try { return Model.validate(mapped, projectId); }
    catch (error) { fail(error.code === 'PROJECT_DENIED' ? 'PROJECT_DENIED' : 'INVALID_RESPONSE'); }
  }
  function tuple(operation, projectId, payload) {
    if (!id(projectId)) fail('INVALID_REQUEST');
    if (operation === 'files.import-begin') {
      keys(payload, ['filename','mediaType','byteLength','sha256','assetId','parentVersionId','baseRevision','mutationKey']);
      const filename = text(payload.filename, 160);
      if (/[\\/]/.test(filename) || filename === '.' || filename === '..' ||
          typeof payload.mediaType !== 'string' || !/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(payload.mediaType) ||
          !integer(payload.byteLength) || !sha(payload.sha256)) fail('INVALID_REQUEST');
      const derivative = payload.assetId !== undefined || payload.parentVersionId !== undefined || payload.baseRevision !== undefined;
      if (derivative && (!id(payload.assetId) || !id(payload.parentVersionId) || !integer(payload.baseRevision))) fail('INVALID_REQUEST');
      return [operation, projectId, filename, payload.mediaType, payload.byteLength, payload.sha256,
        derivative ? payload.assetId : null, derivative ? payload.parentVersionId : null,
        derivative ? payload.baseRevision : null];
    }
    if (operation === 'files.import-finalize') {
      keys(payload, ['uploadId','sha256','assetId','parentVersionId','mutationKey']);
      if (!id(payload.uploadId) || !sha(payload.sha256)) fail('INVALID_REQUEST');
      const derivative = payload.assetId !== undefined || payload.parentVersionId !== undefined;
      if (derivative && (!id(payload.assetId) || !id(payload.parentVersionId))) fail('INVALID_REQUEST');
      return [operation, projectId, payload.uploadId, payload.sha256,
        derivative ? payload.assetId : null, derivative ? payload.parentVersionId : null];
    }
    if (operation === 'files.metadata') {
      keys(payload, ['assetId','expectedRevision','name','tags','description','section','mutationKey']);
      if (!id(payload.assetId) || !integer(payload.expectedRevision) || !Array.isArray(payload.tags) ||
          payload.tags.length > 30 || typeof payload.description !== 'string' ||
          payload.description.length > 2000) fail('INVALID_REQUEST');
      const tags = payload.tags.map(tag => text(tag, 64));
      return [operation, projectId, payload.assetId, payload.expectedRevision,
        text(payload.name, 160), tags, payload.description.normalize('NFC'), text(payload.section, 100)];
    }
    if (operation === 'files.submit-review') {
      keys(payload, ['assetId','versionId','expectedRevision','decision','mutationKey']);
      if (!id(payload.assetId) || !id(payload.versionId) || !integer(payload.expectedRevision) ||
          payload.decision !== 'submitted') fail('INVALID_REQUEST');
      return [operation, projectId, payload.assetId, payload.versionId, payload.expectedRevision, 'submitted'];
    }
    fail('INVALID_OPERATION');
  }
  async function bodyDigest(operation, projectId, payload) {
    if (!object(payload) || !id(payload.mutationKey) || payload.mutationKey.length < 16) fail('INVALID_REQUEST');
    const bytes = new TextEncoder().encode(JSON.stringify(tuple(operation, projectId, payload)));
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return Object.freeze({ CONTRACT, parseSearchPage, mapAsset, bodyDigest });
})(require('../../src/renderer/studio-assets/model'));
