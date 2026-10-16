# Device-local draft checkpoints and review readiness

Task: Tyler DEV-006 #9; proposed local UI contribution to owner integration #25.
No service contract, permission, media reference, approval or publish authority
is added. Review/publish controls remain disabled with their existing reasons.

## Behavior

- Preview includes explicitly device-local saved checkpoints. Save project first;
  checkpoint creation and restore reject dirty work rather than overwriting it.
- Each checkpoint snapshots the exact saved primary from this website/project.
  Another window's newer save prevents a stale checkpoint. Exact identity and
  draft shape are validated again when history is read/restored.
- Checkpoints use a separate project/website-scoped storage namespace, so they
  cannot become phantom websites during primary-index recovery.
- Ten checkpoints / 6 MiB serialized-history limit. At the limit, reject the new
  checkpoint and retain all existing ones; no automatic deletion or pruning.
- Restore changes only the in-memory draft, keeps the current revision counter
  and website identity, and is undoable. The saved primary does not change until
  Save project. History survives controller/app reopen in persistent storage;
  session-only fallback is explicitly labeled and not called durable.
- Checkpoint write failures preserve current work and prior checkpoints. Ordinary
  failed saves preserve edits and support retry. The UI's action-error wording
  no longer mislabels every error as a save failure.
- Review & handoff shows local unsaved/brief/content/home checks, always marked
  **not approval**. Even all-green local checks cannot grant approval or publish.

## Verification status at implementation publication

Six new model regressions pass: checkpoint persistence/restore/undo, dirty and
foreign-history protection, storage failure, no-authority readiness, bounds and
primary-index separation, and stale-window rejection. The first four tests
failed on the missing implementation before the model was added. Full relevant
local suite is 135 passing tests, syntax/whitespace clean.

Actual Electron checks exercise checkpoint creation, injected checkpoint quota,
retry, injected primary-save failure with retained text, retry, checkpoint restore
as unsaved, undo/redo, reopen and unchanged disabled review controls. Real
captures/results are pending the new exact-source CI run; they will be verified
before runtime success is claimed. Existing 154-test cross-chair runtime evidence
is a preceding pinned snapshot, not automatic coverage of this new code.

Remaining limits: no history deletion UI, multi-device/team sync, authoritative
version history, accepted service review/approval, media validation or publish.
Owner #25 acceptance and human Narrator speech remain separate gates.
