# Local Website draft integrity follow-up

DEV-006 #9 / Tyler, PR #39. Five regression cases failed against the preceding
source and pass after correction:

1. Duplicate 120-character page/scene titles appended a suffix beyond the slug
   limit, leaving drafts unsaveable. Reserve suffix space, trim boundary hyphens
   and check portable export filename collisions before insertion.
2. Home slug edits could remove index.html and bypass home deletion protection.
   Retain the home entry URL; a read-only field explains why. Other slugs remain
   editable, and rejected edits preserve Undo/Redo.
3. Syntactically valid but malformed saved data could open with missing brief,
   invalid revision, duplicate section IDs or non-text fields. Validate editor
   fields before accepting primary/backup/pending or a mutation; invalid primary
   falls through to an existing valid backup. Do not overwrite malformed records
   when all recovery candidates fail.
4. A parseable stale/empty index hid otherwise saved primary records. Union the
   index with discovered primary keys, deduplicate, then validate each candidate.
5. An older window silently overwrote newer saved content. Keep the accepted
   saved snapshot and compare current persisted content before saving; reject
   observed changes while retaining dirty local edits. Reopen/discard accepts
   the latest baseline before reapplying changes. This is local conflict
   detection, not atomic cross-process CAS, synchronization or automatic merge.

166 relevant Node tests pass; syntax/whitespace pass. Actual renderer harness
adds duplicate maximum-title save and read-only home URL assertions. Exact-source
Linux/Windows/combined runtime evidence is pending until recorded below.

Cassy PR #33 moved from3fab5ef to075ec2adcca99b60d28eaa4efeff52f24fefb9b4:
inspected all seven changed paths. Its full-byte preview/export path now refuses
non-synthetic mode before transport. Only disposable composition pins update;
Cassy files are neither rewritten nor added to Tyler's branch. Current source
remains synthetic-only; no preview/export permission or service authority added.
