# Meridian Connect

Meridian Connect is the Electron desktop client for Breakthrough Ventures employees. This repository contains the Connect client source and its required design and installer assets. It does not contain Meridian Core, Team Hub, customer data, credentials, or a runnable backend.

New developers and coding assistants: begin with [START_HERE.md](START_HERE.md), then use your chair's onboarding package and the existing collaboration rules. An owner-approved issue is required before application changes.

## Source layout

- `src/main.js`, `src/preload.js`, `src/api.js`, `src/auth.js`, and `src/layout-store.js`: desktop shell, bridge, API client, authentication state, and local layout storage.
- `src/renderer/`: employee UI, project workspace, storyboard, images, and fonts.
- `config/settings.json`: safe distribution defaults. The loopback URL is for local development only.
- `assets/meridian.ico` and `build/installer.nsh`: application and Windows installer resources.
- `package.json` and `package-lock.json`: Electron dependencies and build configuration.

## Local development

Use a supported Node.js and npm installation on Windows. From this repository, install the locked dependencies with `npm ci`, then run `npm start` or `npm run dev`. The client needs a separately provisioned development Team Hub/Connect endpoint and authorized test account. Do not put an endpoint with credentials, tokens, or customer content in this repository. Configure personal settings through the application's user-data settings file or the `MERIDIAN_CONNECT_SETTINGS` override outside the checkout.

`npm run build` produces a Windows NSIS package without publishing it. For an unsigned local verification build on a Windows account that cannot create symlinks for Electron Builder's signing tool, use `npm run build -- --config.win.signAndEditExecutable=false`. This override skips executable signing and resource editing; use the normal build process in an appropriately configured release environment. The Electron application file list is deliberately limited to `src/`, `config/settings.json`, `assets/meridian.ico`, and `package.json`; the NSIS script and icon are additional build inputs. Review the packaged file list before distributing any build.

## Collaboration boundaries

Connect is a client. Server-side authentication, project membership, file access, and AI context filtering must be enforced by the separately managed services. Never rely on UI filtering as authorization. Keep Core, Team Hub, owner-only tools, and customer records in restricted locations. Follow `AGENTS.md` for development and AI assistant instructions.
