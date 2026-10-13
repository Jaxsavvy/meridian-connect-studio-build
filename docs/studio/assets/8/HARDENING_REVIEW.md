## Task and developer

- DEV-005, refs #8; Cassy / Theecassycat / Chair 3, `feature/studio-assets`.
- Follow-up to owner-accepted PR #13. A retried import or late list could restore older metadata, a download could return another internally valid version, and project switching silently discarded unsaved edits. This change retains newer revisions, verifies requested identity, and provides explicit Keep editing / Discard choices before switching.

## Files changed

- `src/renderer/studio-assets/controller.js`: monotonic revisions, response identity, selected-version download checks, and pending-write Saving state.
- `src/renderer/studio-assets/view.js`: immediate Unsaved notice, inline project-switch choice and disabled metadata fields while pending.
- `docs/studio/assets/8/component.test.cjs`: five meaningful regression cases.
- Issue README/review/handoff and unsaved preview screenshot: updated validation and scope.

## Checks performed

- 38 component/worker/native/view tests pass; source syntax, whitespace, relative links and exact task-path diff reviewed.
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

## Recovery continuation

A stale metadata save previously left the draft without an explicit way to load the newer record. Controller reloadAsset now validates a scoped unfiltered list and returns the latest requested canonical record, with monotonic revision and late-response protection. The view offers explicit discard-and-load after conflict and retains draft/recovery on failed reload. Fixture-only offline/concurrent-edit controls make these workflows reproducible without a backend.

Three additional tests cover conflict reload/original preservation, foreign/late responses, and offline retry. Browser verified offline failed reload retains the draft, online reload restores canonical metadata and name focus, offline Save retries successfully, and a long accessible name wraps without page overflow at the current 1239px viewport. Tab moves name to tags. [Recovery preview](https://github.com/Jaxsavvy/meridian-connect-studio-build/blob/feature/studio-assets/docs/studio/assets/8/recovery-preview.png). This is a focused desktop check, not a complete responsive/contrast audit.

HOST_CONTRACT now describes implemented filters/history/reload and proposed authoritative audit/retry semantics. No new IPC, shared source, backend or packaging changes. Remaining integration blockers are unchanged; owner review required.

## Chair 1 host-guard assignment

Implemented the external prepareLeave/setProject/signOut/clearContext lifecycle in the isolated view, with hostOwned mode hiding local project/sign-out controls. Callable disposal remains compatible. Keep editing preserves draft/focus, failed/offline/conflict state retains drafts, discard allows the requested transition, and actual revocation clears immediately. Concurrent requests share one decision and generation checks prevent both transitions committing. Four new view-boundary tests bring the suite to 38; browser external switch Keep editing and confirmed sign-out pass. [Host guard preview](https://github.com/Jaxsavvy/meridian-connect-studio-build/blob/feature/studio-assets/docs/studio/assets/8/host-guard-preview.png).

Owner now approved same-asset derivative identity and assigned restricted services/OS isolation to DEV-010/DEV-018. HOST_CONTRACT records these decisions and exact lifecycle semantics. Shared Connect mounting, versioned live transport and Tyler's real slot remain pending. Existing worker gate and no-redistribution policy remain unchanged.
