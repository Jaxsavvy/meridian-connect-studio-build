# Rules for every AI coding agent (ChatGPT, Codex, Claude, Copilot)

Read this file at the start of every session. If anything else in the repo disagrees with it, this file and `docs/PLAN.md` win.

## What this repo is
Meridian Connect: the Electron desktop app Breakthrough Ventures employees use. We are building **Meridian Studio** inside it, following `docs/PLAN.md`. Meridian Core, Team Hub, Overseer, keys and customer data never live in this repo.

## How a session works
1. **One issue per session.** Your person tells you the issue number. Read that issue, its "Prompt for your AI" section, and `docs/PLAN.md`. If there is no assigned issue, stop and say so.
2. **Stay in your lane.** Only change the files the issue lists. If you need to touch a file outside your lane, stop and say which file and why (see Lanes).
3. **Small change.** Aim for under ~400 lines of code per PR, tests included. If it's growing past that, stop and tell your person how to split it.
4. **Explain as you go.** Your person is still learning. Before each command, say in one plain sentence what it does.
5. **Check it.** Run `node --check` on every JS file you changed and the tests the issue names. Fix failures before opening the PR.
6. **Open a PR** from a branch named `wave1/<issue-number>-<short-name>` into `main`. Fill in the PR template (3 lines + checks). Mark it draft until checks pass, then ready for review.
7. **Finish the issue cleanly.** When the PR is open and checks pass, post the 3-line update (done / next / blocked) on the issue. Don't keep polishing it.
8. **Move to the next one.** Your person may then start the next `status:ready` issue in their lane. Always branch the next issue from fresh `main`, never from your unmerged PR. Issues in a lane are written so they don't depend on each other unless the issue says "after #N". If it says "after #N" and #N isn't merged yet, pick a different ready issue or stop.
9. **Fix review comments first.** If a reviewer asked for changes on one of your open PRs, do that before starting anything new.

## Reviews and merging (so nobody waits on Jax)
- Claude reviews open PRs at least twice a day and merges the ones that pass: checks green, in-lane, under the size limit, matches the issue.
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
| Assets + Image gen | Cassy | `src/renderer/studio/assets/**`, `src/renderer/studio/tools/**`, `tools/studio/assets-*.test.cjs` |
| Core + shared | Jax (with Claude) | everything else: `src/main.js`, `src/preload.js`, `src/api.js`, `src/auth.js`, `src/renderer/app.js`, `src/renderer/index.html`, `src/renderer/studio-context.js`, `src/renderer/studio/studio-app.js`, `src/renderer/studio/studio-service.js`, `src/renderer/studio/studio.css`, `src/renderer/studio/ai/**`, `package.json`, `.github/**`, `AGENTS.md`, `docs/**` |

Shared files change only through the Core lane. If your issue needs a shared-file change, the issue will say so, or you stop and ask.

## How Studio code plugs in (don't edit these files; use them)
- Get data only from `MeridianStudio.service` (`src/renderer/studio/studio-service.js`). It runs on sample data now and will switch to the server later without your code changing. Never call `fetch` or `window.meridian` from Studio files.
- Screens: `MeridianStudio.registerScreen('home' | 'space' | 'work', { render(el, params, studio) })`.
- Tools: `MeridianStudio.registerTool('<tool-id>', { mountCanvas(el, ctx) })`.
- Panels: `MeridianStudio.registerPart('assets-strip' | 'conversation', { mount(el, ctx) })`.
- Fill a slot with `studio.mountInto(el, 'tool' | 'part', id, ctx)`; move with `studio.navigate(name, params)`; mark unsaved work with `studio.setDirty(true)`.
- `render`/`mount`/`mountCanvas` may return a cleanup function (remove listeners there).
- Each issue's files are already listed in `LANE_FILES` in `studio-app.js`, so they load automatically. Don't edit `index.html`.
- Plain JavaScript and CSS only, like the rest of the app. No new npm packages.

## Words we use
Space (Sandbox or client project), Project DNA, Asset, Tool, Tool Library, Workflow, Stage, Job, Send to, Review, Meridian Studio (the AI), Preset. See `docs/PLAN.md`. Don't invent new names for these.
