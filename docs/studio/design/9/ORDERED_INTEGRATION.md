# Proposed integration order — refreshed October 18

Read-only review of all eight open PRs before this continuation publication.
PR39 input was 89f6b6a; this continuation advances that same review lane.
Proposal only; all PRs stay unmerged. Changed-file overlap is not proof of conflict.

| PR | Exact reviewed head | Scope |
| --- | --- | --- |
| #39 | `89f6b6a76c321487741232fdd4fabae05d88c94c` | DEV-006: integrate guided Website, Assets and local review workspace |
| #38 | `ec1c1dcfb63acd51cc8d5d992a7a03ea9aab66a9` | DEV-011: draft Studio asset permission policy |
| #37 | `d0d7c99372e889798c142df7c3f94c4e07127d90` | DEV-006: guide Website Builder through Brief, Pages, Edit and Preview |
| #36 | `d2fffe0beb7501eb45f667a99693e140ec246685` | DEV-010: draft Studio asset service v1 contract |
| #35 | `647bb9e0391f9188fdf1022b5cea30c258011350` | DEV-020: mount writable development Assets in Studio with guarded project context |
| #34 | `7f8a2b03861d821508f839d7771d1618736cf380` | DEV-006: add persistent Website Builder foundation |
| #33 | `69dbc7b688ed94823d082ee400833db1feb3f28c` | DEV-005: asset feedback, version preservation and exact-read preparation |
| #10 | `4e4373130b3cd2a239aad9b71f326a8d4d3889cf` | Map Meridian Studio build across owner, Tyler and Cassy |

1. Reconcile documentation #10 with current collaboration/build state.
2. Review #36 normalized text and explicit exact-history mapping, then #38 policy. The previous U+0344 overlength reproduction is now rejected by the published test reference; accepted service/conformance evidence remains separate. Proposed bounded history paging is not a mounted accepted service.
3. Independently review #33 at69dbc7b, including the matching normalized Unicode limit. Disposable runtime pins now exercise that exact public source; no Cassy implementation is copied into PR39.
4. Review the composed #39 lane, including #34/#35/#37 ancestry and this follow-up. Choose one integration strategy; avoid replaying the same shared-source changes twice. No source PR is silently closed, rebased or merged here.
5. Re-run exact source, Linux, composed Linux/Windows and installed/Contrast checks after any accepted source composition or ref change.
6. Supply accepted service/host inputs, independent/human observations and separate owner release acceptance. No green synthetic test grants service or release authority.

Exact overlaps:

- #39/#37: `.github/workflows/website-guided-ui.yml`, `docs/studio/design/9/WEBSITE_GUIDED_FLOW.md`, `src/renderer/studio-ui/studio-shell.js`, `src/renderer/studio-ui/studio-ui.css`, `tools/website-builder/ui-flow-smoke.cjs`, `tools/website-builder/ui-flow.test.cjs`
- #39/#36: `.github/workflows/connect-source-checks.yml`
- #39/#35: `.github/workflows/connect-source-checks.yml`, `docs/development/handoffs/ISSUE-32-chair-1.md`, `docs/studio/integration/32/CAPTURE_VERIFICATION.md`, `docs/studio/integration/32/VISUAL_REVIEW.md`, `docs/studio/integration/32/capture-guard.cjs`, `docs/studio/integration/32/capture-guard.test.cjs`, `docs/studio/integration/32/renders/asset-selected-clean-1440.png`, `docs/studio/integration/32/renders/asset-view-1440.png`, `docs/studio/integration/32/renders/runtime-results.json`, `docs/studio/integration/32/renders/unsaved-asset-leave.png`, `docs/studio/integration/32/renders/warning-capture.json`, `docs/studio/integration/32/runtime-check.cjs`, `src/renderer/app.js`, `src/renderer/studio-asset-host.js`, `src/renderer/studio-dev-asset-mount.js`, `src/renderer/studio-dev-asset-transport.js`, `src/renderer/studio-ui/studio-shell.js`, `tools/studio-context/dev-asset-mount.test.cjs`, `tools/studio-context/dev-asset-transport.test.cjs`
- #39/#34: `WEBSITE_STUDIO_AUDIT.md`, `WEBSITE_STUDIO_DELIVERY.md`, `WEBSITE_STUDIO_IMPLEMENTATION.md`, `WEBSITE_STUDIO_INTEGRATION_CONTRACTS.md`, `WEBSITE_STUDIO_TEST_REPORT.md`, `docs/development/handoffs/ISSUE-9-chair-2.md`, `docs/studio/design/9/renders/runtime-results.json`, `docs/studio/design/9/renders/website-builder-1280x900-200pct.png`, `docs/studio/design/9/renders/website-builder-editor-1440x1000.png`, `docs/studio/design/9/renders/website-builder-preview-1440x1000.png`, `docs/studio/design/9/renders/website-builder-reopened-1440x1000.png`, `docs/studio/design/9/runtime-capture.cjs`, `src/renderer/app.js`, `src/renderer/studio-ui/studio-shell.js`, `src/renderer/studio-ui/studio-ui.css`, `src/renderer/studio-ui/studio-workspace.js`, `src/renderer/studio-ui/website-builder.js`, `tools/website-builder/website-builder.test.cjs`
- #37/#35: `src/renderer/studio-ui/studio-shell.js`
- #37/#34: `src/renderer/studio-ui/studio-shell.js`, `src/renderer/studio-ui/studio-ui.css`
- #36/#35: `.github/workflows/connect-source-checks.yml`
- #35/#34: `src/renderer/app.js`, `src/renderer/studio-ui/studio-shell.js`
