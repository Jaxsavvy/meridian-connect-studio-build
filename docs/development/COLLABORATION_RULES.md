# Meridian Connect collaboration rules

These rules apply to this private GitHub Free repository. They are team procedures. GitHub does not enforce branch protection or required owner review for this private repository on the current plan. Every collaborator with write access must follow them.

## Chairs and branches

| Chair | Responsibility | Working branch |
| --- | --- | --- |
| Chair 1 — Owner + Codex | Architecture, integration, API contracts, security review, and final release decisions | `feature/studio-integration` |
| Chair 2 — Tyler + AI | Studio design direction, renderer layout, navigation, editor UI, and reusable visual components within an assigned task | `feature/studio-ui` |
| Chair 3 — Cassy + AI | Studio Asset Library and Librarian client experience, creative assets, versioning contracts, and Upscayl integration prototypes within an assigned task | `feature/studio-assets` |

Confirm the current branch and assigned task before editing. Coordinate shared files and cross-chair scope with the affected chair in the issue or PR before editing; escalate unresolved conflicts to Chair 1. Keep changes small and reviewable. Do not use the production Meridian checkout as a development workspace.

Start at `START_HERE.md` for chair-specific file boundaries and prompts. Tyler records a polished design direction with visual evidence and shares its tokens/components with Cassy; implementation may proceed within the assigned issue without a separate owner choice. Cassy begins with contracts or isolated prototypes and aligns her UI with the recorded shared design system. Neither chair should implement a backend service, live generation, or external-tool packaging from an unverified client concept.

## Integration procedure

1. Never push directly to `main`. Never force-push or rewrite shared branch history.
2. Push work to the assigned feature branch and open a pull request to `main` using the repository template. Use a task branch if the assigned branch is shared or already has unrelated changes.
3. Report the task number, changed files, checks, screenshots when relevant, known issues, and AI session handoff in the pull request.
4. The assigned chair reviews the exact diff, check results, scope, and known limits. After checks pass and the PR records acceptance evidence, a collaborator with repository write access may merge the scoped PR without waiting for owner approval. Resolve conflicts and required reviews before merging. Do not self-approve on GitHub or bypass repository rules.
5. Treat a green CI result as a narrow source check. It does not establish runtime behavior, security, design quality, or permission correctness.

These are procedural safeguards. A collaborator with write access may still be technically able to bypass them on this GitHub plan. Historical issue handoffs retain their original approval language as records; this current policy governs new work.

## Decisions that remain with the owner

The owner reviews the integrated Studio before release. Obtain an explicit owner decision before production deployment or publication, paid provider use or a spending commitment, use of customer data, changes to security or permission policy, new backend/API authority, or distributing a new executable, model, or third-party asset with unresolved license or packaging terms. A PR for client UI, synthetic fixtures, or a proposed contract may proceed while these dependencies are clearly labeled unverified. GitHub permissions and required platform reviews still apply.

## Repository boundary

Allowed, when required by an approved Connect task: `src/` client code and approved renderer assets, `assets/meridian.ico`, `build/installer.nsh`, safe defaults in `config/settings.json`, `package.json`, `package-lock.json`, `.gitignore`, `README.md`, `START_HERE.md`, `AGENTS.md`, `CLAUDE.md`, `.github/` collaboration files, and documentation under `docs/development/`, `docs/developer-onboarding/`, or `docs/studio/`. Review additions to Electron's `build.files` allowlist before packaging.

Never commit credentials, API keys, tokens, `.env` files, private endpoints, personal configuration, private client files, customer screenshots, live databases, logs, backups, dependency folders, caches, installers, compiled builds, or owner-only assets. Meridian Core, Team Hub backend, and Overseer code or data belong outside this repository. Do not change or deploy Meridian Core or Overseer from Connect work. Do not deploy or publish any production application as an employee task.

Use synthetic development data and approved development services. Keep backend changes and permission decisions with their restricted service owners; document the required contract in a Connect pull request without copying restricted implementation into this repository.

The Development Command Board uses Chair, Status, Priority, and Module fields. Record verified task updates and handoffs using `docs/developer-onboarding/shared/BOARD_AND_HANDOFF.md`. The assigned chair may move Review → Testing → Complete after recording acceptance evidence and reading back each saved status. Complete means that issue's stated criteria were met; it does not mean Studio is released or its unverified dependencies are resolved. Automatic board synchronization remains a future integration until implemented and tested.

## Progress and mistakes

Post a short progress update in the task or pull request when a milestone is complete, when a dependency is blocked, and before handoff. Include the branch, task number, current state, checks run, and next action. An AI assistant's handoff must state what it changed and what remains unverified; never paste secrets or customer content into the handoff.

If work lands on the wrong branch or an unexpected file is staged, stop and tell the owner before pushing. Inspect the exact diff and staged file list; correct the local mistake without rewriting shared history. If sensitive material was committed or pushed, stop further sharing, notify the owner immediately, and treat the material as exposed. The owner coordinates credential rotation, access response, and repository cleanup. Do not attempt an unsupervised force-push or history rewrite. The owner keeps the verified Git bundle backup outside this repository for recovery.
