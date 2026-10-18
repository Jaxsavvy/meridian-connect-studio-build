# Full 22-item continuation — issue9

Chair2 / Tyler. Base f665d64; task branch codex/studio-thirty-checks, existing
PR39. Items are review/preparation/implementation work, not22 claimed product
defects. Independent/human/service/owner-policy/release acceptance is excluded.

| # | Work completed | Evidence / scope |
| --- | --- | --- |
| 1 | Source review | Reviewed Website storage, history, validation, rendering and shell handlers at f665d64. |
| 2 | Interrupted save/storage failures | Five write/cleanup fault positions, reserved-index and recovery-slot collisions; retained bytes checked. |
| 3 | Simultaneous windows/separate copy | Stale writes refused after other-window saves; four recovery-alias variants preserve both records and copied edits. |
| 4 | Malformed saved/checkpoint/recovery records | null/array/boolean/foreign history envelopes reported; records preserved; retry and context reset covered. |
| 5 | Long Undo/Redo sequences | Nested deletion, linked destinations, save and checkpoint restoration compose; existing18000-transition audit retained. |
| 6 | Navigation/name/limit edges | 50 pages,100 sections, duplicate names, safe filenames; existing three-level/cycle/parent regressions pass. |
| 7 | Shared sections | Detach remains independent; restore checkpoint relinks and propagates content again. |
| 8 | Formatting/Unicode/limits | Emoji, combining text, CJK, inert pasted markup, repeated formatting and8000-character failure/redo tested. |
| 9 | Export inspection | Seven-page safe-name export; every internal href resolves; full guided actual ZIP/layout checks. |
| 10 | More layout/zoom checks | 20 step/viewport combinations with120-character names; retry keyboard focus checked at200%. |
| 11 | Keyboard/focus/labels/AX | Actual Tab/modal/step focus probe passes; checkpoint retry returns visible heading focus; no human Narrator claim. |
| 12 | Context/sign-out/late responses | Context/integration and leave-race suites pass; live navigation cancellation and checkpoint-error context clearing checked. |
| 13 | Error/retry guidance | Unavailable checkpoint history is explicit and retryable, never a false empty list; failed saves preserve edits. |
| 14 | Organization/navigation | Checkpoint count signals unavailable; direct retry/action and stable heading focus added within existing panels. |
| 15 | Fix reproduced defects | Reserved catalogue/recovery alias writes refused pre-write; checkpoint envelope/retry/readback and discard-history refresh corrected. |
| 16 | Meaningful regressions | 14 new test cases; full relevant suite210/210 pass. Before-fix failures retained externally. |
| 17 | Documentation cleanup | Current acceptance/availability/integration/boundary/handoff records supersede old open-normalization and unpublished claims. |
| 18 | Evidence and availability | All six issue acceptance groups updated; all nine Studio entries recorded with local/synthetic/service limits. |
| 19 | Open PR review/integration order | All eight live PR scopes/heads/overlaps reviewed; current69dbc7b Asset and d2fffe0 contract inputs distinguished. |
| 20 | Boundary/installer investigation | Published contract now rejects normalized overlength; unchanged host findings and missing installer crash evidence documented without restricted changes. |
| 21 | Human walkthrough preparation | Added checkpoint failure/retry,200% focus and storage-conflict scenarios with explicit not-tested instructions. |
| 22 | Publication/checks/handoff | Scoped follow-up uses PR39; exact final hosted runs, artifact checks, board readback and handoff recorded at delivery. |

## Reproductions and limits

Before fixes, the focused audit passed7 and failed4 cases. One intermediate
edit missed a Windows-line-ending insertion; after correction all targeted
cases passed. A mounted run then failed only its old save-message assertion;
updated to the explicit device-local wording without removing checks. Capture
review found200% framing clipped the Retry control; final probes record a full
normal-size warning and a separate200% visible-focus control capture. No clipped
image is accepted as proof that all controls are simultaneously visible.

The application still uses local browser storage, not cross-process atomic
transactions or authoritative service CAS. Recovery-key guards preserve legacy
standalone suffix IDs and reject only reserved/conflicting storage writes;
Save separate copy is the edit-preserving escape. Checkpoint retry is read-only
and never repairs data by rewriting it. Synthetic fixture repair is test-only.

## Verification and delivery

Local210 tests, actual guided Electron and targeted keyboard/layout/context/tool
probes pass. Current screenshots/JSON/source hashes are in renders/continuation-22.
Exact final hosted run/artifact outcomes and final source SHA are recorded in the
PR39 current verification section after publication, superseding pending entries
in earlier reports. Current test-only composition uses Asset69dbc7b; no other
chair implementation is copied into this branch. All PRs remain unmerged.
