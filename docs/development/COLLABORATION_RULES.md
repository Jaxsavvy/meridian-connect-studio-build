# Meridian Connect collaboration rules

These rules apply to this private GitHub Free repository. They are team procedures. GitHub does not enforce branch protection or required owner review for this private repository on the current plan. Every collaborator with write access must follow them.

## Chairs and branches

| Chair | Responsibility | Working branch |
| --- | --- | --- |
| Chair 1 — Owner + Codex | Architecture, integration, API contracts, security review, and final merge decisions | `feature/studio-integration` |
| Chair 2 — Tyler + AI | Meridian Studio renderer layout, navigation, and editor UI within an owner-approved task | `feature/studio-ui` |
| Chair 3 — Cassy + AI | Approved Studio images, icons, fonts, and asset integration within an owner-approved task | `feature/studio-assets` |

Confirm the current branch and assigned task before editing. Ask the owner before changing another chair's scope or shared files. Keep changes small and reviewable. Do not use the production Meridian checkout as a development workspace.

## Integration procedure

1. Never push directly to `main`. Never force-push or rewrite shared branch history.
2. Push work only to the assigned feature branch and open a pull request to `main` using the repository template.
3. Report the task number, changed files, checks, screenshots when relevant, known issues, and AI session handoff in the pull request.
4. The owner reviews the exact diff and check results, requests corrections if needed, and explicitly approves before integration. Only the owner merges to `main`.
5. Treat a green CI result as a narrow source check. It does not establish runtime behavior, security, design quality, or permission correctness.

These are procedural safeguards. A collaborator with write access may still be technically able to bypass them on this GitHub plan.

## Repository boundary

Allowed, when required by an approved Connect task: `src/` client code and approved renderer assets, `assets/meridian.ico`, `build/installer.nsh`, safe defaults in `config/settings.json`, `package.json`, `package-lock.json`, `.gitignore`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `.github/` collaboration files, and `docs/development/` documentation. Review additions to Electron's `build.files` allowlist before packaging.

Never commit credentials, API keys, tokens, `.env` files, private endpoints, personal configuration, private client files, customer screenshots, live databases, logs, backups, dependency folders, caches, installers, compiled builds, or owner-only assets. Meridian Core, Team Hub backend, and Overseer code or data belong outside this repository. Do not change or deploy Meridian Core or Overseer from Connect work. Do not deploy or publish any production application as an employee task.

Use synthetic development data and approved development services. Keep backend changes and permission decisions with their restricted service owners; document the required contract in a Connect pull request without copying restricted implementation into this repository.

## Progress and mistakes

Post a short progress update in the task or pull request when a milestone is complete, when a dependency is blocked, and before handoff. Include the branch, task number, current state, checks run, and next action. An AI assistant's handoff must state what it changed and what remains unverified; never paste secrets or customer content into the handoff.

If work lands on the wrong branch or an unexpected file is staged, stop and tell the owner before pushing. Inspect the exact diff and staged file list; correct the local mistake without rewriting shared history. If sensitive material was committed or pushed, stop further sharing, notify the owner immediately, and treat the material as exposed. The owner coordinates credential rotation, access response, and repository cleanup. Do not attempt an unsupervised force-push or history rewrite. The owner keeps the verified Git bundle backup outside this repository for recovery.
