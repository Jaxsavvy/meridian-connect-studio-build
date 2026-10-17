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
as unsaved, undo/redo, reopen and unchanged disabled review controls. Exact-source Linux run 38969007061, Windows run 38969007101, source run
38969007047 and cross-chair run 38969007059 all passed on 3e44413. Downloaded
Linux artifact 12075328631 and Windows artifact 12075918656; archive SHA-256
values matched GitHub (c5395aa2a8e1bfb091efe6d993e48a16a9b583d9fefbbd11c8206f8c7e23bb9d
and ca168bec4891e72513ac3be447998c519a27b2879e043ca669fd4a1f011e8b48).
Installed capture tree 5bc114c1668d714366dd3a82b2c2ab3d0a0e4470 exactly matches
3e44413. Both checkpoint-review.json records and actual OS Contrast record pass
(126 -> 127 -> 126, restored). Visually inspected Linux checkpoint and save-error
captures plus actual Windows Contrast checkpoint capture: labels, restore
controls, retained history and error feedback are visible. Installed-source
comparison, AX/Tab and ordinary employee gate also pass. Human Narrator speech
is still unverified. Repeated relevant local suite: 135/135.

Remaining limits: no history deletion UI, multi-device/team sync, authoritative
version history, accepted service review/approval, media validation or publish.
Owner #25 acceptance and human Narrator speech remain separate gates.
