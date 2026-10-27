# Meridian Studio plan

Approved by Jax, Oct 2026. This is the single plan. If an issue, comment or old doc disagrees, this file wins; ask before guessing.

## The idea in one paragraph
Studio is where Cassy and Tyler make client work. You pick a **Space** (your Sandbox, the team Sandbox, or a client project), then either **open a tool** (Image gen, Video, Storyboard...) or **start a guided workflow** (Website, Ad campaign...). You mostly work by talking to **Meridian Studio**, the AI, which runs the tools for you and shows exactly what settings it used. Everything you make is saved to the Space's assets and can be **sent to** another tool or to Review.

## Building blocks
| Block | Meaning |
|---|---|
| Space | Sandbox (personal or team) or a client project. Everything lives in one. |
| Project DNA | A client's brief, brand colors, fonts, voice, audience, logo. Every tool reads it. Jax approves it. |
| Asset | Anything made or uploaded. Originals never change; each edit is a new version linked to its parent. |
| Tool | One ability (Image gen, Video...). Works the same standalone or inside a workflow. |
| Tool Library | The approved list of tools. Jax approves additions. |
| Workflow | A guided path: ordered stages with preloaded tools. |
| Stage | One step: goal, tools, "this stage needs" checklist, quality check, who approves. |
| Job | One workflow run for one client (e.g. "Website v2"). Maps to Meridian's existing project Jobs. |
| Send to | Hands an asset to another tool, stage, or Review. |
| Review | Approval queue (existing Deliverables flow). Jax approves anything a client will see. |
| Meridian Studio | The AI in creative mode: the main way people work. Sees DNA, stage, assets; runs tools. |
| Router + log | On the cloud server: holds API keys, picks the model per tool, logs every action, enforces budgets. |
| Preset | A recipe for one kind of task (e.g. "Website hero image"). Made by Jax + Overseer only. |

## Screens
1. **Studio home**: Space switcher (Sandbox + assigned client projects), "Continue where you left off".
2. **Space home**: Project DNA card, active Jobs with progress, recent assets, two rows of tiles: "Start a workflow" and "Open a tool". Unfinished tools/workflows show honestly as "Coming soon".
3. **Work view** (one frame for everything): canvas on the left (results, compare A/B, "settings Meridian used" drawer); Meridian Studio conversation on the right; stage bar on top only inside a workflow; assets strip along the bottom (drag any asset into any tool).

Every screen handles: loading, empty, offline, no access, failed, unsaved changes. Keyboard works; 200% zoom works.

## Rules that never bend
- Employees never see costs. Budgets are enforced on the server; over budget shows "waiting on Jax".
- API keys live only on the server. Never in Connect, never in this repo.
- One client's DNA or assets are never used in another client's Space.
- Meridian Studio proposes, shows a preview, and applies only when the person says yes. It never publishes, sends to a client, deletes approved work, or mentions money.
- Retries are safe: a retried generation never charges twice.
- Unkept generated images auto-delete after 14 days; deleted kept items sit in a 30-day trash; only Jax deletes approved work.

## Image gen (Wave 1 tool)
The person describes the image in their own words. Meridian picks the preset, asks only what's missing, suggests a sharper description, and generates after the person confirms. It checks results against the preset and brand, retries weak ones (max 3 rounds), then shows the best with notes. Per result: Keep, Variations, Edit part, Send to. OpenAI images via the server router. Starter presets: Website hero, Page header, Service in action, Before/after, Team/crew portrait, Clean product shot, Social promo, Ad creative, Seasonal promo.

## Website workflow (Wave 2)
One pipeline for every site, design first (Website Build Pipeline: One System, 2026-10-27; #186). Tiers: Standard or Cinematic. The front half settles the design before any code: **Kickoff** (Jax approves) -> **Concept** (the big idea in one line, named as a place or feeling, plus the audience, one goal, 3 reference sites and mood words; Jax approves, #229) -> **Story and sitemap** -> **Words** -> **Storyboard** (one ChatGPT frame per chapter, kept in order; Jax OKs that the site reads start to finish, #231) -> **Look and assets** -> **Motion test** (Cinematic only: motion tried on a real phone) -> **Design lock** (one bundle: concept, cards, storyboard, chosen look, assets, style numbers; Jax sends it and the client approves, or the team sends the Job back for changes, #238). The back half builds it: **Build** -> **Check** -> **Review** (one round, fixes only) -> **Launch** (Cloudflare Pages). ChatGPT makes every design choice; each front-half step's lead (Jax or Tyler) is picked when the Job starts. The real site is Astro + Tailwind, built by Claude Code from the house starter kit and the locked bundle, one repo per client (coming). Targets: Standard in 5 working days, Cinematic in 10.
**Chapter cards** carry the work: a story is pages, each page is chapters in order, and each card (name, job, words, layout, shots, motion, phone note, proof with source) becomes exactly one section of the site. A stage's gate refuses to finish until its card fields are filled (`stageGaps`). Build is assembly from the cards, style numbers and section library, through the site engine (#157); no new decisions. Employees change the site by clicking an element and telling Meridian; no code editing.

**Site engine (2026-10-26, #157):** every site Meridian builds is pages of **custom sections**. Each section has its own design written by Meridian, as a JSON element tree plus scoped CSS rules, with no raw HTML and no AI-written code. Motion comes only from named effects. Two builders share it: the **Pitch deck home page builder** (one concept page per tier, Tyler) and the **full Website builder** (Jax + Claude, the Build stage). When a client picks a tier, that home page becomes page one of their site (`fromHomePage`), and the full builder adds the other pages in the same look. Click-to-edit finds the element by its `data-edit` key and rewrites only that section. **Since 2026-10-27** the engine and builder screens are the storyboard's wireframe preview: the real site is built in Astro (above), and the engine gets no new features of its own.

## Waves
- **Wave 0** (now): clean slate, new rules, labels, Wave 1 issues.
- **Wave 1**: cloud server + router/keys/log/budgets (Jax+Claude); Studio frame and Space home (Tyler); Project DNA; Meridian Studio panel; Asset Library + Image gen (Cassy).
  Done when: Tyler or Cassy asks Meridian Studio for on-brand images for a real client, keeps them, sends them to Review, and Jax approves, with everything logged.
- **Wave 2**: Website, Standard tier, and **Pitch deck** (pulled forward by Jax, 2026-10-26). **Wave 3**: Website Cinematic + Video/Motion. **Wave 4**: Ad campaign, Social, Logo/Brand kit. **Wave 5**: Landing page, SEO, autopilot, A/B, learning presets.

## Pitch deck workflow (Wave 2, now)
How BV wins clients: each prospect gets an interactive Market Opportunity board they open from a QR code on phone or PC.
- **Start it inside a project**: Jax creates the client project in Command; inside it, the Pitch deck tile -> pick who builds each stage -> Start. Only client projects, one deck in progress at a time. The Job is **locked**: its stages and the board's sections never change; only the data, notes and assets do. Each Job keeps the stages it started with (template version).
- **Command owns the pipeline** (stages, who's assigned, tasks, notifications, approvals); Studio supplies the tools (research, Home page builder, board). Build split: Tyler builds the screens and the pitch deck tools (`tools/pitch-deck/**`); Jax + Claude build the core, server and rules, then put it together. Until that link exists, Studio runs the stages locally.
- **Stages**: Research + write -> Home page: Tier 1, Tier 2, Tier 3 (side by side) -> Assemble board -> Auto check -> Review (Jax) -> Publish (Jax) -> Print card.
- **Research + write**: Meridian finds the prospect's real numbers and drafts the words; the builder checks and edits. Every number traces to evidence; the AI never writes numbers.
- **Three custom home pages**, one per tier, each a clear step up from the last so the prospect sees where they could go. Home page only, not a full site. Every mockup carries a "Concept for discussion, not affiliated with [business]" line.
- **Auto check**: Meridian runs the deck checker, the evidence guard, a phone-size screenshot, a link check and an internal-words scan; a person reviews only what's flagged.
- **Every stage is assignable** to **Jax or Tyler** (the Pitch deck team): picked at Start and changeable until the stage is done; Review and Publish always stay with Jax, batched in the Overseer review inbox and approvable from the watch.
- **Every stage is timed** (opened, finished), shown to Jax so the slow steps are visible.
- **Everything is saved to the project's files**: research summary, deck data, the three home pages, the board, the QR card.
- Every number on the board is the prospect's own and has a source. Nothing internal (pricing, team, BV pipeline) ever appears on it. Google ratings and review counts are never stored; the board shows them live with the "Google Maps" credit.
- Demand is always shown as a labeled **estimate**, with a line saying how it was estimated; never hidden or "not available" (Jax, 2026-10-27).
- Sending decks by email or text follows CAN-SPAM and TCPA (consent, opt-out, real sender).

## Old work
Everything from before this plan is saved in git tags named `archive/2026-10-18/<branch>`. Issues tell you exactly which archived file to reuse. Don't copy from the archive unless your issue says to.

## Reference
`docs/reference/` holds older contracts with good rules (asset versions, project isolation, asset host). Use them for detail; this plan wins on any conflict.
