# Meridian Studio build map

This is the shared scope map for the Meridian Studio work inside Meridian Connect. It tells each chair what to build, what to hand off, and what still needs an approved issue. **The linked GitHub issue is the authority for the current task's exact files and acceptance criteria.** This map does not authorize work outside an issue or make a planned integration operational.

Start with [START_HERE](../../START_HERE.md), [collaboration rules](../development/COLLABORATION_RULES.md), the matching [chair package](../developer-onboarding/), and the current issue. The repository is public; use synthetic examples and publish no credentials, customer material, private service code, owner-only assets, internal endpoints, or production data. Meridian Core and the Team Hub backend stay in restricted owner-controlled locations. Overseer and Langflow development are outside Studio scope.

## 1. The delivery sequence

1. **Foundation and design:** Chair 1 establishes authenticated project context and honest tool availability in [DEV-004](https://github.com/Jaxsavvy/meridian-connect-studio-build/issues/7). Tyler completes [DEV-002](https://github.com/Jaxsavvy/meridian-connect-studio-build/issues/4) and obtains an owner-recorded design decision. Cassy's [DEV-003](https://github.com/Jaxsavvy/meridian-connect-studio-build/issues/5) architecture is reference material, not a finished feature.
2. **Employee-owned builds:** Tyler implements the Connect Studio shell and creative workspace in [DEV-006](https://github.com/Jaxsavvy/meridian-connect-studio-build/issues/9). Cassy implements the Connect Asset Library, Librarian client, and Upscayl component in [DEV-005](https://github.com/Jaxsavvy/meridian-connect-studio-build/issues/8). They use separate branches, synthetic fixtures, tests, and PRs. A mock adapter must be labeled as such.
3. **Owner integration:** [DEV-007](https://github.com/Jaxsavvy/meridian-connect-studio-build/issues/11) tracks Chair 1's full integration obligation. Chair 1 approves shared interfaces, implements or coordinates the restricted service contracts, connects accepted client components, reviews every permission and project boundary, verifies real behavior in an isolated development environment, and decides which tools may become available. This is further work beyond DEV-004; split it into small owner issues with acceptance gates before implementation.
4. **Release:** Chair 1 reviews packaging, data handling, cost controls, rollback, and end-to-end evidence before any installation or deployment. A merged PR or green CI check alone does not mean Studio is ready for employees.

The first complete workflow to verify is **approved project brief → storyboard → image creation → feedback → approved asset → export**. Each step must preserve project identity, source references, save state and review history. Video, websites, audio and deeper desktop-tool exchange extend that foundation after their own contracts and tests.

## 2. Chair ownership and handoffs

| Chair | Owns in this repository | Must deliver | Does not own |
| --- | --- | --- | --- |
| **1 — Owner + Codex** (`feature/studio-integration`) | Shared Connect architecture, project context, desktop bridge/API integration, restricted-service contracts, security, packaging, cross-chair integration, release decisions | Contract decisions, reviewed integrations, permission tests, build/package evidence, rollback and final acceptance | Employee branch implementation without coordination; public copies of Core, Team Hub backend, Overseer, secrets or client records |
| **2 — Tyler + AI** (`feature/studio-ui`) | Approved visual system, Studio navigation, overview, editor shell, reusable renderer components, all nine tool entry surfaces | Owner-approved design; runnable Connect UI with clear save, job and review states; accessible screenshots, tests, PR and handoff | Claiming unconnected tools work; backend services, permissions, Core, provider execution or final merge |
| **3 — Cassy + AI** (`feature/studio-assets`) | Connect Asset Library and Librarian client, metadata/search/version experience, Upscayl client/worker boundary | Runnable isolated component, original/derivative lineage, synthetic boundary tests, real isolated Upscayl evidence where prerequisites are approved, PR and handoff | Authoritative server storage, project membership decisions, restricted backend, unreviewed executable/model packaging or final merge |

Chair 1 gives Tyler and Cassy an approved interface for shared project context, service adapters and component slots. Tyler publishes approved design tokens and component behavior for Cassy's surfaces. Cassy publishes asset adapter/IPC requirements for Chair 1. Any shared renderer, preload, main process, API client or packaging edit needs exact file coordination before either employee changes it.

## 3. Studio sections and functional coverage

The nine entries may appear in Tyler's shell with honest **Planned**, **Unavailable**, or verified **Available** states. An entry is not a working tool until its authorized service or local process, persistence, failure handling, and end-to-end tests pass. Each tool must use the selected project's permitted context; project selection in the renderer is never authorization.

| Section | Tyler's Connect work | Cassy's Connect work | Chair 1 integration and remaining gate |
| --- | --- | --- | --- |
| ChatGPT Images | Image workspace, prompt/reference/review states | Save generated or imported image as an asset with lineage | Approved replaceable provider, authenticated generation job, cost permission, source handling, review and save contract |
| Storyboard | Reuse and refine existing storyboard editor and navigation | Authorized image/clip references, exports and asset links | Verify existing create/edit/save/reopen/review routes and their project permissions end to end; repair gaps in restricted service |
| Higgsfield Video Studio | Video planning/editor and job/review states | Source clips, outputs, versions and metadata | Approved provider contract, spend approval, asynchronous jobs, failures, download rights and review |
| Blender | Project-aware 3D workspace entry and handoff | Import/export of approved 3D assets and previews | Safe local launch/file exchange, installed-tool prerequisite and file permissions; no bundled binary by default |
| Krita | Project-aware artwork workspace entry and handoff | Import/export of editable artwork and previews | Safe local launch/file exchange, installed-tool prerequisite and file permissions |
| Upscayl | Entry and status within the Studio shell | Enhancement UI, local worker boundary, separate derivative and tests | Approve executable/model/license/device, process invocation and packaging; verify real synthetic run before Available |
| Website Builder | Site workspace, draft/review/publish states | Approved media assets and export links | Builder/provider contract, project permissions, preview and explicit publishing approval |
| Audio Studio | Audio workspace, edit/job/review states | Audio assets, metadata, versions and exports | Approved capture/generation/processing contract, permissions, cost and file handling |
| Studio Files | File browser and handoff from each tool | Asset Library, search, metadata, versions and lineage | Authoritative original storage, uploads/downloads, revisions, review, retention and server-side access checks |

Tyler's DEV-006 builds the **interfaces** for all nine entries. Cassy's DEV-005 builds the **asset and Upscayl Connect portion**. The remaining functional integrations above are **not assigned as completed builds** by those two issues. Chair 1 tracks them under DEV-007 and creates smaller owner-owned implementation issues after contracts, provider choices and permissions are approved; do not silently expand DEV-004.

## 4. Shared platform requirements owned by Chair 1

- **Identity and isolation:** Authenticate every request; verify employee membership and operation-specific permission on the server. Recheck on project switch, revocation, download, review and job result. Keep owner-only context out of employee AI requests.
- **Project context:** Use the existing Connect project source of truth. Reject unknown IDs, stale responses and late writes after switch or sign-out. Treat Playgrounds as a separately permissioned context if approved; never let a Playground bypass project or employee boundaries. Do not create a duplicate project database.
- **Creative records and files:** Define immutable asset IDs, original/derivative links, revisions, metadata, review states, storage location, upload/download contract, and authorized file references. Preserve originals.
- **Save and resume:** Persist drafts and editor state through an approved service contract. Signal unsaved work before switching or leaving; confirm saves from the service. Recover interrupted jobs and drafts without cross-project leakage.
- **Jobs, providers and spending:** Use replaceable adapters. Record queue/running/failed/cancelled/completed states, idempotency, retries, limits, approved costs and review before spend or publish. Never make an unavailable provider appear live.
- **Desktop boundaries:** Keep renderer, preload, main process and API permissions narrow. Validate paths and file types; isolate local tools and child processes. Review packaged inputs and licenses before distribution.
- **Release quality:** Run meaningful component, contract, permission, accessibility, isolated package and end-to-end tests using synthetic accounts and assets. Record unverified live behavior separately. Keep a rollback and backup plan for any approved release.

## 5. What “done” means

| Stage | Evidence | Who accepts it |
| --- | --- | --- |
| Design accepted | Current Connect reference, selected design direction and shared tokens recorded in DEV-002 | Owner |
| Employee component accepted | Runnable isolated Connect build, exact diff, synthetic tests, screenshots/demo, dependency list, PR and persistent handoff for DEV-005 or DEV-006 | Owner after code and visual review |
| Integrated feature accepted | Real authorized service/local process, persisted records, permission and project-switch tests, failure recovery and package verification | Owner after end-to-end review |
| Release accepted | Security/privacy review, provider and spending approvals, deployment and rollback plan, production authorization | Owner separately |

Do not mark an implementation issue Complete for a document, visual concept, mock success, or an untested provider call. Automatic board synchronization is [DEV-001](https://github.com/Jaxsavvy/meridian-connect-studio-build/issues/3) work and is not assumed operational.

## 6. How each AI resumes

Use the existing [Chair 1](../developer-onboarding/chair-1-owner/STARTUP_PROMPT.md), [Chair 2](../developer-onboarding/chair-2-tyler/STARTUP_PROMPT.md), or [Chair 3](../developer-onboarding/chair-3-cassy/STARTUP_PROMPT.md) startup prompt. No replacement prompt is needed. The AI must then read this map, its **current** issue, the issue comments, the matching chair package, collaboration rules and latest task handoff. It should verify the branch, remote and working tree before editing, record the next safe action and blockers, and never self-approve completion. When this map and an issue differ, pause and ask Chair 1 to reconcile the scope before code changes.
