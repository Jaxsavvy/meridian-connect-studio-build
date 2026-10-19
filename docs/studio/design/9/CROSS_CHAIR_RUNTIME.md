# Pinned cross-chair runtime verification

Task: DEV-006 #9 compatibility contribution to #33/#39. Neither PR is merged.

## Latest verification — Tools-first home (October 19, 2026 UTC)

Supersedes the old input pin and historical results below for this batch.
Implementation input #39: `82d242c7d007780f7c8a550be8d5a1efe5b0caf8`
(tree `af9feb9de11b62b25d5761341a5d9ececd7d2ecf`), based on `7cba846`.
Current #33, read back before verification:
`69dbc7b688ed94823d082ee400833db1feb3f28c`
(tree `970dd339bc2bf8530e73e57b3b30111413667a48`). Both disposable jobs
produced composed tree `aa05b71220e9b152dcc076656105ff1b911e335c` with a clean
initial tracked tree. Local-only CI commits: Linux
`97e286762c5928a9fa783128b71e8012735f9552`, Windows
`17c465b954d8c178f9b1ce66e1222d8aaed58ba6`. Neither is pushed or merged.

All five applicable jobs passed on that implementation head:

| Verification | Run | Result |
| --- | --- | --- |
| Connect source checks | [39187252425](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/39187252425) | Pass |
| Linux guided UI / locale matrix / Asset lifecycle | [39187252406](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/39187252406) | Pass |
| Composed Linux and Windows | [39187252359](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/39187252359) | Both pass; 263 composed regressions |
| Windows UI / actual OS Contrast / disposable install | [39187252471](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/39187252471) | Pass |

17 targeted renderer tests and all 231 local regressions pass. Mounted synthetic
checks verify DOM order: selector → compact continuation → nine tools → campaign
→ production/assets → decisions. Actual Tab traverses all 13 actions after the
selector in that same order with each focused action in view. Desktop 1440px,
800px narrow window, and 1440px at actual Electron zoom factor 2 pass without
horizontal overflow in the home content. Continuation height is 97–195 CSS px
across Linux/Windows cases. The existing horizontal local-nav strip remains
scrollable at smaller effective widths. Every tile retains its existing state:
Website Builder Development, eight other tools Planned; unmet-service and
Unavailable explanations remain intact. No connected service is implied.

Inspected current Linux desktop/narrow/200% and composed Windows narrow/actual
OS Contrast at 200% screenshots. Scroll is needed at 200%; Tab brings each action
into view. OS Contrast flags 126 → 127 → 126, restoration true. Current committed
screenshots (standalone Linux implementation input above):
[desktop](tools-first/40-tools-first-desktop.png),
[narrow](tools-first/40-tools-first-narrow.png),
[200% tools, scrolled](tools-first/41-tools-grid-200pct.png).
[Machine-readable inputs and home assertions](tools-first/verification.json).
Full standalone/composed screenshots and source hashes remain in the run artifacts.

Downloaded archives and independently checked their SHA-256 against GitHub:

| Artifact | ID | SHA-256 |
| --- | --- | --- |
| Guided UI | 12158656346 | `ce2759259acd774de9aa3330ae93c7cad8763c513979df0bcfdd6d3d94c7ee71` |
| Composed Linux | 12157858929 | `924603e8dbc5e4f83313f88f4a2ea0f2215729c1840c624758abe6a06612accf` |
| Composed Windows | 12158303874 | `46c0d65b3f87a50f1060f63d72867e6f982e5b053bd76b1b8d48f2e3996f6e9f` |

This evidence commit adds documentation/screenshots only after the verified
implementation; it changes no runtime source, tests, workflow, or composition
pin. Its own CI must also finish before handoff; read the final PR comment for
that exact head and run links. No Cassy component or owner service/bridge changes.
Issue #9 remains open for independent review, human accessibility and native-pointer
observations, installer investigation, and authoritative service acceptance.
Synthetic checks and the successful disposable install do not close those gates.
No merge, release, paid call, customer data or production action.

## Workflow and evidence format

The `Cross-chair runtime verification` workflow checks out the exact #39 event
head and separately checks out Cassy's pinned #33 head. The current pin is
`69dbc7b688ed94823d082ee400833db1feb3f28c`; the first historical run below used
`3fab5ef500f7e321d4bab23b6dacdb87abc4a6d4`. Results apply only to their recorded
inputs. Credentials are removed. Composition happens only in a disposable
checkout, rejects unexpected paths/deletions or conflicts, and creates a
**local-only synthetic snapshot**. No composition commit or Cassy source is
pushed to a branch.

`test-output/composition/inputs.json` records both input commits/trees, composed
commit/tree, clean initial state and all tracked source/default file hashes.
Rebuild that exact composition in a disposable local checkout to verify its
tree; its local-only commit is deliberately not a GitHub-hosted commit.

Both Linux and Windows run the composed source suite and actual guided/Asset
Electron flows. Composition-only assertions verify inherited token colors
(normal colors only), local font stack, result count, shared continuation helper,
actual Tab from name to tags, actual Escape within the inline warning, dirty
value retention and return focus. Windows also repeats with actual OS High
Contrast enabled/read back/restored. Screenshots are actual app pixels.

## Historical first composition

UI input `7475a6fd597411770758a54c5cff78dd99a0e4e9` plus historical Asset input
`3fab5ef500f7e321d4bab23b6dacdb87abc4a6d4` passes [run 38968292052](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/38968292052)
on Linux and Windows: 154 composed tests, both actual Electron flows and Windows
actual OS High Contrast/readback/restoration. Actual Tab and Escape checks pass;
normal inherited colors are text `rgb(242,246,251)`, panel `rgb(14,27,46)` and
control border `rgb(166,181,202)` with Inter/local fallback fonts and result count.

Downloaded artifacts **12075662413** (Linux) and **12075163596** (Windows),
verified GitHub ZIP digests, and independently rebuilt exact composed tree
`cb8b095a180021f3e8f837eeb0e0b5cfae0bf0b8` in the clean disposable local checkout.
Own temporary merge aborted. Local-only CI capture commits are Linux
`d11b7bd2496fb7deccc17ceca5d5b02e7304d16e` and Windows
`6e82624bd875b676b9e56c5eff2e299c3df2e76a`; same tree, not GitHub branch commits.
Archive SHA-256: Linux `a84ed63935120370847a284e767a1c9ed9fdea6a740202ec3ac523be1ff132c5`;
Windows `92d517672236d52ed1418ebee4a92bc39784594d41bbc29cb71f99a643b43381`.

Opened/inspected actual normal token/keyboard images and actual OS Contrast
token image. Initial visual review caught the composed warning clipping after
the new test scrolled details; `7475a6f` adds explicit scroll/viewport/choice
assertions. Fresh Linux, Windows normal and Windows OS Contrast warning images
were then inspected: warning and both choices visible. Linux includes dirty
name; Windows dirty name is below fold and verified separately by state/focus
checks. This does not rewrite standalone #35 evidence or claim Narrator speech.
OS flags 126 → 127 → 126, restored true. Later #39 source must rerun this same
pinned composition; this record is exact-input evidence, not blanket future coverage.

Limits: synthetic development adapters only, not live service authority,
Narrator speech, approved media/permission acceptance, authenticated installed
Studio, installer distribution or release. Inline warning is not a modal;
Escape is scoped to its focused controls. Keep all PRs unmerged.
