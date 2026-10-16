# Pinned cross-chair runtime verification

Task: DEV-006 #9 compatibility contribution to #33/#39. Neither PR is merged.

The `Cross-chair runtime verification` workflow checks out the exact #39 event
head and separately checks out Cassy's pinned #33 head
`3fab5ef500f7e321d4bab23b6dacdb87abc4a6d4`, with read-only credentials removed.
It composes only in a disposable checkout, rejects unexpected paths/deletions
or conflicts, creates a **local-only synthetic snapshot**, then runs from that
clean tree. No composition commit or Cassy source is pushed to a branch.

`test-output/composition/inputs.json` records both input commits/trees, composed
commit/tree, clean initial state and all tracked source/default file hashes.
Rebuild that exact composition in a disposable local checkout to verify its
tree; its local-only commit is deliberately not a GitHub-hosted commit.

Both Linux and Windows run the composed source suite and actual guided/Asset
Electron flows. Composition-only assertions verify inherited token colors
(normal colors only), local font stack, result count, shared continuation helper,
actual Tab from name to tags, actual Escape within the inline warning, dirty
value retention and return focus. Windows also repeats with actual OS High
Contrast enabled/read back/restored. Screenshots are actual app pixels.

Status at initial publication: tests/harness prepared; fresh workflow evidence
is pending. Do not substitute the earlier 152 source-only check or #39's own
runtime for this composition. Final run IDs, downloaded artifact/tree/hash
checks and visual findings will be appended after the jobs finish.

Limits: synthetic development adapters only, not live service authority,
Narrator speech, approved media/permission acceptance, authenticated installed
Studio, installer distribution or release. Inline warning is not a modal;
Escape is scoped to its focused controls. Keep all PRs unmerged.
