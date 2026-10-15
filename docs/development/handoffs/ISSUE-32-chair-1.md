# DEV-020 — Chair 1 integration handoff

**Issue:** [#32](https://github.com/Jaxsavvy/meridian-connect-studio-build/issues/32)  
**Branch:** `feature/dev-020-asset-mount` based on `main` at `29a0df69c1b1497c85f671daddc3b8aaa979cc8a`  
**Draft pull request:** [#35](https://github.com/Jaxsavvy/meridian-connect-studio-build/pull/35)  
**Status:** IMPLEMENTED, PARTIALLY VERIFIED; **NOT READY TO MERGE**.

## Delivered
- Added `src/renderer/studio-dev-asset-transport.js`, an exclusively **synthetic** transport using Cassy's `SyntheticService`, never a live endpoint or new IPC.
- Added `src/renderer/studio-dev-asset-mount.js`, a host-owned adapter from the DEV-008 `createAssetHost` into Cassy's writable Asset Library view. The Connect project list remains the sole selected-context source. It does not expose a second project selector, sign-out control, or Upscayl.
- Extended `src/renderer/studio-asset-host.js` with scoped `reloadAsset()` and request generation access used by the existing view, without changing the service operation allowlist.
- Under `configureStudioGate(isDevelopment)`, loaded the asset scripts and styles and mounted Cassy's view into Tyler's Studio Assets surface. Normal employee mode remains disabled.
- Added an external `guardLeave` path covering Studio leave, Connect project switch, sign-out, and switching away from the Assets surface. It composes Cassy's Keep editing / Discard draft decision with the existing synthetic campaign guard. A narrow, callback-duration approval prevents reentrant leave loops; revocation and sign-out still use the existing Connect context clearing.
- Added source tests for transport, scoped operations, host-owned mount, revocation, project isolation, and sign-out, plus a development-only Electron smoke harness with synthetic screenshots.
- Kept Cassy's original `src/renderer/studio-assets/**` source and Tyler's Website Builder module untouched.

## Verified
- GitHub Actions source job: **71 tests passed, 0 failed** in multiple PR #35 runs, including the latest runtime diagnostic run [38681672275](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/38681672275). Node 24 syntax and packaging source checks also passed.
- Isolated Electron run started with the development fixture, opened Studio, visibly mounted the writable view, imported a synthetic text file, opened an unsaved metadata draft prompt, confirmed **Keep editing** retains the draft, then confirmed **Discard and leave** navigates out of Studio.
- Renderer diagnostic after discarding: `stillInStudio:false`, `assetPrompt:false`, `studioHidden:true`. The earlier recursive guard was resolved in `3d1b2bd`.
- GitHub workflow uploaded `dev020-synthetic-electron-evidence` screenshot artifact (artifact ID `11948577004`) with synthetic screenshots from the diagnostic run.

## Open acceptance failure
**The subsequent Connect project switch does not complete in the isolated Electron run.** The fixture invokes `selectProject('synthetic-field-notes')` after returning to Studio. At 250 ms and again at 8 seconds, shared context and the Studio header remain `synthetic-northstar`. Run [38681672275](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/38681672275) fails at `Timed out: Connect project switch`. Do not describe project-switch acceptance as complete.

Next diagnostic actions:
1. Query accepted `projects`, the shared Studio project selector's options, and any campaign/asset leave prompt immediately after invoking the second project switch.
2. Confirm whether Connect's `selectProject` returns early due an additional guard or unrecognized ID; log the reason without exposing user/project data beyond synthetic fixture values.
3. Confirm actual context switch, stale request rejection, and revocation with an Electron run. Unit evidence exists but is not a substitute.
4. Add an actual voluntary sign-out guard interaction to Electron acceptance.
5. Finish 200% zoom and full screenshot review after the workflow reaches those assertions.
6. Reconcile shared `app.js` and `studio-shell.js` with Tyler's currently open Website Builder PR #34 before merging #35.

## Security, limits and rollback
- No authoritative Asset Library service, new IPC/HTTP routes, Core/Team Hub backend change, permission-policy change, paid provider calls, customer records, OS isolation, executable/model packaging, production release or Upscayl enablement.
- Synthetic asset data are memory-only and never authoritative. DEV-005 #8 remains Blocked.
- The new Electron smoke CI job is branch-scoped to `feature/dev-020-asset-mount`, avoiding additional runtime cost for Tyler and Cassy pull requests.
- Rollback the DEV-020 branch changes to restore Tyler's read-only interaction preview; no stored data or schema migration.
- Keep PR #35 draft and issue #32 open until project switch, sign-out, full runtime checks and shared-file compatibility are demonstrated.
