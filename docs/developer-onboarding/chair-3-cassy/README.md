# Chair 3 — Cassy and AI: creative assets

**Branch:** `feature/studio-assets` · **View:** [Chair 3 — Cassy](https://github.com/users/Jaxsavvy/projects/1/views/5) · **Prompt:** [copy Chair 3 startup prompt](STARTUP_PROMPT.md)

You own the **client-facing** Studio Asset Library, Librarian AI experience, image management, versioning, and Upscayl integration work **within approved contracts**. Read the [Studio build map](../../studio/BUILD_MAP.md) for the whole project and [DEV-005](https://github.com/Jaxsavvy/meridian-connect-studio-build/issues/8) for your current implementation scope. The storage, authorization, generation jobs, and provider process are not implemented in this Connect repository. DEV-003 supplied the contract; DEV-005 requires a working isolated Connect component and genuine Upscayl verification where prerequisites are approved. Keep originals, derivative/version links, metadata, sensible filenames, and project permissions explicit.

## First day

Follow the [safe setup](../shared/SAFE_SETUP.md) with your own GitHub account. Confirm `feature/studio-assets`, open your board view, and find an approved issue and acceptance criteria. Read [START_HERE](../../../START_HERE.md), [architecture](../shared/ARCHITECTURE.md), [file boundaries](../shared/FILE_BOUNDARIES.md), [workflow](../shared/WORKFLOW.md), the [visual standard](../shared/STUDIO_VISUAL_STANDARD.md), and any prior handoff. If there is no approved issue or design direction, ask the owner before building.

For implementation work, use the approved DEV-003 contract to build the DEV-005 client/worker portion with synthetic examples and issue-specific docs under `docs/studio/assets/<issue-number>/`. Do not claim server behavior is verified merely because the client has a button. Do not claim Upscayl integration works until an approved isolated development check verifies actual invocation, output and version handling, failure behavior, and permission boundaries with synthetic assets.

After owner approval and Tyler's selected design, build in new `src/renderer/studio-assets/**` and add only reviewed, distributable **new** files under `src/renderer/assets/**`. Coordinate any edit to `project-workspace.js`, existing assets, preload/API, or packaging with Chair 1. Do not import Core/Overseer code, install external tools in the employee app, alter production files, or use real client images.

Demonstrate original preservation, version semantics, project isolation, useful filenames, and failure recovery using synthetic fixtures or an approved development service. Report what cannot be tested without a backend. Use [Board and handoff](../shared/BOARD_AND_HANDOFF.md) for verified status updates, worklogs, tests, commits, PR links, and safe resume.
