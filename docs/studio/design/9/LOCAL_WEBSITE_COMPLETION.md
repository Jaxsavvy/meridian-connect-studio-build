# Local Website Studio completion — 2026-10-16

PR: [#39](https://github.com/Jaxsavvy/meridian-connect-studio-build/pull/39).
Branch: `feature/tyler-dev006-combined`.
Verified executable source: `837559b75c7ddfaf0a89c2fac337746dcdf9ac94`.
Feature commit: `472d1c7`; focus/runtime guard: `239f54e`; final contrast/capture correction: `837559b`.

## Delivered local gaps

| Gap | Implemented behavior | Verification |
| --- | --- | --- |
| Page order/removal | Keyboard-accessible selected-page up/down/remove; valid selection after deletion; home and last-page protection; undo/redo | Model regression and actual Linux/Windows UI operations |
| Section management | Hero/content/features/call-to-action selector; up/down/remove; undo/redo; existing 100-section bound | Model regression and actual CTA/reorder/remove/undo |
| Global styles | Six-digit accent and three allowlisted local font families, applied to every page; no CSS injection or remote font; readable action text at accent extremes | Persistence/undo/rejection/contrast tests and actual renderer controls |
| Multi-page preview | Explicit parent page selector; selected-page title/content; inert in-frame navigation; original empty iframe sandbox retained | Model checks plus actual every-page selection, focus retention and sandbox assertions |
| Whole-site download | Standard UTF-8 ZIP STORE with CRC-32, safe portable filenames, 64 MiB limit, all static pages and relative navigation | Unit structure/CRC test; real Electron download on Linux, Windows and actual OS Contrast; independent Python ZIP decoding |

Downloads are local **draft** output. They neither save the project nor authorize
publishing, approval, provider calls or media-service access. Removal is a local,
undoable edit, not deletion of an authoritative service record. History remains
session-local. No packages, bridge, backend, employee gate or Cassy modules changed.

## Exact verification

- **127/127** relevant local and Linux CI tests; **78/78** Windows tests.
- [Source run 38964410373](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/38964410373),
  [Linux run 38964410375](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/38964410375),
  [Windows run 38964410689](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/38964410689): all success.
- Both real Electron flows pass on both OSes. Actual Win32 High Contrast enabled,
  read back, exercised and restored (**126 → 127 → 126**); not merely emulation.
- Existing NSIS package built and installed only on a disposable Windows runner.
  All **47** installed source/default files match that runner's checkout exactly.
  Independent comparison to Linux source matches 10 files directly and 37 text
  files after expected Windows CRLF normalization. This is not cross-OS byte equality.
- Real installed login Tab/AX/employee gate passes, with no authenticated workspace
  behind login and no synthetic session/module or programmatic route bypass.
- Capture merge `3bb6ada1d0493afbde9b4714250531c29c80e0b0` and source share exact
  Git tree `c2df5476cc1737be7f568e6d6d70f3cee12e53c0`, verified through GitHub.
- Downloaded [Linux artifact 12073937648](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/38964410375/artifacts/12073937648)
  and [Windows artifact 12073134702](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/38964410689/artifacts/12073134702);
  archive digests match GitHub. Fifteen explicitly enumerated final-source images
  were opened and inspected; hashes/results are retained in
  `combined-evidence/local-website-completion.json`.
- All three actual downloaded site ZIPs independently decode with valid CRCs and
  both pages/relative links. All share SHA-256
  `20dc0a43a13a12deefc44610dea90f92c1f73f41f2ffe0faca7bd21f013675c5`.
- Actual Asset warning state/pixel/source guards pass and hashes differ from both
  clean baselines. Linux warning visibly shows dirty field and both choices.
  Windows normal capture shows warning/choices but its dirty field is below fold;
  the composed actual-OS Contrast image visibly includes that dirty field.
  The Windows font control is below fold; Linux style evidence shows both controls.
- Source-only compatibility with Cassy's #33 `80461b2` refreshed in a clean
  disposable worktree: no conflict, **150/150** tests, staged whitespace clean.
  Prospective tree `e2f53935d80b0d2c9bab648d9609074b14a2e510`. The temporary merge
  was aborted; no #33 runtime or branch/PR merge is implied.

## Remaining people and boundaries

- **Jaxsavvy and Theecassycat:** independent reviews requested on #34/#39.
  Either must independently verify #35's corrected evidence. No self-approval.
- **Theecassycat:** confirm/return the requested Windows Narrator speech and human
  Contrast/keyboard walkthrough on #9 using `WINDOWS_REVIEW.md` and current branch.
  **Jaxsavvy:** coordinate an alternate tester if unavailable. **Tyler:** follow
  through on results; no booking or human pass is inferred from silence.
- **Jaxsavvy / service owners:** approved authenticated installed Studio and
  authoritative storage/media/provider/publish/release integration remain in
  #11/#19/#25/#28 and their restricted source/permission lanes.
- Rich text, drag/drop, reusable global components and nested navigation remain
  an explicit advanced-product backlog, not delivered features or hidden open
  defects in the scoped #9 acceptance. Do not infer them from these tests.
- Existing DEV-006 board item returned Building → Review → Testing, each read back;
  chair/priority/module preserved. Issue #9 remains open; **all PRs unmerged**.
  No private board screenshot was published or retried after its prior rejection.

Local reproduction: run the relevant Node command in `DEV006_VERIFICATION.md`.
Real runtime: use the existing guided workflow or the Windows interactive
synthetic reviewer in `WINDOWS_REVIEW.md`; this Linux workspace has no display.
