# Proposed asset and service contracts

Every requirement below is **proposed / not implemented**. Restricted Meridian services own identity, project membership, canonical records, storage, authorization and audit. Connect may cache a bounded view; it must not create a duplicate project database. Backend owner and exact routes remain pending.

## Records and invariants

Asset: immutable opaque `assetId`; immutable `scope={kind:project, projectId}`; original `originalVersionId`; mutable display name, section, tags and description; metadata revision/ETag; created/updated actor and server time; active/archive/tombstone state. Playgrounds scope is disabled pending owner-approved entitlement, membership and sharing semantics. Moving projects is not a metadata edit.

Version: immutable opaque `versionId`, `assetId`, `projectId`, server-assigned sequence, `parentVersionId` (null only for original), `originalVersionId`, operation (`original`, `manual-edit`, `upscale`), operation/job ID, storage reference, SHA-256, bytes, verified media type, dimensions/color profile where applicable, original filename, safe export filename, actor/time, tool/model version and approved parameters. Storage references are internal, never arbitrary paths supplied by renderer. Derived bytes are immutable; corrections create another version. Sequence allocation is transactional, not a client counter. Branches may share a parent; reject cycles and parents from other assets/projects.

Review: separate append-only events targeting an exact version: draft -> submitted -> approved or changes-requested. New bytes start draft even when parent was approved. Approval does not overwrite original or auto-publish a Deliverable. Metadata edits increment revision with provenance; whether an edit invalidates approval needs owner policy. Explicit `preferredVersionId` updates use compare-and-swap; no silent last-writer wins.

Synthetic example: project `demo-a`, asset `asset-synthetic-01`, original `version-01`, derivative `version-02` with parent/original `version-01`, operation upscale, review draft. These labels are illustrative, not valid production IDs. An unchanged original checksum and separate output key are required before registration.

Retention proposal: preserve original and all referenced versions by default. Archive hides from normal listings but preserves lineage. Deletion requests create audited tombstones; refuse purge while Deliverables/Storyboards reference a version or a hold applies. Owner must choose retention periods, recoverability, backup policy and lawful erasure handling. Physical purge is a separately authorized service operation, never a Librarian suggestion. Orphaned staging uploads expire on an owner-approved TTL without deleting registered originals.

## Storage proposal

Logical internal layout: `projects/{canonicalProjectId}/assets/{assetId}/versions/{versionId}/original-or-derivative.ext`; previews use distinct derived keys. Staging keys use opaque upload IDs outside published listings. User filenames are labels, not directory keys. Reject traversal, separators, reserved names, symlinks and mismatched media; normalize Unicode display text without changing identity. No public bucket listing or durable public download URL. Encryption, quotas, malware/media inspection, backup recovery and retention are backend dependencies pending review.

Finalization must atomically associate validated bytes, quota consumption and the version record, or leave an invisible recoverable staging object. A reconcile job handles object/record partial failures; it cannot publish incomplete bytes. Cross-project deduplication must not expose existence, hashes or access and is excluded from this proposal.

## API proposal

Illustrative additive route prefix `/api/projects/{projectId}/studio-assets`; none of these routes are code-confirmed. Existing GET/POST bridge is not modified; any new bridge/main/API slice requires a separate Chair 1 assignment.

| Operation | Proposed interface and outcome |
| --- | --- |
| Begin upload | POST `/uploads` with expected bytes, media, filename, hash, intent (new asset or exact parent version), idempotency key. Returns opaque upload ID, limits, expiry and scoped transfer instructions. |
| Transfer/resume | Approved transport uploads chunks with offsets/checksums; GET `/uploads/{id}` returns acknowledged offsets. Reauthorize resume and completion; server validates full hash and media. Exact transport remains pending. |
| Finalize | POST `/uploads/{id}/finalize` registers original or derivative atomically, returning canonical records. Same key/body returns same result; differing body returns conflict. |
| List/search | GET root with query, section, tags, media, review, cursor and limit. Server applies project ACL before matching, counts, facets and pagination. Stable cursor binds scope/query and expires. |
| Inspect | GET `/{assetId}` and `/{assetId}/versions/{versionId}`. IDs must belong to URL project and each other. |
| Metadata | POST `/{assetId}/metadata` with expected revision. Conflict returns current permitted revision for human reconciliation. |
| Retrieve | POST `/{assetId}/versions/{versionId}/download` returns short-lived exact-object grant or authenticated stream, safe export name, hash and bytes. Every issuance and retrieval checks identity, current membership and version visibility. |
| Review | POST `/{assetId}/versions/{versionId}/review` with expected state, authorized event and idempotency key. |
| Creative tools | POST version `/tool-grants` with approved tool and purpose; narrowly scoped, short-lived grants. Tool cannot read other projects or write arbitrary output. Output registration uses upload/finalize with exact parent and job identity. |

Common errors: unauthenticated 401, forbidden 403 (or consistent 404 concealment for inaccessible resources), missing 404, expired transfer 410, revision/key conflict 409, too large 413, invalid media 415/422, quota/rate limit 429, transient service failure 5xx. Responses include a nonsensitive correlation ID and machine error code; no filesystem paths or other-project details. Owner must choose concealment consistently.

## Transfer, retry and offline behavior

Proposed client states: selected -> validating -> uploading -> validating-server -> saved, with paused/offline, failed or cancelled branches. Display Saved only after canonical finalize response. Retain original local file untouched. Do not store long-lived tokens or customer bytes in renderer/local metadata stores. Any resumable local staging policy needs owner-approved secure storage and expiry.

GET retries may use bounded exponential backoff with jitter; proposed 1/2/4 seconds, at most three retries, respecting Retry-After and cancellation. Mutation retry requires a persistent idempotency key scoped to actor/project/operation and request-body digest. After uncertain finalize response, query upload state; do not begin a second asset blindly. Server key lifetime must exceed resumability TTL. No automatic retry for permission, invalid input, conflict or quota failure without changed conditions. Token expiry requires own-user reauthentication; revocation cancels pending work and clears scoped views.

Download goes to a user-selected safe destination via future main-process handling, writes a temporary file, validates checksum/size, then atomically renames with collision confirmation. Interrupted downloads never replace an original. Range resume requires immutable version/ETag verification; otherwise restart safely. Search is scoped to current project; discard stale responses after project change, clear previous results and grants, and label cached results stale while offline. Offline search must never imply exhaustive or current permissions.

## Proposed permission matrix

Roles are capabilities assigned by authoritative services, not the Chair label or a renderer flag. Reviewer rights require explicit assignment in the same project. Owner rights here mean project-authorized owner, not automatically every project.

| Action | Employee without membership | Project member | Assigned reviewer | Project owner |
| --- | --- | --- | --- | --- |
| List/search/preview | Deny | Allow visible assets | Allow assigned visible scope | Allow in owned scope |
| Download/tool input | Deny | Allow only with download/tool capability | Same capability requirement | Allow with policy/hold restrictions |
| Upload/create derivative | Deny | Allow with create capability | Only if also creator | Allow |
| Rename/tags/metadata | Deny | Allow with edit capability | Only if also editor | Allow |
| Submit review | Deny | Allow own/editable version | Only if also creator | Allow |
| Approve/request changes | Deny | Deny without review assignment | Allow assigned version; self-approval denied | Allow; self-approval policy pending |
| Archive/request deletion | Deny | Deny by default | Deny | Allow audited request, subject to references/holds |
| Purge/change ACL/share across projects | Deny | Deny | Deny | No automatic right; separate service-owner workflow |

Every request, chunk, finalization, preview, search facet, download, grant and job commit rechecks identity, project membership, action capability, asset/version ownership and review visibility. Cross-project URL/body/parent/grant substitutions must deny even for valid IDs. A member of A has no access to B unless independently authorized. Project owner of A does not bypass B. Playgrounds and shared grants default deny. Local selection and upload intent do not authorize persistence.

Future synthetic contract checks: A-member lists/downloads A; A-member requesting B asset through A URL is denied without existence leak; B parent on A derivative denied; revoked membership during upload/finalize denies publication; expired/replayed tool grant denied; reviewer cannot rename or self-approve; retried finalize creates one version; checksum failure leaves original intact. None have run against a backend.
