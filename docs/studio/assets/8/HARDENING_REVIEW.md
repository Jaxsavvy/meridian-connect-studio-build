## Task and developer

- DEV-005, refs #8; Cassy / Theecassycat / Chair 3, `feature/studio-assets`.
- Follow-up to owner-accepted PR #13. A retried import or late list could restore older metadata, a download could return another internally valid version, and project switching silently discarded unsaved edits. This change retains newer revisions, verifies requested identity, and provides explicit Keep editing / Discard choices before switching.

## Files changed

- `src/renderer/studio-assets/controller.js`: monotonic revisions, response identity, selected-version download checks, and pending-write Saving state.
- `src/renderer/studio-assets/view.js`: immediate Unsaved notice, inline project-switch choice and disabled metadata fields while pending.
- `docs/studio/assets/8/component.test.cjs`: five meaningful regression cases.
- Issue README/review/handoff and unsaved preview screenshot: updated validation and scope.

## Checks performed

- 31 component/worker/native tests pass; source syntax, whitespace, relative links and exact task-path diff reviewed.
- Browser Keep editing retains project A/draft/focus; Discard changes clears A details before B loads. Save inputs disable while pending.
- Existing real Upscayl evidence remains applicable; worker/process code was not changed or re-executed for this UI/controller slice.
- No shared renderer/bridge/API/backend files, external binaries/models or packaging changed. Prior DEV-003 uncommitted files preserved and excluded.

## Screenshots or previews

[Unsaved project-switch preview](https://github.com/Jaxsavvy/meridian-connect-studio-build/blob/feature/studio-assets/docs/studio/assets/8/unsaved-preview.png).

## Known issues and dependencies

Task #8 remains Blocked for authoritative service/shared hooks, OS isolation/resource/distribution policy and Tyler build slots/tokens. This follow-up does not claim completion or production readiness. Board refreshed and read back with unchanged Chair/Priority/Module.

## AI session handoff

See `docs/development/handoffs/ISSUE-8-chair-3.md`. PR #13 merged at accepted head `7d2452a`; the continuation is separate work. Current main incorporated with a normal merge; no reset/rebase/force push.

## Owner integration review

- [ ] Exact diff and file list reviewed by owner
- [ ] CI result and test limits reviewed by owner
- [ ] Owner explicitly approves integration into `main`

Only the owner completes this section and merges.

## Librarian continuation

Selected-image previews now use the controller's exact-version identity/checksum checks, browser decoding, scope/selection checks and Blob URL cleanup. Media and review filters match the same version; descriptions are searchable. Explicit naming suggestions remain unsaved until Save. Tags-only edits retain rule-based name provenance; changed metadata receives human attribution and a bounded last-100 change history, with the last ten entries displayed. Optional history/provenance validation preserves legacy records.

These records/filter semantics are implemented in the synthetic memory adapter; authoritative persistence, audit retention and service contracts remain proposed. No shared hooks, backend, packaging or native runner changes in this continuation.

Three regression cases cover attribution/history snapshots, same-version filter matching and malformed/legacy records. Browser checks verify decoded 32x32 PNG, rule versus human attribution, history, filters, unsaved suggestion/discard and project-switch preview cleanup. Original filename and saved name remain intact.

[Librarian preview](https://github.com/Jaxsavvy/meridian-connect-studio-build/blob/feature/studio-assets/docs/studio/assets/8/librarian-preview.png). Full Connect build/package, integrated keyboard/visual audit and OS sandbox remain unverified. Current draft PR #15 remains separate from owner-merged PR #13.
