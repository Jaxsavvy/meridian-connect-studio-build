# DEV-010 — Studio asset v1 wire shapes and conformance cases (review draft)

This is a public-safe companion to ASSET_SERVICE_CONTRACT_V1.md. It specifies observable behavior for an eventual restricted Team Hub implementation and a Connect host adapter. No names below are live HTTP routes or currently approved Electron IPC. All examples use synthetic IDs. Actor identity comes from the server session, not any request body.

## Common envelope

Every request has `contract: "studio.files.v1"` and a server-checked `projectId`. Every success has the same contract and a nonsensitive `correlationId`. Mutations have a `mutationKey`: an opaque, random 16–128 character value reused only for the same logical request. The main process must retain the key during an uncertain attempt; it must not mint a new key merely because a response timed out. The service indexes actor, project, operation and key, stores a SHA-256 fingerprint of the normalized request, and persists the canonical outcome in the same durable boundary as the mutation. An identical repeat may return the stored result after current access is rechecked; changed intent under the key returns `IDEMPOTENCY_CONFLICT`.

For v1, the fingerprint input is UTF-8 JSON of the ordered tuples below. Values are validated and normalized before fingerprinting; optional values become JSON `null`, integer lengths use JSON integers, tags retain submitted order, and SHA-256 is lowercase hex. The tuple excludes `mutationKey`, `correlationId`, and transient transport offsets:

| Operation | Ordered fingerprint tuple after normalization |
| --- | --- |
| Begin import | `["files.import-begin", projectId, filename, mediaType, byteLength, sha256, assetIdOrNull, parentVersionIdOrNull, baseRevisionOrNull]` |
| Finalize import | `["files.import-finalize", projectId, uploadId, sha256, assetIdOrNull, parentVersionIdOrNull]` |
| Metadata | `["files.metadata", projectId, assetId, expectedRevision, name, tags, description, section]` |
| Submit review | `["files.submit-review", projectId, assetId, versionId, expectedRevision, "submitted"]` |
| Approve review | `["files.approve-review", projectId, assetId, versionId, expectedRevision, "approved"]` |

The service recomputes the fingerprint; a caller-provided digest is only a matching claim. `files.operation-status` takes operation, mutation key, and fingerprint to distinguish an unknown outcome from a different intent. It is itself authorized for the same actor/project/action and must not reveal a foreign operation. Retrying begin/finalize after a timeout uses the same key and tuple, or checks operation status. `unknown` is not a safe instruction to retry with a new key.

An error response has `{ contract, correlationId, error: { code, retryable } }`. It contains no foreign asset detail, private path, token, or raw exception. `retryable` means the same idempotent request may be retried after reconciliation; it does not bypass current authorization. Authentication and resource concealment must be consistent across reads, cursors, parents, uploads and status lookups.

## Canonical read shapes

`files.search` accepts `{ projectId, query, section, mediaType, reviewState, cursor, limit }`, with limit 1–50 and cursor null on the first page. It returns `{ items, nextCursor }`. Each item is a summary: `assetId`, `projectId`, `name`, `revision`, `originalVersionId`, `preferredVersionId`, `preferredMediaType`, `preferredReviewState`, `updatedAt`. It is not a full asset record. A cursor is opaque and binds actor, project, filters, ordering and snapshot/expiry. On expiry or changed filters return `CURSOR_EXPIRED` rather than silently restarting at page one. No unfiltered total count or foreign existence hint is required.

In this client-facing v1, display names and original filenames are limited to 160 JavaScript UTF-16 code units to match the current Asset Model's exact-read validator. Count the submitted value before NFC normalization and trimming **and** the resulting value after normalization; reject either oversized form. For example, 160 U+0344 characters fit the submitted count but expand to 320 units under NFC and must be denied. The service must reject a longer import filename or metadata name rather than accept a mutation that the client cannot later reload. Description is text of at most 2,000 characters; section is nonempty text of at most 100 characters. Every exact record must include `historyCursor`, with `null` explicitly meaning the returned metadata/review history is complete. Omission is invalid, and a non-null cursor is not yet supported by the current component adapter. Unexpected internal fields are invalid in the reference validator.

`files.get` accepts `{ projectId, assetId }` and returns one canonical record with complete version lineage and an explicit history-completeness marker:

```json
{
  "contract": "studio.files.v1",
  "correlationId": "synthetic-correlation-1",
  "asset": {
    "assetId": "synthetic-asset-a",
    "projectId": "synthetic-project-a",
    "revision": 2,
    "name": "poster",
    "originalFilename": "poster.png",
    "tags": ["launch"],
    "description": "",
    "section": "Files",
    "originalVersionId": "synthetic-version-1",
    "preferredVersionId": "synthetic-version-2",
    "versions": [
      { "versionId": "synthetic-version-1", "assetId": "synthetic-asset-a", "projectId": "synthetic-project-a", "sequence": 1, "originalVersionId": "synthetic-version-1", "parentVersionId": null, "operation": "original", "reviewState": "draft", "byteLength": 16, "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "mediaType": "image/png", "originalFilename": "poster.png" },
      { "versionId": "synthetic-version-2", "assetId": "synthetic-asset-a", "projectId": "synthetic-project-a", "sequence": 2, "originalVersionId": "synthetic-version-1", "parentVersionId": "synthetic-version-1", "operation": "manual-edit", "reviewState": "draft", "byteLength": 18, "sha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "mediaType": "image/png", "originalFilename": "poster-edit.png" }
    ],
    "metadataHistory": [],
    "reviewHistory": [],
    "historyCursor": null
  }
}
```

Hashes and lengths above are shape examples, not hashes of actual files. An implemented service must return true values. `versions` contains the complete lineage or fails with a bounded explicit response; silently truncated lineage is invalid. Audit/metadata history can page separately behind `historyCursor`, but the response must say when it is incomplete. `files.get-version` checks that the requested version belongs to the requested asset/project and returns one descriptor matching the full record.

Every exact record includes both `metadataHistory` and `reviewHistory` arrays. An empty array means no events in that history; omission is invalid and must never be interpreted as empty. `historyCursor: null` means both arrays are complete. A non-null cursor identifies incomplete history and remains unsupported by the current component adapter. `metadataHistory` contains events shaped as `{ actorId, priorRevision, revision, changed, createdAt, correlationId }`, where `changed` contains only `name`, `tags`, `description`, or `section` fields with `{ before, after }` values. `reviewHistory` contains `{ actorId, versionId, decision, revision, createdAt, correlationId }`; `versionId` must belong to the record. `createdAt` is a Unix-seconds integer. The test reference checks these fields, rejects unexpected internal fields, and maps metadata events to the current component's `actor`/ISO `at`/`changes` shape while retaining validated review events. These examples describe a draft wire shape, not a live route or approved reviewer policy.

The current component accepts at most 100 metadata events. The exact-record reference therefore returns `PAGED_HISTORY_UNSUPPORTED` for more than 100 metadata or review events, or any non-null `historyCursor`. A service must not claim `historyCursor: null` for silently truncated history. The separate test-only `parseHistoryPage` reference below validates older pages; it does not change the component adapter or make partial history safe to display as complete.

### Proposed older-history page

`files.history` accepts `{ projectId, assetId, cursor }`, where `cursor` came from that asset's exact-read `historyCursor` or the preceding history page's `nextCursor`. The service derives the actor from the authenticated session and rechecks current project membership and `asset.read` on every page. It returns `{ contract, correlationId, projectId, assetId, metadataHistory, reviewHistory, nextCursor }`. Both arrays are required, and together contain at most 100 events. The first exact read returns the newest 100 events across both kinds; each older page contains strictly earlier revisions. Each array is ascending by revision. `nextCursor: null` explicitly ends both histories. An empty page with a non-null cursor is invalid.

The opaque cursor binds actor, project and asset and has a bounded lifetime; the isolated stage currently uses five minutes. A foreign or revoked actor receives no page or existence hint. An expired cursor returns an explicit expiry or concealed unavailable result after cleanup; it never restarts at the first page. A new edit after page one must not appear in an older page. A client that wants a current complete history restarts from a fresh exact read and keeps incomplete history marked as incomplete until all pages validate. A stored idempotent mutation outcome may contain a cursor that has since expired; the mutation remains committed, and a fresh exact read is the path to a new history cursor.

The test-only `parseHistoryPage` checks the scope, complete envelope, field shapes, exact-version references, combined 100-event bound, duplicate and ordered revisions, and that every event is older than the caller's previous page boundary. The caller supplies the full exact-read version IDs and the lowest previously seen revision; neither is a renderer-selected authority. Cassy's client adapter still needs page state and an explicit incomplete/complete UI contract before this proposed method can be mounted.

## Transfer and mutation shapes

| Operation | Required input | Required success |
| --- | --- | --- |
| `files.import-begin` | `projectId`, `filename`, `mediaType`, `byteLength`, `sha256`, `mutationKey`; derivative also `assetId`, `parentVersionId`, `baseRevision` | `uploadId`, `maxChunkBytes`, `acceptedOffset: 0`, `expiresAt`, `bodyDigest`. All are actor/project bound. |
| `files.import-chunk` | `projectId`, `uploadId`, exact `offset`, bounded bytes, chunk SHA-256 | Same `uploadId`, next `acceptedOffset`. Identical repeat returns that offset; changed bytes at the offset conflict. |
| `files.import-status` | `projectId`, `uploadId` | `acceptedOffset`, `expiresAt`, declared size/hash; no bytes or path. |
| `files.import-finalize` | `projectId`, `uploadId`, whole-file `sha256`, same logical target and stable `mutationKey` | Full canonical record, `createdVersionId`, `bodyDigest`; original or derivative lineage matches the begun intent. |
| `files.metadata` | `projectId`, `assetId`, `expectedRevision`, fields, `mutationKey` | Full canonical record with strictly newer revision, appended changed-field audit/provenance and fingerprint. |
| `files.submit-review` | `projectId`, `assetId`, `versionId`, `expectedRevision`, `decision: "submitted"`, `mutationKey` | Full canonical record with strictly newer revision and append-only submission event for that exact version. |
| `files.approve-review` | `projectId`, `assetId`, `versionId`, `expectedRevision`, `mutationKey` | Owner-only approval of an exact submitted version with active project membership, append-only provenance, and a strictly newer revision. Self-approval is allowed. Live use waits for restricted-service policy proof. |
| `files.preview` | `projectId`, `assetId`, `versionId` | Bounded reduced-fidelity rendition after `asset.read` authorization; never complete version bytes or a reusable byte URL. Unsupported media remains unavailable. |
| `files.download` | `projectId`, `assetId`, `versionId` | Exact approved-version host-owned transfer, byte length, SHA-256, verified media type, safe suggested name. Active membership and explicit `asset.export` grant apply to every actor; authority is rechecked at issuance and transfer. |
| `files.operation-status` | `projectId`, operation, `mutationKey`, `bodyDigest` | `pending`, `succeeded` with same canonical result, `failed` with safe error, or `unknown`; no foreign record. |

The current client checks 25 MiB imports and 128 MiB downloads. Those are upper bounds for the client only. The service must publish and enforce its own per-type byte, pixel, chunk, time, and quota limits. Until then, the named bridge is unavailable. The service must reject malformed or corrupt media based on decoded content, not only file extension or magic bytes.

## Conformance cases for isolated synthetic A/B staging

Each case requires real service persistence and authentication unless marked client-only. Use a separate synthetic database/vault and no production accounts or customer bytes.

| ID | Scenario | Required result |
| --- | --- | --- |
| R01 | A lists own project, then B's project, with identical query | Own summaries only; foreign attempt denied with no count/existence hint. |
| R02 | Reuse A's cursor with changed filter, B session or revoked A membership | Denied or `CURSOR_EXPIRED`; no cross-scope page. |
| R03 | Page has `nextCursor` and an older loaded asset is absent | Client retains loaded asset until exact read or explicit complete refresh; never treats first page as full set. |
| R04 | Exact get returns original plus two branches under one parent | All lineage loads; original ID/hash and existing version fields remain immutable. |
| R05 | Exact get drops/replaces a loaded version or changes original filename/hash | Adapter/controller rejects response and preserves prior loaded record. |
| H01 | Exact read has more than 100 combined metadata/review events | First page has both arrays and a non-null history cursor; older pages return every event once, preserve provenance, and end with `nextCursor: null`. The current component remains unavailable for this record until it supports page state. |
| H02 | History cursor is reused by B, for another asset, after revocation or expiry, or with a newly added event | No foreign or revoked page; no silent restart. An older page excludes the new event and contains strictly older, unique revisions. |
| W01 | A begins original, sends chunks, finalizes, restarts staging, gets/downloads exact version | One canonical asset; SHA-256 and bytes match after restart. |
| W02 | Same begin/finalize key and body after lost response | Same upload/version/result; no duplicate derivative or new original. |
| W03 | Same key with changed filename, bytes, parent or metadata body | `IDEMPOTENCY_CONFLICT`; original outcome unchanged. |
| W04 | Interrupted upload resumes at acknowledged offset; changed acknowledged chunk | Identical resume succeeds; changed chunk denied. |
| W05 | Truncated, corrupt, oversized or wrong-hash bytes | No visible asset/version; bounded cleanup of staging. |
| W06 | B substitutes A asset/parent/version/upload/status ID | Denied without an existence hint; no mutation. |
| W07 | A membership revoked after begin, before finalize or download | Commit/transfer denied; no visible version or bytes. |
| M01 | Two editors save metadata from same revision | One commit; stale editor gets `REVISION_CONFLICT` and retains draft. |
| M02 | Metadata times out after commit | An exact read may show changed state but does not prove that operation committed. Status for the same actor/project/operation/key/fingerprint returns its exact result; no second audit event or new-key replay. |
| V01 | Derivative targets valid parent versus foreign/nonexistent/cyclic parent | Valid branch preserves original; invalid target denied and no sequence consumed visibly. |
| V02 | Member submits exact version; another member attempts approval; owner with project membership approves | Submission event appended once; other member denied; owner approval records exact version and provenance once. An identical retry returns the first result, while changed intent conflicts. |
| V03 | Owner loses project membership before or during approval commit | Decision denied if revocation wins first; prior review state and audit remain intact. A serialized approval that commits first remains auditable. |
| D01 | Byte stream is interrupted or digest/length/media differs from descriptor | Save fails closed with no completed destination file. Transfer status remains actor-bound and unconfirmed until the host verifies and acknowledges an atomic save; an uncertain receipt can be reconciled without inventing success. |
| D02 | Export grant or membership revocation before byte transfer | Transfer denied or stopped if revocation wins first; no reusable public grant. Owner export requires the same explicit grant. |
| O01 | Concurrent SQLite writers and staging restart | No duplicate sequence, partial visible asset, or lost committed audit; retry/lock behavior measured. |

Client-only checks R03/R05 also run against a fake versioned transport. They do not substitute for the service-backed checks. A passing draft contract or green source suite cannot mark Studio Assets Available.

## Open owner decisions

DEV-011 draft PR #38 records the owner's policy choices for project access, approval, self-approval, export, and limited preview. The restricted service owner still sets media/transfer/quota limits, retention and backup, audit history access/expiry, upload TTL, and SQLite transaction/recovery policy. Preview rendition limits and its host contract require review. Cassy confirms page state and exact read mapping in her adapter/controller tests. Chair 1 approves the individually named main/preload methods only after these decisions and staging evidence.
