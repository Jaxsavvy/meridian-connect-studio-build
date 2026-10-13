# Start here: Meridian Connect development

This public repository is the **Meridian Connect v0.2.12 employee desktop client**. Meridian Studio is the planned creative workspace inside Connect. This checkout contains client code, not Meridian Core, the Team Hub backend, Overseer, customer data, or a working Studio backend. Treat every committed file, issue, PR and comment as publicly readable.

## Choose your chair

| You are | Working branch | Development Board view | Read next | Copy this AI startup prompt |
| --- | --- | --- | --- | --- |
| Owner, Chair 1 | `feature/studio-integration` | [Owner Command](https://github.com/users/Jaxsavvy/projects/1/views/3) | [Owner package](docs/developer-onboarding/chair-1-owner/README.md) | [Chair 1 prompt](docs/developer-onboarding/chair-1-owner/STARTUP_PROMPT.md) |
| Tyler, Chair 2 | `feature/studio-ui` | [Chair 2 — Tyler](https://github.com/users/Jaxsavvy/projects/1/views/4) | [Tyler package](docs/developer-onboarding/chair-2-tyler/README.md) | [Chair 2 prompt](docs/developer-onboarding/chair-2-tyler/STARTUP_PROMPT.md) |
| Cassy, Chair 3 | `feature/studio-assets` | [Chair 3 — Cassy](https://github.com/users/Jaxsavvy/projects/1/views/5) | [Cassy package](docs/developer-onboarding/chair-3-cassy/README.md) | [Chair 3 prompt](docs/developer-onboarding/chair-3-cassy/STARTUP_PROMPT.md) |

**First day, in plain language:** Ask the owner for your own repository and Project access and an approved issue. Install Git, Node.js 24 with npm, GitHub CLI, and your chosen coding assistant on your own computer. Follow the [safe setup guide](docs/developer-onboarding/shared/SAFE_SETUP.md) to sign in, clone, check out your branch, and run source checks. Open your chair's prompt and paste its complete text into Codex or Claude Code. Let the AI guide you one step at a time; ask it to explain any command before you run it.

Before any change, your AI must find the **current GitHub issue**, its acceptance criteria, your branch, the [Studio build map](docs/studio/BUILD_MAP.md), the [collaboration rules](docs/development/COLLABORATION_RULES.md), the [architecture](docs/developer-onboarding/shared/ARCHITECTURE.md), and any prior task handoff. If no approved issue exists, ask the owner for one. Read the live issue and Project status each time; the map does not replace them.

## What to read for each question

- What exists and what is planned: [Architecture and current code](docs/developer-onboarding/shared/ARCHITECTURE.md)
- Who builds each Studio section and what remains: [Studio build map](docs/studio/BUILD_MAP.md)
- Where each chair may work: [File boundaries](docs/developer-onboarding/shared/FILE_BOUNDARIES.md)
- Login, clone, prerequisites, and first-day checks: [Safe setup](docs/developer-onboarding/shared/SAFE_SETUP.md)
- Testing, commits, pull requests, handoff, and recovery: [Daily workflow](docs/developer-onboarding/shared/WORKFLOW.md)
- Project fields and status updates: [Board and handoffs](docs/developer-onboarding/shared/BOARD_AND_HANDOFF.md)
- Studio look and design approval: [Visual design standard](docs/developer-onboarding/shared/STUDIO_VISUAL_STANDARD.md)

These guides are procedures, not technical access controls. Verify actual branch and review protections in GitHub settings; the team must follow owner review and no-direct-main rules regardless. Never paste a token, password, customer file, or private endpoint into AI chat, an issue, a handoff, or a commit.
