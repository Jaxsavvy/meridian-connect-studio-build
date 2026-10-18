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

## Continued leave-transition audit

After publishing the first batch, continued source review reproduced another
race with two failing renderer tests: Keep editing during an asynchronous campaign
Save then continue was ignored when its acknowledgement later succeeded, and the
old acknowledgement could clear a newer leave dialog. A save now retains the
specific transition object and only continues while that exact request is still
pending. Cancelling navigation does not cancel or erase a successful synthetic
save. Added actual mounted acknowledgement/cancel/new-dialog sequencing.
188 relevant local tests pass after this correction. The first batch's mounted
catalogue fixture failed because its setup returned a function across Electron's
execution boundary; setup now returns void. Preserve that failed run as test
fixture feedback, not a product or installer failure. Fresh checks follow.

## Retained section identity escaping

Continued attribute-boundary review found four raw section-ID interpolations in
heading/action label and input attributes. Saved identities are not trusted HTML;
all four now use the existing attribute escaper. A failing renderer test uses an
inert extra-attribute probe, then passes with the correction. Mounted DOM coverage
checks the probe cannot introduce an attribute while both exact editor IDs remain
usable. No executable payload or OS call is used.189 local tests pass. This is a
renderer escaping correction, not a change to owner security or service policy.

The next mounted pass reached the catalogue retry/focus checks, then exposed a
second fixture mistake: a top-level `const heading` collided with an earlier
executeJavaScript declaration. The new probe is now locally scoped. Failed runs
39099656339 and39099845294 remain retained; neither is accepted as passing runtime
evidence. These failures do not establish an application or installer regression.

## Presentation record validation

Further retained-record review reproduced malformed style/date objects passing
validation and reaching renderer string/Date coercion. Style settings now require
a supported font and six-digit color; saved date fields require bounded strings.
This checks safe types, not calendar correctness. The known older shape with no
style object normalizes to safe defaults in memory without rewriting retained
bytes. Explicit editing/saving remains possible. Two new model regressions cover
backup fallback, all-invalid catalogue safety, legacy defaults and explicit save.
The mounted flow verifies recovery/defaults/unchanged bytes and a later style save.
191 relevant local tests pass; final hosted runtime evidence follows below.

## Final fault-matrix pass

A further20-case matrix combines two successive interruptions at pending, backup,
primary, cleanup and index stages, then retries. It passes with one copy identity,
the latest retained edits and unchanged original. The relevant local suite is now
192 tests. The first presentation runtime assertion expected the default font even
though the valid recovery backup held serif; the application correctly recovered
serif. The assertion now compares the exact saved backup style. Failed run
39100196482 and matching composed/Windows runs are retained, not accepted as passes.

## Exact final verification

Final tested source `9f21362bee207a146e95f6b2765c999a95c0996d`, tree
`e4fc0ddb6c0690cdd63cb38fc09f3afbe2d116c7`. Application fixes are in0d48b82,
1a4b15a,4124122 and59fc07d;9f21362 adds the final fault matrix and corrected exact
backup-style assertion.192 relevant local tests pass, including the18,000 seeded
transitions and20 repeated-write fault combinations. Disposable composition with
Cassy075ec2a passes219 tests; both OS input records match composed tree
`66c096eac538d62854d68b6b4380ef5d9d65221b`. No composition was pushed or merged.

All four final workflows pass:

- [Source 39100374702](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/39100374702)
- [Linux guided 39100374716](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/39100374716)
- [Cross-chair Linux and Windows 39100374704](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/39100374704)
- [Windows installed and Contrast 39100374707](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/39100374707)

No failed-job retry was requested. Earlier fixture failures remain in their
original runs; the intermediate4124122 source also passed all four workflows.
Final checks include all five new mounted records: copy-retry-idempotency,
catalogue-access-retry, leave-save-race, section-identity-escape and
saved-presentation-validation. All report passed on normal and actual Contrast
paths, with the stated synthetic limits.

Downloaded all four final archives, matched SHA256 and ZIP integrity, and read
back input/source provenance and the new assertions:

| Evidence | Artifact ID | SHA256 |
| --- | --- | --- |
| Linux guided | 12126078692 | c45b413b3f25bfd585571477d5dbbd9169f4ff5e5f78117b91cdcca3bc31dd39 |
| Composed Linux | 12125608862 | 8245d7ff50bd842177e2273e9818c3af7cf234aa26df2923f52df0d084188f67 |
| Composed Windows | 12126431986 | a8d8e409d29fa7c53d03adbdbf44abdc2b6bedf17a06a37df861e7e3332ad068 |
| Windows installed | 12126292599 | af0a7b4172cf8364fa888208742a93fc0c5458406d212ea4a3bd6d52a1e9367a |

Inspected Linux200% saved-copy confirmation and the complete catalogue warning/
retry, plus the actual Windows Contrast warning/retry. The kept-editing capture
shows the editor remains selected; exact saved notes and dialog sequencing are
asserted in leave-save-race.json rather than claimed visible in that capture.
All six actual website ZIPs in the four final archives pass ZIP integrity, safe
flat HTML filenames and UTF-8 decoding, with no executable script tags or dead
#contact links. Existing export-layout runtime checks pass.

Installed source matches the exact treee4fc0ddb above (the GitHub checkout commit
reported by that harness is848ac2c). Installation, startup, AX/keyboard and ordinary
employee gating pass. Actual Win32 Contrast flags126→127→126 are restored. No human
Narrator/physical pointer, authoritative installed Studio service, general
installer reliability or release acceptance is claimed.

## End of accessible-input audit

After multiple source/fault/transition passes, no further reproducible unblocked
Tyler task was found. Re-read all16 open issue discussions, the8 open PRs' review
submissions and thread sets, and all15 published branches with the next page empty.
There are no independent submitted reviews for34/39;35 still needs independent
review of the correction Tyler authored. Current main29a0df6 and owner branch
9c87ad3 are unchanged. Current Cassy/Files/policy heads remain075ec2a/ed17ef6/ec1c1dc.

The latest Video worklog on22 additionally describes local uncommitted client
work; it is included in the exact-public-safe-input request on9, comment6246072096.
The same publication gap applies to AI/Storyboard/Blender/Krita/Website/Audio
inputs. Owner worklogs describe private unmounted service proofs, not a running
Connect integration. No private backend source or credentials are requested.
Remaining contract, policy, host/installer, service, independent-review and human
acceptance gates are mapped in REPOSITORY_TASK_AUDIT.md. They are concrete blockers,
not a claim that the entire Meridian build is complete. All PRs remain unmerged.
