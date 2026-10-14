# Meridian Studio visual standard

**Tyler owns the design direction.** Cassy uses the recorded shared tokens and components for Asset Library and Upscayl UI. This file is a working standard. Tyler may implement the direction within an assigned issue after recording visual evidence and coordinating shared components with Cassy.

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

## Design evidence and handoff

For an assigned design issue, Tyler prepares **2–3 distinct polished directions** based on the current Connect shell, or records why one direction is sufficient for a narrow change. Each direction includes a Studio overview, project context, a representative editor, an Asset Library surface, palette/type/component notes, and key states. Use synthetic content and place proposal artifacts under `docs/studio/design/<issue-number>/`; no empty mockup placeholders. Summarize tradeoffs in the [design review template](../templates/DESIGN_REVIEW_TEMPLATE.md).

Tyler records the selected direction and reasons in the issue, publishes tokens/components, and coordinates with Cassy before shared UI integration. Include representative screenshots and accessibility checks in the PR. A successful build alone does not prove visual quality or employee runtime behavior; record those limits for final integrated review.
