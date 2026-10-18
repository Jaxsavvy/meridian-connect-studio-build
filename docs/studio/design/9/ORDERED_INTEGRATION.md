# Proposed integration order — read-only review

Eight open PRs read from GitHub October 18. Proposal only; keep all unmerged.

| PR | Exact head | Scope |
| --- | --- | --- |
| #39 | `c5a205cc8a56b2cb4bfc0b404907a6678a342775` | DEV-006: integrate guided Website, Assets and local review workspace |
| #38 | `ec1c1dcfb63acd51cc8d5d992a7a03ea9aab66a9` | DEV-011: draft Studio asset permission policy |
| #37 | `d0d7c99372e889798c142df7c3f94c4e07127d90` | DEV-006: guide Website Builder through Brief, Pages, Edit and Preview |
| #36 | `ed17ef68c0b9be4a21565dce1af9cfa6cf99ac3a` | DEV-010: draft Studio asset service v1 contract |
| #35 | `647bb9e0391f9188fdf1022b5cea30c258011350` | DEV-020: mount writable development Assets in Studio with guarded project context |
| #34 | `7f8a2b03861d821508f839d7771d1618736cf380` | DEV-006: add persistent Website Builder foundation |
| #33 | `075ec2adcca99b60d28eaa4efeff52f24fefb9b4` | DEV-005: asset feedback, version preservation and exact-read preparation |
| #10 | `4e4373130b3cd2a239aad9b71f326a8d4d3889cf` | Map Meridian Studio build across owner, Tyler and Cassy |

1. Review documentation #10 against current collaboration policy; resolve stale build-map descriptions independently.
2. Resolve canonicalization in #36 and policy decisions in #38 with owner/Cassy. These test-only drafts do not mount a service. Neither is authority to enable tools.
3. Accept Cassy #33 after its independent tests/review. Recompose and rerun the actual mounted experience using that exact head.
4. Select the composed #39 lane for Website/Assets/guided navigation, after independent review of #34/#35/#37 ancestry and corrections. Do not blindly apply the same source twice. The owner should explicitly designate #34/#35/#37 as superseded or choose a sequential strategy; no PR is closed here.
5. Apply this local review as a small follow-up onto the selected combined lane; rerun source, guided, cross-chair and Windows-installed/Contrast checks at the exact final tree.
6. Connect accepted service inputs and perform human checks before separate release acceptance.

Overlapping paths (computed from each PR changed-file list; overlap alone does not prove a conflict):

- #39/#37: `.github/workflows/website-guided-ui.yml`, `docs/studio/design/9/WEBSITE_GUIDED_FLOW.md`, `src/renderer/studio-ui/studio-shell.js`, `src/renderer/studio-ui/studio-ui.css`, `tools/website-builder/ui-flow-smoke.cjs`, `tools/website-builder/ui-flow.test.cjs`
- #39/#36: `.github/workflows/connect-source-checks.yml`
- #39/#35: `.github/workflows/connect-source-checks.yml`, `docs/development/handoffs/ISSUE-32-chair-1.md`, `docs/studio/integration/32/CAPTURE_VERIFICATION.md`, `docs/studio/integration/32/VISUAL_REVIEW.md`, `docs/studio/integration/32/capture-guard.cjs`, `docs/studio/integration/32/capture-guard.test.cjs`, `docs/studio/integration/32/renders/asset-selected-clean-1440.png`, `docs/studio/integration/32/renders/asset-view-1440.png`, `docs/studio/integration/32/renders/runtime-results.json`, `docs/studio/integration/32/renders/unsaved-asset-leave.png`, `docs/studio/integration/32/renders/warning-capture.json`, `docs/studio/integration/32/runtime-check.cjs`, `src/renderer/app.js`, `src/renderer/studio-asset-host.js`, `src/renderer/studio-dev-asset-mount.js`, `src/renderer/studio-dev-asset-transport.js`, `src/renderer/studio-ui/studio-shell.js`, `tools/studio-context/dev-asset-mount.test.cjs`, `tools/studio-context/dev-asset-transport.test.cjs`
- #39/#34: `WEBSITE_STUDIO_AUDIT.md`, `WEBSITE_STUDIO_DELIVERY.md`, `WEBSITE_STUDIO_IMPLEMENTATION.md`, `WEBSITE_STUDIO_INTEGRATION_CONTRACTS.md`, `WEBSITE_STUDIO_TEST_REPORT.md`, `docs/development/handoffs/ISSUE-9-chair-2.md`, `docs/studio/design/9/renders/runtime-results.json`, `docs/studio/design/9/renders/website-builder-1280x900-200pct.png`, `docs/studio/design/9/renders/website-builder-editor-1440x1000.png`, `docs/studio/design/9/renders/website-builder-preview-1440x1000.png`, `docs/studio/design/9/renders/website-builder-reopened-1440x1000.png`, `docs/studio/design/9/runtime-capture.cjs`, `src/renderer/app.js`, `src/renderer/studio-ui/studio-shell.js`, `src/renderer/studio-ui/studio-ui.css`, `src/renderer/studio-ui/studio-workspace.js`, `src/renderer/studio-ui/website-builder.js`, `tools/website-builder/website-builder.test.cjs`
- #37/#35: `src/renderer/studio-ui/studio-shell.js`
- #37/#34: `src/renderer/studio-ui/studio-shell.js`, `src/renderer/studio-ui/studio-ui.css`
- #36/#35: `.github/workflows/connect-source-checks.yml`
- #35/#34: `src/renderer/app.js`, `src/renderer/studio-ui/studio-shell.js`

No source merge, cherry-pick, shared-file replacement or review dismissal performed.
