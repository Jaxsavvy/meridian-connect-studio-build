# DEV-005 implemented client boundary and pending host integration

The JavaScript interfaces below exist in this batch. Their backend mapping, permissions and IPC are **pending**, not implemented. The DEV-003 route sketches remain proposals, not endpoints to call.

## Named service transport

Construct `ServiceAdapter({request(operation, payload, {signal})})`. The controller injects authoritative selected `projectId` and cancellation signal, overriding caller-supplied scope. Transport resolves records or rejects with a safe `error.code`; it must enforce authentication, current project/action access, asset/version ownership and revocation on every request. Never use client validation as authorization. Main/preload must expose only individually reviewed named operations; no renderer-selected filesystem or executable path.

| Operation | Payload | Result |
| --- | --- | --- |
| `asset.list` | projectId, query, section, mediaType, reviewState | array of project-scoped records |
| `asset.import` | projectId, optional assetId/parentVersionId, filename, mediaType, Uint8Array bytes, operation, idempotencyKey | canonical complete asset record |
| `asset.metadata` | projectId, assetId, expected revision, name/tags/description/section | canonical record or REVISION_CONFLICT |
| `asset.download` | projectId, assetId, versionId | filename, mediaType, Uint8Array bytes, sha256 |
| `asset.submit-review` | projectId, assetId, versionId, expected revision | canonical record |

These are component payloads, not an approved wire schema. Host may translate buffered import into approved chunk/resume transport. First batch caps synthetic import at 25 MiB and downloads at 128 MiB; production limits need explicit agreement. Full record hydration supports lineage validation; pagination/projection would require a revised schema. Current `import` idempotency applies only to mock memory; metadata/review use revision checks. Host-side idempotency on retries, caller identity, rate limits, retention and permission matrix still need service evidence.

Asset fields: id, projectId, name, originalFilename, originalVersionId, preferredVersionId, revision, tags, description, section, provenance and versions. Version fields: id, assetId, projectId, originalVersionId, parentVersionId, sequence, operation, reviewState, bytes, sha256, mediaType, originalFilename. The mock generates visibly synthetic IDs. Backend canonical IDs and authoritative audit/tool metadata must be mapped without leaking internal storage keys.

Controller construction takes `{service,projects,onChange}`; `projects` must originate from authenticated Connect context in integrated use. Calls: `selectProject(id)`, `signOut()`, `search(filters)`, `selectAsset(id)`, `save('import'|'metadata'|'review',payload)`, `download(payload)`, `cancel()`, `snapshot()`. The isolated demo's project list is synthetic. DEV-004 shared context must be reviewed before any subscription/hook edits.

## Worker injection

Construct `UpscaleWorker({root,runner,validateImage,register,authorize,manifest,timeoutMs,maxInputBytes,maxOutputBytes})`. `root` is a host-provisioned directory, not renderer input. Manifest identifies pinned executable/model paths and SHA-256 plus approval/license/device verification. These flags are host-controlled policy input, not verifiable authorization when supplied by untrusted code.

`runner.run({executable,model,inputPath,outputPath,signal})` returns `{exitCode}`. A reviewed integrated runner must enforce OS filesystem/network/process/resource isolation and stop its process tree before settling after abort. Concrete `NativeRunner` now provides pinned process launch and cancellation controls; its classification is only `process-scoped`, so `UpscaleWorker` deliberately rejects it without an approved OS isolation wrapper. Its marker is an interface assertion, not security evidence. Runner verifies hashes at launch; OS host still must prevent reparse/TOCTOU substitution and prove descendant/resource containment. See [real evidence](UPSCAYL_ARTIFACTS.md).

`validateImage(bytes)` must fully decode an approved image, reject decompression bombs and unsupported/corrupt media, and return `{pixels}`. `inspectPng` now implements bounded non-interlaced 8-bit PNG validation; mock worker tests still use injected metadata to exercise state branches. Host must restrict staging to supported PNG or transcode other approved media through a reviewed decoder; the worker uses fixed `.png` filenames.

`authorize({projectId,assetId,parentVersionId,originalVersionId,signal})` checks current scope and lineage before launch and again before registering. `register(record)` atomically rechecks authority, commits separate derivative bytes, and deduplicates by project/actor/job ID. Record includes job identity, parent/original identity, operation upscale, bytes and input/output/tool/model hashes. Registration outcomes after network uncertainty must be reconciled by job ID; no automatic reinvocation or overwrite. Worker scratch is deleted after settlement; host must securely retain an uncertain result if policy requires recovery.

Worker states: checking, running, validating, registering, succeeded; failure/cancellation terminal. View accepts an optional host `enhance(intent)` function with signal and onState. Until approved host wiring and prerequisites exist, enhancement stays disabled. The host must return only after authoritative registration, respect cancellation, clear jobs on sign-out/switch, and keep all paths/tokens outside renderer scope.

## Metadata, filters and recovery — proposed authoritative semantics

Implemented synthetic filters match mediaType and reviewState on the **same version**. Query matches name, original filename, description and tags; empty filters mean unrestricted within the authorized project. A returned asset may contain other versions so lineage stays complete. No placement or approval permission follows from a match.

Optional `provenance` maps metadata fields to `{source, actor?, at?, rule?}`. Sources accepted by the client are rule/human/file/model; actor and time must originate from the authoritative service in integrated use. Optional `metadataHistory` contains at most 100 `{revision, actor, at, changes}` entries, where changes maps name/tags/description/section to `{before, after}`. The synthetic adapter appends only changed fields, retains name-rule provenance for tags-only saves, and displays the last ten events. These caps are client/mock bounds, **not approved audit retention**; the owner must decide durable audit, pagination and redaction. No model provider is invoked by the filename suggestion.

`reloadAsset(assetId)` is an implemented controller convenience using unfiltered `asset.list`, not a new IPC operation. It validates all returned records against current project, requires the requested asset, preserves a newer local canonical revision, and rejects cancelled/stale responses. The view offers an explicit discard-and-load action after a revision conflict. Draft deletion occurs only after a successful scoped response; offline/error leaves it available for retry. There is no automatic merge, force-save or background metadata retry. This full-list fallback needs replacement with an owner-approved record read if pagination is introduced.

Offline metadata Save retries the existing expected revision; if another writer committed first, the service must reject with REVISION_CONFLICT rather than overwrite. Unknown mutation outcomes require authoritative reconciliation before retry: mock synchronous memory behavior does not prove distributed exactly-once writes. Drafts are memory-only and do not survive app restart. Original bytes, filename and version lineage never change during metadata recovery.

| Owner decision | Required before integration |
| --- | --- |
| Revision/read schema | Canonical revision semantics and exact get/list/pagination mapping; safe conflict response |
| Identity/audit | Server actor/time source, event retention/redaction and provenance trust rules |
| Retry outcomes | Metadata/review idempotency or reconciliation policy for uncertain commits |
| Shared hooks | Exact DEV-004 context/sign-out and main/preload operation allowlist |
| Native/design gates | OS isolation/resource/distribution policy and Tyler's reusable slots/tokens/derivative identity |

## Requested coordination

Chair 1: confirm the exact minimal files/operations for main/preload and project-context/sign-out hooks; actual schema and permission policies; approved runner/decoder and test environment. Tyler: confirm approved tokens and unsaved/switch/job state designs. No shared-file changes or real Upscayl launch will proceed from these proposed contracts alone.
