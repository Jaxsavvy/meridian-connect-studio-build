'use strict';
// Disposable CI snapshot only. Never push this local composition commit.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ASSET_HEAD = '69dbc7b688ed94823d082ee400833db1feb3f28c';
function validSha(value) { return typeof value === 'string' && /^[a-f0-9]{40}$/.test(value); }
function allowedAssetPath(value) {
  return value.startsWith('src/renderer/studio-assets/') || value.startsWith('docs/studio/assets/8/') || value === 'docs/development/handoffs/ISSUE-8-chair-3.md';
}
function compose() {
  if (process.env.GITHUB_ACTIONS !== 'true') throw Error('Composition is restricted to a disposable GitHub Actions checkout.');
  const expected = process.env.MERIDIAN_EXPECTED_UI_HEAD;
  if (!validSha(expected)) throw Error('Exact UI input SHA is required.');
  const git = args => execFileSync('git', ['-c', 'user.name=Meridian Synthetic Verification', '-c', 'user.email=verification@example.invalid', ...args], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  const assetInput = path.resolve('..', 'asset-input');
  if (git(['rev-parse', 'HEAD']) !== expected || git(['status', '--porcelain'])) throw Error('UI checkout is not the clean exact input.');
  if (git(['-C', assetInput, 'rev-parse', 'HEAD']) !== ASSET_HEAD || git(['-C', assetInput, 'status', '--porcelain'])) throw Error('Asset checkout is not the clean pinned input.');
  const uiTree = git(['rev-parse', `${expected}^{tree}`]);
  git(['fetch', '--no-tags', assetInput, ASSET_HEAD]); // Local checkout; no new credentials or external service.
  const assetTree = git(['rev-parse', `${ASSET_HEAD}^{tree}`]);
  let merging = false;
  let commit;
  let tree;
  try {
    merging = true;
    git(['merge', '--no-commit', '--no-ff', '--no-edit', ASSET_HEAD]);
    const changed = git(['diff', '--cached', '--name-only', expected]).split('\n').filter(Boolean);
    if (!changed.length || changed.some(file => !allowedAssetPath(file)) || git(['diff', '--cached', '--diff-filter=D', '--name-only'])) throw Error('Unexpected composition path or removal.');
    git(['diff', '--cached', '--check']);
    tree = git(['write-tree']);
    commit = git(['-c', 'user.name=Meridian Synthetic Verification', '-c', 'user.email=verification@example.invalid', 'commit-tree', tree, '-p', expected, '-p', ASSET_HEAD, '-m', 'Disposable synthetic cross-chair runtime snapshot; not a PR merge']);
  } finally {
    if (merging) git(['merge', '--abort']); // Only this script's own disposable merge.
  }
  git(['switch', '--detach', commit]);
  if (git(['status', '--porcelain']) || git(['rev-parse', 'HEAD^{tree}']) !== tree) throw Error('Composed checkout is not clean.');
  const sourceHashes = {};
  for (const file of git(['ls-files', 'src', 'config/settings.json']).split('\n').filter(Boolean)) {
    sourceHashes[file] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  }
  const evidence = 'test-output/composition';
  fs.mkdirSync(evidence, { recursive: true });
  fs.writeFileSync(path.join(evidence, 'inputs.json'), JSON.stringify({ uiHead: expected, uiTree, assetHead: ASSET_HEAD, assetTree, composedCommit: commit, composedTree: tree, cleanBeforeRuntime: true, platform: process.platform, sourceHashes, limits: ['Local disposable composition, never pushed or merged through GitHub.', 'Synthetic runtime does not authorize service access or release.'] }, null, 2));
  console.log(JSON.stringify({ uiHead: expected, assetHead: ASSET_HEAD, composedCommit: commit, composedTree: tree, sourceFileCount: Object.keys(sourceHashes).length }));
}
if (require.main === module) compose();
module.exports = { ASSET_HEAD, validSha, allowedAssetPath };
