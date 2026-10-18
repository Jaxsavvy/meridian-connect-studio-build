# Recovery when storage cannot write

DEV-006 #9 continuation on `feature/tyler-dev006-combined`, after GitHub readback
of unchanged PR39/33/36/38 heads and no PR39 inline review threads. This implements
the assigned recovery and save/resume criteria, not an owner service integration.

## Reproduced failures and correction

A valid backup or pending record could not be opened when storage rejected writes:
`open()` attempted to promote it to primary, treated promotion failure as failed
recovery, and the catalogue classified the readable website as unavailable. A
successful read also silently replaced the original primary bytes. The new tests
failed against the preceding implementation.

Repository `read()` now validates candidates in the existing primary, backup,
pending order and reports whether it selected recovery data. `open()` keeps its
project-or-null interface. Neither reading, catalogue discovery nor opening writes
or deletes a candidate. The controller explicitly reports that it opened a local
recovery copy and that Save project writes the recovered draft. Recovery priority
is unchanged; a pending write is not silently preferred over a valid backup.

An explicit save now preserves the validated prior candidate as backup rather
than copying an unreadable or substituted primary. If the subsequent primary write
fails, the recovery copy remains valid, current edits and Undo remain in memory,
and an explicit retry can complete. Reading does not consume storage quota.

## Verification

- 177 relevant local Node tests pass, including three new regression cases.
- Covers backup-only and pending-only readable recovery while all writes reject,
  unchanged bytes after successful listing/open, failed save retaining edits/Undo,
  and a failed primary write followed by explicit save retry with valid backup.
- Existing foreign-website substitution test now asserts recovery preserves the
  substituted primary unchanged; expected-identity checks still reject it.
- Mounted Electron scenario injects a synthetic readable recovery record, rejects
  Storage.setItem, verifies zero catalogue/open writes and the visible recovery
  message, retains edits after failed Save, restores the fixture's storage writer,
  then verifies explicit Save and the exact validated backup. Evidence file:
  `write-blocked-recovery.json`; capture `33-write-blocked-recovery.png`.
- Syntax and diff whitespace checks pass. Fresh hosted runtime checks are pending
  at publication of this implementation; record their results before acceptance.

## Limits

Storage rejection is synthetic, not a physical full-disk experiment. This is
local recovery, not atomic multi-process compare-and-swap, cloud synchronization,
service-backed approval or release acceptance. No host, preload/API, installer,
permission policy, Cassy component or provider change. Prior installer failures
remain unresolved. No merge, deployment, paid call, Complete transition or fresh
board-state claim.
