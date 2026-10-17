# DEV-005 cross-chair compatibility check

Reviewed Jax PR #17 merged at main 29a0df6 (rename preservation 9c87ad3), Tyler PR #29 and accessibility PR #31. Incorporated current main with a normal merge on feature/studio-assets; no shared-file authorship or rewritten history. Existing DEV-003 edits remain excluded.

## Confirmed code and tests

- Jax host uses accepted context project lists, named operation allowlist, pre/post-request scope checks, fail-closed missing transport and rename-preserving pending writes.
- Tyler shell stays development-gated; tools remain Planned and employee-mode Studio remains unavailable. His modal improvements do not automatically apply to Cassy's inline guard.
- 47 asset/native/worker/view/asset-host tests passed together. Separately 26 Studio workspace/context/renderer-integration tests passed. These synthetic suites do not establish live service permissions, OS containment or screen-reader behavior.

## Concrete mounting handoff

The current createAssetHost facade is intentionally headless. Do not pass it directly to StudioAssetView.mount: the view currently requires controller projects/generation/onChange, reloadAsset and lifecycle/context methods not exposed by that facade. Do not expose the private raw controller merely to evade the boundary. Chair 1's separate development-gated mounting slice must agree a restricted observable view-controller contract or mount ownership factory, then route context through it.

Voluntary project/navigation/sign-out must await the view's prepareLeave before changing meridianStudioContext. Keep editing leaves shared context and draft unchanged. Actual revocation/session loss must clear immediately. Host selection of the current ID must preserve drafts and pending work; name-only refresh must update displayed labels without resetting draft/version or aborting writes. Disposal must abort pending jobs/requests and ignore late results.

Cassy retains isolated component files; Jax owns studio-asset-host/context/shared navigation; Tyler owns the slot and modal/token components. Before shared edits, coordinate which component owns dialog focus, Tab wrapping, Escape, background inertness and exact invoker restoration. The existing inline guard is not a modal-accessibility acceptance claim.

Live transport still needs versioned paging/exact read and mutation-status reconciliation; no invented endpoints or extra IPC operations are enabled here. Upscayl OS gate and no-bundling policy remain unchanged. DEV-005 stays Blocked; no Complete or release assertion.
