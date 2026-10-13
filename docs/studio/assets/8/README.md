# DEV-005 first implementation batch

This is working isolated client code with a **synthetic in-memory adapter**, not production-ready service integration or a working Upscayl process. Issue: [#8](https://github.com/Jaxsavvy/meridian-connect-studio-build/issues/8). Branch: `feature/studio-assets`.

## Run and inspect

From repository root, with Node.js 24:

```powershell
node --test docs/studio/assets/8/component.test.cjs docs/studio/assets/8/worker.test.cjs
node docs/studio/assets/8/serve-demo.cjs
```

Open `http://127.0.0.1:8768/docs/studio/assets/8/demo.html`. The server is loopback-only and serves an explicit demo/module allowlist. Choose synthetic A to find a text asset; B starts empty. Import only synthetic PNG/JPEG/TXT fixtures. Reload clears synthetic changes. Sign out clears controller context. No authentication, services or persistence are used. Stop the server with Ctrl+C.

The demo uses neutral functional styling, not Tyler's selected Studio design. New modules are not loaded by Connect yet; no shared source files were edited. Use the isolated browser preview for this batch, not the installed Meridian app.

## Implemented behavior

- `model.js`: immutable-scope/lineage validation, SHA-256 record shape, safe export names and deterministic naming suggestions.
- `synthetic-service.js`: project-scoped list/search/filter, import, parent-linked derivatives, exact-version download, metadata revision conflicts and review submission. Snapshot inputs, idempotent imports and commit-time mock revocation/cancellation checks. Mock PNG/JPEG checks only inspect signatures; they are not robust decoding or malware inspection.
- `controller.js`: injected project list, scope generation, abort/sign-out/cancel handling, late-response rejection, structured states and download checksum validation.
- `service-adapter.js`: named transport interface for a later Chair 1 host adapter. No invented live endpoints or tokens.
- `view.js` / `view.css`: isolated accessible-label controls for project/list/search/filter/import/retry/download/details/metadata/version selection/review and unavailable-or-injected Upscayl job state/cancel. Unsaved metadata stays in scoped memory while viewing that project. Project switch/sign-out discard these local drafts; integrated design needs a confirmed-discard UX before shipping.
- `upscale-worker.js`: fail-closed host component with approval/pin checks, injected authorization/decoder/OS-isolated runner, bounded I/O, original checksum preservation, cancellation/timeout signal, final authorization and derivative registration. **No concrete process runner is implemented or invoked.** Mock tests use non-executable text files and simulated output; they do not verify Upscayl.

## Evidence and limits

21 Node tests pass. Tests cover branches, original preservation, snapshots, idempotency/conflicts, human naming, review isolation, cross-project/revocation, stale responses/sign-out, unsafe names, corrupt/missing media, storage failure, checksum errors and worker approval/pin/timeout/process/output/registration failures, including invalid decoder dimensions. Syntax checks pass for all new JavaScript modules.

Browser checks: selected A, imported a synthetic text file, corrected title/tags, submitted exact version for review, switched to empty B, and signed out with no prior asset details remaining. Rechecked final view after edits: unsaved naming retained across search, saved successfully, Tab moved from name to tags with visible focus, and downloaded exact synthetic version bytes. [Synthetic preview](synthetic-preview.png) is browser evidence, not an approved Connect build screenshot. Full keyboard, viewport/contrast audit, image decoding, real process-tree termination and build/package checks remain pending.

## Integration blockers

1. Chair 1 must agree exact shared main/preload/project-selection/sign-out hooks and a source of authenticated current project context. DEV-004 interface is not in the inspected main commit.
2. Chair 1 must supply authoritative endpoints/capabilities, retention/review policy and an OS-isolated runner with robust image decoding and atomic idempotent registration. See [host contract](HOST_CONTRACT.md).
3. Tyler supplied Command Workbench B direction and shared terms in issue #8. Reusable token/component implementation and approved slot wiring are still needed before integrated visuals. Clarify whether “Derivative” means a separate asset identity or a version record within the DEV-003 asset lineage; this batch uses separate immutable version records under the same asset.
4. Actual Upscayl invocation needs a pinned executable/model/license approval and verified device in an authorized isolated environment. No binaries/models installed, downloaded or committed.
5. Packaging currently includes `src/**/*`: owner must review the new runtime modules before distribution. Tests, fixtures and screenshots are under docs outside the packaging allowlist. No installer or dependencies were generated.

These gates prevent a complete Connect/Upscayl flow. This batch is reviewable working code, not task completion.
