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
