# Saved scene format verification

DEV-006 #9, Chair 2; executable source e85e0aa6d96da6fd7ec3e050dd05446bf14b900e.

Loading the first scene ignored its stored format; discarding edits also reset
format to landscape and Saved status to Draft. The renderer now uses the scene
format and retains Saved status after discarding changes to a saved scene.
Two targeted regression tests reproduce the original defects. All 137 relevant
local tests pass. The synthetic adapter remains session-only: this change does
not add durable storyboard storage or claim restart persistence.

All exact-source workflows passed:
- Source: 38996767449.
- Linux guided UI and Asset lifecycle: 38996767466.
- Windows guided UI, Asset lifecycle, actual OS Contrast, existing NSIS build/install
  and installed-source/startup/AX/Tab/employee gate: 38996767468.
- Disposable cross-chair Linux/Windows composition: 38996767455.

Real UI test saves vertical, changes to square, discards through the existing
leave warning, returns to the editor and asserts vertical. scene-format.json
passes in Linux, normal Windows, OS Contrast and both cross-chair variants.
Linux 06-storyboard-material.png was visually inspected and visibly shows
9:16 vertical and Saved. The cross-chair OS Contrast scene capture was inspected
for readable layout; its format field is below the fold, so retention there is
established by runtime metrics rather than a visible-field pixel claim.

Downloaded archives and verified GitHub SHA-256:

| Artifact | SHA-256 |
| --- | --- |
| Linux 12087168058 | ca04878c17ce19a429508db6d5722bf7078ea8fefa4749ff4144496d4c07368c |
| Windows 12086509804 | 202c19a43d2cce193611c923e917aae75dbbd9ed5a1a34dfaefc1cb71e2fe6e7 |
| Cross-chair Linux 12086984648 | 9208ae4c6593b7a6741aba7bd642d8825d8d2e44430aef2836fb5bcf3f8275f6 |
| Cross-chair Windows 12087218071 | 0231bfe1fbca5261e3bfdbcf07454787475c2d04357e095a543be0601630482a |

Standalone capture/installed tree 2709a4e24a803bf04ccab5abdeeebce5a14b75fc
matches executable source. Cross-chair inputs are that exact UI head and Cassy
3fab5ef500f7e321d4bab23b6dacdb87abc4a6d4; both platforms record composed tree
1af653ca4927bff8f4414dda3d9aca97df1234ee and clean-before-runtime true.
OS Contrast flags restore 126 -> 127 -> 126; installed source matches checkout.

Remaining gates are independent reviews, human Narrator observations and owner
service/release contracts. No new service/bridge/package behavior, source from
Cassy, PR merge, self-approval or issue closure. Broader advanced-product backlog
is explicitly retained in REPOSITORY_TASK_AUDIT.md and the PR description.
