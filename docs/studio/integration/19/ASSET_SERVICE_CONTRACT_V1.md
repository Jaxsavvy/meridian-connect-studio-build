# DEV-010 — Studio asset service contract v1 (review draft)

Status: public-safe review draft for DEV-010 #19 and DEV-005 #8. This document defines a target interface; it does not assert a live endpoint, storage service, bridge method, or employee availability. The authoritative implementation belongs in the restricted Team Hub source. The Connect repository must contain no private service code or data.

The contract identifier is `studio.files.v1`, matching the existing owner-side unmounted Files client proposal. The component's `asset.*` names remain adapter calls and are not service operation names.

## Baseline and compatibility

The current Asset Library component calls five names through `ServiceAdapter`: `asset.list`, `asset.import`, `asset.metadata`, `asset.download`, and `asset.submit-review`. The synthetic implementation returns a fully hydrated array and keeps records, bytes, and retry keys in memory. Its controller reloads one asset by listing everything. These semantics cannot be represented as a bounded production list without a new exact read and explicit paging state. The v1 host adapter must therefore be versioned and must not silently treat the first page as the full library.

Existing generic Team Hub project Files have session and project-membership checks, but do not supply immutable asset versions, action-specific authorization, durable retry keys, or review history. Their upload retry can create a second file. They are a reuse candidate for identity and project scope, not an interchangeable implementation of this contract.

## Authority and identifiers

- The service derives actor and session from authenticated server context on every call. `projectId` is a selector to verify against current membership, never an authorization grant. An inaccessible asset, version, parent, cursor, upload, or retry key must not reveal another project's existence.
- Asset IDs, version IDs, upload IDs, operation IDs, and storage keys are server generated. Display filenames are labels, never storage paths. A version is an immutable byte object. Every derivative stays in its original asset and project and names an earlier parent version. The original version and its SHA-256 never change.
- The asset has a monotonically increasing metadata revision. Metadata, preferred-version changes, and review transitions use compare-and-swap. Version sequence allocation and audit registration are transactional. Every accepted mutation records server actor, time, operation, target, and a nonsensitive correlation ID.
- The first release supports project scope only. No playgrounds, cross-project move, arbitrary filesystem path, direct Core artifact grant, or renderer-selected service URL. Core output becomes an asset only after Team Hub reauthorizes the actor/project/action and registers the exact bytes and lineage.

## Read contract

| Named operation | Request | Response and invariant |
| --- | --- | --- |
| `files.search` | Project selector; bounded query, section, media type, review state, cursor, limit 1–50 | Permission-filtered summary items, `nextCursor`, and contract version. Stable cursor binds actor, project, filters, and ordering; no foreign IDs or counts. Summary is explicitly partial. |
| `files.get` | Project and exact asset ID | Full canonical asset record with all version descriptors and current metadata revision. The caller must use this to hydrate a selected asset and to recover from conflict. |
| `files.get-version` | Project, asset ID, version ID | Exact version descriptor if it belongs to that asset and project. No byte or storage reference is exposed by a descriptor. |
| `files.preview` | Project, asset ID, version ID | Separately authorized, bounded, reduced-fidelity rendition for a member with `asset.read`; unsupported media stays unavailable. Never return complete version bytes or a reusable byte URL. |
| `files.download` | Project, asset ID, version ID | Authenticated exact approved-version stream or bounded host-owned byte transfer with byte length, verified media type, SHA-256, safe export name, and correlation ID. Require an explicit project `asset.export` grant even for the owner; recheck access at transfer time. |

The canonical service record maps to Cassy's current component names: `assetId` → `id`, `versionId` → version `id`, `baseRevision` → component `revision`. The adapter must validate that every version belongs to the same asset/project, has unique sequence and ID, and reaches the original without cycles. It must not rewrite an already loaded immutable version. Metadata and review history use bounded combined pages once the full history exceeds 100 events; a truncated history may never be called complete. The proposed `files.history` request and next-page envelope are specified in the conformance draft. The test reference can validate a page, but the current component still rejects a non-null history cursor until Cassy adopts explicit page state.

Until Cassy's component adopts a wider limit, v1 display names and original filenames are capped at 160 JavaScript UTF-16 code units on both mutation and read. Count the submitted value before NFC normalization and trimming, matching the current Asset Model, and reject any final value outside the same bound. An exact record must explicitly include both `metadataHistory` and `reviewHistory` arrays. Empty means no events; omission is invalid. It must include `historyCursor: null` when both arrays are complete; a missing marker cannot be interpreted as complete.

## Mutation and transfer contract

| Named operation | Required behavior |
| --- | --- |
| `files.import-begin` | Accept declared byte length, SHA-256, media type, safe display filename, mutation key, and either no parent (new original) or exact asset/parent plus observed revision (derivative). Authenticate, authorize, validate limits/quota, and return a short-lived opaque upload ID bound to actor/project/body. |
| `files.import-chunk` / `files.import-status` | Accept bounded ordered chunks with per-chunk digest; report acknowledged offset and expiry. Identical retransmission is harmless; changed bytes at an acknowledged offset conflict. Reauthorize each call. Invisible staging has a bounded cleanup policy. |
| `files.import-finalize` | Recheck session, membership, action, parent lineage, observed revision, quota, whole-file digest, size, and decoded media. Atomically register immutable bytes, new version, metadata/audit, and the body-bound result; otherwise leave no visible partial asset. Same actor/project/operation/key/body returns the same canonical result after uncertain retry. Changed body under the key conflicts. |
| `files.metadata` | Apply name/tags/description/section with expected revision and mutation key; append changed-field provenance and audit. Stale revision returns `REVISION_CONFLICT` with only the current authorized revision. No automatic overwrite or force-save. |
| `files.submit-review` | Target an exact version with expected asset revision and mutation key. A project member may submit only if the server policy grants `review.submit`; record an append-only submission event. Submission never approves the version. |
| `files.approve-review` | Only the authenticated owner with active membership in the asset's project may approve an exact submitted version at the expected revision. Self-approval is allowed. Record approver, submitter, version, decision, revision, time, and self-approval; recheck authority in the commit transaction. Unavailable until the DEV-011 policy is implemented and tested in the restricted service. |
| `files.operation-status` | Lookup actor/project/operation/key/body digest and return `pending`, `succeeded` with the canonical result, `failed` with safe code, or `unknown`. Unknown is not proof of failure and must not trigger a new-key replay. |

The current synthetic component limit is 25 MiB import and 128 MiB download; these are client checks only. The first service implementation must publish independently enforced byte/chunk/media limits before bridge wiring. No large file is copied through a generic renderer-selected IPC request. The Connect main process owns any OS save dialog, temporary download, digest verification, and atomic rename. A renderer path or suggested filename is never a destination grant.

A completed socket write is not proof that the host saved a verified file. The restricted service should issue an actor/project-bound transfer ID and expose an actor-bound status with no bytes. The Connect host should confirm a saved outcome only after checking length, SHA-256, media type, and atomic save. If the stream or confirmation is interrupted, the host reconciles that transfer ID and reports uncertainty until it can prove the save; it must not claim success from a send event. Any save receipt is host-only and requires separate main/preload review.

## Authorization and error policy

| Action | Minimum authority check |
| --- | --- |
| Search/get/version/preview | Active session, active project membership, exact asset/version ownership, `asset.read` grant, and final preview-transfer recheck. Preview is a separate bounded rendition. |
| Full-byte download/export | Active session, active project membership, exact approved version, explicit project `asset.export` grant for every actor, and final transfer recheck. |
| Import begin/chunk/finalize | Active session, membership, `asset.import` grant, quota/media policy, exact parent and observed revision; repeat the checks at finalize. |
| Metadata and review submission | Active session, membership, exact target, action grant, expected revision; recheck inside the committing transaction. |
| Approval and grant administration | Current server-owned owner principal; owner must be a project member to approve. Only the owner changes project membership and action grants. Neither action is available live until policy and audit pass. |

Use stable machine codes: `AUTH_REQUIRED`, `ACCESS_DENIED` or consistent concealed `NOT_FOUND`, `REVISION_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `INVALID_LINEAGE`, `INVALID_MEDIA`, `CHECKSUM_MISMATCH`, `TOO_LARGE`, `QUOTA_EXCEEDED`, `UPLOAD_EXPIRED`, `SERVICE_UNAVAILABLE`, and `UNKNOWN_OUTCOME`. Return only nonsensitive correlation IDs and permitted current revisions. The service must define one concealment policy and apply it to direct reads, list counts, upload parents, cursors, and operation lookup. Never place bearer tokens in query strings or long-lived download URLs.

## Connect mapping and required client change

| Existing component call | v1 host behavior |
| --- | --- |
| `asset.list` | Use `files.search` pages. Cassy's controller/view must represent page boundaries and partial results; it must not infer that a missing item was deleted from an incomplete page. |
| `asset.import` | Use begin → chunks/status → finalize with one stable body-bound mutation key, then exact `files.get`. An uncertain finalize requires `files.operation-status` for that same key/body before any retry. |
| `asset.metadata` | Use CAS metadata mutation, then exact canonical read. Preserve draft on offline/conflict; on unknown outcome check `files.operation-status` for the same key/body before any retry. |
| `asset.download` | Use exact-version transfer and host-owned integrity/safe-save flow. Verify digest, length, media type, and target version; confirm or reconcile the transfer outcome before reporting a completed save. |
| `asset.submit-review` | Submit only. Do not map it to approval. Reconcile an unknown outcome through `files.operation-status` for the same key/body, then reload the exact version/record. |

Add a host-level `asset.get`/`reloadAsset` capability and explicit page state to replace the current full-list fallback. A limited preview needs its own reviewed client and host operation; `asset.download` cannot serve preview bytes. The component's five names are not HTTP routes or approved Electron IPC. Main/preload methods remain separately reviewed under Task 06 and fail closed until the restricted service passes staging acceptance. PR #33, Tyler #34, and development-only mount #35 stay independent; this draft changes none of their shared files.

An exact read reports current asset state, not whether a particular timed-out mutation committed. Only an authorized `files.operation-status` result bound to actor, project, operation, key, and body digest can identify that operation's outcome. If status remains `unknown`, retain the draft/uncertainty and do not mint a new key or report success.

## Required staging proof before declaring the contract implemented

With isolated synthetic A/B identities and no customer data: deny unauthenticated and cross-project search/get/version/parent/cursor/status; import a small original, restart the staging service, read back its record and exact byte hash; create a derivative and prove original immutability; reject stale metadata and wrong reviewer action; revoke membership between begin and finalize and before download; replay finalize with same and changed bodies; interrupt/resume chunks; reject corruption and mismatch; reconcile a timed-out commit; verify audit actor/time and no visible orphan. Also exercise concurrent SQLite writers and restart recovery because historical logs recorded lock errors. These are service-backed acceptance tests, not synthetic component tests.

## Decisions still required

1. DEV-011 owner decisions are recorded in draft PR #38: owner-only grant administration and approval, project membership for approval, self-approval allowed, explicit export grant for everyone, and limited preview for read-authorized members. The restricted service must implement and prove those decisions; the current project-membership schema alone does not encode them.
2. The restricted service owner must set transfer/media/quota limits; upload expiry; audit retention and pagination; backup/recovery; object encryption and tombstone/legal-hold policy.
3. Cassy must review the paged summary + exact hydration mapping and add adapter/controller contract tests for partial pages, immutable loaded versions, conflict, unknown outcome and revoked scope. This draft is not an accepted Cassy adapter contract until that review and tests exist.
4. Chair 1 must review exact main/preload method names and payload schemas after the service contract and staged authorization tests. Keep employee Studio Assets `Unavailable` meanwhile.
