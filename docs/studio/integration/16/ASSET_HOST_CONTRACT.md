# DEV-008 Connect asset host contract

This is the Chair 1 boundary for DEV-005. It connects the accepted Connect project context to Cassy's isolated asset controller in a testable module. It does not expose the Asset Library as a Connect tab or provide a live asset service.

## Implemented hook

`src/renderer/studio-context.js` now includes `projects: [{id,name}]` in each copied snapshot. The list comes only from Connect's successful `getProjects` response in `src/renderer/app.js`; malformed, failed or stale list responses cannot supply it. A changed list notifies subscribers even if the selected project remains the same. `reset()` removes the list and selection on sign-out. This is client scope state, never an authorization decision.

`src/renderer/studio-asset-host.js` exports `createAssetHost({context,Controller,ServiceAdapter,transport,onChange})`. The owner supplies DEV-004's `meridianStudioContext`, Cassy's `Controller` and `ServiceAdapter`, and eventually a reviewed named `transport`. The host injects the current copied project list, follows Connect selection, and clears/aborts Cassy's controller on project switch, revocation, failed list refresh and sign-out. Its returned interface exposes `snapshot`, `search`, `selectAsset`, `save`, `download`, `cancel` and `dispose`; it does not expose `selectProject`. Callers cannot choose an asset project independently of Connect. A transport call checks the current selection before dispatch and after response. Controller generation checks also discard late results.

A name-only refresh of the currently selected project updates the host's copied display name without restarting Cassy's controller or cancelling an in-flight write. A changed project ID or revoked selection still clears and aborts immediately.

An absent transport returns `SERVICE_UNAVAILABLE` through Cassy's controller state. In this state, no asset list or save can succeed. The injected synthetic transport used by tests is visibly test-only. No renderer-selected endpoint, local path, executable, token or model enters this module. This slice adds no script include or visible navigation; the development-only mount and its external unsaved-switch guard are separate work.

## Approved transport prerequisites

The existing DEV-005 [component contract](../../assets/8/HOST_CONTRACT.md) names `asset.list`, `asset.import`, `asset.metadata`, `asset.download` and `asset.submit-review`. Those names are the accepted client interface, **not** approved HTTP routes or IPC channel names. Chair 1 still needs to review an authoritative wire schema and implement individually named main/preload methods before passing a real transport here. The existing generic `ws:request` bridge is not approval to let the renderer choose asset routes.

For each operation, the restricted service must bind the authenticated actor to the current session, recheck project membership and operation capability, resolve the asset and version within that project, and reject revoked access. Writes need canonical IDs, revision checks, immutable originals, review history and durable actor-scoped idempotency. A retry after uncertain completion must reconcile by idempotency or job ID before invoking again. Download bytes must match the requested version and digest; do not trust renderer-side validation as authorization. Required error codes include `PROJECT_DENIED`, `NOT_FOUND`, `REVISION_CONFLICT`, `OFFLINE`, `SERVICE_UNAVAILABLE` and a retry-safe uncertain-result state. Payload limits, chunk/resume semantics, audit, retention and permission matrix require an owner contract. Restricted implementation belongs outside this repository.

## Upscayl and distribution gate

Cassy pinned the official Windows CLI/model artifacts, recorded hashes and license inventory, and verified a real synthetic CLI run in [artifact evidence](../../assets/8/UPSCAYL_ARTIFACTS.md). The current native runner is process-scoped; it cannot enforce OS filesystem/network isolation or GPU/memory quotas. The worker deliberately refuses integrated use without a reviewed OS-isolated runner. Before enablement, Chair 1 must specify host-provisioned scratch, read/write allowlists, network denial, resource limits, child-tree termination, validated decode, authorization before launch and at registration, and recovery for uncertain registration. This is a policy and implementation gate, not a checked feature.

Do not add the executable, models or generated files to Git or Electron packaging now. The current `package.json` packages `src/**/*` source modules, so a later distribution review must inspect those modules and the exact final `build.files` output. License and model provenance inventory is recorded; owner acceptance of redistribution terms and notices remains pending. The pinned local artifacts are development materials only.

## Integration dependencies

1. Cassy's PR #15 and Tyler's PR #29 are now on `main`. Cassy's view exposes `hostOwned` and guarded `prepareLeave`, `setProject`, `signOut`, and `clearContext` methods. The DEV-008 binding still exposes a restricted facade rather than a mounted view, so those methods have not been connected to Connect navigation or sign-out.
2. A separate, development-gated mounting slice must connect Cassy's host-owned lifecycle to Tyler's Asset Library slot and Connect's project/navigation guards. Voluntary leave must await the draft decision before changing shared context; actual revocation must clear immediately. Keep synthetic fixtures clearly labeled and unavailable in ordinary employee mode. Verify this in a running isolated build before claiming a writable integration.
3. Define and test the authenticated asset service and named main/preload bridge. Synthetic tests here prove the client binding, not backend permission enforcement.
4. Review OS isolation, distribution, licenses and supported image formats before enabling Upscayl in Connect.

Rollback for this slice is removal of the host module and `projects` snapshot/list-change notifications. No schema or persisted data is introduced. DEV-005 stays Blocked until its complete integration criteria are met.
