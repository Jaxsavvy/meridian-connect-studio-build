# DEV-006 combined interface acceptance

Assigned task: [DEV-006 #9](https://github.com/Jaxsavvy/meridian-connect-studio-build/issues/9), Tyler / Chair 2.
Review branch: `feature/tyler-dev006-combined`. This branch composes #34
`7f8a2b0`, #35 `647bb9e` and #37 `d0d7c99`; their history and source work are
preserved. No existing PR or main branch is merged by this delivery.

| Issue requirement | Combined implementation | Verification |
| --- | --- | --- |
| Runnable Studio, identity and project navigation | Development gate, shared accepted context, project-centered overview and continuation routes | Node contracts; combined Electron job |
| Nine honest tool entries | Planned requirement surfaces; local Website Builder explicitly development-only | Existing catalogue tests and renderer inspection |
| Creative editor, save/reopen, review and recovery | Campaign scenes retain local saved edits/references; guided Website brief/pages/edit/preview; readiness screen; error/retry and unsaved guards | 121 local/CI Node tests; Linux and Windows real Electron workflows |
| Switch, sign-out and stale-result boundaries | Accepted project picker; existing request generations; composed Website/campaign/Asset leave decisions; forced context loss clears pending dialogs | Existing host/context tests and both Electron flows |
| Asset component coordination | Preserved Cassy's module unchanged; host-owned synthetic mount, editor-only synthetic fixture placement and same-project scene-text copying to a local website page | Asset suite; scene copy and scene-reference regression; combined runtime |
| Responsive, focus, accessibility, real captures | Four focused steps; keyboard modal wrapping; labels; focus restoration; 200% reflow; forced-color/reduced-motion styles and emulation; ordinary employee gate | Source and Node checks pass; CI screenshots must be inspected before final visual evidence is claimed |

## Scope decisions

- Scene-to-page is a copy of same-project **synthetic scene text**, carrying its
  source project and scene identity. It is not a live storyboard or media API.
- Synthetic reference placement remains in the campaign fixture editor. It does
  not select or approve media in Cassy's authoritative Asset service.
- Review & handoff provides readiness and clear unavailable controls. Submission,
  approval, approved-version export and publishing remain disabled until the
  separately managed DEV-010/DEV-011/DEV-016 contracts are accepted and connected.
  The existing synthetic decision queue is visibly a UI demonstration.
- Website Preview downloads local draft HTML only. The UI does not promise
  authoritative storage, team synchronization, publishing or provider execution.

## Verification and remaining limits

Local full relevant Node suite: **121/121 pass**, including behavior regressions
for internal navigation, saved scene reopen/reference retention, edits made
during a pending save, same-project scene-to-page provenance, create-storage
failure recovery, exact website identity during recovery and the 100-section editing limit. JavaScript syntax and whitespace checks pass.

Current source `c1f5f50` also passes real Windows guided/Asset flows, actual OS
High Contrast enable/readback/restoration, existing NSIS build/installation,
47-file installed-source comparison, ordinary employee startup/gate, actual Tab
input and login accessibility-tree checks. All twelve actual-OS Contrast images
and installed login were visually inspected. This source fixes background
workspace exposure behind login. Exact runs/results/hashes are in
`DEV006_VERIFICATION.md` and `combined-evidence/windows-verification.json`.

The dedicated `Website guided UI` workflow runs the combined source suite and
both real isolated Electron flows. It captures overview, each Website step,
composed Asset warning, storyboard material, review readiness, 200% zoom,
emulated forced colors and ordinary employee Unavailable state. The current run passed on source `c1f5f50` with 121 tests and both real Electron flows. Separate Windows evidence is recorded above. See `DEV006_VERIFICATION.md` for provenance, exact results and remaining limits.

Actual screen-reader speech and independent human review remain unverified.
Actual OS Contrast and ordinary installed startup now have Windows evidence,
not merely Linux emulation. Authenticated installed Studio/live-service evidence
still needs approved platform/service access. Backend/provider/permission/release tasks remain with their assigned
owners. Keep DEV-006 open and all existing PRs unmerged until the requested
reviews and applicable acceptance evidence are satisfied. The manual board
update/readback is recorded on #9; it is no longer pending access.
