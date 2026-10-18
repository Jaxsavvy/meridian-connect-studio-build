# Website Studio verification report

## Full 22-item continuation

The user-requested continuation adds recovery-key collision safeguards and
read-only checkpoint-history retry.210 relevant local tests pass.
`docs/studio/design/9/CONTINUATION_22.md` records every item, current
availability, fresh input review and limitations. Final hosted verification
is recorded at the exact source in PR39 after publication. Earlier run/source
records below remain historical and do not establish this new delta.

## Current ordered-review delivery — October 18, 2026

The ordered review is published on existing PR #39. Source008c9ee passed
source/Linux/cross-chair/Windows-installed verification. This branch also
contains the final long-name step/save-status refinement; current PR checks
track that revision. See `docs/studio/design/9/ORDERED_DELIVERY.md` for exact
source trees, artifact hashes, screenshots, board state and remaining gates.
Earlier source IDs/test totals/package results below retain their historical
scope. Local Website data is not authoritative team storage or release acceptance.

## Current implementation record — 2026-10-17

PR #39 remains the combined, unmerged review lane. Current executable source
`e665915dff8312aa59088b96083e1b37eaf1c3d4` has 174 passing local tests.
Current features, exact-source runtime evidence and limits are recorded in
`docs/studio/design/9/RECOVERY_CATALOGUE.md`, `LOCAL_DRAFT_INTEGRITY.md`
and `CONTINUATION_ACCEPTANCE.md`.
`REPOSITORY_TASK_AUDIT.md` records the fresh build-wide audit and concrete
cross-chair findings. The milestone records below retain their original scope;
their older source IDs/test counts are not current-head claims.

## Earlier local completion

Source `837559b`: 127 relevant local/Linux tests, 78 Windows tests, both actual
Electron flows, real ZIP download, actual OS Contrast/readback/restoration,
existing NSIS installation and installed source/AX/Tab/employee gate checks pass.
Downloaded final artifacts, verified source-tree/image/archive hashes and
independently decoded every actual downloaded ZIP. Exact runs, inspected-image
list, limits and human/reviewer actions: `docs/studio/design/9/LOCAL_WEBSITE_COMPLETION.md`.
The older verification records below are retained as history.

## 2026-10-16 earlier combined Windows delivery

Source `c1f5f50` on PR #39 passes 121 relevant local/Linux CI tests and 72
Windows renderer/context tests, both platform Electron flows, actual OS High
Contrast/restoration, NSIS build/silent installation, exact 47-file installed
source comparison and ordinary employee login/accessibility/keyboard/Studio
gate checks. Artifact `12072732936` was downloaded and inspected. Exact source,
run URLs, hashes, failures/corrections and remaining human/service limits are
in `docs/studio/design/9/DEV006_VERIFICATION.md`. Narrator speech, independent
reviews and authenticated installed Studio remain unverified. All original PRs
remain unmerged. The records below are earlier milestones, not current blockers.

## 2026-10-15 final corrected-evidence inputs

Combined current inputs #34 `38c093f` + #35 `647bb9e` passed **108/108 relevant Node tests** using the prior full command plus `docs/studio/integration/32/capture-guard.test.cjs`. Includes 14 Builder and five capture-guard tests. Neither input changed `src` since the agreed prior shared-file resolution; reused that resolution in a separate disposable checkout. Source syntax and staged whitespace passed. Local combined tree: `70079433cd43f8ebd775fcf670de0526581a7526`. No combined source pushed or combined Electron runtime rerun claimed.

#35 now contains verified actual warning pixels and source-provenance evidence; its final-head standalone source/Electron checks passed (Actions run `38844034523`). This supersedes the earlier screenshot-correction blocker below. Independent correction review remains required because this assistant authored the fix; #34's Jaxsavvy and Theecassycat reviews remain absent. Both PRs stay unmerged.

## 2026-10-15 evening current-head integration check

Exact input heads: PR #34 `8115f7de1f97876a291ef6deb38c23ba0421501d` plus PR #35 `8ed3f367a965a8f3789ee3cb1f7d288d46bc549d`. Disposable local resolution of the two shared-file conflicts produced tree `89ef6fde5f71ebc422666041e63a9b1bdd49d4c4`; no combined code was pushed. Both development loaders, accepted-project selection, writable Asset lifecycle and Website controller were retained, sequencing Website save/discard before the Asset guard.

`node --test tools/website-builder/website-builder.test.cjs tools/studio-context/*.test.cjs tools/board-sync/board-sync.test.mjs docs/studio/design/9/studio-workspace.test.cjs docs/studio/assets/8/*.test.cjs` passed **103/103**, including **14/14** Builder tests. All `src/**/*.js` syntax, workflow source/packaging-input assertions, prohibited tracked paths and whitespace checks passed. The count differs from the previous source run because DEV-020 contributes its transport/mount cases. Later PR #33/#36 work and the owner's separate UI-flow branch are excluded.

Combined Electron/capture verification was not possible: Electron, Xvfb and a display server are absent. No fresh screenshots, dependency installation, packaging build or visual signoff claimed. #35 head remains unchanged with no corrected warning capture; Tyler's requested-changes review remains unresolved. Jaxsavvy owns that evidence correction; Jaxsavvy and Theecassycat still owe #34 reviews. Both PRs remain unmerged.

## 2026-10-15 model correction

Three new regression cases reproduced failures in page-selection history, redo retention and export filename collisions before the fix. Undo/redo now retains the matching page selection; rejected edits retain redo; a new website cannot undo into a previous website; home and Index pages cannot overwrite the same exported file.

Verification: `node --test tools/website-builder/website-builder.test.cjs tools/studio-context/*.test.cjs tools/board-sync/board-sync.test.mjs docs/studio/design/9/studio-workspace.test.cjs docs/studio/assets/8/*.test.cjs` passed **95/95**, including **14/14** Builder tests. Changed JavaScript syntax and `git diff --check` passed. No screenshot or packaging rerun for this model-only patch; historical evidence below is not a runtime verification of this patch. Shared integration remains pending review.

Updated: 2026-10-14 PDT.

## Automated coverage

The Website Builder suite covers restart persistence, project isolation, backup recovery, failed-save retention, undo/redo, unique sitemap slugs, safe rendering, multi-page static export, and development-gated loading. Existing Studio/context/Asset suites remain part of the relevant regression run.

Final milestone result: **92/92 relevant Node tests passed**. The focused Website Builder subset passed **11/11**. JavaScript syntax checks and `git diff --check` passed.

## Manual and build verification

- Source syntax: passed for the changed JavaScript and Electron evidence harness.
- Focused Website Builder tests: passed, 11/11.
- Full relevant Node tests: passed, 92/92. The first sandboxed run produced 10 environment-permission failures in existing temp-directory suites; the required unrestricted rerun passed the full suite.
- Electron development runtime: passed in the repository's isolated, hidden BrowserWindow harness. This is the real renderer with synthetic Connect fixtures, not a distributed employee installation.
- Create/edit/save/reload/reopen: passed. One saved project reopened with its audience and two-page sitemap intact after a renderer reload.
- Unsaved navigation protection: passed. Leaving Studio with a dirty website project opens a website-specific dialog with keep, discard, and save choices.
- Preview: passed. It used the edited project content, carried an empty sandbox attribute, and shared the export renderer.
- Accessibility source/runtime metrics: zero unlabeled Website Builder form controls; preview has a title; focus styling and semantic labels reuse the Studio system.
- Visual inspection: passed for editor, lower generated-page preview, reopened project, and 200% zoom captures. At 200% the local navigation wraps and the document, workspace, and main builder fit horizontally.
- Windows packaging: unsigned NSIS build succeeded and produced `Meridian-Connect-Setup-0.2.12.exe`; generated distribution files remain ignored and are not committed.
- Installer execution: not performed. A built installer is not treated as an installed-app verification.
- Screen reader and Windows High Contrast: unverified.
- Backend, AI provider, permissions, and deployment: not available in this repository.

## Runtime evidence

`docs/studio/design/9/renders/runtime-results.json` records the metrics. Website Builder captures are `website-builder-editor-1440x1000.png`, `website-builder-preview-1440x1000.png`, `website-builder-reopened-1440x1000.png`, and `website-builder-1280x900-200pct.png`.

## Cross-PR integration evidence — 2026-10-15 PDT

A disposable checkout combined this PR's head `df6b85e` with DEV-020 PR #35 head `8ed3f367`; no combined code was committed or pushed. The two expected conflicts were limited to `src/renderer/app.js` and `src/renderer/studio-ui/studio-shell.js` and were resolved by preserving both development loader paths and composing the Website and Asset leave guards.

- Combined changed-file syntax: passed.
- Combined relevant Node suite: 91/91 passed outside the filesystem sandbox. Five existing OS-worker cases received `EPERM` in the sandbox and passed unchanged in the authorized rerun.
- Combined DEV-020 Electron flow: passed mount/import, Keep editing/Discard, accepted-project isolation, revocation, voluntary sign-out, and 200% zoom.
- Combined Website Builder Electron flow: completed after the evidence probe recognized the mounted Asset client's polite status element.
- Manual visual review: mounted Asset view, project switch, and 200% zoom passed. PR #35's claimed unsaved-warning screenshot was identical to its ordinary Asset view and did not visually evidence the warning; Tyler requested corrected evidence on PR #35. This is an evidence gate, not a claim that the product warning failed—the same run found a connected visible warning in the DOM.
