# Ordered Studio review — issue #9

October 18,2026. Chair2 task branch `codex/studio-thirty-checks`, based on PR39
`c5a205cc8a56b2cb4bfc0b404907a6678a342775`. Live existing Project item:
Building / Chair2–Tyler / P1–High / Studio UI/UX. Original checkout unchanged.

Items1–22 were completed before the explicit pause; this continuation re-read the
prior chat, preserved its uncommitted changes and completed23–30 in order.
Completion refers to the scoped local checks/artifacts below, not full issue or
release acceptance. Prior runtime evidence is historical where marked.

| # | Review item | Evidence / limit |
| --- | --- | --- |
| 1 | Launch isolated runtime | Prior baseline results.json; actual Electron using synthetic preload |
| 2 | Create/edit/save/reopen/export | Prior item-02.json and baseline real exports; final guided rerun recorded below |
| 3 | Nine tool entries | Prior item-03.json; eight requirements dialogs and local Website entry |
| 4 | Ordinary Connect navigation | Prior item-04.json; synthetic navigation only |
| 5 | Unsaved changes | Prior item-05.json plus unload model/UI tests; close prevented until explicit save/discard |
| 6 | Storage/recovery | Prior item-06.json; write-blocked storage preserves readable records |
| 7 | Window conflicts/separate copy | Baseline separate-copy/copy-retry records and model fault matrix |
| 8 | Checkpoint operations | Prior item-08-retained-id.json; accepted section IDs remain reopenable |
| 9 | Undo/Redo | Model transition audit and targeted history tests |
| 10 | Nested navigation/reorder | Baseline nested-navigation and drag-reorder runtime records |
| 11 | Shared sections | Baseline shared-sections runtime and model tests |
| 12 | Formatting/content limits | Baseline formatted-text/presentation records and model tests |
| 13 | Exports | Baseline real ZIP and responsive export records; final guided rerun recorded below |
| 14 | Context isolation/stale responses | Context/renderer integration tests and baseline context transitions |
| 15 | Keyboard/focus/accessibility markup | Prior item-15.json and AX tree; no human Narrator claim |
| 16 | Viewport/zoom/media preferences | Final item-16.json: five window/zoom configurations, four steps each; emulation separately labeled |
| 17 | Unavailable/error/retry states | Baseline catalogue/job/recovery records and related tests |
| 18 | Windows/cross-chair evidence | Prior item-18-installed-verification.json; published exact-source evidence only |
| 19 | Evidence freshness | Prior item-19-capture-hashes.json; local23/24 image inspection; final manifest hashes |
| 20 | Reproduced fixes | Window unload, readable full-storage startup, checkpoint ID acceptance retained from paused work |
| 21 | Regression tests | 196/196 relevant final local tests, no skipped/failed tests |
| 22 | Wording and guidance | Retained paused tool descriptions and clearer user-facing guidance |
| 23 | Visible context/Save/steps | Final item-23.json plus visually inspected sticky bar image; save/step focus pass |
| 24 | Organization/discoverability | Final item-24.json: shared/checkpoint/section shortcuts focus correctly; checkpoint created |
| 25 | Documentation corrections | Current-local-review banners in four root documents distinguish historical and local claims |
| 26 | Acceptance mapping | ORDERED_ACCEPTANCE.md: all six criteria, evidence and remaining gaps |
| 27 | PR review/integration proposal | ORDERED_INTEGRATION.md: all eight live PR heads and computed changed-path overlaps |
| 28 | URL/installer/normalization investigation | ORDERED_BOUNDARY_FINDINGS.md: static URL finding, live draft normalization reproduction, installer failure history |
| 29 | Human walkthrough preparation | ORDERED_HUMAN_WALKTHROUGH.md; actual human observations remain unperformed |
| 30 | Handoff/readiness preparation | ORDERED_READINESS.md and Chair2 handoff; release acceptance remains open |

Current final Node suite: `node --test --test-isolation=none tools/website-builder/*.test.cjs tools/studio-context/*.test.cjs tools/board-sync/board-sync.test.mjs docs/studio/design/9/studio-workspace.test.cjs docs/studio/integration/32/capture-guard.test.cjs docs/studio/assets/8/*.test.cjs`. 196 pass.

Runtime: set MERIDIAN_ORDERED_EVIDENCE to an external output folder and
MERIDIAN_ORDERED_ITEM to23,24 or16; run Electron with ordered-review.cjs.
Use tools/website-builder/ui-flow-smoke.cjs with MERIDIAN_UI_FLOW_EVIDENCE for
the full guided flow. Each run uses synthetic data and isolated temporary app
storage, blocks external network and preserves errors. No paid/live services.
Unsupported ordered runtime item numbers now fail instead of silently reporting
success; an initial construction error produced an empty item24 record, which
was discarded as evidence and replaced by the explicit successful check.

Final guided runtime and exact dirty-source hashes: see ORDERED_READINESS.md.
No source commit/push, PR creation, merge, release or board transition in this
continuation. Human Narrator/native-pointer, service and new installed build
acceptance remain separate.
