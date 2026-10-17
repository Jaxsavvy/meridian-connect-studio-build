# DEV-006 combined delivery verification

## 2026-10-16 local Website completion — current

Executable source `837559b75c7ddfaf0a89c2fac337746dcdf9ac94` passes 127 local/Linux
tests and 78 Windows tests, both real Electron flows, actual OS Contrast with
restoration, NSIS install and installed login/AX/Tab/employee gate verification.
Fresh source/Linux/Windows runs: `38964410373`, `38964410375`, `38964410689`.
Local page/section management, safe styles, multi-page preview and actual ZIP
download are implemented and verified. See `LOCAL_WEBSITE_COMPLETION.md` for
exact artifact links, source-tree checks, image inspection, independent ZIP
decoding, refreshed 152-test #33 source compatibility and remaining people.
Raw curated evidence: `combined-evidence/local-website-completion.json`.
Older records below are historical, not substitutes for this current source.

## 2026-10-16 Windows and installed-app verification — prior milestone

Verified executable source: `c1f5f507f29d69ec69ddce86d4eb7a16fafad360`.

- **121/121** relevant tests pass locally and in Linux combined run
  [38961539164](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/38961539164); both Linux Electron flows pass. Source run
  [38961539075](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/38961539075) passes.
- [Windows run 38961539058](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/38961539058) passes **72 Windows renderer/context tests**, both actual Electron flows, **actual OS High Contrast** enable/readback/walkthrough/restoration, existing NSIS build, silent installation and actual installed employee startup/accessibility/keyboard/gate checks.
- Installed `src/` and safe default settings match **47 files byte-for-byte**.
  The app has no session or development bypass; Studio stays disabled/hidden,
  synthetic modules stay unloaded and programmatic Studio routing is rejected.
  Actual Tab input moves Username → Password. The real accessibility tree
  contains USERNAME/PASSWORD/SIGN IN/Remember controls, not workspace navigation.
- Windows testing exposed background navigation behind the login overlay.
  Source fix `c1f5f50` makes the five authenticated UI roots initially inert,
  keeps them inert at login/sign-out and releases them only after the existing
  profile check succeeds. No auth service, bridge or permission policy changed.
- Actual Win32 OS setting flags read **126 → 127 → 126**, with restoration
  confirmed. Electron native High Contrast and renderer forced colors are
  asserted before any Chromium emulation. All twelve actual-OS captures were
  opened and inspected, along with installed login and DEV-020 baselines/warning.
  Warning text/choices are visible; raw dirty metadata is retained. The smaller
  normal DEV-020 image does not display its below-fold name field; the composed
  actual-OS warning capture does visibly show that unsaved field.
- [Artifact 12072732936](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/38961539058/artifacts/12072732936) was downloaded; ZIP digest
  `58114d9acbb9e31a59b3c696cb17a2e622f294e0c7f5b3bdbe8c16418e970ef1`
  and image hashes verified. Capture merge `bfb599b8aca65f5987c2a08ff1bf82f92a46754b`
  and source have identical tree `90d79649760d88dc8a9c0f5c755b07354d356b21`.
  Raw metrics/hashes are retained in `combined-evidence/windows-verification.json`.

**Remaining:** Narrator speech is not verified by an AX tree. Theecassycat was
asked on #9 to confirm an independent walkthrough; Jaxsavvy was asked to supply
an alternate if needed. No reply/booking or human pass is inferred. Independent
#34/#39 reviews and #35 correction review remain required. Authenticated
installed Studio still needs Chair 1's approved service/session; this ordinary
installed login check is not that integration. No release or installer uploaded.
The existing board update is recorded in #9 comment `6208191006`; no Complete
transition or merge occurred. `REPOSITORY_TASK_AUDIT.md` records the broader audit.

Earlier Windows test failures remain in history: an ASAR path format defect,
incorrect case-sensitive AX expectation and unsafe native scheme-string
marshalling in the new test helpers were corrected. One `252802d` installation
attempt exited with `-1073741819`; its retry and the final installation succeeded.
That intermittent installer observation is retained for Chair 1's #28 release
verification, not silently treated as proof across Windows versions.
An intermediate publication omitted the base tree; forward commit `0b74bf9`
restored the full repository without rewriting history. GitHub compare confirmed
only intended test edits remained. No original branch or main was altered.

The earlier Linux-only records below are historical and do not supersede this
newer Windows evidence or its remaining limits.

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
