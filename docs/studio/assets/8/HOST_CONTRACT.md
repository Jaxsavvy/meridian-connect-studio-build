# DEV-005 implemented client boundary and pending host integration

The JavaScript interfaces below exist in this batch. Their backend mapping, permissions and IPC are **pending**, not implemented. The DEV-003 route sketches remain proposals, not endpoints to call.

## Named service transport

Construct `ServiceAdapter({request(operation, payload, {signal})})`. The controller injects authoritative selected `projectId` and cancellation signal, overriding caller-supplied scope. Transport resolves records or rejects with a safe `error.code`; it must enforce authentication, current project/action access, asset/version ownership and revocation on every request. Never use client validation as authorization. Main/preload must expose only individually reviewed named operations; no renderer-selected filesystem or executable path.

| Operation | Payload | Result |
| --- | --- | --- |
| `asset.list` | projectId, query, section, reviewState | array of project-scoped records |
| `asset.import` | projectId, optional assetId/parentVersionId, filename, mediaType, Uint8Array bytes, operation, idempotencyKey | canonical complete asset record |
| `asset.metadata` | projectId, assetId, expected revision, name/tags/description/section | canonical record or REVISION_CONFLICT |
| `asset.download` | projectId, assetId, versionId | filename, mediaType, Uint8Array bytes, sha256 |
| `asset.submit-review` | projectId, assetId, versionId, expected revision | canonical record |

These are component payloads, not an approved wire schema. Host may translate buffered import into approved chunk/resume transport. First batch caps synthetic import at 25 MiB and downloads at 128 MiB; production limits need explicit agreement. Full record hydration supports lineage validation; pagination/projection would require a revised schema. Current `import` idempotency applies only to mock memory; metadata/review use revision checks. Host-side idempotency on retries, caller identity, rate limits, retention and permission matrix still need service evidence.

Asset fields: id, projectId, name, originalFilename, originalVersionId, preferredVersionId, revision, tags, description, section, provenance and versions. Version fields: id, assetId, projectId, originalVersionId, parentVersionId, sequence, operation, reviewState, bytes, sha256, mediaType, originalFilename. The mock generates visibly synthetic IDs. Backend canonical IDs and authoritative audit/tool metadata must be mapped without leaking internal storage keys.

Controller construction takes `{service,projects,onChange}`; `projects` must originate from authenticated Connect context in integrated use. Calls: `selectProject(id)`, `signOut()`, `search(filters)`, `selectAsset(id)`, `save('import'|'metadata'|'review',payload)`, `download(payload)`, `cancel()`, `snapshot()`. The isolated demo's project list is synthetic. DEV-004 shared context must be reviewed before any subscription/hook edits.

## Worker injection

Construct `UpscaleWorker({root,runner,validateImage,register,authorize,manifest,timeoutMs,maxInputBytes,maxOutputBytes})`. `root` is a host-provisioned directory, not renderer input. Manifest identifies pinned executable/model paths and SHA-256 plus approval/license/device verification. These flags are host-controlled policy input, not verifiable authorization when supplied by untrusted code.

`runner.run({executable,model,inputPath,outputPath,signal})` returns `{exitCode}`. A concrete reviewed runner must enforce OS filesystem/network/process/resource isolation and stop its process tree before settling after abort. No runner is supplied by this batch. Its `isolation` marker is an interface assertion, not security evidence. Runner must verify pinned artifacts at launch and prevent symlink/reparse/TOCTOU substitutions; worker's prechecks alone do not establish that property.

`validateImage(bytes)` must fully decode an approved image, reject decompression bombs and unsupported/corrupt media, and return `{pixels}`. Mock tests return synthetic metadata; no real decoder has been installed. Host must ensure PNG staging matches validated format or transcode through an approved decoder; the current worker uses fixed `.png` filenames.

`authorize({projectId,assetId,parentVersionId,originalVersionId,signal})` checks current scope and lineage before launch and again before registering. `register(record)` atomically rechecks authority, commits separate derivative bytes, and deduplicates by project/actor/job ID. Record includes job identity, parent/original identity, operation upscale, bytes and input/output/tool/model hashes. Registration outcomes after network uncertainty must be reconciled by job ID; no automatic reinvocation or overwrite. Worker scratch is deleted after settlement; host must securely retain an uncertain result if policy requires recovery.

Worker states: checking, running, validating, registering, succeeded; failure/cancellation terminal. View accepts an optional host `enhance(intent)` function with signal and onState. Until approved host wiring and prerequisites exist, enhancement stays disabled. The host must return only after authoritative registration, respect cancellation, clear jobs on sign-out/switch, and keep all paths/tokens outside renderer scope.

## Requested coordination

Chair 1: confirm the exact minimal files/operations for main/preload and project-context/sign-out hooks; actual schema and permission policies; approved runner/decoder and test environment. Tyler: confirm approved tokens and unsaved/switch/job state designs. No shared-file changes or real Upscayl launch will proceed from these proposed contracts alone.
