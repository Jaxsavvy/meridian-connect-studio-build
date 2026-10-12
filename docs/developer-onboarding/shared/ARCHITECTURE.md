# Architecture: current code and planned Studio

## The parts in ordinary language

- **Meridian Connect** is the Electron desktop application employees open. This repository owns its Windows client shell, login UI, project workspace UI, renderer assets, and API calls.
- **Team Hub / home-base service** is a separately managed backend. Connect sends login and project requests to its configured server URL. Its backend source and production configuration are not in this repository.
- **Meridian Core** is intended to own orchestration, project context, permissions, AI context boundaries, and background work. Core is restricted and must not be copied into an employee checkout. Its live behavior is not verified by this repository.
- **Meridian Studio** is the planned creative workspace inside Connect. It should reuse Connect navigation and the selected project. Its complete shell, common asset model, generation jobs, and provider adapters are **not implemented in this repository**.
- **Librarian AI** is a planned Studio capability for organizing and finding creative assets. Automatic naming, metadata, versions, and permissions need approved API and storage contracts; do not describe them as running features.
- **Creative tools** under consideration are ChatGPT Images, Storyboard, Higgsfield-powered Video Studio, Blender, Krita, Upscayl, Website Builder, Audio Studio, and Studio Files. Listing a tool here does not mean it is integrated or licensed.

## What this checkout confirms

| Area | Code reference | Confirmed scope |
| --- | --- | --- |
| Electron window, IPC, settings, updater | `src/main.js` | Desktop process and handlers exist. Settings can be overridden outside the checkout in user data. |
| Renderer bridge | `src/preload.js` | Exposes named `window.meridian` calls to the renderer. Preserve this boundary. |
| Login state and HTTP client | `src/auth.js`, `src/api.js` | Connect calls `/api/auth/login`, attaches its session token to API requests, and handles offline responses. Backend authorization remains a server responsibility. |
| Connect navigation and project selection | `src/renderer/app.js`, `src/renderer/project-workspace.js`, `src/renderer/nav.js` | Employee UI selects a project; workspace tabs include Files, Deliverables, and Storyboards. |
| Storyboard client | `src/renderer/storyboard.js` | UI sends project-scoped requests for creating, opening, editing, drafting, frames, PDF export, and review actions. The server implementation and end-to-end behavior are not verified here. |
| Visual language | `src/renderer/app.css`, `src/renderer/meridian-standard.css`, `src/renderer/fonts/`, `src/renderer/assets/` | Existing tokens, styles, fonts, icons, and imagery are the starting reference. |
| Distribution inputs | `package.json`, `config/settings.json`, `assets/meridian.ico`, `build/installer.nsh` | Electron packaging has a narrow file allowlist. New packaged files require owner review. |

The client sends project IDs through the bridge and API client. **Do not infer permission enforcement from a selected project, a hidden UI element, or a client-side check.** The separately managed service must authenticate each request and verify project membership, file access, and AI context boundaries. Do not probe live customer data to test this.

## Pending architecture decisions

The owner must approve the Studio navigation and design direction; asset record and revision contracts; where originals, derivatives, and metadata are stored; Librarian scope; Upscayl process and packaging boundaries; provider selection, spending limits, job states, and review flow; and the backend API contract. Build only an approved client slice. Document backend needs without creating a second project database or importing Core, Team Hub, or Overseer source. Langflow is retired for new Studio work.
