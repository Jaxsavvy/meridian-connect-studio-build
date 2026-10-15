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

The service recomputes the fingerprint; a caller-provided digest is only a matching claim. `files.operation-status` takes operation, mutation key, and fingerprint to distinguish an unknown outcome from a different intent. It is itself authorized for the same actor/project/action and must not reveal a foreign operation. Retrying begin/finalize after a timeout uses the same key and tuple, or checks operation status. `unknown` is not a safe instruction to retry with a new key.

An error response has `{ contract, correlationId, error: { code, retryable } }`. It contains no foreign asset detail, private path, token, or raw exception. `retryable` means the same idempotent request may be retried after reconciliation; it does not bypass current authorization. Authentication and resource concealment must be consistent across reads, cursors, parents, uploads and status lookups.

## Canonical read shapes

`files.search` accepts `{ projectId, query, section, mediaType, reviewState, cursor, limit }`, with limit 1–50 and cursor null on the first page. It returns `{ items, nextCursor }`. Each item is a summary: `assetId`, `projectId`, `name`, `revision`, `originalVersionId`, `preferredVersionId`, `preferredMediaType`, `preferredReviewState`, `updatedAt`. It is not a full asset record. A cursor is opaque and binds actor, project, filters, ordering and snapshot/expiry. On expiry or changed filters return `CURSOR_EXPIRED` rather than silently restarting at page one. No unfiltered total count or foreign existence hint is required.

In this client-facing v1, display names and original filenames are limited to 160 characters to match the current Asset Model's exact-read validator. The service must reject a longer import filename or metadata name rather than accept a mutation that the client cannot later reload. Description is text of at most 2,000 characters; section is nonempty text of at most 100 characters. Every exact record must include `historyCursor`, with `null` explicitly meaning the returned metadata/review history is complete. Omission is invalid, and a non-null cursor is not yet supported by the current component adapter. Unexpected internal fields are invalid in the reference validator.

`files.get` accepts `{ projectId, assetId }` and returns one complete record:

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
    "historyCursor": null
  }
}
```

Hashes and lengths above are shape examples, not hashes of actual files. An implemented service must return true values. `versions` contains the complete lineage or fails with a bounded explicit response; silently truncated lineage is invalid. Audit/metadata history can page separately behind `historyCursor`, but the response must say when it is incomplete. `files.get-version` checks that the requested version belongs to the requested asset/project and returns one descriptor matching the full record.

When present on an exact record, `metadataHistory` contains events shaped as `{ actorId, priorRevision, revision, changed, createdAt, correlationId }`, where `changed` contains only `name`, `tags`, `description`, or `section` fields with `{ before, after }` values. `reviewHistory` contains `{ actorId, versionId, decision, revision, createdAt, correlationId }`; `versionId` must belong to the record. `createdAt` is a Unix-seconds integer. The test reference checks these fields, rejects unexpected internal fields, and maps metadata events to the current component's `actor`/ISO `at`/`changes` shape while retaining validated review events. These examples describe a draft wire shape, not a live route or approved reviewer policy.

The current component accepts at most 100 metadata events. The reference therefore returns `PAGED_HISTORY_UNSUPPORTED` for more than 100 metadata or review events, or any non-null `historyCursor`. A service must not claim `historyCursor: null` for silently truncated history. History paging and a client page state remain an integration gate before the service can handle larger histories.

## Transfer and mutation shapes

| Operation | Required input | Required success |
| --- | --- | --- |
| `files.import-begin` | `projectId`, `filename`, `mediaType`, `byteLength`, `sha256`, `mutationKey`; derivative also `assetId`, `parentVersionId`, `baseRevision` | `uploadId`, `maxChunkBytes`, `acceptedOffset: 0`, `expiresAt`, `bodyDigest`. All are actor/project bound. |
| `files.import-chunk` | `projectId`, `uploadId`, exact `offset`, bounded bytes, chunk SHA-256 | Same `uploadId`, next `acceptedOffset`. Identical repeat returns that offset; changed bytes at the offset conflict. |
| `files.import-status` | `projectId`, `uploadId` | `acceptedOffset`, `expiresAt`, declared size/hash; no bytes or path. |
| `files.import-finalize` | `projectId`, `uploadId`, whole-file `sha256`, same logical target and stable `mutationKey` | Full canonical record, `createdVersionId`, `bodyDigest`; original or derivative lineage matches the begun intent. |
| `files.metadata` | `projectId`, `assetId`, `expectedRevision`, fields, `mutationKey` | Full canonical record with strictly newer revision, appended changed-field audit/provenance and fingerprint. |
| `files.submit-review` | `projectId`, `assetId`, `versionId`, `expectedRevision`, `decision: "submitted"`, `mutationKey` | Full canonical record with strictly newer revision and append-only submission event for that exact version. |
| `files.download` | `projectId`, `assetId`, `versionId` | Exact-version host-owned transfer, byte length, SHA-256, verified media type, safe suggested name. Authority is rechecked at issuance and transfer; no arbitrary destination path. |
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
| V02 | Member submits exact version; unauthorized actor attempts approve | Submission event appended once; approval denied until DEV-011 role policy exists. |
| V03 | Reviewer authority revoked during a future decision commit | Decision denied; prior review state and audit remain intact. |
| D01 | Byte stream is interrupted or digest/length/media differs from descriptor | Download fails closed; no completed destination file. |
| D02 | Revocation after a download grant but before byte transfer | Transfer denied or stopped; no reusable public grant. |
| O01 | Concurrent SQLite writers and staging restart | No duplicate sequence, partial visible asset, or lost committed audit; retry/lock behavior measured. |

Client-only checks R03/R05 also run against a fake versioned transport. They do not substitute for the service-backed checks. A passing draft contract or green source suite cannot mark Studio Assets Available.

## Open owner decisions

DEV-011 defines reviewer/owner and self-review policy, approval/export rights, and action-specific membership. The restricted service owner sets media/transfer/quota limits, retention and backup, audit history access/expiry, upload TTL, and SQLite transaction/recovery policy. Cassy confirms page state and exact read mapping in her adapter/controller tests. Chair 1 approves the individually named main/preload methods only after these decisions and staging evidence.
