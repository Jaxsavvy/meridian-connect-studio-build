# Rules for every AI coding agent (ChatGPT, Codex, Claude, Copilot)

Read this file at the start of every session. If anything else in the repo disagrees with it, this file and `docs/PLAN.md` win.

## What this repo is
Meridian Connect: the Electron desktop app Breakthrough Ventures employees use. We are building **Meridian Studio** inside it, following `docs/PLAN.md`. Meridian Core, Team Hub, Overseer, keys and customer data never live in this repo.

## How a session works
1. **One issue at a time, then the next.** Work through your lane's `status:ready` issues in number order. For each one, read the issue, its "Prompt for your AI" section, and `docs/PLAN.md`. Each issue gets its own branch and its own PR. If your lane has no ready issue, say so and stop.
2. **Stay in your lane.** Only change the files the issue lists. If you think a file outside your lane needs to change, don't touch it: write which file and why in the PR's **Blocked** line, finish what you can, and keep going.
3. **Small change.** Aim for under ~400 lines of code per PR, tests included. If it's growing past that, split it yourself into two PRs (finish and open the first part, then do the rest as a second PR) and keep going.
4. **Explain as you go.** Your person is still learning. Before each command, say in one plain sentence what it does.
5. **Check it.** Run `node --check` on every JS file you changed and the tests the issue names. Fix failures before opening the PR.
6. **Open a PR** from a branch named `wave1/<issue-number>-<short-name>` into `main`. Fill in the PR template (3 lines + checks). Mark it draft until checks pass, then ready for review.
7. **Finish the issue cleanly.** When the PR is open, marked ready for review and checks pass, post the 3-line update (done / next / blocked) on the issue. Don't keep polishing it.
8. **Move straight to the next one.** Don't wait for a review or merge. Start the next `status:ready` issue in your lane right away, always on a new branch from fresh `main`, never from your unmerged PR. Issues are written so they don't depend on each other unless the issue says "Start after #N"; if #N isn't merged yet, skip that issue and take the next one.
9. **Fix review comments first.** If a reviewer asked for changes on one of your open PRs, do that before starting anything new.
10. **Work without asking for permission.** You never need Jax's approval to work on your own lane: no check-ins, no sign-offs, no waiting. Approval happens once, at review, on the PR. Only stop for the hard rules below (a secret in a diff, the wrong branch, a command that wants to reset or force-push).

## Leftover files from before the restart (handle these yourself, don't stop)
After updating to `main`, `git status` may show untracked files left on this PC from the old setup. Jax has approved moving them; your person doesn't need to do anything. If every untracked path is inside one of the locations below, move them (don't delete, don't commit) into a folder **outside** the repo, next to it: `../meridian-old-local-files/`. Keep the same subfolders. Then confirm `git status` is clean and carry on. If any untracked path is **not** on this list, stop and tell your person, as the hard rules say.
- `docs/developer-onboarding/`, `docs/development/`, `docs/studio/`
- `src/renderer/studio-ui/`, `src/renderer/studio-assets/`, `src/studio-assets/`
- `src/renderer/studio-asset-host.js`, `src/renderer/studio-dev-asset-mount.js`, `src/renderer/studio-dev-asset-transport.js`
- `tools/board-sync/`, `tools/website-builder/`
- old files in `tools/studio-context/` that aren't on `main` (for example `asset-v1-contract*`, `compose-runtime*`, `asset-host.test.cjs`, `dev-asset-*.test.cjs`)
- `WEBSITE_STUDIO_*.md` in the repo root, and `.github/workflows/` files that aren't on `main`

All of these are saved in the `archive/2026-10-18/*` tags, so moving them loses nothing.

## Reviews and merging (so nobody waits on Jax)
- Claude reviews open PRs twice a day (about 11am and 6pm Pacific) and merges only finalized PRs: marked ready for review (not draft), checks green, only the issue's files changed, matches the issue's "Done when", 3-line update posted. Anything else gets review comments, and the author fixes them before starting anything new.
- Tyler and Cassy may review each other's PRs too; a teammate approval plus green checks is enough to merge in-lane work.
- Only these need Jax: anything in the Core lane or shared files, anything a client will see, new paid tools or spending, and marking a wave complete.

## Hard rules
- Never push to `main`. Never force-push. Never merge your own PR.
- No evidence documents, handoff files, audit reports, screenshots folders or long write-ups in the repo. Evidence goes in the PR description, short.
- Never add secrets, API keys, tokens, `.env` files, personal paths (`C:\Users\...`), logs, databases, installers or customer data.
- No paid APIs or live customer systems in tests. Use small synthetic data.
- Never trust anything from the renderer (project IDs, file paths, URLs). The server checks identity and permissions on every request.
- Keep `package.json` `build.files` narrow; don't ship dev-only code.
- If something looks wrong (wrong branch, unexpected files, a secret in a diff), stop and tell your person. Don't try to fix git history yourself.

## Lanes (who changes what)
| Lane | Owner | Files |
|---|---|---|
| Studio screens | Tyler | `src/renderer/studio/screens/**`, `tools/studio/screens-*.test.cjs` |
| Pitch deck tools | Tyler | `src/renderer/studio/tools/pitch-deck/**` (home page builder, board template, print card), `tools/studio/pitchdeck-*.test.cjs` |
| Assets + Image gen | Cassy | `src/renderer/studio/assets/**`, `src/renderer/studio/tools/**` (except `tools/pitch-deck/**`), `tools/studio/assets-*.test.cjs` |
| Core + shared | Jax (with Claude) | everything else: `src/main.js`, `src/preload.js`, `src/api.js`, `src/auth.js`, `src/renderer/app.js`, `src/renderer/index.html`, `src/renderer/studio-context.js`, `src/renderer/studio/studio-app.js`, `src/renderer/studio/studio-service.js`, `src/renderer/studio/studio.css`, `src/renderer/studio/ai/**`, `package.json`, `.github/**`, `AGENTS.md`, `docs/**` |

Shared files change only through the Core lane. If your issue needs a shared-file change, the issue will say so, or you stop and ask.

## How Studio code plugs in (don't edit these files; use them)
- Get data only from `MeridianStudio.service` (`src/renderer/studio/studio-service.js`). It runs on sample data now and will switch to the server later without your code changing. Never call `fetch` or `window.meridian` from Studio files.
- Screens: `MeridianStudio.registerScreen('home' | 'space' | 'work' | 'workflow' | 'job', { render(el, params, studio) })`.
- Tools: `MeridianStudio.registerTool('<tool-id>', { mountCanvas(el, ctx) })`.
- Panels: `MeridianStudio.registerPart('assets-strip' | 'conversation' | 'stage-bar' | 'version-history', { mount(el, ctx) })`.
- Workflows, Jobs, Review and versions come from the service too: `getWorkflow`, `startJob`, `getJob`, `listJobs`, `listJobAssets`, `completeStage`, `sendToReview`, `listReview`, `saveVersion`, `listVersions`, `copyToSpace`, plus stage work: `getStageNotes`/`saveStageNotes` (Brief, Plan, Storyboard), `setStageNeed` (the "This stage needs" checklist) and `draftCopy` (Meridian proposes copy; nothing saves until the person accepts). In sample mode `approveStage` and `approveAsset` stand in for Jax so you can test the whole path; never show those buttons to employees.
- Fill a slot with `studio.mountInto(el, 'tool' | 'part', id, ctx)`; move with `studio.navigate(name, params)`; mark unsaved work with `studio.setDirty(true)`.
- `render`/`mount`/`mountCanvas` may return a cleanup function (remove listeners there).
- Each issue's files are already listed in `LANE_FILES` in `studio-app.js`, so they load automatically. Don't edit `index.html`.
- Plain JavaScript and CSS only, like the rest of the app. No new npm packages.

## Words we use
Space (Sandbox or client project), Project DNA, Asset, Tool, Tool Library, Workflow, Stage, Job, Send to, Review, Meridian Studio (the AI), Preset. See `docs/PLAN.md`. Don't invent new names for these.
