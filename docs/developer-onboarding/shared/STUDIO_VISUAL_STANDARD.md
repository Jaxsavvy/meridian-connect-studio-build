# Meridian Studio visual standard

**Tyler owns the design direction.** Cassy uses the owner-approved tokens and components for Asset Library and Upscayl UI. This file is a working standard, not approval of a specific Studio screen. The owner must approve one of Tyler's 2–3 polished directions before broad implementation.

## Design source

Study Connect's actual renderer before drawing Studio: `src/renderer/index.html`, `app.css`, `meridian-standard.css`, `project-workspace.js`, and existing fonts and images under `src/renderer/`. The active standard stylesheet is loaded after `app.css` and defines Source Serif 4 editorial headings, Inter body type, deep navy surfaces, layered blue accents, restrained cyan/teal signals, and hairline structure. Use those files as the baseline; do not copy an unrelated dashboard template.

## Studio design rules

- Make project context, current tool, file location, save state, and review state legible at a glance. A nontechnical employee should know where work will be saved.
- Use spacious editor layouts, strong hierarchy, readable body copy, calm panels, and a clear primary action. Keep navigation consistent with Connect's existing project workspace.
- Use navy, slate, layered royal and sky blues, teal, and refined gray as the main palette. Reserve warm gold for rare emphasis. Keep purple limited and purposeful; avoid a generic AI dashboard, visual clutter, neon, excessive blur, and ornamental controls.
- Prefer shared spacing, typography, focus, field, card, toolbar, empty-state, and status tokens. New Studio components should be reusable across Tyler's UI and Cassy's asset surfaces.
- Show loading, empty, offline, permission-denied, pending-review, failed-generation, and unsaved-work states. Never imply a draft is saved until the service confirms it.
- Use local approved fonts and license-safe assets. Do not introduce customer imagery, owner-only files, externally hosted design dependencies, or large bundled binaries without approval.
- Check keyboard focus, text contrast, labels, responsive desktop widths, and long project/file names. A pleasing static mockup is only one part of acceptance.

## Design approval gate

For an approved design issue, Tyler prepares **2–3 distinct polished directions** based on the current Connect shell. Each direction includes a Studio overview, project context, a representative editor, an Asset Library surface, palette/type/component notes, and key states. Use synthetic content and place reviewed proposal artifacts under `docs/studio/design/<issue-number>/`; no empty mockup placeholders. Summarize tradeoffs in the [design review template](../templates/DESIGN_REVIEW_TEMPLATE.md).

The owner picks or revises a direction and records approval in the issue. Then Tyler publishes approved tokens/components and Cassy aligns the asset UI. Until that decision, both chairs may do contracts and isolated prototypes but must not start broad interface integration. A successful build does not prove the visual design was accepted.
