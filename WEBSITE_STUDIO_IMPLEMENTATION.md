# Website Studio technical implementation

## Implemented milestone

The first Website Builder milestone adds a development-only working surface to the existing Meridian Studio shell. It reuses the accepted Connect project context and keeps ordinary employee mode closed.

The new model supports:

- creating and reopening multiple website projects per Meridian project;
- persistent local save with primary, pending, and backup recovery copies;
- editable client brief;
- real sitemap pages with unique safe slugs;
- reusable page sections and content editing;
- model-backed responsive HTML preview;
- per-page standalone HTML download and programmatic whole-site output;
- bounded undo/redo;
- save-failure preservation and cross-project isolation.
- explicit unsaved-change protection for leaving Studio, project switching, and sign-out.

`src/renderer/app.js` loads the builder only inside the existing development gate. `studio-shell.js` supplies the employee-facing workflow and sandboxed preview. `website-builder.js` remains environment-neutral so its data, validation, persistence, preview, and export behavior can be tested without Electron.

## Intentional limits

This is a functional local development capability, not a claim of production service integration. The application does not yet have authoritative server persistence, asset placement, provider-backed AI, publishing, deployment, collaboration, full-site UI packaging, or production authorization evidence. Those boundaries remain explicit rather than simulated.
