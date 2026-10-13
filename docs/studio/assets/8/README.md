# DEV-005 first implementation batch

This is working isolated client code with a **synthetic in-memory adapter**, not production-ready service integration. A real pinned Upscayl CLI run and failure/cancellation checks are now verified separately; integrated OS-isolated worker/Connect behavior remains pending. Issue: [#8](https://github.com/Jaxsavvy/meridian-connect-studio-build/issues/8). Branch: `feature/studio-assets`.

## Run and inspect

From repository root, with Node.js 24:

```powershell
node --test docs/studio/assets/8/component.test.cjs docs/studio/assets/8/worker.test.cjs docs/studio/assets/8/native.test.cjs
node docs/studio/assets/8/serve-demo.cjs
```

Open `http://127.0.0.1:8768/docs/studio/assets/8/demo.html`. The server is loopback-only and serves an explicit demo/module allowlist. Choose synthetic A to find a text asset; B starts empty. Import only synthetic PNG/JPEG/TXT fixtures. Reload clears synthetic changes. Sign out clears controller context. No authentication, services or persistence are used. Stop the server with Ctrl+C.

For the separate **real native synthetic test**, stage official artifacts with `& docs/studio/assets/8/stage-upscayl.ps1`, then run `node docs/studio/assets/8/native-demo.cjs` and open `http://127.0.0.1:8769/`. It allows only seeded synthetic PNGs and derivatives, denies imports, and can invoke the pinned CLI. See [artifact/licensing/evidence report](UPSCAYL_ARTIFACTS.md) before running. Memory fixture records are synthetic; process controls are not an OS sandbox.

The demo uses neutral functional styling, not Tyler's selected Studio design. New modules are not loaded by Connect yet; no shared source files were edited. Use the isolated browser preview for this batch, not the installed Meridian app.

## Implemented behavior

- `model.js`: immutable-scope/lineage validation, SHA-256 record shape, safe export names and deterministic naming suggestions.
- `synthetic-service.js`: project-scoped list/search/filter, import, parent-linked derivatives, exact-version download, metadata revision conflicts and review submission. Snapshot inputs, idempotent imports and commit-time mock revocation/cancellation checks. Mock PNG/JPEG checks only inspect signatures; they are not robust decoding or malware inspection.
- `controller.js`: injected project list, scope generation, abort/sign-out/cancel handling, late-response rejection, monotonic revision handling, concurrent saving states and selected-version download identity/checksum validation. Older retry/list acknowledgements cannot undo newer metadata.
- `service-adapter.js`: named transport interface for a later Chair 1 host adapter. No invented live endpoints or tokens.
- `view.js` / `view.css`: isolated accessible-label controls for project/list/search/filter/import/retry/download/details/metadata/version selection/review and unavailable-or-injected Upscayl job state/cancel. Unsaved metadata stays in scoped memory while viewing that project; an inline Keep editing / Discard changes and switch choice protects project switching. Sign-out clears scoped drafts. Metadata fields disable while requests are pending so an acknowledgement cannot silently discard edits typed during save.
- `upscale-worker.js`: fail-closed host component with approval/pin checks, injected authorization/decoder/OS-isolated runner, bounded I/O, original checksum preservation, cancellation/timeout signal, final authorization and derivative registration. Its original tests use simulated output, not real process evidence.
- `native-runner.js` / `png.js`: concrete pinned CLI process runner and bounded PNG decoding. Real synthetic success/failure/cancellation evidence is in [the artifact report](UPSCAYL_ARTIFACTS.md). Runner is process-scoped, not an OS sandbox; the integrated worker gate remains closed.

## Evidence and limits

31 Node tests pass. Tests cover branches, original preservation, snapshots, idempotency/conflicts, human naming, review isolation, cross-project/revocation, stale responses/sign-out, unsafe names, corrupt/missing media, storage failure, checksum errors, PNG validation/artifact pins and worker approval/pin/timeout/process/output/registration failures. Additional cases protect newer metadata from old retry/list responses, reject wrong-asset responses and self-consistent wrong-version downloads, and preserve Saving while a concurrent write is pending. Separate real CLI scripts pass success, actual launch cancellation, timeout, corrupt/no-output, missing-input and wrong-pin checks. Syntax checks pass for all new JavaScript modules.

Browser checks: selected A, imported a synthetic text file, corrected title/tags, submitted exact version for review, switched to empty B, and signed out with no prior asset details remaining. Rechecked final view after edits: unsaved naming retained across search, saved successfully, Tab moved from name to tags with visible focus, and downloaded exact synthetic version bytes. [Synthetic preview](synthetic-preview.png) is browser evidence, not an approved Connect build screenshot. Full keyboard, viewport/contrast audit, image decoding, real process-tree termination and build/package checks remain pending.

Native browser checks also passed real job completion, distinct derivative selection/parent identity, cancellation and no added version after cancellation. [Native preview](native-preview.png). Baseline PNG decoding is now verified; broader image formats and descendant-tree/OS containment remain pending.

Continuation browser checks verified immediate Unsaved feedback, project selector remaining on A while a switch is pending, Keep editing retaining the draft/focus, and explicit discard clearing A details before B loads. [Unsaved switch preview](unsaved-preview.png).

## Integration blockers

1. Chair 1 must agree exact shared main/preload/project-selection/sign-out hooks and a source of authenticated current project context. DEV-004 interface is not in the inspected main commit.
2. Chair 1 must supply authoritative endpoints/capabilities, retention/review policy and OS isolation/resource enforcement around the concrete process runner plus atomic idempotent registration. Baseline PNG decoding now exists; broader media support remains pending. See [host contract](HOST_CONTRACT.md).
3. Tyler supplied Command Workbench B direction and shared terms in issue #8. Reusable token/component implementation and approved slot wiring are still needed before integrated visuals. Clarify whether “Derivative” means a separate asset identity or a version record within the DEV-003 asset lineage; this batch uses separate immutable version records under the same asset.
4. Official pinned artifacts were downloaded outside Git and real synthetic CLI execution was verified at Cassy's request. Owner distribution/license acceptance and integrated OS sandbox policy remain pending. No installer run or binaries/models/generated output committed.
5. Packaging currently includes `src/**/*`: owner must review the new runtime modules before distribution. Tests, fixtures and screenshots are under docs outside the packaging allowlist. No installer or dependencies were generated.

These gates prevent a complete Connect/Upscayl flow. This batch is reviewable working code, not task completion.

## Librarian continuation evidence

Synthetic adapter now retains changed-field provenance and last-100 metadata events; tags-only saves preserve rule-based naming. Search includes descriptions, with media/review filters matching the same version. These are proposed authoritative service semantics. The isolated view exposes explicit naming suggestions, last-ten history and controller-verified decoded image previews. URLs and drafts clear on scope changes. Browser checks passed PNG preview, attribution/history, filters, suggestion/discard and scope cleanup; [preview](librarian-preview.png). Three new regression tests pass. Broader image formats, full Connect integration and audit retention remain pending.
