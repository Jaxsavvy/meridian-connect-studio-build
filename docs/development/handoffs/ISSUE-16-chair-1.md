# DEV-008 — Chair 1 handoff

## Identity

- Issue: [DEV-008 #16](https://github.com/Jaxsavvy/meridian-connect-studio-build/issues/16); Project #1 item `PVTI_lAHODSEV684Bmo45zhAV-To`.
- Branch: `feature/studio-integration`; baseline `48dfa3846d3dd396aadc3d6d5db580f9d48ef2ba` (fast-forwarded from current main without rewriting local work).
- Chair: Chair 1 — Owner. Board readback: Building / P1 — High / Studio Foundation.
- Related work: [DEV-005 #8](https://github.com/Jaxsavvy/meridian-connect-studio-build/issues/8), [DEV-007 #11](https://github.com/Jaxsavvy/meridian-connect-studio-build/issues/11), Cassy's open draft [PR #15](https://github.com/Jaxsavvy/meridian-connect-studio-build/pull/15).

## Work this session

- Added an accepted-project list to the DEV-004 memory-only context snapshot and list-change notifications.
- Added a Connect-owned binding for Cassy's controller and named service adapter. It follows shared selection/revocation/sign-out, checks scope around transport calls, and fails with `SERVICE_UNAVAILABLE` without an approved service.
- Added synthetic integration tests and the [owner contract](../../studio/integration/16/ASSET_HOST_CONTRACT.md) covering restricted-service, unsaved-switch, Upscayl isolation and distribution gates.
- Inspected draft PR #15's controller/view diff for compatibility. Its internal unsaved-switch UI still has no external Connect scope-change hook; no merge or acceptance was inferred.
- Files: `src/renderer/studio-context.js`, `src/renderer/studio-asset-host.js`, `tools/studio-context/asset-host.test.cjs`, this handoff and the contract.
- No edits to Cassy's modules, Tyler's UI, main/preload/API, packaging, Core, Overseer or production Meridian. No executable, model, customer file or credential added.
- Implementation commit: `fedb06a` on `feature/studio-integration`; [draft PR #17](https://github.com/Jaxsavvy/meridian-connect-studio-build/pull/17) is open for owner review. No merge or release.

## Checks and review

| Check | Result | Limit |
| --- | --- | --- |
| `node --test --test-isolation=none tools/studio-context/studio-context.test.cjs tools/studio-context/renderer-integration.test.cjs tools/studio-context/asset-host.test.cjs` | 22 passed | Synthetic context and transport only. |
| `node --test --test-isolation=none docs/studio/assets/8/component.test.cjs docs/studio/assets/8/worker.test.cjs docs/studio/assets/8/native.test.cjs` | 23 passed on current main | Does not include Cassy's unmerged PR #15 tests or run the real CLI. |
| `git diff --cached --check` and exact staged file list before commit | Passed; five intended files only | Does not constitute owner acceptance. |

DEV-005 remains Blocked. Its already recorded real synthetic CLI test is evidence of local Upscayl execution only; it is not evidence of an authorized packaged integration. No owner acceptance for Complete.

## Board synchronization and next step

- New DEV-008 issue was added once to Project #1; Chair, Priority, Module and Building were set and read back. DEV-005's item/status was not changed.
- Staged diff reviewed for scope and obvious secrets; only synthetic IDs/content and public-safe contract text are present.
- Review draft PR #17's exact diff and tests before any merge; no Complete transition is authorized.
- Review PR #15 and settle external unsaved project-switch behavior with Cassy and Tyler. Define restricted service schema/permission matrix and OS isolation/distribution policy before any live transport or visible Asset Library mount.
