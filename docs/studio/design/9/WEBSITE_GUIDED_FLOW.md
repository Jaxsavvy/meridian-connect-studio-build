# Website guided workspace — owner UI-flow follow-up
Task: DEV-006 #9, under owner integration #11. Branch: feature/owner-studio-ui-flow.
Base: Tyler PR #34 at 8115f7de1f97876a291ef6deb38c23ba0421501d.
Stacked review target: feature/tyler-website-studio-ui.

## Problem and behavior
The Builder previously displayed brief, sitemap, section editing and preview together on a long screen. This change presents Brief → Pages → Edit → Preview, one panel at a time. Navigation never saves or discards implicitly. All steps retain the same existing project model and selected page.

The current step, next action, selected-page summary and local-save state stay visible. Preview offers desktop, tablet and phone target widths that fit the available workspace. All websites returns to the existing local website list through the dirty-work guard. Project changes and reopening a website reset the workflow to Brief.

Persistent storage and session-only fallback are labeled separately. Neither is a claim of Team Hub synchronization. Preview download still exports the selected HTML page only.

## Scope and coordination
Chair 1 posted the exact renderer scope on PR #34 before editing. Tyler's branch is untouched. Files: studio-shell.js, scoped studio-ui.css, test/verification tooling, this issue-scoped record, and a dedicated workflow. No shared app.js loader changes or Cassy asset-module changes. No dependency or packaging changes.

This remains development-only. Storyboard, media placement, review submission/approval, whole-site export, live services and employee availability are separate incomplete work. These four implemented steps are not a replacement for the full approved Studio lifecycle.

PR #35 changes the same shell and must be reconciled before any main integration. Preserve both lifecycle guards and loader sets. Cassy's #33 and the #36 contract remain independent drafts.

## Verification
- Source parses with the JavaScript engine.
- Four focused event/render harness cases passed in this session: step switching retains dirty edits; dirty All websites navigation and reopen; fallback labels and project isolation; preview device state and sandbox preservation.
- These in-process checks used a test VM shim because the session's local Windows runner could not start. Native Node execution is delegated to GitHub CI; do not describe the in-process run as a local Node test run.
- Dedicated CI runs actual Node tests, existing context/workspace regressions, and isolated synthetic Electron with screenshots for each step and 200% zoom.
- Manual screenshot, screen-reader, Windows High Contrast and installed-app checks remain pending until evidence is inspected.
- No merge, production enablement, installation or release is performed.

## Next interface work
1. Review the combined Website/Assets workspace after reconciling #34 and #35.
2. Make Studio overview project-centered: current work, continuation, pending decisions, recent files. Keep planned tools secondary.
3. Define and implement storyboard-to-page and asset-placement actions against accepted contracts.
4. Add one review/handoff experience with explicit submission, approval and export authority after DEV-011 decisions.
5. Verify keyboard flow, 200% zoom, interrupted saves, project switch/revocation and recovery across the combined workspace.

Issue and board remain open. Board sync pending; this slice does not establish DEV-006 completion or release readiness.
