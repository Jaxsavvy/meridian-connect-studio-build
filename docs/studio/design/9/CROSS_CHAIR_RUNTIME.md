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

## Verified first composition

UI input `7475a6fd597411770758a54c5cff78dd99a0e4e9` plus pinned Asset input
above passes [run 38968292052](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/38968292052)
on Linux and Windows: 154 composed tests, both actual Electron flows and Windows
actual OS High Contrast/readback/restoration. Actual Tab and Escape checks pass;
normal inherited colors are text `rgb(242,246,251)`, panel `rgb(14,27,46)` and
control border `rgb(166,181,202)` with Inter/local fallback fonts and result count.

Downloaded artifacts **12075662413** (Linux) and **12075163596** (Windows),
verified GitHub ZIP digests, and independently rebuilt exact composed tree
`cb8b095a180021f3e8f837eeb0e0b5cfae0bf0b8` in the clean disposable local checkout.
Own temporary merge aborted. Local-only CI capture commits are Linux
`d11b7bd2496fb7deccc17ceca5d5b02e7304d16e` and Windows
`6e82624bd875b676b9e56c5eff2e299c3df2e76a`; same tree, not GitHub branch commits.
Archive SHA-256: Linux `a84ed63935120370847a284e767a1c9ed9fdea6a740202ec3ac523be1ff132c5`;
Windows `92d517672236d52ed1418ebee4a92bc39784594d41bbc29cb71f99a643b43381`.

Opened/inspected actual normal token/keyboard images and actual OS Contrast
token image. Initial visual review caught the composed warning clipping after
the new test scrolled details; `7475a6f` adds explicit scroll/viewport/choice
assertions. Fresh Linux, Windows normal and Windows OS Contrast warning images
were then inspected: warning and both choices visible. Linux includes dirty
name; Windows dirty name is below fold and verified separately by state/focus
checks. This does not rewrite standalone #35 evidence or claim Narrator speech.
OS flags 126 → 127 → 126, restored true. Later #39 source must rerun this same
pinned composition; this record is exact-input evidence, not blanket future coverage.

Limits: synthetic development adapters only, not live service authority,
Narrator speech, approved media/permission acceptance, authenticated installed
Studio, installer distribution or release. Inline warning is not a modal;
Escape is scoped to its focused controls. Keep all PRs unmerged.
