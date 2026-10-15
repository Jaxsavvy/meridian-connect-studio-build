# Paged read state review prototype

Unmounted test-only prototype under issue docs, outside packaged src. Reviewed PR #36 reference 5f331a3. PagedRead injects search/get and parsePage/mapAsset; tests use already-parsed synthetic page fixtures, not the unmerged reference or a live service.

Keeps summaries separate from full records, retains hydrated records when a partial/filter page omits them, commits a page atomically, rejects duplicate/looping cursors against accepted pages, retries failed next-page cursor, bounds requested limit to 50 and uses host project over caller filters. New filter/project generations and signout reject late page/exact results. Five targeted tests pass; combined asset/host suite including prototype passes 62. Syntax/whitespace and scoped paths reviewed.

Not runtime integration: parser must validate full v1 envelope, field allowlist, history completeness and each page before returning. Wire conformance, immutable-record continuation validation in prototype hydration, retained-record eviction/limits, cancellation signals, page UI, uncertain mutation body/status binding and service authorization remain pending. Runtime controller already has immutable continuation checks; do not bypass it by shipping this prototype. No shared mount, IPC or endpoints added. No screenshot: state-only test harness, no visible application change.

Review recommendation: retain summary page state and exact canonical records separately, never infer deletion from a partial page, and reconcile uncertain mutations through operation-status rather than exact-read coincidence. Agree the runtime page interface with Chair 1 before replacing current array search.
