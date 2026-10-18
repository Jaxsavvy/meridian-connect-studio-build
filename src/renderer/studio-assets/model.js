(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StudioAssetModel = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const fail = (code) => { const error = new Error(code); error.code = code; throw error; };
  const clone = (value) => structuredClone(value);
  function text(value, max = 160) {
    if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) fail('INVALID_TEXT');
    const normalized = value.normalize('NFC').trim();
    if (!normalized || normalized.length > max || /[\u0000-\u001f]/.test(normalized)) fail('INVALID_TEXT');
    return normalized;
  }
  function safeName(value) {
    let name = text(value).replace(/[<>:"/\\|?*]/g, '-').replace(/[. ]+$/g, '');
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = '_' + name;
    if (!name || name === '.' || name === '..') fail('UNSAFE_NAME');
    return name;
  }
  function validate(asset, projectId) {
    if (!asset || asset.projectId !== projectId) fail('PROJECT_DENIED');
    text(asset.id); text(asset.name); text(asset.originalFilename);
    if (!Number.isInteger(asset.revision) || asset.revision < 1 || !Array.isArray(asset.tags) || asset.tags.some(t => typeof t !== 'string')) fail('INVALID_METADATA');
    if(asset.provenance!==undefined){
      if(!asset.provenance || typeof asset.provenance!=='object' || Array.isArray(asset.provenance))fail('INVALID_METADATA');
      for(const entry of Object.values(asset.provenance))if(!entry || !['rule','human','file','model'].includes(entry.source) || (entry.actor!==undefined && typeof entry.actor!=='string') || (entry.at!==undefined && typeof entry.at!=='string'))fail('INVALID_METADATA');
    }
    if(asset.metadataHistory!==undefined){
      if(!Array.isArray(asset.metadataHistory) || asset.metadataHistory.length>100)fail('INVALID_METADATA');
      for(const event of asset.metadataHistory){
        if(!event || !Number.isInteger(event.revision) || event.revision<1 || event.revision>asset.revision || typeof event.actor!=='string' || typeof event.at!=='string' || !event.changes || typeof event.changes!=='object' || Array.isArray(event.changes))fail('INVALID_METADATA');
        for(const [field,change]of Object.entries(event.changes))if(!['name','tags','description','section'].includes(field) || !change || !Object.hasOwn(change,'before') || !Object.hasOwn(change,'after'))fail('INVALID_METADATA');
      }
    }
    const versions = asset.versions;
    if (!Array.isArray(versions) || !versions.length) fail('INVALID_LINEAGE');
    const map = new Map(); const sequences = new Set();
    for (const v of versions) {
      text(v.id);
      if (map.has(v.id) || sequences.has(v.sequence) || !Number.isInteger(v.sequence) || v.sequence < 1) fail('INVALID_LINEAGE');
      if (v.projectId !== projectId || v.assetId !== asset.id || v.originalVersionId !== asset.originalVersionId) fail('PROJECT_DENIED');
      if (!['draft', 'submitted', 'approved', 'changes-requested'].includes(v.reviewState)) fail('INVALID_REVIEW');
      if (!['original', 'manual-edit', 'upscale'].includes(v.operation) || !Number.isSafeInteger(v.bytes) || v.bytes < 1 || typeof v.mediaType !== 'string' || !/^[0-9a-f]{64}$/.test(v.sha256)) fail('INVALID_VERSION');
      sequences.add(v.sequence); map.set(v.id, v);
    }
    const original = map.get(asset.originalVersionId);
    if (!original || original.parentVersionId !== null || original.operation !== 'original') fail('INVALID_LINEAGE');
    for (const version of versions) {
      const seen = new Set(); let v = version;
      while (v.id !== original.id) {
        if (seen.has(v.id) || !v.parentVersionId || v.operation === 'original') fail('INVALID_LINEAGE');
        seen.add(v.id); const parent = map.get(v.parentVersionId);
        if (!parent || parent.sequence >= v.sequence) fail('INVALID_LINEAGE');
        v = parent;
      }
    }
    if (!map.has(asset.preferredVersionId)) fail('INVALID_LINEAGE');
    return clone(asset);
  }
  function suggestName(filename) {
    const base = safeName(filename).replace(/\.[^.]+$/, '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return base.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'untitled-asset';
  }
  function assertContinuation(prior, asset) {
    if (!prior) return asset;
    if (prior.id !== asset.id || prior.projectId !== asset.projectId) fail('PROJECT_DENIED');
    if (asset.revision < prior.revision) return asset;
    if (asset.originalVersionId !== prior.originalVersionId || asset.originalFilename !== prior.originalFilename) fail('IMMUTABLE_VERSION_CHANGED');
    const versions = new Map(asset.versions.map(v => [v.id,v]));
    for (const original of prior.versions) {
      const incoming = versions.get(original.id);
      if (!incoming || ['assetId','projectId','originalVersionId','parentVersionId','sequence','operation','bytes','sha256','mediaType','originalFilename'].some(key => incoming[key] !== original[key])) fail('IMMUTABLE_VERSION_CHANGED');
    }
    return asset;
  }
  function exportName(asset, version) {
    const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'text/plain': 'txt' }[version.mediaType];
    if (!ext) fail('UNSUPPORTED_MEDIA');
    return `${safeName(asset.name)}__v${version.sequence}.${ext}`;
  }
  return { validate, assertContinuation, safeName, suggestName, exportName, text, clone, fail };
});
