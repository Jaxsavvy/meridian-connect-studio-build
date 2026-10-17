# Verified warning capture — October 15, 2026 PDT

Source correction: `e72bacee7bf23c350e3502862b60357311788a9b`.
[GitHub Actions run 38843707878](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/38843707878)
passed source checks (85 tests) and the real isolated Electron smoke.
Artifact: `dev020-synthetic-electron-evidence`, ID `12021823931`.
Downloaded ZIP SHA-256:
`b25287384a1802658aef5ff859fd1aaaa7957253a70bb990a944c046ab5fe25c`.

Actions checked out its synthetic PR merge commit
`3fff370095b76221ca8b922dac14cf3fa5d48412`, whose parents are main
`29a0df69c1b1497c85f671daddc3b8aaa979cc8a` and correction `e72bace`.
Its tree is **exactly identical** to correction `e72bace`:
`40d1a93b2791bfc7b226a7033461628c92938b65`. This was verified through
GitHub Git metadata, not inferred from a green status. Raw capture metrics retain
that actual merge commit; they have not been rewritten to pretend HEAD was the
branch commit.

## Pixel review performed

Codex downloaded the actual artifact, verified the ZIP digest and all three PNG
hashes against `warning-capture.json`, and opened each full-size image for visual
inspection. `unsaved-asset-leave.png` visibly shows:

- The actual sentence “Unsaved asset metadata will be discarded if you leave this project.”
- Both **Keep editing** and **Discard changes and leave** controls.
- The selected synthetic Northstar project and Display name **Unsaved synthetic metadata**.

Both baseline images lack the warning. The selected-clean baseline shows the
saved Display name `design-notes`; the ordinary baseline has no selected asset.
The actual warning/control pixels are legible and inside the viewport, matching
the recorded 873-by-81 alert at x=486, y=391.75. Hash differences alone were not
used as visual acceptance.

| Capture | SHA-256 |
| --- | --- |
| Ordinary Asset view | `51c9859f82181b70e9b84532028ee965ed5b098b93c85ed4fac5cabb28da6ad2` |
| Selected clean asset | `2ef56c19b912387fb503d2b554a5c67b5ff928b6022303653a232d561026f349` |
| Actual unsaved warning | `36d81d7b381f9a2a1a6804530fc21b2e08fe2ed1aa0a0f0e7f7f6ab12580db8b` |

Raw runtime results confirm Keep editing retained the draft/project, Discard
completed navigation, accepted-project switch isolated assets, 200% zoom fit,
revocation removed project scope/options, and sign-out retained then cleared
state as requested. Raw `manualVisualReview: PENDING` reflects the automated
capture's honest status at creation; this separate record documents the later
manual inspection without modifying original evidence.

The images and raw JSON under `renders/` are copied byte-for-byte from that run.
They were not mocked, edited, regenerated or captured locally. The editing
environment lacks Electron/display support; CI supplied the real running app.
The evidence publication adds only documentation/images after `e72bace` and
changes no runtime/harness code. Tyler can independently verify the committed
images and guard. Both PRs #34 and #35 remain unmerged; no approval, dismissal,
release or combined-runtime verification is implied.
