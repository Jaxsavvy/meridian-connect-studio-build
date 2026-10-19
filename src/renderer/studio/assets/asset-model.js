/* Asset naming and version rules. Persistence and authorization belong to the service. */
'use strict';

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianAssetModel = api;
})(typeof window === 'undefined' ? null : window, function () {
  const fail = code => { const error = new Error(code); error.code = code; throw error; };
  const clone = value => structuredClone(value);
  const ID = /^[A-Za-z0-9_-]{1,128}$/;

  // Reused from the archived model: check submitted AND NFC-normalized UTF-16 length.
  function text(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 160 || /[\u0000-\u001f\u007f]/.test(value)) fail('INVALID_TEXT');
    const normalized = value.normalize('NFC').trim();
    if (!normalized || normalized.length > 160) fail('INVALID_TEXT');
    return normalized;
  }

  function safeName(value) {
    let name = text(value).replace(/[<>:"/\\|?*]/g, '-').replace(/[. ]+$/g, '');
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = '_' + name;
    if (!name || name === '.' || name === '..') fail('UNSAFE_NAME');
    return text(name); // A reserved-name prefix must also fit; never truncate.
  }

  function checkVersion(version) {
    if (!Number.isSafeInteger(version) || version < 1) fail('INVALID_VERSION');
  }

  function suggestName({ subject, purpose, variant, version = 1 } = {}) {
    checkVersion(version);
    const parts = [subject, purpose, variant].map(value => {
      const part = safeName(value).toLowerCase().replace(/[\s_.]+/gu, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      if (!part) fail('UNSAFE_NAME');
      return part;
    });
    return safeName(`${parts.join('-')}__v${version}`);
  }

  function validateAsset(asset) {
    if (!asset || typeof asset !== 'object' || Array.isArray(asset)) fail('INVALID_ASSET');
    for (const key of ['id', 'spaceId']) {
      if (typeof asset[key] !== 'string' || !ID.test(asset[key])) fail('INVALID_ID');
    }
    const name = safeName(asset.name);
    if (name !== text(asset.name)) fail('UNSAFE_NAME');
    if (!['image', 'video', 'file'].includes(asset.kind)) fail('INVALID_KIND');
    checkVersion(asset.version);
    if (asset.version === 1) {
      if (asset.parentId !== null) fail('INVALID_LINEAGE');
    } else if (typeof asset.parentId !== 'string' || !ID.test(asset.parentId) || asset.parentId === asset.id) {
      fail('INVALID_LINEAGE');
    }
    return { ...clone(asset), name };
  }

  function nextVersion(parentAsset, changes) {
    const parent = validateAsset(parentAsset);
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) fail('INVALID_ASSET');
    if (!changes.id || changes.id === parent.id) fail('NEW_ID_REQUIRED');
    if (changes.spaceId !== undefined && changes.spaceId !== parent.spaceId) fail('SPACE_DENIED');
    const version = parent.version + 1;
    checkVersion(version);
    const stem = safeName(changes.name === undefined ? parent.name : changes.name).replace(/__v[1-9][0-9]*$/u, '');
    return validateAsset({
      ...parent, ...clone(changes), name: `${stem}__v${version}`,
      spaceId: parent.spaceId, version, parentId: parent.id,
      approved: false, kept: false, trashed: false,
    });
  }

  return { safeName, suggestName, validateAsset, nextVersion };
});
