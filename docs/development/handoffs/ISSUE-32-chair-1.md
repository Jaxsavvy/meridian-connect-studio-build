# DEV-020 — Chair 1 final implementation handoff

## 2026-10-15 corrected capture verified via CI

- Capture guard introduced in `761d91f`, then executable-input provenance refined in `e72bacee7bf23c350e3502862b60357311788a9b`. Actions run `38843707878` passed source checks (85 tests) and real Electron smoke, producing artifact `12021823931`.
- Downloaded the artifact, verified its archive SHA-256 and each of the three image hashes, and visually inspected the actual ordinary/selected/warning PNGs. Warning image visibly contains the actual unsaved sentence, both choices and the edited Display name. It differs from both baselines. Raw metrics and runtime outcomes pass.
- Actions used synthetic merge commit `23543a9`; GitHub confirms its tree is identical to source correction `e72bace` (`40d1a93b2791bfc7b226a7033461628c92938b65`). Raw provenance is retained intact. Evidence publication copies the three PNGs and raw metrics byte-for-byte, with subsequent manual findings in `docs/studio/integration/32/VISUAL_REVIEW.md`.
- This completes the actual capture and implementation-agent pixel inspection using CI's running app, despite no local Electron/display. Independent Tyler re-review remains open; no self-approval/dismissal or merge. PR #34 still preserves `8115f7d` and `38c093f` and needs Jaxsavvy/Theecassycat reviews.

## 2026-10-15 PR #35 evidence correction follow-up

- User explicitly authorized scoped correction on `feature/dev-020-asset-mount`, starting from verified head `8ed3f367a965a8f3789ee3cb1f7d288d46bc549d`. Read Tyler's reviews and reproduction comment before editing. No app, Builder, shared shell, Asset component, backend or packaging changes.
- Added testable capture guard and integrated it in the real synthetic Electron harness: actual dirty metadata and project check, connected/visible/in-viewport warning text and choices before/after capture, shown-window frame flushing, two baseline SHA-256 comparisons, clean-source HEAD/tree/run provenance, and removal of stale warning output. Existing Keep editing/Discard checks now explicitly cover retained project and cleared draft. Metrics require manual pixel review; distinct hashes do not establish it.
- Five guard tests plus existing source/contract suite pass 85/85; harness/helper/test syntax and whitespace checked. Workflow source suite includes the new tests; the existing Electron job will exercise the guarded capture on push.
- Local runtime/capture unavailable: Electron, Xvfb and display server absent. No replacement PNG or visual verification claimed locally. Exact display-supported command, output files and manual acceptance steps are in `docs/studio/integration/32/CAPTURE_VERIFICATION.md`.
- Preserve PR #34 Builder fix `8115f7d` and handoff `38c093f` on their existing branch; neither was reset, replaced or merged here. Both PRs remain unmerged. Tyler's requested-changes review remains pending successful capture and actual visual re-review; #34 still needs Jaxsavvy and Theecassycat reviews. Board synchronization remains pending.

- **Issue:** [DEV-020 #32](https://github.com/Jaxsavvy/meridian-connect-studio-build/issues/32)
- **PR:** [#35](https://github.com/Jaxsavvy/meridian-connect-studio-build/pull/35), branch `feature/dev-020-asset-mount`, base `main` at `29a0df69c1b1497c85f671daddc3b8aaa979cc8a`.
- **Current status:** Scoped development integration implemented and verified; ready for code review / shared-file merge coordination. **Not production-ready, not merged, not released.**

## Implemented
1. A dev-gated, synthetic-only named transport uses Cassy's existing `SyntheticService` with the accepted Connect project context and scoped `createAssetHost`; no live IPC/HTTP asset routes.
2. Cassy's existing writable `StudioAssetView.mount(...,{hostOwned:true})` is now mounted in Tyler's Studio Assets surface. The local project selector and local sign-out are suppressed. Upscayl is explicitly disabled.
3. The Studio renderer loads the synthetic asset modules and view CSS only when the established development gate is enabled; ordinary employee Studio remains unavailable.
4. Voluntary Studio leave, switching away from Assets, Connect project change, and voluntary sign-out respect unsaved metadata drafts through the existing Keep editing / Discard decision. A narrowly scoped callback approval avoids guard recursion. Session reset and project revocation clear assets immediately without a prompt.
5. The Studio project selector reads only `context.snapshot().projects`, not an older panel-level cached list; revoked projects disappear from the picker.
6. Corrected a pre-existing global symbol collision: `project-workspace.js` reassigns `selectProject = open`. Studio now retains `selectStudioConnectProject`, a stable reference to the original guarded Connect handler, for the selector and its deferred approval callback. Existing Project Workspace routing remains unchanged.
7. Added source tests and a branch-scoped isolated Electron smoke suite with bounded timeouts and screenshot artifacts.

## Verification — complete
**Latest fully green run:** [38683358554](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/38683358554).
- GitHub Actions `source-checks`: **80 tests passed / 0 failed** (includes context, asset host, development transport/mount, Cassy's component, view, native and worker tests, and Studio workspace). Source syntax, packaging input and tracked-file checks passed.
- GitHub Actions `dev020-electron-smoke`: **PASS** with development-only synthetic preload. Verified Studio boot/mount, synthetic text file import, draft Keep editing, draft Discard and leave, accepted project switch and project asset isolation, 200% zoom with no horizontal overflow, immediate revocation clearing a dirty draft/removing revoked option, and voluntary sign-out Keep editing vs Discard clearing session/projects.
- Screenshot/evidence artifact: `dev020-synthetic-electron-evidence`, GitHub Actions artifact ID `11949565478`. The runtime generates 1440px asset view, unsaved leave, project switch and 200% zoom screenshots plus JSON metrics. **Manual visual signoff of the screenshots was not performed here.**
- Root-cause regression asserts that the Studio picker event is attached, the stable Connect handler is used for the initial and deferred selection, and the visible projects come from accepted context.

## Compatibility and review
Tyler's open [Website Builder PR #34](https://github.com/Jaxsavvy/meridian-connect-studio-build/pull/34) also changes `src/renderer/app.js` and `src/renderer/studio-ui/studio-shell.js`. A specific coordination comment was posted on that PR: merge both dev-gated loader paths, the Website Builder render/controller/events, and the dev asset mount/leave lifecycle. Keep the Connect selection alias. The two PRs were tested individually; **their combined branch has not yet been tested**. Recommended order: merge scoped DEV-020 after code review, then Tyler integrate/rebase and rerun Website Builder + DEV-020 Electron checks.

## Remaining release boundaries
- DEV-020 is **development-only**. The asset service is in-memory synthetic and not authoritative; it has no durable storage, verified production membership/permission enforcement, or client data.
- Upscayl remains disabled; no OS isolation/distribution authorization, paid API calls, customer data, model/executable packaging, or backend changes.
- DEV-005 #8 remains blocked on restricted service/permissions, transport and distribution work; do not infer production Studio availability from green synthetic tests.
- The synthetic Electron runtime emits a Content Security Policy warning. This is not permission to weaken production security; review separately before employee release.
- Merge only after reviewer checks PR #35's exact changed files, confirms Tyler conflict coordination, and accepts evidence. Issue #32 should not be marked Complete before that merge / required board readback.

## Rollback
Revert the DEV-020 source and development-loader wiring to restore the read-only Studio Assets preview. No persistent asset data or schema migration exists. No production rollout occurred.
