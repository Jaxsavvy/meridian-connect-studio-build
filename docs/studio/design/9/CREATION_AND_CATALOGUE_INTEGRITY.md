# Creation retry and catalogue integrity

Continued DEV-006 #9 audit after write-blocked recovery, without stopping at that
slice. Scope remains Tyler's Website model, shell, styles, tests and task docs.
Current owner/Cassy PR heads and missing adapter inputs were rechecked; no new
independent feedback or published owner client source was available.

## Reproduced defects

- Creating a website with an existing generated identity could replace the saved
  website. New identities now use UUIDs where available, with an entropy-bearing
  fallback, and collision checks refuse replacement regardless of generator.
- An interrupted creation or separate-copy save could persist the primary but
  fail index/cleanup. Retrying created another identity. Same-session retries now
  reuse the attempted identity and compare its exact last attempted content.
  Further edits made after a failed copy are included. Repeated failures keep both the last observed own content and the next attempted content, so an early second failure cannot falsely classify the retained copy as foreign. Another window's changed
  copy is preserved and causes a conflict; a later explicit retry can choose a
  fresh identity. The source website, checkpoints and current editor remain
  unchanged until the separate copy finishes. Pending attempts clear on context
  change, opening another website, close or discard. This is not atomic CAS or a
  durable cross-restart idempotency service; retained partial records remain
  discoverable after restart.
- A malformed retained draft with no empty home URL was accepted and exported
  without index.html. Validation now requires the home entry, consistent with
  existing UI protections. Readable backups are preferred over invalid primaries;
  all-invalid candidates remain visible as retained-record recovery warnings.
- Storage enumeration failure could throw out of list/context transitions. The
  catalogue now reports a separate unavailable state, avoids claiming an empty
  saved list, preserves records, and exposes an explicit retry. Failed retry keeps
  its keyboard control; successful retry focuses the saved list heading. The
  refresh operation cannot replace a dirty open editor.

## Tests and continued audit

186 relevant local Node tests pass. The focused original overwrite/retry cases
failed before correction (63 existing pass, four new fail), as did the missing
home and catalogue access cases added in subsequent passes. A renderer harness
checks truthful list errors/retry. A reproducible seeded test exercises18,000
synthetic transitions across pages/sections, hierarchy, shared content, Undo/
Redo, saved copies and checkpoints, validating the project, selection and home
export after every transition. It does not simulate physical input, service
permissions, storage faults or parallel process atomicity; separate targeted
fault tests cover the failures described above.

The mounted Electron flow now rejects index writes during Save separate copy,
keeps one attempted identity, edits the retained draft, retries and verifies the
same copy plus unchanged original bytes. It also rejects Storage.key, verifies
visible non-empty-list-error language and failed-retry focus, restores the test
writer and verifies successful retry/focus and unchanged saved bytes. The test
restores prototype overrides in finally blocks and removes only its fixtures.
Fresh hosted runtime verification will be recorded below after publication.

No main/preload/API, owner/Cassy runtime, package/installer, security policy,
provider or live service change. No merge, Complete or deployment. Prior installer
reliability, authoritative integrations and independent/human review remain open.
