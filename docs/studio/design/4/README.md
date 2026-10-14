# DEV-002 — Meridian Studio design direction review

**Owner decision recorded 2026-10-12:** **Command Workbench B — Operations** is the selected Studio direction. The original Workbench, renditions A and C, and the earlier five alternatives remain non-approved references. This selection approves the design direction for refinement; it is not evidence of implementation or of the installed or production Meridian application.

- Issue and acceptance criteria: [DEV-002 / issue #4](https://github.com/Jaxsavvy/meridian-connect-studio-build/issues/4)
- Branch: `feature/studio-ui`
- Verified Project item at work start: Chair 2 — Tyler; P1 — High; Studio UI/UX; Building
- Runtime comparison: **pending**. No current employee runtime screenshot or approved development runtime was used or verified. Per the owner's 2026-10-12 clarification, this does not block initial source-grounded concepts.
- Earlier local concepts: none were present in the supplied workspace, the cloned branch, or the user-profile search performed before editing. If shared later, they will be labeled **non-approved references** and will not be treated as the selected direction.

## Current Connect evidence studied

The proposals reuse patterns confirmed in source, kept separate from the synthetic Studio designs:

- `src/renderer/index.html`: persistent left navigation, header, project space, project-scoped language, explicit buttons and panels.
- `src/renderer/app.js` and `src/renderer/nav.js`: view switching, active navigation state, current-project navigation, and named project tabs.
- `src/renderer/project-workspace.js`: persistent project cover/slim header, searchable project switcher, keyboard-operable tabs, breadcrumbs, load/error/empty patterns, project-scoped Files/Deliverables/Storyboards.
- `src/renderer/app.css` and `src/renderer/meridian-standard.css`: Source Serif 4 editorial headings; Inter body copy; deep navy, layered blue, cyan/teal, hairline panels, restrained warm status color, visible focus expectations, and reduced-motion support.
- `src/renderer/fonts/**` and `src/renderer/assets/**`: approved local fonts and brand-art availability. Repository imagery was treated as brand material, not as proof of current employee layout.

No renderer, bridge, backend, packaging, Core, Overseer, production, or customer system was changed or accessed.

## Shared requirements across all directions

- The active project stays visible while employees move among Overview, Editor, and Asset Library.
- Every save surface distinguishes saved, unsaved, loading, empty, and error states; drafts never imply server confirmation before it occurs.
- Synthetic project: **Summit Peak Launch**. Synthetic assets and copy only.
- Minimum desktop exploration target: 1280 px wide, with layouts remaining legible at 1080 px. Long names must truncate with a title/accessible name rather than forcing controls off-screen.
- Keyboard-visible focus, semantic navigation, labeled fields, text-first state descriptions, and `prefers-reduced-motion` are part of the shared system.
- Asset selection exposes approval, version, project, intended use, and original/derivative boundaries; actual permissions and service contracts remain pending Chair 1/Cassy coordination.

## Direction comparison

| Direction | Visual concept and palette | Overview/editor/Asset Library evidence | Strengths and tradeoffs |
| --- | --- | --- | --- |
| 1 — Command Workbench | Closest to Connect: persistent left rail, compact project header, modular operational cards. Navy/royal blue with teal status and restrained gold. | [Interactive prototype](direction-1-command-workbench.html) · `renders/direction-1-overview.png` | Fastest learning curve and clearest operational scan. Familiar panels can become dense on smaller desktops; needs disciplined card limits. |
| 2 — Editorial Canvas | Minimal top suite navigation, generous typography, sequential production chapters, visual canvas and contact-sheet library. | [Interactive prototype](direction-2-editorial-canvas.html) · `renders/direction-2-overview.png` | Most premium and calm; strongest for narrative review. Less at-a-glance operational density and greater reliance on vertical space. |
| 3 — Production Rooms | Spatial workflow: Brief, Create, Asset, Review, Deliver represented as understandable rooms. Compact command bar and room rail. | [Interactive prototype](direction-3-production-rooms.html) · `renders/direction-3-overview.png` | Most approachable mental model for nontechnical employees and handoffs. “Rooms” adds new vocabulary and could feel heavy for a quick one-off edit. |
| 4 — Signal Deck | A focused technical control surface: one production signal, one live queue, compact monospaced system language. | [Interactive prototype](direction-4-signal-deck.html) · `renders/direction-4-overview.png` | Best match for the requested control-room character without returning to a multi-card dashboard. Strong operational confidence; technical terminology needs careful employee testing. |
| 5 — Project Atlas | A spatial relationship map connecting brief, creative work, asset clusters, and owner decisions. | [Interactive prototype](direction-5-project-atlas.html) · `renders/direction-5-overview.png` | Makes dependencies and handoffs unusually clear. Most distinct information model; requires thoughtful behavior once a project contains many nodes. |
| 6 — Review Theatre | The creative work dominates a large screening surface; decisions and sequence stay close but visually secondary. | [Interactive prototype](direction-6-review-theatre.html) · `renders/direction-6-overview.png` | Best balance of Editorial Canvas simplicity and greater substance. Excellent for review; less suited to broad operational management without a separate control surface. |

Each prototype includes interactive Studio navigation, persistent project context, a production overview, a representative campaign editor, Asset Library selection/actions, and empty/loading/error/unsaved state examples.

## Command Workbench refinement round

Tyler selected Direction 1 as the strongest foundation. These are structural and tonal refinements of that direction, not unrelated concepts or simple palette swaps.

| Rendition | Emphasis | Overview/editor/Asset Library evidence | Strengths and tradeoffs |
| --- | --- | --- | --- |
| Original — Command Workbench | Balanced baseline with the closest relationship to Connect's existing shell. | [Interactive prototype](direction-1-command-workbench.html) · `renders/direction-1-overview.png` | Familiar, balanced, and implementation-minded. Its modular card language can feel conventional if every workflow becomes a dashboard. |
| A — Calm | Simplified campaign command with one dominant action, three lower information bands, and more breathing room. | [Interactive prototype](direction-1a-command-workbench-calm.html) · `renders/direction-1a-overview.png` | Clearest hierarchy and closest to the restraint Tyler liked in Editorial Canvas. Shows less secondary production detail at once. |
| B — Operations | Higher-density working surface with campaign metrics, production board, asset grid, and persistent decision queue. | [Interactive prototype](direction-1b-command-workbench-ops.html) · `renders/direction-1b-overview.png` | Most informative and immediately useful for active production. Requires firm density limits and responsive prioritization. |
| C — Tactical | The Workbench information model expressed with technical telemetry, numbered phases, an asset ledger, and control-room precision. | [Interactive prototype](direction-1c-command-workbench-tactical.html) · `renders/direction-1c-overview.png` | Strongest visual personality and best control-room character. Monospaced microcopy and system terminology need employee comprehension testing. |

All three renditions preserve Studio navigation, persistent project context, Overview, a representative creative editor, Asset Library interactions, and explicit empty/loading/error/unsaved states.

## First-round owner feedback incorporated

- Keep the simplicity and restraint of Editorial Canvas, but show more useful information.
- Preserve the depth and confidence of Command Workbench while moving farther away from a conventional card dashboard.
- Explore more of Production Rooms' technical control-room character.

Directions 4–6 answer those points with three different structures, not palette variations.

## Selected direction

**Command Workbench B — Operations** is the owner-selected foundation. Preserve its information architecture: active-campaign summary, production board, recent assets, persistent decision queue, project context, and direct continuation into the current creative task. Refinement should use Calm's spacing discipline where density threatens comprehension, but must not silently merge Tactical styling or any other alternative into the approved direction.

The implementation-facing design guidance, interaction flows, component contract, state language, responsive findings, and remaining decisions are documented in [the selected-direction specification](selected-direction-b-spec.md).

## Reusable system for Cassy's asset surfaces after approval

- Tokens: navy surfaces, hairline borders, Source Serif 4/Inter type roles, royal-blue primary action, cyan active/focus, teal approved/success, restrained gold review/unsaved, coral error.
- Components: persistent project lockup, asset card/contact-sheet item, selection detail panel, collection/filter chips, approval pill, save-state badge, state card, skeleton row, retry message, and project-scoped placement action.
- Behaviors to coordinate: asset approval terminology, original/derivative version labels, cross-tool placement, long filename handling, permission-denied copy, upload/retry behavior, and what service response confirms a save.

## Accessibility and desktop checks

- Native buttons, form labels, `aria-current`, `aria-selected`, and status regions are used in the prototypes.
- Focus rings use a high-visibility light blue with offset; information is never encoded by color alone.
- Body text is generally 12–16 px on dark surfaces; final implementation must run automated and manual contrast checks against the approved token values.
- Reduced motion disables the loading shimmer. Error and unsaved states state consequence plus recovery action.
- Static widths are concept constraints, not final responsive implementation. Before approval-to-build, check 1080, 1280, 1440, and 1920 px desktop widths and keyboard traversal in an approved development runtime.

## Confirmed decisions and pending dependencies

The owner confirmed on 2026-10-12:

1. Studio is a primary Connect destination whose working surfaces become project-scoped after entry.
2. The campaign/story editor is the first Studio editor slice.
3. The selected specification's shared save, review, approval, error, original, and derivative terminology is approved for coordination with Cassy.

[DEV-005](https://github.com/Jaxsavvy/meridian-connect-studio-build/issues/8) remains open and assigned to Cassy for the Asset Library, replaceable service adapter, local Upscayl worker boundary, connector behavior, and tests. This package does not claim those dependencies are complete or production-ready. Chair 1 retains restricted service, permission, bridge/security, and final integration ownership.

**Owner decision: Direction B — Operations and all three integration choices above are confirmed.** The employee runtime comparison remains pending and unverified.
