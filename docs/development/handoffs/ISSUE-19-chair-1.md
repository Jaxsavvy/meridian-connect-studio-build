# DEV-010 — Chair 1 Studio asset contract handoff

## Identity and state

- Issue: [DEV-010 #19](https://github.com/Jaxsavvy/meridian-connect-studio-build/issues/19); existing Project #1 item `PVTI_lAHODSEV684Bmo45zhAWIKU`.
- Chair: Chair 1 — Owner. Project status: Building. Priority: P1 — High. Module: Asset Library & Librarian. Read back on 2026-10-15.
- Task branch: `task/dev010-asset-contract-v1`; [draft PR #36](https://github.com/Jaxsavvy/meridian-connect-studio-build/pull/36). Implementation commit `cd9b8088bc404d10c0cdbcb7c0cab356abe8d199`.
- Scope: public-safe Connect contract and test reference only. Restricted Team Hub implementation remains separate and unmounted.

## Current checkpoint — 2026-10-18 metadata text compatibility

- Public draft implementation commit `5b4385ad37ac067763a04b2db837e589aeadb98a` tightens the unmounted v1 reference: names, tags, sections, and descriptions use their documented JavaScript UTF-16-unit bounds before and after NFC normalization; unpaired surrogates fail before fingerprinting or response mapping. The two contract docs and focused tests were updated. This does not edit Cassy's component or enable a live route.
- The focused contract suite passed 16/16 against Cassy's exact `69dbc7b` Asset Model in an isolated checkout; syntax checks passed. [Connect source checks](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/39186490564) passed on that implementation commit. Earlier 38-case Studio context evidence belongs to the prior head and was not rerun for this change.
- The separate private, unmounted stage at local commit `f5102b4` enforces the same limits. Its direct permission checks and full disposable authenticated synthetic A/B HTTP run passed; the synthetic database and files were removed. This is staging evidence, not live Team Hub or packaged Connect acceptance.
- Remaining owner decisions: production media/pixel/transfer/quota limits, cleanup and retention, reviewed preview provider, named Connect host methods, and isolated packaged end-to-end verification. PR #36 stays draft, DEV-010 stays Building, Task 01 stays PARTIAL, and Studio Assets stay Unavailable.

## Work and evidence

- The test reference now validates the bounded Studio Files metadata and review history event shapes, converts metadata history to Cassy's current Asset Model fields, and retains validated review events. Foreign version references, unexpected internal fields, and unsupported history sizes fail closed.
- Updated `docs/studio/integration/19/ASSET_SERVICE_V1_CONFORMANCE.md`, `tools/studio-context/asset-v1-contract.cjs`, and its focused test file. No shared renderer, Electron bridge, package inputs, or other chairs' files changed.
- `node --test --test-isolation=none tools/studio-context/asset-v1-contract.test.cjs`: 10 pass. `node --test --test-isolation=none tools/studio-context/*.test.cjs`: 33 pass. `node --check` on both changed JavaScript files and `git diff --check`: pass.
- [Connect source checks](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/38810642974) passed at the implementation commit. Exact changed-file list and synthetic fixture scan were reviewed; no private source, credentials, customer data, or personal paths were added.
- The separate private unmounted Studio Files stage now passes 81 synthetic A/B checks after local commit `8345403` aligned unsafe filename handling. That private branch has no remote. This PR's mapper has not been exercised against a mounted service. The earlier combined PR #33/#34/#35/#36 run predates the history-mapping commit and is historical evidence only.

## Remaining gates

### 2026-10-18 exact-history clarification

The draft exact-read contract now requires both `metadataHistory` and `reviewHistory` arrays. An empty array means zero events; omission is invalid. `historyCursor: null` means the returned arrays are complete. A non-null cursor remains unsupported by the current component/reference and cannot be silently treated as complete. The public-safe reference rejects missing arrays and retains empty arrays in the mapped record. The focused reference suite passes 12 tests at this local checkpoint; the exact pushed head and CI result must be recorded after publication. This changes no employee runtime, backend, or Cassy-owned file.

The next client review should decide the separate history paging method and UI state before allowing non-null cursors. A complete exact record still requires all version descriptors; history completeness and version-lineage completeness are separate checks.

### 2026-10-18 older-history page proposal

The separate unmounted private Studio Files stage at local commit `6870671` passed authenticated synthetic owner/A/B history paging checks: 105 consecutive edits, mixed review/edit pages, cursor scope, expiry and read revocation. A seeded disposable fixture above 1,000 events remained fully pageable. The stage removed its test database and files; no live service is mounted.

This public draft now names `files.history` with a project/asset/cursor request and bounded combined 100-event pages. Its test-only `parseHistoryPage` validates scope, field shape, lineage references, revision order, duplication and explicit completion; exact complete reads also reject duplicate revisions across event kinds. `mapAsset` still rejects a non-null history cursor, so this does not activate paged history in Cassy's component. The focused suite passes 15 tests and the relevant Studio context suite passes 38 tests locally; record the exact pushed head and source checks after publication. Cassy's adapter review must decide page state and incomplete-history UI before use. The existing Project item ID is recorded above; its fields were not re-read in this turn.

- Task 01 remains PARTIAL; loaded bytes in the running Team Hub process and a live Studio asset route are unverified. Task 02 remains a review draft. DEV-010 is open and Studio Assets stay Unavailable.
- Cassy's requested review and adapter/controller tests must cover page state, exact hydration, history, conflict, unknown outcome, and revoked scope. Her branch was not edited here.
- DEV-011 must settle explicit project grant administration, reviewer/self-review and export authority. The restricted service owner must set media, quota, history paging, cleanup, transfer, backup, and retention policies. Transfer-time revocation and host-owned safe save remain unverified.
- Next: review Cassy's feedback on PR #36, reconcile any accepted wire changes with the private stage, and run the draft conformance cases against an approved isolated service. Keep the PR draft and board item Building until those gates are met.

No live service restart, production write, merge, deployment, paid call, or availability change occurred.
