# File ownership and prohibited material

The **assigned issue and its documented file list** are the scope for a task. The paths below are each chair's default area. Coordinate shared files or cross-chair scope with affected chairs in the issue or PR before editing; escalate unresolved conflicts to Chair 1. Restricted service and release boundaries remain in the collaboration rules. All work stays in a separate development clone and an assigned feature or task branch.

| Chair | Default files and directories | Shared or gated files |
| --- | --- | --- |
| Chair 1 — Owner | `START_HERE.md`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/**`, `.github/**`, and approved Connect files under `src/**`, `assets/**`, `build/**`, `config/settings.json`, `package.json`, `package-lock.json` | Owner coordinates edits to all client bridge, authentication, packaging, and shared renderer files. |
| Chair 2 — Tyler | `docs/developer-onboarding/chair-2-tyler/**`; issue-specific design files under `docs/studio/design/<issue-number>/**`; within assigned implementation issues: `src/renderer/index.html`, `src/renderer/app.css`, `src/renderer/meridian-standard.css`, `src/renderer/app.js`, `src/renderer/project-workspace.js`, and new `src/renderer/studio-ui/**` | Existing renderer files are shared. Coordinate the exact files with Chair 1 and Cassy before editing. Bridge, auth, API, and packaging changes need Chair 1 coordination and their applicable restricted review. |
| Chair 3 — Cassy | `docs/developer-onboarding/chair-3-cassy/**`; issue-specific contracts and prototypes under `docs/studio/assets/<issue-number>/**`; within assigned implementation issues: new `src/renderer/studio-assets/**` and reviewed **new** distributable files in `src/renderer/assets/**` | Coordinate edits to `src/renderer/project-workspace.js`, existing renderer assets, bridge/API files, Electron packaging, and external-tool integration with Chair 1. Do not implement backend storage or Core logic here. |

The `docs/studio/design/`, `docs/studio/assets/`, `docs/development/handoffs/`, `src/renderer/studio-ui/`, and `src/renderer/studio-assets/` directories are **future, task-created paths**; they do not exist in this baseline. Create only the path needed for an assigned issue. `<issue-number>` and `<number>` are placeholders for a real GitHub issue number.

Task-specific handoffs go in `docs/development/handoffs/ISSUE-<number>-chair-<number>.md` **only after a real issue exists**. Copy the [handoff template](../templates/TASK_HANDOFF_TEMPLATE.md), replace its prompts, and review for private data before committing. Issue comments and the pull request remain the live progress record.

## Never put these in this repository

Meridian Core, Team Hub backend, Overseer, Langflow work, owner-only assets, private endpoints, secrets, tokens, credentials, `.env` files, personal settings, live databases, customer files or screenshots, logs, backups, installers, compiled builds, caches, dependencies, or downloaded model weights. Do not modify production services or the working Meridian installation. Use synthetic examples and reviewed, license-safe design assets.

The repository's `.gitignore` and packaging allowlist are checks, not proof that a file is safe. Before a commit, inspect `git status --short`, `git diff --check`, `git diff --cached --name-only`, and the exact staged diff. Stop if a path or content is unexpected. Do not copy restricted code into a handoff or prompt.
