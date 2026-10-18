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

## Exact source acceptance record

Verified final source `62ae6ae4ac88efdff06ab0732b69af327550418b`, tree
`e95dbe10b999f640d2aed15428c74a53fd9afe69`. Application correction is in
`726ec77119427cad3facf0941175c7fd0a1fa282`; the final follow-up changes only the
capture/assertion so the recovery status is actually visible at 200 percent.
The first capture showed the editor below the status and was not accepted as
visual evidence of that message. The corrected capture is inspected.

177 local tests pass. The three new regression cases failed against the prior
source (60 pass, 3 fail in that focused suite), then pass with the correction.
Fresh disposable composition with Cassy `075ec2adcca99b60d28eaa4efeff52f24fefb9b4`
passes 204 tests. Both OS composition records match tree
`49e6c4293716f6c73ddf516dce4eda1839772ac6` and the exact UI input above.
Neither branch is merged.

All four final exact-input workflows pass on their first attempt:

- [Source checks 39097426123](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/39097426123)
- [Linux guided UI 39097426148](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/39097426148)
- [Cross-chair Linux and Windows 39097426287](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/39097426287)
- [Windows installed and OS Contrast 39097426124](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/39097426124)

The earlier implementation run at726ec77 also passed all four workflows. No
retry was requested in this continuation. This does not resolve the previously
recorded NSIS access violations or establish installer reliability.

Downloaded all four final evidence archives, matched their published SHA256 and
ZIP integrity, and read back recovery assertions. Archive identities:

| Evidence | Artifact ID | SHA256 |
| --- | --- | --- |
| Linux guided | 12125167445 | 5dd59d27e31eee951a013de77a8867e6617ad1348666f049d0d6e7a4fbb42293 |
| Composed Linux | 12124962034 | ce1e350c7f13117fb02d08575f1b7951eba9e961ea6a8ff5766bcf87c85bb981 |
| Composed Windows | 12124324708 | 86d6c084c2388de3c57b4cf210775c7e581fd9320a824b83d27c19fd35504487 |
| Windows installed | 12124847671 | a6ed0f93e55f61d79c5972cefda2ffeac0d27d34cd76d29ca7d6c956ba811c45 |

The mounted records confirm zero recovery read writes, retained corrupt-primary
bytes, retained edits after rejected Save, successful explicit retry and the
exact validated backup. Inspected the actual Linux 200-percent and composed
Windows OS Contrast recovery-message pixels. All six real exported website ZIPs
in the four final archives decode as UTF-8 HTML, pass ZIP integrity and safe flat
filename checks, and contain neither executable script tags nor dead #contact
links. Existing runtime export-layout checks also pass.

Windows installation, installed startup/source/AX/keyboard and ordinary employee
gating pass. Installed provenance reports the GitHub checkout commit43be2b3 and
exact matching source treee95dbe10 above; it is not a different application tree.
Actual Win32 Contrast records126→127→126 with restoration successful. No human
Narrator speech, physical pointer input, authorized installed Studio service flow
or production release acceptance is claimed. Owner integration inputs and prior
contract/host-policy findings remain open. No fresh board transition or Complete.
