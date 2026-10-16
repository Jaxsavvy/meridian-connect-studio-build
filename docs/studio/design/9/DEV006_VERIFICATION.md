# DEV-006 combined delivery verification

## 2026-10-16 final audit update

Latest executable source: `9928a7f9c9d363ac44943f1eb362916abe23ed5e`.
A fresh source/acceptance/review/log audit reproduced and fixed two remaining
Builder defects: recovery now rejects a different website ID in primary,
backup and pending records, and adding sections stops at 100 before an edit
could make the page unsaveable. Regression tests failed before the fixes and
pass afterward; rejected edits still preserve redo and the page remains saveable.

- Local relevant suite: **120/120 pass**, syntax and whitespace pass.
- [Fresh combined run 38848984940](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/38848984940): 120 tests and both actual Electron workflows pass.
- [Fresh source run 38848984965](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/38848984965): success; no failed steps.
- [Artifact 12023783785](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/38848984940/artifacts/12023783785): downloaded ZIP digest `bb4070e39663fc826e0cae36463ef92108864ed1ae968c27e14a49e65eee5798` verified.
- GitHub metadata confirms capture merge `ef1cca50f9ecebac19fe6027ecb447cb9e2aa94c` and source share tree `042ec6f13e26ea5fde6aef7cc3418db65ce0678f`.
- Fresh composed warning and DEV-020 warning were opened and visually inspected alongside both DEV-020 baselines: actual warning, both choices and dirty Display name are visible; baseline images omit the warning. Raw hashes match the images and differ. Raw results and all image hashes are preserved in `combined-evidence/final-audit.json`; earlier evidence below remains historical.

Live readback found no submitted #39 reviews or new requested work. Jaxsavvy
and Theecassycat must independently review the combined change; either must
independently review #35's correction (the correcting agent cannot self-approve).
Both #34 reviews remain required. Tyler should arrange the remaining Windows
screen-reader/High Contrast/installed-app checks with a Windows tester and sync
the Project board once accessible. No PR was merged or issue closed.

Build logs retain dependency deprecation and Actions Node-runtime notices;
these are not failed checks. Dependency/packaging upgrades need Chair 1
coordination and separate validation. This focused UI correction changes no
package, lockfile, main/preload/API, Asset implementation or release settings.

The previous full visual walkthrough and its limits follow.

Review: [PR #39](https://github.com/Jaxsavvy/meridian-connect-studio-build/pull/39).
Verified executable source: `396137468c1043aea0c658c9be4418ac774195c0`.
The branch preserves original PR #34/#35/#37 source histories and all prior
Builder/capture fixes; none of those PRs or main was merged or rewritten.

## Automated evidence

- Local full relevant Node suite: **118/118 passed**.
- [Combined guided run 38846745481](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/38846745481): **118 Node tests, combined guided Electron workflow and DEV-020 Electron lifecycle/capture workflow passed**.
- [Source run 38846745315](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/38846745315): source syntax, locked dependency verification, source/packaging-input and prohibited-path checks passed.
- The separate branch-specific `dev020-electron-smoke` job is intentionally skipped on the combined branch. Its actual runtime command runs inside `guided-ui`, after the guided flow, and passed there. No skipped job is counted as evidence.
- Artifact: [website-guided-ui-evidence / 12023392691](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/38846745481/artifacts/12023392691).

The artifact was downloaded and its ZIP SHA-256 verified:
`d1f374c7002a7a1328133edd86aae5ed1c1c678123c80d0079742503b05c826d`.
Raw metrics and a screenshot-hash manifest are retained in `combined-evidence/`.
GitHub Actions used synthetic merge commit
`22eaccaf38fa28be7dfed35f18f65bd30fc291ae`; GitHub Git metadata confirms its
tree is identical to verified branch source `3961374`:
`a6b61231a0c5ec08b6a2e59bcef1acd0318aebe1`. Raw provenance is not rewritten.

## Behavior and visual inspection

Codex opened all twelve final guided screenshots plus the Asset warning and
Asset 200% captures. The final source corrected issues exposed by real walkthrough:

- Internal navigation now asks what to do with dirty Website/campaign/Asset
  work. Keep editing retains content; Save/Discard composes the remaining guard
  before navigation, project switch or voluntary sign-out.
- Scene save/reopen retains edited text and synthetic references; a pending
  save acknowledgement does not mark later edits as saved.
- Copy scene creates a new local Website page from same-project synthetic text,
  preserving source scene/project identity; foreign source IDs are rejected.
- Overview continuation, four guided steps, sandboxed desktop/phone preview,
  compact handoff readiness and explicit unavailable service actions are visible.
- Editing a lower page field preserves focus and scroll instead of jumping to
  the top. The real Electron regression checks the scroll offset and focused field.
- At 200%, local navigation is compact, more than half the viewport remains
  available to the editor, every guided step fits horizontally, and its focused
  heading is actually visible. The preview/frame remains usable.
- Modal keyboard focus/wrapping and zero unlabeled Builder controls passed.
  Forced colors/reduced motion were emulated and checked; their actual captures
  were inspected. This is not a Windows screen-reader or OS-level test.
- Ordinary employee mode remains disabled/Unavailable, the Studio host stays
  hidden and synthetic shell modules are not loaded. That test checks the gate,
  not the quality of unrelated Connect Overview UI.
- The mounted Asset warning visibly contains unsaved text and both choices;
  hashes differ from both baselines. Project isolation, revocation, Keep/Discard,
  voluntary sign-out and 200% width checks passed in the combined app.

## What remains outside this completed implementation pass

Independent shared-file and visual review is still required from Jaxsavvy and
Theecassycat. No self-approval, review dismissal, issue closure or merge was
performed. Keep DEV-006 open while the user's unmerged/review gates apply.

Actual screen-reader output, actual Windows High Contrast and installed Windows
application behavior require a suitable Windows testing environment; they were
not simulated or claimed. A tester with that access should verify Narrator
labels/status announcements, Tab/Shift+Tab/Escape and focus return, OS High
Contrast, create/save/reopen and switch/sign-out in an isolated synthetic build.
These platform limits are separate from the verified Linux Electron behavior.

Authoritative persistence, live storyboard/media placement, reviewer/action
policy, providers, approved export, publication and production availability remain
separately assigned integration/release work. Their controls remain explicitly
unavailable. Board synchronization is pending because this environment exposes
neither GitHub Project tools nor an authenticated Project CLI.
