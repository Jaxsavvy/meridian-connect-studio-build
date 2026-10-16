(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./model'));
  else root.StudioAssetController = factory(root.StudioAssetModel);
})(typeof globalThis === 'object' ? globalThis : this, function (M) {
  'use strict';
  class Controller {
    constructor({ service, projects, onChange = () => {} }) {
      this.service = service; this.projects = M.clone(projects); this.onChange = onChange; this.generation = 0; this.requests = new Set(); this.writes = new Set(); this.read = null;
      this.state = { project: null, assets: [], selectedId: null, phase: 'idle', error: null, mode: service.mode };
    }
    snapshot() { return M.clone(this.state); }
    emit() { this.onChange(this.snapshot()); }
    validateRecord(input, projectId) {
      const asset = M.validate(input, projectId);
      const prior = this.state.assets.find(a => a.id === asset.id && a.projectId === projectId);
      // Older acknowledgements are ignored by monotonic merge; compare only records that could replace current state.
      if (!prior || asset.revision < prior.revision) return asset;
      if (asset.originalVersionId !== prior.originalVersionId || asset.originalFilename !== prior.originalFilename) M.fail('IMMUTABLE_VERSION_CHANGED');
      const versions = new Map(asset.versions.map(v => [v.id,v]));
      for (const original of prior.versions) {
        const incoming = versions.get(original.id);
        if (!incoming || ['assetId','projectId','originalVersionId','parentVersionId','sequence','operation','bytes','sha256','mediaType','originalFilename'].some(key => incoming[key] !== original[key])) M.fail('IMMUTABLE_VERSION_CHANGED');
      }
      return asset;
    }
    clear() {
      this.generation++; for (const request of this.requests) request.abort(); this.requests.clear(); this.writes.clear(); this.read = null;
      this.state = { project: null, assets: [], selectedId: null, phase: 'idle', error: null, mode: this.service.mode };
    }
    signOut() { this.clear(); this.projects = []; this.emit(); }
    async selectProject(projectId) {
      const project = this.projects.find(p => p.id === projectId);
      this.clear(); if (!project) { this.state.error = 'UNKNOWN_PROJECT'; this.emit(); return; }
      this.state.project = M.clone(project); this.emit(); return this.search();
    }
    selectAsset(id) { if (!this.state.assets.some(a => a.id === id)) M.fail('NOT_FOUND'); this.state.selectedId = id; this.emit(); }
    async request(action, read = false) {
      if (!this.state.project) M.fail('NO_PROJECT');
      const projectId = this.state.project.id; const generation = this.generation;
      const request = new AbortController();
      if (read && this.read) this.read.abort(); if (read) this.read = request;
      this.requests.add(request); if(!read)this.writes.add(request);this.state.phase = this.writes.size ? 'saving' : 'loading'; this.state.error = null; this.state.notice = null; this.emit();
      try {
        const result = await action({ projectId, signal: request.signal });
        if (generation !== this.generation || request.signal.aborted) return null;
        this.state.phase = 'ready'; return result;
      } catch (error) {
        if (generation !== this.generation || request.signal.aborted) return null;
        this.state.phase = error.code === 'OFFLINE' ? 'offline' : 'error'; this.state.error = error.code || 'REQUEST_FAILED';
        if (error.code === 'PROJECT_DENIED') { this.state.assets = []; this.state.selectedId = null; }
        return null;
      } finally {
        this.requests.delete(request);this.writes.delete(request);if (this.read === request) this.read = null;
        if (generation === this.generation && !request.signal.aborted) {
          if(this.writes.size)this.state.phase='saving';else if([...this.requests].some(r=>!r.signal.aborted))this.state.phase='loading';
          this.emit();
        }
      }
    }
    async search(filters = {}) {
      const result = await this.request(async scope => {
        const list = await this.service.list({ ...filters, ...scope });
        if (!Array.isArray(list)) M.fail('INVALID_RESPONSE');
        return list.map(a => this.validateRecord(a, scope.projectId));
      }, true);
      if (result) {
        const prior = new Map(this.state.assets.map(a => [a.id,a]));
        this.state.assets = result.map(asset => prior.has(asset.id) && prior.get(asset.id).revision > asset.revision ? prior.get(asset.id) : asset);
        if (!this.state.assets.some(a => a.id === this.state.selectedId)) this.state.selectedId = null;
        this.emit();
      }
      return result;
    }
    async save(method, input) {
      if (!['import','metadata','review'].includes(method)) M.fail('INVALID_OPERATION');
      const result = await this.request(async scope => {
        const asset = this.validateRecord(await this.service[method]({ ...input, ...scope }), scope.projectId);
        if (input.assetId && asset.id !== input.assetId) M.fail('INVALID_RESPONSE');
        return asset;
      });
      if (result) {
        const asset = M.validate(result, this.state.project.id); const index = this.state.assets.findIndex(a => a.id === asset.id);
        if (index < 0) this.state.assets.push(asset); else if (this.state.assets[index].revision <= asset.revision) this.state.assets[index] = asset;
        this.state.selectedId = asset.id;
        this.state.notice = {import:'Asset imported and saved.',metadata:'Metadata saved.',review:'Selected version submitted for review.'}[method];this.emit();
      }
      return result;
    }
    async reloadAsset(assetId) {
      const result = await this.request(async scope => {
        if (typeof this.service.get === 'function') {
          const asset = this.validateRecord(await this.service.get({assetId,...scope}),scope.projectId);
          if(asset.id!==assetId)M.fail('INVALID_RESPONSE');
          return asset;
        }
        // Full-list fallback belongs only to the existing explicitly synthetic adapter.
        if(this.service.mode!=='synthetic')M.fail('SERVICE_UNAVAILABLE');
        const list = await this.service.list({ ...scope });
        if (!Array.isArray(list)) M.fail('INVALID_RESPONSE');
        const records = list.map(a => this.validateRecord(a, scope.projectId));
        const asset = records.find(a => a.id === assetId);
        if (!asset) M.fail('NOT_FOUND');
        return asset;
      }, true);
      if (!result) return null;
      const index = this.state.assets.findIndex(a => a.id === assetId);
      if (index < 0) this.state.assets.push(result);
      else if (this.state.assets[index].revision <= result.revision) this.state.assets[index] = result;
      this.state.selectedId = assetId; this.emit();
      return M.clone(this.state.assets.find(a => a.id === assetId));
    }
    download(input) { return this.request(async scope => {
      const asset = this.state.assets.find(a => a.id === input.assetId);
      const version = asset && asset.versions.find(v => v.id === input.versionId);
      if (!version) M.fail('NOT_FOUND');
      const result = await this.service.download({ ...input, ...scope });
      if (!result || !(result.bytes instanceof Uint8Array) || result.bytes.length > 128 * 1024 * 1024 || !result.bytes.length) M.fail('INVALID_RESPONSE');
      const digest = await crypto.subtle.digest('SHA-256', result.bytes);
      const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
      if (hash !== result.sha256 || result.sha256 !== version.sha256 || result.mediaType !== version.mediaType || result.bytes.length !== version.bytes) M.fail('CHECKSUM_MISMATCH');
      // Validate the display-name stem at its own limit, then append the exact version suffix.
      // A transport filename is neither canonical metadata nor a destination grant.
      return { ...result, filename: M.exportName(asset, version) };
    }, true); }
    cancel() { this.generation++; for (const r of this.requests) r.abort(); this.requests.clear();this.writes.clear();this.read = null; this.state.notice=null;this.state.phase = 'cancelled'; this.emit(); }
  }
  return { Controller };
});
