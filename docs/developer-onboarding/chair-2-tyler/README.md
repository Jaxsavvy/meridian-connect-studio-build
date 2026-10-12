# Chair 2 — Tyler and AI: Studio UI/UX

**Branch:** `feature/studio-ui` · **View:** [Chair 2 — Tyler](https://github.com/users/Jaxsavvy/projects/1/views/4) · **Prompt:** [copy Chair 2 startup prompt](STARTUP_PROMPT.md)

You own Studio design exploration, navigation, layouts, and reusable renderer components. First study real current Connect screens in an approved development build or owner-provided screenshots, as well as the renderer source and [shared visual standard](../shared/STUDIO_VISUAL_STANDARD.md). If visual access is unavailable, mark the design review blocked and ask the owner for approved references; source and CSS alone are insufficient. The goal is a premium, calm creative workspace: navy, slate, layered blue, teal, restrained accents, clear project context, and polished editors. Avoid a generic AI dashboard, clutter, and excessive purple.

## First day

Follow the [safe setup](../shared/SAFE_SETUP.md) with your own GitHub account. Confirm `feature/studio-ui`, open your board view, and find the owner-approved issue and acceptance criteria. Read [START_HERE](../../../START_HERE.md), [architecture](../shared/ARCHITECTURE.md), [file boundaries](../shared/FILE_BOUNDARIES.md), [workflow](../shared/WORKFLOW.md), and any prior handoff. If there is no approved issue or no private-repository access, stop and ask the owner. Do not use another chair's branch or credentials.

For an approved design issue, make **2–3 polished design directions** using synthetic content and save issue-specific proposals under `docs/studio/design/<issue-number>/`. Include overview, navigation, project selector, a creative editor, Asset Library, and empty/loading/error states. Use the [design review template](../templates/DESIGN_REVIEW_TEMPLATE.md) to request an owner choice. Do not begin broad interface implementation until the owner records approval.

After approval, use the specific renderer files assigned in the issue. Your default implementation area is `src/renderer/index.html`, `app.css`, `meridian-standard.css`, `app.js`, `project-workspace.js`, and new `src/renderer/studio-ui/**`. These existing files are shared; Chair 1 coordinates edits with Cassy. Do not edit Electron main/preload, API/auth, packaging, backend services, Core, or Overseer without a new owner assignment. Never add customer assets.

Show visual evidence and real UI states in your PR. Run safe source checks; record which design and runtime checks were not possible. Use [Board and handoff](../shared/BOARD_AND_HANDOFF.md) for verified progress, tests, commits, PR links, and a resume note.
