# Website Studio verification report

Updated: 2026-10-14 PDT.

## Automated coverage

The Website Builder suite covers restart persistence, project isolation, backup recovery, failed-save retention, undo/redo, unique sitemap slugs, safe rendering, multi-page static export, and development-gated loading. Existing Studio/context/Asset suites remain part of the relevant regression run.

Final milestone result: **92/92 relevant Node tests passed**. The focused Website Builder subset passed **11/11**. JavaScript syntax checks and `git diff --check` passed.

## Manual and build verification

- Source syntax: passed for the changed JavaScript and Electron evidence harness.
- Focused Website Builder tests: passed, 11/11.
- Full relevant Node tests: passed, 92/92. The first sandboxed run produced 10 environment-permission failures in existing temp-directory suites; the required unrestricted rerun passed the full suite.
- Electron development runtime: passed in the repository's isolated, hidden BrowserWindow harness. This is the real renderer with synthetic Connect fixtures, not a distributed employee installation.
- Create/edit/save/reload/reopen: passed. One saved project reopened with its audience and two-page sitemap intact after a renderer reload.
- Unsaved navigation protection: passed. Leaving Studio with a dirty website project opens a website-specific dialog with keep, discard, and save choices.
- Preview: passed. It used the edited project content, carried an empty sandbox attribute, and shared the export renderer.
- Accessibility source/runtime metrics: zero unlabeled Website Builder form controls; preview has a title; focus styling and semantic labels reuse the Studio system.
- Visual inspection: passed for editor, lower generated-page preview, reopened project, and 200% zoom captures. At 200% the local navigation wraps and the document, workspace, and main builder fit horizontally.
- Windows packaging: unsigned NSIS build succeeded and produced `Meridian-Connect-Setup-0.2.12.exe`; generated distribution files remain ignored and are not committed.
- Installer execution: not performed. A built installer is not treated as an installed-app verification.
- Screen reader and Windows High Contrast: unverified.
- Backend, AI provider, permissions, and deployment: not available in this repository.

## Runtime evidence

`docs/studio/design/9/renders/runtime-results.json` records the metrics. Website Builder captures are `website-builder-editor-1440x1000.png`, `website-builder-preview-1440x1000.png`, `website-builder-reopened-1440x1000.png`, and `website-builder-1280x900-200pct.png`.
