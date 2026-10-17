# Saved website recovery catalogue

DEV-006 #9 follow-up to the full build audit. Fresh #33/#36/#38/#39 heads were
unchanged. Two further failures reproduced against e89c0cf:

- A missing index plus a pending-only/backup-only website is invisible, although
  open(id) could recover it if its ID were known. Discover candidate identities
  from every primary/backup/pending key, deduplicate, then validate on open.
- All malformed candidates silently disappear from list(), making the UI claim
  no websites were saved. Keep the readable list contract, expose separate
  project-scoped unavailable identities, and show an explicit retained-record
  warning with retry. Never infer deletion, invent a draft or remove the record.

Preserve existing valid IDs that themselves end in .pending/.backup: use the
stored ID only when its encoded key matches a primary/recovery candidate;
malformed content still falls back to its scoped filename identity. Another
website's substituted record cannot satisfy open's expected-identity validation.
No saved names/content are guessed from malformed bytes.

174 relevant local tests pass. The new mounted renderer flow creates a synthetic
pending-only record outside the index, opens it, corrupts all candidates, checks
warning/retry visibility at200%, verifies failed retry preserves bytes, restores
the fixture and retries successfully. Its cleanup removes only test fixture
records; the application adds no delete or automatic repair operation. Runtime
acceptance is pending until recorded below. All PRs remain unmerged.

## Readable errors and keyboard follow-through

Corrupt saved data reports a readable retained-copy message rather than JSON
parser details. The focused warning heading has clearance from its description.
A failed retry retains its keyboard control and scrolls it into view; successful
open moves focus to the active editor step. The renderer flow asserts failed
retry focus, visibility, unchanged bytes and successful repaired reopening.
Exact final source/runtime evidence is recorded below after verification.

## Exact-source evidence

Executable e665915dff8312aa59088b96083e1b37eaf1c3d4;
tree ed37022047b2661fa62fbc8293af49ab4d06c709.174 local tests and201 clean
disposable composed tests pass with Asset075ec2a, tree
a5bfd29a85f176ca1231fe3b433aca1390449601. Own temporary merge aborted.

Source39054433527, Linux39054433432 and combined39054433415 pass. Windows
39054433545 attempt1 passes renderer/actual Contrast/build, then installer exits
-1073741819; installed startup is skipped. One explicit same-source failed-job
retry was requested; its final result is recorded below when available. This
recurring installer failure is not corrected by the local Website UI changes.

| Downloaded original artifact | Verified SHA-256 |
| --- | --- |
| Linux12109081048 | 74821db8fe215a234c73f48a7ca690b0d97f8aa1b45812c331ef9c300c8c4654 |
| Combined Linux12108937350 | 82fb1ce259ce885301ea150287224966d041eebdbf5abc0f1077dd5496768cab |
| Combined Windows12109130936 | c744eabc9f94634733dd8951b302e4b916acdc192db159b6e8cd5d1e841e3d08 |
| Windows attempt1 12108803074 | 8063557aab7caf6c3d4c06a5e4e7312964a71af4d1fc63dd3287d113a36f12a5 |

All four downloaded archives match GitHub digests and integrity. Normal and
actual OS Contrast recovery records pass pending discovery, failed-retry focus,
retained malformed bytes and repaired reopening. Final Linux200% and combined
Windows actual Contrast warning/retry pixels inspected; heading, description
and retry are visible. No deletion/automatic repair operation added. Current
owner/Cassy published heads remained unchanged; earlier specific input, host,
service and human verification blockers remain, not a blanket completion claim.

## Explicit same-source installer retry outcome

The one requested retry, job117460094815 in run39054433545, passes, including
installation, installed-source/startup/AX/keyboard/employee-gate checks. The
initial failure remains recorded above; no installer stability fix is claimed.
Retry artifact12108754151 SHA-256:
`a0f9c57d31d344ee94c9a9bec6fec5519766ac2722adf01adbc5d5bc2f2c1b7b`.
Downloaded and matched digest/integrity. Installed source matches treeed370220.
The successful four-artifact set contains six real website ZIPs; decoded and
checked their integrity, UTF-8, safe formatting, linked/detached content and
relative CTA/no script/#contact. Recovery records pass on normal and actual
Contrast paths. Both successful Windows Contrast runs restore their original
settings; current source/combined provenance matches the pins above.

Final workflow readback:
- [Source39054433527](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/39054433527): success.
- [Linux39054433432](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/39054433432): success.
- [Combined39054433415](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/39054433415): success.
- [Windows39054433545](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/39054433545): success after the single explicit retry.

No source changes followed e665915; later commits update evidence/docs only.
All PRs remain unmerged. No new independent review or published owner client
input appeared in the recheck; current blockers are the specific ones recorded
in REPOSITORY_TASK_AUDIT.md, not a claim that no future enhancement is possible.
