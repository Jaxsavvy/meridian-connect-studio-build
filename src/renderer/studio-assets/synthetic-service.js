(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./model'));
  else root.StudioSyntheticService = factory(root.StudioAssetModel);
})(typeof globalThis === 'object' ? globalThis : this, function (M) {
  'use strict';
  // Development adapter only. No endpoints, credentials, filesystem or persistence.
  class SyntheticService {
    constructor({ projects, actor = 'synthetic-member', delay = 0, beforeCommit = null, clock = () => new Date().toISOString() } = {}) {
      this.mode = 'synthetic'; this.actor = actor; this.memberships = new Set(projects || []);
      this.delay = delay; this.beforeCommit = beforeCommit;this.clock=clock;this.assets = new Map(); this.content = new Map(); this.keys = new Map(); this.counter = 0; this.offline = false; this.storageFailure = false;
    }
    revoke(projectId) { this.memberships.delete(projectId); }
    authorize(projectId, signal) {
      if (signal && signal.aborted) M.fail('CANCELLED');
      if (!this.memberships.has(projectId)) M.fail('PROJECT_DENIED');
      if (this.offline) M.fail('OFFLINE');
    }
    async boundary(projectId, signal, write = false) {
      this.authorize(projectId, signal);
      if (this.delay) await new Promise(resolve => setTimeout(resolve, this.delay));
      if (write && this.beforeCommit) await this.beforeCommit();
      this.authorize(projectId, signal);
      if (write && this.storageFailure) M.fail('STORAGE_FAILED');
    }
    record(projectId, assetId) {
      const asset = this.assets.get(assetId);
      if (!asset || asset.projectId !== projectId) M.fail('NOT_FOUND');
      return asset;
    }
    async list({ projectId, query = '', section = '', mediaType = '', reviewState = '', signal }) {
      await this.boundary(projectId, signal);
      const q = String(query).toLocaleLowerCase();
      return [...this.assets.values()].filter(a => a.projectId === projectId && (!section || a.section === section) && a.versions.some(v=>(!mediaType || v.mediaType===mediaType) && (!reviewState || v.reviewState===reviewState)) && [a.name, a.originalFilename, a.description, ...a.tags].join(' ').toLocaleLowerCase().includes(q)).map(a => M.validate(a, projectId));
    }
    async import({ projectId, assetId, parentVersionId, filename, mediaType, bytes, operation = 'original', idempotencyKey, signal }) {
      // Filename is never a storage path. Reject path-like inputs rather than sanitizing silently.
      M.text(filename); if (/[\\/]/.test(filename) || filename === '.' || filename === '..') M.fail('UNSAFE_PATH');
      if (!(bytes instanceof Uint8Array) || !bytes.length) M.fail('MISSING_FILE');
      if (bytes.length > 25 * 1024 * 1024) M.fail('TOO_LARGE');
      if (!['image/png', 'image/jpeg', 'text/plain'].includes(mediaType)) M.fail('UNSUPPORTED_MEDIA');
      if (mediaType === 'image/png' && (bytes.length < 24 || ![137,80,78,71,13,10,26,10].every((b,i) => bytes[i] === b))) M.fail('CORRUPT_MEDIA');
      if (mediaType === 'image/jpeg' && (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217)) M.fail('CORRUPT_MEDIA');
      if (!['original', 'manual-edit', 'upscale'].includes(operation)) M.fail('INVALID_VERSION');
      M.text(idempotencyKey);
      const copy = new Uint8Array(bytes); // Snapshot before awaiting; callers cannot mutate input during commit.
      const digest = await crypto.subtle.digest('SHA-256', copy);
      const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
      const fingerprint = JSON.stringify([assetId || null, parentVersionId || null, filename, mediaType, operation, hash]);
      await this.boundary(projectId, signal, true);
      const key = JSON.stringify([this.actor, projectId, idempotencyKey]);
      if (this.keys.has(key)) {
        const prior = this.keys.get(key); if (prior.fingerprint !== fingerprint) M.fail('IDEMPOTENCY_CONFLICT');
        return M.clone(prior.result);
      }
      let asset;
      if (assetId) {
        asset = M.clone(this.record(projectId, assetId));
        if (!asset.versions.some(v => v.id === parentVersionId) || operation === 'original') M.fail('INVALID_LINEAGE');
      } else {
        if (parentVersionId || operation !== 'original') M.fail('INVALID_LINEAGE');
        asset = { id: `synthetic-asset-${++this.counter}`, projectId, name: M.suggestName(filename), originalFilename: filename, originalVersionId: null, preferredVersionId: null, revision: 1, tags: [], section: 'Files', description: '', provenance: { name: { source: 'rule', rule: 'filename-v1', at:this.clock() } }, metadataHistory:[],versions: [] };
      }
      const id = `synthetic-version-${++this.counter}`;
      if (!asset.originalVersionId) asset.originalVersionId = id;
      asset.versions.push({ id, projectId, assetId: asset.id, originalVersionId: asset.originalVersionId, parentVersionId: parentVersionId || null, sequence: asset.versions.length + 1, operation, reviewState: 'draft', bytes: copy.length, sha256: hash, mediaType, originalFilename: filename });
      asset.preferredVersionId = id; if (assetId) asset.revision++;
      const result = M.validate(asset, projectId);
      this.assets.set(asset.id, result); this.content.set(id, copy); this.keys.set(key, { fingerprint, result: M.clone(result) });
      return M.clone(result);
    }
    async metadata({ projectId, assetId, revision, name, tags, description, section, signal }) {
      const patch = { name: M.text(name), tags: tags.map(t => M.text(t, 64)), description: String(description || '').slice(0, 2000), section: M.text(section) };
      await this.boundary(projectId, signal, true);
      const prior = this.record(projectId, assetId); if (prior.revision !== revision) M.fail('REVISION_CONFLICT');
      const provenance=M.clone(prior.provenance || {}),changes={},at=this.clock();
      for(const field of ['name','tags','description','section'])if(JSON.stringify(prior[field])!==JSON.stringify(patch[field])){
        changes[field]={before:M.clone(prior[field]),after:M.clone(patch[field])};provenance[field]={source:'human',actor:this.actor,at};
      }
      const history=M.clone(prior.metadataHistory || []);if(Object.keys(changes).length)history.push({revision:prior.revision+1,actor:this.actor,at,changes});
      const result = { ...M.clone(prior), ...patch, revision: prior.revision + 1, provenance,metadataHistory:history.slice(-100) };
      this.assets.set(assetId, M.validate(result, projectId)); return M.clone(result);
    }
    async download({ projectId, assetId, versionId, signal }) {
      await this.boundary(projectId, signal);
      const asset = this.record(projectId, assetId); const version = asset.versions.find(v => v.id === versionId);
      if (!version || !this.content.has(versionId)) M.fail('NOT_FOUND');
      return { filename: M.exportName(asset, version), bytes: new Uint8Array(this.content.get(versionId)), mediaType: version.mediaType, sha256: version.sha256 };
    }
    async review({ projectId, assetId, versionId, revision, signal }) {
      await this.boundary(projectId, signal, true); const asset = M.clone(this.record(projectId, assetId));
      if (asset.revision !== revision) M.fail('REVISION_CONFLICT');
      const version = asset.versions.find(v => v.id === versionId); if (!version) M.fail('NOT_FOUND');
      if (!['draft', 'changes-requested'].includes(version.reviewState)) M.fail('INVALID_REVIEW');
      version.reviewState = 'submitted'; asset.revision++; this.assets.set(assetId, asset); return M.clone(asset);
    }
  }
  return { SyntheticService };
});
